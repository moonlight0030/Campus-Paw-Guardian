import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createLostPet, fetchAllPetsSimple, uploadSightingPhoto } from '@/services/api';
import type { CreateLostPetInput, Species } from '@/types/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Camera, Loader2, MapPin, PawPrint, Phone, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

interface PublishLostPetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function PublishLostPetDialog({ open, onOpenChange, onSuccess }: PublishLostPetDialogProps) {
  const { user, profile } = useAuth();

  const [petsList, setPetsList] = useState<any[]>([]);
  const [selectedExistingPetId, setSelectedExistingPetId] = useState<string>('none');

  // 表单状态
  const [title, setTitle] = useState('');
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState<Species | 'other'>('cat');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unknown'>('unknown');
  const [color, setColor] = useState('');
  const [features, setFeatures] = useState('');
  const [lostDate, setLostDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [lostLocation, setLostLocation] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [rewardAmount, setRewardAmount] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 加载已有动物列表供快速关联
  useEffect(() => {
    if (open) {
      fetchAllPetsSimple().then((data) => setPetsList(data)).catch(() => {});
      if (profile) {
        if (!contactName && profile.nickname) setContactName(profile.nickname);
      }
    }
  }, [open, profile]);

  // 选择已有动物自动回填
  const handleSelectExistingPet = (petId: string) => {
    setSelectedExistingPetId(petId);
    if (petId === 'none') {
      return;
    }
    const found = petsList.find((p) => p.id === petId);
    if (found) {
      setPetName(found.name || '');
      setSpecies(found.species || 'cat');
      setTitle(`急寻！校园萌宠「${found.name}」走失求助`);
      setLostLocation(found.location_name || '');
      if (found.photo_url && !photoUrls.includes(found.photo_url)) {
        setPhotoUrls([found.photo_url]);
      }
    }
  };

  // 上传图片
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      toast.loading('正在上传照片...', { id: 'upload-lost-photo' });
      const url = await uploadSightingPhoto(user.id, file);
      setPhotoUrls((prev) => [...prev, url]);
      toast.success('照片上传成功', { id: 'upload-lost-photo' });
    } catch (err: any) {
      toast.error('照片上传失败，请重试', { id: 'upload-lost-photo' });
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('请先登录后再发布寻宠启事');
      return;
    }
    if (!petName.trim()) {
      toast.error('请填写走失萌宠名字或称呼');
      return;
    }
    if (!lostLocation.trim()) {
      toast.error('请填写走失的大致地点');
      return;
    }
    if (!contactPhone.trim()) {
      toast.error('请填写紧急联系电话');
      return;
    }

    setSubmitting(true);
    try {
      const finalTitle = title.trim() || `【急寻】${species === 'dog' ? '狗狗' : '猫咪'}「${petName}」走失，盼知情者提供线索`;
      const payload: CreateLostPetInput = {
        pet_id: selectedExistingPetId !== 'none' ? selectedExistingPetId : undefined,
        title: finalTitle,
        pet_name: petName.trim(),
        species,
        breed: breed.trim() || undefined,
        gender,
        color: color.trim() || undefined,
        features: features.trim() || undefined,
        lost_date: new Date(lostDate).toISOString(),
        lost_location: lostLocation.trim(),
        contact_name: contactName.trim() || '热心同学',
        contact_phone: contactPhone.trim(),
        reward_amount: rewardAmount.trim() || undefined,
        description: description.trim() || undefined,
        photo_urls: photoUrls,
      };

      await createLostPet(user.id, payload);
      toast.success('寻宠启事发布成功！希望小家伙早日平安归来～');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '发布启事失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl max-h-[90dvh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="font-rounded font-bold text-lg flex items-center gap-2 text-foreground">
            <span className="p-1.5 rounded-xl bg-destructive/15 text-destructive">
              <AlertCircle className="w-5 h-5" />
            </span>
            发布校园走失寻宠启事
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            启事将公开在档案大厅走失求助专区展示，全校师生可随时在下方打卡提供线索
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 关联已有档案快捷选项 */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 space-y-1.5">
            <label className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              快捷关联已有档案萌宠（选填）
            </label>
            <Select value={selectedExistingPetId} onValueChange={handleSelectExistingPet}>
              <SelectTrigger className="rounded-xl text-xs bg-background">
                <SelectValue placeholder="若是校内已知萌宠走失，可在此快捷选中" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-56">
                <SelectItem value="none">暂不关联 / 校外或未知新萌宠</SelectItem>
                {petsList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}（{p.location_name} - {p.species === 'dog' ? '校犬' : '校猫'}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">萌宠名字 / 昵称 *</label>
              <Input
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder="如：大黄、小花、雪球"
                className="rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">物种类别 *</label>
              <Select value={species} onValueChange={(val: any) => setSpecies(val)}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="cat">猫咪</SelectItem>
                  <SelectItem value="dog">狗狗</SelectItem>
                  <SelectItem value="other">其他小动物</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">品种 / 花色</label>
              <Input
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder="如：三花猫、中华田园犬"
                className="rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">毛色特征</label>
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="如：橘白相间、背部带斑"
                className="rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">性别</label>
              <Select value={gender} onValueChange={(val: any) => setGender(val)}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="unknown">不详</SelectItem>
                  <SelectItem value="female">母 (美眉)</SelectItem>
                  <SelectItem value="male">公 (帅哥)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">走失发生时间 *</label>
              <Input
                type="datetime-local"
                value={lostDate}
                onChange={(e) => setLostDate(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">最后走失/目击地点 *</label>
              <Input
                value={lostLocation}
                onChange={(e) => setLostLocation(e.target.value)}
                placeholder="如：图书馆东侧花园、二食堂门口"
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">身体显著辨识特征</label>
            <Input
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder="如：脖子戴红色项圈、左耳有剪耳标记、胆小怕生"
              className="rounded-xl text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">联系人称呼 *</label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="如：李同学"
                className="rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">紧急联系电话 *</label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="电话 / 微信号"
                className="rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">悬赏 / 酬谢说明 (选填)</label>
              <Input
                value={rewardAmount}
                onChange={(e) => setRewardAmount(e.target.value)}
                placeholder="如：面谢 / 必有重谢"
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">走失详情与寻宠心声 (选填)</label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请详述走失经过或特殊习惯（如喜欢呼唤名字、见到火腿肠会靠近等）..."
              className="rounded-xl text-xs"
            />
          </div>

          {/* 照片上传 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-primary" />
              萌宠近期照片 (多张照片极大提升找回概率)
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {photoUrls.map((url, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border group">
                  <img src={url} alt="萌宠照片" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoUrls((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white rounded-full flex items-center justify-center opacity-80 hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <label className="w-16 h-16 rounded-xl border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/40 transition-colors text-muted-foreground">
                {uploadingPhoto ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5">加图</span>
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
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploadingPhoto}
            className="rounded-xl text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {submitting ? '发布中...' : '立即发布寻宠启事'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
