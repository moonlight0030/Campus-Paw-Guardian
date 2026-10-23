import { useMemo } from 'react';
import type { Sighting } from '@/types/types';
import CampusMapCanvas, { type TrajectoryItem } from '@/components/campus-map/CampusMapCanvas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Route, Clock, User, Sparkles, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface PetTrajectoryMapProps {
  petName: string;
  defaultLocation?: string;
  sightings: Sighting[];
  onAddSightingClick?: () => void;
}

export default function PetTrajectoryMap({
  petName,
  defaultLocation = '校园某处',
  sightings,
  onAddSightingClick,
}: PetTrajectoryMapProps) {
  // 按时间先后顺序（升序）排列目击点，形成时间轨迹
  const chronologicalSightings = useMemo<TrajectoryItem[]>(() => {
    return [...sightings]
      .sort((a, b) => new Date(a.sighted_at).getTime() - new Date(b.sighted_at).getTime())
      .map((s) => ({
        id: s.id,
        location: s.location || s.location_name || defaultLocation,
        sighted_at: s.sighted_at,
        recorder_name: s.recorder_name || s.reporter_name || '热心同学',
        notes: s.notes || s.remark || '',
        photo_url: s.photo_url || null,
      }));
  }, [sightings, defaultLocation]);

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
      {/* 头部标题与统计 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Route className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-rounded font-bold text-base text-foreground flex items-center gap-1.5">
              <span>{petName} 的活动轨迹小地图</span>
              <Badge variant="secondary" className="rounded-full text-[11px] font-normal px-2 py-0.5">
                校园内部漫游
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              展示 TA 在校园各建筑间出没的时序足迹（按时间先后连线）
            </p>
          </div>
        </div>

        {onAddSightingClick && (
          <Button
            size="sm"
            onClick={onAddSightingClick}
            className="rounded-2xl bg-primary text-primary-foreground text-xs gap-1 self-start sm:self-auto shrink-0 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            上报新足迹
          </Button>
        )}
      </div>

      {/* 小地图容器：专属校园内部底图 */}
      <div className="relative h-[340px] md:h-[400px] w-full rounded-2xl overflow-hidden border border-border/60 bg-[#FBF9F5]">
        <CampusMapCanvas
          trajectory={chronologicalSightings}
          compact={true}
          className="w-full h-full"
        />

        {/* 若无目击数据，显示温馨提示浮层 */}
        {chronologicalSightings.length === 0 && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-none">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2">
              <MapPin className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">暂无目击足迹记录</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {petName} 经常出没在「{defaultLocation}」，如果你在校园里偶遇了 TA，快来为 TA 打卡上报吧！
            </p>
          </div>
        )}

        {/* 轨迹图例 */}
        {chronologicalSightings.length >= 2 && (
          <div className="absolute bottom-2.5 right-2.5 z-10 bg-background/90 backdrop-blur-sm px-2.5 py-1.5 rounded-xl border border-border/50 text-[10px] text-muted-foreground flex items-center gap-3 pointer-events-none shadow-sm">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              <span>起步点</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E97451]" />
              <span>途经足迹</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
              <span>★ 最新打卡</span>
            </div>
          </div>
        )}
      </div>

      {/* 轨迹时序简要时间线 (当有打卡记录时展示横向卡片) */}
      {chronologicalSightings.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">足迹时序记录（共 {chronologicalSightings.length} 次）：</span>
            <span>按时间先后排序</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 pt-1">
            {chronologicalSightings.map((s, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === chronologicalSightings.length - 1;

              let timeFormatted = s.sighted_at;
              try {
                timeFormatted = format(new Date(s.sighted_at), 'M月d日 HH:mm', { locale: zhCN });
              } catch {
                // ignore
              }

              return (
                <div
                  key={s.id}
                  className={`shrink-0 w-44 rounded-2xl p-2.5 border text-xs transition-colors ${
                    isLast
                      ? 'bg-primary/5 border-primary/50'
                      : 'bg-secondary/20 border-border/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                        isLast
                          ? 'bg-red-500 text-white'
                          : isFirst
                          ? 'bg-amber-500 text-white'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      {isLast ? '★' : idx + 1}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {isLast ? '最新位置' : isFirst ? '初始记录' : `第 ${idx + 1} 站`}
                    </span>
                  </div>

                  <div className="font-semibold text-foreground truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                    <span className="truncate">{s.location}</span>
                  </div>

                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{timeFormatted}</span>
                  </div>

                  {s.recorder_name && (
                    <div className="text-[10px] text-muted-foreground/80 flex items-center gap-1 mt-0.5 truncate">
                      <User className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">记录人：{s.recorder_name}</span>
                    </div>
                  )}

                  {s.notes && (
                    <p className="text-[10px] text-primary mt-1 line-clamp-1 italic bg-background/60 p-1 rounded-lg">
                      “{s.notes}”
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-secondary/30 text-xs text-muted-foreground">
          <AlertCircle className="w-4 h-4 text-primary shrink-0" />
          <span>快来成为第一个记录 {petName} 校园踪迹的同学吧！</span>
        </div>
      )}
    </div>
  );
}
