import { useState, useEffect, useCallback } from 'react';
import type { Pet, FeedingPlan, PetTodayFeedingStats } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { fetchFeedingPlan, saveAIFeedingPlan, confirmFeedingPlan, fetchPetTodayFeedingStats } from '@/services/api';
import { generateAIFeedingRecommendation } from '@/lib/feedingAI';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  Scale,
  Ban,
  Utensils,
  CheckCircle2,
  CalendarCheck,
  RefreshCw,
  Edit3,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface DailyFeedingPlanSectionProps {
  pet: Pet;
  onRefreshStats?: () => void;
}

export default function DailyFeedingPlanSection({ pet, onRefreshStats }: DailyFeedingPlanSectionProps) {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [plan, setPlan] = useState<FeedingPlan | null>(null);
  const [stats, setStats] = useState<PetTodayFeedingStats | null>(null);
  const [loading, setLoading] = useState(true);

  // 管理员编辑/确认弹窗状态
  const [editOpen, setEditOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  // 表单状态
  const [formDailyGrams, setFormDailyGrams] = useState(60);
  const [formFeedTimes, setFormFeedTimes] = useState(2);
  const [formFoods, setFormFoods] = useState('');
  const [formTimeSlots, setFormTimeSlots] = useState('');
  const [formForbiddenFoods, setFormForbiddenFoods] = useState('');
  const [formRiskNotes, setFormRiskNotes] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const currentPlan = await fetchFeedingPlan(pet.id);
      setPlan(currentPlan);

      const targetGrams = currentPlan?.daily_amount_grams || 60;
      const currentStats = await fetchPetTodayFeedingStats(pet.id, targetGrams);
      setStats(currentStats);
    } catch (e) {
      console.error('加载投喂计划失败:', e);
    } finally {
      setLoading(false);
    }
  }, [pet.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 打开编辑确认弹窗
  const handleOpenEdit = (useAI = false) => {
    if (useAI || !plan) {
      // 依据动物真实品种、体型、健康状态生成 AI 建议
      const aiRec = generateAIFeedingRecommendation(pet);
      setFormDailyGrams(aiRec.daily_amount_grams);
      setFormFeedTimes(aiRec.feed_times_per_day);
      setFormFoods(aiRec.recommended_foods.join('、'));
      setFormTimeSlots(aiRec.feeding_time_slots.join('\n'));
      setFormForbiddenFoods(aiRec.forbidden_foods.join('、'));
      setFormRiskNotes(aiRec.risk_notes);
    } else {
      setFormDailyGrams(plan.daily_amount_grams);
      setFormFeedTimes(plan.feed_times_per_day);
      setFormFoods(plan.recommended_foods.join('、'));
      setFormTimeSlots(plan.feeding_time_slots.join('\n'));
      setFormForbiddenFoods(plan.forbidden_foods.join('、'));
      setFormRiskNotes(plan.risk_notes || '');
    }
    setEditOpen(true);
  };

  // 一键生成 AI 建议草案（不直接生效，待管理员确认）
  const handleGenerateAIOld = async () => {
    if (!user) return;
    try {
      setGeneratingAI(true);
      const aiRec = generateAIFeedingRecommendation(pet);
      const newPlan = await saveAIFeedingPlan(pet.id, {
        daily_amount_grams: aiRec.daily_amount_grams,
        feed_times_per_day: aiRec.feed_times_per_day,
        recommended_foods: aiRec.recommended_foods,
        feeding_time_slots: aiRec.feeding_time_slots,
        forbidden_foods: aiRec.forbidden_foods,
        risk_notes: aiRec.risk_notes,
        ai_suggestion_raw: {
          recommendation: aiRec,
          generated_by: user.id,
          generated_at: new Date().toISOString(),
        },
      });
      setPlan(newPlan);
      toast.success('已生成 AI 投喂建议草案，请管理员确认后生效！');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('生成 AI 建议失败，请稍后重试');
    } finally {
      setGeneratingAI(false);
    }
  };

  // 管理员确认并发布计划
  const handleConfirmPlan = async () => {
    if (!user || !isAdmin) {
      toast.error('只有管理员有权确认并发布每日投喂计划');
      return;
    }
    try {
      setConfirming(true);
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

      const confirmedPlan = await confirmFeedingPlan(
        pet.id,
        {
          daily_amount_grams: Number(formDailyGrams) || 60,
          feed_times_per_day: Number(formFeedTimes) || 2,
          recommended_foods: foodsArray.length > 0 ? foodsArray : ['优质宠粮'],
          feeding_time_slots: timeSlotsArray.length > 0 ? timeSlotsArray : ['早晨', '傍晚'],
          forbidden_foods: forbiddenArray.length > 0 ? forbiddenArray : ['巧克力', '洋葱'],
          risk_notes: formRiskNotes.trim(),
        },
        user.id
      );

      setPlan(confirmedPlan);
      setEditOpen(false);
      toast.success('每日投喂计划已成功确认并正式发布！');
      loadData();
      onRefreshStats?.();
    } catch (e) {
      console.error(e);
      toast.error('确认计划失败，请重试');
    } finally {
      setConfirming(false);
    }
  };

  // 进度计算
  const dailyTarget = plan?.daily_amount_grams || 60;
  const todayGrams = stats?.today_grams || 0;
  const todayCount = stats?.today_count || 0;
  const remainingGrams = Math.max(dailyTarget - todayGrams, 0);
  const progressPercent = Math.min(Math.round((todayGrams / dailyTarget) * 100), 100);

  const isConfirmed = plan?.status === 'confirmed';
  const isPendingReview = plan?.status === 'pending_review';

  // 状态徽标与文案
  let statusBadge = (
    <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground gap-1">
      今日未投喂
    </Badge>
  );
  if (stats?.is_overfed) {
    statusBadge = (
      <Badge variant="destructive" className="gap-1 animate-pulse">
        <AlertTriangle className="w-3 h-3" />
        超量预警 (已超量)
      </Badge>
    );
  } else if (stats?.is_reached) {
    statusBadge = (
      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
        <CheckCircle2 className="w-3 h-3" />
        已达标 (勿重复投喂)
      </Badge>
    );
  } else if (todayGrams > 0) {
    statusBadge = (
      <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300">
        <Utensils className="w-3 h-3" />
        正常投喂中
      </Badge>
    );
  }

  return (
    <div className="rounded-3xl bg-card border border-border/60 p-5 md:p-6 space-y-5">
      {/* 头部标题与控制区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-rounded font-bold text-foreground flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-primary" />
              每日投喂计划
            </h3>
            {isConfirmed ? (
              <Badge className="bg-primary/15 text-primary border border-primary/30 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                管理员已确认正式生效
              </Badge>
            ) : isPendingReview ? (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border border-amber-500/30 text-xs">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                AI 建议生成中 (待管理员确认)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                未制定正式计划
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            采用“AI 营养算法建议 + 动协管理员确认”机制，严控每日进食量，杜绝重复投喂与禁忌投喂
          </p>
        </div>

        {/* 管理员操作按钮 */}
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenEdit(false)}
              className="rounded-xl gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isConfirmed ? '修改计划' : '确认/修改 AI 建议'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={generatingAI}
              onClick={handleGenerateAIOld}
              className="rounded-xl gap-1 text-muted-foreground hover:text-primary"
              title="根据动物最新健康状况重新生成 AI 建议"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generatingAI ? 'animate-spin' : ''}`} />
              重新生成建议
            </Button>
          </div>
        )}
      </div>

      {/* 待确认或未制定时的 AI 提示条 */}
      {!isConfirmed && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1 text-amber-900 dark:text-amber-200">
            <p className="font-semibold">
              {isPendingReview ? '当前显示为【AI 初步建议草案】，尚未经管理员最终确认' : '该动物尚未制定已生效的投喂计划'}
            </p>
            <p className="opacity-90">
              AI 算法已依据「{pet.name}」的物种（{pet.species === 'cat' ? '猫咪' : '狗狗'}）、绝育状态及健康标签自动计算基准参数。普通用户可按建议参考，管理员确认后将作为全校标准计划执行。
            </p>
          </div>
        </div>
      )}

      {/* 今日投喂进度条看板 */}
      <div className="rounded-2xl bg-secondary/30 border border-border/60 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">今日投喂状态看板</span>
            {statusBadge}
          </div>
          <div className="text-xs text-muted-foreground">
            今日投喂次数：<span className="font-semibold text-foreground">{todayCount}</span> 次
          </div>
        </div>

        {/* 进度条 */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-foreground">
              今日已投喂：<strong className="text-primary text-sm">{todayGrams}</strong> / {dailyTarget} g
            </span>
            <span className={stats?.is_reached ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
              {stats?.is_reached ? '已达成 100%' : `剩余可投喂：${remainingGrams} g`}
            </span>
          </div>
          <Progress
            value={progressPercent}
            className={`h-2.5 rounded-full ${
              stats?.is_overfed
                ? '[&>div]:bg-destructive'
                : stats?.is_reached
                ? '[&>div]:bg-emerald-500'
                : '[&>div]:bg-primary'
            }`}
          />
        </div>

        {/* 达标或超量警示文案 */}
        {stats?.is_overfed ? (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>超量严重警告：</strong>今日累计投喂已达 {todayGrams}g（超过建议上限）！暴饮暴食易诱发流浪动物急性肠胃炎与胰腺炎，请立刻停止投喂！建议改为提供干净饮水或观察精神状态。
            </span>
          </div>
        ) : stats?.is_reached ? (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              <strong>达标提醒：</strong>今日该动物已达到建议每日投喂量（{dailyTarget}g），请勿重复投喂！请将食物留给校园里其他饥饿的毛孩子～
            </span>
          </div>
        ) : null}
      </div>

      {/* 计划详情核心 4 宫格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 建议每日投喂量 */}
        <div className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Scale className="w-3.5 h-3.5 text-primary" />
            建议每日投喂量
          </div>
          <div className="text-xl font-bold text-foreground">
            {dailyTarget} <span className="text-xs font-normal text-muted-foreground">克 / 天</span>
          </div>
          <div className="text-xs text-muted-foreground">
            建议每日投喂 <strong className="text-foreground">{plan?.feed_times_per_day || 2}</strong> 次，少量多次
          </div>
        </div>

        {/* 建议食物类型 */}
        <div className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Utensils className="w-3.5 h-3.5 text-primary" />
            建议食物类型
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {(plan?.recommended_foods || ['全价天然粮', '主食纯肉罐头']).map((food) => (
              <span key={food} className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md font-medium">
                {food}
              </span>
            ))}
          </div>
        </div>

        {/* 建议投喂时间段 */}
        <div className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5 text-primary" />
            建议投喂时间段
          </div>
          <div className="space-y-0.5 text-xs text-foreground font-medium">
            {(plan?.feeding_time_slots || ['早间 07:30 - 09:00', '傍晚 17:30 - 19:30']).map((slot) => (
              <div key={slot} className="flex items-center gap-1 text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" />
                <span className="text-foreground">{slot}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 剩余可投喂量 */}
        <div className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 text-primary" />
            今日剩余额度
          </div>
          <div className={`text-xl font-bold ${remainingGrams === 0 ? 'text-muted-foreground' : 'text-primary'}`}>
            {remainingGrams} <span className="text-xs font-normal text-muted-foreground">克</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {remainingGrams === 0 ? '今日投喂已饱和' : '请在建议时段前往打卡'}
          </p>
        </div>
      </div>

      {/* 禁忌食物严禁清单 */}
      <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 space-y-2">
        <div className="flex items-center gap-2 text-destructive font-semibold text-xs md:text-sm">
          <Ban className="w-4 h-4 text-destructive shrink-0" />
          <span>严禁投喂清单（含致命毒物与高危伤害食物，请师生严格遵守）</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(plan?.forbidden_foods || [
            '巧克力/可可',
            '洋葱与大蒜',
            '葡萄/葡萄干',
            '木糖醇口香糖',
            '尖锐熟鸡骨',
            '人类剩菜剩饭',
          ]).map((item) => (
            <Badge
              key={item}
              variant="outline"
              className="border-destructive/40 bg-destructive/10 text-destructive text-xs py-0.5 px-2"
            >
              🚫 {item}
            </Badge>
          ))}
        </div>
      </div>

      {/* 特殊风险与兽医护理说明（针对生病、术后、幼崽、孕期等保守指引） */}
      {plan?.risk_notes && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">生理/健康特殊风险提示（AI 保守管控）：</span>
            <p className="whitespace-pre-line leading-relaxed opacity-95">{plan.risk_notes}</p>
          </div>
        </div>
      )}

      {/* 管理员确认/修改计划弹窗 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              审核并确认「{pet.name}」每日投喂计划
            </DialogTitle>
            <DialogDescription>
              管理员可在 AI 科学建议的基础上进行校准与确认，确认后将作为全校师生的公开正式投喂标准生效。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 风险提示提醒 */}
            {formRiskNotes && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-200">
                <strong>风险识别：</strong>{formRiskNotes}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">建议每日投喂总量 (克/g)</label>
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
                <label className="text-xs font-semibold text-foreground">建议每日投喂频次 (次/天)</label>
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
              <label className="text-xs font-semibold text-foreground">建议食物类型 (多个请用顿号或逗号隔开)</label>
              <Input
                value={formFoods}
                onChange={(e) => setFormFoods(e.target.value)}
                placeholder="例如：全价成猫粮、主食纯肉罐头、脱水冻干"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">建议投喂时间段 (每行一个)</label>
              <Textarea
                rows={2}
                value={formTimeSlots}
                onChange={(e) => setFormTimeSlots(e.target.value)}
                placeholder="早间 07:30 - 09:00&#10;傍晚 17:30 - 19:30"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">严禁投喂清单 (多个用顿号隔开)</label>
              <Input
                value={formForbiddenFoods}
                onChange={(e) => setFormForbiddenFoods(e.target.value)}
                placeholder="例如：巧克力、洋葱大蒜、葡萄、木糖醇、尖锐熟骨"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">特殊风险说明 / 投喂注意事项</label>
              <Textarea
                rows={3}
                value={formRiskNotes}
                onChange={(e) => setFormRiskNotes(e.target.value)}
                placeholder="填写生理期、术后、幼崽或特殊肠胃防护注意事项..."
                className="rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">
              取消
            </Button>
            <Button
              onClick={handleConfirmPlan}
              disabled={confirming}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              {confirming ? '确认中...' : '确认并正式发布计划'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
