import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseBomFile } from "../src/lib/bom";

describe("BOM 文件解析", () => {
  it("忽略工作表中的隐藏行", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["型号", "位号", "封装"],
      ["可见物料A", "U1", "SOT-23"],
      ["隐藏物料", "U2", "QFN-32"],
      ["可见物料B", "U3", "SOD-123"],
    ]);
    sheet["!rows"] = [{}, {}, { hidden: true }, {}];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "BOM");
    const data = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const items = await parseBomFile(data);
    expect(items.map((item) => item.model)).toEqual(["可见物料A", "可见物料B"]);
  });
});
