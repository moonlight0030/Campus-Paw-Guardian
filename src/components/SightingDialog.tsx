import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPetsSimple, createSighting, uploadSightingPhoto } from '@/services/api';
import type { Species } from '@/types/types';
import { toast } from 'sonner';
import { Sparkles, MapPin, Clock, User, FileText, PawPrint, Loader2, Camera, X, ImagePlus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

export const PRESET_LOCATIONS = [
  '操场边',
  '图书馆后花园',
  '食堂旁草丛',
  '教学楼前',
  '宿舍楼下',
] as const;

interface PetSimple {
  id: string;
  name: string;
  species: Species;
  photo_url: string;
  location_name: string;
}

interface SightingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPetId?: string;
  onSuccess?: () => void;
}

// 格式化当前时间为 input datetime-local 所需格式：YYYY-MM-DDTHH:mm
function getCurrentLocalDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function SightingDialog({
  open,
  onOpenChange,
  defaultPetId,
  onSuccess,
}: SightingDialogProps) {
  const { user, profile } = useAuth();
  const [pets, setPets] = useState<PetSimple[]>([]);
  const [loadingPets, setLoadingPets] = useState(false);

  // 表单状态
  const [selectedPetId, setSelectedPetId] = useState<string>(defaultPetId || '');
  const [locationPreset, setLocationPreset] = useState<string>('操场边');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [isCustomLocation, setIsCustomLocation] = useState<boolean>(false);
  const [sightedAt, setSightedAt] = useState<string>(getCurrentLocalDateTime());
  const [recorderName, setRecorderName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 图片压缩工具：超限时转 WEBP / 1080p / 0.8 质量，迭代至 1MB 以下
  const compressImage = useCallback(async (file: File): Promise<File> => {
    if (file.size <= 1024 * 1024) return file;

    const createBitmap = (): Promise<ImageBitmap> =>
      typeof createImageBitmap === 'function'
        ? createImageBitmap(file)
        : new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
              URL.revokeObjectURL(url);
              resolve(img as unknown as ImageBitmap);
            };
            img.onerror = reject;
            img.src = url;
          });

    const bitmap = await createBitmap();
    let { width, height } = bitmap as unknown as { width: number; height: number };
    const maxDim = 1080;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, width, height);

    let quality = 0.8;
    let blob: Blob | null = null;
    while (quality > 0.1) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality)
      );
      if (blob && blob.size <= 1024 * 1024) break;
      quality -= 0.1;
    }

    if (!blob) return file;
    const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
      type: 'image/webp',
    });
    toast.info(`图片已自动压缩至 ${(compressed.size / 1024).toFixed(0)} KB`);
    return compressed;
  }, []);

  const handlePhotoDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file || !user) return;
      if (!file.type.startsWith('image/')) {
        toast.error('请上传图片文件（JPG / PNG / WEBP 等）');
        return;
      }

      setUploadingPhoto(true);
      try {
        const processed = await compressImage(file);
        const url = await uploadSightingPhoto(user.id, processed);
        setPhotoUrl(url);
        toast.success('现场照片上传成功');
      } catch (e) {
        console.error('目击照片上传失败:', e);
        toast.error('照片上传失败，请重试');
      } finally {
        setUploadingPhoto(false);
      }
    },
    [user, compressImage]
  );

  const dropzoneProps = useDropzone({
    onDrop: handlePhotoDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [], 'image/gif': [], 'image/avif': [] },
    maxFiles: 1,
    disabled: uploadingPhoto,
  });

  // 当弹窗打开时加载萌宠列表
  useEffect(() => {
    if (open) {
      setLoadingPets(true);
      fetchAllPetsSimple()
        .then((data) => {
          setPets(data);
          // 如果没有传入 defaultPetId，默认选中第一个动物
          if (!defaultPetId && data.length > 0 && !selectedPetId) {
            setSelectedPetId(data[0].id);
          }
        })
        .finally(() => setLoadingPets(false));

      // 重置时间为当前时间
      setSightedAt(getCurrentLocalDateTime());

      // 默认记录人姓名
      if (profile?.nickname && !recorderName) {
        setRecorderName(profile.nickname);
      }
    }
  }, [open, defaultPetId, profile?.nickname]);

  // 当 defaultPetId 改变时更新选中项
  useEffect(() => {
    if (defaultPetId) {
      setSelectedPetId(defaultPetId);
    }
  }, [defaultPetId]);

  const handleLocationPresetChange = (value: string) => {
    setLocationPreset(value);
    if (value === 'custom') {
      setIsCustomLocation(true);
    } else {
      setIsCustomLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPetId) {
      toast.error('请选择打卡萌友');
      return;
    }

    const finalLocation = isCustomLocation ? customLocation.trim() : locationPreset;
    if (!finalLocation) {
      toast.error('请选择或输入目击地点');
      return;
    }

    if (!sightedAt) {
      toast.error('请选择目击时间');
      return;
    }

    try {
      setSubmitting(true);
      // 将本地 datetime 转换为带时区的 ISO 字符串
      const isoDate = new Date(sightedAt).toISOString();

      await createSighting({
        pet_id: selectedPetId,
        location: finalLocation,
        sighted_at: isoDate,
        recorder_name: recorderName.trim() || (profile?.nickname ?? '热心同学'),
        notes: notes.trim() || undefined,
        photo_url: photoUrl || undefined,
        user_id: user?.id,
      });

      toast.success('打卡成功！感谢你为萌友记录温暖足迹～');
      onOpenChange(false);

      // 重置表单状态
      setNotes('');
      setPhotoUrl('');
      if (!isCustomLocation) {
        setCustomLocation('');
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      console.error('打卡提交失败:', err);
      toast.error('打卡提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPet = pets.find((p) => p.id === selectedPetId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <DialogTitle className="text-xl font-bold">遇见萌友 · 每日足迹打卡</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            发现校园里的小精灵了吗？记录下它们的出没位置和萌态，帮助更多守护者了解它们当下的行踪～
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 选择动物 */}
          <div className="space-y-1.5">
            <Label htmlFor="pet-select" className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <PawPrint className="h-3.5 w-3.5 text-primary" />
              选择动物 <span className="text-destructive">*</span>
            </Label>
            {loadingPets ? (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                正在加载动物档案列表...
              </div>
            ) : (
              <Select value={selectedPetId} onValueChange={setSelectedPetId}>
                <SelectTrigger id="pet-select" className="w-full rounded-2xl border-border bg-background py-5 px-3">
                  <SelectValue placeholder="请选择萌友档案" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-2xl">
                  {pets.map((pet) => (
                    <SelectItem key={pet.id} value={pet.id} className="cursor-pointer py-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={pet.photo_url}
                          alt={pet.name}
                          className="h-6 w-6 rounded-full object-cover border border-border"
                        />
                        <span className="font-medium text-foreground">{pet.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({pet.species === 'cat' ? '猫咪' : '修勾'} · 常在 {pet.location_name})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* 选中动物后的快捷信息展示 */}
            {selectedPet && (
              <div className="flex items-center gap-2.5 rounded-2xl bg-secondary/50 p-2.5 text-xs text-foreground/80 border border-border/40">
                <img
                  src={selectedPet.photo_url}
                  alt={selectedPet.name}
                  className="h-9 w-9 rounded-xl object-cover border border-border/60"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <span>{selectedPet.name}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                      {selectedPet.species === 'cat' ? '小猫' : '小狗'}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    常出没于：{selectedPet.location_name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 选择地点 */}
          <div className="space-y-1.5">
            <Label htmlFor="location-select" className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              目击地点 <span className="text-destructive">*</span>
            </Label>
            <Select value={locationPreset} onValueChange={handleLocationPresetChange}>
              <SelectTrigger id="location-select" className="w-full rounded-2xl border-border bg-background py-5 px-3">
                <SelectValue placeholder="请选择或输入地点" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {PRESET_LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc} className="cursor-pointer">
                    {loc}
                  </SelectItem>
                ))}
                <SelectItem value="custom" className="cursor-pointer font-medium text-primary">
                  手动输入其他地点...
                </SelectItem>
              </SelectContent>
            </Select>

            {isCustomLocation && (
              <div className="pt-1">
                <Input
                  placeholder="请输入具体地点，例如：北区小树林长椅旁"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  className="rounded-2xl border-border bg-background px-3 py-2 text-sm"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* 目击时间 */}
          <div className="space-y-1.5">
            <Label htmlFor="sighted-at" className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              目击时间 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sighted-at"
              type="datetime-local"
              value={sightedAt}
              onChange={(e) => setSightedAt(e.target.value)}
              className="rounded-2xl border-border bg-background px-3 py-2 text-sm"
              max={getCurrentLocalDateTime()}
            />
            <p className="text-[11px] text-muted-foreground">
              默认当前时间，如果刚才遇到的也可以在此修改为真实目击时间
            </p>
          </div>

          {/* 记录人（选填） */}
          <div className="space-y-1.5">
            <Label htmlFor="recorder-name" className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <User className="h-3.5 w-3.5 text-primary" />
              记录人 <span className="text-muted-foreground font-normal">(选填)</span>
            </Label>
            <Input
              id="recorder-name"
              placeholder={profile?.nickname ? profile.nickname : '例如：热心同学、小林学长'}
              value={recorderName}
              onChange={(e) => setRecorderName(e.target.value)}
              className="rounded-2xl border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* 现场照片（选填） */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Camera className="h-3.5 w-3.5 text-primary" />
              现场照片 <span className="text-muted-foreground font-normal">(选填)</span>
            </Label>
            {photoUrl ? (
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-border/60">
                <img src={photoUrl} alt="现场照片预览" className="w-full h-full object-cover" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPhotoUrl('')}
                  className="absolute top-2 right-2 rounded-xl bg-background/80 hover:bg-background h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div
                {...dropzoneProps.getRootProps()}
                className={`w-full aspect-[4/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  dropzoneProps.isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                }`}
              >
                <input {...dropzoneProps.getInputProps()} />
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                    <span className="text-sm text-muted-foreground">照片上传中...</span>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-3">
                      <ImagePlus className="w-7 h-7 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">点击或拖拽上传现场照片</p>
                    <p className="text-xs text-muted-foreground mt-1">支持 JPG / PNG / WEBP，超过 1MB 将自动压缩</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 备注（选填） */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <FileText className="h-3.5 w-3.5 text-primary" />
              备注信息 <span className="text-muted-foreground font-normal">(选填)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="分享一下当时的情形吧，比如：正在开心吃罐头、趴在草坪晒太阳、看起来精神不错..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-2xl border-border bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <DialogFooter className="gap-2 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-2xl border-border"
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 min-w-28"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  打卡提交
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
