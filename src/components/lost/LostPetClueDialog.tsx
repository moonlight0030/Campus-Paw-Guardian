import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createLostPetClue, uploadSightingPhoto } from '@/services/api';
import type { LostPet } from '@/types/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Clock, Eye, Loader2, MapPin, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

interface LostPetClueDialogProps {
  lostPet: LostPet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function LostPetClueDialog({ lostPet, open, onOpenChange, onSuccess }: LostPetClueDialogProps) {
  const { user, profile } = useAuth();

  const [sightingTime, setSightingTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [sightingLocation, setSightingLocation] = useState('');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 上传目击照片
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      toast.loading('正在上传线索照片...', { id: 'upload-clue-photo' });
      const url = await uploadSightingPhoto(user.id, file);
      setPhotoUrl(url);
      toast.success('线索照片上传成功', { id: 'upload-clue-photo' });
    } catch (err: any) {
      toast.error('照片上传失败，请重试', { id: 'upload-clue-photo' });
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('请先登录后再打卡提供线索');
      return;
    }
    if (!lostPet) return;
    if (!sightingLocation.trim()) {
      toast.error('请填写目击到萌宠的具体地点');
      return;
    }
    if (!description.trim()) {
      toast.error('请描述萌宠的活动状态或去向');
      return;
    }

    setSubmitting(true);
    try {
      await createLostPetClue(user.id, {
        lost_pet_id: lostPet.id,
        sighting_time: new Date(sightingTime).toISOString(),
        sighting_location: sightingLocation.trim(),
        description: description.trim(),
        photo_url: photoUrl || undefined,
        contact_info: contactInfo.trim() || profile?.nickname || undefined,
      });

      toast.success('线索打卡成功！感谢你的热心提供，已通知发布人！');
      onOpenChange(false);
      // 清空表单
      setSightingLocation('');
      setDescription('');
      setPhotoUrl('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '提交线索失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (!lostPet) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="font-rounded font-bold text-base flex items-center gap-2 text-foreground">
            <span className="p-1.5 rounded-xl bg-primary/15 text-primary">
              <Eye className="w-4 h-4" />
            </span>
            提供目击线索 · 打卡
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            为寻找「{lostPet.pet_name}」提供关键线索，帮助它早日回家！
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="bg-secondary/40 p-2.5 rounded-2xl flex items-center gap-3">
            <img
              src={lostPet.photo_urls?.[0] || lostPet.pet?.photo_url || ''}
              alt={lostPet.pet_name}
              className="w-12 h-12 rounded-xl object-cover shrink-0 border border-border"
            />
            <div className="min-w-0 flex-1 text-xs">
              <div className="font-bold text-foreground truncate">{lostPet.pet_name}</div>
              <div className="text-muted-foreground text-[11px] truncate">
                走失地点：{lostPet.lost_location}
              </div>
              <div className="text-primary text-[11px] font-medium truncate">
                联系人：{lostPet.contact_name} ({lostPet.contact_phone})
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <Clock className="w-3 h-3 text-primary" /> 目击时间 *
            </label>
            <Input
              type="datetime-local"
              value={sightingTime}
              onChange={(e) => setSightingTime(e.target.value)}
              className="rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 text-primary" /> 目击具体地点 *
            </label>
            <Input
              value={sightingLocation}
              onChange={(e) => setSightingLocation(e.target.value)}
              placeholder="如：西区篮球场旁树荫下、北门快递点"
              className="rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">目击情况详述与去向 *</label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="如：看到它在低头喝水，神情警惕，随后往三号宿舍楼方向小跑去了..."
              className="rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">你的联系方式 (选填，方便主人核对)</label>
            <Input
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="手机号或微信（选填）"
              className="rounded-xl text-xs"
            />
          </div>

          {/* 现场照片 */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <Camera className="w-3 h-3 text-primary" /> 现场照片 (极重要)
            </label>
            {photoUrl ? (
              <div className="flex items-center gap-2">
                <img src={photoUrl} alt="目击照片" className="w-14 h-14 rounded-xl object-cover border" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPhotoUrl('')}
                  className="rounded-xl text-xs h-8"
                >
                  更换照片
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center w-full rounded-xl text-xs h-10 border border-dashed border-border cursor-pointer hover:bg-secondary/40 transition-colors text-muted-foreground">
                {uploadingPhoto ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1 text-primary" />
                    上传现场拍摄照片
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingPhoto}
                  onChange={handleUploadPhoto}
                />
              </label>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploadingPhoto}
            className="rounded-xl text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            {submitting ? '提交中...' : '提交打卡线索'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
