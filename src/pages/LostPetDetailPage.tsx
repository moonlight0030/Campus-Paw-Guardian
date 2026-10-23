import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchLostPetById,
  fetchLostPetClues,
  updateLostPetStatus,
} from '@/services/api';
import type { LostPet, LostPetClue } from '@/types/types';
import LostPetClueDialog from '@/components/lost/LostPetClueDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  User,
  ArrowLeft,
  Eye,
  Share2,
  Calendar,
  Sparkles,
  HeartHandshake,
  ShieldAlert,
  Flame,
  Camera,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function LostPetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [lostPet, setLostPet] = useState<LostPet | null>(null);
  const [clues, setClues] = useState<LostPetClue[]>([]);
  const [loading, setLoading] = useState(true);
  const [clueDialogOpen, setClueDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [detail, clueList] = await Promise.all([
        fetchLostPetById(id),
        fetchLostPetClues(id),
      ]);
      setLostPet(detail);
      setClues(clueList);
    } catch (e) {
      console.error(e);
      toast.error('加载寻宠启事详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkFound = async () => {
    if (!lostPet) return;
    try {
      await updateLostPetStatus(lostPet.id, 'found');
      toast.success('🎉 状态已变更为【已平安找回】！感谢所有提供线索的师生！');
      loadData();
    } catch (e: any) {
      toast.error(e.message || '更新状态失败');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('寻宠启事链接已复制，可分享到校园微信群/空间求助！');
  };

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-16 px-4 text-center text-sm text-muted-foreground">
        加载寻宠启事中...
      </div>
    );
  }

  if (!lostPet) {
    return (
      <div className="container max-w-4xl mx-auto py-16 px-4 text-center space-y-4">
        <p className="text-muted-foreground">抱歉，该寻宠启事不存在或已被撤销</p>
        <Button onClick={() => navigate('/pets')} className="rounded-2xl">
          返回档案大厅
        </Button>
      </div>
    );
  }

  const isSearching = lostPet.status === 'searching';
  const canManage = user && (user.id === lostPet.user_id || isAdmin);
  const mainPhoto =
    lostPet.photo_urls?.[0] ||
    lostPet.pet?.photo_url ||
    'https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* 顶部导航返回与操作 */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/pets')}
          className="rounded-xl gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> 返回档案大厅
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="rounded-xl gap-1.5 text-xs h-8"
          >
            <Share2 className="w-3.5 h-3.5" /> 转发求助
          </Button>

          {canManage && isSearching && (
            <Button
              size="sm"
              onClick={handleMarkFound}
              className="rounded-xl gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> 设为已平安找回
            </Button>
          )}
        </div>
      </div>

      {/* 状态警示横幅 */}
      <div
        className={`rounded-3xl p-4 md:p-5 border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm ${
          isSearching
            ? 'bg-destructive/10 border-destructive/40 text-destructive'
            : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white ${
              isSearching ? 'bg-destructive' : 'bg-emerald-600'
            }`}
          >
            {isSearching ? <Flame className="w-5 h-5 animate-pulse" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="font-bold text-base md:text-lg">
              {isSearching ? '🚨 寻宠紧急搜寻中 · 呼叫全校线索接力' : '🎉 该萌宠已平安找回！感谢全校师生！'}
            </h2>
            <p className="text-xs opacity-90">
              {isSearching
                ? '若在校内目击到类似特征动物，请点击下方「提供目击线索」打卡记录地点与照片！'
                : '启事已圆满关闭，保留历史线索用于校园关爱记录。'}
            </p>
          </div>
        </div>

        {isSearching && (
          <Button
            onClick={() => {
              if (!user) {
                toast.error('请先登录后再提供目击线索');
                return;
              }
              setClueDialogOpen(true);
            }}
            className="rounded-2xl bg-destructive hover:bg-destructive/90 text-white gap-1.5 shrink-0 text-xs h-9 px-4"
          >
            <Eye className="w-4 h-4" /> 我来提供目击线索
          </Button>
        )}
      </div>

      {/* 主信息区 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 左侧照片与关键属性 */}
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-3xl overflow-hidden border border-border/60 bg-card shadow-sm aspect-square">
            <img src={mainPhoto} alt={lostPet.pet_name} className="w-full h-full object-cover" />
          </div>

          {/* 更多照片 */}
          {lostPet.photo_urls && lostPet.photo_urls.length > 1 && (
            <div className="grid grid-cols-3 gap-2">
              {lostPet.photo_urls.slice(1).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="rounded-xl overflow-hidden border aspect-square">
                  <img src={url} alt={`照片${i + 2}`} className="w-full h-full object-cover hover:opacity-90" />
                </a>
              ))}
            </div>
          )}

          {/* 关联萌宠档案 */}
          {lostPet.pet && (
            <div className="bg-primary/5 border border-primary/20 p-3.5 rounded-2xl space-y-2">
              <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> 已关联在校档案
              </span>
              <div className="flex items-center gap-2.5">
                <img
                  src={lostPet.pet.photo_url}
                  alt={lostPet.pet.name}
                  className="w-10 h-10 rounded-xl object-cover border"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-foreground truncate">{lostPet.pet.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{lostPet.pet.location_name}</p>
                </div>
                <Link
                  to={`/pets/${lostPet.pet.id}`}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  查看档案
                </Link>
              </div>
            </div>
          )}

          {/* 悬赏信息 */}
          {lostPet.reward_amount && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl text-xs space-y-1">
              <span className="font-bold text-amber-700 dark:text-amber-400">爱心悬赏 / 酬谢说明：</span>
              <p className="text-foreground font-medium">{lostPet.reward_amount}</p>
            </div>
          )}
        </div>

        {/* 右侧详细资料与线索时间轴 */}
        <div className="md:col-span-2 space-y-6">
          <Card className="rounded-3xl border border-border/60 shadow-sm p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-rounded font-bold text-xl md:text-2xl text-foreground">
                  {lostPet.title}
                </h1>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <span>发布于 {format(new Date(lostPet.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                <span>•</span>
                <span>{lostPet.views_count} 次浏览关注</span>
              </p>
            </div>

            {/* 四格关键信息 */}
            <div className="grid grid-cols-2 gap-3 bg-secondary/30 p-3.5 rounded-2xl text-xs">
              <div>
                <span className="text-muted-foreground">萌宠名称：</span>
                <span className="font-semibold text-foreground ml-1">{lostPet.pet_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">物种分类：</span>
                <span className="font-semibold text-foreground ml-1">
                  {lostPet.species === 'dog' ? '狗狗' : lostPet.species === 'cat' ? '猫咪' : '其他'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">毛色特征：</span>
                <span className="font-semibold text-foreground ml-1">{lostPet.color || '暂无说明'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">最后失联：</span>
                <span className="font-semibold text-foreground ml-1">
                  {format(new Date(lostPet.lost_date), 'MM-dd HH:mm', { locale: zhCN })}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                最后走失/目击地点：
              </span>
              <p className="text-foreground bg-secondary/20 p-2.5 rounded-xl font-medium">
                {lostPet.lost_location}
              </p>
            </div>

            {lostPet.features && (
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-foreground">外貌与性格特征：</span>
                <p className="text-muted-foreground leading-relaxed bg-secondary/20 p-2.5 rounded-xl">
                  {lostPet.features}
                </p>
              </div>
            )}

            {lostPet.description && (
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-foreground">详细情况说明：</span>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap bg-secondary/20 p-2.5 rounded-xl">
                  {lostPet.description}
                </p>
              </div>
            )}

            {/* 紧急联系方式卡 */}
            <div className="bg-primary/10 border border-primary/30 p-4 rounded-2xl flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs text-primary font-semibold flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> 紧急联系人与电话
                </span>
                <p className="font-bold text-base text-foreground">
                  {lostPet.contact_name} · {lostPet.contact_phone}
                </p>
              </div>

              <a
                href={`tel:${lostPet.contact_phone}`}
                className="rounded-xl px-3 py-1.5 bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 shrink-0"
              >
                一键拨打
              </a>
            </div>
          </Card>

          {/* 实时目击线索打卡时间轴 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-rounded font-bold text-base text-foreground flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                目击线索接力记录 ({clues.length} 条线索)
              </h3>

              {isSearching && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (!user) {
                      toast.error('请先登录后再提供目击线索');
                      return;
                    }
                    setClueDialogOpen(true);
                  }}
                  className="rounded-xl text-xs h-8 bg-primary text-primary-foreground gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> 我要打卡提供线索
                </Button>
              )}
            </div>

            {clues.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-3xl border border-border/60 text-xs text-muted-foreground space-y-2">
                <p>暂无师生打卡提供线索</p>
                {isSearching && (
                  <p className="text-primary font-medium">如果你见过这只小动物，请成为第一个线索打卡人！</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {clues.map((clue, idx) => (
                  <div
                    key={clue.id}
                    className="rounded-2xl border border-border/60 bg-card p-4 space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px]">
                          #{clues.length - idx}
                        </span>
                        <span className="font-semibold text-foreground">
                          {clue.user?.nickname || '热心同学'}
                        </span>
                        <span className="text-muted-foreground">
                          {format(new Date(clue.sighting_time), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                        </span>
                      </div>

                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                        线索已核实
                      </Badge>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1 text-primary font-medium">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>目击地点：{clue.sighting_location}</span>
                      </div>
                      <p className="text-muted-foreground bg-secondary/30 p-2.5 rounded-xl leading-relaxed">
                        {clue.description}
                      </p>
                    </div>

                    {clue.photo_url && (
                      <div className="pt-1 flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Camera className="w-3 h-3" /> 现场照片：
                        </span>
                        <a href={clue.photo_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={clue.photo_url}
                            alt="目击现场"
                            className="w-16 h-16 rounded-xl object-cover border hover:opacity-90"
                          />
                        </a>
                      </div>
                    )}

                    {clue.contact_info && (
                      <p className="text-[11px] text-muted-foreground">
                        联系方式：{clue.contact_info}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 线索打卡弹窗 */}
      <LostPetClueDialog
        open={clueDialogOpen}
        onOpenChange={setClueDialogOpen}
        lostPet={lostPet}
        onSuccess={loadData}
      />
    </div>
  );
}
