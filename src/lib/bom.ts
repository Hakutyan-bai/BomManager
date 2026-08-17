import type { BomItem } from "../../shared/types";

/**
 * 客户端解析 BOM 文件（.xlsx / .xls / .csv）。
 * 读取首个 sheet 为二维数组，识别表头行（跳过其上的标题/合并行），
 * 按表头别名（中文 + 英文）映射为 BomItem[]，再交给服务端匹配。
 */

type Column = "model" | "designator" | "package" | "quantity" | "remark";

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-()（）]/g, "");
}

const ALIASES: Record<Column, string[]> = {
  model: ["型号", "name", "value", "description", "partnumber", "model", "规格", "物料名称", "器件型号", "型号规格", "part", "spec"],
  designator: ["位号", "designator", "refdes", "reference", "编号", "位号编号", "器件编号"],
  package: ["封装", "footprint", "package", "pkg", "封装类型", "封装footprint", "封装尺寸"],
  quantity: ["数量", "qty", "quantity", "用量", "数量pcs", "件数"],
  remark: ["备注", "remark", "note", "notes", "说明", "描述备注"],
};

function matchColumn(header: string): Column | null {
  const h = normHeader(header);
  if (!h) return null;
  for (const col of Object.keys(ALIASES) as Column[]) {
    if (ALIASES[col].includes(h)) return col;
  }
  return null;
}

function findHeaderRow(rows: (string | number | boolean)[][]): number {
  for (let i = 0; i < rows.length; i++) {
    for (const cell of rows[i]) {
      if (typeof cell === "string" && matchColumn(cell) === "model") return i;
    }
  }
  return -1;
}

function cellAt(row: (string | number | boolean)[], idx: number | undefined): string | undefined {
  if (idx === undefined || idx < 0) return undefined;
  const v = row[idx];
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function parseQuantity(raw: string | number | boolean | undefined): number {
  if (raw === undefined) return 0;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export async function parseBomFile(data: ArrayBuffer): Promise<BomItem[]> {
  // 动态导入 xlsx（约 400KB），仅在真正解析 BOM 时加载，避免拖慢首屏。
  const XLSX = await import("xlsx");
  // cellStyles 会同时加载 !rows / !cols 元数据，skipHidden 才能识别隐藏行。
  const wb = XLSX.read(data, { type: "array", cellStyles: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("文件中没有工作表");
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(ws, {
    header: 1,
    defval: "",
    skipHidden: true,
  });

  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) throw new Error("未找到表头（需包含「型号」或 Name 列）");

  const columns = new Map<Column, number>();
  rows[headerIndex].forEach((cell, i) => {
    const col = typeof cell === "string" ? matchColumn(cell) : null;
    if (col && !columns.has(col)) columns.set(col, i);
  });

  const modelCol = columns.get("model");
  if (modelCol === undefined) throw new Error("未找到「型号」列");

  const items: BomItem[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const model = cellAt(row, modelCol);
    if (!model) continue; // 空行 / 末尾空白
    items.push({
      model,
      designator: cellAt(row, columns.get("designator")),
      package: cellAt(row, columns.get("package")),
      quantity: parseQuantity(row[columns.get("quantity") ?? -1]),
      remark: cellAt(row, columns.get("remark")),
    });
  }

  if (items.length === 0) throw new Error("未解析到任何 BOM 行");
  return items;
}
