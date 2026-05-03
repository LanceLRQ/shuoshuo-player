/**
 * 通用类型守卫：将 unknown 视图收窄为 string→unknown 的对象记录
 *
 * 用于持久化恢复路径上把从 storage.parse 出来的 JSON 节点逐层下钻——
 * setState 形参对每个 store 类型不同，这里只做"是否对象"的最低保证，
 * 具体字段形状仍由各 store 的 PersistedShape 接口在调用点收窄。
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}
