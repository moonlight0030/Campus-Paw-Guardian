import { useEffect, useState, useCallback } from 'react';
import { fetchGuardians, subscribeGuardians } from '@/services/api';
import type { PublicProfile } from '@/types/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users } from 'lucide-react';

/** 在线判定阈值：最近 5 分钟内活跃视为在线 */
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

interface OnlineState {
  online: boolean;
  text: string;
}

const getOnlineState = (lastSeenAt: string | null): OnlineState => {
  if (!lastSeenAt) return { online: false, text: '暂未上线' };
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < ONLINE_THRESHOLD_MS) return { online: true, text: '在线' };
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return { online: false, text: `${mins} 分钟前在线` };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { online: false, text: `${hours} 小时前在线` };
  const days = Math.floor(hours / 24);
  return { online: false, text: `${days} 天前在线` };
};

interface GuardiansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GuardiansDialog({ open, onOpenChange }: GuardiansDialogProps) {
  const [guardians, setGuardians] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const loadList = useCallback(() => {
    fetchGuardians()
      .then(setGuardians)
      .catch((e) => {
        console.error('加载守护者失败', e);
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchGuardians()
      .then(setGuardians)
      .catch((e) => {
        console.error('加载守护者失败', e);
      })
      .finally(() => setLoading(false));

    const unsubscribe = subscribeGuardians(() => {
      loadList();
    }, 'dialog');
    return () => {
      unsubscribe();
    };
  }, [open, loadList]);

  const onlineCount = guardians.filter((g) => getOnlineState(g.last_seen_at).online).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <span>校园守护者</span>
          </DialogTitle>
          <DialogDescription>
            已注册 {guardians.length} 位守护者，当前在线 {onlineCount} 位
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : guardians.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm">还没有守护者加入</p>
            <p className="text-xs mt-1">注册后即可成为校园守护者</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {guardians.map((g) => {
              const state = getOnlineState(g.last_seen_at);
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-2.5"
                >
                  <div className="relative shrink-0">
                    <Avatar className="w-11 h-11">
                      <AvatarImage src={g.avatar_url ?? undefined} alt={g.nickname} />
                      <AvatarFallback className="bg-secondary text-primary font-medium">
                        {g.nickname.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${
                        state.online ? 'bg-primary' : 'bg-muted-foreground/40'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{g.nickname}</p>
                      {g.role === 'admin' && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                          管理员
                        </Badge>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${state.online ? 'text-primary' : 'text-muted-foreground'}`}>
                      {state.text}
                    </p>
                  </div>
                  <Badge
                    variant={state.online ? 'default' : 'outline'}
                    className={`shrink-0 text-xs ${state.online ? '' : 'text-muted-foreground'}`}
                  >
                    {state.online ? '在线' : '离线'}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}