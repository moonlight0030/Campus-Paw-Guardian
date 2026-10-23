export type Species = 'cat' | 'dog';
export type Gender = 'male' | 'female';

export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  role: 'user' | 'admin';
  nickname: string;
  avatar_url: string | null;
  created_at: string;
  lost_pet_broadcast: boolean;
}

export interface PublicProfile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  role: 'user' | 'admin';
  last_seen_at: string | null;
}

export interface Pet {
  id: string;
  species: Species;
  name: string;
  gender: Gender;
  coat_color: string;
  personality_tags: string[];
  location_name: string;
  lat: number | null;
  lng: number | null;
  photo_url: string;
  is_neutered: boolean;
  author_id: string;
  discovered_at: string;
  created_at: string;
  author?: PublicProfile | null;
}

export interface Favorite {
  id: string;
  user_id: string;
  pet_id: string;
  created_at: string;
  pet?: Pet | null;
}

export interface Comment {
  id: string;
  pet_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: PublicProfile | null;
}

export interface FeedingRecord {
  id: string;
  pet_id: string;
  user_id: string;
  food: string;
  fed_at: string;
  created_at: string;
  author?: PublicProfile | null;
  pet?: Pet | null;
  amount_grams?: number;
  food_type?: string;
  photo_url?: string | null;
  location?: string | null;
  is_planned?: boolean;
  is_forbidden?: boolean;
  status?: 'normal' | 'overfed' | 'warning' | 'forbidden';
  warning_notes?: string | null;
}

export interface FeedingPlan {
  id: string;
  pet_id: string;
  status: 'pending_review' | 'confirmed';
  daily_amount_grams: number;
  feed_times_per_day: number;
  recommended_foods: string[];
  feeding_time_slots: string[];
  forbidden_foods: string[];
  risk_notes: string;
  ai_suggestion_raw?: any;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PetTodayFeedingStats {
  today_grams: number;
  today_count: number;
  overfed_count: number;
  forbidden_count: number;
  daily_target_grams: number;
  remaining_grams: number;
  is_reached: boolean;
  is_overfed: boolean;
  status_label: '未投喂' | '适量正常' | '已达标' | '超量预警';
}

export type NotificationType = 'comment' | 'favorite' | 'adoption' | 'sighting' | 'report' | 'lost_pet_broadcast' | 'system';

export type HousingType = 'campus_dorm' | 'off_campus_rent' | 'own_home';
export type ExperienceType = 'experienced' | 'some' | 'none';

export interface AdoptionInput {
  pet_id: string;
  applicant_name: string;
  contact: string;
  housing: HousingType;
  experience: ExperienceType;
  reason: string;
}

export interface AdoptionItem {
  id: string;
  pet_id: string;
  user_id: string;
  applicant_name: string;
  contact: string;
  housing: HousingType;
  experience: ExperienceType;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string | null;
  reviewed_at?: string | null;
  reviewer_id?: string | null;
  created_at: string;
  pet?: {
    id: string;
    name: string;
    photo_url: string;
    species: Species;
    location_name?: string;
  } | null;
  applicant?: {
    id: string;
    email?: string;
    nickname?: string;
    avatar_url?: string;
  } | null;
}

export interface AppNotification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  actor_id: string;
  pet_id: string;
  pet_name: string;
  message: string;
  is_read: boolean;
  created_at: string;
  actor?: PublicProfile | null;
}

export interface PetInput {
  species: Species;
  name: string;
  gender: Gender;
  coat_color: string;
  personality_tags: string[];
  location_name: string;
  lat?: number | null;
  lng?: number | null;
  photo_url: string;
  is_neutered: boolean;
  discovered_at: string;
}

export interface PetStats {
  total: number;
  catCount: number;
  dogCount: number;
  neuteredCount: number;
  neuteredRate: number;
  guardianCount: number;
  locationDistribution: { location: string; count: number }[];
}

export interface Sighting {
  id: string;
  pet_id: string;
  location: string;
  location_name?: string;
  sighted_at: string;
  recorder_name?: string | null;
  reporter_name?: string | null;
  notes?: string | null;
  remark?: string | null;
  photo_url?: string | null;
  user_id?: string | null;
  status?: string;
  created_at: string;
}

export interface SightingWithPet extends Sighting {
  pet?: {
    id: string;
    name: string;
    species: Species;
    photo_url: string;
    location_name?: string;
  } | null;
}

export interface SightingInput {
  pet_id: string;
  location: string;
  sighted_at: string;
  recorder_name?: string;
  notes?: string;
  photo_url?: string;
  user_id?: string;
}

export interface WeatherNow {
  text: string;
  temp: number;
  feels_like: number;
  rh: number;
  wind_class: string;
  wind_dir: string;
  uptime: string;
}

export interface WeatherForecastItem {
  date: string;
  week: string;
  high: number;
  low: number;
  text_day: string;
  text_night: string;
  wc_day: string;
  wd_day: string;
}

export interface CampusWeatherData {
  location: {
    country: string;
    province: string;
    city: string;
    name: string;
    id: string;
  };
  now: WeatherNow;
  forecasts: WeatherForecastItem[];
}

export interface AdminAuditLog {
  id: string;
  operator_id: string;
  operator_email: string | null;
  operator_name: string | null;
  action: string;
  target_user_id: string | null;
  target_user_email: string | null;
  target_user_name: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface MemberProfile {
  id: string;
  email: string | null;
  phone: string | null;
  nickname: string;
  role: 'user' | 'admin';
  avatar_url: string | null;
  created_at: string;
  last_seen_at?: string | null;
}

export interface ReportItem {
  id: string;
  reporter_id: string;
  reporter_name: string | null;
  target_type: 'pet' | 'sighting' | 'comment' | 'feeding';
  target_id: string;
  target_title: string | null;
  reason: string;
  description: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  handle_result: string | null;
  handled_by: string | null;
  created_at: string;
  handled_at: string | null;
}

/** 走失寻宠启事类型 */
export interface LostPet {
  id: string;
  pet_id?: string | null;
  user_id?: string | null;
  title: string;
  pet_name: string;
  species: Species | 'other';
  breed?: string | null;
  gender: Gender | 'unknown';
  color?: string | null;
  features?: string | null;
  lost_date: string;
  lost_location: string;
  contact_name: string;
  contact_phone: string;
  reward_amount?: string | null;
  description?: string | null;
  photo_urls: string[];
  status: 'searching' | 'found' | 'closed';
  views_count: number;
  created_at: string;
  updated_at: string;
  // 关联信息
  pet?: Pet | null;
  author?: PublicProfile | null;
  clues_count?: number;
}

/** 寻宠线索打卡类型 */
export interface LostPetClue {
  id: string;
  lost_pet_id: string;
  user_id?: string | null;
  sighting_time: string;
  sighting_location: string;
  description: string;
  photo_url?: string | null;
  contact_info?: string | null;
  status: 'normal' | 'verified' | 'hidden';
  created_at: string;
  // 关联信息
  user?: PublicProfile | null;
}

export interface CreateLostPetInput {
  pet_id?: string;
  title: string;
  pet_name: string;
  species: Species | 'other';
  breed?: string;
  gender: Gender | 'unknown';
  color?: string;
  features?: string;
  lost_date: string;
  lost_location: string;
  contact_name: string;
  contact_phone: string;
  reward_amount?: string;
  description?: string;
  photo_urls?: string[];
}

export interface CreateLostPetClueInput {
  lost_pet_id: string;
  sighting_time: string;
  sighting_location: string;
  description: string;
  photo_url?: string;
  contact_info?: string;
}