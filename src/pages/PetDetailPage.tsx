import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPetById, deletePet, fetchSightingsByPetId } from '@/services/api';
import type { Pet, Sighting } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import CommentSection from '@/components/pet/CommentSection';
import AdoptionDialog from '@/components/pet/AdoptionDialog';
import FeedingCheckIn from '@/components/pet/FeedingCheckIn';
import DailyFeedingPlanSection from '@/components/pet/DailyFeedingPlanSection';
import PetTrajectoryMap from '@/components/pet/PetTrajectoryMap';
import SightingDialog from '@/components/SightingDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Heart, MapPin, Cat, Dog, CheckCircle2, Pencil, Trash2, ArrowLeft, Calendar, Palette, Sparkles, Clock, User, MessageSquareQuote, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function PetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFav, toggle } = useFavorites();
  const [pet, setPet] = useState<Pet | null>(null);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loadingSightings, setLoadingSightings] = useState(false);
  const [sightingDialogOpen, setSightingDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSightings = useCallback(async (petId: string) => {
    try {
      setLoadingSightings(true);
      const list = await fetchSightingsByPetId(petId);
      setSightings(list);
    } catch (e) {
      console.error('加载目击记录失败', e);
    } finally {
      setLoadingSightings(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchPetById(id);
      setPet(data);
      if (data) {
        loadSightings(data.id);
      }
    } catch (e) {
      console.error('加载详情失败', e);
    } finally {
      setLoading(false);
    }
  }, [id, loadSightings]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFav = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (pet) await toggle(pet.id);
  };

  const handleDelete = async () => {
    if (!pet) return;
    try {
      await deletePet(pet.id);
      toast.success('档案已删除');
      navigate('/');
    } catch (e) {
      console.error(e);
      toast.error('删除失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="w-full aspect-[4/3] md:aspect-[16/9] bg-muted rounded-3xl" />
        <div className="h-8 w-1/3 bg-muted rounded" />
        <div className="h-4 w-2/3 bg-muted rounded" />
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-lg">未找到该萌宠档案</p>
        <Button variant="ghost" onClick={() => navigate('/')} className="mt-4 rounded-xl text-primary">
          返回首页
        </Button>
      </div>
    );
  }

  const isOwner = user?.id === pet.author_id;
  const fav = isFav(pet.id);

  const infoItems = [
    { icon: pet.species === 'cat' ? Cat : Dog, label: '物种', value: pet.species === 'cat' ? '猫咪' : '狗狗' },
    { icon: Sparkles, label: '性别', value: pet.gender === 'male' ? '公' : '母' },
    { icon: Palette, label: '毛色', value: pet.coat_color },
    { icon: Calendar, label: '发现时间', value: format(new Date(pet.discovered_at), 'yyyy年M月d日', { locale: zhCN }) },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl text-muted-foreground hover:text-foreground -ml-2">
        <ArrowLeft className="w-4 h-4 mr-1" />
        返回
      </Button>

      {/* 大图 */}
      <div className="relative w-full overflow-hidden rounded-3xl bg-muted">
        <img
          src={pet.photo_url}
          alt={pet.name}
          className="w-full object-contain max-h-[260px] md:max-h-[420px]"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"%3E%3Crect width="800" height="500" fill="%23FFF7ED"/%3E%3C/svg%3E';
          }}
        />
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <Badge className="rounded-full bg-primary/90 text-primary-foreground border-0 px-3 py-1 gap-1">
            {pet.species === 'cat' ? <Cat className="w-3.5 h-3.5" /> : <Dog className="w-3.5 h-3.5" />}
            {pet.species === 'cat' ? '猫咪' : '狗狗'}
          </Badge>
          {pet.is_neutered && (
            <Badge className="rounded-full bg-success/90 text-success-foreground border-0 px-3 py-1 gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              已绝育
            </Badge>
          )}
        </div>
      </div>

      {/* 标题与操作 */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground text-balance">{pet.name}</h1>
          <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{pet.location_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && (
            <>
              <Button variant="outline" size="icon" className="rounded-xl" onClick={() => navigate(`/edit/${pet.id}`)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-xl text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg rounded-3xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认删除该档案？</AlertDialogTitle>
                    <AlertDialogDescription>
                      删除后「{pet.name}」的档案、评论与收藏将一并移除，此操作不可撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      确认删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          <Button onClick={handleFav} variant={fav ? 'default' : 'outline'} className="rounded-xl gap-1.5">
            <Heart className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} />
            {fav ? '已收藏' : '收藏'}
          </Button>
        </div>
      </div>

      {/* 性格标签 */}
      {pet.personality_tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pet.personality_tags.map((tag) => (
            <span key={tag} className="inline-flex items-center text-sm px-3 py-1 rounded-full bg-secondary text-secondary-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 基本信息卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {infoItems.map((item) => (
          <div key={item.label} className="rounded-2xl bg-card border border-border/60 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
              <item.icon className="w-4 h-4 text-primary" />
              {item.label}
            </div>
            <p className="text-foreground font-medium truncate">{item.value}</p>
          </div>
        ))}
      </div>

      {/* 发布者 */}
      <div className="flex items-center gap-3 rounded-2xl bg-card border border-border/60 p-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{pet.author?.nickname || '匿名同学'}</p>
          <p className="text-xs text-muted-foreground">档案发布者</p>
        </div>
      </div>

      {/* 活动轨迹小地图（将所有目击点按时间先后顺序连成线） */}
      <PetTrajectoryMap
        petName={pet.name}
        defaultLocation={pet.location_name}
        sightings={sightings}
        onAddSightingClick={() => setSightingDialogOpen(true)}
      />

      {/* 遇见足迹 · 目击记录 */}
      <div className="rounded-3xl bg-card border border-border/60 p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-rounded font-bold text-lg text-foreground">遇见足迹 · 目击记录</h3>
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-normal">
                  {sightings.length} 次目击
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">记录 TA 最近在校园里出现的地点与状态</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setSightingDialogOpen(true)}
            className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shrink-0 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            我也遇见了 · 打卡
          </Button>
        </div>

        {loadingSightings ? (
          <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
            正在加载目击记录...
          </div>
        ) : sightings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
            <MapPin className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium text-foreground">暂无目击打卡记录</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              小家伙可能刚刚溜达去新地方啦，如果你在校园里见到了 TA，快来为 TA 记录第一条足迹吧～
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSightingDialogOpen(true)}
              className="mt-4 rounded-xl border-primary/40 text-primary hover:bg-primary/10"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              立即打卡记录
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sightings.map((sighting) => {
              let displayTime = sighting.sighted_at;
              try {
                displayTime = format(new Date(sighting.sighted_at), 'yyyy年M月d日 HH:mm', { locale: zhCN });
              } catch {
                displayTime = sighting.sighted_at;
              }

              return (
                <div
                  key={sighting.id}
                  className="rounded-2xl border border-border/60 bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        <MapPin className="h-3 w-3" />
                        {sighting.location}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {displayTime}
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3 text-primary/70" />
                      <span>记录人：{sighting.recorder_name || '热心同学'}</span>
                    </div>
                  </div>

                  {sighting.notes && (
                    <div className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-background/80 p-2.5 text-xs text-foreground/90 border border-border/40">
                      <MessageSquareQuote className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{sighting.notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 每日投喂计划模块（AI建议 + 管理员确认 + 实时进度） */}
      <DailyFeedingPlanSection pet={pet} />

      {/* 每日投喂打卡 */}
      <div className="rounded-3xl bg-card border border-border/60 p-5 md:p-6">
        <FeedingCheckIn pet={pet} />
      </div>

      {/* 评论 */}
      <div className="rounded-3xl bg-card border border-border/60 p-5 md:p-6">
        <CommentSection petId={pet.id} />
      </div>

      {/* 申请领养 CTA */}
      <div className="rounded-3xl bg-gradient-to-r from-primary/10 to-accent/15 border border-primary/20 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left">
          <h3 className="text-lg font-rounded font-bold text-foreground">想给 TA 一个温暖的家？</h3>
          <p className="text-sm text-muted-foreground mt-1">
            提交领养意向表单，档案发布者会第一时间收到通知并与你联系
          </p>
        </div>
        <AdoptionDialog pet={pet} />
      </div>

      {/* 遇见萌友打卡弹窗（详情页触发，预选当前宠物） */}
      <SightingDialog
        open={sightingDialogOpen}
        onOpenChange={setSightingDialogOpen}
        defaultPetId={pet.id}
        onSuccess={() => loadSightings(pet.id)}
      />
    </div>
  );
}