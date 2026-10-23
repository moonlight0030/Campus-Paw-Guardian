import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { fetchUnreadCount } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import SightingDialog from '@/components/SightingDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  PawPrint, Home, Compass, BarChart3, Bell, Heart, FileText, LogOut, Menu, User, Sparkles, MapPin,
  Utensils, HeartHandshake, Bot, ShieldCheck,
} from 'lucide-react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { favoriteIds } = useFavorites();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sightingOpen, setSightingOpen] = useState(false);

  // 普通用户基础导航：首页、档案大厅、校园地图、投喂记录、领养申请、AI健康助手、个人中心
  const BASE_NAV_ITEMS = [
    { to: '/', label: '首页', icon: Home },
    { to: '/discover', label: '档案大厅', icon: Compass },
    { to: '/activity-map', label: '校园地图', icon: MapPin },
    { to: '/feedings', label: '投喂记录', icon: Utensils },
    { to: '/adoptions', label: '领养申请', icon: HeartHandshake },
    { to: '/ai-health', label: 'AI健康助手', icon: Sparkles },
    { to: '/profile', label: '个人中心', icon: User },
  ];

  // 管理员额外显示管理后台（普通用户绝对不可见）
  const NAV_ITEMS = isAdmin
    ? [...BASE_NAV_ITEMS, { to: '/admin', label: '管理后台', icon: ShieldCheck, isAdminOnly: true }]
    : BASE_NAV_ITEMS;

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    fetchUnreadCount(user.id).then(setUnread).catch(() => setUnread(0));
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-colors ${
      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
    }`;

  const initial = (profile?.nickname || '同').slice(0, 1);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 glass-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          {/* 移动端菜单 */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden shrink-0 rounded-xl">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">导航菜单</SheetTitle>
              <div className="flex items-center gap-2 p-5 border-b border-border/60">
                <div className="w-9 h-9 rounded-2xl bg-primary flex items-center justify-center">
                  <PawPrint className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-rounded font-bold text-foreground">萌宠守护档案</span>
              </div>
              <nav className="flex flex-col gap-1 p-4">
                <Button
                  onClick={() => {
                    setMobileOpen(false);
                    setSightingOpen(true);
                  }}
                  className="w-full justify-start gap-3 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium mb-2 shadow-sm"
                >
                  <Sparkles className="w-5 h-5" />
                  遇见萌友 · 上报打卡
                </Button>
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-colors ${
                        isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                ))}
                <NavLink
                  to="/favorites"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-colors ${
                      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                    }`
                  }
                >
                  <Heart className="w-5 h-5" />
                  我的收藏
                  {favoriteIds.size > 0 && (
                    <Badge className="ml-auto rounded-full bg-primary/20 text-primary border-0">{favoriteIds.size}</Badge>
                  )}
                </NavLink>
                <NavLink
                  to="/notifications"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-colors ${
                      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                    }`
                  }
                >
                  <Bell className="w-5 h-5" />
                  消息通知
                  {unread > 0 && (
                    <Badge className="ml-auto rounded-full bg-destructive text-destructive-foreground border-0">{unread}</Badge>
                  )}
                </NavLink>
                <NavLink
                  to="/ai-health"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-colors ${
                      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                    }`
                  }
                >
                  <PawPrint className="w-5 h-5" />
                  AI 健康助手
                </NavLink>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-2xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
              <PawPrint className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-rounded font-bold text-foreground hidden sm:block">萌宠守护档案</span>
          </Link>

          {/* 桌面导航 */}
          <nav className="hidden md:flex items-center gap-1 ml-2 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `${navLinkClass({ isActive })} ${
                    'isAdminOnly' in item && item.isAdminOnly
                      ? 'border border-primary/30 bg-primary/10 text-primary font-semibold'
                      : ''
                  }`
                }
              >
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {/* 操作区 */}
          <div className="flex items-center gap-2">
            {/* 遇见萌友 顶部显眼打卡按钮 */}
            <Button
              onClick={() => setSightingOpen(true)}
              className="rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm shadow-primary/25 hover:opacity-95 font-medium px-3.5 py-1.5 h-9 text-xs md:text-sm gap-1.5"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>遇见萌友</span>
            </Button>

            {user ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative rounded-xl"
                  onClick={() => navigate('/notifications')}
                >
                  <Bell className="w-5 h-5" />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
                  )}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-xl">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-rounded">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
                    <div className="px-3 py-2">
                      <p className="text-sm font-bold truncate">{profile?.nickname || '同学'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge className={`text-[10px] px-1.5 py-0 border-0 ${
                          isAdmin ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                        }`}>
                          {isAdmin ? '系统管理员' : '普通守护者'}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground truncate">{profile?.email || user.email}</span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate('/admin')} className="rounded-xl cursor-pointer text-primary font-semibold bg-primary/5">
                        <ShieldCheck className="w-4 h-4 mr-2 text-primary" />
                        管理控制台
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate('/profile')} className="rounded-xl cursor-pointer">
                      <User className="w-4 h-4 mr-2" />
                      个人中心
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/favorites')} className="rounded-xl cursor-pointer">
                      <Heart className="w-4 h-4 mr-2" />
                      我的收藏
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/my-posts')} className="rounded-xl cursor-pointer">
                      <FileText className="w-4 h-4 mr-2" />
                      我的发布
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/ai-health')} className="rounded-xl cursor-pointer">
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI 健康助手
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="rounded-xl cursor-pointer text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button onClick={() => navigate('/login')} className="rounded-xl gap-1.5">
                <User className="w-4 h-4" />
                登录
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </main>

      <footer className="border-t border-border/60 py-6">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <PawPrint className="w-4 h-4 text-primary" />
            <span>校园萌宠守护档案</span>
          </div>
          <span>用爱守护，从了解每一个小生命开始</span>
        </div>
      </footer>

      {/* 全局遇见萌友打卡弹窗 */}
      <SightingDialog
        open={sightingOpen}
        onOpenChange={setSightingOpen}
      />
    </div>
  );
}