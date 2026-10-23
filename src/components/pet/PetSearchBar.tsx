import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Species } from '@/types/types';

export type SpeciesFilter = 'all' | Species;

interface PetSearchBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  species: SpeciesFilter;
  onSpeciesChange: (v: SpeciesFilter) => void;
}

const SPECIES_OPTIONS: { value: SpeciesFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'cat', label: '猫咪' },
  { value: 'dog', label: '狗狗' },
];

export default function PetSearchBar({ search, onSearchChange, species, onSpeciesChange }: PetSearchBarProps) {
  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索昵称或出没地点..."
          className="pl-9 pr-9 rounded-2xl h-11 bg-card"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            aria-label="清空"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 bg-card rounded-2xl p-1.5">
        {SPECIES_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={species === opt.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSpeciesChange(opt.value)}
            className={`rounded-xl h-8 px-4 ${species === opt.value ? '' : 'text-muted-foreground'}`}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}