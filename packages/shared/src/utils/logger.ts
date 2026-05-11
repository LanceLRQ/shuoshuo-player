import { getPlatformBridge } from '../platform';
import type { LogLevel, LoggerAdapter } from '../types';

/**
 * 跨平台 logger 入口
 *
 * 设计目标：
 * 1. 业务代码统一调用 `logger.warn(...)` / `logger.error(...)`，
 *    无须感知是否处于 Tauri / 扩展 / 测试环境
 * 2. 生产构建里 `console.debug` 会被 esbuild dead-code-elimination 剥光
 *    （受 __DEV_LOG__ gate），导致用户报 bug 时开发者无任何线索；
 *    本入口的 info/warn/error 不受 __DEV_LOG__ 控制，且会同时写入文件 adapter
 * 3. PlatformBridge.logger 不存在时（测试环境 / 扩展端）静默退化为仅 console
 *
 * 与 PlatformBridge 解耦：通过 `getPlatformBridge()` 懒拿 adapter；
 * try-catch 容错避免 bridge 未注入时业务崩溃（典型场景：测试 / SSR）
 */

function tryGetAdapter(): LoggerAdapter | undefined {
  try {
    return getPlatformBridge().logger;
  } catch {
    return undefined;
  }
}

/**
 * 序列化 data 用于 console 显示（adapter 写文件由 adapter 自己负责序列化）
 *
 * 直接对象 → console 原生展开（保留可点开的对象树）；
 * undefined → 不打印第二个参数（避免控制台显示 "undefined"）
 */
function dataForConsole(data: unknown): unknown[] {
  return data === undefined ? [] : [data];
}

export const logger = {
  /**
   * 调试级日志：仅 dev 模式输出 console，仍写入文件（如有 adapter）
   *
   * 选择"dev 才进 console"的理由：debug 量大，会刷屏掩盖关键日志；
   * 但生产排查仍需要这些上下文，所以照常写文件
   */
  debug(tag: string, message: string, data?: unknown): void {
    if (__DEV_LOG__) console.debug(`${tag} ${message}`, ...dataForConsole(data));
    tryGetAdapter()?.write('debug', tag, message, data);
  },
  /**
   * 信息级：始终 console.info + 写文件
   *
   * 适用于"用户可见但非异常"事件：重试中、缓存命中切换、风控对话框弹出等
   */
  info(tag: string, message: string, data?: unknown): void {
    console.info(`${tag} ${message}`, ...dataForConsole(data));
    tryGetAdapter()?.write('info', tag, message, data);
  },
  /**
   * 警告级：始终 console.warn + 写文件
   *
   * 适用于"可恢复异常"：网络重试失败但已 fallback、上游 5xx 但已 retry 成功等
   */
  warn(tag: string, message: string, data?: unknown): void {
    console.warn(`${tag} ${message}`, ...dataForConsole(data));
    tryGetAdapter()?.write('warn', tag, message, data);
  },
  /**
   * 错误级：始终 console.error + 写文件
   *
   * 适用于"用户感知失败"：fetchMusicUrl 三次重试均失败、风控未通过等
   */
  error(tag: string, message: string, data?: unknown): void {
    console.error(`${tag} ${message}`, ...dataForConsole(data));
    tryGetAdapter()?.write('error', tag, message, data);
  },
};

export type Logger = typeof logger;

/** 暴露 LogLevel 给业务侧透传（如自定义级别字段） */
export type { LogLevel };
