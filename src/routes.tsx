import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import DiscoverPage from './pages/DiscoverPage';
import PetDetailPage from './pages/PetDetailPage';
import PublishPetPage from './pages/PublishPetPage';
import FavoritesPage from './pages/FavoritesPage';
import MyPostsPage from './pages/MyPostsPage';
import ManagePage from './pages/ManagePage';
import AdminPage from './pages/AdminPage';
import AdminRouteGuard from './components/auth/AdminRouteGuard';
import FeedingsPage from './pages/FeedingsPage';
import AdoptionsPage from './pages/AdoptionsPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import StatsPage from './pages/StatsPage';
import AIHealthPage from './pages/AIHealthPage';
import ChatPage from './pages/ChatPage';
import ActivityMapPage from './pages/ActivityMapPage';
import LoginPage from './pages/LoginPage';
import LostPetDetailPage from './pages/LostPetDetailPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: '首页', path: '/', element: <HomePage />, public: true },
  { name: '档案大厅', path: '/discover', element: <DiscoverPage />, public: true },
  { name: '校园地图', path: '/activity-map', element: <ActivityMapPage />, public: true },
  { name: '投喂记录', path: '/feedings', element: <FeedingsPage />, public: true },
  { name: '领养申请', path: '/adoptions', element: <AdoptionsPage />, public: true },
  { name: 'AI健康助手', path: '/ai-health', element: <AIHealthPage /> },
  { name: 'AI档案讲解员', path: '/ai-chat', element: <ChatPage /> },
  { name: '个人中心', path: '/profile', element: <ProfilePage /> },
  {
    name: '管理后台',
    path: '/admin',
    element: (
      <AdminRouteGuard>
        <AdminPage />
      </AdminRouteGuard>
    ),
  },
  {
    name: '萌宠管理',
    path: '/manage',
    element: (
      <AdminRouteGuard>
        <AdminPage />
      </AdminRouteGuard>
    ),
  },
  { name: '萌宠详情', path: '/pet/:id', element: <PetDetailPage />, public: true },
  { name: '寻宠启事详情', path: '/lost-pets/:id', element: <LostPetDetailPage />, public: true },
  { name: '发布萌宠', path: '/publish', element: <PublishPetPage /> },
  { name: '编辑萌宠', path: '/edit/:id', element: <PublishPetPage /> },
  { name: '我的收藏', path: '/favorites', element: <FavoritesPage /> },
  { name: '我的发布', path: '/my-posts', element: <MyPostsPage /> },
  { name: '消息通知', path: '/notifications', element: <NotificationsPage /> },
  { name: '数据统计', path: '/stats', element: <StatsPage />, public: true },
  { name: '登录', path: '/login', element: <LoginPage />, public: true },
];
