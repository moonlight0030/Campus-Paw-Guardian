import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchFavoriteIds, addFavorite, removeFavorite } from '@/services/api';

interface FavoritesContextType {
  favoriteIds: Set<string>;
  loading: boolean;
  isFav: (petId: string) => boolean;
  toggle: (petId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setFavoriteIds(new Set());
      setLoading(false);
      return;
    }
    try {
      const ids = await fetchFavoriteIds(user.id);
      setFavoriteIds(ids);
    } catch (e) {
      console.error('加载收藏失败', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const isFav = useCallback((petId: string) => favoriteIds.has(petId), [favoriteIds]);

  const toggle = useCallback(
    async (petId: string) => {
      if (!user) return;
      const has = favoriteIds.has(petId);
      // 乐观更新
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (has) next.delete(petId);
        else next.add(petId);
        return next;
      });
      try {
        if (has) await removeFavorite(petId);
        else await addFavorite(petId);
      } catch (e) {
        // 回滚
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (has) next.add(petId);
          else next.delete(petId);
          return next;
        });
        console.error('收藏操作失败', e);
      }
    },
    [user, favoriteIds],
  );

  return (
    <FavoritesContext.Provider value={{ favoriteIds, loading, isFav, toggle, refresh }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}