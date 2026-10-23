import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  CAMPUS_BUILDINGS,
  getCampusPoint,
  getHotspotStyle,
  type CampusBuilding,
  type CampusPoint,
} from '@/utils/campusLocations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  MapPin,
  Clock,
  Sparkles,
  Info,
  ChevronRight,
  PawPrint,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export interface HotspotAnimalItem {
  petId: string;
  petName: string;
  petPhoto: string;
  petSpecies: 'cat' | 'dog';
  latestSightedAt: string;
  latestRecorder?: string;
  notes?: string;
}

export interface MapHotspotData {
  locationName: string;
  count: number;
  recentAnimals: HotspotAnimalItem[];
  latestSightedAt?: string;
  point?: CampusPoint;
}

export interface TrajectoryItem {
  id: string;
  location: string;
  sighted_at: string;
  recorder_name?: string | null;
  notes?: string | null;
  photo_url?: string | null;
}

interface CampusMapCanvasProps {
  hotspots?: MapHotspotData[];
  trajectory?: TrajectoryItem[];
  selectedLocation?: string | null;
  onSelectLocation?: (locationName: string) => void;
  onNavigateToPet?: (petId: string) => void;
  className?: string;
  compact?: boolean; // 小地图紧凑模式
}

export default function CampusMapCanvas({
  hotspots = [],
  trajectory = [],
  selectedLocation,
  onSelectLocation,
  onNavigateToPet,
  className = 'w-full h-full min-h-[500px]',
  compact = false,
}: CampusMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 缩放与平移状态
  const [scale, setScale] = useState<number>(compact ? 0.9 : 1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 弹窗状态
  const [activeHotspot, setActiveHotspot] = useState<MapHotspotData | null>(null);
  const [activeTrajectoryNode, setActiveTrajectoryNode] = useState<{
    index: number;
    item: TrajectoryItem;
    point: CampusPoint;
  } | null>(null);
  const [hoveredBuilding, setHoveredBuilding] = useState<CampusBuilding | null>(null);

  // 映射热点到平面坐标
  const hotspotsWithCoords = useMemo(() => {
    return hotspots.map((h) => ({
      ...h,
      point: h.point || getCampusPoint(h.locationName),
    }));
  }, [hotspots]);

  // 映射轨迹点到平面坐标
  const trajectoryWithCoords = useMemo(() => {
    // 按时间正序
    const sorted = [...trajectory].sort(
      (a, b) => new Date(a.sighted_at).getTime() - new Date(b.sighted_at).getTime()
    );
    return sorted.map((t, idx) => ({
      item: t,
      point: getCampusPoint(t.location),
      index: idx,
    }));
  }, [trajectory]);

  // 监听外部选中的地点，自动定位到该位置
  useEffect(() => {
    if (selectedLocation) {
      const match = hotspotsWithCoords.find((h) => h.locationName === selectedLocation);
      if (match) {
        setActiveHotspot(match);
      }
    }
  }, [selectedLocation, hotspotsWithCoords]);

  // 缩放控制
  const handleZoomIn = () => setScale((s) => Math.min(2.2, Number((s + 0.2).toFixed(2))));
  const handleZoomOut = () => setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(2))));
  const handleReset = () => {
    setScale(compact ? 0.9 : 1);
    setPan({ x: 0, y: 0 });
    setActiveHotspot(null);
    setActiveTrajectoryNode(null);
  };

  // 鼠标拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.interactive-node')) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPanRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // 触摸拖拽支持
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialPanRef.current = { ...pan };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    setPan({
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden rounded-3xl border border-border/70 bg-[#FBF9F5] shadow-inner ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* 专属校园底图 SVG 渲染层 (1000 x 700 纯校园内部区域) */}
      <div
        className="w-full h-full flex items-center justify-center transition-transform duration-75 origin-center"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
        }}
      >
        <svg
          viewBox="0 0 1000 700"
          className="w-full h-full max-w-[1000px] max-h-[700px] pointer-events-auto"
          style={{ minWidth: compact ? '680px' : '860px' }}
        >
          <defs>
            {/* 校园草坪柔和纹理 */}
            <linearGradient id="grassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EEF6E8" />
              <stop offset="100%" stopColor="#E3EED7" />
            </linearGradient>

            {/* 未名湖水面渐变 */}
            <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#BAE6FD" />
              <stop offset="100%" stopColor="#7DD3FC" />
            </linearGradient>

            {/* 操场塑胶跑道红 */}
            <linearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F87171" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>

            {/* 建筑物柔和投影 */}
            <filter id="buildingShadow" x="-10%" y="-10%" width="125%" height="125%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3D2B1F" floodOpacity="0.12" />
            </filter>

            {/* 热点圆点发光滤镜 */}
            <filter id="hotspotGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. 校园土地整体基底（学校围墙内部区域） */}
          <rect x="40" y="40" width="920" height="620" rx="36" fill="url(#grassGrad)" stroke="#C8DAB5" strokeWidth="3" />

          {/* 校园四方围墙与校门标记 */}
          <rect x="40" y="40" width="920" height="620" rx="36" fill="none" stroke="#A7C28E" strokeWidth="4" strokeDasharray="16 8" />
          
          {/* 校门标识 */}
          <g fill="#7A9A60" fontSize="12" fontWeight="600" textAnchor="middle">
            <rect x="460" y="28" width="80" height="22" rx="11" fill="#FFFFFF" stroke="#7A9A60" strokeWidth="1.5" />
            <text x="500" y="43">北校门</text>

            <rect x="460" y="650" width="80" height="22" rx="11" fill="#FFFFFF" stroke="#7A9A60" strokeWidth="1.5" />
            <text x="500" y="665">南校门</text>

            <rect x="22" y="325" width="26" height="60" rx="13" fill="#FFFFFF" stroke="#7A9A60" strokeWidth="1.5" />
            <text x="35" y="360" writingMode="vertical-rl">西校门</text>

            <rect x="952" y="325" width="26" height="60" rx="13" fill="#FFFFFF" stroke="#7A9A60" strokeWidth="1.5" />
            <text x="965" y="360" writingMode="vertical-rl">东校门</text>
          </g>

          {/* 2. 校园主干道路网 (浅灰米色道路，串联全校) */}
          <g stroke="#E7DFD5" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* 环校主路 */}
            <rect x="90" y="90" width="820" height="520" rx="28" />
            {/* 中央大道 (贯穿南北) */}
            <path d="M 500 50 L 500 650" />
            {/* 东西横贯大道 */}
            <path d="M 50 350 L 950 350" />
            {/* 教学与活动区连络步道 */}
            <path d="M 500 230 L 740 230 L 740 350" strokeWidth="18" />
            <path d="M 380 350 L 380 230 L 500 230" strokeWidth="18" />
            <path d="M 220 350 L 220 530 L 500 530" strokeWidth="18" />
            <path d="M 500 530 L 740 530" strokeWidth="18" />
          </g>
          {/* 道路虚线中心标线 */}
          <g stroke="#D4C9BC" strokeWidth="2" strokeDasharray="10 8" fill="none">
            <rect x="90" y="90" width="820" height="520" rx="28" />
            <path d="M 500 90 L 500 610" />
            <path d="M 90 350 L 910 350" />
          </g>

          {/* 3. 未名湖自然水系 (水面波浪、木栈道、芦苇) */}
          <g>
            <path
              d="M 400 130 C 440 100, 560 110, 580 150 C 600 180, 540 210, 480 200 C 420 190, 370 160, 400 130 Z"
              fill="url(#waterGrad)"
              stroke="#38BDF8"
              strokeWidth="2.5"
            />
            {/* 湖心水波 */}
            <path d="M 440 145 Q 460 140 480 145" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
            <path d="M 470 165 Q 490 160 510 165" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
            <path d="M 520 140 Q 535 136 550 140" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
            {/* 湖畔小鸭/水鸟点缀 */}
            <circle cx="465" cy="155" r="3" fill="#F59E0B" />
          </g>

          {/* 4. 操场区域 (东南侧标准塑胶跑道与草坪足球场) */}
          <g>
            {/* 红色椭圆跑道 */}
            <rect x="650" y="470" width="180" height="120" rx="60" fill="url(#trackGrad)" stroke="#DC2626" strokeWidth="3" />
            {/* 跑道白色标线 */}
            <rect x="662" y="482" width="156" height="96" rx="48" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.8" />
            {/* 内圈足球绿茵草坪 */}
            <rect x="674" y="494" width="132" height="72" rx="36" fill="#22C55E" stroke="#16A34A" strokeWidth="2" />
            {/* 足球场中线与禁区 */}
            <line x1="740" y1="494" x2="740" y2="566" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.8" />
            <circle cx="740" cy="530" r="14" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.8" />
            {/* 看台小条块 */}
            <rect x="660" y="456" width="160" height="10" rx="3" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="1" />
          </g>

          {/* 5. 图书馆后花园 (绿化景观带、灌木丛、小喷泉) */}
          <g>
            <rect x="270" y="195" width="140" height="75" rx="20" fill="#DCFCE7" stroke="#86EFAC" strokeWidth="2" />
            {/* 花坛与灌木球 */}
            <circle cx="300" cy="225" r="14" fill="#84CC16" opacity="0.8" />
            <circle cx="330" cy="245" r="12" fill="#22C55E" opacity="0.85" />
            <circle cx="370" cy="220" r="15" fill="#65A30D" opacity="0.8" />
            <circle cx="390" cy="250" r="11" fill="#4ADE80" opacity="0.9" />
            {/* 花园微型喷泉水池 */}
            <ellipse cx="340" cy="220" rx="14" ry="10" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.5" />
            <circle cx="340" cy="220" r="3" fill="#FFFFFF" />
          </g>

          {/* 6. 西门银杏道 (金黄树木阵列) */}
          <g>
            <rect x="100" y="260" width="60" height="150" rx="16" fill="#FEF3C7" stroke="#FDE68A" strokeWidth="1.5" />
            {/* 沿途银杏树 */}
            <circle cx="115" cy="285" r="10" fill="#EAB308" />
            <circle cx="145" cy="285" r="10" fill="#FACC15" />
            <circle cx="115" cy="335" r="11" fill="#F59E0B" />
            <circle cx="145" cy="335" r="11" fill="#EAB308" />
            <circle cx="115" cy="385" r="10" fill="#FACC15" />
            <circle cx="145" cy="385" r="10" fill="#F59E0B" />
          </g>

          {/* 7. 校园建筑物立体轮廓与标签 */}
          {CAMPUS_BUILDINGS.map((building) => {
            if (building.id === 'playground' || building.id === 'lake' || building.id === 'library-garden' || building.id === 'west-gate') {
              // 上方已做专属定制几何图形，这里仅输出建筑物地标铭牌
              return (
                <g
                  key={building.id}
                  className="cursor-pointer transition-transform duration-150"
                  onMouseEnter={() => setHoveredBuilding(building)}
                  onMouseLeave={() => setHoveredBuilding(null)}
                  onClick={() => onSelectLocation?.(building.name)}
                >
                  <rect
                    x={building.x - 52}
                    y={building.y - 14}
                    width="104"
                    height="28"
                    rx="14"
                    fill="#FFFFFF"
                    stroke={building.color}
                    strokeWidth="2"
                    filter="url(#buildingShadow)"
                  />
                  <text
                    x={building.x}
                    y={building.y + 4}
                    fill="#334155"
                    fontSize="11"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {building.name}
                  </text>
                </g>
              );
            }

            // 其他常规建筑物（图书馆、学生食堂、教学楼群、宿舍区、学生活动中心）
            const bX = building.x - building.width / 2;
            const bY = building.y - building.height / 2;
            const isHovered = hoveredBuilding?.id === building.id;

            return (
              <g
                key={building.id}
                className="cursor-pointer transition-transform duration-150"
                onMouseEnter={() => setHoveredBuilding(building)}
                onMouseLeave={() => setHoveredBuilding(null)}
                onClick={() => onSelectLocation?.(building.name)}
              >
                {/* 建筑物底部投影 */}
                <rect
                  x={bX}
                  y={bY}
                  width={building.width}
                  height={building.height}
                  rx="18"
                  fill={building.color}
                  filter="url(#buildingShadow)"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                />

                {/* 屋顶立体层次 */}
                <rect
                  x={bX + 6}
                  y={bY + 6}
                  width={building.width - 12}
                  height={building.height - 12}
                  rx="14"
                  fill="#FFFFFF"
                  fillOpacity={isHovered ? "0.95" : "0.9"}
                />

                {/* 建筑物内部窗格网格线 */}
                <g stroke={building.color} strokeWidth="1.2" opacity="0.4">
                  <line x1={bX + 16} y1={bY + building.height / 2} x2={bX + building.width - 16} y2={bY + building.height / 2} />
                  <line x1={bX + building.width / 2} y1={bY + 12} x2={bX + building.width / 2} y2={bY + building.height - 12} />
                </g>

                {/* 建筑物名称铭牌 */}
                <rect
                  x={building.x - 50}
                  y={building.y - 13}
                  width="100"
                  height="26"
                  rx="13"
                  fill="#FFFFFF"
                  stroke={building.color}
                  strokeWidth="2"
                  filter="url(#buildingShadow)"
                />
                <text
                  x={building.x}
                  y={building.y + 4}
                  fill="#1E293B"
                  fontSize="12"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {building.name}
                </text>
              </g>
            );
          })}

          {/* 8. 校园绿植景观树（散落于各处的可爱树木） */}
          <g fill="#22C55E" opacity="0.85">
            {/* 西南宿舍区绿树 */}
            <circle cx="160" cy="460" r="8" />
            <circle cx="175" cy="530" r="9" />
            <circle cx="280" cy="420" r="7" />
            {/* 教学楼周边树木 */}
            <circle cx="590" cy="190" r="9" />
            <circle cx="760" cy="160" r="10" />
            <circle cx="790" cy="220" r="8" />
            {/* 食堂与中央草坪树木 */}
            <circle cx="560" cy="410" r="8" />
            <circle cx="680" cy="410" r="7" />
            {/* 东南操场边缘树木 */}
            <circle cx="630" cy="560" r="9" />
            <circle cx="850" cy="540" r="8" />
          </g>

          {/* 9. 活动轨迹线绘制 (如果传入 trajectory 且 >= 2 个点) */}
          {trajectoryWithCoords.length >= 2 && (
            <g>
              {/* 轨迹发光折线底色 */}
              <polyline
                points={trajectoryWithCoords.map((t) => `${t.point.x},${t.point.y}`).join(' ')}
                fill="none"
                stroke="#FDE68A"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.8"
              />
              {/* 主轨迹折线 */}
              <polyline
                points={trajectoryWithCoords.map((t) => `${t.point.x},${t.point.y}`).join(' ')}
                fill="none"
                stroke="#E97451"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="8 4"
              />
            </g>
          )}

          {/* 10. 活动轨迹时序标记点 (小地图模式) */}
          {trajectoryWithCoords.map((t) => {
            const isStart = t.index === 0;
            const isLatest = t.index === trajectoryWithCoords.length - 1;
            const bgFill = isLatest ? '#EF4444' : isStart ? '#F59E0B' : '#E97451';
            const radius = isLatest ? 16 : isStart ? 14 : 12;

            return (
              <g
                key={`traj-${t.item.id}`}
                className="interactive-node cursor-pointer transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTrajectoryNode(t);
                  setActiveHotspot(null);
                }}
              >
                {/* 外发光 */}
                <circle
                  cx={t.point.x}
                  cy={t.point.y}
                  r={radius + 4}
                  fill={bgFill}
                  fillOpacity="0.3"
                />
                {/* 实体圆点 */}
                <circle
                  cx={t.point.x}
                  cy={t.point.y}
                  r={radius}
                  fill={bgFill}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  filter="url(#buildingShadow)"
                />
                {/* 序号文字 */}
                <text
                  x={t.point.x}
                  y={t.point.y + 4}
                  fill="#FFFFFF"
                  fontSize={radius > 13 ? '11' : '10'}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {isLatest ? '★' : t.index + 1}
                </text>
              </g>
            );
          })}

          {/* 11. 目击热点圆点标记 (活动地图主模式) */}
          {hotspotsWithCoords.map((hotspot) => {
            const style = getHotspotStyle(hotspot.count);
            const isSelected = activeHotspot?.locationName === hotspot.locationName;
            const radius = compact ? style.radius * 0.8 : style.radius;

            return (
              <g
                key={`hotspot-${hotspot.locationName}`}
                className="interactive-node cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveHotspot(hotspot);
                  setActiveTrajectoryNode(null);
                  onSelectLocation?.(hotspot.locationName);
                }}
              >
                {/* 外层呼吸脉冲圈 */}
                <circle
                  cx={hotspot.point.x}
                  cy={hotspot.point.y}
                  r={radius + 8}
                  fill={style.fillColor}
                  fillOpacity={isSelected ? "0.6" : "0.35"}
                  className="animate-pulse"
                />

                {/* 核心圆点（目击次数越大，圆点越大、颜色越深） */}
                <circle
                  cx={hotspot.point.x}
                  cy={hotspot.point.y}
                  r={radius}
                  fill={style.fillColor}
                  stroke={style.color}
                  strokeWidth={isSelected ? "3.5" : "2.5"}
                  filter="url(#buildingShadow)"
                />

                {/* 目击数字 */}
                <text
                  x={hotspot.point.x}
                  y={hotspot.point.y + (radius > 18 ? 5 : 4)}
                  fill="#3D2B1F"
                  fontSize={radius > 20 ? '13' : '11'}
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {hotspot.count}
                </text>

                {/* 常驻地点文字浮签（若放大或未被遮挡） */}
                {!compact && (
                  <g pointerEvents="none">
                    <rect
                      x={hotspot.point.x - 36}
                      y={hotspot.point.y - radius - 18}
                      width="72"
                      height="16"
                      rx="8"
                      fill="#FFFFFF"
                      fillOpacity="0.9"
                      stroke={style.color}
                      strokeWidth="1"
                    />
                    <text
                      x={hotspot.point.x}
                      y={hotspot.point.y - radius - 6}
                      fill="#334155"
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {hotspot.locationName}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 缩放控制工具栏 */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-background/90 backdrop-blur-md p-1 rounded-2xl border border-border/70 shadow-sm">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-xl"
          onClick={handleZoomIn}
          title="放大"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-xl"
          onClick={handleZoomOut}
          title="缩小"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-xl"
          onClick={handleReset}
          title="全景还原"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* 校园内部专属标识水印 */}
      <div className="absolute top-3 right-3 z-10 pointer-events-none bg-background/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-border/60 text-xs text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="font-medium text-foreground">校园内部平面图</span>
        <span className="text-[11px] text-muted-foreground">(仅显示学校建筑物与区域)</span>
      </div>

      {/* 点击热点圆点弹窗卡片 (信息窗口展示：地点名称、目击总次数、最近被记录过的动物名字及最近目击时间) */}
      {activeHotspot && (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="rounded-3xl bg-background/95 backdrop-blur-md border border-border/80 p-4 shadow-xl text-left">
            {/* 卡片头部 */}
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-bold text-sm text-foreground">{activeHotspot.locationName}</h4>
                  <p className="text-[10px] text-muted-foreground">校园内部出没区域</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge className={`rounded-full px-2 py-0.5 text-xs font-bold ${getHotspotStyle(activeHotspot.count).badgeClass}`}>
                  {activeHotspot.count} 次目击
                </Badge>
                <button
                  type="button"
                  onClick={() => setActiveHotspot(null)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 近期出没动物列表 */}
            <div className="py-2.5 space-y-2">
              <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                <span>近期出没萌友：</span>
                <span className="text-[10px]">点击可查看档案</span>
              </div>

              {activeHotspot.recentAnimals.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">当前暂无具体萌宠记录</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {activeHotspot.recentAnimals.map((animal) => {
                    let timeFormatted = animal.latestSightedAt;
                    try {
                      timeFormatted = format(new Date(animal.latestSightedAt), 'M月d日 HH:mm', { locale: zhCN });
                    } catch {
                      // ignore
                    }

                    return (
                      <div
                        key={animal.petId}
                        onClick={() => onNavigateToPet?.(animal.petId)}
                        className="flex items-center justify-between p-2 rounded-2xl bg-secondary/30 hover:bg-primary/10 border border-border/40 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={animal.petPhoto}
                            alt={animal.petName}
                            className="w-7 h-7 rounded-xl object-cover border border-border/50 shrink-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23FFE8D6"/%3E%3C/svg%3E';
                            }}
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-foreground truncate flex items-center gap-1">
                              <span>{animal.petName}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                ({animal.petSpecies === 'cat' ? '小猫' : '小狗'})
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{timeFormatted}</span>
                            </div>
                          </div>
                        </div>

                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 底部引导 */}
            <div className="pt-2 border-t border-border/60 text-right">
              <span className="text-[10px] text-primary hover:underline cursor-pointer" onClick={() => setActiveHotspot(null)}>
                收起窗口
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 点击轨迹节点弹窗卡片 (轨迹小地图模式) */}
      {activeTrajectoryNode && (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-72 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="rounded-3xl bg-background/95 backdrop-blur-md border border-border/80 p-3.5 shadow-xl text-left">
            <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {activeTrajectoryNode.index + 1}
                </span>
                <span className="font-bold text-xs text-foreground">
                  第 {activeTrajectoryNode.index + 1} 次目击
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTrajectoryNode(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="py-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">地点：</span>
                <span className="font-semibold text-foreground">{activeTrajectoryNode.item.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">时间：</span>
                <span className="text-foreground">
                  {format(new Date(activeTrajectoryNode.item.sighted_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">记录人：</span>
                <span className="text-foreground">{activeTrajectoryNode.item.recorder_name || '热心同学'}</span>
              </div>
              {activeTrajectoryNode.item.notes && (
                <div className="bg-primary/5 p-2 rounded-xl text-primary text-[11px] mt-1">
                  “{activeTrajectoryNode.item.notes}”
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
