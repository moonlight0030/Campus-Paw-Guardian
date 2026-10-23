import { useEffect, useState } from 'react';
import { fetchStats } from '@/services/api';
import type { PetStats } from '@/types/types';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';
import { PawPrint, Cat, Dog, CheckCircle2 } from 'lucide-react';

const CHART_COLORS = [
  'hsl(14, 78%, 55%)',
  'hsl(37, 91%, 55%)',
  'hsl(150, 45%, 50%)',
  'hsl(24, 60%, 70%)',
  'hsl(350, 60%, 62%)',
];

export default function StatsPage() {
  const [stats, setStats] = useState<PetStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div className="py-20 text-center text-muted-foreground">暂无统计数据</div>;
  }

  const speciesData = [
    { name: '猫咪', value: stats.catCount },
    { name: '狗狗', value: stats.dogCount },
  ];
  const neuteredData = [
    { name: '已绝育', value: stats.neuteredCount },
    { name: '未绝育', value: stats.total - stats.neuteredCount },
  ];

  const summaryCards = [
    { icon: PawPrint, label: '萌宠总数', value: stats.total, color: 'text-primary' },
    { icon: Cat, label: '猫咪', value: stats.catCount, color: 'text-primary' },
    { icon: Dog, label: '狗狗', value: stats.dogCount, color: 'text-accent-foreground' },
    { icon: CheckCircle2, label: '绝育率', value: `${stats.neuteredRate}%`, color: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground">数据统计</h1>
        <p className="text-muted-foreground mt-1">校园萌宠守护档案的整体情况一览</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-card border border-border/60 p-4 md:p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              {card.label}
            </div>
            <p className={`text-2xl md:text-3xl font-rounded font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* 物种分布 */}
        <div className="rounded-3xl bg-card border border-border/60 p-5 md:p-6">
          <h3 className="text-lg font-rounded font-bold text-foreground mb-4">物种分布</h3>
          <div className="w-full min-w-0 overflow-hidden h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={speciesData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                  {speciesData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 绝育情况 */}
        <div className="rounded-3xl bg-card border border-border/60 p-5 md:p-6">
          <h3 className="text-lg font-rounded font-bold text-foreground mb-4">绝育情况</h3>
          <div className="w-full min-w-0 overflow-hidden h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={neuteredData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                  <Cell fill="hsl(150, 45%, 50%)" />
                  <Cell fill="hsl(24, 60%, 70%)" />
                </Pie>
                <Tooltip />
                <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 地点分布 */}
      <div className="rounded-3xl bg-card border border-border/60 p-5 md:p-6">
        <h3 className="text-lg font-rounded font-bold text-foreground mb-4">出没地点分布</h3>
        <div className="w-full min-w-0 overflow-hidden h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.locationDistribution} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <XAxis dataKey="location" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="数量" radius={[8, 8, 0, 0]} fill="hsl(14, 78%, 55%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}