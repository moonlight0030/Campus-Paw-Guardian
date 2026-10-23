/**
 * 校园地点内部平面坐标系统与辅助工具
 * 基于 1000 x 700 纯学校内部平面坐标网格
 */

export interface CampusPoint {
  x: number;
  y: number;
}

export interface CampusBuilding {
  id: string;
  name: string;
  alias?: string[];
  x: number; // 中心点或锚点
  y: number;
  width: number;
  height: number;
  category: 'academic' | 'living' | 'sports' | 'garden' | 'facility' | 'water';
  color: string;
  iconName: string;
  description: string;
}

// 校园内部主要建筑物与景点区域配置（纯学校内部，不含校外）
export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  {
    id: 'library',
    name: '图书馆',
    alias: ['总图', '逸夫图书馆', '图书馆主楼'],
    x: 380,
    y: 330,
    width: 130,
    height: 90,
    category: 'academic',
    color: '#E06D53',
    iconName: 'BookOpen',
    description: '藏书丰富，安静温雅，一层台阶常有猫咪出没',
  },
  {
    id: 'library-garden',
    name: '图书馆后花园',
    alias: ['后花园', '图书馆花园', '后花园灌木'],
    x: 340,
    y: 230,
    width: 140,
    height: 65,
    category: 'garden',
    color: '#86B049',
    iconName: 'Flower2',
    description: '鸟语花香的花园灌木丛，猫咪最喜欢的隐蔽打盹胜地',
  },
  {
    id: 'canteen',
    name: '学生食堂',
    alias: ['第一食堂', '第二食堂', '学一', '学二', '食堂旁草丛', '食堂'],
    x: 640,
    y: 360,
    width: 120,
    height: 85,
    category: 'living',
    color: '#F5A623',
    iconName: 'Utensils',
    description: '飘香的美食区，侧边花坛和草丛是流浪毛孩子们的固定干饭点',
  },
  {
    id: 'teaching-buildings',
    name: '教学楼群',
    alias: ['教学楼前', '一教', '二教', '文史楼', '理教', '三教', '教学楼'],
    x: 660,
    y: 200,
    width: 160,
    height: 85,
    category: 'academic',
    color: '#5B8FB9',
    iconName: 'GraduationCap',
    description: '上下课人流密集，门前宽阔的台阶与连廊是小可爱的社交场',
  },
  {
    id: 'playground',
    name: '操场边',
    alias: ['操场', '东操', '西操', '第一体育场', '看台', '田径场'],
    x: 740,
    y: 530,
    width: 190,
    height: 120,
    category: 'sports',
    color: '#47A992',
    iconName: 'Trophy',
    description: '标准环形跑道与草坪，傍晚常有修勾和猫咪散步晒晚霞',
  },
  {
    id: 'dormitory',
    name: '宿舍楼下',
    alias: ['宿舍区', '学生宿舍', '3栋', '5栋', '学宿', '宿舍'],
    x: 210,
    y: 470,
    width: 160,
    height: 110,
    category: 'living',
    color: '#A27B5C',
    iconName: 'Home',
    description: '温馨的生活区，单元门口花坛经常被宿管阿姨和同学们投喂',
  },
  {
    id: 'lake',
    name: '未名湖畔',
    alias: ['湖畔步道', '未名湖', '生态湖', '湖心岛'],
    x: 480,
    y: 150,
    width: 150,
    height: 65,
    category: 'water',
    color: '#64CCC5',
    iconName: 'Waves',
    description: '碧波荡漾的校园水系，沿湖芦苇荡是神秘小动物的游憩地',
  },
  {
    id: 'west-gate',
    name: '西门银杏道',
    alias: ['西门', '银杏大道', '银杏路'],
    x: 120,
    y: 320,
    width: 90,
    height: 120,
    category: 'garden',
    color: '#E5BA73',
    iconName: 'Trees',
    description: '金黄灿烂的景观步道，也是西侧进出校园的必经之路',
  },
  {
    id: 'activity-center',
    name: '学生活动中心',
    alias: ['学活', '大活', '团委楼', '艺术楼'],
    x: 500,
    y: 460,
    width: 100,
    height: 75,
    category: 'facility',
    color: '#B85042',
    iconName: 'Music',
    description: '社团活动大本营，充满年轻活力与温情氛围',
  },
];

// 地点到校园内部 (x, y) 坐标的映射
export const PRESET_CAMPUS_POINTS: Record<string, CampusPoint> = {
  '操场边': { x: 740, y: 530 },
  '图书馆后花园': { x: 340, y: 230 },
  '食堂旁草丛': { x: 620, y: 395 },
  '教学楼前': { x: 670, y: 245 },
  '宿舍楼下': { x: 220, y: 500 },
  '西门银杏道': { x: 130, y: 320 },
  '未名湖畔': { x: 480, y: 150 },
  '湖畔步道': { x: 440, y: 170 },
  '学生食堂': { x: 650, y: 350 },
  '图书馆': { x: 390, y: 330 },
  '教学楼': { x: 660, y: 200 },
  '学生活动中心': { x: 500, y: 460 },
};

/**
 * 根据地点名称获取校园内部平面坐标 (x, y)
 * 纯学校内部网格 (0~1000, 0~700)
 */
export function getCampusPoint(locationName: string): CampusPoint {
  if (!locationName) {
    return { x: 500, y: 350 };
  }

  const trimmed = locationName.trim();

  // 1. 精确匹配
  if (PRESET_CAMPUS_POINTS[trimmed]) {
    return PRESET_CAMPUS_POINTS[trimmed];
  }

  // 2. 检查建筑物名称及别名模糊匹配
  for (const b of CAMPUS_BUILDINGS) {
    if (trimmed.includes(b.name) || b.name.includes(trimmed)) {
      return { x: b.x, y: b.y };
    }
    if (b.alias) {
      for (const a of b.alias) {
        if (trimmed.includes(a) || a.includes(trimmed)) {
          return { x: b.x, y: b.y };
        }
      }
    }
  }

  // 3. 预设地点部分匹配
  for (const [key, pt] of Object.entries(PRESET_CAMPUS_POINTS)) {
    if (trimmed.includes(key) || key.includes(trimmed)) {
      return pt;
    }
  }

  // 4. 自定义地点的稳定哈希偏移，确保始终映射在校园安全区域内（x: 180~820, y: 160~580）
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(i);
    hash |= 0;
  }

  const offsetX = (Math.abs(hash) % 200) - 100;
  const offsetY = (Math.abs(hash >> 3) % 160) - 80;

  return {
    x: Math.min(820, Math.max(180, 500 + offsetX)),
    y: Math.min(580, Math.max(160, 360 + offsetY)),
  };
}

/**
 * 保持向前兼容的经纬度接口（供历史引用或兜底）
 */
export const CAMPUS_CENTER = {
  lng: 116.3275,
  lat: 39.9905,
  name: '校园中心',
};

export function getLocationCoord(locationName: string): { lng: number; lat: number } {
  const pt = getCampusPoint(locationName);
  // 将平面坐标映射为模拟经纬度
  return {
    lng: Number((116.3275 + ((pt.x - 500) / 500) * 0.005).toFixed(6)),
    lat: Number((39.9905 - ((pt.y - 350) / 350) * 0.004).toFixed(6)),
  };
}

/**
 * 热点圆点样式规则（目击次数越大，圆点越大、颜色越深）
 * 浅黄 -> 橙色 -> 深橙 -> 深红
 */
export function getHotspotStyle(count: number): {
  color: string;
  fillColor: string;
  radius: number; // 像素
  badgeClass: string;
  levelDesc: string;
} {
  if (count <= 1) {
    return {
      color: '#EAB308', // 黄色边框
      fillColor: '#FEF08A', // 浅黄 (yellow-200)
      radius: 14,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      levelDesc: '偶尔出没',
    };
  }
  if (count <= 3) {
    return {
      color: '#F97316', // 橙色边框
      fillColor: '#FDBA74', // 浅橙 (orange-300)
      radius: 18,
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
      levelDesc: '经常出现',
    };
  }
  if (count <= 6) {
    return {
      color: '#EA580C', // 深橙边框
      fillColor: '#FB923C', // 亮橙 (orange-400)
      radius: 24,
      badgeClass: 'bg-orange-200 text-orange-900 border-orange-400',
      levelDesc: '高度活跃',
    };
  }
  // > 6次
  return {
    color: '#DC2626', // 红色边框
    fillColor: '#EF4444', // 红色 (red-500)
    radius: 30,
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    levelDesc: '超级热点',
  };
}
