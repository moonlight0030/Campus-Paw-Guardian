import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFavorites } from '@/services/api';
import type { Pet } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import PetGrid from '@/components/pet/PetGrid';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';

export default function FavoritesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favoriteIds } = useFavorites();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchFavorites(user.id);
      setPets(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load, favoriteIds.size]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground">我的收藏</h1>
        <p className="text-muted-foreground mt-1">你关注的萌宠档案，共 {pets.length} 只</p>
      </div>

      {pets.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Heart className="w-10 h-10 text-primary/60" />
          </div>
          <p className="text-lg font-medium">还没有收藏任何萌宠</p>
          <p className="text-sm mt-1">去发现页面看看可爱的小家伙们吧</p>
          <Button onClick={() => navigate('/discover')} className="mt-5 rounded-xl">
            去发现
          </Button>
        </div>
      ) : (
        <PetGrid pets={pets} loading={loading} emptyText="暂无收藏" />
      )}
    </div>
  );
}