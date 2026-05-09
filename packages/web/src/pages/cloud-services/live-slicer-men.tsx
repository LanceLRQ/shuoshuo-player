import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Search,
  X,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  LiveSlicerApi,
  UserApi,
  useUIStore,
  getBilibiliMidByURL,
  urlPrefixFixed,
  NoticeType,
  pickCloudList,
  pickCloudListTotal,
  type LiveSlicerMan,
} from '@shuoshuo-player/shared';
import { useUIShell } from '@/stores/ui-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
import { Label } from '@/components/ui/label';
import { RequireCloudAdmin } from './_require-admin';

const PAGE_SIZE = 20;

interface SlicerFormState {
  /** 编辑时为 LiveSlicerMan.id；新建时 null */
  id: number | null;
  midInput: string;
  name: string;
  face: string;
}

const EMPTY_FORM: SlicerFormState = { id: null, midInput: '', name: '', face: '' };

export function LiveSlicerMenPage() {
  return (
    <RequireCloudAdmin>
      <LiveSlicerMenPageInner />
    </RequireCloudAdmin>
  );
}

function LiveSlicerMenPageInner() {
  const sendNotice = useUIStore((s) => s.sendNotice);
  const openConfirm = useUIShell((s) => s.openConfirm);

  const [list, setList] = useState<LiveSlicerMan[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [pendingKeyword, setPendingKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [formState, setFormState] = useState<SlicerFormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const fetchList = useCallback(
    async (targetPage: number, targetKeyword: string) => {
      setIsLoading(true);
      try {
        const resp = await LiveSlicerApi.manageList({
          page: targetPage,
          limit: PAGE_SIZE,
          keyword: targetKeyword || undefined,
        });
        const items = pickCloudList<LiveSlicerMan>(resp, {
          entityKey: 'live_slicer_man',
          resultKey: 'live_slicer_men',
        });
        setList(items);
        setTotal(pickCloudListTotal(resp, items.length));
      } catch (e) {
        const message = (e as { message?: string })?.message ?? '加载切片 UP 主列表失败';
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

  const handleOpenCreate = () => setFormState({ ...EMPTY_FORM });

  const handleOpenEdit = (slicer: LiveSlicerMan) =>
    setFormState({
      id: slicer.id,
      midInput: slicer.mid,
      name: slicer.name,
      face: slicer.face,
    });

  const handleCloseForm = () => setFormState(null);

  const handleSubmit = async () => {
    if (!formState) return;
    const mid = getBilibiliMidByURL(formState.midInput.trim());
    if (!mid) {
      sendNotice({
        type: NoticeType.WARN,
        message: 'UID 解析失败：请输入纯数字 UID 或 https://space.bilibili.com/<UID>',
        duration: 3000,
      });
      return;
    }
    const userName = formState.name.trim();
    const userFace = formState.face.trim();
    setSubmitting(true);
    try {
      // 用户未手动填写 name/face 时，自动从 B 站空间接口拉取并兜底回填；
      // 手动填写的字段保留（覆盖优先），与 v1 行为一致同时兼容 v2 可编辑能力。
      let resolvedName = userName;
      let resolvedFace = userFace;
      if (!resolvedName || !resolvedFace) {
        try {
          const space = await UserApi.getUserSpaceInfo({ params: { mid } });
          if (!resolvedName) resolvedName = (space?.name ?? '').trim();
          if (!resolvedFace) {
            // 协议修正：B 站 face 偶发 `//i0.hdslb.com` 前缀，统一补 https，避免后端校验失败
            resolvedFace = urlPrefixFixed(space?.face ?? '').trim();
          }
        } catch (e) {
          // 仅在用户也未填时阻断；否则容错继续保存
          if (!userName && !userFace) {
            const message = (e as { message?: string })?.message ?? '该 B 站用户不存在或网络异常';
            sendNotice({ type: NoticeType.WARN, message, duration: 3000 });
            return;
          }
        }
      }

      const payload = {
        mid,
        name: resolvedName || undefined,
        face: resolvedFace || undefined,
      };

      if (formState.id == null) {
        await LiveSlicerApi.create(payload);
        sendNotice({ type: NoticeType.SUCCESS, message: '已创建', duration: 2000 });
      } else {
        await LiveSlicerApi.update(formState.id, payload);
        sendNotice({ type: NoticeType.SUCCESS, message: '已更新', duration: 2000 });
      }
      handleCloseForm();
      void fetchList(page, keyword);
    } catch (e) {
      const message = (e as { message?: string })?.message ?? '保存失败';
      sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (slicer: LiveSlicerMan) => {
    openConfirm({
      title: '删除切片 UP 主',
      description: `确认删除 ${slicer.name}（UID: ${slicer.mid}）？`,
      destructive: true,
      onConfirm: async () => {
        try {
          await LiveSlicerApi.delete(slicer.id);
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

  /** 从 B 站拉取最新空间信息回写云端（同步头像 / 名字） */
  const handleRefreshFromBilibili = async (slicer: LiveSlicerMan) => {
    setRefreshingId(slicer.id);
    try {
      const space = await UserApi.getUserSpaceInfo({ params: { mid: slicer.mid } });
      await LiveSlicerApi.update(slicer.id, {
        mid: slicer.mid,
        name: space.name,
        face: space.face,
      });
      sendNotice({ type: NoticeType.SUCCESS, message: '已从 B 站同步', duration: 2000 });
      void fetchList(page, keyword);
    } catch (e) {
      const message = (e as { message?: string })?.message ?? '同步失败';
      sendNotice({ type: NoticeType.ERROR, message, duration: 3000 });
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 工具栏：flex-none 固定在顶 */}
      <div className="flex flex-none items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索 UID 或名称"
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
          新建
        </Button>
      </div>

      {/* 表格：flex-1 + min-h-0 让 Table 内置滚动容器收缩到剩余高度，独立滚动 */}
      {/* wrapperClassName=h-full：让 Table 滚动 wrapper 撑满父高，sticky thead 才有滚动祖先可锚 */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-md border">
        <Table wrapperClassName="h-full">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-[64px]">头像</TableHead>
              <TableHead>名称</TableHead>
              <TableHead className="w-[120px]">UID</TableHead>
              <TableHead className="w-[140px] whitespace-nowrap">更新时间</TableHead>
              <TableHead className="w-[120px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                  <AlertCircle className="mx-auto mb-2 h-4 w-4" />
                  暂无切片 UP 主
                </TableCell>
              </TableRow>
            ) : (
              list.map((slicer) => (
                <TableRow key={slicer.id}>
                  <TableCell>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={urlPrefixFixed(slicer.face)} alt={slicer.name} />
                      <AvatarFallback>{slicer.name?.[0] ?? '?'}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={slicer.name}>
                    {slicer.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{slicer.mid}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {/* Unix 秒时间戳，dayjs 默认毫秒，必须 *1000 否则解析为 1970 */}
                    {dayjs(slicer.updated_at * 1000).format('YYYY-MM-DD HH:mm')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="从 B 站同步"
                        disabled={refreshingId === slicer.id}
                        onClick={() => void handleRefreshFromBilibili(slicer)}
                      >
                        {refreshingId === slicer.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="编辑"
                        onClick={() => handleOpenEdit(slicer)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="删除"
                        onClick={() => handleDelete(slicer)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页：flex-none 固定在底，与列表滚动区分离 */}
      {total > 0 && (
        <div className="flex flex-none items-center justify-between text-xs text-muted-foreground">
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
      <Dialog open={!!formState} onOpenChange={(o) => !o && handleCloseForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formState?.id == null ? '新建切片 UP 主' : '编辑切片 UP 主'}</DialogTitle>
            <DialogDescription>
              UID 支持纯数字或 https://space.bilibili.com/&lt;UID&gt;；名称/头像留空将自动从 B
              站拉取
            </DialogDescription>
          </DialogHeader>
          {formState && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="slicer-mid">B 站 UID / 空间 URL</Label>
                <Input
                  id="slicer-mid"
                  value={formState.midInput}
                  onChange={(e) => setFormState({ ...formState, midInput: e.target.value })}
                  placeholder="123456 或 https://space.bilibili.com/123456"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="slicer-name">名称</Label>
                <Input
                  id="slicer-name"
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  placeholder="留空将自动从 B 站空间拉取"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="slicer-face">头像 URL</Label>
                <Input
                  id="slicer-face"
                  value={formState.face}
                  onChange={(e) => setFormState({ ...formState, face: e.target.value })}
                  placeholder="https://i0.hdslb.com/..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseForm} disabled={submitting}>
              取消
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
