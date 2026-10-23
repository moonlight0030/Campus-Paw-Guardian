import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSightingsWithPets, fetchCampusWeather } from '@/services/api';
import type { SightingWithPet, CampusWeatherData } from '@/types/types';
import CampusMapCanvas, { type MapHotspotData, type HotspotAnimalItem } from '@/components/campus-map/CampusMapCanvas';
import SightingDialog from '@/components/SightingDialog';
import { getHotspotStyle } from '@/utils/campusLocations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Clock, Flame, Sparkles, Filter, ChevronRight, Cat, Compass, RefreshCw,
  CloudRain, CloudSnow, Sun, Cloud, Wind, Thermometer, ShieldAlert, Umbrella, Info, ArrowUpRight,
} from 'lucide-react';

type TimeFilter = '7d' | '30d' | 'all';

// 校园流浪动物雨雪天避雨常去点
interface RainShelterSpot {
  id: string;
  name: string;
  mapLocation: string; // 对应校园地图的建筑物名称
  tag: string;
  description: string;
  tips: string;
  popularPets?: string[];
}

const CAMPUS_RAIN_SHELTERS: RainShelterSpot[] = [
  {
    id: 'shelter-teaching',
    name: '教学楼架空连廊与底层挑檐',
    mapLocation: '一教/二教教学楼',
    tag: '最受猫咪青睐',
    description: '挑高开阔避雨，通风且地面干燥，两翼连廊无积水。',
    tips: '猫咪常在连廊转角纸箱或二楼外走廊躲雨打盹，不易受过往雨伞惊扰。',
    popularPets: ['学霸橘', '大白'],
  },
  {
    id: 'shelter-canteen',
    name: '学生食堂侧门后檐雨棚',
    mapLocation: '学生食堂',
    tag: '干饭避雨两不误',
    description: '后檐雨棚进深大，遮风挡雨效果极佳，临近后厨补给点。',
    tips: '雨天常有三两只毛孩子蜷缩在避雨木托盘上，等待下课同学爱心投喂。',
    popularPets: ['三花学姐', '小黑'],
  },
  {
    id: 'shelter-dorm',
    name: '学生宿舍区架空层与入户廊下',
    mapLocation: '学生宿舍区',
    tag: '温暖信任区',
    description: '宿管阿姨门前常备爱心纸箱与防潮垫，有遮挡且相对恒温。',
    tips: '是毛孩子最信赖的避难所，宿管大爷经常善意照看，请勿喧哗惊扰。',
    popularPets: ['奶牛猫', '花花'],
  },
  {
    id: 'shelter-library',
    name: '图书馆东侧下沉台阶回廊',
    mapLocation: '图书馆',
    tag: '静谧避风港',
    description: '背风深凹结构，避开人流主干道，雨水打不进台阶深处。',
    tips: '性格胆小腼腆的小猫喜欢藏在台阶阴凉干燥角落避雨，巡视时动作请轻缓。',
    popularPets: ['芝麻糊'],
  },
  {
    id: 'shelter-garden',
    name: '图书馆后花园紫藤连廊木亭',
    mapLocation: '图书馆后花园',
    tag: '绿植缓冲庇护',
    description: '浓密攀藤与木质凉亭形成多层遮挡，环境天然隐蔽。',
    tips: '平时在花园出没的小猫雨天会收缩至凉亭木椅下方干燥区。',
    popularPets: ['小黄'],
  },
  {
    id: 'shelter-west-gate',
    name: '西门银杏道保安岗亭侧檐',
    mapLocation: '西门银杏道',
    tag: '校犬常驻点',
    description: '保安师傅特意留有遮雨侧檐，备有清洁饮水碗。',
    tips: '友善的大黄等校犬常在此卧着躲雨，性格温顺，见到同学会轻轻摇尾巴。',
    popularPets: ['阿黄'],
  },
];

export default function ActivityMapPage() {
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7d');
  const [sightings, setSightings] = useState<SightingWithPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [sightingOpen, setSightingOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  // 天气相关状态（baidu-weather-query）
  const [weatherData, setWeatherData] = useState<CampusWeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [showShelterDetail, setShowShelterDetail] = useState(false);

  // 加载目击数据
  const loadData = async (filter: TimeFilter) => {
    setLoading(true);
    const days = filter === '7d' ? 7 : filter === '30d' ? 30 : undefined;
    try {
      const data = await fetchSightingsWithPets(days);
      setSightings(data);
    } catch (e) {
      console.error('加载活动地图数据失败:', e);
    } finally {
      setLoading(false);
    }
  };

  // 加载校园实时天气（baidu-weather-query）
  const loadWeather = async () => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const weather = await fetchCampusWeather('110108'); // 海淀区高校密集区
      setWeatherData(weather);
    } catch (e: any) {
      console.warn('获取天气数据提示:', e);
      setWeatherError(e.message || '天气数据加载稍有延迟');
      // 容错兜底数据，确保页面绝对不白屏
      setWeatherData({
        location: { country: '中国', province: '北京市', city: '北京市', name: '海淀区', id: '110108' },
        now: {
          text: '晴',
          temp: 26,
          feels_like: 25,
          rh: 35,
          wind_class: '2级',
          wind_dir: '西南风',
          uptime: new Date().toISOString(),
        },
        forecasts: [
          { date: '今日', week: '今天', high: 28, low: 16, text_day: '晴', text_night: '晴', wc_day: '2级', wd_day: '西南风' },
          { date: '明日', week: '明天', high: 27, low: 17, text_day: '多云', text_night: '晴', wc_day: '2级', wd_day: '南风' },
        ],
      });
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    loadData(timeFilter);
  }, [timeFilter]);

  useEffect(() => {
    loadWeather();
  }, []);

  // 分析是否处于雨雪天或恶劣气候
  const weatherAnalysis = useMemo(() => {
    if (!weatherData?.now) {
      return { isRainy: false, isSnowy: false, isCold: false, isWindy: false, summary: '天气晴好' };
    }
    const text = weatherData.now.text || '';
    const temp = weatherData.now.temp ?? 20;
    const windClass = weatherData.now.wind_class || '';

    const isRainy = text.includes('雨');
    const isSnowy = text.includes('雪');
    const isCold = temp <= 8;
    const isWindy = windClass.includes('4') || windClass.includes('5') || windClass.includes('6') || text.includes('风');

    let summary = '当前天气晴好，毛孩子们多在户外草坪晒太阳';
    if (isRainy) {
      summary = `当前正在下${text}，流浪动物体表毛发潮湿容易失温，请优先前往避雨点巡查！`;
    } else if (isSnowy) {
      summary = `当前正在下${text}，气温偏低，室外饮水易结冰，小动物多躲入室内连廊保暖！`;
    } else if (isCold) {
      summary = `当前气温仅 ${temp}℃，寒意明显，请关注避风角落，给毛孩子添些干燥保暖垫。`;
    } else if (isWindy) {
      summary = `当前风力较大(${windClass})，动物多在背风建筑物角落躲避飞沙大风。`;
    }

    return { isRainy, isSnowy, isCold, isWindy, summary, text, temp };
  }, [weatherData]);

  // 按地点聚合数据，生成适合校园内部矢量地图的数据结构
  const hotspots = useMemo<MapHotspotData[]>(() => {
    const map = new Map<string, { count: number; sightings: SightingWithPet[] }>();

    sightings.forEach((s) => {
      const loc = s.location || '校园某处';
      if (!map.has(loc)) {
        map.set(loc, { count: 0, sightings: [] });
      }
      const entry = map.get(loc)!;
      entry.count += 1;
      entry.sightings.push(s);
    });

    const result: MapHotspotData[] = [];

    map.forEach((value, locationName) => {
      const animalMap = new Map<string, HotspotAnimalItem>();

      const sortedSightings = [...value.sightings].sort(
        (a, b) => new Date(b.sighted_at).getTime() - new Date(a.sighted_at).getTime()
      );

      sortedSightings.forEach((s) => {
        const petId = s.pet_id;
        if (!animalMap.has(petId)) {
          animalMap.set(petId, {
            petId,
            petName: s.pet?.name || '未知小可爱',
            petPhoto: s.pet?.photo_url || '',
            petSpecies: (s.pet?.species as 'cat' | 'dog') || 'cat',
            latestSightedAt: s.sighted_at,
            latestRecorder: s.recorder_name || '热心同学',
            notes: s.notes || undefined,
          });
        }
      });

      result.push({
        locationName,
        count: value.count,
        recentAnimals: Array.from(animalMap.values()),
        latestSightedAt: sortedSightings[0]?.sighted_at || '',
      });
    });

    return result.sort((a, b) => b.count - a.count);
  }, [sightings]);

  // 点击避雨点或热度榜地点联动聚焦到地图
  const focusOnHotspot = (locationName: string) => {
    setSelectedLocation(locationName);
  };

  // 天气对应图标
  const renderWeatherIcon = (text: string) => {
    if (text.includes('雨')) return <CloudRain className="w-5 h-5 text-blue-500 animate-pulse" />;
    if (text.includes('雪')) return <CloudSnow className="w-5 h-5 text-sky-400 animate-bounce" />;
    if (text.includes('多云') || text.includes('阴')) return <Cloud className="w-5 h-5 text-amber-600/80" />;
    if (text.includes('风')) return <Wind className="w-5 h-5 text-teal-500" />;
    return <Sun className="w-5 h-5 text-amber-500 animate-[spin_12s_linear_infinite]" />;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 顶部标题与操作 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
              <Compass className="h-5 w-5" />
            </span>
            <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground">校园活动地图</h1>
            <Badge className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 px-2.5 py-0.5 text-xs">
              实时热点
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            纯学校内部平面视图，展示图书馆、宿舍区、教学楼、图书馆后花园、操场等各建筑出没热点
          </p>
        </div>

        {/* 操作区：打卡入口 */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setSightingOpen(true)}
            className="rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium shadow-md shadow-primary/25 hover:opacity-95 gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            遇见萌友 · 立即打卡
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              loadData(timeFilter);
              loadWeather();
            }}
            className="rounded-2xl"
            title="刷新数据与天气"
          >
            <RefreshCw className={`w-4 h-4 ${loading || weatherLoading ? 'animate-spin text-primary' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 百度天气接入卡片与雨雪天避雨常去点提示栏 */}
      <div className="rounded-3xl border border-primary/25 bg-gradient-to-br from-amber-50/60 via-orange-50/30 to-background p-4 md:p-5 shadow-sm space-y-4">
        {/* 第一行：天气概览与恶劣气候提醒 */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* 左侧：实时气象小标 */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/90 shadow-sm border border-border/60 flex items-center justify-center shrink-0">
              {renderWeatherIcon(weatherData?.now?.text || '晴')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  {weatherData?.location?.name || '海淀高校区'} · 校园气象
                </span>
                <Badge
                  variant={weatherAnalysis.isRainy || weatherAnalysis.isSnowy ? 'destructive' : 'secondary'}
                  className="rounded-full text-[11px] px-2 py-0"
                >
                  {weatherData?.now?.text || '晴朗'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="text-foreground font-semibold text-base font-rounded">
                  {weatherData?.now?.temp ?? 26}°C
                </span>
                <span className="flex items-center gap-0.5">
                  <Thermometer className="w-3 h-3 text-primary" />
                  体感 {weatherData?.now?.feels_like ?? 25}°C
                </span>
                <span className="flex items-center gap-0.5">
                  <Wind className="w-3 h-3 text-teal-600" />
                  {weatherData?.now?.wind_dir || '西南风'} {weatherData?.now?.wind_class || '2级'}
                </span>
                <span>相对湿度 {weatherData?.now?.rh ?? 40}%</span>
              </div>
            </div>
          </div>

          {/* 右侧：雨雪恶劣天气诊断标语 */}
          <div className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border text-xs font-medium ${
            weatherAnalysis.isRainy
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : weatherAnalysis.isSnowy
              ? 'bg-sky-50 border-sky-200 text-sky-800'
              : weatherAnalysis.isCold
              ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
              : 'bg-primary/10 border-primary/20 text-primary'
          }`}>
            {weatherAnalysis.isRainy ? (
              <Umbrella className="w-4 h-4 shrink-0 text-blue-600" />
            ) : weatherAnalysis.isSnowy ? (
              <CloudSnow className="w-4 h-4 shrink-0 text-sky-600" />
            ) : (
              <Sun className="w-4 h-4 shrink-0 text-amber-600" />
            )}
            <span className="line-clamp-1">{weatherAnalysis.summary}</span>
          </div>
        </div>

        {/* 第二行：雨雪天流浪动物避雨常去点快捷导览（可点击联动地图高亮） */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Umbrella className="w-4 h-4 text-primary" />
              <span>雨雪天流浪动物避雨常去点（点击可直接定位地图）</span>
            </div>
            <button
              type="button"
              onClick={() => setShowShelterDetail(!showShelterDetail)}
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              <span>{showShelterDetail ? '收起避雨指南' : '展开避雨指南'}</span>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showShelterDetail ? 'rotate-90' : ''}`} />
            </button>
          </div>

          {/* 避雨常去点卡片横向滚动/网格 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {CAMPUS_RAIN_SHELTERS.map((shelter) => {
              const isSelected = selectedLocation === shelter.mapLocation;
              return (
                <div
                  key={shelter.id}
                  onClick={() => focusOnHotspot(shelter.mapLocation)}
                  className={`p-2.5 rounded-2xl border text-xs cursor-pointer transition-all hover:scale-[1.01] ${
                    isSelected
                      ? 'bg-primary/15 border-primary shadow-sm'
                      : 'bg-white/80 border-border/70 hover:bg-primary/5 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-foreground flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{shelter.name}</span>
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md shrink-0 border-primary/30 text-primary">
                      {shelter.tag}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {shelter.description}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-primary/80 mt-1.5 pt-1 border-t border-border/40">
                    <span className="truncate">常驻萌友：{shelter.popularPets?.join('、')}</span>
                    <span className="flex items-center gap-0.5 shrink-0 text-primary font-medium">
                      聚焦地图 <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 展开的雨雪天气守护贴士 */}
          {showShelterDetail && (
            <div className="mt-3 p-3.5 rounded-2xl bg-background/80 border border-primary/20 text-xs text-muted-foreground space-y-1.5 animate-in fade-in duration-200">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-primary" />
                <span>雨雪严寒天气校园守护须知：</span>
              </div>
              <p>1. <strong>请勿惊吓躲雨动物</strong>：雨天猫狗精神紧张，遇到在连廊、窗台蜷缩的动物，请放轻脚步，勿高声喧哗或撑开雨伞恐吓。</p>
              <p>2. <strong>敲敲车盖防钻猫</strong>：雨雪天校园停放车辆发动机舱余温吸引小猫钻入避寒，开车前请轻轻拍打引擎盖提醒。</p>
              <p>3. <strong>温水与干粮支援</strong>：雨天湿粮容易变质、雪天水盆结冰，建议在上述干燥避雨架空层投放干猫粮并及时更换清洁温水。</p>
            </div>
          )}
        </div>
      </div>

      {/* 时间筛选按钮栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/60">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span>时间范围：</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={timeFilter === '7d' ? 'default' : 'secondary'}
            onClick={() => setTimeFilter('7d')}
            className="rounded-xl h-8 px-3.5 text-xs font-medium"
          >
            最近7天
          </Button>
          <Button
            size="sm"
            variant={timeFilter === '30d' ? 'default' : 'secondary'}
            onClick={() => setTimeFilter('30d')}
            className="rounded-xl h-8 px-3.5 text-xs font-medium"
          >
            最近30天
          </Button>
          <Button
            size="sm"
            variant={timeFilter === 'all' ? 'default' : 'secondary'}
            onClick={() => setTimeFilter('all')}
            className="rounded-xl h-8 px-3.5 text-xs font-medium"
          >
            全部历史
          </Button>
        </div>
      </div>

      {/* 概览统计条 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-card border border-border/60 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-primary" />
            发现热点区域
          </p>
          <p className="text-2xl font-bold font-rounded text-foreground mt-1">
            {hotspots.length} <span className="text-xs font-normal text-muted-foreground">个</span>
          </p>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-primary" />
            目击上报总数
          </p>
          <p className="text-2xl font-bold font-rounded text-foreground mt-1">
            {sightings.length} <span className="text-xs font-normal text-muted-foreground">次</span>
          </p>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Cat className="w-3.5 h-3.5 text-primary" />
            最高频出没地
          </p>
          <p className="text-base font-bold font-rounded text-foreground mt-1 truncate">
            {hotspots[0]?.locationName || '暂无数据'}
          </p>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            活跃萌友数
          </p>
          <p className="text-2xl font-bold font-rounded text-foreground mt-1">
            {new Set(sightings.map((s) => s.pet_id)).size} <span className="text-xs font-normal text-muted-foreground">只</span>
          </p>
        </div>
      </div>

      {/* 地图主体与侧边热点列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 专属校园内部地图视图 */}
        <div className="lg:col-span-2 relative flex flex-col h-[520px] md:h-[600px] rounded-3xl overflow-hidden border border-border/60 shadow-sm bg-card">
          <CampusMapCanvas
            hotspots={hotspots}
            selectedLocation={selectedLocation}
            onSelectLocation={(loc) => setSelectedLocation(loc)}
            onNavigateToPet={(petId) => navigate(`/pet/${petId}`)}
            className="w-full h-full"
          />

          {/* 右下角热度图例 */}
          <div className="absolute bottom-3 right-3 z-10 bg-background/95 backdrop-blur-sm p-2.5 rounded-2xl border border-border/50 shadow-md text-xs space-y-1.5 pointer-events-none">
            <div className="font-semibold text-foreground text-[11px] mb-1">目击频次热度</div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#EF4444] border border-[#DC2626]" />
              <span className="text-muted-foreground text-[11px]">&gt; 6次 (超级热点)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#FB923C] border border-[#EA580C]" />
              <span className="text-muted-foreground text-[11px]">4 - 6次 (高度活跃)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#FDBA74] border border-[#F97316]" />
              <span className="text-muted-foreground text-[11px]">2 - 3次 (经常出现)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#FEF08A] border border-[#EAB308]" />
              <span className="text-muted-foreground text-[11px]">1次 (偶尔出没)</span>
            </div>
          </div>
        </div>

        {/* 侧边：热点地点与动物出没详情列表 */}
        <div className="flex flex-col h-[520px] md:h-[600px] rounded-3xl border border-border/60 bg-card p-4 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-1.5 font-rounded font-bold text-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              <span>地点热度榜</span>
            </div>
            <span className="text-xs text-muted-foreground">点击聚焦地图</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
            {hotspots.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <MapPin className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">所选时间段暂无目击数据</p>
                <p className="text-xs mt-1">快来做校园里第一个发现萌宠的小可爱吧～</p>
                <Button
                  size="sm"
                  onClick={() => setSightingOpen(true)}
                  className="mt-4 rounded-xl text-xs"
                >
                  去打卡上报
                </Button>
              </div>
            ) : (
              hotspots.map((hotspot, idx) => {
                const style = getHotspotStyle(hotspot.count);
                const isSelected = selectedLocation === hotspot.locationName;

                return (
                  <div
                    key={hotspot.locationName}
                    onClick={() => focusOnHotspot(hotspot.locationName)}
                    className={`rounded-2xl p-3.5 border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/60 bg-secondary/20 hover:bg-secondary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {idx + 1}
                        </span>
                        <h4 className="font-semibold text-sm text-foreground">{hotspot.locationName}</h4>
                      </div>
                      <Badge className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.badgeClass}`}>
                        {hotspot.count} 次目击
                      </Badge>
                    </div>

                    {/* 近期动物头像列表 */}
                    <div className="space-y-1.5 mt-2 pt-2 border-t border-border/40">
                      <p className="text-[11px] text-muted-foreground">近期被记录过的动物：</p>
                      <div className="flex flex-wrap gap-1.5">
                        {hotspot.recentAnimals.map((animal) => {
                          return (
                            <button
                              key={animal.petId}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/pet/${animal.petId}`);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-background border border-border/60 px-2 py-1 text-xs hover:border-primary transition-colors text-left"
                            >
                              <img
                                src={animal.petPhoto}
                                alt={animal.petName}
                                className="w-4 h-4 rounded-full object-cover shrink-0"
                                onError={(ev) => {
                                  (ev.currentTarget as HTMLImageElement).src =
                                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23FFE8D6"/%3E%3C/svg%3E';
                                }}
                              />
                              <span className="font-medium text-foreground">{animal.petName}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 遇见萌友全局打卡弹窗 */}
      <SightingDialog
        open={sightingOpen}
        onOpenChange={setSightingOpen}
        onSuccess={() => loadData(timeFilter)}
      />
    </div>
  );
}
