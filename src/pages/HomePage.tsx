import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPets, touchLastSeen, fetchGuardiansCount, subscribeGuardians } from '@/services/api';
import type { Pet } from '@/types/types';
import PetGrid from '@/components/pet/PetGrid';
import GuardiansDialog from '@/components/GuardiansDialog';
import SightingDialog from '@/components/SightingDialog';
import { Button } from '@/components/ui/button';
import { PawPrint, Heart, ShieldCheck, Sparkles, PlusCircle, X, MapPin } from 'lucide-react';

type StatKey = 'total' | 'neutered' | 'guardian';

export default function HomePage() {
  const navigate = useNavigate();
  const [pets, setPets] = useState<Pet[]>([]);
  const [activeStat, setActiveStat] = useState<StatKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardianOpen, setGuardianOpen] = useState(false);
  const [sightingOpen, setSightingOpen] = useState(false);
  const [guardianCount, setGuardianCount] = useState<number>(0);

  const loadGuardiansCount = useCallback(async () => {
    try {
      const count = await fetchGuardiansCount();
      setGuardianCount(count);
    } catch (e) {
      console.error('加载守护者数量失败', e);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 一次拉取全部档案，确保统计数字与下方列表展示完全一致
      const [res, count] = await Promise.all([
        fetchPets({ page: 0, pageSize: 500 }),
        fetchGuardiansCount(),
      ]);
      setPets(res.items);
      setGuardianCount(count);
    } catch (e) {
      console.error('加载失败', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 实时监听守护者（已注册用户）变动，并辅以 30 秒轮询保障实时性
  useEffect(() => {
    const unsubscribe = subscribeGuardians(() => {
      loadGuardiansCount();
    }, 'home');
    const intervalTimer = setInterval(() => {
      loadGuardiansCount();
    }, 30 * 1000);

    return () => {
      unsubscribe();
      clearInterval(intervalTimer);
    };
  }, [loadGuardiansCount]);

  // 更新当前用户活跃时间，用于在线状态展示（进入首页及每 3 分钟一次）
  useEffect(() => {
    touchLastSeen().catch(() => {});
    const timer = setInterval(() => {
      touchLastSeen().catch(() => {});
    }, 3 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // 点击统计卡片的处理：守护者打开弹窗，其余切换筛选
  const handleStatClick = (key: StatKey) => {
    if (key === 'guardian') {
      setGuardianOpen(true);
      return;
    }
    setActiveStat((prev) => (prev === key ? null : key));
  };

  // 统计数字：守护者为已注册用户数，其余由列表数据推导
  const stats = {
    total: pets.length,
    neuteredCount: pets.filter((p) => p.is_neutered).length,
    guardianCount: guardianCount,
  };

  const filteredPets = activeStat === 'neutered' ? pets.filter((p) => p.is_neutered) : pets;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl from-primary to-accent p-8 md:p-12 bg-inherit bg-cover bg-center bg-no-repeat bg-[url(https://miaoda-edit-image.cdn.bcebos.com/e9umlcp7qmm9/IMG-eag8pedg0i68.png)]">
        {/* 背景图整体略微提亮 */}
        <div className="absolute inset-0 bg-white/10" />
        {/* 深色蒙层：保证背景图上的文字清晰可读（移动端均匀蒙层，桌面端左深右浅渐变） */}
        <div className="absolute inset-0 bg-foreground/70 md:hidden" />
        <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-foreground/85 via-foreground/65 to-foreground/30" />
        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -right-4 bottom-0 w-32 h-32 rounded-full bg-white/10" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white rounded-full px-3 py-1 text-sm mb-4">
            <Sparkles className="w-4 h-4" />
            校园公益 · 用心守护
          </div>
          <h1 className="text-3xl md:text-4xl font-rounded font-bold text-white drop-shadow-sm text-balance leading-tight">
            守护校园里的<br className="hidden md:block" />每一个小生命
          </h1>
          <p className="text-white/95 drop-shadow-sm mt-3 text-pretty max-w-prose">
            记录、发现、了解校园流浪猫狗的档案信息。让我们一起用爱与行动，为它们营造更温暖的校园。
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Button
              size="lg"
              variant="secondary"
              className="rounded-2xl h-12 px-6 shadow-sm border border-border/60 hover:bg-secondary/80 font-medium"
              onClick={() => navigate('/publish')}
            >
              <PlusCircle className="w-5 h-5 mr-1.5 text-primary" />
              新建萌宠档案
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="rounded-2xl h-12 px-6 border border-white/50 text-white hover:bg-white/10"
              onClick={() => navigate('/discover')}
            >
              <PawPrint className="w-5 h-5 mr-1.5" />
              发现新朋友
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="rounded-2xl h-12 px-6 border border-white/50 text-white hover:bg-white/10"
              onClick={() => navigate('/ai-health')}
            >
              AI 健康助手
            </Button>
          </div>
        </div>
      </section>
      {/* 数据亮点 —— 可点击筛选 */}
      <section className="grid grid-cols-3 gap-3 md:gap-4">
        {([
          { key: 'total' as StatKey, icon: PawPrint, label: '已建档萌宠', value: stats?.total ?? 0 },
          { key: 'neutered' as StatKey, icon: ShieldCheck, label: '已绝育', value: stats?.neuteredCount ?? 0 },
          { key: 'guardian' as StatKey, icon: Heart, label: '守护者', value: stats?.guardianCount ?? 0 },
        ]).map((item) => {
          const active = activeStat === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleStatClick(item.key)}
              className={`rounded-2xl border p-4 md:p-5 flex flex-col items-center text-center transition-all cursor-pointer ${
                active
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30'
                  : 'bg-card border-border/60 hover:border-primary/50 hover:shadow-sm'
              }`}
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-2 ${active ? 'bg-primary-foreground/20' : 'bg-secondary'}`}>
                <item.icon className={`w-5 h-5 ${active ? 'text-primary-foreground' : 'text-primary'}`} />
              </div>
              <span className="text-xl md:text-2xl font-rounded font-bold">{item.value}</span>
              <span className={`text-xs mt-0.5 ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{item.label}</span>
            </button>
          );
        })}
      </section>
      {/* 萌宠列表（支持按统计筛选） */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-rounded font-bold text-foreground">
              {activeStat === 'neutered' ? '已绝育萌宠' : activeStat ? '全部萌宠' : '最近发现'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeStat ? `共 ${filteredPets.length} 只符合筛选条件` : '校园里最新被记录的萌宠档案'}
            </p>
          </div>
          {activeStat ? (
            <Button variant="ghost" onClick={() => setActiveStat(null)} className="rounded-xl text-primary hover:bg-secondary shrink-0">
              <X className="w-4 h-4 mr-1" />
              清除筛选
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => navigate('/discover')} className="rounded-xl text-primary hover:bg-secondary shrink-0">
              查看全部
            </Button>
          )}
        </div>
        <PetGrid pets={filteredPets} loading={loading} emptyText={activeStat ? '没有符合条件的萌宠' : '暂无萌宠档案'} />
      </section>

      {/* 守护者列表弹窗 */}
      <GuardiansDialog open={guardianOpen} onOpenChange={setGuardianOpen} />

      {/* 遇见萌友打卡弹窗 */}
      <SightingDialog
        open={sightingOpen}
        onOpenChange={setSightingOpen}
      />
    </div>
  );
}