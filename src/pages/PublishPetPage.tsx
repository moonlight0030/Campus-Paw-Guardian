import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPet, updatePet, fetchPetById } from '@/services/api';
import type { Species, Gender } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import ImageUploader from '@/components/pet/ImageUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Cat, Dog, Loader2, Sparkles, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const PERSONALITY_OPTIONS = ['亲人', '高冷', '活泼', '胆小', '贪吃', '贪睡', '机灵', '温柔', '勇敢', '调皮'];

export default function PublishPetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  const [species, setSpecies] = useState<Species>('cat');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [coatColor, setCoatColor] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [locationName, setLocationName] = useState('');
  const [discoveredAt, setDiscoveredAt] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [photoUrl, setPhotoUrl] = useState('');
  const [isNeutered, setIsNeutered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const loadPet = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const pet = await fetchPetById(id);
      if (!pet) {
        toast.error('档案不存在');
        navigate('/');
        return;
      }
      setSpecies(pet.species);
      setName(pet.name);
      setGender(pet.gender);
      setCoatColor(pet.coat_color);
      setTags(pet.personality_tags);
      setLocationName(pet.location_name);
      const dd = new Date(pet.discovered_at);
      const pad = (n: number) => String(n).padStart(2, '0');
      setDiscoveredAt(`${dd.getFullYear()}-${pad(dd.getMonth() + 1)}-${pad(dd.getDate())}T${pad(dd.getHours())}:${pad(dd.getMinutes())}`);
      setPhotoUrl(pet.photo_url);
      setIsNeutered(pet.is_neutered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (isEdit) loadPet();
  }, [isEdit, loadPet]);

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const validate = (): boolean => {
    if (!name.trim()) {
      toast.error('请填写萌宠昵称');
      return false;
    }
    if (!coatColor.trim()) {
      toast.error('请填写毛色');
      return false;
    }
    if (!locationName.trim()) {
      toast.error('请填写出没地点');
      return false;
    }
    if (!photoUrl) {
      toast.error('请上传萌宠照片');
      return false;
    }
    return true;
  };

  const doSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const payload = {
        species,
        name: name.trim(),
        gender,
        coat_color: coatColor.trim(),
        personality_tags: tags,
        location_name: locationName.trim(),
        photo_url: photoUrl,
        is_neutered: isNeutered,
        discovered_at: new Date(discoveredAt).toISOString(),
      };
      if (isEdit && id) {
        await updatePet(id, payload);
        toast.success('档案已更新');
        setConfirmEdit(false);
        navigate(`/pet/${id}`);
      } else {
        const newId = await createPet(payload);
        toast.success('发布成功，感谢你的守护～');
        navigate(`/pet/${newId}`);
      }
    } catch (e) {
      console.error(e);
      toast.error('操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!user) return;
    if (!validate()) return;
    // 编辑模式：先弹出确认框，再执行修改
    if (isEdit) {
      setConfirmEdit(true);
      return;
    }
    doSubmit();
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground">
          {isEdit ? '编辑萌宠档案' : '发布萌宠档案'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEdit ? '修改档案信息后保存' : '记录你发现的校园流浪猫狗，让更多人了解 TA'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="rounded-3xl border-border/60">
            <CardHeader>
              <CardTitle className="text-lg font-rounded">照片</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUploader userId={user.id} value={photoUrl} onChange={setPhotoUrl} />
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/60">
            <CardHeader>
              <CardTitle className="text-lg font-rounded">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>物种</Label>
                <div className="flex gap-3">
                  {(['cat', 'dog'] as Species[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpecies(s)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 transition-colors ${
                        species === s ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {s === 'cat' ? <Cat className="w-5 h-5" /> : <Dog className="w-5 h-5" />}
                      <span className="font-medium">{s === 'cat' ? '猫咪' : '狗狗'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">昵称</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：小橘" className="rounded-xl px-3" />
                </div>
                <div className="space-y-2">
                  <Label>性别</Label>
                  <div className="flex gap-3">
                    {(['male', 'female'] as Gender[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                          gender === g ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {g === 'male' ? '♂ 公' : '♀ 母'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">毛色</Label>
                <Input id="color" value={coatColor} onChange={(e) => setCoatColor(e.target.value)} placeholder="如：橘色、三花、黑白" className="rounded-xl px-3" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discovered" className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary" />
                  发现时间
                </Label>
                <Input
                  id="discovered"
                  type="datetime-local"
                  value={discoveredAt}
                  onChange={(e) => setDiscoveredAt(e.target.value)}
                  className="rounded-xl px-3"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  性格标签
                </Label>
                <div className="flex flex-wrap gap-2">
                  {PERSONALITY_OPTIONS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        tags.includes(tag) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-secondary/50 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">是否已绝育</p>
                  <p className="text-xs text-muted-foreground mt-0.5">已做绝育手术有助于控制流浪数量</p>
                </div>
                <Switch checked={isNeutered} onCheckedChange={setIsNeutered} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/60">
            <CardHeader>
              <CardTitle className="text-lg font-rounded">出没地点</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location">地点名称</Label>
                <Input
                  id="location"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="如：图书馆后花园、食堂旁"
                  className="rounded-xl px-3"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate(-1)} className="rounded-xl flex-1">
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="rounded-xl flex-1 gap-1.5">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? '保存修改' : '发布档案'}
            </Button>
          </div>
        </div>
      )}

      {/* 修改确认弹窗 */}
      <AlertDialog open={confirmEdit} onOpenChange={setConfirmEdit}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>确认修改该档案？</AlertDialogTitle>
            <AlertDialogDescription>
              即将保存对「{name.trim() || '该萌宠'}」档案信息的修改，保存后立即生效。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="rounded-xl">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                doSubmit();
              }}
              disabled={submitting}
              className="rounded-xl"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              确认修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}