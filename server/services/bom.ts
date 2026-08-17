import type { BomItem, BomMatchResponse, BomMatched } from "../../shared/types";
import * as materialRepo from "../repos/materials";

/**
 * BOM 匹配服务：把自由文本/EE 导出的 BOM 行匹配到物料库。
 *
 * 核心思路是「规格值 + 封装」的精准匹配，而非名称模糊比对：
 *  - 把 BOM 型号（Name/型号）与物料参数（阻值/容量/电感量…）统一换算成
 *    基准单位的数值（电阻→Ω、电容→pF、电感→nH），再做数值相等判断，
 *    从而正确处理 0.1uF↔100nF、4.7kΩ↔4700Ω 等单位换算。
 *  - 主规格（Ω/F/H）命中后，再叠加封装（Footprint/封装）加分，保证同一
 *    阻值不同封装的物料也能被准确区分。
 *  - 型号里的值也可能直接写在物料名称里（如「4.7k欧电阻」），因此名称也参与
 *    规格抽取，作为参数值的补充。
 * 结果供人工复核，匹配到多个候选时取最优一个。
 */

// ---------- 文本折叠与单位解析 ----------

/** 欧姆（希腊/中文/英文写法）统一折叠为 "ohm"；注意「欧姆」须先于「欧」替换。 */
const OHM_FOLD_RE = /[ΩωΩ欧]/g;

/** 微符号统一为 "u"。 */
const MICRO_RE = /[µμ]/g;

/** 折叠单位字形，保留前缀字母的大小写（K/M 与 k/m 含义不同）。 */
function foldText(s: string): string {
  return s
    .replace(/欧姆/g, "ohm")
    .replace(OHM_FOLD_RE, "ohm")
    .replace(/ohm/gi, "ohm")
    .replace(MICRO_RE, "u");
}

/** 自由文本归一化（用于名称比较）：折叠字形 + 小写 + 去空白与常见分隔符。 */
export function normalize(s: string): string {
  return foldText(s)
    .toLowerCase()
    .replace(/[\s_/\\]/g, "");
}

/** 主规格单位族；ohm/f/h 能唯一定位电阻/电容/电感，视为「主规格」。 */
type Family = "ohm" | "f" | "h" | "v" | "a" | "w" | "pct" | "other";

/** 前缀到基准单位的倍率：ohm→Ω、f→pF、h→nH。 */
const BASE_MULT: Record<string, Record<string, number>> = {
  ohm: { p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3, "": 1, k: 1e3, M: 1e6 },
  f: { p: 1, n: 1e3, u: 1e6, m: 1e9, "": 1e12, k: 1e15 },
  h: { p: 1e-3, n: 1, u: 1e3, m: 1e6, "": 1e9 },
};

interface ParsedUnit {
  family: Family;
  mult: number;
}

/** 解析单位字符串（如 "kΩ"→{ohm,1e3}、"nF"→{f,1e3}、"V"→{v,1}）。 */
function parseUnit(raw: string): ParsedUnit | null {
  const u = foldText(raw).trim();
  if (!u) return null;
  const m = /^([pPnNuUmMkK]?)([a-zA-Z%]+)$/.exec(u);
  if (!m) return null;
  const prefixRaw = m[1] ?? "";
  const base = m[2].toLowerCase();

  let family: Family;
  if (base === "ohm") family = "ohm";
  else if (base === "f") family = "f";
  else if (base === "h") family = "h";
  else if (base === "v") family = "v";
  else if (base === "a") family = "a";
  else if (base === "w") family = "w";
  else if (base === "%") family = "pct";
  else if (base === "m" || base === "pin") family = "other";
  else return null;

  if (family === "ohm" || family === "f" || family === "h") {
    const key = prefixRaw === "M" ? "M" : prefixRaw.toLowerCase();
    return { family, mult: BASE_MULT[family][key] };
  }
  return { family, mult: 1 }; // 弱单位不做换算
}

/** 解析前导数字；无法解析时返回 null。 */
function parseNumber(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const m = /^[-+]?(\d+(?:\.\d+)?)/.exec(t);
  return m ? Number(m[1]) : null;
}

/** 规格值：主规格换算为基准单位数值，弱单位保留原值。 */
interface SpecValue {
  family: Family;
  value: number;
  primary: boolean;
}

/** 从「值 + 单位」构造规格值；无单位/非数值则返回 null（如封装选项、零件号数字）。 */
function specValue(value: string, unit: string): SpecValue | null {
  const num = parseNumber(value);
  if (num == null) return null;
  const pu = parseUnit(unit);
  if (!pu) return null;
  const primary = pu.family === "ohm" || pu.family === "f" || pu.family === "h";
  return { family: pu.family, value: num * pu.mult, primary };
}

/**
 * 从自由文本中抽取全部规格值，支持：
 *  - 标准记法：47Ω / 4.7kΩ / 4.7K / 100nF / 2.2uF / 20R / 1M / 10K / 47欧 / 10欧姆 / 100nf
 *  - 欧洲记法：4K7（4.7kΩ）/ 1R2（1.2Ω）/ 4u7（4.7uF）
 * 裸数字（零件号里的数字、封装尺寸等）会被忽略。
 */
export function extractSpecValues(text: string): SpecValue[] {
  const src = foldText(text);
  const out: SpecValue[] = [];

  // 欧洲记法：数字 + 分隔字母 + 数字 → 小数规格。先抽取并掩蔽，避免标准记法重复解析。
  const euro = /(\d+)\s*([rRkKmMuUnNpP])\s*(\d+)/g;
  for (const m of src.matchAll(euro)) {
    const val = Number(`${m[1]}.${m[3]}`);
    const lower = m[2].toLowerCase();
    let family: Family;
    let mult: number;
    if (lower === "r") { family = "ohm"; mult = 1; }
    else if (lower === "k") { family = "ohm"; mult = 1e3; }
    else if (m[2] === "M") { family = "ohm"; mult = 1e6; }
    else if (m[2] === "m") { family = "ohm"; mult = 1e-3; }
    else if (lower === "u") { family = "f"; mult = 1e6; }
    else if (lower === "n") { family = "f"; mult = 1e3; }
    else if (lower === "p") { family = "f"; mult = 1; }
    else continue;
    out.push({ family, value: val * mult, primary: true });
  }
  const masked = src.replace(/(\d+)\s*([rRkKmMuUnNpP])\s*(\d+)/g, " ");

  // 标准记法：数字 + 可选前缀 + 可选单位。
  const std = /(\d+(?:\.\d+)?)\s*([pPnNuUmMkK]?)\s*(ohm|[fFhHvVaAwW%]|[rR])/g;
  for (const m of masked.matchAll(std)) {
    const num = Number(m[1]);
    const prefixRaw = m[2] ?? "";
    const unitRaw = m[3];

    // "R"/"r" 后缀 = 欧姆；允许 33KR / 1MR 这类带倍率前缀的写法。
    if (/^[rR]$/.test(unitRaw)) {
      const key = prefixRaw === "M" ? "M" : prefixRaw.toLowerCase();
      const mult = BASE_MULT.ohm[key];
      if (mult !== undefined) out.push({ family: "ohm", value: num * mult, primary: true });
      continue;
    }
    const pu = parseUnit(prefixRaw + unitRaw);
    if (pu) {
      out.push({ family: pu.family, value: num * pu.mult, primary: pu.family === "ohm" || pu.family === "f" || pu.family === "h" });
    }
  }

  // 裸前缀（无单位）且为 K/k/M 时视为电阻值：10K / 1M / 4.7k。
  const bare = /(\d+(?:\.\d+)?)\s*([kKM])(?![a-zA-Z%])/g;
  for (const m of masked.matchAll(bare)) {
    out.push({ family: "ohm", value: Number(m[1]) * (m[2] === "M" ? 1e6 : 1e3), primary: true });
  }

  return out;
}

// ---------- 分类推断 ----------

/** 从位号前缀推断分类（EE 约定：R/C/L/D/Q/U/LED/J…）。 */
export function inferCategoryFromDesignator(designator: string): string | null {
  const first = (designator.match(/[A-Za-z]+/) ?? [""])[0].toLowerCase();
  if (!first) return null;
  if (first.startsWith("led")) return "贴片LED";
  if (/^(j|cn|conn|rj|dc|con)/.test(first)) return "连接器";
  if (first.startsWith("r")) return "电阻";
  if (first.startsWith("c")) return "电容";
  if (first.startsWith("l")) return "电感";
  if (first.startsWith("d")) return "二极管";
  if (first.startsWith("q")) return "MOSFET";
  if (first.startsWith("u")) return "IC";
  if (first.startsWith("t")) return "三极管";
  return null;
}

/** 从型号文本（中文类型词）推断分类。 */
export function inferCategoryFromName(model: string): string | null {
  if (/发光二极管|LED/i.test(model)) return "贴片LED";
  if (/二极管/.test(model)) return "二极管";
  if (/三极管/.test(model)) return "三极管";
  if (/MOS|场效应/i.test(model)) return "MOSFET";
  if (/电容/.test(model)) return "电容";
  if (/电阻/.test(model)) return "电阻";
  if (/电感/.test(model)) return "电感";
  if (/连接器|排针|排座|插座|端子|接插件/.test(model)) return "连接器";
  if (/稳压器|LDO|芯片|开发板|模块|传感器|IC/i.test(model)) return "IC";
  return null;
}

/** 从封装前缀推断分类（RES/CAP/IND/SOT/SOD…）。 */
export function inferCategoryFromPackage(pkg: string): string | null {
  const p = normalize(pkg);
  if (/^(led|res|r)/.test(p)) return p.startsWith("led") ? "贴片LED" : "电阻";
  if (/^(cap|c)/.test(p)) return "电容";
  if (/^(ind|l)/.test(p)) return "电感";
  if (/^sod/.test(p)) return "二极管";
  if (/^sot/.test(p)) return "三极管";
  if (/^(soic|sop|qfn|tqfn|dip|dfn|pdfn)/.test(p)) return "IC";
  if (/^(conn|rj|usb|dc-in|con)/.test(p)) return "连接器";
  return null;
}

/** 汇总三种来源推断的分类（位号 > 型号类型词 > 封装前缀）。 */
function inferCategories(item: BomItem): Set<string> {
  const found =
    inferCategoryFromDesignator(item.designator ?? "") ??
    inferCategoryFromName(item.model) ??
    inferCategoryFromPackage(item.package ?? "");
  return found ? new Set([found]) : new Set();
}

/** 型号是否含中文类型词/LED（通用描述型，如「发光二极管」「电阻」），而非具体零件号。 */
function isGenericModel(model: string): boolean {
  return inferCategoryFromName(model) !== null;
}

/**
 * 是否为「电压额定值」参数（额定电压/反向耐压/漏源电压/集射极电压…）。
 * 「正向压降」是电气特性而非额定值，不属于此类（其名称不含「电压/耐压」）。
 */
function isVoltageRating(name: string): boolean {
  return name.includes("耐压") || name.includes("电压");
}

// ---------- 匹配 ----------

/** 相对误差 ≤ 1e-6 视为规格值相等（兼容浮点换算误差）。 */
function approxEqual(a: number, b: number): boolean {
  if (a === b) return true;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= 1e-6 * scale;
}

interface MaterialForMatch {
  id: number;
  code: string;
  name: string;
  categoryName: string;
  quantity: number;
  /** 主规格值（阻值/容量/电感量，已换算基准单位）。 */
  primaryValues: SpecValue[];
  /** 次要规格值（V/A/W/% 等）。 */
  secondaryValues: SpecValue[];
  packageNorm: string;
  /** 电压额定值（额定电压/反向耐压等，单位 V）；BOM 需求电压不得超过它。null 表示未填。 */
  voltageRating: number | null;
  /** 参数 + 封装的紧凑展示（如「100nF · 25V · 0603」），供前端直接显示。 */
  params: string;
}

/** 规范化封装/Footprint，用于子串匹配：去空白、下划线、斜杠，保留短横线（SOT-23）。 */
function normalizePackage(s: string): string {
  return s.toLowerCase().replace(/[\s_/\\]/g, "");
}

// ---------- 封装替代 ----------

/** 贴片尺寸阶梯（小→大）。相邻档位可向下替代：无 0805 可用 0603，但不能用 0402。 */
const SMD_SIZE_LADDER = ["0201", "0402", "0603", "0805", "1206", "1210", "2010", "2512"];

/** 从封装字符串提取标准贴片尺寸（4 位数字且落在阶梯内），否则返回 null。 */
function extractFootprintSize(pkg: string): string | null {
  const m = /\d{4}/.exec(pkg);
  if (!m) return null;
  const size = m[0];
  return SMD_SIZE_LADDER.includes(size) ? size : null;
}

/**
 * 封装关系判定：
 *  - unknown：任一方缺封装，不做判断；
 *  - exact：归一化后子串命中（如 R0603 ↔ 0603）；
 *  - substitute：物料封装比需求小一档（可替代）；
 *  - mismatch：其余（更大、小两档以上、非贴片尺寸）。
 */
function packageRelation(bomPkg: string, matPkg: string): "unknown" | "exact" | "substitute" | "mismatch" {
  if (bomPkg === "" || matPkg === "") return "unknown";
  if (bomPkg.includes(matPkg) || matPkg.includes(bomPkg)) return "exact";
  const b = extractFootprintSize(bomPkg);
  const m = extractFootprintSize(matPkg);
  if (b && m) {
    const diff = SMD_SIZE_LADDER.indexOf(b) - SMD_SIZE_LADDER.indexOf(m);
    if (diff === 1) return "substitute";
  }
  return "mismatch";
}

interface MatchEvaluation {
  score: number;
  substituteReasons: string[];
}

const SOFT_SPEC_LABELS: Partial<Record<Family, string>> = {
  pct: "容差/精度不同",
  w: "功率不同",
  a: "电流不同",
};

/**
 * 校验封装与次要规格，并返回需要人工确认的原因。
 * 电压是硬下限：低于需求或额定值未知时拒绝，高于需求时可替代。
 * 容差、功率、电流不一致或未填写时不拒绝，但必须标为可替代。
 */
function evaluateCompatibility(
  item: BomItem,
  m: MaterialForMatch,
  bomSecondary: SpecValue[],
  allowPackageSubstitute: boolean,
): { packageExact: boolean; secondaryOverlap: number; substituteReasons: string[] } | null {
  const reasons: string[] = [];
  const relation = packageRelation(normalizePackage(item.package ?? ""), m.packageNorm);
  if (relation === "mismatch") return null;
  if (relation === "substitute") {
    if (!allowPackageSubstitute) return null;
    reasons.push("封装小一档");
  }

  const bomVoltages = bomSecondary.filter((s) => s.family === "v").map((s) => s.value);
  if (bomVoltages.length > 0) {
    const required = Math.max(...bomVoltages);
    if (m.voltageRating == null || (m.voltageRating < required && !approxEqual(m.voltageRating, required))) {
      return null;
    }
    if (!approxEqual(m.voltageRating, required)) reasons.push("耐压高于需求");
  }

  let secondaryOverlap = 0;
  for (const family of ["pct", "w", "a"] as const) {
    const requiredValues = bomSecondary.filter((s) => s.family === family);
    if (requiredValues.length === 0) continue;
    const exact = requiredValues.some((required) =>
      m.secondaryValues.some((actual) => actual.family === family && approxEqual(actual.value, required.value)),
    );
    if (exact) secondaryOverlap++;
    else reasons.push(SOFT_SPEC_LABELS[family]!);
  }

  return { packageExact: relation === "exact", secondaryOverlap, substituteReasons: reasons };
}

/**
 * 计算单个物料对单个 BOM 行的匹配得分；0 表示不匹配。
 *
 * 名称、主规格与分类决定候选强度；封装、电压及其它电气规格统一在
 * evaluateCompatibility 中判断为「精确」「可替代」或「拒绝」。
 */
function evaluateMatch(item: BomItem, m: MaterialForMatch, categories: Set<string>): MatchEvaluation | null {
  const nameNorm = normalize(item.model);
  const mNameNorm = normalize(m.name);
  const bomSpecs = extractSpecValues(item.model);
  const bomPrimary = bomSpecs.filter((s) => s.primary);
  const bomSecondary = bomSpecs.filter((s) => !s.primary);
  const exactName = nameNorm !== "" && nameNorm === mNameNorm;
  const primaryHit = bomPrimary.some((bp) =>
    m.primaryValues.some((v) => v.family === bp.family && approxEqual(v.value, bp.value)),
  );

  // 只要 BOM 中存在可解析的主规格，就必须与物料参数等值；名称相同也不能绕过。
  if (bomPrimary.length > 0 && !primaryHit) return null;

  let score = 0;
  if (exactName) {
    score = 100;
  } else if (bomPrimary.length > 0) {
    score = 55;
  } else if (
    nameNorm.length >= 3 &&
    mNameNorm.length >= 3 &&
    (nameNorm.includes(mNameNorm) || mNameNorm.includes(nameNorm))
  ) {
    score = 30;
  }

  // 电阻/电容/电感通过主规格确认同类；贴片 LED 可通过分类确认同类。
  // 其它无主规格分类仍不允许仅凭封装做替代，避免宽泛误配。
  const ledCategoryMatch = categories.has("贴片LED") && m.categoryName === "贴片LED";
  const compatibility = evaluateCompatibility(item, m, bomSecondary, primaryHit || ledCategoryMatch);
  if (!compatibility) return null;

  // 通用描述型必须能由分类 + 精确封装定位，不能只凭一个宽泛名称匹配。
  if (
    score === 0 &&
    isGenericModel(item.model) &&
    categories.size > 0 &&
    categories.has(m.categoryName) &&
    (compatibility.packageExact ||
      (ledCategoryMatch && compatibility.substituteReasons.includes("封装小一档")))
  ) {
    score = 20;
  }
  if (score === 0) return null;

  if (compatibility.packageExact) score += 15;
  score += Math.min(compatibility.secondaryOverlap, 2) * 5;
  if (categories.size > 0 && categories.has(m.categoryName)) score += 10;
  return { score, substituteReasons: compatibility.substituteReasons };
}

/**
 * 计算单个物料对单个 BOM 行的精确匹配得分；保留导出供测试/调试使用。
 * 需要人工确认的候选不会作为精确匹配返回分数。
 */
export function matchScore(item: BomItem, m: MaterialForMatch, categories: Set<string>): number {
  const result = evaluateMatch(item, m, categories);
  return result && result.substituteReasons.length === 0 ? result.score : 0;
}

/** 从物料行 + 参数值构建匹配用的内部表示。 */
function toMaterialForMatch(
  row: { id: number; code: string; name: string; category_name: string; quantity: number },
  attrs: { name: string; value: string; unit: string }[],
): MaterialForMatch {
  const primaryValues: SpecValue[] = [];
  const secondaryValues: SpecValue[] = [];
  const seen = new Set<string>();
  let packageNorm = "";
  let voltageRating: number | null = null;

  // 参数 + 封装的紧凑展示：值 + 单位（无单位只留值），跳过空值。
  const params = attrs
    .map((a) => {
      const v = a.value.trim();
      if (!v) return "";
      const u = a.unit ?? "";
      return u ? `${v}${u}` : v;
    })
    .filter((s) => s !== "")
    .join(" · ");

  const push = (sv: SpecValue) => {
    const key = `${sv.family}:${sv.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    (sv.primary ? primaryValues : secondaryValues).push(sv);
  };

  for (const a of attrs) {
    if (a.name === "封装" && a.value.trim() !== "") {
      packageNorm = normalizePackage(a.value);
      continue;
    }
    const sv = specValue(a.value, a.unit);
    if (!sv) continue;
    push(sv);
    if (sv.family === "v" && isVoltageRating(a.name)) {
      voltageRating = voltageRating == null ? sv.value : Math.max(voltageRating, sv.value);
    }
  }
  // 名称里也可能直接含规格（如「4.7k欧电阻」），作为参数值的补充。
  for (const sv of extractSpecValues(row.name)) push(sv);

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    categoryName: row.category_name,
    quantity: row.quantity,
    primaryValues,
    secondaryValues,
    packageNorm,
    voltageRating,
    params,
  };
}

/** 把命中的物料组装成响应摘要（替代物与精确匹配共用同一结构）。 */
function buildMatched(item: BomItem, m: MaterialForMatch, substituteReasons: string[] = []): BomMatched {
  return {
    bom: item,
    material: {
      id: m.id,
      code: m.code,
      name: m.name,
      categoryName: m.categoryName,
      stock: m.quantity,
      params: m.params,
    },
    shortfall: Math.max(0, item.quantity - m.quantity),
    substituteReasons,
  };
}

/** 对一批 BOM 行执行匹配，返回四分结果（有 / 可替代 / 缺货 / 未收录）。 */
export function matchBomItems(
  materials: MaterialForMatch[],
  items: BomItem[],
): BomMatchResponse {
  const have: BomMatched[] = [];
  const substitute: BomMatched[] = [];
  const outOfStock: BomMatched[] = [];
  const notFound: BomItem[] = [];

  for (const item of items) {
    const categories = inferCategories(item);
    let bestExact: { material: MaterialForMatch; evaluation: MatchEvaluation } | null = null;
    let bestSub: { material: MaterialForMatch; evaluation: MatchEvaluation } | null = null;
    for (const m of materials) {
      const evaluation = evaluateMatch(item, m, categories);
      if (!evaluation) continue;
      const target = evaluation.substituteReasons.length === 0 ? "exact" : "substitute";
      const current = target === "exact" ? bestExact : bestSub;
      if (
        !current ||
        evaluation.score > current.evaluation.score ||
        (evaluation.score === current.evaluation.score &&
          evaluation.substituteReasons.length < current.evaluation.substituteReasons.length) ||
        (evaluation.score === current.evaluation.score &&
          evaluation.substituteReasons.length === current.evaluation.substituteReasons.length &&
          m.quantity > current.material.quantity)
      ) {
        const candidate = { material: m, evaluation };
        if (target === "exact") bestExact = candidate;
        else bestSub = candidate;
      }
    }

    if (bestExact) {
      (bestExact.material.quantity > 0 ? have : outOfStock).push(buildMatched(item, bestExact.material));
    } else if (bestSub) {
      substitute.push(buildMatched(item, bestSub.material, bestSub.evaluation.substituteReasons));
    } else {
      notFound.push(item);
    }
  }

  return { have, substitute, outOfStock, notFound };
}

/** 入口：读取全部未删除物料及其参数，匹配并返回三分结果。 */
export async function matchBom(db: D1Database, items: BomItem[]): Promise<BomMatchResponse> {
  const rows = await materialRepo.listAllActiveMaterials(db);
  const attrRows = await materialRepo.listMaterialAttributesBulk(db, rows.map((r) => r.id));

  const attrsByMaterial = new Map<number, { name: string; value: string; unit: string }[]>();
  for (const a of attrRows) {
    const list = attrsByMaterial.get(a.material_id) ?? [];
    list.push({ name: a.name, value: a.value, unit: a.unit });
    attrsByMaterial.set(a.material_id, list);
  }

  const materials = rows.map((r) =>
    toMaterialForMatch(
      { id: r.id, code: r.code, name: r.name, category_name: r.category_name, quantity: r.quantity },
      attrsByMaterial.get(r.id) ?? [],
    ),
  );

  return matchBomItems(materials, items);
}
