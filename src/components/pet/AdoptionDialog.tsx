import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAdoption } from '@/services/api';
import type { Pet, HousingType, ExperienceType } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { HandHeart, Loader2 } from 'lucide-react';

const HOUSING_OPTIONS: { value: HousingType; label: string }[] = [
  { value: 'campus_dorm', label: '校内宿舍' },
  { value: 'off_campus_rent', label: '校外租房' },
  { value: 'own_home', label: '自有住房' },
];

const EXPERIENCE_OPTIONS: { value: ExperienceType; label: string }[] = [
  { value: 'experienced', label: '有丰富养宠经验' },
  { value: 'some', label: '有一些经验' },
  { value: 'none', label: '暂无经验，愿意学习' },
];

export default function AdoptionDialog({ pet }: { pet: Pet }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [applicantName, setApplicantName] = useState('');
  const [contact, setContact] = useState('');
  const [housing, setHousing] = useState<HousingType>('campus_dorm');
  const [experience, setExperience] = useState<ExperienceType>('none');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('请先登录再申请领养');
      navigate('/login');
      return;
    }
    if (!applicantName.trim()) {
      toast.error('请填写你的称呼');
      return;
    }
    if (!contact.trim()) {
      toast.error('请填写联系方式');
      return;
    }
    if (!reason.trim()) {
      toast.error('请填写领养理由');
      return;
    }
    if (reason.trim().length < 10) {
      toast.error('领养理由至少写 10 个字，让发布者更了解你');
      return;
    }
    setSubmitting(true);
    try {
      await createAdoption({
        petId: pet.id,
        applicant_name: applicantName,
        contact,
        housing,
        experience,
        reason,
      });
      toast.success(`领养申请已提交，已通知「${pet.name}」的档案发布者`);
      setOpen(false);
      setApplicantName('');
      setContact('');
      setReason('');
    } catch (e) {
      console.error(e);
      toast.error('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && setOpen(v)}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-2xl h-12 px-6 gap-2">
          <HandHeart className="w-5 h-5" />
          申请领养
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg rounded-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>申请领养「{pet.name}」</DialogTitle>
          <DialogDescription>
            填写领养意向表单，档案发布者会在消息通知中收到你的申请。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adoption-name">称呼 *</Label>
            <Input
              id="adoption-name"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              placeholder="如：小李同学"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adoption-contact">联系方式 *</Label>
            <Input
              id="adoption-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="微信号或手机号"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>居住情况</Label>
              <Select value={housing} onValueChange={(v) => setHousing(v as HousingType)}>
                <SelectTrigger className="rounded-xl w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUSING_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>养宠经验</Label>
              <Select value={experience} onValueChange={(v) => setExperience(v as ExperienceType)}>
                <SelectTrigger className="rounded-xl w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adoption-reason">领养理由 *</Label>
            <Textarea
              id="adoption-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="说说你的情况：为什么想领养 TA？能提供怎样的环境？"
              className="rounded-xl min-h-24"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
            className="rounded-xl"
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-xl gap-1.5">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            提交申请
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}