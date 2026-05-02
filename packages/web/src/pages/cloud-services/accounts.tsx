import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dayjs from 'dayjs';
import {
  Search,
  X,
  Plus,
  Edit3,
  Trash2,
  Lock,
  Unlock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  AccountApi,
  CloudServiceUserRole,
  CLOUD_SERVICE_ROLE_NAME_MAP,
  useUIStore,
  NoticeType,
  type CloudAccount,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

const PAGE_SIZE = 20;

const accountSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  user_name: z.string().min(1, '用户名不能为空').max(16, '用户名最多 16 字符'),
  nick_name: z.string().max(32, '昵称最多 32 字符').optional().or(z.literal('')),
  avatar: z.string().url('头像必须是 URL').optional().or(z.literal('')),
  role: z.union([
    z.literal(CloudServiceUserRole.User),
    z.literal(CloudServiceUserRole.Admin),
    z.literal(CloudServiceUserRole.WebMaster),
  ]),
  password: z
    .string()
    .min(8, '密码至少 8 位')
    .max(20, '密码最多 20 位')
    .optional()
    .or(z.literal('')),
});

type AccountFormData = z.infer<typeof accountSchema>;

const ROLE_OPTIONS = [
  { value: CloudServiceUserRole.User, label: CLOUD_SERVICE_ROLE_NAME_MAP[CloudServiceUserRole.User] },
  { value: CloudServiceUserRole.Admin, label: CLOUD_SERVICE_ROLE_NAME_MAP[CloudServiceUserRole.Admin] },
  {
    value: CloudServiceUserRole.WebMaster,
    label: CLOUD_SERVICE_ROLE_NAME_MAP[CloudServiceUserRole.WebMaster],
  },
] as const;

export function AccountsPage() {
  const sendNotice = useUIStore((s) => s.sendNotice);
  const openConfirm = useUIShell((s) => s.openConfirm);

  const [list, setList] = useState<CloudAccount[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [pendingKeyword, setPendingKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [editing, setEditing] = useState<CloudAccount | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      email: '',
      user_name: '',
      nick_name: '',
      avatar: '',
      role: CloudServiceUserRole.User,
      password: '',
    },
  });

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );

  const fetchList = useCallback(
    async (targetPage: number, targetKeyword: string) => {
      setIsLoading(true);
      try {
        const resp = await AccountApi.Manage.list({
          page: targetPage,
          limit: PAGE_SIZE,
          keyword: targetKeyword || undefined,
        });
        const items = resp?.result ?? resp?.list ?? [];
        setList(items as CloudAccount[]);
        setTotal(resp?.pager?.total ?? resp?.pagination?.total ?? items.length);
      } catch (e) {
        const message = (e as { message?: string })?.message ?? '加载账户列表失败';
        sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
      } finally {
        setIsLoading(false);
      }
    },
    [sendNotice],
  );

  useEffect(() => {
    void fetchList(page, keyword);
  }, [fetchList, page, keyword]);

  const handleSearch = () => {
    setPage(1);
    setKeyword(pendingKeyword.trim());
  };

  const handleClearSearch = () => {
    setPendingKeyword('');
    setKeyword('');
    setPage(1);
  };

  const handleOpenCreate = () => {
    form.reset({
      email: '',
      user_name: '',
      nick_name: '',
      avatar: '',
      role: CloudServiceUserRole.User,
      password: '',
    });
    setCreateOpen(true);
  };

  const handleOpenEdit = (account: CloudAccount) => {
    form.reset({
      email: account.email,
      user_name: account.user_name,
      nick_name: account.nick_name ?? '',
      avatar: account.avatar ?? '',
      role: Number(account.role),
      password: '',
    });
    setEditing(account);
  };

  const closeForm = () => {
    setEditing(null);
    setCreateOpen(false);
  };

  const onSubmit = async (data: AccountFormData) => {
    try {
      if (editing) {
        await AccountApi.Manage.update(editing.id, {
          email: data.email,
          user_name: data.user_name,
          nick_name: data.nick_name || undefined,
          avatar: data.avatar || undefined,
          role: data.role,
          password: data.password || undefined,
        });
        sendNotice({ type: NoticeType.SUCCESS, message: '已更新', duration: 2000 });
      } else {
        if (!data.password) {
          sendNotice({
            type: NoticeType.WARN,
            message: '新建账户必须填写密码',
            duration: 3000,
          });
          return;
        }
        await AccountApi.Manage.create({
          email: data.email,
          user_name: data.user_name,
          nick_name: data.nick_name || undefined,
          password: data.password,
          role: data.role,
        });
        sendNotice({ type: NoticeType.SUCCESS, message: '已创建', duration: 2000 });
      }
      closeForm();
      void fetchList(page, keyword);
    } catch (e) {
      const message = (e as { message?: string })?.message ?? '保存失败';
      sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
    }
  };

  const handleDelete = (account: CloudAccount) => {
    openConfirm({
      title: '删除账户',
      description: `确认删除账户 ${account.user_name}（${account.email}）？此操作不可撤销。`,
      destructive: true,
      onConfirm: async () => {
        try {
          await AccountApi.Manage.delete(account.id);
          sendNotice({ type: NoticeType.SUCCESS, message: '已删除', duration: 2000 });
          if (list.length === 1 && page > 1) {
            setPage(page - 1);
          } else {
            void fetchList(page, keyword);
          }
        } catch (e) {
          const message = (e as { message?: string })?.message ?? '删除失败';
          sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
        }
      },
    });
  };

  const handleToggleLock = (account: CloudAccount) => {
    const isLocked = (account.locked ?? 0) > 0;
    openConfirm({
      title: isLocked ? '解除封禁' : '封禁账户',
      description: isLocked
        ? `确认解除 ${account.user_name} 的封禁？`
        : `确认封禁 ${account.user_name}？被封禁的账户无法登录。`,
      destructive: !isLocked,
      onConfirm: async () => {
        try {
          if (isLocked) {
            await AccountApi.Manage.unlock(account.id);
            sendNotice({ type: NoticeType.SUCCESS, message: '已解除封禁', duration: 2000 });
          } else {
            // lockedUntilUnixSec 不传时由后端使用默认锁定期
            await AccountApi.Manage.lock(account.id);
            sendNotice({ type: NoticeType.SUCCESS, message: '已封禁', duration: 2000 });
          }
          void fetchList(page, keyword);
        } catch (e) {
          const message = (e as { message?: string })?.message ?? '操作失败';
          sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
        }
      },
    });
  };

  const formOpen = !!editing || createOpen;

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索邮箱 / 用户名"
            value={pendingKeyword}
            onChange={(e) => setPendingKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            className="pl-9"
          />
          {pendingKeyword && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={handleClearSearch}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={handleOpenCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新建账户
        </Button>
      </div>

      {/* 表格 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">头像</TableHead>
              <TableHead>用户名</TableHead>
              <TableHead>昵称</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead className="w-[100px]">角色</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[180px]">注册时间</TableHead>
              <TableHead className="w-[200px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                  <AlertCircle className="mx-auto mb-2 h-4 w-4" />
                  暂无账户
                </TableCell>
              </TableRow>
            ) : (
              list.map((account) => {
                const isLocked = (account.locked ?? 0) > 0;
                return (
                  <TableRow key={account.id}>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={account.avatar} alt={account.user_name} />
                        <AvatarFallback>{account.user_name?.[0] ?? '?'}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{account.user_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {account.nick_name || '—'}
                    </TableCell>
                    <TableCell className="text-xs">{account.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {CLOUD_SERVICE_ROLE_NAME_MAP[Number(account.role)] ?? '未知'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isLocked ? (
                        <Badge variant="destructive">已封禁</Badge>
                      ) : (
                        <Badge variant="outline">正常</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dayjs(account.created_at).format('YYYY-MM-DD HH:mm')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        title={isLocked ? '解除封禁' : '封禁'}
                        onClick={() => handleToggleLock(account)}
                      >
                        {isLocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="编辑"
                        onClick={() => handleOpenEdit(account)}
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="删除"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(account)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            共 {total} 条 / 第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* 编辑/创建弹窗 */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑账户' : '新建账户'}</DialogTitle>
            <DialogDescription>
              {editing
                ? '密码字段留空表示不修改'
                : '请填写完整信息；密码至少 8 位'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="user_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户名</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nick_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>昵称（可选）</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {editing && (
                <FormField
                  control={form.control}
                  name="avatar"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>头像 URL（可选）</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>角色</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{editing ? '重置密码（留空不修改）' : '密码'}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeForm}
                  disabled={form.formState.isSubmitting}
                >
                  取消
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  )}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
