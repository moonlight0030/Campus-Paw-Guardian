import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchPets, deletePet, fetchAllSightings, confirmSighting, mergeSightingToPet,
  createPetFromSighting, fetchAllAdoptions, reviewAdoption, fetchAllFeedings,
  fetchReports, handleReport, fetchMembers, changeUserRole, fetchAdminAuditLogs,
} from '@/services/api';
import FeedingManagementSection from '@/components/admin/FeedingManagementSection';
import type { Pet, SightingWithPet, MemberProfile, AdminAuditLog, ReportItem } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ShieldCheck, FolderCog, Eye, HeartHandshake, Utensils, AlertTriangle, Users,
  History, Search, Plus, Trash2, Pencil, CheckCircle2, XCircle, ArrowRightLeft,
  Sparkles, Clock, AlertCircle, RefreshCw, Filter, UserCheck, UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('pets');

  // 1. 萌宠档案管理状态
  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  const [petSearch, setPetSearch] = useState('');
  const [deletingPet, setDeletingPet] = useState<Pet | null>(null);

  // 2. 待确认目击状态
  const [sightings, setSightings] = useState<SightingWithPet[]>([]);
  const [sightingsLoading, setSightingsLoading] = useState(false);
  const [sightingStatusFilter, setSightingStatusFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [activeSighting, setActiveSighting] = useState<SightingWithPet | null>(null);
  const [targetMergePetId, setTargetMergePetId] = useState('');
  const [createFromSightingOpen, setCreateFromSightingOpen] = useState(false);
  const [newPetName, setNewPetName] = useState('');
  const [newPetSpecies, setNewPetSpecies] = useState<'cat' | 'dog'>('cat');
  const [newPetCoat, setNewPetCoat] = useState('');

  // 3. 投喂监督状态
  const [feedings, setFeedings] = useState<any[]>([]);
  const [feedingsLoading, setFeedingsLoading] = useState(false);

  // 4. 领养审核状态
  const [adoptions, setAdoptions] = useState<any[]>([]);
  const [adoptionsLoading, setAdoptionsLoading] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [activeAdoptionForReview, setActiveAdoptionForReview] = useState<any>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // 5. 举报处理状态
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportResultDialogOpen, setReportResultDialogOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportItem | null>(null);
  const [reportResultText, setReportResultText] = useState('');
  const [reportActionType, setReportActionType] = useState<'resolved' | 'dismissed'>('resolved');

  // 6. 成员管理状态
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [roleChangeDialogOpen, setRoleChangeDialogOpen] = useState(false);
  const [targetMember, setTargetMember] = useState<MemberProfile | null>(null);
  const [targetNewRole, setTargetNewRole] = useState<'user' | 'admin'>('admin');
  const [roleChanging, setRoleChanging] = useState(false);

  // 7. 管理员操作审计日志
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);

  // 加载各模块数据
  const loadPets = useCallback(async () => {
    setPetsLoading(true);
    try {
      const res = await fetchPets({ page: 0, pageSize: 200 });
      setPets(res.items);
    } catch (e) {
      console.error(e);
      toast.error('加载萌宠失败');
    } finally {
      setPetsLoading(false);
    }
  }, []);

  const loadSightings = useCallback(async () => {
    setSightingsLoading(true);
    try {
      const list = await fetchAllSightings(sightingStatusFilter);
      setSightings(list);
    } catch (e) {
      console.error(e);
      toast.error('加载目击记录失败');
    } finally {
      setSightingsLoading(false);
    }
  }, [sightingStatusFilter]);

  const loadFeedings = useCallback(async () => {
    setFeedingsLoading(true);
    try {
      const list = await fetchAllFeedings();
      setFeedings(list);
    } catch (e) {
      console.error(e);
    } finally {
      setFeedingsLoading(false);
    }
  }, []);

  const loadAdoptions = useCallback(async () => {
    setAdoptionsLoading(true);
    try {
      const list = await fetchAllAdoptions();
      setAdoptions(list);
    } catch (e) {
      console.error(e);
    } finally {
      setAdoptionsLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const list = await fetchReports();
      setReports(list);
    } catch (e) {
      console.error(e);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const list = await fetchMembers({ keyword: memberSearch, role: memberRoleFilter });
      setMembers(list);
    } catch (e) {
      console.error(e);
      toast.error('加载成员列表失败');
    } finally {
      setMembersLoading(false);
    }
  }, [memberSearch, memberRoleFilter]);

  const loadAuditLogs = useCallback(async () => {
    setAuditLogsLoading(true);
    try {
      const list = await fetchAdminAuditLogs();
      setAuditLogs(list);
    } catch (e) {
      console.error(e);
    } finally {
      setAuditLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'pets') loadPets();
    if (activeTab === 'sightings') loadSightings();
    if (activeTab === 'feedings') loadFeedings();
    if (activeTab === 'adoptions') loadAdoptions();
    if (activeTab === 'reports') loadReports();
    if (activeTab === 'members') loadMembers();
    if (activeTab === 'audit_logs') loadAuditLogs();
  }, [activeTab, loadPets, loadSightings, loadFeedings, loadAdoptions, loadReports, loadMembers, loadAuditLogs]);

  // 管理员删除萌宠
  const handleDeletePet = async () => {
    if (!deletingPet) return;
    try {
      await deletePet(deletingPet.id);
      toast.success(`已删除萌宠「${deletingPet.name}」档案`);
      setDeletingPet(null);
      loadPets();
    } catch (e: any) {
      toast.error(e.message || '删除失败');
    }
  };

  // 确认目击记录
  const handleConfirmSighting = async (sightingId: string) => {
    try {
      await confirmSighting(sightingId);
      toast.success('已确认该目击上报');
      loadSightings();
    } catch (e: any) {
      toast.error(e.message || '操作失败');
    }
  };

  // 合并目击到已有档案
  const handleMergeToPet = async () => {
    if (!activeSighting || !targetMergePetId) {
      toast.error('请选择要合并的目标萌宠档案');
      return;
    }
    try {
      await mergeSightingToPet(activeSighting.id, targetMergePetId);
      toast.success('目击记录已成功关联合并至指定档案');
      setMergeDialogOpen(false);
      loadSightings();
    } catch (e: any) {
      toast.error(e.message || '合并失败');
    }
  };

  // 目击记录转新萌宠档案
  const handleCreatePetFromSighting = async () => {
    if (!activeSighting || !user) return;
    if (!newPetName.trim()) {
      toast.error('请输入萌宠昵称');
      return;
    }
    try {
      await createPetFromSighting(
        activeSighting.id,
        {
          name: newPetName.trim(),
          species: newPetSpecies,
          gender: 'male',
          coat_color: newPetCoat.trim() || '特色花纹',
          personality_tags: ['新发现萌宠'],
          location_name: activeSighting.location || '校园某处',
          photo_url: activeSighting.photo_url || activeSighting.pet?.photo_url || '',
          is_neutered: false,
          discovered_at: activeSighting.sighted_at,
        },
        user.id
      );
      toast.success(`已成功为「${newPetName}」建立新档案并关联合并！`);
      setCreateFromSightingOpen(false);
      loadSightings();
      loadPets();
    } catch (e: any) {
      toast.error(e.message || '建档失败');
    }
  };

  // 打开领养审核与附言弹窗
  const openReviewDialog = (adoption: any, status: 'approved' | 'rejected') => {
    setActiveAdoptionForReview(adoption);
    setReviewStatus(status);
    if (status === 'approved') {
      setReviewNotes('恭喜！您的领养申请已审核通过，请添加动协领养负责老师微信 campus_pets_2026 预约线下见面与家访～');
    } else {
      setReviewNotes('感谢您对校园萌宠的善意关注，经动协综合评估，当前环境条件暂未满足该毛孩子的照料要求，敬请谅解！');
    }
    setReviewDialogOpen(true);
  };

  // 提交领养审核并发送通知
  const handleSubmitReviewAdoption = async () => {
    if (!activeAdoptionForReview || !user) return;
    setSubmittingReview(true);
    try {
      await reviewAdoption({
        adoptionId: activeAdoptionForReview.id,
        status: reviewStatus,
        adminNotes: reviewNotes.trim(),
        reviewerId: user.id,
        targetUserId: activeAdoptionForReview.user_id,
        petId: activeAdoptionForReview.pet_id,
        petName: activeAdoptionForReview.pet?.name,
      });
      toast.success('审核完成！已通过应用内消息通知向申请人反馈审核结果与管理员留言');
      setReviewDialogOpen(false);
      loadAdoptions();
    } catch (e: any) {
      toast.error(e.message || '审核处理失败');
    } finally {
      setSubmittingReview(false);
    }
  };

  // 举报处理
  const handleSubmitReportHandle = async () => {
    if (!activeReport || !user) return;
    try {
      await handleReport(
        activeReport.id,
        reportActionType,
        reportResultText.trim() || (reportActionType === 'resolved' ? '违规内容已清理' : '情况不属实驳回'),
        user.id,
        { reporterId: activeReport.reporter_id, targetType: activeReport.target_type }
      );
      toast.success('举报已处理完毕，并已向举报人发送反馈通知！');
      setReportResultDialogOpen(false);
      loadReports();
    } catch (e: any) {
      toast.error(e.message || '处理举报失败');
    }
  };

  // 触发修改角色二次确认
  const promptRoleChange = (member: MemberProfile, newRole: 'user' | 'admin') => {
    // 校验前端防呆
    if (member.id === user?.id) {
      toast.error('操作被拒绝：管理员不能调整自身角色');
      return;
    }
    const adminCount = members.filter((m) => m.role === 'admin').length;
    if (member.role === 'admin' && newRole === 'user' && adminCount <= 1) {
      toast.error('系统必须保留至少一名管理员，无法降级');
      return;
    }

    setTargetMember(member);
    setTargetNewRole(newRole);
    setRoleChangeDialogOpen(true);
  };

  // 执行修改角色
  const handleExecuteRoleChange = async () => {
    if (!targetMember) return;
    setRoleChanging(true);
    try {
      await changeUserRole(targetMember.id, targetNewRole);
      toast.success(
        targetNewRole === 'admin'
          ? `已成功将「${targetMember.nickname || targetMember.email}」设为系统管理员！`
          : `已成功取消「${targetMember.nickname || targetMember.email}」的管理员权限。`
      );
      setRoleChangeDialogOpen(false);
      loadMembers();
      loadAuditLogs();
    } catch (e: any) {
      toast.error(e.message || '操作失败');
    } finally {
      setRoleChanging(false);
    }
  };

  // 过滤萌宠列表
  const filteredPets = useMemo(() => {
    if (!petSearch.trim()) return pets;
    const kw = petSearch.trim().toLowerCase();
    return pets.filter(
      (p) =>
        p.name.toLowerCase().includes(kw) ||
        p.location_name.toLowerCase().includes(kw) ||
        p.coat_color.toLowerCase().includes(kw)
    );
  }, [pets, petSearch]);

  const adminCount = members.filter((m) => m.role === 'admin').length;

  return (
    <div className="space-y-6 pb-16">
      {/* 顶部标题与管理员信息 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground">管理控制台</h1>
            <Badge className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 px-2.5 py-0.5 text-xs font-semibold">
              管理员专属
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            全校萌宠档案审核、目击确认与合并、领养审批、投喂监督与成员权限综合运营中心
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => navigate('/publish')}
            className="rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium shadow-sm gap-1.5"
          >
            <Plus className="w-4 h-4" />
            新建萌宠档案
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (activeTab === 'pets') loadPets();
              if (activeTab === 'sightings') loadSightings();
              if (activeTab === 'feedings') loadFeedings();
              if (activeTab === 'adoptions') loadAdoptions();
              if (activeTab === 'reports') loadReports();
              if (activeTab === 'members') loadMembers();
              if (activeTab === 'audit_logs') loadAuditLogs();
            }}
            className="rounded-2xl"
            title="刷新当前数据"
          >
            <RefreshCw className="w-4 h-4 text-primary" />
          </Button>
        </div>
      </div>

      {/* 8 大管理功能 Tabs 导航 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1.5 bg-secondary/60 p-1.5 rounded-3xl border border-border/50">
          <TabsTrigger value="pets" className="rounded-2xl px-3.5 py-2 text-xs md:text-sm font-medium gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <FolderCog className="w-4 h-4" />
            萌宠管理 ({pets.length})
          </TabsTrigger>
          <TabsTrigger value="sightings" className="rounded-2xl px-3.5 py-2 text-xs md:text-sm font-medium gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Eye className="w-4 h-4" />
            待确认目击 ({sightings.length})
          </TabsTrigger>
          <TabsTrigger value="adoptions" className="rounded-2xl px-3.5 py-2 text-xs md:text-sm font-medium gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <HeartHandshake className="w-4 h-4" />
            领养审核 ({adoptions.length})
          </TabsTrigger>
          <TabsTrigger value="feedings" className="rounded-2xl px-3.5 py-2 text-xs md:text-sm font-medium gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Utensils className="w-4 h-4" />
            投喂计划与审计
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-2xl px-3.5 py-2 text-xs md:text-sm font-medium gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <AlertTriangle className="w-4 h-4" />
            举报处理 ({reports.length})
          </TabsTrigger>
          <TabsTrigger value="members" className="rounded-2xl px-3.5 py-2 text-xs md:text-sm font-medium gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Users className="w-4 h-4" />
            成员管理 ({members.length})
          </TabsTrigger>
          <TabsTrigger value="audit_logs" className="rounded-2xl px-3.5 py-2 text-xs md:text-sm font-medium gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <History className="w-4 h-4" />
            管理员操作日志
          </TabsTrigger>
        </TabsList>

        {/* 1. 萌宠档案管理 */}
        <TabsContent value="pets" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/60">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={petSearch}
                onChange={(e) => setPetSearch(e.target.value)}
                placeholder="搜索萌宠姓名、地点或毛色"
                className="rounded-xl pl-9"
              />
            </div>
            <span className="text-xs text-muted-foreground">共查得 {filteredPets.length} 只萌宠档案</span>
          </div>

          {petsLoading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">加载档案中...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPets.map((pet) => (
                <div key={pet.id} className="rounded-3xl border border-border/60 bg-card p-4 flex gap-3.5 shadow-sm">
                  <img
                    src={pet.photo_url}
                    alt={pet.name}
                    className="w-20 h-20 rounded-2xl object-cover shrink-0 cursor-pointer"
                    onClick={() => navigate(`/pet/${pet.id}`)}
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4
                          onClick={() => navigate(`/pet/${pet.id}`)}
                          className="font-bold text-foreground text-sm truncate hover:text-primary cursor-pointer"
                        >
                          {pet.name}
                        </h4>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md border-primary/30 text-primary">
                          {pet.species === 'dog' ? '狗狗' : '猫咪'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">出没地：{pet.location_name}</p>
                      <p className="text-xs text-muted-foreground truncate">毛色：{pet.coat_color}</p>
                    </div>

                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/edit/${pet.id}`)}
                        className="h-7 text-xs rounded-xl px-2.5"
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingPet(pet)}
                        className="h-7 text-xs rounded-xl px-2.5 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 2. 待确认目击审核与合并 */}
        <TabsContent value="sightings" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/60">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">状态筛选：</span>
              <Button
                size="sm"
                variant={sightingStatusFilter === 'all' ? 'default' : 'secondary'}
                onClick={() => setSightingStatusFilter('all')}
                className="h-7 rounded-xl text-xs"
              >
                全部记录
              </Button>
              <Button
                size="sm"
                variant={sightingStatusFilter === 'pending' ? 'default' : 'secondary'}
                onClick={() => setSightingStatusFilter('pending')}
                className="h-7 rounded-xl text-xs"
              >
                待确认上报
              </Button>
              <Button
                size="sm"
                variant={sightingStatusFilter === 'confirmed' ? 'default' : 'secondary'}
                onClick={() => setSightingStatusFilter('confirmed')}
                className="h-7 rounded-xl text-xs"
              >
                已确认展示
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">支持合并到已有档案或快速转为新档案</span>
          </div>

          {sightingsLoading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">加载目击记录中...</div>
          ) : sightings.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-3xl border border-border/60 text-muted-foreground text-sm">
              暂无匹配的目击记录
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sightings.map((s) => {
                const isConfirmed = s.status === 'confirmed';
                return (
                  <div key={s.id} className="rounded-3xl border border-border/60 bg-card p-4 flex flex-col justify-between shadow-sm space-y-3">
                    <div className="flex gap-3">
                      <img
                        src={s.photo_url || s.pet?.photo_url || ''}
                        alt="现场照片"
                        className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-border/50"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-foreground text-sm truncate">
                            关联萌宠：{s.pet?.name || '待关联'}
                          </h4>
                          <Badge className={`rounded-full text-[10px] px-2 py-0 ${
                            isConfirmed ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                          }`}>
                            {isConfirmed ? '已确认' : '待确认'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">地点：{s.location || '校园某处'}</p>
                        <p className="text-xs text-muted-foreground">
                          上报人：{s.recorder_name || '热心同学'} · {format(new Date(s.sighted_at), 'MM-dd HH:mm')}
                        </p>
                        {s.notes && (
                          <p className="text-xs text-primary/90 mt-1 line-clamp-1 bg-primary/5 p-1 rounded-md">
                            备注：{s.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                      {!isConfirmed && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await confirmSighting(s.id, {
                                targetUserId: s.user_id,
                                location: s.location,
                                adminId: user?.id,
                                petId: s.pet_id,
                                petName: s.pet?.name,
                              });
                              toast.success('已发布该目击打卡，并向打卡同学发送了通知反馈！');
                              loadSightings();
                            } catch (e: any) {
                              toast.error(e.message || '操作失败');
                            }
                          }}
                          className="h-8 rounded-xl text-xs gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          确认发布并通知
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveSighting(s);
                          setTargetMergePetId(s.pet_id || (pets[0]?.id || ''));
                          setMergeDialogOpen(true);
                        }}
                        className="h-8 rounded-xl text-xs gap-1"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
                        合并到已有档案
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setActiveSighting(s);
                          setNewPetName('');
                          setNewPetCoat('');
                          setCreateFromSightingOpen(true);
                        }}
                        className="h-8 rounded-xl text-xs gap-1"
                      >
                        <Plus className="w-3.5 h-3.5 text-primary" />
                        新建档案并合并
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 3. 领养审核 */}
        <TabsContent value="adoptions" className="space-y-4">
          {adoptionsLoading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">加载领养申请中...</div>
          ) : adoptions.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-3xl border border-border/60 text-muted-foreground text-sm">
              暂无用户提交的领养申请
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {adoptions.map((ad) => {
                const isPending = !ad.status || ad.status === 'pending';
                return (
                  <div key={ad.id} className="rounded-3xl border border-border/60 bg-card p-5 space-y-3.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={ad.pet?.photo_url || ''}
                          alt={ad.pet?.name || '萌宠'}
                          className="w-12 h-12 rounded-2xl object-cover shrink-0"
                        />
                        <div>
                          <h4 className="font-bold text-foreground text-sm">申请领养：{ad.pet?.name || '未知萌宠'}</h4>
                          <span className="text-xs text-muted-foreground">申请时间：{format(new Date(ad.created_at), 'yyyy-MM-dd HH:mm')}</span>
                        </div>
                      </div>
                      <Badge className={`rounded-full px-2.5 py-0.5 text-xs ${
                        ad.status === 'approved' ? 'bg-emerald-500 text-white' : ad.status === 'rejected' ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500 text-white'
                      }`}>
                        {ad.status === 'approved' ? '已批准' : ad.status === 'rejected' ? '已拒绝' : '待审核'}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs bg-secondary/30 p-3 rounded-2xl">
                      <p><strong>申请人姓名：</strong>{ad.applicant_name}</p>
                      <p><strong>联系方式：</strong>{ad.contact}</p>
                      <p><strong>居住环境/封窗：</strong>{ad.housing}</p>
                      <p><strong>养宠经验：</strong>{ad.experience}</p>
                      <p><strong>申请理由：</strong>{ad.reason}</p>
                      {ad.admin_notes && (
                        <div className="pt-2 mt-1 border-t border-border/50 text-foreground">
                          <span className="font-semibold text-primary">管理员附言反馈：</span>
                          <p className="mt-0.5 text-muted-foreground whitespace-pre-wrap">{ad.admin_notes}</p>
                        </div>
                      )}
                      {ad.reviewed_at && (
                        <p className="text-[11px] text-muted-foreground">审核时间：{format(new Date(ad.reviewed_at), 'yyyy-MM-dd HH:mm')}</p>
                      )}
                    </div>

                    {isPending ? (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                        <Button
                          size="sm"
                          onClick={() => openReviewDialog(ad, 'approved')}
                          className="h-8 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          审核通过并反馈
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openReviewDialog(ad, 'rejected')}
                          className="h-8 rounded-xl text-xs gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          拒绝申请
                        </Button>
                      </div>
                    ) : (
                      <div className="text-right pt-2 border-t border-border/40">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openReviewDialog(ad, ad.status === 'approved' ? 'rejected' : 'approved')}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          修改审核状态 / 补充留言
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 4. 投喂计划管理与异常投喂审计 */}
        <TabsContent value="feedings" className="space-y-4">
          <FeedingManagementSection />
        </TabsContent>

        {/* 5. 举报处理 */}
        <TabsContent value="reports" className="space-y-4">
          {reportsLoading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">加载举报中...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-3xl border border-border/60 text-muted-foreground text-sm">
              校园生态良好，暂无违规举报记录
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map((r) => (
                <div key={r.id} className="rounded-3xl border border-border/60 bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      举报类型：{r.target_type}
                    </span>
                    <Badge variant={r.status === 'pending' ? 'destructive' : 'secondary'} className="rounded-full text-xs">
                      {r.status === 'pending' ? '待处理' : r.status === 'resolved' ? '已处理' : '已驳回'}
                    </Badge>
                  </div>
                  <div className="text-xs bg-secondary/30 p-3 rounded-2xl space-y-1">
                    <p><strong>举报原因：</strong>{r.reason}</p>
                    <p><strong>详情描述：</strong>{r.description || '无补充描述'}</p>
                    <p><strong>举报人：</strong>{r.reporter_name || '实名同学'}</p>
                    {r.handle_result && (
                      <p className="text-emerald-600 font-medium pt-1 border-t border-border/40">
                        处理答复：{r.handle_result}
                      </p>
                    )}
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveReport(r);
                          setReportActionType('resolved');
                          setReportResultText('');
                          setReportResultDialogOpen(true);
                        }}
                        className="h-8 rounded-xl text-xs"
                      >
                        处理完毕
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveReport(r);
                          setReportActionType('dismissed');
                          setReportResultText('');
                          setReportResultDialogOpen(true);
                        }}
                        className="h-8 rounded-xl text-xs"
                      >
                        驳回举报
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 6. 成员管理（核心重点） */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-border/60 shadow-sm">
            <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="按邮箱或用户名搜索用户"
                  className="rounded-2xl pl-9"
                />
              </div>

              <Select value={memberRoleFilter} onValueChange={(val: any) => setMemberRoleFilter(val)}>
                <SelectTrigger className="w-36 rounded-2xl text-xs">
                  <SelectValue placeholder="角色筛选" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="all">全部角色</SelectItem>
                  <SelectItem value="admin">仅管理员 ({adminCount})</SelectItem>
                  <SelectItem value="user">仅普通用户</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>当前系统共有 <strong>{adminCount}</strong> 名管理员</span>
            </div>
          </div>

          {/* 成员列表表格 */}
          <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-secondary/40 text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap font-semibold">用户名 / 昵称</th>
                    <th className="py-3 px-4 whitespace-nowrap font-semibold">邮箱账号</th>
                    <th className="py-3 px-4 whitespace-nowrap font-semibold">当前角色</th>
                    <th className="py-3 px-4 whitespace-nowrap font-semibold">注册时间</th>
                    <th className="py-3 px-4 whitespace-nowrap font-semibold">最近活跃</th>
                    <th className="py-3 px-4 whitespace-nowrap font-semibold text-right">角色权限操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {membersLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        加载成员中...
                      </td>
                    </tr>
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        未检索到符合条件的成员
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => {
                      const isSelf = member.id === user?.id;
                      const isTargetAdmin = member.role === 'admin';
                      const isLastAdmin = isTargetAdmin && adminCount <= 1;

                      return (
                        <tr key={member.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap font-medium text-foreground flex items-center gap-2">
                            <span className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {(member.nickname || '同').slice(0, 1)}
                            </span>
                            <span>{member.nickname || '未设置昵称'}</span>
                            {isSelf && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/40 text-primary">
                                当前登录
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground">
                            {member.email || '-'}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <Badge className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isTargetAdmin
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                            }`}>
                              {isTargetAdmin ? '管理员' : '普通用户'}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground text-xs">
                            {member.created_at ? format(new Date(member.created_at), 'yyyy-MM-dd') : '-'}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground text-xs">
                            {member.last_seen_at ? format(new Date(member.last_seen_at), 'MM-dd HH:mm') : '近日'}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-right">
                            {isTargetAdmin ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isSelf || isLastAdmin}
                                onClick={() => promptRoleChange(member, 'user')}
                                className="h-8 rounded-xl text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                                title={
                                  isSelf
                                    ? '不能取消当前登录账号的管理员权限'
                                    : isLastAdmin
                                    ? '系统中最后一名管理员，不可取消'
                                    : '取消该用户的管理员权限'
                                }
                              >
                                <UserX className="w-3.5 h-3.5 mr-1" />
                                取消管理员
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => promptRoleChange(member, 'admin')}
                                className="h-8 rounded-xl text-xs bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium shadow-sm hover:opacity-95"
                              >
                                <UserCheck className="w-3.5 h-3.5 mr-1" />
                                设为管理员
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 7. 管理员操作日志 */}
        <TabsContent value="audit_logs" className="space-y-4">
          <div className="flex items-center justify-between bg-card p-3 rounded-2xl border border-border/60 text-xs text-muted-foreground">
            <span>严格记录管理员赋权与权限收回的不可篡改审计记录</span>
            <span>近 100 条操作日志</span>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-secondary/40 text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap font-semibold">操作时间</th>
                    <th className="py-3 px-4 whitespace-nowrap font-semibold">执行管理员</th>
                    <th className="py-3 px-4 whitespace-nowrap font-semibold">操作动作</th>
                    <th className="py-3 px-4 whitespace-nowrap font-semibold">受影响目标用户</th>
                    <th className="py-3 px-4 whitespace-nowrap font-semibold">操作详情</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {auditLogsLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">
                        加载操作日志中...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">
                        暂无管理员角色变更审计记录
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      const isGrant = log.action === 'grant_admin';
                      return (
                        <tr key={log.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                            {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-medium text-foreground">
                            {log.operator_name || log.operator_email || '管理员'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge className={`rounded-full px-2 py-0 text-xs ${
                              isGrant ? 'bg-primary text-primary-foreground' : 'bg-amber-600 text-white'
                            }`}>
                              {isGrant ? '提升为管理员' : '取消管理员身份'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-foreground font-medium">
                            {log.target_user_name || log.target_user_email || '目标用户'}
                            <span className="text-xs text-muted-foreground ml-1">({log.target_user_email})</span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-muted-foreground">
                            从 {log.details?.from_role || '原角色'} 变更为 {log.details?.to_role || '新角色'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 二次确认弹窗：修改用户角色 */}
      <Dialog open={roleChangeDialogOpen} onOpenChange={setRoleChangeDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-rounded font-bold text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              {targetNewRole === 'admin' ? '确认设为管理员' : '确认取消管理员权限'}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              {targetNewRole === 'admin' ? (
                <span>
                  您确定要将用户 <strong>{targetMember?.nickname}</strong>（{targetMember?.email}）提升为系统管理员吗？
                  <br /><br />
                  提升后，该用户将拥有管理后台的全部控制权限（包含档案审核、领养审批及成员角色修改等）。
                </span>
              ) : (
                <span>
                  您确定要取消用户 <strong>{targetMember?.nickname}</strong>（{targetMember?.email}）的管理员权限吗？
                  <br /><br />
                  取消后，该用户将变回普通用户，不再具备管理后台访问及审核权限。
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              disabled={roleChanging}
              onClick={() => setRoleChangeDialogOpen(false)}
              className="rounded-2xl"
            >
              取消
            </Button>
            <Button
              onClick={handleExecuteRoleChange}
              disabled={roleChanging}
              className={`rounded-2xl ${
                targetNewRole === 'user' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''
              }`}
            >
              {roleChanging ? '提交中...' : '确认执行变更'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 合并目击记录到已有档案 Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-rounded font-bold text-lg flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              合并目击到已有档案
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs md:text-sm">
            <p className="text-muted-foreground">
              当前目击地点：<strong>{activeSighting?.location}</strong>（时间：{activeSighting?.sighted_at}）
            </p>
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">选择目标萌宠档案：</label>
              <Select value={targetMergePetId} onValueChange={setTargetMergePetId}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="选择目标萌宠" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-2xl">
                  {pets.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="rounded-xl">
                      {p.name}（{p.location_name} · {p.coat_color}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)} className="rounded-2xl">
              取消
            </Button>
            <Button onClick={handleMergeToPet} className="rounded-2xl">
              确认合并
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 根据目击记录快速新建萌宠档案 Dialog */}
      <Dialog open={createFromSightingOpen} onOpenChange={setCreateFromSightingOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-rounded font-bold text-lg flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              根据目击新建档案并关联合并
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs md:text-sm">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">萌宠昵称</label>
              <Input
                value={newPetName}
                onChange={(e) => setNewPetName(e.target.value)}
                placeholder="给这只新朋友起个昵称"
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">动物类型</label>
              <Select value={newPetSpecies} onValueChange={(v: any) => setNewPetSpecies(v)}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="cat">猫咪</SelectItem>
                  <SelectItem value="dog">狗狗</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">毛色/花纹</label>
              <Input
                value={newPetCoat}
                onChange={(e) => setNewPetCoat(e.target.value)}
                placeholder="如：橘白相间/纯黑短毛"
                className="rounded-2xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateFromSightingOpen(false)} className="rounded-2xl">
              取消
            </Button>
            <Button onClick={handleCreatePetFromSighting} className="rounded-2xl">
              创建档案并合并
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 举报答复弹窗 */}
      <Dialog open={reportResultDialogOpen} onOpenChange={setReportResultDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-rounded font-bold text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {reportActionType === 'resolved' ? '处理举报内容' : '驳回举报'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 text-xs md:text-sm">
            <label className="font-semibold text-foreground">处理意见/答复：</label>
            <Textarea
              value={reportResultText}
              onChange={(e) => setReportResultText(e.target.value)}
              placeholder="请填写处理意见，将同步给举报人"
              rows={3}
              className="rounded-2xl resize-none"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReportResultDialogOpen(false)} className="rounded-2xl">
              取消
            </Button>
            <Button onClick={handleSubmitReportHandle} className="rounded-2xl">
              提交处理
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 领养审核与消息通知附言 Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-rounded font-bold text-lg flex items-center gap-2">
              {reviewStatus === 'approved' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  审核通过领养申请
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-destructive" />
                  审核拒绝领养申请
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              申请人：<strong>{activeAdoptionForReview?.applicant_name}</strong>（联系方式：{activeAdoptionForReview?.contact}）
              <br />
              申请领养：<strong>{activeAdoptionForReview?.pet?.name || '萌宠'}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs md:text-sm">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground flex items-center justify-between">
                <span>管理员附言 / 线下联系与答复说明：</span>
                <span className="text-[11px] text-muted-foreground font-normal">将通过消息通知推送给申请人</span>
              </label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
                placeholder="填写给申请人的审核留言、线下交接微信或原因说明..."
                className="rounded-2xl resize-none text-xs leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-muted-foreground">快捷填入：</span>
              {reviewStatus === 'approved' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setReviewNotes('初审通过！请加动协负责人微信 campus_pets_2026 预约本周家访与签署领养协议～')}
                    className="text-[11px] bg-secondary hover:bg-secondary/80 px-2 py-0.5 rounded-lg text-primary"
                  >
                    +预约家访
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewNotes('已通过！毛孩子已接种疫苗并绝育，请工作日下午前往大学生活动中心208室接宠。')}
                    className="text-[11px] bg-secondary hover:bg-secondary/80 px-2 py-0.5 rounded-lg text-primary"
                  >
                    +线下领宠
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setReviewNotes('抱歉，因宿舍暂未装配防护封窗存在坠楼隐患，本次暂未通过，加装防护后欢迎再次申请！')}
                    className="text-[11px] bg-secondary hover:bg-secondary/80 px-2 py-0.5 rounded-lg text-destructive"
                  >
                    +未封窗原因
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewNotes('感谢关注！该毛孩子已有更匹配的领养家庭正在办理交接，建议关注其他待领养毛孩子～')}
                    className="text-[11px] bg-secondary hover:bg-secondary/80 px-2 py-0.5 rounded-lg text-destructive"
                  >
                    +已有意向家庭
                  </button>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={submittingReview} onClick={() => setReviewDialogOpen(false)} className="rounded-2xl">
              取消
            </Button>
            <Button
              disabled={submittingReview}
              onClick={handleSubmitReviewAdoption}
              className={`rounded-2xl ${
                reviewStatus === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              }`}
            >
              {submittingReview ? '提交并推送中...' : '确认审核并发送通知'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除萌宠 AlertDialog */}
      <AlertDialog open={!!deletingPet} onOpenChange={(open) => !open && setDeletingPet(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-3xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-rounded font-bold text-lg">
              确认删除「{deletingPet?.name}」的档案？
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              删除后该萌宠的档案及关联信息将永久移除，此操作不可撤销，请谨慎操作。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-2xl">取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePet} className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 领养审核意见与联络反馈弹窗 */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-rounded font-bold text-lg flex items-center gap-2">
              {reviewStatus === 'approved' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  审核通过领养申请
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-destructive" />
                  审核拒绝领养申请
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              申请人：<strong>{activeAdoptionForReview?.applicant_name}</strong>（联系方式：{activeAdoptionForReview?.contact}）
              <br />
              申请领养：<strong>{activeAdoptionForReview?.pet?.name || '萌宠'}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs md:text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">审核决定：</span>
              <Button
                size="sm"
                variant={reviewStatus === 'approved' ? 'default' : 'outline'}
                onClick={() => {
                  setReviewStatus('approved');
                  setReviewNotes('恭喜！您的领养申请已审核通过，请添加动协领养负责老师微信 campus_pets_2026 预约线下见面与家访～');
                }}
                className={`h-7 rounded-xl text-xs ${reviewStatus === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
              >
                予以通过
              </Button>
              <Button
                size="sm"
                variant={reviewStatus === 'rejected' ? 'destructive' : 'outline'}
                onClick={() => {
                  setReviewStatus('rejected');
                  setReviewNotes('感谢您对校园萌宠的善意关注，经动协综合评估，当前环境条件暂未满足该毛孩子的照料要求，敬请谅解！');
                }}
                className="h-7 rounded-xl text-xs"
              >
                予以拒绝
              </Button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground">
                  管理员附言反馈（将直接推送到用户消息通知）：
                </label>
              </div>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="请填写给申请人的审核附言、后续线下交接安排或管理员微信电话..."
                rows={4}
                className="rounded-2xl resize-none text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                提示：提交后系统将即时向用户下发包含此附言的应用内消息通知，建立起与申请人直接有效的沟通。
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              variant="outline"
              disabled={submittingReview}
              onClick={() => setReviewDialogOpen(false)}
              className="rounded-2xl"
            >
              取消
            </Button>
            <Button
              onClick={handleSubmitReviewAdoption}
              disabled={submittingReview}
              className={`rounded-2xl ${reviewStatus === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'}`}
            >
              {submittingReview ? '提交并推送通知中...' : '确认审核并发送通知'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
