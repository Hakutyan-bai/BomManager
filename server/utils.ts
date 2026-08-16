import { badRequest } from "./errors";

/** 解析路径/查询中的正整数 ID，非法则抛 400。 */
export function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest("ID 无效");
  }
  return n;
}

/** select 类型参数的可选值以 JSON 数组字符串存储，解析为 string[]。 */
export function parseOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}
