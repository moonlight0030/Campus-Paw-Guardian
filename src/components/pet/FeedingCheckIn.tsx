import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchFeedings,
  createFeeding,
  fetchFeedingPlan,
  fetchPetTodayFeedingStats,
  uploadSightingPhoto,
} from '@/services/api';
import type { Pet, FeedingRecord, FeedingPlan, PetTodayFeedingStats } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { checkForbiddenFood } from '@/lib/feedingAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  UtensilsCrossed,
  Loader2,
  Flame,
  Sparkles,
  Clock,
  Plus,
  Scale,
  MapPin,
  Camera,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  Droplets,
  ShieldAlert,
} from 'lucide-react';

const FOOD_TYPES = [
  { id: 'dry_food', label: '全价干粮', defaultGrams: 40 },
  { id: 'canned_food', label: '主食湿粮/罐头', defaultGrams: 50 },
  { id: 'freeze_dried', label: '纯肉冻干', defaultGrams: 20 },
  { id: 'boiled_meat', label: '熟肉/水煮肉', defaultGrams: 30 },
  { id: 'custom', label: '自备/其它食物', defaultGrams: 40 },
];

const QUICK_GRAMS = [20, 35, 50, 70];

const isToday = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

interface FeedingCheckInProps {
  pet: Pet;
  onFeedingSuccess?: () => void;
}

export default function FeedingCheckIn({ pet, onFeedingSuccess }: FeedingCheckInProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [records, setRecords] = useState<FeedingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<FeedingPlan | null>(null);
  const [stats, setStats] = useState<PetTodayFeedingStats | null>(null);

  // 表单状态
  const [foodType, setFoodType] = useState('dry_food');
  const [foodName, setFoodName] = useState('');
  const [amountGrams, setAmountGrams] = useState(40);
  const [location, setLocation] = useState(pet.location_name || '常出没点位');
  const [photoUrl, setPhotoUrl] = useState('');
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 弹窗状态
  // 1. 禁忌食物告警弹窗
  const [forbiddenWarningOpen, setForbiddenWarningOpen] = useState(false);
  const [forbiddenMessage, setForbiddenMessage] = useState('');
  const [forbiddenItemName, setForbiddenItemName] = useState('');

  // 2. 达标 / 超量温馨拦截弹窗
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false);
  const [thresholdType, setThresholdType] = useState<'reached' | 'overfed'>('reached');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [feedingsList, currentPlan] = await Promise.all([
        fetchFeedings(pet.id),
        fetchFeedingPlan(pet.id),
      ]);
      setRecords(feedingsList);
      setPlan(currentPlan);

      const targetGrams = currentPlan?.daily_amount_grams || 60;
      const currentStats = await fetchPetTodayFeedingStats(pet.id, targetGrams);
      setStats(currentStats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [pet.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 执行最终提交写入
  const doSubmitFeeding = async (options?: { isForbidden?: boolean; status?: 'normal' | 'warning' | 'overfed' | 'forbidden'; warningNotes?: string }) => {
    setSubmitting(true);
    try {
      const selectedTypeObj = FOOD_TYPES.find((t) => t.id === foodType);
      const displayFood = foodName.trim() || selectedTypeObj?.label || '宠粮';

      // 判断是否属于已确认计划内推荐食物
      let isPlanned = true;
      if (plan?.recommended_foods && plan.recommended_foods.length > 0) {
        isPlanned = plan.recommended_foods.some(
          (rf) => displayFood.includes(rf) || rf.includes(displayFood) || (selectedTypeObj && rf.includes(selectedTypeObj.label))
        );
      }

      const status = options?.status || (options?.isForbidden ? 'forbidden' : 'normal');

      await createFeeding({
        petId: pet.id,
        food: displayFood,
        amountGrams: Number(amountGrams) || 40,
        foodType,
        photoUrl: photoUrl || null,
        location: location.trim() || null,
        isPlanned,
        isForbidden: !!options?.isForbidden,
        status,
        warningNotes: options?.warningNotes || null,
      });

      if (options?.isForbidden) {
        toast.warning('⚠️ 投喂包含禁忌成分，已以异常投喂状态归档并通知动协！');
      } else if (status === 'overfed') {
        toast.info('投喂已记录，系统检测到该动物今日已超量，请注意节制！');
      } else {
        toast.success(`投喂打卡成功！已为 ${pet.name} 补充 ${amountGrams}g 能量～`);
      }

      setFoodName('');
      setPhotoUrl('');
      setShowPhotoUpload(false);
      loadData();
      onFeedingSuccess?.();
    } catch (e) {
      console.error(e);
      toast.error('打卡提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 用户点击“立即打卡”进行预检
  const handlePreCheckIn = () => {
    if (!user) {
      toast.error('请先登录再进行投喂打卡');
      navigate('/login');
      return;
    }

    const selectedTypeObj = FOOD_TYPES.find((t) => t.id === foodType);
    const textToCheck = `${foodName} ${selectedTypeObj?.label || ''}`;

    // 1. 严格禁忌食物拦截
    const forbiddenCheck = checkForbiddenFood(textToCheck, pet.species);
    if (forbiddenCheck.isForbidden) {
      const topHazard = forbiddenCheck.matchedItems[0];
      setForbiddenItemName(topHazard?.name || '禁忌食物');
      setForbiddenMessage(forbiddenCheck.warningMessage);
      setForbiddenWarningOpen(true);
      return;
    }

    // 2. 检查投喂量阈值（达标与超量拦截提示）
    const targetGrams = plan?.daily_amount_grams || 60;
    const currentTodayGrams = stats?.today_grams || 0;
    const nextTotal = currentTodayGrams + (Number(amountGrams) || 40);

    if (currentTodayGrams >= targetGrams) {
      // 已经达到建议投喂量，再次投喂属于超额
      setThresholdType('overfed');
      setThresholdDialogOpen(true);
      return;
    }

    if (nextTotal > targetGrams && currentTodayGrams > 0) {
      // 本次投喂后将超过建议投喂量
      setThresholdType('reached');
      setThresholdDialogOpen(true);
      return;
    }

    // 正常通过校验，直接提交
    doSubmitFeeding();
  };

  const todayRecords = records.filter((r) => isToday(r.fed_at));
  const todayCount = todayRecords.length;
  const todayPeople = new Set(todayRecords.map((r) => r.user_id)).size;

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base md:text-lg font-rounded font-bold text-foreground flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-primary" />
          科学投喂打卡
        </h3>
        {todayCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-primary bg-primary/10 rounded-full px-3 py-1 font-medium">
            <Flame className="w-4 h-4 text-primary" />
            今日已打卡 {todayCount} 次 · {todayPeople} 位同学
          </span>
        )}
      </div>

      {/* 投喂打卡表单卡片 */}
      <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4 space-y-4">
        {/* 1. 选择食物类型 */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            1. 选择食物类型
          </label>
          <div className="flex flex-wrap gap-2">
            {FOOD_TYPES.map((t) => {
              const active = foodType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setFoodType(t.id);
                    setAmountGrams(t.defaultGrams);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-background border border-border/80 text-foreground hover:bg-secondary/50'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 详细食物名称与备注 */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            2. 具体品牌/说明 (系统将自动检测禁忌成分)
          </label>
          <Input
            value={foodName}
            onChange={(e) => setFoodName(e.target.value)}
            placeholder="例如：渴望全价成猫粮、主食鸡肉罐、温水泡冻干"
            className="rounded-xl bg-background"
            maxLength={60}
          />
        </div>

        {/* 3. 填写大概重量 (g) */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label className="font-semibold text-foreground flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-primary" />
              3. 本次投喂重量 (克 / g)
            </label>
            <span className="font-bold text-primary text-sm">{amountGrams} g</span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={5}
              max={250}
              value={amountGrams}
              onChange={(e) => setAmountGrams(Number(e.target.value) || 0)}
              className="rounded-xl bg-background w-28"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_GRAMS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setAmountGrams(g)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    amountGrams === g
                      ? 'bg-primary/15 border-primary text-primary font-bold'
                      : 'bg-background border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {g}g
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. 投喂地点与照片 (选填) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 text-primary" />
              投喂地点
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="如：图书馆北侧花坛"
              className="rounded-xl bg-background text-xs"
              maxLength={40}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Camera className="w-3 h-3 text-primary" />
              投喂现场照片 (选填)
            </label>
            {photoUrl ? (
              <div className="flex items-center gap-2">
                <img src={photoUrl} alt="投喂照片" className="w-10 h-10 rounded-lg object-cover border" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPhotoUrl('')}
                  className="rounded-xl text-xs h-8"
                >
                  更换照片
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center w-full rounded-xl text-xs h-9 border border-dashed border-border/80 cursor-pointer hover:bg-secondary/40 transition-colors text-muted-foreground">
                <Plus className="w-3.5 h-3.5 mr-1" />
                上传现场照片
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !user) return;
                    try {
                      toast.loading('正在上传照片...', { id: 'upload-feeding-photo' });
                      const url = await uploadSightingPhoto(user.id, file);
                      setPhotoUrl(url);
                      toast.success('现场照片上传成功！', { id: 'upload-feeding-photo' });
                    } catch (err) {
                      console.error(err);
                      toast.error('照片上传失败，请重试', { id: 'upload-feeding-photo' });
                    }
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {/* 打卡提交主按钮 */}
        <div className="pt-2">
          <Button
            onClick={handlePreCheckIn}
            disabled={submitting}
            className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-2.5 h-11 gap-2 shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在记录打卡与安全审计...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                提交投喂打卡 ({amountGrams}g)
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 打卡历史流水列表 */}
      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-semibold text-muted-foreground">近期投喂流水明细</h4>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-2xl">
            暂无投喂打卡记录，快来为小家伙记录今天的第一口美味吧～
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {records.map((r) => {
              const isRecToday = isToday(r.fed_at);
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                    r.is_forbidden
                      ? 'bg-destructive/10 border-destructive/30'
                      : r.status === 'overfed'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-card border-border/50 hover:bg-secondary/30'
                  }`}
                >
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={r.author?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {(r.author?.nickname || '同').slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-sm text-foreground">
                        {r.author?.nickname || '爱心同学'}
                      </span>
                      <span className="text-xs text-muted-foreground">投喂了</span>
                      <span className="font-semibold text-sm text-foreground">{r.food}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {r.amount_grams ?? 40}g
                      </Badge>

                      {r.is_forbidden ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                          <Ban className="w-2.5 h-2.5" /> 禁忌异常
                        </Badge>
                      ) : r.status === 'overfed' ? (
                        <Badge variant="outline" className="border-amber-500/50 text-amber-600 text-[10px] px-1.5 py-0 h-4">
                          超额投喂
                        </Badge>
                      ) : r.is_planned === false ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                          计划外投喂
                        </Badge>
                      ) : (
                        <Badge className="bg-primary/15 text-primary text-[10px] px-1.5 py-0 h-4 border-none">
                          计划内
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {isRecToday
                          ? formatDistanceToNow(new Date(r.fed_at), { addSuffix: true, locale: zhCN })
                          : new Date(r.fed_at).toLocaleString('zh-CN', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                      </span>
                      {r.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 text-primary/70" />
                          {r.location}
                        </span>
                      )}
                    </div>

                    {r.warning_notes && (
                      <p className="text-[11px] text-destructive mt-1">{r.warning_notes}</p>
                    )}
                  </div>

                  {/* 投喂现场照片缩略图 */}
                  {r.photo_url && (
                    <a
                      href={r.photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <img
                        src={r.photo_url}
                        alt="现场"
                        className="w-10 h-10 rounded-xl object-cover border border-border/80 hover:opacity-90 transition-opacity"
                      />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 弹窗 1：禁忌食物高危警告弹窗 */}
      <AlertDialog open={forbiddenWarningOpen} onOpenChange={setForbiddenWarningOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <AlertDialogTitle className="text-destructive font-bold text-base">
                致命危险！检测到严禁投喂食物
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-foreground text-xs md:text-sm leading-relaxed space-y-2 pt-2">
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-destructive font-medium">
                {forbiddenMessage}
              </div>
              <p className="text-muted-foreground">
                流浪动物代谢机能极其特殊，人类常吃的<strong>{forbiddenItemName}</strong>对它们可能会造成不可逆的急性溶血、神经麻痹或急性肾衰死亡！请立即更换为猫狗专用粮食或纯肉。
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
              我已知晓并取消投喂
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setForbiddenWarningOpen(false);
                doSubmitFeeding({
                  isForbidden: true,
                  status: 'forbidden',
                  warningNotes: `包含禁忌物「${forbiddenItemName}」，系统已拦截并异常备案！`,
                });
              }}
              className="rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/40 text-xs"
            >
              仍然执意登记 (将标红记录违规)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 弹窗 2：达标与超量防护拦截引导弹窗 */}
      <Dialog open={thresholdDialogOpen} onOpenChange={setThresholdDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {thresholdType === 'overfed' ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <span className="text-destructive">防过量提醒：今日已达建议投喂量！</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-amber-600" />
                  <span>投喂提示：即将达到每日建议上限</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs md:text-sm text-foreground pt-2 space-y-3">
              {thresholdType === 'overfed' ? (
                <>
                  <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-destructive text-xs leading-relaxed">
                    <strong>今日该动物已达到建议每日投喂量（已投喂 {stats?.today_grams}g / 建议 {plan?.daily_amount_grams || 60}g），请勿重复投喂！</strong>
                  </div>
                  <div className="space-y-2 text-muted-foreground text-xs">
                    <p className="font-semibold text-foreground">建议您改为进行以下暖心关怀：</p>
                    <div className="flex items-start gap-2">
                      <Droplets className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                      <span><strong>补充干净饮水：</strong>清洗水碗，换上一碗干净清凉的饮用水（对流浪动物同样重要）。</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Eye className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>记录遇见观察：</strong>在页面上方发布「遇见足迹」，记录它的出没位置和精神状态。</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span><strong>上报健康异常：</strong>若发现精神萎靡、受伤或呕吐腹泻，请及时向动协上报。</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground leading-relaxed">
                  提交本次 {amountGrams}g 投喂后，「{pet.name}」今日进食量将达到或超过每日建议上限（{plan?.daily_amount_grams || 60}g）。暴饮暴食会导致消化不良，请确认是否需要调整本次投喂克数。
                </p>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setThresholdDialogOpen(false)}
              className="rounded-xl"
            >
              返回修改或取消
            </Button>
            <Button
              onClick={() => {
                setThresholdDialogOpen(false);
                doSubmitFeeding({
                  status: thresholdType === 'overfed' ? 'overfed' : 'normal',
                  warningNotes: thresholdType === 'overfed' ? '今日该动物已达到建议投喂量，属于重复超额投喂' : undefined,
                });
              }}
              className={`rounded-xl text-white ${
                thresholdType === 'overfed'
                  ? 'bg-destructive hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {thresholdType === 'overfed' ? '确认超量打卡' : '确认提交投喂'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
