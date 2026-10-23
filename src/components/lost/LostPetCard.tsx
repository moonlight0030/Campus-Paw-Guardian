import { useState } from 'react';
import type { LostPet } from '@/types/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, Eye, MapPin, Phone, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface LostPetCardProps {
  lostPet: LostPet;
  onViewDetail: (lostPet: LostPet) => void;
  onAddClue: (lostPet: LostPet) => void;
}

export default function LostPetCard({ lostPet, onViewDetail, onAddClue }: LostPetCardProps) {
  const isFound = lostPet.status === 'found';
  const coverUrl =
    lostPet.photo_urls?.[0] ||
    lostPet.pet?.photo_url ||
    'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80';

  const lostDateFormatted = format(new Date(lostPet.lost_date), 'yyyy-MM-dd HH:mm', { locale: zhCN });
  const timeAgo = formatDistanceToNow(new Date(lostPet.lost_date), { addSuffix: true, locale: zhCN });

  return (
    <div className={`rounded-3xl border overflow-hidden transition-all duration-300 hover:shadow-lg flex flex-col h-full bg-card ${
      isFound ? 'border-border/60 opacity-80' : 'border-destructive/30 hover:border-destructive/60'
    }`}>
      {/* 顶部图片与状态标签 */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted group cursor-pointer" onClick={() => onViewDetail(lostPet)}>
        <img
          src={coverUrl}
          alt={lostPet.pet_name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* 急寻状态徽章 */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
          {isFound ? (
            <Badge className="bg-emerald-600 text-white border-none text-xs gap-1 py-1 px-2.5 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" /> 已找回平安
            </Badge>
          ) : (
            <Badge className="bg-destructive text-destructive-foreground animate-pulse border-none text-xs gap-1 py-1 px-2.5 shadow-md">
              <AlertCircle className="w-3.5 h-3.5" /> 紧急急寻中
            </Badge>
          )}

          <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur-md border-none text-[11px]">
            {lostPet.species === 'dog' ? '狗狗' : lostPet.species === 'cat' ? '猫咪' : '萌宠'}
          </Badge>
        </div>

        {/* 悬赏标 */}
        {lostPet.reward_amount && !isFound && (
          <div className="absolute top-3 right-3">
            <span className="bg-amber-500 text-amber-950 font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-md">
              {lostPet.reward_amount}
            </span>
          </div>
        )}

        {/* 底部浮层名字 */}
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <h4 className="font-rounded font-bold text-base truncate flex items-center gap-2">
            {lostPet.pet_name}
            {lostPet.breed && <span className="text-xs font-normal text-white/80">({lostPet.breed})</span>}
          </h4>
          <p className="text-[11px] text-white/80 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 shrink-0" />
            走失时间：{timeAgo}
          </p>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-1.5 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <span className="text-foreground font-medium truncate">走失地：{lostPet.lost_location}</span>
          </div>

          {lostPet.features && (
            <div className="bg-secondary/40 rounded-xl p-2 text-muted-foreground line-clamp-2 text-[11px]">
              <span className="font-semibold text-foreground">特征：</span>
              {lostPet.features}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1 truncate max-w-[130px]">
              联系人：{lostPet.contact_name}
            </span>
            <span className="text-primary font-medium flex items-center gap-1 shrink-0">
              <Phone className="w-3 h-3" />
              {lostPet.contact_phone}
            </span>
          </div>
        </div>

        {/* 操作按钮组 */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetail(lostPet)}
            className="rounded-xl text-xs h-8"
          >
            查看详情
          </Button>

          {isFound ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onViewDetail(lostPet)}
              className="rounded-xl text-xs h-8 text-muted-foreground"
            >
              已找回 (查看)
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onAddClue(lostPet)}
              className="rounded-xl text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              提供线索
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
