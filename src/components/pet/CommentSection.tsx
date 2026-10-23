import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchComments, createComment } from '@/services/api';
import type { Comment } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface CommentSectionProps {
  petId: string;
}

export default function CommentSection({ petId }: CommentSectionProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchComments(petId);
      setComments(data);
    } catch (e) {
      console.error('加载评论失败', e);
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!content.trim()) {
      toast.error('请输入评论内容');
      return;
    }
    setSubmitting(true);
    try {
      await createComment(petId, content);
      setContent('');
      toast.success('评论成功');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('评论失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-rounded font-bold text-foreground">评论区</h3>
        <span className="text-sm text-muted-foreground">({comments.length})</span>
      </div>

      {/* 输入框 */}
      <div className="flex gap-3">
        <Avatar className="w-9 h-9 shrink-0">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
            {user ? (profile?.nickname || '同').slice(0, 1) : '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={user ? '留下你对 TA 的祝福或发现吧～' : '登录后即可评论'}
            className="rounded-2xl min-h-[72px] px-3 resize-none"
            onFocus={() => !user && navigate('/login')}
          />
          <div className="flex justify-end mt-2">
            <Button onClick={handleSubmit} disabled={submitting} size="sm" className="rounded-xl gap-1.5">
              <Send className="w-4 h-4" />
              {submitting ? '发送中...' : '发送'}
            </Button>
          </div>
        </div>
      </div>

      {/* 评论列表 */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/4 bg-muted rounded" />
                <div className="h-4 w-full bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">还没有评论，快来抢沙发吧～</p>
      ) : (
        <div className="space-y-5">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarImage src={c.author?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                  {(c.author?.nickname || '同').slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {c.author?.nickname || '匿名同学'}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: zhCN })}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 mt-1 break-words text-pretty">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}