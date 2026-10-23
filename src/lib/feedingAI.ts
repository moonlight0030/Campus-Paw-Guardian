import type { Pet, Species, FeedingPlan, PetTodayFeedingStats } from '@/types/types';

/**
 * 猫咪绝对禁忌食物清单及毒理/危害提示
 */
export const FORBIDDEN_FOODS_CAT = [
  { name: '巧克力/可可', keywords: ['巧克力', '可可', '咖啡', '摩卡', '可乐', '茶'], danger: '含可可碱与咖啡因，会导致猫咪心律失常、中枢神经过度兴奋甚至致死！' },
  { name: '洋葱/大蒜/大葱', keywords: ['洋葱', '大蒜', '大葱', '蒜', '葱', '韭菜'], danger: '含二硫化物，破坏猫咪红细胞引发致命溶血性贫血与血尿！' },
  { name: '葡萄/葡萄干', keywords: ['葡萄', '提子', '葡萄干'], danger: '极小剂量即可诱发猫咪急性肾衰竭！' },
  { name: '百合花/植物', keywords: ['百合', '百合花'], danger: '猫咪接触或舔舐百合花粉、花瓣数小时内即引起不可逆肾衰竭！' },
  { name: '木糖醇/无糖糖果', keywords: ['木糖醇', '代糖', '甜味剂'], danger: '引发胰岛素激增导致急性重度低血糖与肝坏死！' },
  { name: '尖锐骨头/生鱼骨', keywords: ['鱼刺', '鸡骨', '鸭骨', '碎骨', '排骨'], danger: '尖锐骨头极易刺穿猫咪食道、胃部与肠道，引发内出血！' },
  { name: '纯牛奶/高乳糖乳品', keywords: ['牛奶', '纯牛奶', '鲜牛奶'], danger: '成猫多数乳糖不耐受，饮用会严重腹泻脱水。' },
  { name: '人吃剩饭/高油盐重调料', keywords: ['剩饭', '剩菜', '麻辣', '火锅', '卤味', '辣条'], danger: '高盐高油大幅加重猫咪肾脏负荷，引发泌尿系统结石与胰腺炎！' },
];

/**
 * 狗狗绝对禁忌食物清单及毒理/危害提示
 */
export const FORBIDDEN_FOODS_DOG = [
  { name: '巧克力/可可制品', keywords: ['巧克力', '可可', '咖啡', '可乐'], danger: '含可可碱，使狗狗心跳过速、肌肉震颤甚至猝死！' },
  { name: '葡萄/葡萄干', keywords: ['葡萄', '提子', '葡萄干'], danger: '狗狗剧毒物，极易造成急性不可逆肾功能衰竭！' },
  { name: '洋葱/大蒜/葱类', keywords: ['洋葱', '大蒜', '大葱', '蒜', '韭菜'], danger: '破坏红细胞，导致严重溶血性贫血与脏器衰竭！' },
  { name: '木糖醇', keywords: ['木糖醇', '口香糖', '无糖薄荷糖'], danger: '极少量即可导致狗狗低血糖休克及急性肝脏衰竭！' },
  { name: '夏威夷果/坚果类', keywords: ['夏威夷果', '核桃', '澳洲坚果'], danger: '导致后肢虚弱瘫痪、高热呕吐与神经系统中毒！' },
  { name: '牛油果/鳄梨', keywords: ['牛油果', '鳄梨'], danger: '含波斯素（Persin），引起犬只呕吐与腹泻消化障碍。' },
  { name: '熟鸡鸭禽类碎骨', keywords: ['鸡骨', '鸭骨', '熟骨', '碎骨'], danger: '烹饪后的禽骨易呈中空纵向裂开尖刺，划穿胃肠道！' },
  { name: '高盐人类剩菜/酒精', keywords: ['酒', '啤酒', '剩饭', '剩菜', '卤肉'], danger: '严重伤害狗狗肝肾功能与中枢神经系统！' },
];

/**
 * 校验用户输入的食物是否命中禁忌清单
 */
export function checkForbiddenFood(foodText: string, species: Species | string = 'cat'): {
  isForbidden: boolean;
  item?: { name: string; danger: string };
  matchedItems: { name: string; danger: string }[];
  warningMessage: string;
} {
  if (!foodText || !foodText.trim()) {
    return { isForbidden: false, matchedItems: [], warningMessage: '' };
  }
  const text = foodText.toLowerCase().trim();
  const list = species === 'dog' ? FORBIDDEN_FOODS_DOG : FORBIDDEN_FOODS_CAT;

  for (const item of list) {
    for (const kw of item.keywords) {
      if (text.includes(kw.toLowerCase())) {
        const matched = [{ name: item.name, danger: item.danger }];
        const warning = `【${item.name}】含有对${species === 'dog' ? '狗狗' : '猫咪'}极具危害的成分：${item.danger}`;
        return {
          isForbidden: true,
          item: { name: item.name, danger: item.danger },
          matchedItems: matched,
          warningMessage: warning,
        };
      }
    }
  }

  // 跨物种通用高危检测（巧克力、木糖醇、洋葱）
  const crossList = [
    { kw: '巧克力', name: '巧克力', danger: '对猫狗均具有致命神经与心脏毒性！' },
    { kw: '木糖醇', name: '木糖醇', danger: '会导致剧烈低血糖休克与急性肝衰竭！' },
    { kw: '洋葱', name: '洋葱', danger: '导致红细胞破裂与致命性溶血性贫血！' },
    { kw: '葡萄', name: '葡萄/葡萄干', danger: '造成不可逆的急性肾脏衰竭！' },
  ];
  for (const c of crossList) {
    if (text.includes(c.kw)) {
      const matched = [{ name: c.name, danger: c.danger }];
      const warning = `【${c.name}】对动物具有致命危害：${c.danger}`;
      return {
        isForbidden: true,
        item: { name: c.name, danger: c.danger },
        matchedItems: matched,
        warningMessage: warning,
      };
    }
  }

  return { isForbidden: false, matchedItems: [], warningMessage: '' };
}

/**
 * 别名兼容
 */
export const generateAIFeedingRecommendation = generateAIFeedingSuggestion;

/**
 * AI 投喂建议计算引擎
 * 根据动物特征：物种、体型、预估年龄、健康状态（生病/术后/幼崽/孕期/绝育等）
 * 输出精准的每日建议食物、投喂克数、频次、时间段及保守风险提示
 */
export function generateAIFeedingSuggestion(pet: Partial<Pet>): Omit<FeedingPlan, 'id' | 'pet_id' | 'status' | 'confirmed_by' | 'confirmed_at'> {
  const species = pet.species || 'cat';
  const name = pet.name || '毛孩子';
  const isNeutered = !!pet.is_neutered;

  // 综合识别特征标签中的健康与阶段状态
  const allText = `${pet.personality_tags?.join(' ') || ''} ${pet.coat_color || ''}`.toLowerCase();
  const isSick = allText.includes('病') || allText.includes('藓') || allText.includes('炎') || allText.includes('咳嗽') || allText.includes('外伤') || allText.includes('骨折');
  const isPostOp = allText.includes('术后') || allText.includes('刚绝育') || allText.includes('康复') || allText.includes('缝合');
  const isBaby = allText.includes('幼') || allText.includes('奶') || allText.includes('小奶猫') || allText.includes('小奶狗') || allText.includes('三个月') || allText.includes('两月') || allText.includes('未成年');
  const isPregnant = allText.includes('孕') || allText.includes('怀孕') || allText.includes('哺乳') || allText.includes('带崽');
  const isSenior = allText.includes('老') || allText.includes('高龄') || allText.includes('八岁') || allText.includes('七岁');

  let dailyAmountGrams = 60;
  let feedTimes = 2;
  let recommendedFoods: string[] = [];
  let timeSlots: string[] = ['早间 07:30 - 09:00', '傍晚 17:30 - 19:30'];
  let riskNotes = '';
  const forbiddenFoods: string[] = species === 'dog'
    ? ['巧克力与可可', '葡萄及葡萄干', '洋葱大蒜大葱', '木糖醇口香糖', '夏威夷果坚果', '熟禽类骨头骨渣', '人吃高油盐剩饭']
    : ['巧克力与咖啡因', '洋葱大蒜及葱类', '葡萄与葡萄干', '百合花任何部位', '木糖醇及代糖', '尖锐鸡骨鱼骨', '人类剩菜重油盐', '纯牛奶(乳糖不耐)'];

  if (species === 'cat') {
    // 猫咪基础量：55g
    if (isBaby) {
      dailyAmountGrams = 45;
      feedTimes = 4;
      recommendedFoods = ['幼猫全价奶糕粮 (温水泡软)', '幼猫慕斯主食罐', '宠物专用羊奶粉'];
      timeSlots = ['晨间 07:30 - 08:30', '午间 12:00 - 13:00', '傍晚 17:30 - 18:30', '夜间 21:00 - 22:00'];
      riskNotes = '⚠️【幼崽风险提示】消化器官极为脆弱，必须严格少食多餐（温水泡软），严禁硬颗粒膨化粮、冻干与牛奶！';
    } else if (isPostOp) {
      dailyAmountGrams = 40;
      feedTimes = 3;
      recommendedFoods = ['术后恢复期处方主食罐', '温热鸡肉慕斯流食', '清淡电解质温水'];
      timeSlots = ['清晨 08:00 - 09:00', '午后 13:00 - 14:00', '傍晚 18:00 - 19:00'];
      riskNotes = '🚨【术后恢复期特殊警告】手术或麻醉后肠道平滑肌恢复缓慢，喂食量需保守减少30%，禁止零食与刺激性食物，投喂后密切观察排便！';
    } else if (isSick) {
      dailyAmountGrams = 45;
      feedTimes = 3;
      recommendedFoods = ['胃肠道处方猫粮', '高消化率主食肉泥罐', '适量清洁温水'];
      timeSlots = ['早间 08:00 - 09:00', '午后 12:30 - 13:30', '傍晚 18:00 - 19:00'];
      riskNotes = '⚠️【生病观察期提示】当前身体状态欠佳，请以清淡高易消化流质或处方湿粮为主，避免过度打扰投喂。';
    } else if (isPregnant) {
      dailyAmountGrams = 80;
      feedTimes = 3;
      recommendedFoods = ['母幼全价猫粮', '孕产期高钙高蛋白主食罐', '纯鸡肉蒸肉泥 (不加盐)'];
      timeSlots = ['早晨 07:30 - 09:00', '午间 12:30 - 13:30', '晚间 18:00 - 19:30'];
      riskNotes = '🍼【孕产哺乳期提示】热量消耗巨大，可适当增加优质蛋白与高钙食物，保障母幼体质。';
    } else if (isNeutered) {
      dailyAmountGrams = 55;
      feedTimes = 2;
      recommendedFoods = ['成年全价绝育猫粮 (控制脂肪与淀粉)', '高蛋白主食猫罐头', '新鲜蒸鸡胸肉碎'];
      timeSlots = ['晨间 07:30 - 09:00', '傍晚 17:30 - 19:30'];
      riskNotes = '💡【绝育后维持提示】绝育后代谢率轻微下降，建议控制单日碳水摄入，避免体重超重引发泌尿系疾病。';
    } else {
      dailyAmountGrams = 65;
      feedTimes = 2;
      recommendedFoods = ['全价成年猫粮', '无谷主食猫罐', '纯肉冻干复水'];
      timeSlots = ['晨间 07:30 - 09:00', '傍晚 17:30 - 19:30'];
      riskNotes = '🐾【健康成猫】建议按早晚分次投喂，保持投喂器皿干净卫生。';
    }
  } else {
    // 狗狗基础量
    if (isBaby) {
      dailyAmountGrams = 90;
      feedTimes = 3;
      recommendedFoods = ['幼犬奶糕粮 (温水泡软)', '幼犬主食肉罐', '宠物羊奶'];
      timeSlots = ['早晨 08:00 - 09:00', '中午 12:30 - 13:30', '傍晚 18:00 - 19:00'];
      riskNotes = '⚠️【幼犬喂食风险】消化功能尚未发育成熟，切勿喂食大颗粒干粮及人类食物。';
    } else if (isSick || isPostOp) {
      dailyAmountGrams = 120;
      feedTimes = 3;
      recommendedFoods = ['肠道调理全价狗粮', '术后康复肉泥流质罐', '清洁温水'];
      timeSlots = ['早间 08:00 - 09:00', '午间 13:00 - 14:00', '傍晚 18:00 - 19:00'];
      riskNotes = '🚨【生病/术后特殊警示】限制脂肪含量，投喂量降低，务必补充足量干净水源！';
    } else if (isNeutered) {
      dailyAmountGrams = 160;
      feedTimes = 2;
      recommendedFoods = ['全价绝育犬粮', '低脂主食罐头', '水煮胡萝卜鸡肉粒'];
      timeSlots = ['早间 07:30 - 09:00', '傍晚 17:30 - 19:30'];
      riskNotes = '💡【绝育犬提示】防过度肥胖，定时定量投喂，投喂后鼓励适度散步运动。';
    } else {
      dailyAmountGrams = 180;
      feedTimes = 2;
      recommendedFoods = ['全价成年犬粮', '全价主食肉罐', '水煮鸡肉块'];
      timeSlots = ['早间 07:30 - 09:00', '傍晚 17:30 - 19:30'];
      riskNotes = '🐾【健康成年犬】建议每天早晚各一次定量投放，避免暴饮暴食。';
    }
  }

  return {
    daily_amount_grams: dailyAmountGrams,
    feed_times_per_day: feedTimes,
    recommended_foods: recommendedFoods,
    feeding_time_slots: timeSlots,
    forbidden_foods: forbiddenFoods,
    risk_notes: riskNotes,
    ai_suggestion_raw: {
      generated_at: new Date().toISOString(),
      species,
      pet_name: name,
      factors: { isNeutered, isSick, isPostOp, isBaby, isPregnant, isSenior },
      disclaimer: '此建议由校园动协守护 AI 算法依据物种与生理特征推算，仅作为参考草案，须经动协管理员审核确认后正式生效。',
    },
  };
}

/**
 * 计算今日投喂进度与状态
 */
export function getFeedingProgressStatus(
  todayGrams: number,
  dailyTargetGrams: number
): {
  percentage: number;
  remainingGrams: number;
  isReached: boolean;
  isOverfed: boolean;
  statusLabel: '未投喂' | '适量正常' | '已达标' | '超量预警';
  tipMessage: string;
  badgeVariant: 'secondary' | 'default' | 'destructive' | 'outline';
} {
  const target = Math.max(dailyTargetGrams || 60, 20);
  const percentage = Math.min(Math.round((todayGrams / target) * 100), 200);
  const remainingGrams = Math.max(target - todayGrams, 0);

  if (todayGrams === 0) {
    return {
      percentage: 0,
      remainingGrams: target,
      isReached: false,
      isOverfed: false,
      statusLabel: '未投喂',
      tipMessage: '今日尚未记录投喂打卡，可按建议时段前往投喂～',
      badgeVariant: 'outline',
    };
  }

  if (todayGrams < target) {
    return {
      percentage,
      remainingGrams,
      isReached: false,
      isOverfed: false,
      statusLabel: '适量正常',
      tipMessage: `今日已适量投喂 ${todayGrams}g，剩余还可投喂约 ${remainingGrams}g。`,
      badgeVariant: 'secondary',
    };
  }

  if (todayGrams === target || todayGrams <= Math.round(target * 1.15)) {
    return {
      percentage,
      remainingGrams: 0,
      isReached: true,
      isOverfed: false,
      statusLabel: '已达标',
      tipMessage: '今日该动物已达到建议投喂量，请勿重复投喂！建议改为记录观察或补充清洁饮水。',
      badgeVariant: 'default',
    };
  }

  // 超过 115% 阈值
  return {
    percentage,
    remainingGrams: 0,
    isReached: true,
    isOverfed: true,
    statusLabel: '超量预警',
    tipMessage: '⚠️【超量警告】今日累计投喂已明显超标！过量喂食易引发急性肠胃炎与胰腺炎，请严禁继续投喂，改为上报健康异常或观察！',
    badgeVariant: 'destructive',
  };
}
