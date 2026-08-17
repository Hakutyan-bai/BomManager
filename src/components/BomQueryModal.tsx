import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import type { BomItem, BomMatchResponse, BomMatched } from "../../shared/types";
import { matchBom } from "../lib/api";
import { parseBomFile } from "../lib/bom";
import { Badge, Button, Modal, Spinner } from "./ui";

function bomKey(item: BomItem, index: number): string {
  return `${item.model}|${item.designator ?? ""}|${item.package ?? ""}|${index}`;
}

const toneStyles = {
  green: { badge: "green" as const, border: "border-[#2d876c]" },
  blue: { badge: "blue" as const, border: "border-[#3f7e9d]" },
  amber: { badge: "amber" as const, border: "border-[#bd7a2c]" },
};

function BomSource({ item }: { item: BomItem }) {
  return (
    <div className="min-w-0">
      <div className="break-words text-sm font-semibold text-[#19231f]">{item.model}</div>
      <div className="font-data mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6b7871]">
        <span>封装 {item.package ?? "—"}</span>
        <span>需求 {item.quantity}</span>
      </div>
    </div>
  );
}

function MatchedSection({
  title,
  tone,
  rows,
  emptyHint,
}: {
  title: string;
  tone: "green" | "blue" | "amber";
  rows: BomMatched[];
  emptyHint: string;
}) {
  const styles = toneStyles[tone];
  return (
    <section className="border-t border-[#d7ded9] pt-4">
      <div className="flex items-center gap-2">
        <Badge tone={styles.badge}>{title}</Badge>
        <span className="font-data text-xs text-[#7a877f]">{rows.length} 项</span>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-sm text-[#8a968f]">{emptyHint}</p>
      ) : (
        <>
          <div className="mt-3 hidden overflow-x-auto rounded-[6px] border border-[#d7ded9] md:block">
            <table className="min-w-[760px] table-fixed">
              <thead className="border-b border-[#d7ded9] bg-[#f7f9f7]">
                <tr>
                  <th className="w-[21%] px-3 py-2.5 text-left text-xs font-semibold text-[#6b7871]">BOM 型号</th>
                  <th className="w-[13%] px-3 py-2.5 text-left text-xs font-semibold text-[#6b7871]">封装</th>
                  <th className="w-[9%] px-3 py-2.5 text-right text-xs font-semibold text-[#6b7871]">需求</th>
                  <th className="w-[39%] px-3 py-2.5 text-left text-xs font-semibold text-[#6b7871]">匹配物料</th>
                  <th className="w-[9%] px-3 py-2.5 text-right text-xs font-semibold text-[#6b7871]">库存</th>
                  <th className="w-[9%] px-3 py-2.5 text-right text-xs font-semibold text-[#6b7871]">缺口</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebe7] bg-white">
                {rows.map((row, index) => (
                  <tr key={bomKey(row.bom, index)}>
                    <td className="break-words px-3 py-3 text-sm font-semibold text-[#19231f]">{row.bom.model}</td>
                    <td className="font-data break-words px-3 py-3 text-xs text-[#6b7871]">{row.bom.package ?? "—"}</td>
                    <td className="font-data px-3 py-3 text-right text-sm text-[#34423b]">{row.bom.quantity}</td>
                    <td className={`border-l-2 px-3 py-3 ${styles.border}`}>
                      <div className="text-sm font-semibold text-[#19231f]">{row.material.name}</div>
                      <div className="font-data mt-0.5 text-xs text-[#7a877f]">{row.material.code} · {row.material.params || row.material.categoryName}</div>
                      {row.substituteReasons.length > 0 && (
                        <div className="mt-1.5 text-xs leading-5 text-[#24658a]">{row.substituteReasons.join("；")}</div>
                      )}
                    </td>
                    <td className="font-data px-3 py-3 text-right text-sm text-[#146b52]">{row.material.stock}</td>
                    <td className={`font-data px-3 py-3 text-right text-sm font-semibold ${row.shortfall > 0 ? "text-[#a43f3a]" : "text-[#536159]"}`}>{row.shortfall}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 divide-y divide-[#e1e7e2] border-y border-[#d7ded9] md:hidden">
            {rows.map((row, index) => (
              <article key={bomKey(row.bom, index)} className={`border-l-2 py-3 pl-3 ${styles.border}`}>
                <BomSource item={row.bom} />
                <div className="mt-3 bg-[#f7f9f7] px-3 py-2.5">
                  <div className="break-words text-sm font-semibold text-[#19231f]">{row.material.name}</div>
                  <div className="font-data mt-1 break-words text-xs leading-5 text-[#6b7871]">{row.material.code} · {row.material.params || row.material.categoryName}</div>
                  {row.substituteReasons.length > 0 && (
                    <p className="mt-2 border-l-2 border-[#3f7e9d] pl-2 text-xs leading-5 text-[#24658a]">{row.substituteReasons.join("；")}</p>
                  )}
                </div>
                <div className="font-data mt-2 flex items-center gap-5 text-xs">
                  <span className="text-[#6b7871]">库存 <strong className="text-[#146b52]">{row.material.stock}</strong></span>
                  <span className="text-[#6b7871]">缺口 <strong className={row.shortfall > 0 ? "text-[#a43f3a]" : "text-[#536159]"}>{row.shortfall}</strong></span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function NotFoundSection({ rows }: { rows: BomItem[] }) {
  return (
    <section className="border-t border-[#d7ded9] pt-4">
      <div className="flex items-center gap-2">
        <Badge tone="red">未收录</Badge>
        <span className="font-data text-xs text-[#7a877f]">{rows.length} 项</span>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-sm text-[#8a968f]">所有 BOM 行均已匹配到物料</p>
      ) : (
        <>
          <div className="mt-3 hidden overflow-x-auto rounded-[6px] border border-[#d7ded9] md:block">
            <table className="min-w-full table-fixed">
              <thead className="border-b border-[#d7ded9] bg-[#f7f9f7]">
                <tr>
                  <th className="w-1/2 px-3 py-2.5 text-left text-xs font-semibold text-[#6b7871]">BOM 型号</th>
                  <th className="w-1/4 px-3 py-2.5 text-left text-xs font-semibold text-[#6b7871]">封装</th>
                  <th className="w-1/4 px-3 py-2.5 text-right text-xs font-semibold text-[#6b7871]">需求</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebe7] bg-white">
                {rows.map((row, index) => (
                  <tr key={bomKey(row, index)}>
                    <td className="break-words px-3 py-3 text-sm font-semibold text-[#19231f]">{row.model}</td>
                    <td className="font-data break-words px-3 py-3 text-xs text-[#6b7871]">{row.package ?? "—"}</td>
                    <td className="font-data px-3 py-3 text-right text-sm text-[#34423b]">{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 divide-y divide-[#e1e7e2] border-y border-[#d7ded9] md:hidden">
            {rows.map((row, index) => (
              <article key={bomKey(row, index)} className="border-l-2 border-[#b74640] py-3 pl-3">
                <BomSource item={row} />
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ResultSummary({ parsedCount, result }: { parsedCount: number | null; result: BomMatchResponse }) {
  const stats = [
    ["解析", parsedCount ?? 0, "text-[#34423b]"],
    ["有库存", result.have.length, "text-[#146b52]"],
    ["可替代", result.substitute.length, "text-[#24658a]"],
    ["缺货", result.outOfStock.length, "text-[#986020]"],
    ["未收录", result.notFound.length, "text-[#a43f3a]"],
  ] as const;

  return (
    <div className="grid grid-cols-2 border-y border-[#d7ded9] bg-[#fafbfa] sm:grid-cols-5">
      {stats.map(([label, value, color], index) => (
        <div key={label} className={`px-3 py-2.5 ${index < stats.length - 1 ? "sm:border-r sm:border-[#d7ded9]" : ""} ${index % 2 === 0 ? "max-sm:border-r max-sm:border-[#d7ded9]" : ""}`}>
          <div className="text-[11px] text-[#7a877f]">{label}</div>
          <div className={`font-data mt-0.5 text-base font-semibold ${color}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}

export function BomQueryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [fileName, setFileName] = useState("");
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [result, setResult] = useState<BomMatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setParsedCount(null);
    setError(null);
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const items = await parseBomFile(buffer);
      setParsedCount(items.length);
      setResult(await matchBom(items));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "解析或匹配失败");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFileName("");
    setResult(null);
    setParsedCount(null);
    setError(null);
    setLoading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="BOM 智能匹配" maxWidth="max-w-4xl" footer={<Button onClick={handleClose}>关闭</Button>}>
      <label className="group flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-[6px] border border-dashed border-[#aebbb3] bg-[#fafbfa] px-4 py-5 transition-colors hover:border-[#146b52] hover:bg-[#f3f7f4] focus-within:ring-2 focus-within:ring-[#146b52]/20">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-[#d7ded9] bg-white text-[#146b52]">
          {fileName ? <FileSpreadsheet size={20} strokeWidth={1.7} aria-hidden /> : <Upload size={20} strokeWidth={1.7} aria-hidden />}
        </div>
        <div className="min-w-0">
          <div className="break-all text-sm font-semibold text-[#34423b]">{fileName || "选择 BOM 文件"}</div>
          <div className="mt-1 text-xs text-[#7a877f]">XLSX、XLS、CSV</div>
        </div>
      </label>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#6b7871]">
          <Spinner className="h-5 w-5" />
          解析并匹配中
        </div>
      )}

      {!loading && error && <div className="mt-4 border-l-2 border-[#b74640] bg-[#fbf2f1] px-3 py-2 text-sm text-[#a43f3a]">{error}</div>}

      {!loading && !error && result && (
        <div className="mt-5 space-y-5">
          <ResultSummary parsedCount={parsedCount} result={result} />
          <MatchedSection title="有库存" tone="green" rows={result.have} emptyHint="没有可直接使用的库存" />
          <MatchedSection title="可替代 · 需确认" tone="blue" rows={result.substitute} emptyHint="没有可替代的匹配项" />
          <MatchedSection title="缺货" tone="amber" rows={result.outOfStock} emptyHint="没有库存为零的匹配项" />
          <NotFoundSection rows={result.notFound} />
        </div>
      )}
    </Modal>
  );
}
