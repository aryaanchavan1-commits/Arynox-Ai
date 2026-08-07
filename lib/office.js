import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

async function buildXlsx(rows, sheetName = "Sheet1") {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  if (Array.isArray(rows) && rows.length) {
    ws.addRows(rows);
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C5CFF" } };
    header.alignment = { vertical: "middle" };
    ws.columns.forEach((c) => {
      c.width = Math.min(32, Math.max(12, ...rows.map((r) => String(r[c.column - 1] ?? "").length + 2)));
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length, column: ws.columnCount } };
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function buildCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

async function buildDocx(text) {
  const doc = new Document({
    sections: [{
      children: text.split(/\n{2,}/).map((p) => {
        const t = p.trim();
        if (t.startsWith("# ")) return new Paragraph({ text: t.slice(2), heading: HeadingLevel.HEADING_1 });
        if (t.startsWith("## ")) return new Paragraph({ text: t.slice(3), heading: HeadingLevel.HEADING_2 });
        if (t.startsWith("- ")) return new Paragraph({ text: t.slice(2), bullet: { level: 0 } });
        return new Paragraph({ children: [new TextRun(t)] });
      }),
    }],
  });
  return Packer.toBuffer(doc);
}

async function parseFile(buffer, mime, name = "") {
  const low = name.toLowerCase();
  if (mime.includes("spreadsheet") || mime.includes("excel") || low.endsWith(".xlsx") || mime.endsWith("xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const out = [];
    wb.eachSheet((ws) => {
      out.push(`--- Sheet: ${ws.name} (${ws.rowCount} rows) ---`);
      let max = Math.min(ws.rowCount, 60);
      for (let r = 1; r <= max; r++) {
        const vals = [];
        ws.getRow(r).eachCell({ includeEmpty: true }, (c) => vals.push(c.value ?? ""));
        out.push(vals.join(" | "));
      }
    });
    return out.join("\n");
  }
  if (mime.includes("csv") || low.endsWith(".csv")) return buffer.toString("utf-8").slice(0, 50000);
  if (mime.includes("word") || low.endsWith(".docx")) {
    return "DOCX content extraction requires the text to be re-typed by the user; ask them to paste text or upload .txt/.csv/.xlsx instead.";
  }
  return buffer.toString("utf-8").slice(0, 50000);
}

export { buildXlsx, buildCsv, buildDocx, parseFile };
