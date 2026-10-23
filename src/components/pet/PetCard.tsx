import { useNavigate } from 'react-router-dom';
import type { Pet } from '@/types/types';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Heart, MapPin, Clock, Cat, Dog, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface PetCardProps {
  pet: Pet;
}

export default function PetCard({ pet }: PetCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFav, toggle } = useFavorites();
  const fav = isFav(pet.id);

  const handleFav = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    await toggle(pet.id);
  };

  const timeText = formatDistanceToNow(new Date(pet.discovered_at), { addSuffix: true, locale: zhCN });

  return (
    <div
      onClick={() => navigate(`/pet/${pet.id}`)}
      className="break-inside-avoid mb-5 group cursor-pointer rounded-3xl overflow-hidden bg-card border border-border/60 shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative w-full overflow-hidden">
        <img
          src={pet.photo_url}
          alt={`${pet.name}的照片`}
          loading="lazy"
          className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23FFF7ED"/%3E%3C/svg%3E';
          }}
        />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <Badge className="rounded-full bg-primary/90 text-primary-foreground border-0 px-3 py-1 gap-1">
            {pet.species === 'cat' ? <Cat className="w-3.5 h-3.5" /> : <Dog className="w-3.5 h-3.5" />}
            {pet.species === 'cat' ? '猫咪' : '狗狗'}
          </Badge>
          {pet.is_neutered && (
            <Badge className="rounded-full bg-success/90 text-success-foreground border-0 px-3 py-1 gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              已绝育
            </Badge>
          )}
        </div>
        <button
          onClick={handleFav}
          aria-label={fav ? '取消收藏' : '收藏'}
          className="absolute top-3 right-3 w-9 h-9 rounded-full glass-card flex items-center justify-center transition-transform active:scale-90 hover:scale-110"
        >
          <Heart className={`w-5 h-5 transition-colors ${fav ? 'fill-primary text-primary' : 'text-foreground/70'}`} />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-rounded font-bold text-lg text-foreground truncate">{pet.name}</h3>
          <span className="text-xs text-muted-foreground shrink-0">{pet.gender === 'male' ? '♂ 公' : '♀ 母'}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {pet.personality_tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4 shrink-0 text-primary" />
          <span className="truncate">{pet.location_name}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{timeText}被发现</span>
        </div>
      </div>
    </div>
  );
}