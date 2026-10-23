import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyPets, fetchFavorites, fetchSightingsWithPets, updateLostPetBroadcast } from '@/services/api';
import type { Pet, SightingWithPet } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { User, Heart, Sparkles, FileText, ShieldCheck, MapPin, Clock, LogOut, BellRing, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth();
  const [myPets, setMyPets] = useState<Pet[]>([]);
  const [favoritePets, setFavoritePets] = useState<Pet[]>([]);
  const [mySightings, setMySightings] = useState<SightingWithPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [broadcastEnabled, setBroadcastEnabled] = useState(true);
  const [broadcastSaving, setBroadcastSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [postsRes, favRes, sightRes] = await Promise.all([
          fetchMyPets(user.id),
          fetchFavorites(user.id),
          fetchSightingsWithPets(),
        ]);
        setMyPets(postsRes);
        setFavoritePets(favRes);
        setMySightings(sightRes.filter((s: SightingWithPet) => s.user_id === user.id));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, navigate]);

  // 同步后端订阅开关状态
  useEffect(() => {
    if (profile) {
      setBroadcastEnabled(profile.lost_pet_broadcast ?? true);
    }
  }, [profile]);

  const handleBroadcastToggle = async (checked: boolean) => {
    if (!user) return;
    setBroadcastEnabled(checked);
    setBroadcastSaving(true);
    try {
      await updateLostPetBroadcast(user.id, checked);
      await refreshProfile();
      toast.success(checked ? '已开启寻宠广播订阅' : '已关闭寻宠广播订阅');
    } catch {
      setBroadcastEnabled(!checked);
      toast.error('订阅设置保存失败，请重试');
    } finally {
      setBroadcastSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) return null;

  const initial = (profile?.nickname || '同').slice(0, 1);

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* 个人信息卡片 */}
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-amber-50/20 to-background p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <Avatar className="w-20 h-20 rounded-3xl border-2 border-primary/20 shadow-md">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground font-rounded font-bold text-2xl">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <h2 className="text-xl font-rounded font-bold text-foreground">{profile?.nickname || '校园守护者'}</h2>
              <Badge className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isAdmin ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}>
                {isAdmin ? '系统管理员' : '普通守护者'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">账号：{profile?.email || user.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 justify-center sm:justify-start">
              <Clock className="w-3.5 h-3.5 text-primary" />
              注册时间：{profile?.created_at ? format(new Date(profile.created_at), 'yyyy-MM-dd') : '近期'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              onClick={() => navigate('/admin')}
              className="rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium shadow-md shadow-primary/25"
            >
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              进入管理后台
            </Button>
          )}
          <Button variant="outline" onClick={handleLogout} className="rounded-2xl text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4 mr-1.5" />
            退出登录
          </Button>
        </div>
      </div>

      {/* 寻宠广播订阅设置 */}
      <Card className="rounded-3xl border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-start gap-4 p-5 md:p-6">
            <div className="w-11 h-11 rounded-2xl bg-destructive/10 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-rounded font-bold text-foreground">寻宠广播订阅</h3>
                <Badge
                  variant="outline"
                  className={`text-[10px] rounded-full px-2 py-0 ${
                    broadcastEnabled
                      ? 'border-primary/30 text-primary bg-primary/5'
                      : 'border-border text-muted-foreground bg-muted'
                  }`}
                >
                  {broadcastEnabled ? '已订阅' : '未订阅'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 text-pretty">
                开启后，当全校有新的走失寻宠启事发布时，系统会第一时间向你发送站内消息提醒，助力爱心接力尽快找回走失小家伙。
              </p>
            </div>
            <Switch
              checked={broadcastEnabled}
              onCheckedChange={handleBroadcastToggle}
              disabled={broadcastSaving}
              className="shrink-0 mt-1"
            />
          </div>
          {broadcastEnabled && (
            <div className="flex items-center gap-2 px-5 md:px-6 pb-4 -mt-1 text-[11px] text-muted-foreground">
              <BellRing className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>订阅生效中，新启事将通过消息中心推送，请注意查看右上角通知红点</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 聚合数据统计 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-card border border-border/60 p-4 text-center">
          <span className="text-xs text-muted-foreground">已建立档案</span>
          <p className="text-2xl font-bold font-rounded text-foreground mt-1">{myPets.length}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-4 text-center">
          <span className="text-xs text-muted-foreground">遇见打卡</span>
          <p className="text-2xl font-bold font-rounded text-foreground mt-1">{mySightings.length}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-4 text-center">
          <span className="text-xs text-muted-foreground">爱心收藏</span>
          <p className="text-2xl font-bold font-rounded text-foreground mt-1">{favoritePets.length}</p>
        </div>
      </div>

      {/* 分页内容：我的打卡 / 我的发布 / 我的收藏 */}
      <Tabs defaultValue="sightings" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-secondary/50 p-1">
          <TabsTrigger value="sightings" className="rounded-xl font-medium text-xs md:text-sm">
            我的打卡 ({mySightings.length})
          </TabsTrigger>
          <TabsTrigger value="posts" className="rounded-xl font-medium text-xs md:text-sm">
            我建的档案 ({myPets.length})
          </TabsTrigger>
          <TabsTrigger value="favorites" className="rounded-xl font-medium text-xs md:text-sm">
            我的收藏 ({favoritePets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sightings" className="mt-4 space-y-3">
          {mySightings.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-3xl border border-border/60 text-muted-foreground text-sm">
              暂无遇见打卡记录，偶遇毛孩子时记得点击「遇见打卡」上报哦～
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mySightings.map((s) => (
                <div key={s.id} className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3">
                  <img
                    src={s.photo_url || s.pet?.photo_url || ''}
                    alt={s.pet?.name || '萌宠'}
                    className="w-14 h-14 rounded-2xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-foreground truncate">{s.pet?.name || '未知萌宠'}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-primary shrink-0" />
                      {s.location || '校园某处'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {format(new Date(s.sighted_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="posts" className="mt-4 space-y-3">
          {myPets.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-3xl border border-border/60 text-muted-foreground text-sm">
              你还没有创建过萌宠档案～
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myPets.map((pet) => (
                <div
                  key={pet.id}
                  onClick={() => navigate(`/pet/${pet.id}`)}
                  className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors"
                >
                  <img src={pet.photo_url} alt={pet.name} className="w-14 h-14 rounded-2xl object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-foreground">{pet.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{pet.location_name}</p>
                    <Badge variant="outline" className="text-[10px] rounded-md px-1.5 py-0 mt-1 border-primary/30 text-primary">
                      {pet.species === 'cat' ? '猫咪' : '狗狗'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="favorites" className="mt-4 space-y-3">
          {favoritePets.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-3xl border border-border/60 text-muted-foreground text-sm">
              暂无收藏的萌宠，去档案大厅逛逛吧～
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {favoritePets.map((pet) => (
                <div
                  key={pet.id}
                  onClick={() => navigate(`/pet/${pet.id}`)}
                  className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors"
                >
                  <img src={pet.photo_url} alt={pet.name} className="w-14 h-14 rounded-2xl object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-foreground">{pet.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{pet.location_name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
