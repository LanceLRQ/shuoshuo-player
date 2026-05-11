import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn, LogOut, Music, Tv, Sparkles } from 'lucide-react';
import {
  AccountApi,
  useCloudServiceStore,
  useUIStore,
  NoticeType,
  getPlatformBridge,
  type CloudServiceSession,
} from '@shuoshuo-player/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import crystalHouseLogo from '@/assets/crystal-house-logo.png';

// 水晶蟹小屋官网（点击 logo 或名称跳转；通过 PlatformBridge 路由到系统浏览器/新窗口）
const CRYSTAL_HOUSE_HOMEPAGE = 'https://shuoshuo.sikong.ren';

// 与原 CloudLoginDialog 第 32-34 行保持一致：迁入着陆页内联表单后弹窗组件下线
const loginSchema = z.object({
  email: z.string().min(1, '请输入邮箱').email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function BrandHeader() {
  const handleVisitHomepage = () => {
    void getPlatformBridge().shell.openExternal(CRYSTAL_HOUSE_HOMEPAGE);
  };

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <button
        type="button"
        onClick={handleVisitHomepage}
        aria-label="访问水晶蟹小屋官网"
        className="flex flex-col items-center gap-3 rounded-lg p-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <img src={crystalHouseLogo} alt="水晶蟹小屋" className="h-24 w-24" />
        <h1 className="text-3xl font-bold tracking-tight">水晶蟹小屋</h1>
      </button>
      <p className="text-sm text-muted-foreground">欢迎访问水晶蟹小屋</p>
    </div>
  );
}

function LoginCard() {
  const updateSession = useCloudServiceStore((s) => s.updateSession);
  const sendNotice = useUIStore((s) => s.sendNotice);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setSubmitting(true);
    try {
      const session = (await AccountApi.login(data)) as CloudServiceSession;
      updateSession(session);
      sendNotice({
        type: NoticeType.SUCCESS,
        message: `欢迎回来，${session.account?.nick_name || session.account?.user_name}`,
        duration: 2000,
      });
      form.reset();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '登录失败';
      sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="h-5 w-5" />
          登录
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>密码</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '登录中…' : '登录'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function WelcomeCard() {
  const session = useCloudServiceStore((s) => s.session);
  const roleName = useCloudServiceStore((s) => s.roleName());
  const isAdmin = useCloudServiceStore((s) => s.isAdmin());
  const clearSession = useCloudServiceStore((s) => s.clearSession);
  const sendNotice = useUIStore((s) => s.sendNotice);

  const displayName =
    session.account?.nick_name || session.account?.user_name || session.account?.email;

  const handleLogout = () => {
    clearSession();
    sendNotice({
      type: NoticeType.SUCCESS,
      message: '已退出水晶蟹小屋',
      duration: 2000,
    });
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="items-center text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 text-cyan-500" />
          欢迎回来
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <span className="font-medium text-foreground">{displayName}</span>
          <Badge variant="default">{roleName}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 pt-4">
        {isAdmin && (
          <>
            <Button asChild className="w-full" variant="outline">
              <Link to="/cloud-services/lyrics">
                <Music className="mr-2 h-4 w-4" />
                进入歌词管理
              </Link>
            </Button>
            <Button asChild className="w-full" variant="outline">
              <Link to="/cloud-services/live-slicer-men">
                <Tv className="mr-2 h-4 w-4" />
                进入切片 UP 主管理
              </Link>
            </Button>
          </>
        )}
        <Button variant="ghost" className="text-destructive" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          退出登录
        </Button>
      </CardContent>
    </Card>
  );
}

export function CloudServicesIndexPage() {
  const isLogin = useCloudServiceStore((s) => s.isLogin());

  return (
    <div className="flex h-full flex-col items-center gap-8 overflow-y-auto py-8">
      <BrandHeader />
      {isLogin ? <WelcomeCard /> : <LoginCard />}
    </div>
  );
}
