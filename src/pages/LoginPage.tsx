import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PawPrint, Heart } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInWithUsername, signUpWithUsername } = useAuth();
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateUsername = (v: string) => /^[a-zA-Z0-9_]{3,20}$/.test(v);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      toast.error('请输入用户名和密码');
      return;
    }
    setLoading(true);
    const { error } = await signInWithUsername(username.trim(), password);
    setLoading(false);
    if (error) {
      toast.error('用户名或密码错误');
      return;
    }
    toast.success('欢迎回来～');
    navigate('/');
  };

  const handleRegister = async () => {
    if (!validateUsername(username.trim())) {
      toast.error('用户名需为 3-20 位字母、数字或下划线');
      return;
    }
    if (password.length < 6) {
      toast.error('密码至少 6 位');
      return;
    }
    if (password !== confirm) {
      toast.error('两次输入的密码不一致');
      return;
    }
    if (!agree) {
      toast.error('请先阅读并同意用户协议与隐私政策');
      return;
    }
    setLoading(true);
    const { error } = await signUpWithUsername(username.trim(), password, nickname.trim());
    setLoading(false);
    if (error) {
      if (error.message?.includes('already')) {
        toast.error('用户名已被占用，请更换');
      } else {
        toast.error(error.message || '注册失败，请重试');
      }
      return;
    }
    toast.success('注册成功，欢迎加入守护行动～');
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-4">
            <PawPrint className="w-9 h-9 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-rounded font-bold text-foreground text-balance">校园萌宠守护档案</h1>
          <p className="text-muted-foreground mt-1 text-pretty">记录与守护校园里的每一个小生命</p>
        </div>

        <Card className="border-border/60 shadow-xl shadow-primary/5 rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-rounded">欢迎回来</CardTitle>
            <CardDescription>登录后即可收藏、评论、发布萌宠档案</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2 rounded-2xl">
                <TabsTrigger value="login" className="rounded-xl">登录</TabsTrigger>
                <TabsTrigger value="register" className="rounded-xl">注册</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">用户名</Label>
                  <Input
                    id="login-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    className="rounded-xl px-3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">密码</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="rounded-xl px-3"
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
                <Button onClick={handleLogin} disabled={loading} className="w-full rounded-xl h-11">
                  {loading ? '登录中...' : '登录'}
                </Button>
              </TabsContent>

              <TabsContent value="register" className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-nickname">昵称</Label>
                  <Input
                    id="reg-nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="给自己起个可爱的名字吧"
                    className="rounded-xl px-3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-username">用户名</Label>
                  <Input
                    id="reg-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="字母、数字或下划线，3-20 位"
                    className="rounded-xl px-3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">密码</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 6 位"
                    className="rounded-xl px-3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm">确认密码</Label>
                  <Input
                    id="reg-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="再次输入密码"
                    className="rounded-xl px-3"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="agree" checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
                  <Label htmlFor="agree" className="text-xs text-muted-foreground leading-relaxed font-normal">
                    我已阅读并同意
                    <span className="text-primary">《用户协议》</span>
                    与
                    <span className="text-primary">《隐私政策》</span>
                  </Label>
                </div>
                <Button onClick={handleRegister} disabled={loading} className="w-full rounded-xl h-11">
                  {loading ? '注册中...' : '注册并加入'}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 mt-6 text-muted-foreground text-sm">
          <Heart className="w-4 h-4 text-primary" />
          <span>用爱守护，从了解开始</span>
        </div>
      </div>
    </div>
  );
}