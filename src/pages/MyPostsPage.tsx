import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMyPets } from '@/services/api';
import type { Pet } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import PetGrid from '@/components/pet/PetGrid';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export default function MyPostsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
      const data = await fetchMyPets(user.id);
      setPets(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground">我的发布</h1>
        <p className="text-muted-foreground mt-1">你发布的萌宠档案，共 {pets.length} 只</p>
      </div>

      {pets.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
            <FileText className="w-10 h-10 text-primary/60" />
          </div>
          <p className="text-lg font-medium">还没有发布任何萌宠档案</p>
          <p className="text-sm mt-1">记录校园里的小可爱，让更多同学认识 TA</p>
          <Button onClick={() => navigate('/publish')} className="mt-5 rounded-xl">
            去发布
          </Button>
        </div>
      ) : (
        <PetGrid pets={pets} loading={loading} emptyText="暂无发布" />
      )}
    </div>
  );
}