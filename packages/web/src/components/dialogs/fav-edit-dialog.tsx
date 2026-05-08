import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useFavListStore,
  useUIStore,
  useBilibiliUserStore,
  getBilibiliMidByURL,
  UserApi,
  FavListType,
  NoticeType,
} from '@shuoshuo-player/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
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
  FormDescription,
} from '@/components/ui/form';
import { useUIShell } from '@/stores/ui-shell';

interface FavFolderItem {
  id: number;
  title: string;
  media_count: number;
}

const favEditSchema = z
  .object({
    name: z.string().max(40, '名称过长'),
    type: z.enum(['custom', 'uploader', 'bili_fav']),
    /** UPLOADER 类型：UID 或空间 URL */
    midInput: z.string().optional(),
    /** BILI_FAV 类型：收藏夹 media_id（来自列表选中） */
    biliFavFolderId: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    // name 仅在 custom 模式强制；uploader / bili_fav 由提交时注入 UP 主昵称或收藏夹标题
    if (val.type === 'custom' && !val.name.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请输入歌单名称',
        path: ['name'],
      });
    }
    if (val.type === 'uploader') {
      const mid = getBilibiliMidByURL(val.midInput ?? '');
      if (!mid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '请输入有效的 UP 主 UID 或空间链接',
          path: ['midInput'],
        });
      }
    } else if (val.type === 'bili_fav') {
      if (!val.biliFavFolderId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '请从下方列表选择一个收藏夹',
          path: ['biliFavFolderId'],
        });
      }
    }
  });

type FavEditFormData = z.infer<typeof favEditSchema>;

const TYPE_TO_ENUM: Record<FavEditFormData['type'], FavListType> = {
  custom: FavListType.CUSTOM,
  uploader: FavListType.UPLOADER,
  bili_fav: FavListType.BILI_FAV,
};
const ENUM_TO_TYPE: Record<FavListType, FavEditFormData['type']> = {
  [FavListType.CUSTOM]: 'custom',
  [FavListType.UPLOADER]: 'uploader',
  [FavListType.BILI_FAV]: 'bili_fav',
};

export function FavEditDialog() {
  const open = useUIShell((s) => s.favEditOpen);
  const targetId = useUIShell((s) => s.favEditTargetId);
  const prefill = useUIShell((s) => s.favEditPrefill);
  const close = useUIShell((s) => s.closeFavEdit);
  const favList = useFavListStore((s) => s.list);
  const addFavList = useFavListStore((s) => s.addFavList);
  const modFavList = useFavListStore((s) => s.modFavList);
  const sendNotice = useUIStore((s) => s.sendNotice);

  const editing = targetId ? (favList.find((f) => f.id === targetId) ?? null) : null;
  const isEdit = !!editing;

  const form = useForm<FavEditFormData>({
    resolver: zodResolver(favEditSchema),
    defaultValues: {
      name: '',
      type: 'custom',
      midInput: '',
      biliFavFolderId: '',
    },
  });

  // B 站收藏夹列表本地状态（仅本对话框使用，不下沉到 store）
  const [favFolders, setFavFolders] = useState<FavFolderItem[]>([]);
  const [favLoading, setFavLoading] = useState(false);
  const [favError, setFavError] = useState<string | null>(null);
  const [selectedFavTitle, setSelectedFavTitle] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        type: ENUM_TO_TYPE[editing.type],
        midInput: editing.mid ?? '',
        biliFavFolderId: editing.biliFavFolderId ?? '',
      });
    } else {
      form.reset({
        name: prefill?.name ?? '',
        type: prefill?.type !== undefined ? ENUM_TO_TYPE[prefill.type] : 'custom',
        midInput: prefill?.midInput ?? '',
        biliFavFolderId: '',
      });
    }
    // 每次打开对话框清空收藏夹缓存，避免登录账号切换后看到 stale 列表
    setFavFolders([]);
    setFavError(null);
    setSelectedFavTitle('');
  }, [open, editing, prefill, form]);

  const watchType = form.watch('type');

  // 切到 bili_fav 时按需拉取登录用户的收藏夹列表
  useEffect(() => {
    if (!open || isEdit || watchType !== 'bili_fav') return;
    if (favFolders.length > 0 || favLoading) return;
    const mid = useBilibiliUserStore.getState().current?.mid;
    if (!mid) {
      setFavError('未获取到 B 站登录信息');
      return;
    }
    setFavLoading(true);
    setFavError(null);
    UserApi.getMyFavoriteFolder({ params: { up_mid: mid } })
      .then((res) => {
        setFavFolders(res?.list ?? []);
      })
      .catch(() => {
        setFavError('加载收藏夹失败，请重试');
      })
      .finally(() => {
        setFavLoading(false);
      });
  }, [open, isEdit, watchType, favFolders.length, favLoading]);

  const handleSelectFavFolder = (item: FavFolderItem) => {
    form.setValue('biliFavFolderId', String(item.id), { shouldValidate: true });
    setSelectedFavTitle(item.title);
  };

  const handleRetryLoadFolders = () => {
    setFavError(null);
    setFavFolders([]);
  };

  const onSubmit = async (data: FavEditFormData) => {
    if (isEdit && editing) {
      // 编辑模式仅修改名称（type / mid 不可改）
      modFavList(editing.id, data.name);
      sendNotice({ type: NoticeType.SUCCESS, message: '歌单已更新', duration: 2000 });
      close();
      return;
    }
    const type = TYPE_TO_ENUM[data.type];
    const mid =
      type === FavListType.UPLOADER ? getBilibiliMidByURL(data.midInput ?? '') : undefined;

    // 名称策略：custom 用用户输入；uploader 用 UP 主昵称；bili_fav 用收藏夹标题（均允许后续编辑）
    let finalName = data.name;
    if (type === FavListType.BILI_FAV) {
      finalName = selectedFavTitle;
    } else if (type === FavListType.UPLOADER && mid) {
      try {
        const space = await UserApi.getUserSpaceInfo({ params: { mid } });
        finalName = space?.name?.trim() || `UP 主 ${mid}`;
      } catch {
        finalName = `UP 主 ${mid}`;
      }
    }

    if (!finalName) {
      sendNotice({
        type: NoticeType.ERROR,
        message: type === FavListType.BILI_FAV ? '请先选择一个收藏夹' : '请输入歌单名称',
        duration: 3000,
      });
      return;
    }
    const created = addFavList({
      name: finalName,
      type,
      mid,
      biliFavFolderId: type === FavListType.BILI_FAV ? (data.biliFavFolderId ?? '') : undefined,
      bv_ids: [],
    });
    if (!created) {
      sendNotice({
        type: NoticeType.ERROR,
        message: '创建失败，UP 主 UID 与主歌单冲突或为空',
        duration: 3000,
      });
      return;
    }
    sendNotice({ type: NoticeType.SUCCESS, message: '歌单已创建', duration: 2000 });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑歌单' : '创建歌单'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '编辑模式下仅可修改歌单名称' : '选择歌单类型并填写信息'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!isEdit && (
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>歌单类型</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="grid grid-cols-3 gap-2"
                      >
                        <RadioOption value="custom" label="自定义" current={field.value} />
                        <RadioOption value="uploader" label="UP 主投稿" current={field.value} />
                        <RadioOption value="bili_fav" label="B 站收藏夹" current={field.value} />
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {(isEdit || watchType === 'custom') && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>歌单名称</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!isEdit && watchType === 'uploader' && (
              <FormField
                control={form.control}
                name="midInput"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UP 主 UID 或空间链接</FormLabel>
                    <FormControl>
                      <Input placeholder="https://space.bilibili.com/123456 或 123456" {...field} />
                    </FormControl>
                    <FormDescription>
                      支持纯数字 UID 或完整空间 URL；歌单名称会自动使用 UP 主昵称（创建后可编辑）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!isEdit && watchType === 'bili_fav' && (
              <FormField
                control={form.control}
                name="biliFavFolderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>选择 B 站收藏夹</FormLabel>
                    <FormControl>
                      <FavFolderList
                        folders={favFolders}
                        loading={favLoading}
                        error={favError}
                        selectedId={field.value ?? ''}
                        onSelect={handleSelectFavFolder}
                        onRetry={handleRetryLoadFolders}
                      />
                    </FormControl>
                    <FormDescription>歌单名称会自动沿用所选收藏夹标题</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                取消
              </Button>
              <Button type="submit">{isEdit ? '保存' : '创建'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function RadioOption({ value, label, current }: { value: string; label: string; current: string }) {
  const id = `fav-type-${value}`;
  return (
    <Label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${current === value ? 'border-primary bg-primary/10' : 'border-input'}`}
    >
      <RadioGroupItem id={id} value={value} />
      {label}
    </Label>
  );
}

function FavFolderList({
  folders,
  loading,
  error,
  selectedId,
  onSelect,
  onRetry,
}: {
  folders: FavFolderItem[];
  loading: boolean;
  error: string | null;
  selectedId: string;
  onSelect: (item: FavFolderItem) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-md border border-input px-3 py-6 text-center text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm">
        <span className="text-destructive">{error}</span>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          重试
        </Button>
      </div>
    );
  }
  if (folders.length === 0) {
    return (
      <div className="rounded-md border border-input px-3 py-6 text-center text-sm text-muted-foreground">
        暂无可用收藏夹
      </div>
    );
  }
  return (
    <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-input p-1">
      {folders.map((item) => {
        const checked = selectedId === String(item.id);
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => onSelect(item)}
            className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${checked ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent'}`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${checked ? 'border-primary' : 'border-input'}`}
            >
              {checked ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
            </span>
            <span className="flex-1 truncate">{item.title}</span>
            <span className="text-xs text-muted-foreground">{item.media_count} 个视频</span>
          </button>
        );
      })}
    </div>
  );
}
