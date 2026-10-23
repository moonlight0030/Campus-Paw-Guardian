import { supabase } from '@/db/supabase';
import type {
  Pet, PetInput, Comment, AppNotification, PetStats, Species, AdoptionInput, FeedingRecord, PublicProfile,
  Sighting, SightingInput, SightingWithPet,
} from '@/types/types';

const PAGE_SIZE = 12;

const safeArray = <T>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);

/** 获取萌宠列表（搜索 + 物种筛选 + 分页） */
export async function fetchPets(params: {
  search?: string;
  species?: 'all' | Species;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Pet[]; total: number }> {
  const page = params.page ?? 0;
  const pageSize = params.pageSize ?? PAGE_SIZE;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('pets')
    .select('*, author:public_profiles!pets_author_id_fkey(*)', { count: 'exact' });

  if (params.species && params.species !== 'all') {
    query = query.eq('species', params.species);
  }
  if (params.search && params.search.trim()) {
    const kw = params.search.trim();
    query = query.or(`name.ilike.%${kw}%,location_name.ilike.%${kw}%`);
  }

  const { data, count, error } = await query
    .order('discovered_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { items: safeArray<Pet>(data), total: count ?? 0 };
}

/** 获取单个萌宠详情 */
export async function fetchPetById(id: string): Promise<Pet | null> {
  const { data, error } = await supabase
    .from('pets')
    .select('*, author:public_profiles!pets_author_id_fkey(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Pet) ?? null;
}

/** 新增萌宠档案 */
export async function createPet(input: PetInput): Promise<string> {
  const { data, error } = await supabase
    .from('pets')
    .insert(input)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** 更新萌宠档案 */
export async function updatePet(id: string, input: Partial<PetInput>): Promise<void> {
  const { error } = await supabase.from('pets').update(input).eq('id', id);
  if (error) throw error;
}

/** 删除萌宠档案 */
export async function deletePet(id: string): Promise<void> {
  const { error } = await supabase.from('pets').delete().eq('id', id);
  if (error) throw error;
}

/** 获取当前用户发布的萌宠档案 */
export async function fetchMyPets(userId: string): Promise<Pet[]> {
  const { data, error } = await supabase
    .from('pets')
    .select('*, author:public_profiles!pets_author_id_fkey(*)')
    .eq('author_id', userId)
    .order('discovered_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return safeArray<Pet>(data);
}

/** 获取用户收藏的萌宠列表 */
export async function fetchFavorites(userId: string): Promise<Pet[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('pet:pets!favorites_pet_id_fkey(*, author:public_profiles!pets_author_id_fkey(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return safeArray<{ pet: Pet }>(data).map((row) => row.pet).filter(Boolean);
}

/** 获取用户已收藏的萌宠 id 集合 */
export async function fetchFavoriteIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('favorites')
    .select('pet_id')
    .eq('user_id', userId)
    .limit(500);
  if (error) throw error;
  return new Set(safeArray<{ pet_id: string }>(data).map((r) => r.pet_id));
}

/** 收藏萌宠 */
export async function addFavorite(petId: string): Promise<void> {
  const { error } = await supabase.from('favorites').insert({ pet_id: petId });
  if (error) throw error;
}

/** 取消收藏 */
export async function removeFavorite(petId: string): Promise<void> {
  const { error } = await supabase.from('favorites').delete().eq('pet_id', petId);
  if (error) throw error;
}

/** 获取萌宠评论列表 */
export async function fetchComments(petId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, author:public_profiles!comments_user_id_fkey(*)')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return safeArray<Comment>(data);
}

/** 发表评论 */
export async function createComment(petId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .insert({ pet_id: petId, content: content.trim() });
  if (error) throw error;
}

/** 提交领养申请 */
export async function createAdoption(input: Omit<AdoptionInput, 'pet_id'> & { petId: string }): Promise<void> {
  const { error } = await supabase.from('adoptions').insert({
    pet_id: input.petId,
    applicant_name: input.applicant_name.trim(),
    contact: input.contact.trim(),
    housing: input.housing,
    experience: input.experience,
    reason: input.reason.trim(),
  });
  if (error) throw error;
}

/** 获取萌宠投喂打卡记录 */
export async function fetchFeedings(petId: string): Promise<FeedingRecord[]> {
  const { data, error } = await supabase
    .from('feedings')
    .select('*, author:public_profiles!feedings_user_id_fkey(*)')
    .eq('pet_id', petId)
    .order('fed_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return safeArray<FeedingRecord>(data);
}

export interface CreateFeedingParams {
  petId: string;
  food: string;
  fedAt?: string;
  amountGrams?: number;
  foodType?: string;
  photoUrl?: string | null;
  location?: string | null;
  isPlanned?: boolean;
  isForbidden?: boolean;
  status?: 'normal' | 'warning' | 'overfed' | 'forbidden';
  warningNotes?: string | null;
}

/** 提交投喂打卡（支持结构化参数与旧版兼容调用） */
export async function createFeeding(
  arg1: string | CreateFeedingParams,
  arg2?: string,
  arg3?: string
): Promise<void> {
  if (typeof arg1 === 'object') {
    const { error } = await supabase.from('feedings').insert({
      pet_id: arg1.petId,
      food: arg1.food.trim(),
      amount_grams: arg1.amountGrams ?? 50,
      food_type: arg1.foodType ?? 'dry_food',
      photo_url: arg1.photoUrl || null,
      location: arg1.location || null,
      is_planned: arg1.isPlanned ?? true,
      is_forbidden: arg1.isForbidden ?? false,
      status: arg1.status || 'normal',
      warning_notes: arg1.warningNotes || null,
      ...(arg1.fedAt ? { fed_at: arg1.fedAt } : {}),
    });
    if (error) throw error;
    return;
  }

  // 兼容旧签名 (petId, food, fedAt)
  const { error } = await supabase.from('feedings').insert({
    pet_id: arg1,
    food: (arg2 || '').trim(),
    amount_grams: 50,
    ...(arg3 ? { fed_at: arg3 } : {}),
  });
  if (error) throw error;
}

/** 获取指定动物的每日投喂计划 */
export async function fetchFeedingPlan(petId: string): Promise<import('@/types/types').FeedingPlan | null> {
  const { data, error } = await supabase
    .from('feeding_plans')
    .select('*')
    .eq('pet_id', petId)
    .maybeSingle();
  if (error) {
    console.error('获取投喂计划失败:', error);
    return null;
  }
  return data as import('@/types/types').FeedingPlan | null;
}

/** 保存或生成 AI 建议的投喂计划草案（状态为 pending_review，不直接生效） */
export async function saveAIFeedingPlan(
  petId: string,
  plan: Partial<import('@/types/types').FeedingPlan>
): Promise<import('@/types/types').FeedingPlan> {
  const payload = {
    pet_id: petId,
    status: 'pending_review',
    daily_amount_grams: plan.daily_amount_grams ?? 60,
    feed_times_per_day: plan.feed_times_per_day ?? 2,
    recommended_foods: plan.recommended_foods ?? ['全价成年粮', '主食罐头'],
    feeding_time_slots: plan.feeding_time_slots ?? ['早间 07:30 - 09:00', '傍晚 17:30 - 19:30'],
    forbidden_foods: plan.forbidden_foods ?? ['巧克力', '洋葱大蒜', '葡萄', '木糖醇'],
    risk_notes: plan.risk_notes ?? '',
    ai_suggestion_raw: plan.ai_suggestion_raw ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('feeding_plans')
    .upsert(payload, { onConflict: 'pet_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as import('@/types/types').FeedingPlan;
}

/** 管理员确认并发布每日投喂计划（状态更新为 confirmed，正式生效） */
export async function confirmFeedingPlan(
  petId: string,
  plan: Partial<import('@/types/types').FeedingPlan>,
  adminUserId: string
): Promise<import('@/types/types').FeedingPlan> {
  const payload = {
    pet_id: petId,
    status: 'confirmed',
    daily_amount_grams: plan.daily_amount_grams ?? 60,
    feed_times_per_day: plan.feed_times_per_day ?? 2,
    recommended_foods: plan.recommended_foods ?? ['全价成年粮', '主食罐头'],
    feeding_time_slots: plan.feeding_time_slots ?? ['早间 07:30 - 09:00', '傍晚 17:30 - 19:30'],
    forbidden_foods: plan.forbidden_foods ?? ['巧克力', '洋葱大蒜', '葡萄', '木糖醇'],
    risk_notes: plan.risk_notes ?? '',
    ai_suggestion_raw: plan.ai_suggestion_raw ?? null,
    confirmed_by: adminUserId,
    confirmed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('feeding_plans')
    .upsert(payload, { onConflict: 'pet_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as import('@/types/types').FeedingPlan;
}

/** 获取动物今日已投喂量与额度统计 */
export async function fetchPetTodayFeedingStats(
  petId: string,
  dailyTargetGrams: number = 60
): Promise<import('@/types/types').PetTodayFeedingStats> {
  try {
    const { data, error } = await supabase.rpc('get_pet_today_feeding_stats', {
      p_pet_id: petId,
    });
    if (!error && data) {
      const todayGrams = Number(data.today_grams || 0);
      const todayCount = Number(data.today_count || 0);
      const overfedCount = Number(data.overfed_count || 0);
      const forbiddenCount = Number(data.forbidden_count || 0);
      const remainingGrams = Math.max(dailyTargetGrams - todayGrams, 0);
      const isReached = todayGrams >= dailyTargetGrams;
      const isOverfed = todayGrams > Math.round(dailyTargetGrams * 1.15) || overfedCount > 0;

      let statusLabel: '未投喂' | '适量正常' | '已达标' | '超量预警' = '未投喂';
      if (isOverfed) statusLabel = '超量预警';
      else if (isReached) statusLabel = '已达标';
      else if (todayGrams > 0) statusLabel = '适量正常';

      return {
        today_grams: todayGrams,
        today_count: todayCount,
        overfed_count: overfedCount,
        forbidden_count: forbiddenCount,
        daily_target_grams: dailyTargetGrams,
        remaining_grams: remainingGrams,
        is_reached: isReached,
        is_overfed: isOverfed,
        status_label: statusLabel,
      };
    }
  } catch (err) {
    console.warn('RPC统计失败，降级客户端查询:', err);
  }

  // 降级客户端查询计算
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: records } = await supabase
    .from('feedings')
    .select('amount_grams, status, is_forbidden')
    .eq('pet_id', petId)
    .gte('fed_at', startOfDay.toISOString());

  const list = records || [];
  const todayGrams = list.reduce((sum, r) => sum + (r.amount_grams ?? 50), 0);
  const todayCount = list.length;
  const overfedCount = list.filter((r) => r.status === 'overfed' || r.status === 'warning').length;
  const forbiddenCount = list.filter((r) => r.is_forbidden).length;
  const remainingGrams = Math.max(dailyTargetGrams - todayGrams, 0);
  const isReached = todayGrams >= dailyTargetGrams;
  const isOverfed = todayGrams > Math.round(dailyTargetGrams * 1.15) || overfedCount > 0;

  let statusLabel: '未投喂' | '适量正常' | '已达标' | '超量预警' = '未投喂';
  if (isOverfed) statusLabel = '超量预警';
  else if (isReached) statusLabel = '已达标';
  else if (todayGrams > 0) statusLabel = '适量正常';

  return {
    today_grams: todayGrams,
    today_count: todayCount,
    overfed_count: overfedCount,
    forbidden_count: forbiddenCount,
    daily_target_grams: dailyTargetGrams,
    remaining_grams: remainingGrams,
    is_reached: isReached,
    is_overfed: isOverfed,
    status_label: statusLabel,
  };
}

/** 获取全部动物的每日投喂计划列表（包含动物基础信息） */
export async function fetchAllFeedingPlans(): Promise<any[]> {
  const { data, error } = await supabase
    .from('feeding_plans')
    .select('*, pet:pets(id, name, species, photo_url, location_name, is_neutered, personality_tags)')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('获取所有计划失败:', error);
    return [];
  }
  return data || [];
}

/** 获取管理后台投喂监督与异常投喂审计数据 */
export async function fetchFeedingAudits(): Promise<{
  allRecords: import('@/types/types').FeedingRecord[];
  abnormalRecords: import('@/types/types').FeedingRecord[];
  todayRecords: import('@/types/types').FeedingRecord[];
  totalTodayGrams: number;
  totalTodayFeeds: number;
  repeatFeedCount: number;
  forbiddenFeedCount: number;
}> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('feedings')
    .select('*, author:public_profiles!feedings_user_id_fkey(*), pet:pets(id, name, species, photo_url, location_name)')
    .order('fed_at', { ascending: false })
    .limit(300);

  if (error) throw error;
  const allRecords = (data || []) as import('@/types/types').FeedingRecord[];

  const todayRecords = allRecords.filter(
    (r) => new Date(r.fed_at).getTime() >= startOfDay.getTime()
  );

  const abnormalRecords = allRecords.filter(
    (r) => r.is_forbidden || r.status === 'forbidden' || r.status === 'overfed' || r.status === 'warning'
  );

  const totalTodayGrams = todayRecords.reduce((sum, r) => sum + (r.amount_grams ?? 50), 0);
  const totalTodayFeeds = todayRecords.length;

  // 统计同一动物今日被投喂 >= 2 次的重复投喂行为
  const petTodayCountMap = new Map<string, number>();
  for (const r of todayRecords) {
    petTodayCountMap.set(r.pet_id, (petTodayCountMap.get(r.pet_id) || 0) + 1);
  }
  let repeatFeedCount = 0;
  for (const count of petTodayCountMap.values()) {
    if (count >= 2) repeatFeedCount += count - 1;
  }

  const forbiddenFeedCount = allRecords.filter((r) => r.is_forbidden).length;

  return {
    allRecords,
    abnormalRecords,
    todayRecords,
    totalTodayGrams,
    totalTodayFeeds,
    repeatFeedCount,
    forbiddenFeedCount,
  };
}

/** 智能问答：调用 AI 对话 Edge Function（支持文本与图片多轮对话） */
export async function sendChat(
  history: { role: 'user' | 'assistant'; content: string; imageUrl?: string }[]
): Promise<string> {
  // 带图片的用户消息转为多模态 content；纯文本消息保持原样
  const messages = history.map((m) => {
    if (m.role === 'user' && m.imageUrl) {
      return {
        role: 'user',
        content: [
          { type: 'text', text: m.content || '请帮我看看这只动物的健康状况' },
          { type: 'image_url', image_url: { url: m.imageUrl } },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
  const { data, error } = await supabase.functions.invoke('ai-chat', { body: { messages } });
  if (error) throw error;
  const payload = data as { content?: string; error?: string };
  if (payload.error || typeof payload.content !== 'string' || !payload.content) {
    throw new Error(payload.error || 'AI 返回异常');
  }
  return payload.content;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRecord {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url: string | null;
  created_at: string;
}

const toHex = (s: string): string =>
  Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');

/** 上传对话图片到 Storage，返回公开 URL */
export async function uploadChatImage(userId: string, file: File): Promise<string> {
  const dot = file.name.lastIndexOf('.');
  const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
  const ext = dot > 0 ? file.name.slice(dot) : '.jpg';
  const safeName = `${toHex(stem)}${ext}`;
  const { data, error } = await supabase.storage
    .from('chat-images')
    .upload(`${userId}/${Date.now()}_${safeName}`, file, { contentType: file.type });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(data.path);
  return urlData.publicUrl;
}

/** 创建新会话，返回会话 id */
export async function createChatSession(userId: string, title: string): Promise<string> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: userId, title: title.slice(0, 50) || '新对话' })
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('创建会话失败');
  return data.id as string;
}

/** 获取当前账号的会话列表（按最近更新倒序） */
export async function fetchChatSessions(userId: string): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, user_id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return Array.isArray(data) ? (data as ChatSession[]) : [];
}

/** 获取指定会话的消息列表（按时间正序） */
export async function fetchChatMessages(sessionId: string): Promise<ChatMessageRecord[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, session_id, user_id, role, content, image_url, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return Array.isArray(data) ? (data as ChatMessageRecord[]) : [];
}

/** 追加一条消息到会话 */
export async function appendChatMessage(
  sessionId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  imageUrl: string | null
): Promise<void> {
  const { error } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role,
    content,
    image_url: imageUrl,
  });
  if (error) throw error;
}

/** 更新会话的最近活跃时间 */
export async function touchChatSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

/** 删除会话（级联删除其消息） */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

/** 更新当前登录用户的最近活跃时间（用于在线状态展示） */
export async function touchLastSeen(): Promise<void> {
  const { error } = await supabase.rpc('touch_last_seen');
  if (error) throw error;
}

/** 获取已注册的守护者（用户）列表，含在线状态信息 */
export async function fetchGuardians(): Promise<PublicProfile[]> {
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, nickname, avatar_url, role, last_seen_at')
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return Array.isArray(data) ? (data as PublicProfile[]) : [];
}

/** 获取已注册的守护者（用户）总数 */
export async function fetchGuardiansCount(): Promise<number> {
  const { count, error } = await supabase
    .from('public_profiles')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error('获取守护者数量失败', error);
    // 降级：拉取列表计算长度
    const list = await fetchGuardians();
    return list.length;
  }
  return count ?? 0;
}

/** 实时监听已注册守护者（profiles）数据变更
 *  每个调用方需传入唯一 id，避免复用同名 channel 导致 "cannot add callbacks after subscribe" 报错 */
export function subscribeGuardians(onChange: () => void, id: string): () => void {
  const channel = supabase
    .channel(`guardians_realtime_changes_${id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** 获取消息通知 */
export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, actor:public_profiles!notifications_actor_id_fkey(*)')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return safeArray<AppNotification>(data);
}

/** 获取未读消息数量 */
export async function fetchUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);
    if (error) throw error;
    return count ?? 0;
  } catch (e) {
    // 网络波动等情况下静默降级，避免未捕获的异常冒泡到全局错误监控
    console.error('获取未读消息数失败', e);
    return 0;
  }
}

/** 标记单条消息已读 */
export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

/** 标记全部已读 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

/** 获取统计数据 */
export async function fetchStats(): Promise<PetStats> {
  const { data, error } = await supabase
    .from('pets')
    .select('species, is_neutered, location_name, author_id')
    .limit(1000);
  if (error) throw error;
  const rows = safeArray<{ species: Species; is_neutered: boolean; location_name: string; author_id: string }>(data);
  const total = rows.length;
  const catCount = rows.filter((r) => r.species === 'cat').length;
  const dogCount = rows.filter((r) => r.species === 'dog').length;
  const neuteredCount = rows.filter((r) => r.is_neutered).length;
  const guardianCount = new Set(rows.map((r) => r.author_id)).size;

  const locMap = new Map<string, number>();
  for (const r of rows) {
    locMap.set(r.location_name, (locMap.get(r.location_name) ?? 0) + 1);
  }
  const locationDistribution = Array.from(locMap.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total,
    catCount,
    dogCount,
    neuteredCount,
    neuteredRate: total > 0 ? Math.round((neuteredCount / total) * 100) : 0,
    guardianCount,
    locationDistribution,
  };
}

/** 获取某动物的所有目击记录（按时间倒序） */
export async function fetchSightingsByPetId(petId: string): Promise<Sighting[]> {
  const { data, error } = await supabase
    .from('sightings')
    .select('*')
    .eq('pet_id', petId)
    .order('sighted_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('获取目击记录失败:', error);
    return [];
  }
  return safeArray<Sighting>(data);
}

/** 提交目击记录打卡 */
export async function createSighting(input: SightingInput): Promise<Sighting> {
  const { data, error } = await supabase
    .from('sightings')
    .insert([
      {
        pet_id: input.pet_id,
        location: input.location.trim(),
        sighted_at: input.sighted_at,
        recorder_name: input.recorder_name?.trim() || null,
        notes: input.notes?.trim() || null,
        photo_url: input.photo_url || null,
        user_id: input.user_id || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as Sighting;
}

/** 获取所有动物的简略列表，供打卡弹窗选择 */
export async function fetchAllPetsSimple(): Promise<Array<{ id: string; name: string; species: Species; photo_url: string; location_name: string }>> {
  const { data, error } = await supabase
    .from('pets')
    .select('id, name, species, photo_url, location_name')
    .order('name', { ascending: true })
    .limit(500);

  if (error) {
    console.error('获取动物列表简略数据失败:', error);
    return [];
  }
  return safeArray<{ id: string; name: string; species: Species; photo_url: string; location_name: string }>(data);
}

/** 获取所有目击记录（支持按时间筛选：7天/30天/全部），并关联动物信息，供活动地图使用 */
export async function fetchSightingsWithPets(daysLimit?: number): Promise<SightingWithPet[]> {
  let query = supabase
    .from('sightings')
    .select('*, pet:pets(id, name, species, photo_url, location_name)')
    .order('sighted_at', { ascending: false });

  if (daysLimit && daysLimit > 0) {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - daysLimit);
    query = query.gte('sighted_at', dateLimit.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error('获取目击关联记录失败:', error);
    return [];
  }

  const items = safeArray<any>(data);
  return items.map((item) => ({
    ...item,
    location: item.location || item.location_name || '未命名地点',
    recorder_name: item.recorder_name || item.reporter_name || '热心同学',
    notes: item.notes || item.remark || '',
  })) as SightingWithPet[];
}

/** 上传萌宠照片 */
export async function uploadPetPhoto(userId: string, file: File): Promise<string> {
  const toHex = (s: string) =>
    Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');
  const dot = file.name.lastIndexOf('.');
  const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
  const ext = dot > 0 ? file.name.slice(dot) : '';
  const safeName = `${toHex(stem)}${ext}`;
  const path = `${userId}/${safeName}`;

  const { data, error } = await supabase.storage
    .from('pet-photos')
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('pet-photos').getPublicUrl(data.path);
  return urlData.publicUrl;
}

/** 上传目击现场照片 */
export async function uploadSightingPhoto(userId: string, file: File): Promise<string> {
  const toHex = (s: string) =>
    Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');
  const dot = file.name.lastIndexOf('.');
  const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
  const ext = dot > 0 ? file.name.slice(dot) : '';
  const safeName = `${toHex(stem)}${ext}`;
  const path = `${userId}/${safeName}`;

  const { data, error } = await supabase.storage
    .from('sighting-photos')
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('sighting-photos').getPublicUrl(data.path);
  return urlData.publicUrl;
}

/** 查询校园天气信息（通过 district-weather Edge Function） */
export async function fetchCampusWeather(districtId = '110108'): Promise<import('@/types/types').CampusWeatherData> {
  const { data, error } = await supabase.functions.invoke('district-weather', {
    body: { district_id: districtId, data_type: 'all' },
  });
  if (error) throw error;
  if (data?.status !== 0 && data?.error) {
    throw new Error(data.error || '获取天气数据失败');
  }
  return (data.result || data) as import('@/types/types').CampusWeatherData;
}

/** 管理员：获取成员列表 */
export async function fetchMembers(filter?: { keyword?: string; role?: 'all' | 'user' | 'admin' }): Promise<import('@/types/types').MemberProfile[]> {
  let query = supabase
    .from('profiles')
    .select('id, email, phone, nickname, role, avatar_url, created_at, last_seen_at')
    .order('created_at', { ascending: false });

  if (filter?.role && filter.role !== 'all') {
    query = query.eq('role', filter.role);
  }

  const { data, error } = await query;
  if (error) throw error;

  let list = (data || []) as import('@/types/types').MemberProfile[];
  if (filter?.keyword) {
    const kw = filter.keyword.trim().toLowerCase();
    list = list.filter(
      (m) =>
        (m.email && m.email.toLowerCase().includes(kw)) ||
        (m.nickname && m.nickname.toLowerCase().includes(kw))
    );
  }
  return list;
}

/** 管理员：调用安全 RPC 修改用户角色（服务端校验 admin 身份、防降级最后 admin、防降级自己，并自动记录审计日志） */
export async function changeUserRole(targetUserId: string, newRole: 'user' | 'admin'): Promise<void> {
  const { data, error } = await supabase.rpc('change_user_role', {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  });
  if (error) {
    throw new Error(error.message || '修改角色失败');
  }
}

/** 管理员：获取管理员操作日志 */
export async function fetchAdminAuditLogs(): Promise<import('@/types/types').AdminAuditLog[]> {
  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []) as import('@/types/types').AdminAuditLog[];
}

/** 管理员：获取所有目击记录（支持按状态筛选） */
export async function fetchAllSightings(status?: 'all' | 'pending' | 'confirmed'): Promise<import('@/types/types').SightingWithPet[]> {
  let query = supabase
    .from('sightings')
    .select('*, pet:pets(id, name, photo_url, species)')
    .order('sighted_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as import('@/types/types').SightingWithPet[];
}

/** 统一安全发送应用内消息通知 */
export async function sendAppNotification(params: {
  recipientId: string;
  type: import('@/types/types').NotificationType;
  actorId?: string;
  petId?: string;
  petName?: string;
  message: string;
}): Promise<void> {
  const { error } = await supabase.rpc('send_app_notification', {
    p_recipient_id: params.recipientId,
    p_type: params.type,
    p_actor_id: params.actorId || null,
    p_pet_id: params.petId || null,
    p_pet_name: params.petName || '校园萌宠',
    p_message: params.message,
  });
  if (error) {
    console.error('发送通知失败:', error);
  }
}

/** 管理员：确认目击记录（支持给上报人发送通知反馈） */
export async function confirmSighting(
  sightingId: string,
  extra?: { targetUserId?: string | null; petId?: string | null; petName?: string | null; location?: string | null; adminId?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('sightings')
    .update({ status: 'confirmed' })
    .eq('id', sightingId);
  if (error) throw error;

  // 若上报人存在，通过通知反馈结果
  if (extra?.targetUserId) {
    await sendAppNotification({
      recipientId: extra.targetUserId,
      type: 'sighting',
      actorId: extra.adminId || undefined,
      petId: extra.petId || undefined,
      petName: extra.petName || '校园萌宠',
      message: `🎉【目击打卡已通过】感谢同学！您在「${extra.location || '校园某处'}」遇见的毛孩子打卡照片已通过管理员审核，现已正式收录展示！`,
    });
  }
}

/** 管理员：合并目击记录到指定的已有档案 */
export async function mergeSightingToPet(sightingId: string, targetPetId: string): Promise<void> {
  const { error } = await supabase
    .from('sightings')
    .update({ pet_id: targetPetId, status: 'confirmed' })
    .eq('id', sightingId);
  if (error) throw error;
}

/** 管理员：根据目击记录快速新建萌宠档案并关联合并 */
export async function createPetFromSighting(
  sightingId: string,
  petPayload: Omit<import('@/types/types').PetInput, 'author_id'>,
  userId: string
): Promise<string> {
  const { data: newPet, error: createError } = await supabase
    .from('pets')
    .insert({
      ...petPayload,
      author_id: userId,
      status: 'published',
    })
    .select('id')
    .single();

  if (createError) throw createError;

  // 将此目击绑定到新档案
  const { error: updateError } = await supabase
    .from('sightings')
    .update({ pet_id: newPet.id, status: 'confirmed' })
    .eq('id', sightingId);

  if (updateError) throw updateError;
  return newPet.id;
}

/** 获取全部领养申请 */
export async function fetchAllAdoptions(): Promise<import('@/types/types').AdoptionItem[]> {
  const { data, error } = await supabase
    .from('adoptions')
    .select('*, pet:pets(id, name, photo_url, species, location_name), applicant:profiles!adoptions_user_id_fkey(id, email, nickname, avatar_url)')
    .order('created_at', { ascending: false });

  if (error) {
    // 兼容关联失败情况
    const { data: simpleData, error: err2 } = await supabase
      .from('adoptions')
      .select('*, pet:pets(id, name, photo_url, species, location_name)')
      .order('created_at', { ascending: false });
    if (err2) throw err2;
    return (simpleData || []) as import('@/types/types').AdoptionItem[];
  }
  return (data || []) as import('@/types/types').AdoptionItem[];
}

/** 管理员：审核领养申请（通过或拒绝），录入管理员答复并自动向申请人发送通知反馈 */
export async function reviewAdoption(params: {
  adoptionId: string;
  status: 'approved' | 'rejected';
  adminNotes?: string;
  reviewerId?: string;
  targetUserId?: string;
  petId?: string;
  petName?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('adoptions')
    .update({
      status: params.status,
      admin_notes: params.adminNotes || null,
      reviewed_at: new Date().toISOString(),
      reviewer_id: params.reviewerId || null,
    })
    .eq('id', params.adoptionId);
  if (error) throw error;

  // 向申请人发送消息通知
  if (params.targetUserId) {
    const isApproved = params.status === 'approved';
    const petTitle = params.petName || '萌宠';
    const notesText = params.adminNotes ? `\n管理员留言：${params.adminNotes}` : '';

    const msg = isApproved
      ? `🎉【领养申请通过】恭喜！您对「${petTitle}」的领养申请已审核通过！${notesText}\n请尽快保持手机/微信畅通，动协老师将与您预约线下家访与领养交接～`
      : `ℹ️【领养申请反馈】您对「${petTitle}」的领养申请未通过。${notesText}\n感谢您对校园流浪动物的善意与关注！`;

    await sendAppNotification({
      recipientId: params.targetUserId,
      type: 'adoption',
      actorId: params.reviewerId,
      petId: params.petId,
      petName: petTitle,
      message: msg,
    });
  }
}

/** 获取全校投喂记录流水 */
export async function fetchAllFeedings(): Promise<any[]> {
  const { data, error } = await supabase
    .from('feedings')
    .select('*, pet:pets(id, name, photo_url, species)')
    .order('fed_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

/** 管理员：获取举报列表 */
export async function fetchReports(): Promise<import('@/types/types').ReportItem[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as import('@/types/types').ReportItem[];
}

/** 管理员：处理举报（支持向举报人发送结果反馈通知） */
export async function handleReport(
  reportId: string,
  status: 'resolved' | 'dismissed',
  handleResult: string,
  adminUserId: string,
  extra?: { reporterId?: string; targetType?: string }
): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .update({
      status,
      handle_result: handleResult,
      handled_by: adminUserId,
      handled_at: new Date().toISOString(),
    })
    .eq('id', reportId);
  if (error) throw error;

  if (extra?.reporterId) {
    const isResolved = status === 'resolved';
    const msg = isResolved
      ? `📋【举报处理完毕】感谢同学监督！您提交的关于「${extra.targetType || '违规内容'}」的举报已被处理，处理答复：${handleResult}。`
      : `ℹ️【举报处理反馈】您提交的关于「${extra.targetType || '违规内容'}」的举报已被查验并驳回，答复：${handleResult}。`;

    await sendAppNotification({
      recipientId: extra.reporterId,
      type: 'report',
      actorId: adminUserId,
      message: msg,
    });
  }
}

/** 用户：提交举报 */
export async function submitReport(payload: {
  target_type: 'pet' | 'sighting' | 'comment' | 'feeding';
  target_id: string;
  target_title?: string;
  reason: string;
  description?: string;
  reporter_id: string;
  reporter_name?: string;
}): Promise<void> {
  const { error } = await supabase.from('reports').insert(payload);
  if (error) throw error;
}

/* ==========================================================================
   寻宠启事与线索打卡 API
   ========================================================================== */

/** 获取寻宠启事列表 */
export async function fetchLostPets(params?: {
  status?: 'all' | 'searching' | 'found' | 'closed';
  species?: 'all' | 'cat' | 'dog' | 'other';
  search?: string;
}): Promise<import('@/types/types').LostPet[]> {
  let query = supabase
    .from('lost_pets')
    .select('*, pet:pets(*)')
    .order('created_at', { ascending: false });

  if (params?.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }
  if (params?.species && params.species !== 'all') {
    query = query.eq('species', params.species);
  }

  const { data, error } = await query;
  if (error) {
    console.error('获取寻宠启事列表失败:', error);
    throw error;
  }

  let list = (data || []) as import('@/types/types').LostPet[];
  if (params?.search && params.search.trim()) {
    const kw = params.search.trim().toLowerCase();
    list = list.filter(
      (item) =>
        item.title?.toLowerCase().includes(kw) ||
        item.pet_name?.toLowerCase().includes(kw) ||
        item.lost_location?.toLowerCase().includes(kw) ||
        item.features?.toLowerCase().includes(kw)
    );
  }
  return list;
}

/** 根据 ID 获取寻宠启事详情并增加浏览量 */
export async function fetchLostPetById(id: string): Promise<import('@/types/types').LostPet | null> {
  const { data, error } = await supabase
    .from('lost_pets')
    .select('*, pet:pets(*)')
    .eq('id', id)
    .single();

  if (error) {
    console.error('获取寻宠启事详情失败:', error);
    return null;
  }

  // 异步增加浏览量
  if (data) {
    supabase
      .from('lost_pets')
      .update({ views_count: (data.views_count || 0) + 1 })
      .eq('id', id)
      .then();
  }

  return data as import('@/types/types').LostPet;
}

/** 创建寻宠启事 */
export async function createLostPet(
  userId: string,
  input: import('@/types/types').CreateLostPetInput
): Promise<import('@/types/types').LostPet> {
  const { data, error } = await supabase
    .from('lost_pets')
    .insert({
      user_id: userId,
      pet_id: input.pet_id || null,
      title: input.title,
      pet_name: input.pet_name,
      species: input.species || 'cat',
      breed: input.breed || null,
      gender: input.gender || 'unknown',
      color: input.color || null,
      features: input.features || null,
      lost_date: input.lost_date || new Date().toISOString(),
      lost_location: input.lost_location,
      contact_name: input.contact_name,
      contact_phone: input.contact_phone,
      reward_amount: input.reward_amount || null,
      description: input.description || null,
      photo_urls: input.photo_urls && input.photo_urls.length > 0 ? input.photo_urls : [],
      status: 'searching',
    })
    .select()
    .single();

  if (error) throw error;
  return data as import('@/types/types').LostPet;
}

/** 更新寻宠启事状态（如已找回、已关闭） */
export async function updateLostPetStatus(
  lostPetId: string,
  status: 'searching' | 'found' | 'closed'
): Promise<void> {
  const { error } = await supabase
    .from('lost_pets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', lostPetId);
  if (error) throw error;
}

/** 获取启事相关的线索打卡列表 */
export async function fetchLostPetClues(lostPetId: string): Promise<import('@/types/types').LostPetClue[]> {
  const { data, error } = await supabase
    .from('lost_pet_clues')
    .select('*')
    .eq('lost_pet_id', lostPetId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取寻宠线索列表失败:', error);
    throw error;
  }

  return (data || []) as import('@/types/types').LostPetClue[];
}

/** 更新当前用户的寻宠广播订阅开关 */
export async function updateLostPetBroadcast(
  userId: string,
  enabled: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ lost_pet_broadcast: enabled })
    .eq('id', userId);
  if (error) {
    console.error('更新寻宠广播订阅失败:', error);
    throw error;
  }
  return enabled;
}

/** 提交寻宠线索打卡 */
export async function createLostPetClue(
  userId: string,
  input: import('@/types/types').CreateLostPetClueInput
): Promise<import('@/types/types').LostPetClue> {
  const { data, error } = await supabase
    .from('lost_pet_clues')
    .insert({
      user_id: userId,
      lost_pet_id: input.lost_pet_id,
      sighting_time: input.sighting_time || new Date().toISOString(),
      sighting_location: input.sighting_location,
      description: input.description,
      photo_url: input.photo_url || null,
      contact_info: input.contact_info || null,
      status: 'normal',
    })
    .select()
    .single();

  if (error) throw error;
  return data as import('@/types/types').LostPetClue;
}