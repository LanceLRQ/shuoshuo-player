import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useFavListStore,
  useUIStore,
  getBilibiliMidByURL,
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

const favEditSchema = z
  .object({
    name: z.string().min(1, '请输入歌单名称').max(40, '名称过长'),
    type: z.enum(['custom', 'uploader', 'bili_fav']),
    /** UPLOADER 类型：UID 或空间 URL */
    midInput: z.string().optional(),
    /** BILI_FAV 类型：收藏夹 media_id */
    biliFavFolderId: z.string().optional(),
  })
  .superRefine((val: { type: string; midInput?: string; biliFavFolderId?: string }, ctx: z.RefinementCtx) => {
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
      if (!val.biliFavFolderId || !/^\d+$/.test(val.biliFavFolderId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '请输入收藏夹 ID（数字）',
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

  const editing = targetId ? favList.find((f) => f.id === targetId) ?? null : null;
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
  }, [open, editing, prefill, form]);

  const onSubmit = (data: FavEditFormData) => {
    if (isEdit && editing) {
      // 编辑模式仅修改名称（type / mid 不可改）
      modFavList(editing.id, data.name);
      sendNotice({ type: NoticeType.SUCCESS, message: '歌单已更新', duration: 2000 });
      close();
      return;
    }
    const type = TYPE_TO_ENUM[data.type];
    const mid = type === FavListType.UPLOADER ? getBilibiliMidByURL(data.midInput ?? '') : undefined;
    const created = addFavList({
      name: data.name,
      type,
      mid,
      biliFavFolderId:
        type === FavListType.BILI_FAV ? (data.biliFavFolderId ?? '') : undefined,
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

  const watchType = form.watch('type');

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

            {!isEdit && watchType === 'uploader' && (
              <FormField
                control={form.control}
                name="midInput"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UP 主 UID 或空间链接</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://space.bilibili.com/123456 或 123456"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>支持纯数字 UID 或完整空间 URL</FormDescription>
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
                    <FormLabel>收藏夹 ID</FormLabel>
                    <FormControl>
                      <Input placeholder="纯数字 media_id" {...field} />
                    </FormControl>
                    <FormDescription>从 B 站收藏夹 URL 中复制 media_id</FormDescription>
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

function RadioOption({
  value,
  label,
  current,
}: {
  value: string;
  label: string;
  current: string;
}) {
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
