import { invoke } from '@tauri-apps/api/core';
import type { LogLevel, LoggerAdapter } from '@shuoshuo-player/shared';

/**
 * Tauri 端日志适配器
 *
 * 通过 invoke Rust 命令把日志 append 到当日文件，生产构建也能保留排查线索。
 * write() 内部不 await（fire-and-forget），避免业务调用 logger.warn() 时引入
 * IPC 往返延迟；IPC 失败仅退化为 console 输出（logger 入口已经先 console，
 * 这里失败不影响主流程）。
 *
 * data 序列化为 JSON 字符串再传给 Rust：Tauri IPC 默认会 JSON 序列化参数，
 * 但 data 可能含循环引用 / BigInt 等不可序列化值；我们在前端先安全序列化，
 * 失败则降级为 String(data)，避免整条日志因序列化错误丢失。
 */
export class TauriLoggerAdapter implements LoggerAdapter {
  write(level: LogLevel, tag: string, message: string, data?: unknown): void {
    const dataJson = serializeData(data);
    // 不 await：日志 IPC 失败不应阻塞业务；invoke 内部异常静默吞掉
    invoke<void>('log_write', {
      level,
      tag,
      message,
      dataJson,
    }).catch(() => {
      // 写日志的日志只能落到 console（避免无限递归）
    });
  }

  async readAll(): Promise<string | null> {
    try {
      return await invoke<string>('log_read_all');
    } catch {
      return null;
    }
  }

  async clear(): Promise<boolean> {
    try {
      await invoke<void>('log_clear');
      return true;
    } catch {
      return false;
    }
  }

  async getDir(): Promise<string | null> {
    try {
      return await invoke<string>('log_get_dir');
    } catch {
      return null;
    }
  }

  /**
   * 在系统文件管理器中打开日志目录
   *
   * 走 Rust 端命令而不是 plugin-shell.open()：v2 shell:allow-open 默认仅允许 HTTPS URL，
   * 本地路径需要配 scope；用 std::process::Command 更稳且无权限边界问题。
   */
  async openDir(): Promise<boolean> {
    try {
      await invoke<void>('log_open_dir');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 把任意 data 安全序列化为 JSON 字符串
 *
 * - undefined / null → 空串（Rust 端会跳过 `|` 分隔符）
 * - JSON.stringify 抛错（循环引用 / BigInt）→ 降级为 String(data) 防止整条日志丢失
 * - Error 实例特殊处理：保留 name / message / stack 摘要
 */
function serializeData(data: unknown): string {
  if (data === undefined || data === null) return '';
  if (data instanceof Error) {
    return JSON.stringify({
      name: data.name,
      message: data.message,
      stack: data.stack?.split('\n').slice(0, 5).join('\n'),
    });
  }
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}
