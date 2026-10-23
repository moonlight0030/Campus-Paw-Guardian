import type { Pet } from '@/types/types';
import PetCard from './PetCard';
import { PawPrint } from 'lucide-react';

interface PetGridProps {
  pets: Pet[];
  loading?: boolean;
  emptyText?: string;
}

export default function PetGrid({ pets, loading, emptyText = '暂无萌宠档案' }: PetGridProps) {
  if (loading) {
    return (
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="break-inside-avoid mb-5 rounded-3xl overflow-hidden bg-muted animate-pulse">
            <div className="aspect-square bg-muted" />
            <div className="p-4 space-y-3">
              <div className="h-5 w-1/3 bg-muted rounded" />
              <div className="h-4 w-2/3 bg-muted rounded" />
              <div className="h-4 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (pets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
          <PawPrint className="w-10 h-10 text-primary/60" />
        </div>
        <p className="text-lg font-medium">{emptyText}</p>
        <p className="text-sm mt-1">换个关键词或筛选条件试试吧</p>
      </div>
    );
  }

  return (
    <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-5">
      {pets.map((pet) => (
        <PetCard key={pet.id} pet={pet} />
      ))}
    </div>
  );
}