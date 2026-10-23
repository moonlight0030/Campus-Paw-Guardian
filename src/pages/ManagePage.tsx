import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPets, deletePet } from '@/services/api';
import type { Pet } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Search, Pencil, Trash2, Cat, Dog, FolderCog, Loader2 } from 'lucide-react';

export default function ManagePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<Pet | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetchPets({ page: 0, pageSize: 500 });
      setPets(res.items);
    } catch (e) {
      console.error(e);
      toast.error('加载档案失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deletePet(deleting.id);
      toast.success(`已删除「${deleting.name}」的档案`);
      setDeleting(null);
      load();
    } catch (e) {
      console.error(e);
      toast.error('删除失败，请重试');
    } finally {
      setDeleteBusy(false);
    }
  };

  const kw = search.trim().toLowerCase();
  const filtered = kw
    ? pets.filter(
        (p) =>
          p.name.toLowerCase().includes(kw) ||
          p.location_name.toLowerCase().includes(kw)
      )
    : pets;

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground flex items-center gap-2">
            <FolderCog className="w-7 h-7 text-primary" />
            萌宠管理
          </h1>
          <p className="text-muted-foreground mt-1">管理全部萌宠档案，共 {pets.length} 条记录</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索昵称或地点"
            className="rounded-xl pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border/60 p-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-3 w-48 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
            <FolderCog className="w-10 h-10 text-primary/60" />
          </div>
          <p className="text-lg font-medium">{pets.length === 0 ? '暂无萌宠档案' : '没有匹配的档案'}</p>
          <p className="text-sm mt-1">{pets.length === 0 ? '去发布第一份萌宠档案吧' : '换个关键词试试'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl bg-card border border-border/60 p-3 md:p-4 flex items-center gap-3 md:gap-4"
            >
              <img
                src={p.photo_url}
                alt={p.name}
                className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover shrink-0 bg-muted"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">{p.name}</span>
                  <Badge className="rounded-full bg-secondary text-secondary-foreground border-0 px-2 py-0.5 gap-1 shrink-0">
                    {p.species === 'cat' ? <Cat className="w-3 h-3" /> : <Dog className="w-3 h-3" />}
                    {p.species === 'cat' ? '猫咪' : '狗狗'}
                  </Badge>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground truncate mt-1">
                  {p.location_name} · 发布者：{p.author?.nickname || '匿名同学'} ·{' '}
                  {new Date(p.discovered_at).toLocaleDateString('zh-CN')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-11 px-3 gap-1"
                  onClick={() => navigate(`/edit/${p.id}`)}
                >
                  <Pencil className="w-4 h-4" />
                  <span className="hidden sm:inline">修改</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-11 px-3 gap-1 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">删除</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 删除确认弹窗 */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该档案？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后「{deleting?.name}」的档案、评论与收藏将一并移除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy} className="rounded-xl">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteBusy}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBusy && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}