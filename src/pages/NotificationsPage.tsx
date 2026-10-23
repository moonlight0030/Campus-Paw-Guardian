import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, submitReport } from '@/services/api';
import type { AppNotification } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  MessageCircle,
  Heart,
  CheckCheck,
  Bell,
  Home,
  ShieldCheck,
  Camera,
  AlertCircle,
  PhoneCall,
  Copy,
  MessageSquarePlus,
  Send,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'adoption' | 'audit' | 'interaction'>('all');

  // 与管理员联系 / 留言求助弹窗
  const [contactAdminOpen, setContactAdminOpen] = useState(false);
  const [contactCategory, setContactCategory] = useState<'feeding' | 'sighting' | 'pet' | 'comment'>('feeding');
  const [contactReason, setContactReason] = useState('');
  const [submittingContact, setSubmittingContact] = useState(false);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchNotifications(user.id);
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const handleMarkAll = async () => {
    if (!user) return;
    try {
      await markAllNotificationsRead(user.id);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('已全部标为已读');
    } catch (e) {
      console.error(e);
    }
  };

  const handleClick = async (n: AppNotification) => {
    if (!n.is_read) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      } catch (e) {
        console.error(e);
      }
    }

    if (n.type === 'adoption') {
      navigate('/adoptions');
      return;
    }

    if (n.pet_id && n.pet_id !== '00000000-0000-0000-0000-000000000000') {
      navigate(`/pet/${n.pet_id}`);
    }
  };

  // 提交给管理员的联络留言/求助
  const handleSubmitMessageToAdmin = async () => {
    if (!user) return;
    if (!contactReason.trim()) {
      toast.error('请填写您向管理员反映的详情或求助内容');
      return;
    }
    setSubmittingContact(true);
    try {
      await submitReport({
        target_type: contactCategory,
        target_id: user.id,
        target_title: `来自同学「${user.user_metadata?.nickname || '同学'}」的联络咨询/反馈`,
        reason: contactReason.trim(),
        reporter_id: user.id,
        reporter_name: user.user_metadata?.nickname || '同学',
      });
      toast.success('已向管理员发送您的联络留言，管理员审核处理后将通过消息通知答复您！');
      setContactReason('');
      setContactAdminOpen(false);
    } catch (e: any) {
      toast.error(e.message || '发送失败，请稍后重试');
    } finally {
      setSubmittingContact(false);
    }
  };

  const unreadCount = items.filter((n) => !n.is_read).length;

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return items;
    if (activeTab === 'adoption') return items.filter((n) => n.type === 'adoption');
    if (activeTab === 'audit') return items.filter((n) => n.type === 'sighting' || n.type === 'report');
    return items.filter((n) => n.type === 'comment' || n.type === 'favorite');
  }, [items, activeTab]);

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 顶部标题栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground">消息中心</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-1">
            实时查看领养审核反馈、目击发布状态、互动动态与管理员答复
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => setContactAdminOpen(true)}
            className="rounded-2xl text-xs gap-1.5 bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm"
          >
            <MessageSquarePlus className="w-4 h-4" />
            联系动协管理员
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAll} className="rounded-2xl text-xs gap-1">
              <CheckCheck className="w-3.5 h-3.5" />
              全部已读
            </Button>
          )}
        </div>
      </div>

      {/* 动协管理员联络卡 (实现普通用户与管理员的无缝联系) */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-amber-500/5 to-background p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm shadow-primary/30 mt-0.5 md:mt-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-rounded font-bold text-sm md:text-base text-foreground">
                校园小动物保护协会 · 管理员在线联络处
              </h3>
              <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-[10px] px-2 py-0 rounded-full">
                值班中
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              遇到受伤毛孩子、领养审核咨询、打卡地点纠错或线下交接，均可一键联系动协值班同学。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText('campus_pets_2026');
              toast.success('已复制动协微信号：campus_pets_2026');
            }}
            className="rounded-2xl text-xs h-8 gap-1.5 flex-1 md:flex-initial"
          >
            <Copy className="w-3.5 h-3.5 text-primary" />
            微信: campus_pets_2026
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setContactAdminOpen(true)}
            className="rounded-2xl text-xs h-8 gap-1.5 flex-1 md:flex-initial"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 text-primary" />
            在线留言
          </Button>
        </div>
      </div>

      {/* 分类筛选标签 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <Button
          size="sm"
          variant={activeTab === 'all' ? 'default' : 'secondary'}
          onClick={() => setActiveTab('all')}
          className="rounded-2xl h-8 px-3.5"
        >
          全部通知 ({items.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'adoption' ? 'default' : 'secondary'}
          onClick={() => setActiveTab('adoption')}
          className="rounded-2xl h-8 px-3.5 gap-1.5"
        >
          <Home className="w-3.5 h-3.5" />
          领养审核反馈 ({items.filter((x) => x.type === 'adoption').length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'audit' ? 'default' : 'secondary'}
          onClick={() => setActiveTab('audit')}
          className="rounded-2xl h-8 px-3.5 gap-1.5"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          打卡/举报反馈 ({items.filter((x) => x.type === 'sighting' || x.type === 'report').length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'interaction' ? 'default' : 'secondary'}
          onClick={() => setActiveTab('interaction')}
          className="rounded-2xl h-8 px-3.5 gap-1.5"
        >
          <Heart className="w-3.5 h-3.5" />
          互动动态 ({items.filter((x) => x.type === 'comment' || x.type === 'favorite').length})
        </Button>
      </div>

      {/* 消息列表主体 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-4 rounded-3xl bg-card border border-border/60 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 bg-muted rounded" />
                <div className="h-3 w-1/3 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card rounded-3xl border border-border/60 p-6">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-3">
            <Bell className="w-8 h-8 text-primary/60" />
          </div>
          <p className="text-base font-medium">该分类下暂无消息</p>
          <p className="text-xs text-muted-foreground mt-1">管理员审核领养或社区互动时将第一时间在此提醒您</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((n) => {
            const isAdoption = n.type === 'adoption';
            const isSighting = n.type === 'sighting';
            const isReport = n.type === 'report';

            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-3.5 p-4 rounded-3xl border text-left transition-all cursor-pointer ${
                  n.is_read
                    ? 'bg-card border-border/60 hover:border-primary/40'
                    : 'bg-primary/5 border-primary/30 shadow-sm'
                }`}
              >
                <div className="relative shrink-0 mt-0.5">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={n.actor?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-bold">
                      {isAdoption || isReport ? '动协' : (n.actor?.nickname || '友').slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                    isAdoption ? 'bg-amber-500 text-white' : isSighting ? 'bg-emerald-500 text-white' : isReport ? 'bg-blue-500 text-white' : 'bg-primary text-primary-foreground'
                  }`}>
                    {isAdoption ? (
                      <Home className="w-2.5 h-2.5" />
                    ) : isSighting ? (
                      <Camera className="w-2.5 h-2.5" />
                    ) : isReport ? (
                      <ShieldCheck className="w-2.5 h-2.5" />
                    ) : n.type === 'comment' ? (
                      <MessageCircle className="w-2.5 h-2.5" />
                    ) : (
                      <Heart className="w-2.5 h-2.5 fill-current" />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs md:text-sm text-foreground">
                        {isAdoption || isReport ? '动协管理员' : (n.actor?.nickname || '同学')}
                      </span>
                      {isAdoption && (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] py-0 px-2 rounded-full">
                          领养审核反馈
                        </Badge>
                      )}
                      {isSighting && (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-[10px] py-0 px-2 rounded-full">
                          目击打卡收录
                        </Badge>
                      )}
                      {isReport && (
                        <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/20 text-[10px] py-0 px-2 rounded-full">
                          监督处理
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: zhCN })}
                    </span>
                  </div>

                  <p className="text-xs md:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {n.message}
                  </p>

                  {isAdoption && (
                    <div className="pt-2 flex items-center justify-end">
                      <span className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                        查看我的领养申请进度
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  )}
                </div>

                {!n.is_read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 在线向动协管理员留言/咨询弹窗 */}
      <Dialog open={contactAdminOpen} onOpenChange={setContactAdminOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-rounded font-bold text-lg flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-primary" />
              向动协管理员留言 / 求助
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              填写您的咨询、领养交接安排或救助线索，管理员将在后台及时查验并给您回信。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs md:text-sm">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">咨询与反馈类型：</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Button
                  type="button"
                  size="sm"
                  variant={contactCategory === 'feeding' ? 'default' : 'outline'}
                  onClick={() => setContactCategory('feeding')}
                  className="rounded-xl h-8"
                >
                  🐾 领养咨询与家访预约
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={contactCategory === 'sighting' ? 'default' : 'outline'}
                  onClick={() => setContactCategory('sighting')}
                  className="rounded-xl h-8"
                >
                  🏥 毛孩子救助与医疗
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={contactCategory === 'pet' ? 'default' : 'outline'}
                  onClick={() => setContactCategory('pet')}
                  className="rounded-xl h-8"
                >
                  📝 档案信息更新核实
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={contactCategory === 'comment' ? 'default' : 'outline'}
                  onClick={() => setContactCategory('comment')}
                  className="rounded-xl h-8"
                >
                  💬 违规举报与其它
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">详情描述与您的联络微信/电话：</label>
              <Textarea
                value={contactReason}
                onChange={(e) => setContactReason(e.target.value)}
                rows={4}
                placeholder="例如：您好动协老师，我已通过「橘橘」的领养申请，想预约这周六下午进行家访交流，我微信号是..."
                className="rounded-2xl resize-none text-xs leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={submittingContact}
              onClick={() => setContactAdminOpen(false)}
              className="rounded-2xl"
            >
              取消
            </Button>
            <Button
              disabled={submittingContact}
              onClick={handleSubmitMessageToAdmin}
              className="rounded-2xl gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {submittingContact ? '发送中...' : '提交留言给管理员'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
