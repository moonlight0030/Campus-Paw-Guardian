import { useState, useEffect, useCallback } from 'react';
import {
  fetchFeedingAudits,
  fetchAllFeedingPlans,
  confirmFeedingPlan,
  saveAIFeedingPlan,
  fetchPets,
} from '@/services/api';
import type { FeedingRecord, FeedingPlan, Pet } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { generateAIFeedingRecommendation } from '@/lib/feedingAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Utensils,
  AlertTriangle,
  Scale,
  Ban,
  Clock,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Edit3,
  CalendarCheck,
  CheckCircle2,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function FeedingManagementSection() {
  const { user } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'plans'>('audit');
  const [loading, setLoading] = useState(true);

  // 审计数据
  const [allRecords, setAllRecords] = useState<FeedingRecord[]>([]);
  const [todayRecords, setTodayRecords] = useState<FeedingRecord[]>([]);
  const [abnormalRecords, setAbnormalRecords] = useState<FeedingRecord[]>([]);
  const [totalTodayGrams, setTotalTodayGrams] = useState(0);
  const [totalTodayFeeds, setTotalTodayFeeds] = useState(0);
  const [repeatFeedCount, setRepeatFeedCount] = useState(0);
  const [forbiddenFeedCount, setForbiddenFeedCount] = useState(0);

  // 筛选器
  const [filterType, setFilterType] = useState<'all' | 'today' | 'abnormal' | 'unplanned'>('today');
  const [searchKw, setSearchKw] = useState('');

  // 计划数据
  const [plans, setPlans] = useState<any[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);

  // 计划编辑弹窗
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [currentEditPet, setCurrentEditPet] = useState<Pet | null>(null);
  const [formDailyGrams, setFormDailyGrams] = useState(60);
  const [formFeedTimes, setFormFeedTimes] = useState(2);
  const [formFoods, setFormFoods] = useState('');
  const [formTimeSlots, setFormTimeSlots] = useState('');
  const [formForbiddenFoods, setFormForbiddenFoods] = useState('');
  const [formRiskNotes, setFormRiskNotes] = useState('');
  const [confirmingPlan, setConfirmingPlan] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [auditData, planList, petRes] = await Promise.all([
        fetchFeedingAudits(),
        fetchAllFeedingPlans(),
        fetchPets({ page: 0, pageSize: 200 }),
      ]);

      setAllRecords(auditData.allRecords);
      setTodayRecords(auditData.todayRecords);
      setAbnormalRecords(auditData.abnormalRecords);
      setTotalTodayGrams(auditData.totalTodayGrams);
      setTotalTodayFeeds(auditData.totalTodayFeeds);
      setRepeatFeedCount(auditData.repeatFeedCount);
      setForbiddenFeedCount(auditData.forbiddenFeedCount);

      setPlans(planList);
      setPets(petRes.items);
    } catch (e) {
      console.error(e);
      toast.error('加载投喂管理数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 打开计划编辑
  const handleOpenEditPlan = (pet: Pet, existingPlan?: FeedingPlan | null) => {
    setCurrentEditPet(pet);
    if (existingPlan) {
      setFormDailyGrams(existingPlan.daily_amount_grams);
      setFormFeedTimes(existingPlan.feed_times_per_day);
      setFormFoods(existingPlan.recommended_foods.join('、'));
      setFormTimeSlots(existingPlan.feeding_time_slots.join('\n'));
      setFormForbiddenFoods(existingPlan.forbidden_foods.join('、'));
      setFormRiskNotes(existingPlan.risk_notes || '');
    } else {
      const aiRec = generateAIFeedingRecommendation(pet);
      setFormDailyGrams(aiRec.daily_amount_grams);
      setFormFeedTimes(aiRec.feed_times_per_day);
      setFormFoods(aiRec.recommended_foods.join('、'));
      setFormTimeSlots(aiRec.feeding_time_slots.join('\n'));
      setFormForbiddenFoods(aiRec.forbidden_foods.join('、'));
      setFormRiskNotes(aiRec.risk_notes);
    }
    setEditPlanOpen(true);
  };

  // 管理员保存并确认计划
  const handleSavePlan = async () => {
    if (!currentEditPet || !user) return;
    setConfirmingPlan(true);
    try {
      const foodsArray = formFoods
        .split(/[、,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const timeSlotsArray = formTimeSlots
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const forbiddenArray = formForbiddenFoods
        .split(/[、,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      await confirmFeedingPlan(
        currentEditPet.id,
        {
          daily_amount_grams: Number(formDailyGrams) || 60,
          feed_times_per_day: Number(formFeedTimes) || 2,
          recommended_foods: foodsArray.length > 0 ? foodsArray : ['全价宠粮'],
          feeding_time_slots: timeSlotsArray.length > 0 ? timeSlotsArray : ['早晨', '傍晚'],
          forbidden_foods: forbiddenArray.length > 0 ? forbiddenArray : ['巧克力', '洋葱'],
          risk_notes: formRiskNotes.trim(),
        },
        user.id
      );

      toast.success(`已成功确认并发布「${currentEditPet.name}」的每日投喂计划！`);
      setEditPlanOpen(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || '保存计划失败');
    } finally {
      setConfirmingPlan(false);
    }
  };

  // 过滤展示记录
  const displayRecords = (
    filterType === 'today'
      ? todayRecords
      : filterType === 'abnormal'
      ? abnormalRecords
      : filterType === 'unplanned'
      ? allRecords.filter((r) => r.is_planned === false)
      : allRecords
  ).filter((r) => {
    if (!searchKw.trim()) return true;
    const kw = searchKw.trim().toLowerCase();
    return (
      (r.food && r.food.toLowerCase().includes(kw)) ||
      (r.pet?.name && r.pet.name.toLowerCase().includes(kw)) ||
      (r.location && r.location.toLowerCase().includes(kw)) ||
      (r.author?.nickname && r.author.nickname.toLowerCase().includes(kw))
    );
  });

  return (
    <div className="space-y-6">
      {/* 顶部统计 4 宫格看板 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Scale className="w-4 h-4 text-primary" />
            今日全校投喂总量
          </div>
          <div className="text-2xl font-bold text-foreground">
            {totalTodayGrams} <span className="text-xs font-normal text-muted-foreground">克</span>
          </div>
          <p className="text-[11px] text-muted-foreground">今日共计 {totalTodayFeeds} 次爱心打卡</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-4 h-4 text-amber-500" />
            重复投喂次数
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {repeatFeedCount} <span className="text-xs font-normal text-muted-foreground">次</span>
          </div>
          <p className="text-[11px] text-muted-foreground">同动物单日 ≥2 次多发投喂</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Ban className="w-4 h-4 text-destructive" />
            禁忌/异常投喂流水
          </div>
          <div className="text-2xl font-bold text-destructive">
            {forbiddenFeedCount} <span className="text-xs font-normal text-muted-foreground">条</span>
          </div>
          <p className="text-[11px] text-muted-foreground">含巧克力/大蒜/过量等高危事件</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
            已生效投喂计划
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {plans.filter((p) => p.status === 'confirmed').length} / {pets.length}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {plans.filter((p) => p.status === 'pending_review').length} 只待管理员确认
          </p>
        </div>
      </div>

      {/* 子导航切换 */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={activeSubTab === 'audit' ? 'default' : 'outline'}
            onClick={() => setActiveSubTab('audit')}
            className="rounded-xl text-xs gap-1.5"
          >
            <Utensils className="w-3.5 h-3.5" />
            每日投喂流水与异常审计 ({displayRecords.length})
          </Button>
          <Button
            size="sm"
            variant={activeSubTab === 'plans' ? 'default' : 'outline'}
            onClick={() => setActiveSubTab('plans')}
            className="rounded-xl text-xs gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            全校投喂计划管理 ({pets.length} 只萌宠)
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={loadData}
          className="rounded-xl text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          刷新数据
        </Button>
      </div>

      {/* 子模块 1：投喂记录流水与异常审计 */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          {/* 筛选与搜索 */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> 筛选:
              </span>
              <Button
                size="sm"
                variant={filterType === 'today' ? 'secondary' : 'ghost'}
                onClick={() => setFilterType('today')}
                className="h-7 text-xs rounded-lg"
              >
                今日流水 ({todayRecords.length})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'abnormal' ? 'destructive' : 'ghost'}
                onClick={() => setFilterType('abnormal')}
                className={`h-7 text-xs rounded-lg ${filterType === 'abnormal' ? '' : 'text-destructive hover:bg-destructive/10'}`}
              >
                异常与禁忌 ({abnormalRecords.length})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'unplanned' ? 'secondary' : 'ghost'}
                onClick={() => setFilterType('unplanned')}
                className="h-7 text-xs rounded-lg"
              >
                计划外投喂
              </Button>
              <Button
                size="sm"
                variant={filterType === 'all' ? 'secondary' : 'ghost'}
                onClick={() => setFilterType('all')}
                className="h-7 text-xs rounded-lg"
              >
                全部记录 ({allRecords.length})
              </Button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchKw}
                onChange={(e) => setSearchKw(e.target.value)}
                placeholder="搜索萌宠、食物或地点"
                className="rounded-xl pl-8 h-8 text-xs"
              />
            </div>
          </div>

          {/* 记录列表展示 */}
          {loading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">加载投喂审计数据中...</div>
          ) : displayRecords.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-3xl border border-border/60 text-muted-foreground text-sm">
              暂无匹配的投喂流水记录
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayRecords.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-2xl border p-4 space-y-2.5 shadow-sm transition-all ${
                    r.is_forbidden
                      ? 'bg-destructive/10 border-destructive/40'
                      : r.status === 'overfed'
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-card border-border/60 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={r.pet?.photo_url || ''}
                        alt={r.pet?.name || '萌宠'}
                        className="w-10 h-10 rounded-xl object-cover shrink-0 border"
                      />
                      <div>
                        <h5 className="font-bold text-sm text-foreground">{r.pet?.name || '未知萌宠'}</h5>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(r.fed_at), 'MM-dd HH:mm', { locale: zhCN })}
                        </p>
                      </div>
                    </div>

                    {/* 状态标 */}
                    {r.is_forbidden ? (
                      <Badge variant="destructive" className="text-[10px] gap-1 px-2 py-0.5">
                        <Ban className="w-3 h-3" /> 禁忌违规
                      </Badge>
                    ) : r.status === 'overfed' ? (
                      <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px] px-2 py-0.5">
                        超额投喂
                      </Badge>
                    ) : r.is_planned === false ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground px-2 py-0.5">
                        计划外
                      </Badge>
                    ) : (
                      <Badge className="bg-primary/15 text-primary border-none text-[10px] px-2 py-0.5">
                        计划内推荐
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs space-y-1 bg-secondary/30 p-2.5 rounded-xl">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">投喂食物：</span>
                      <span className="font-semibold text-foreground">{r.food}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">记录克数：</span>
                      <span className="font-bold text-primary">{r.amount_grams ?? 40} g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">投喂地点：</span>
                      <span className="text-foreground truncate max-w-[140px]">{r.location || '校园点位'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">打卡同学：</span>
                      <span className="text-foreground">{r.author?.nickname || '爱心同学'}</span>
                    </div>
                  </div>

                  {r.warning_notes && (
                    <p className="text-xs text-destructive font-medium bg-destructive/15 p-2 rounded-lg">
                      ⚠️ 审计备注：{r.warning_notes}
                    </p>
                  )}

                  {r.photo_url && (
                    <div className="pt-1 flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">现场照片：</span>
                      <a href={r.photo_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={r.photo_url}
                          alt="现场"
                          className="w-12 h-12 rounded-lg object-cover border hover:opacity-90"
                        />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 子模块 2：全校动物投喂计划管理 */}
      {activeSubTab === 'plans' && (
        <div className="space-y-4">
          <div className="bg-card p-3 rounded-2xl border border-border/60 text-xs text-muted-foreground">
            管理员可对全校每只动物的投喂计划进行审核确认与动态校准。点击“确认/修改计划”可调取 AI 精准测算建议并正式发布。
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pets.map((pet) => {
              const matchedPlan = plans.find((p) => p.pet_id === pet.id);
              const isConfirmed = matchedPlan?.status === 'confirmed';
              const isPending = matchedPlan?.status === 'pending_review';

              return (
                <div key={pet.id} className="rounded-3xl border border-border/60 bg-card p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={pet.photo_url}
                        alt={pet.name}
                        className="w-12 h-12 rounded-2xl object-cover shrink-0 border"
                      />
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{pet.name}</h4>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3 text-primary/70" />
                          {pet.location_name}
                        </div>
                      </div>
                    </div>

                    {isConfirmed ? (
                      <Badge className="bg-primary/15 text-primary border border-primary/30 text-xs">
                        <ShieldCheck className="w-3 h-3 mr-1" /> 已确认
                      </Badge>
                    ) : isPending ? (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border border-amber-500/30 text-xs">
                        <Sparkles className="w-3 h-3 mr-1" /> AI草案待审
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        未建计划
                      </Badge>
                    )}
                  </div>

                  {/* 计划简要信息 */}
                  <div className="text-xs space-y-1 bg-secondary/30 p-2.5 rounded-2xl">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">建议每日总量：</span>
                      <span className="font-semibold text-foreground">
                        {matchedPlan?.daily_amount_grams || 60} g / 天
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">建议频次：</span>
                      <span className="text-foreground">{matchedPlan?.feed_times_per_day || 2} 次/天</span>
                    </div>
                    <div className="truncate">
                      <span className="text-muted-foreground">推荐食物：</span>
                      <span className="text-foreground">
                        {matchedPlan?.recommended_foods?.join('、') || '全价宠粮、罐头'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleOpenEditPlan(pet, matchedPlan)}
                      className="rounded-xl text-xs h-8 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {isConfirmed ? '修改计划' : '审核确认 AI 建议'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 计划编辑弹窗 */}
      <Dialog open={editPlanOpen} onOpenChange={setEditPlanOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              审核并确认「{currentEditPet?.name}」投喂计划
            </DialogTitle>
            <DialogDescription>
              结合 AI 针对该动物健康特征（生病/术后/幼崽/绝育）的建议，进行确认与微调，确认后正式向全校生效。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formRiskNotes && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-200">
                <strong>风险识别：</strong>{formRiskNotes}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">建议每日总量 (克/g)</label>
                <Input
                  type="number"
                  min={10}
                  max={500}
                  value={formDailyGrams}
                  onChange={(e) => setFormDailyGrams(Number(e.target.value))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">建议投喂频次 (次/天)</label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={formFeedTimes}
                  onChange={(e) => setFormFeedTimes(Number(e.target.value))}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">建议食物类型 (用顿号隔开)</label>
              <Input
                value={formFoods}
                onChange={(e) => setFormFoods(e.target.value)}
                placeholder="全价天然粮、主食罐头、纯肉冻干"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">建议时间段 (每行一个)</label>
              <Textarea
                rows={2}
                value={formTimeSlots}
                onChange={(e) => setFormTimeSlots(e.target.value)}
                placeholder="早间 07:30 - 09:00&#10;傍晚 17:30 - 19:30"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">严禁投喂清单 (用顿号隔开)</label>
              <Input
                value={formForbiddenFoods}
                onChange={(e) => setFormForbiddenFoods(e.target.value)}
                placeholder="巧克力、洋葱大蒜、葡萄、木糖醇"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">特殊护理与风险说明</label>
              <Textarea
                rows={3}
                value={formRiskNotes}
                onChange={(e) => setFormRiskNotes(e.target.value)}
                placeholder="特殊生理期、术后胃肠道防护等说明..."
                className="rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditPlanOpen(false)} className="rounded-xl">
              取消
            </Button>
            <Button
              onClick={handleSavePlan}
              disabled={confirmingPlan}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              {confirmingPlan ? '保存中...' : '确认并正式发布计划'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
