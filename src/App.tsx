import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import MainLayout from '@/components/layouts/MainLayout';
import { routes } from './routes';

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <>
      <IntersectObserver />
      {isLogin ? (
        <Routes>
          {routes.map((route, index) => (
            <Route key={index} path={route.path} element={route.element} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <MainLayout>
          <Routes>
            {routes.map((route, index) => (
              <Route key={index} path={route.path} element={route.element} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MainLayout>
      )}
      <Toaster />
    </>
  );
};

const App: React.FC = () => {
  return (
    <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <FavoritesProvider>
          <AppRoutes />
        </FavoritesProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
