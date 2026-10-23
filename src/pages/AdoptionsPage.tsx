import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPets, fetchAllAdoptions, createAdoption } from '@/services/api';
import type { Pet, HousingType, ExperienceType } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Heart, Sparkles, CheckCircle2, Clock, XCircle, Home, UserCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function AdoptionsPage() {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [adoptions, setAdoptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetPet, setTargetPet] = useState<Pet | null>(null);

  // 表单状态
  const [applicantName, setApplicantName] = useState('');
  const [contact, setContact] = useState('');
  const [housing, setHousing] = useState<HousingType>('own_home');
  const [experience, setExperience] = useState<ExperienceType>('experienced');
  const [reason, setReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [petsRes, adoptionsList] = await Promise.all([
        fetchPets({ page: 0, pageSize: 100 }),
        fetchAllAdoptions(),
      ]);
      setPets(petsRes.items);
      setAdoptions(adoptionsList);
    } catch (e) {
      console.error(e);
      toast.error('加载领养数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openApply = (pet: Pet) => {
    if (!user) {
      toast.error('请先登录后再提交领养申请');
      return;
    }
    setTargetPet(pet);
    setApplicantName('');
    setContact('');
    setReason('');
    setApplyDialogOpen(true);
  };

  const handleApplySubmit = async () => {
    if (!targetPet) return;
    if (!applicantName.trim() || !contact.trim() || !reason.trim()) {
      toast.error('请完整填写申请人姓名、联系方式与领养缘由');
      return;
    }
    setSubmitting(true);
    try {
      await createAdoption({
        petId: targetPet.id,
        applicant_name: applicantName.trim(),
        contact: contact.trim(),
        housing,
        experience,
        reason: reason.trim(),
      });
      toast.success('领养申请已提交！动协管理员将尽快为您审核～');
      setApplyDialogOpen(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || '提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const myAdoptions = user ? adoptions.filter((a) => a.user_id === user.id) : [];

  return (
    <div className="space-y-6 pb-12">
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
              <Heart className="h-5 w-5" />
            </span>
            <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground">校园领养中心</h1>
            <Badge className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 px-2.5 py-0.5 text-xs">
              温暖归宿
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            以领养代替购买，严格审核回访，为校园毛孩子寻找负责任的终身家庭
          </p>
        </div>
      </div>

      {/* 领养流程小贴士 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-card border border-border/60 p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">1</div>
          <div>
            <h4 className="text-xs font-bold text-foreground">选择心仪萌宠</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">了解性格与健康历史</p>
          </div>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">2</div>
          <div>
            <h4 className="text-xs font-bold text-foreground">提交问卷初审</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">确认居住环境与封窗</p>
          </div>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">3</div>
          <div>
            <h4 className="text-xs font-bold text-foreground">管理员审核联络</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">线下接触互动与家访</p>
          </div>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">4</div>
          <div>
            <h4 className="text-xs font-bold text-foreground">签署协议交接</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">开启温暖相伴生活</p>
          </div>
        </div>
      </div>

      {/* 我的领养申请进度（若已登录且有申请） */}
      {user && myAdoptions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold font-rounded text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            我的领养申请进度
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myAdoptions.map((ad) => {
              const isApproved = ad.status === 'approved';
              const isRejected = ad.status === 'rejected';
              return (
                <div key={ad.id} className="rounded-3xl border border-primary/20 bg-primary/5 p-4 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={ad.pet?.photo_url || ''}
                        alt={ad.pet?.name || '萌宠'}
                        className="w-12 h-12 rounded-2xl object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate">申请领养：{ad.pet?.name || '萌宠'}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">申请人：{ad.applicant_name}</p>
                      </div>
                    </div>
                    <Badge
                      className={`rounded-full px-2.5 py-1 text-xs shrink-0 ${
                        isApproved
                          ? 'bg-emerald-500 text-white'
                          : isRejected
                          ? 'bg-destructive text-destructive-foreground'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {isApproved ? '审核通过' : isRejected ? '未通过' : '审核中'}
                    </Badge>
                  </div>

                  {/* 管理员审核附言与反馈 */}
                  {ad.admin_notes && (
                    <div className="rounded-2xl bg-card border border-border/60 p-3 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-primary font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>动协管理员审核答复：</span>
                      </div>
                      <p className="text-foreground leading-relaxed pl-5">{ad.admin_notes}</p>
                    </div>
                  )}

                  {isApproved && (
                    <div className="text-[11px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      ✨ 审核已通过！请留意微信或短信联络，或直接通过下方管理员联络卡主动联系动协预约交接～
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 动协管理员联络卡与领养服务支持 */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-amber-50/20 to-background p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-md shadow-primary/25">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-rounded font-bold text-base text-foreground">校园小动物保护协会 · 领养咨询处</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              领养答疑、环境封窗指导、领养交接与回访支持，动协管理员随时为您提供温暖服务
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText('campus_pets_2026');
              toast.success('已复制动协管理员微信号：campus_pets_2026');
            }}
            className="rounded-2xl text-xs h-8"
          >
            动协微信：campus_pets_2026 (点击复制)
          </Button>
          <Button
            size="sm"
            onClick={() => {
              window.open('tel:01088887297');
            }}
            className="rounded-2xl text-xs h-8"
          >
            领养热线：010-8888-PAWS
          </Button>
        </div>
      </div>

      {/* 待领养毛孩子卡片大厅 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold font-rounded text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            开放领养档案
          </h3>
          <span className="text-xs text-muted-foreground">共 {pets.length} 只小可爱期待新家</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">正在加载待领养动物...</div>
        ) : pets.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-3xl border border-border/60">
            <Heart className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-foreground">暂无开放领养的动物</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pets.map((pet) => (
              <Card key={pet.id} className="rounded-3xl border border-border/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-card flex flex-col">
                <div className="aspect-[4/3] w-full overflow-hidden relative">
                  <img
                    src={pet.photo_url}
                    alt={pet.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <Badge className="absolute top-3 left-3 bg-background/90 text-foreground backdrop-blur-sm border-0 text-xs">
                    {pet.species === 'cat' ? '猫咪' : '狗狗'}
                  </Badge>
                  <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground border-0 text-xs">
                    {pet.is_neutered ? '已绝育' : '未绝育'}
                  </Badge>
                </div>
                <CardContent className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-rounded font-bold text-base text-foreground">{pet.name}</h4>
                      <span className="text-xs text-muted-foreground">{pet.location_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      毛色：{pet.coat_color} · 性格：{pet.personality_tags?.join('、') || '亲人温顺'}
                    </p>
                  </div>
                  <Button
                    onClick={() => openApply(pet)}
                    className="mt-4 w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium shadow-sm"
                  >
                    <Heart className="w-4 h-4 mr-1.5" />
                    申请领养 TA
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 领养申请表单弹窗 */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-rounded font-bold text-lg flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              领养申请：{targetPet?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs md:text-sm">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">申请人真实姓名</label>
              <Input
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                placeholder="请输入您的姓名"
                className="rounded-2xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">手机号码 / 微信号</label>
              <Input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="便于动协管理员与您联系"
                className="rounded-2xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">居住环境选择</label>
              <Select value={housing} onValueChange={(v: HousingType) => setHousing(v)}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="own_home">自有住房/独立居所（已封窗）</SelectItem>
                  <SelectItem value="campus_dorm">学校宿舍/教工宿舍</SelectItem>
                  <SelectItem value="off_campus_rent">校外整租公寓（已封窗）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">养宠经验</label>
              <Select value={experience} onValueChange={(v: ExperienceType) => setExperience(v)}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="experienced">有多年养宠经验</SelectItem>
                  <SelectItem value="some">接触过并有一定了解</SelectItem>
                  <SelectItem value="none">新手领养但已做足功课</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">领养理由与未来规划</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请详细描述您对这只毛孩子的喜爱、未来毕业/搬家的安置计划等"
                rows={3}
                className="rounded-2xl resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)} className="rounded-2xl">
              取消
            </Button>
            <Button onClick={handleApplySubmit} disabled={submitting} className="rounded-2xl">
              {submitting ? '提交中...' : '提交领养申请'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
