import { COMPANY_CONTRACT_STAGES } from "@/lib/company";
import { COMPANY_CSV_TEMPLATE_HEADER } from "@/lib/company-csv";

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number) {
  return Uint8Array.of(n & 255, (n >>> 8) & 255);
}

function u32(n: number) {
  return Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255);
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function zipStore(files: { name: string; data: Uint8Array }[]) {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(f.data.length),
      u32(f.data.length),
      u16(name.length),
      u16(0),
      name,
      f.data,
    ]);
    locals.push(local);
    centrals.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(f.data.length),
        u32(f.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  }
  const central = concat(centrals);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);
  return concat([...locals, central, eocd]);
}

function xml(s: string) {
  return new TextEncoder().encode(s);
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineCell(ref: string, value: string) {
  return `<c r="${ref}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`;
}

function colLetter(i: number) {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const SAMPLE = [
  "샘플회원사",
  "sampleco",
  "brandslam2026",
  "ops@sample.com",
  "",
  "샘플별칭",
  "2026-09-01",
  "",
  "",
  COMPANY_CONTRACT_STAGES[0],
  "35000000",
  "",
  "",
];

/** contract_stage 열은 엑셀 드롭다운(목록) */
export function buildCompanyExcelTemplate(): Uint8Array {
  const headers = COMPANY_CSV_TEMPLATE_HEADER.split(",");
  const stageCol = headers.indexOf("contract_stage");
  const headerCells = headers
    .map((h, i) => inlineCell(`${colLetter(i)}1`, h))
    .join("");
  const sampleCells = SAMPLE.map((v, i) =>
    inlineCell(`${colLetter(i)}2`, v),
  ).join("");
  const lastCol = colLetter(headers.length - 1);
  const stageList = COMPANY_CONTRACT_STAGES.map(
    (s, i) => `<row r="${i + 1}">${inlineCell(`A${i + 1}`, s)}</row>`,
  ).join("");
  const sqref = `${colLetter(stageCol)}2:${colLetter(stageCol)}201`;

  const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${lastCol}201"/>
<sheetData>
<row r="1">${headerCells}</row>
<row r="2">${sampleCells}</row>
</sheetData>
<dataValidations count="1">
<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="계약 단계" error="목록에서 선택하세요." sqref="${sqref}">
<formula1>'계약단계'!$A$1:$A$${COMPANY_CONTRACT_STAGES.length}</formula1>
</dataValidation>
</dataValidations>
</worksheet>`;

  const sheet2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${stageList}</sheetData>
</worksheet>`;

  return zipStore([
    {
      name: "[Content_Types].xml",
      data: xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
    },
    {
      name: "_rels/.rels",
      data: xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      name: "xl/workbook.xml",
      data: xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="회원사" sheetId="1" r:id="rId1"/>
<sheet name="계약단계" sheetId="2" r:id="rId2" state="hidden"/>
</sheets>
</workbook>`),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`),
    },
    { name: "xl/worksheets/sheet1.xml", data: xml(sheet1) },
    { name: "xl/worksheets/sheet2.xml", data: xml(sheet2) },
  ]);
}

if (process.env.RUN_COMPANY_XLSX_SELF_CHECK === "1") {
  const bytes = buildCompanyExcelTemplate();
  const text = new TextDecoder().decode(bytes);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("not zip");
  if (!text.includes("dataValidation") || !text.includes("캠페인 진행중")) {
    throw new Error("missing dropdown xml");
  }
  console.log("company-xlsx-template self-check ok");
}
