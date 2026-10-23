import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPets } from '@/services/api';
import type { Pet } from '@/types/types';
import PetGrid from '@/components/pet/PetGrid';
import PetSearchBar, { type SpeciesFilter } from '@/components/pet/PetSearchBar';
import LostPetsSection from '@/components/lost/LostPetsSection';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PawPrint, AlertCircle, HeartHandshake } from 'lucide-react';

export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'lost' ? 'lost' : 'pets';
  const [activeTab, setActiveTab] = useState<'pets' | 'lost'>(initialTab);

  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [species, setSpecies] = useState<SpeciesFilter>('all');
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items, total: t } = await fetchPets({ search, species, page: 0 });
      setPets(items);
      setTotal(t);
    } catch (e) {
      console.error('加载失败', e);
    } finally {
      setLoading(false);
    }
  }, [search, species]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const handleTabChange = (val: string) => {
    const nextTab = val as 'pets' | 'lost';
    setActiveTab(nextTab);
    if (nextTab === 'lost') {
      setSearchParams({ tab: 'lost' });
    } else {
      setSearchParams({});
    }
  };

  const emptyText =
    search.trim() && pets.length === 0
      ? '暂无匹配的萌宠档案'
      : species !== 'all' && pets.length === 0
        ? '暂无该物种的萌宠档案'
        : '暂无萌宠档案';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground flex items-center gap-2">
            档案大厅 🐾
          </h1>
          <p className="text-muted-foreground mt-1 text-xs md:text-sm">
            浏览校园里的流浪猫狗档案，或在走失求助专区互助接力发布启事与线索打卡
          </p>
        </div>

        {/* 顶部标签切换 */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-auto">
          <TabsList className="bg-secondary/60 p-1 rounded-2xl h-11 border border-border/40">
            <TabsTrigger
              value="pets"
              className="rounded-xl text-xs md:text-sm font-semibold gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm px-4"
            >
              <PawPrint className="w-4 h-4 text-primary" />
              萌宠档案
              {total > 0 && <span className="opacity-70 text-xs">({total})</span>}
            </TabsTrigger>
            <TabsTrigger
              value="lost"
              className="rounded-xl text-xs md:text-sm font-semibold gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm px-4 data-[state=active]:text-destructive"
            >
              <AlertCircle className="w-4 h-4 text-destructive" />
              走失求助与寻宠
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'pets' ? (
        <div className="space-y-6">
          <PetSearchBar
            search={search}
            onSearchChange={setSearch}
            species={species}
            onSpeciesChange={setSpecies}
          />
          <PetGrid pets={pets} loading={loading} emptyText={emptyText} />
        </div>
      ) : (
        <LostPetsSection />
      )}
    </div>
  );
}