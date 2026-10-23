import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchLostPets, updateLostPetStatus } from '@/services/api';
import type { LostPet } from '@/types/types';
import PublishLostPetDialog from './PublishLostPetDialog';
import LostPetClueDialog from './LostPetClueDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Plus,
  Search,
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  Eye,
  Filter,
  Sparkles,
  Share2,
  ArrowRight,
  Heart,
  HelpCircle,
  Flame,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface LostPetsSectionProps {
  onPetClick?: (petId: string) => void;
}

export default function LostPetsSection({ onPetClick }: LostPetsSectionProps) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [lostPets, setLostPets] = useState<LostPet[]>([]);
  const [loading, setLoading] = useState(true);

  // 筛选与搜索
  const [statusFilter, setStatusFilter] = useState<'all' | 'searching' | 'found'>('searching');
  const [speciesFilter, setSpeciesFilter] = useState<'all' | 'cat' | 'dog'>('all');
  const [searchKw, setSearchKw] = useState('');

  // 弹窗状态
  const [publishOpen, setPublishOpen] = useState(false);
  const [clueDialogOpen, setClueDialogOpen] = useState(false);
  const [activeLostPetForClue, setActiveLostPetForClue] = useState<LostPet | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLostPets({
        status: statusFilter,
        species: speciesFilter,
        search: searchKw,
      });
      setLostPets(data);
    } catch (e) {
      console.error(e);
      toast.error('加载走失求助列表失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, speciesFilter, searchKw]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 打开线索打卡弹窗
  const handleOpenClue = (item: LostPet) => {
    if (!user) {
      toast.error('请先登录后再提供目击线索');
      return;
    }
    setActiveLostPetForClue(item);
    setClueDialogOpen(true);
  };

  // 标为已找回
  const handleMarkFound = async (item: LostPet) => {
    try {
      await updateLostPetStatus(item.id, 'found');
      toast.success(`🎉 太棒了！已将「${item.pet_name}」更新为【已成功找回】状态！`);
      loadData();
    } catch (e: any) {
      toast.error(e.message || '更新状态失败');
    }
  };

  const searchingCount = lostPets.filter((p) => p.status === 'searching').length;

  return (
    <div className="space-y-6">
      {/* 顶部醒目紧急寻宠横幅 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-destructive/15 via-primary/10 to-amber-500/10 border border-destructive/30 p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="animate-pulse gap-1 text-xs">
                <AlertCircle className="w-3.5 h-3.5" /> 校园紧急寻宠通道
              </Badge>
              <span className="text-xs font-semibold text-destructive">
                当前有 {searchingCount} 只校宠正在紧急搜寻中
              </span>
            </div>
            <h3 className="font-rounded font-bold text-lg md:text-xl text-foreground">
              走失求助与寻宠线索接力 🐾
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              校园萌宠走失或疑似迷路？发帖求助全校师生！如果你在校园偶遇疑似走失萌宠，请随手拍照打卡提供线索，助力小可爱平安回家。
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
            <Button
              onClick={() => setPublishOpen(true)}
              className="rounded-2xl bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5 shadow-md flex-1 md:flex-none text-xs md:text-sm h-10 px-5"
            >
              <Plus className="w-4 h-4" />
              发布寻宠启事
            </Button>
          </div>
        </div>
      </div>

      {/* 筛选与搜索工具条 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/60 shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> 状态:
          </span>
          <Button
            size="sm"
            variant={statusFilter === 'searching' ? 'default' : 'ghost'}
            onClick={() => setStatusFilter('searching')}
            className="rounded-xl text-xs h-7 gap-1"
          >
            <Flame className="w-3 h-3 text-destructive" /> 紧急寻找中
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'found' ? 'default' : 'ghost'}
            onClick={() => setStatusFilter('found')}
            className="rounded-xl text-xs h-7 gap-1"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 已找回
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'all' ? 'default' : 'ghost'}
            onClick={() => setStatusFilter('all')}
            className="rounded-xl text-xs h-7"
          >
            全部启事
          </Button>

          <span className="text-xs text-muted-foreground mx-1">|</span>

          <Button
            size="sm"
            variant={speciesFilter === 'all' ? 'secondary' : 'ghost'}
            onClick={() => setSpeciesFilter('all')}
            className="rounded-xl text-xs h-7"
          >
            全部物种
          </Button>
          <Button
            size="sm"
            variant={speciesFilter === 'cat' ? 'secondary' : 'ghost'}
            onClick={() => setSpeciesFilter('cat')}
            className="rounded-xl text-xs h-7"
          >
            猫咪
          </Button>
          <Button
            size="sm"
            variant={speciesFilter === 'dog' ? 'secondary' : 'ghost'}
            onClick={() => setSpeciesFilter('dog')}
            className="rounded-xl text-xs h-7"
          >
            狗狗
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchKw}
            onChange={(e) => setSearchKw(e.target.value)}
            placeholder="搜萌宠名、走失地点、特征"
            className="rounded-xl pl-8 h-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* 启事卡片列表 */}
      {loading ? (
        <div className="text-center py-16 text-sm text-muted-foreground">加载寻宠启事中...</div>
      ) : lostPets.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-3xl border border-border/60 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto text-xl">
            🐾
          </div>
          <p className="text-sm text-muted-foreground">当前暂无匹配的寻宠启事，愿校园萌宠安康无虞</p>
          <Button
            size="sm"
            onClick={() => setPublishOpen(true)}
            className="rounded-xl text-xs bg-primary text-primary-foreground gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> 发起走失求助
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lostPets.map((item) => {
            const isSearching = item.status === 'searching';
            const canManage = user && (user.id === item.user_id || isAdmin);
            const mainPhoto =
              item.photo_urls?.[0] ||
              item.pet?.photo_url ||
              'https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=600&q=80';

            return (
              <div
                key={item.id}
                className={`rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col bg-card hover:shadow-md ${
                  isSearching ? 'border-destructive/40' : 'border-border/60 opacity-80'
                }`}
              >
                {/* 顶部图片与状态徽章 */}
                <div className="relative aspect-[16/10] w-full bg-secondary/30 overflow-hidden group">
                  <img
                    src={mainPhoto}
                    alt={item.pet_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                    {isSearching ? (
                      <Badge variant="destructive" className="shadow-md gap-1 text-[11px] font-semibold">
                        <Flame className="w-3 h-3" /> 紧急寻找中
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-600 text-white shadow-md gap-1 text-[11px]">
                        <CheckCircle2 className="w-3 h-3" /> 已平安找回
                      </Badge>
                    )}
                    <Badge variant="secondary" className="backdrop-blur-md bg-black/40 text-white text-[11px]">
                      {item.species === 'dog' ? '校犬' : item.species === 'cat' ? '校猫' : '萌宠'}
                    </Badge>
                  </div>

                  {item.reward_amount && (
                    <div className="absolute bottom-3 left-3 bg-amber-500/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-md">
                      悬赏：{item.reward_amount}
                    </div>
                  )}

                  <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-lg backdrop-blur-sm">
                    {item.views_count} 次关注
                  </div>
                </div>

                {/* 卡片主体 */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-base text-foreground line-clamp-1">{item.title}</h4>
                    </div>

                    <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-foreground font-medium truncate">
                          走失地点：{item.lost_location}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>走失时间：{format(new Date(item.lost_date), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                      </div>
                      {item.features && (
                        <p className="line-clamp-2 bg-secondary/40 p-2 rounded-xl text-[11px] text-foreground/80 mt-1">
                          <strong>特征：</strong>{item.features}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 底部行动条 */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Phone className="w-3 h-3 text-primary" />
                      <span>{item.contact_phone}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isSearching && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenClue(item)}
                          className="rounded-xl text-xs h-7 px-2.5 bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          线索打卡
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/lost-pets/${item.id}`)}
                        className="rounded-xl text-xs h-7 px-2.5 gap-0.5"
                      >
                        详情
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* 管理员/发布者快捷标记 */}
                  {canManage && isSearching && (
                    <div className="pt-1 flex items-center justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkFound(item)}
                        className="h-6 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 px-2 rounded-lg"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        标记为已平安找回
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 弹窗部分 */}
      <PublishLostPetDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onSuccess={loadData}
      />

      {activeLostPetForClue && (
        <LostPetClueDialog
          open={clueDialogOpen}
          onOpenChange={setClueDialogOpen}
          lostPet={activeLostPetForClue}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
