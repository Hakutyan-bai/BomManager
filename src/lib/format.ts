/** 组合参数值 + 单位用于展示，如 "100 nF"；空值显示占位符。 */
export function formatValue(value: string, unit: string): string {
  if (!value) return "—";
  return unit ? `${value} ${unit}` : value;
}

/** 将 SQLite datetime('now')（UTC "YYYY-MM-DD HH:MM:SS"）格式化为本地时间。 */
export function formatDateTime(raw: string): string {
  if (!raw) return "—";
  const iso = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
