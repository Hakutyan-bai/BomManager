import { useRef, useState } from "react";
import type { BomItem, BomMatchResponse, BomMatched } from "../../shared/types";
import { matchBom } from "../lib/api";
import { parseBomFile } from "../lib/bom";
import { Button, Modal, Spinner } from "./ui";

function bomKey(item: BomItem, i: number): string {
  return `${item.model}|${item.designator ?? ""}|${item.package ?? ""}|${i}`;
}

function BomRowCells({ item }: { item: BomItem }) {
  return (
    <>
      <td className="px-3 py-2 text-sm text-gray-900">{item.model}</td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{item.designator ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{item.package ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm text-gray-700">{item.quantity}</td>
    </>
  );
}

function MatchedSection({
  title,
  tone,
  rows,
  emptyHint,
}: {
  title: string;
  tone: "green" | "amber";
  rows: BomMatched[];
  emptyHint: string;
}) {
  const toneCls = tone === "green" ? "text-green-700" : "text-amber-600";
  return (
    <div className="mt-4">
      <h4 className={`text-sm font-semibold ${toneCls}`}>
        {title}（{rows.length}）
      </h4>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs text-gray-400">{emptyHint}</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">型号</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">位号</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">封装</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">数量</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">匹配物料</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">剩余</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">缺口</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.map((r, i) => (
                <tr key={bomKey(r.bom, i)}>
                  <BomRowCells item={r.bom} />
                  <td className="px-3 py-2">
                    <div className="text-sm text-gray-900">{r.material.name}</div>
                    <div className="text-xs text-gray-400">{r.material.params || r.material.categoryName}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm text-gray-700">{r.material.stock}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm text-gray-700">{r.shortfall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NotFoundSection({ rows }: { rows: BomItem[] }) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-red-600">未收录（需购买 / 新建物料）（{rows.length}）</h4>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs text-gray-400">所有 BOM 行均已匹配到物料</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">型号</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">位号</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">封装</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">数量</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.map((r, i) => (
                <tr key={bomKey(r, i)}>
                  <BomRowCells item={r} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
      const buf = await file.arrayBuffer();
      const items = await parseBomFile(buf);
      setParsedCount(items.length);
      setResult(await matchBom(items));
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析或匹配失败");
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

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="BOM 查询"
      maxWidth="max-w-3xl"
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        {fileName ? `已选择：${fileName}（点击重新选择）` : "点击选择 BOM 文件（.xlsx / .xls / .csv）"}
      </label>

      {loading && (
        <div className="mt-4 flex items-center justify-center gap-2 py-6 text-gray-400">
          <Spinner className="h-5 w-5" />
          <span>解析并匹配中…</span>
        </div>
      )}

      {!loading && error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {!loading && !error && result && (
        <div>
          <p className="mt-4 text-xs text-gray-400">
            共解析 {parsedCount} 行 · 有库存 {result.have.length} · 缺货 {result.outOfStock.length} · 未收录 {result.notFound.length}
          </p>
          <MatchedSection title="有（不用买）" tone="green" rows={result.have} emptyHint="没有「有库存」的匹配项" />
          <MatchedSection title="缺货（库存 0）" tone="amber" rows={result.outOfStock} emptyHint="没有「缺货」的匹配项" />
          <NotFoundSection rows={result.notFound} />
        </div>
      )}
    </Modal>
  );
}
