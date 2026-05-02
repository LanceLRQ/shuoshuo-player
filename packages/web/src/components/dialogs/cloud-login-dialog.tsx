import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AccountApi,
  useCloudServiceStore,
  useUIStore,
  NoticeType,
  type CloudServiceSession,
} from '@shuoshuo-player/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { useUIShell } from '@/stores/ui-shell';

const loginSchema = z.object({
  email: z.string().min(1, '请输入邮箱').email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function CloudLoginDialog() {
  const open = useUIShell((s) => s.cloudLoginOpen);
  const closeDialog = useUIShell((s) => s.closeCloudLogin);
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
      closeDialog();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '登录失败';
      sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : closeDialog())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>云服务登录</DialogTitle>
          <DialogDescription>
            登录后可使用歌词同步、切片管理、跨设备同步等功能
          </DialogDescription>
        </DialogHeader>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={submitting}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '登录中…' : '登录'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
