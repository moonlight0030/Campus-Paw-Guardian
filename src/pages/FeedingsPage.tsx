import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllFeedings, fetchPets, createFeeding } from '@/services/api';
import type { Pet } from '@/types/types';
import { checkForbiddenFood } from '@/lib/feedingAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Utensils, Sparkles, Clock, AlertCircle, Heart, Plus, Search, Ban, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function FeedingsPage() {
  const { user } = useAuth();
  const [feedings, setFeedings] = useState<any[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 表单状态
  const [selectedPetId, setSelectedPetId] = useState('');
  const [foodType, setFoodType] = useState('天然猫粮/狗粮');
  const [customFood, setCustomFood] = useState('');
  const [amountGrams, setAmountGrams] = useState(40);

  const loadData = async () => {
    setLoading(true);
    try {
      const [feedList, petsRes] = await Promise.all([
        fetchAllFeedings(),
        fetchPets({ page: 0, pageSize: 200 }),
      ]);
      setFeedings(feedList);
      setPets(petsRes.items);
      if (petsRes.items.length > 0 && !selectedPetId) {
        setSelectedPetId(petsRes.items[0].id);
      }
    } catch (e) {
      console.error(e);
      toast.error('加载投喂记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddFeeding = async () => {
    if (!user) {
      toast.error('请先登录后再打卡投喂');
      return;
    }
    if (!selectedPetId) {
      toast.error('请选择被投喂的萌宠');
      return;
    }
    const finalFood = customFood.trim() || foodType;
    const targetPet = pets.find((p) => p.id === selectedPetId);

    // 禁忌食物安全校验
    const checkRes = checkForbiddenFood(finalFood, targetPet?.species || 'cat');
    if (checkRes.isForbidden) {
      const hazard = checkRes.matchedItems[0];
      toast.error(`⚠️【禁忌拦截】${hazard?.name || '食物'}对动物具有致命毒性，禁止投喂！`);
      return;
    }

    setSubmitting(true);
    try {
      await createFeeding({
        petId: selectedPetId,
        food: finalFood,
        amountGrams: Number(amountGrams) || 40,
        foodType: 'dry_food',
      });
      toast.success('投喂打卡成功！感谢你的爱心关怀～');
      setDialogOpen(false);
      setCustomFood('');
      loadData();
    } catch (e: any) {
      toast.error(e.message || '打卡失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFeedings = feedings.filter((f) => {
    if (!search.trim()) return true;
    const kw = search.trim().toLowerCase();
    return (
      (f.pet?.name && f.pet.name.toLowerCase().includes(kw)) ||
      (f.food && f.food.toLowerCase().includes(kw))
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
              <Utensils className="h-5 w-5" />
            </span>
            <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground">校园投喂记录</h1>
            <Badge className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 px-2.5 py-0.5 text-xs">
              科学守护
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            透明化投喂流水，避免重复投喂与食物变质，共同守护毛孩子肠胃健康
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setDialogOpen(true)}
            className="rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium shadow-md shadow-primary/25 hover:opacity-95 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            记录一次投喂
          </Button>
        </div>
      </div>

      {/* 科学投喂倡议横幅 */}
      <div className="rounded-3xl border border-amber-200/80 bg-amber-50/50 p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center gap-3.5">
        <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800 shrink-0">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="flex-1 text-xs md:text-sm text-amber-900/90 space-y-1">
          <p className="font-semibold text-amber-900">倡导科学健康投喂原则：</p>
          <p>1. 请尽量投放干粮，避免湿粮在烈日下暴晒变质；2. 投喂前查看该萌宠近期记录，2小时内已有同学投喂则无需重复喂食；3. 务必随手清理吃完的包装袋与残渣。</p>
        </div>
      </div>

      {/* 搜索与记录列表 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索萌宠名字或食物类型"
              className="rounded-2xl pl-9 bg-card"
            />
          </div>
          <span className="text-xs text-muted-foreground">共 {filteredFeedings.length} 条投喂流水</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">加载投喂记录中...</div>
        ) : filteredFeedings.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-3xl border border-border/60">
            <Utensils className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-foreground">暂无相关投喂记录</p>
            <p className="text-xs text-muted-foreground mt-1">快去给校园里遇到的小可爱记录一次暖心投喂吧～</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFeedings.map((item) => {
              const fedTime = item.fed_at ? new Date(item.fed_at) : new Date(item.created_at);
              return (
                <Card key={item.id} className="rounded-3xl border border-border/60 shadow-sm bg-card hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 flex items-center gap-3.5">
                    <img
                      src={item.pet?.photo_url || ''}
                      alt={item.pet?.name || '萌宠'}
                      className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-border/50"
                      onError={(ev) => {
                        (ev.currentTarget as HTMLImageElement).src =
                          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23FFE8D6"/%3E%3C/svg%3E';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-foreground text-sm truncate">
                          {item.pet?.name || '未知萌宠'}
                        </h4>
                        <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0 border-primary/30 text-primary">
                          {item.pet?.species === 'dog' ? '校犬' : '校猫'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <p className="text-xs text-primary font-medium truncate flex items-center gap-1">
                          <Utensils className="w-3 h-3 shrink-0" />
                          {item.food || '美味口粮'}
                        </p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {item.amount_grams ?? 40}g
                        </Badge>
                        {item.is_forbidden && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                            禁忌异常
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        {format(fedTime, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 记录投喂弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-rounded font-bold text-lg flex items-center gap-2">
              <Utensils className="w-5 h-5 text-primary" />
              记录一次投喂
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              请填写被投喂萌宠与食物克数，系统将严格校验猫狗禁忌清单
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">选择被投喂的萌宠</label>
              <Select value={selectedPetId} onValueChange={setSelectedPetId}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="请选择萌宠" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-2xl">
                  {pets.map((pet) => (
                    <SelectItem key={pet.id} value={pet.id} className="rounded-xl">
                      {pet.name}（{pet.location_name}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">食物类型</label>
              <Select value={foodType} onValueChange={setFoodType}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="天然猫粮/狗粮">天然猫粮/狗粮</SelectItem>
                  <SelectItem value="主食肉泥/罐头">主食肉泥/罐头</SelectItem>
                  <SelectItem value="冻干零食">冻干零食</SelectItem>
                  <SelectItem value="清洁饮用水">清洁饮用水</SelectItem>
                  <SelectItem value="其他爱心口粮">其他爱心口粮</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-foreground">投喂重量 (克 / g)</label>
                <span className="font-bold text-primary">{amountGrams} g</span>
              </div>
              <Input
                type="number"
                min={5}
                max={300}
                value={amountGrams}
                onChange={(e) => setAmountGrams(Number(e.target.value) || 0)}
                className="rounded-2xl"
              />
            </div>

            {foodType === '其他爱心口粮' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">自定义食物说明</label>
                <Input
                  value={customFood}
                  onChange={(e) => setCustomFood(e.target.value)}
                  placeholder="如：煮熟鸡胸肉无盐（禁投巧克力、洋葱等）"
                  className="rounded-2xl"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-2xl">
              取消
            </Button>
            <Button onClick={handleAddFeeding} disabled={submitting} className="rounded-2xl">
              {submitting ? '提交中...' : '确认记录'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
