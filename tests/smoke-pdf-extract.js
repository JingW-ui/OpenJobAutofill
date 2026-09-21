// 冒烟测试：PDF 文本抽取算法（与 options.js extractTextFromPdf 相同的按行分组逻辑）
// 运行：node tests/smoke-pdf-extract.js
// 依赖可选：未安装 pdfjs-dist 时自动跳过（npm i --no-save pdfjs-dist@3.11.174 后可运行真实断言）。

const assert = require("node:assert");

let pdfjsLib = null;
try {
  pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
} catch {
  console.log("⏭️  未安装 pdfjs-dist，跳过真实抽取断言（浏览器端由 vendor/pdf/pdf.min.js 承担）");
  process.exit(0);
}

// 手工构造最小合法 PDF：两行文本，y 坐标 700 / 660
function buildSamplePdf() {
  const textStream = "BT /F1 24 Tf 100 700 Td (Zhang San) Tj 0 -40 Td (Education XX University 2021) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${textStream.length} >>\nstream\n${textStream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

// 与 options.js extractTextFromPdf 相同的行分组算法
function groupTextItems(items) {
  const lines = [];
  let lastY = null;
  for (const item of items || []) {
    const y = item.transform ? item.transform[5] : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
      lines.push("\n");
    }
    const text = String(item.str || "").trim();
    if (text) {
      lines.push(text);
    }
    if (y !== null) {
      lastY = y;
    }
  }
  return lines.join(" ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

(async () => {
  const pdf = await pdfjsLib.getDocument({ data: buildSamplePdf(), disableWorker: true }).promise;
  assert.strictEqual(pdf.numPages, 1);
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const text = groupTextItems(content.items);

  assert.ok(text.includes("Zhang San"), "应抽取第一行文本");
  assert.ok(text.includes("Education XX University 2021"), "应抽取第二行文本");
  assert.ok(/\n/.test(text), "两行 y 坐标不同应以换行分隔");

  console.log("✅ PDF 抽取断言通过，实际输出：");
  console.log(text);
  process.exit(0);
})().catch((error) => {
  console.error("❌ PDF 抽取测试失败:", error);
  process.exit(1);
});
