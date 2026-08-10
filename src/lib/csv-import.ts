import { normalizeHandle } from "@/lib/auth";

export type ImportRowInput = {
  snsid?: string;
  snsurl?: string;
  name?: string;
  visit_date?: string;
  visit_at?: string;
  store?: string;
  product?: string;
  quantity?: string | number;
};

export type ParsedImportRow = {
  rowNumber: number;
  snsid: string;
  snsurl: string | null;
  name: string;
  visit_date: string;
  store: string;
  product: string;
  quantity: number;
  errors: string[];
  ok: boolean;
};

const HEADER_ALIASES: Record<string, keyof ImportRowInput> = {
  snsid: "snsid",
  sns_id: "snsid",
  handle: "snsid",
  instagram: "snsid",
  instagram_handle: "snsid",
  snsurl: "snsurl",
  sns_url: "snsurl",
  url: "snsurl",
  name: "name",
  이름: "name",
  visit_date: "visit_date",
  visit_at: "visit_date",
  방문일자: "visit_date",
  방문일: "visit_date",
  store: "store",
  방문지점: "store",
  지점: "store",
  매장: "store",
  product: "product",
  상품: "product",
  quantity: "quantity",
  수량: "quantity",
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    // skip fully empty trailing rows
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushCell();
    } else if (ch === "\n") {
      pushCell();
      pushRow();
    } else if (ch === "\r") {
      // ignore; handle \r\n via \n
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }

  return rows;
}

/** 방문일을 YYYY-MM-DD 로 정규화. `-` `.` `/` 구분, 2자리 연도(YY→20YY) 허용 */
export function normalizeVisitDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // Excel serial date (rough)
  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = Number(value);
    if (serial > 20000 && serial < 80000) {
      const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return toYmd(
        utc.getUTCFullYear(),
        utc.getUTCMonth() + 1,
        utc.getUTCDate(),
      );
    }
  }

  // 시간 포함 값: "2026-08-11 00:00:00" / ISO
  const dateOnly = value.split(/[T\s]/)[0]!.trim();
  const sep = "[.\\/-]";

  // YYYY-M-D / YYYY.M.D / YYYY/M/D
  let match = dateOnly.match(
    new RegExp(`^(\\d{4})${sep}(\\d{1,2})${sep}(\\d{1,2})$`),
  );
  if (match) {
    return toYmd(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  // YY-M-D / YY.M.D / YY/M/D  (예: 26.08.11, 26-08-11)
  match = dateOnly.match(
    new RegExp(`^(\\d{2})${sep}(\\d{1,2})${sep}(\\d{1,2})$`),
  );
  if (match) {
    return toYmd(2000 + Number(match[1]), Number(match[2]), Number(match[3]));
  }

  // M-D-YYYY / M.D.YYYY / M/D/YYYY
  match = dateOnly.match(
    new RegExp(`^(\\d{1,2})${sep}(\\d{1,2})${sep}(\\d{4})$`),
  );
  if (match) {
    return toYmd(Number(match[3]), Number(match[1]), Number(match[2]));
  }

  // M-D-YY
  match = dateOnly.match(
    new RegExp(`^(\\d{1,2})${sep}(\\d{1,2})${sep}(\\d{2})$`),
  );
  if (match) {
    return toYmd(
      2000 + Number(match[3]),
      Number(match[1]),
      Number(match[2]),
    );
  }

  return null;
}

function toYmd(year: number, month: number, day: number): string | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  if (year < 2000 || year > 2099) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "텔로액트 두피 스케일러 2개" → { name, quantity } */
export function parseProductAndQty(
  productRaw: string,
  quantityRaw?: string | number,
): { name: string; quantity: number } {
  const qtyFromCol =
    quantityRaw === undefined || quantityRaw === ""
      ? null
      : Number(quantityRaw);

  if (qtyFromCol !== null && Number.isFinite(qtyFromCol) && qtyFromCol > 0) {
    return {
      name: productRaw.trim().replace(/\s+\d+\s*개$/u, "").trim() || productRaw.trim(),
      quantity: Math.floor(qtyFromCol),
    };
  }

  const match = productRaw.trim().match(/^(.*?)[\s×xX*]*(\d+)\s*개?\s*$/u);
  if (match && match[1].trim()) {
    return {
      name: match[1].trim(),
      quantity: Number(match[2]),
    };
  }

  return { name: productRaw.trim(), quantity: 1 };
}

function mapHeaders(headerRow: string[]): (keyof ImportRowInput | null)[] {
  return headerRow.map((h) => {
    const key = h.trim().toLowerCase().replace(/\s+/g, "_");
    return HEADER_ALIASES[key] ?? null;
  });
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    // Excel serial date in date-like columns handled later via normalizeVisitDate
    return String(value);
  }
  return String(value).trim();
}

export function rowsFromCsvMatrix(matrix: unknown[][]): ParsedImportRow[] {
  if (matrix.length < 2) return [];

  const headers = mapHeaders(matrix[0].map((c) => cellToString(c)));
  const results: ParsedImportRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i] || [];
    const raw: ImportRowInput = {};
    headers.forEach((key, idx) => {
      if (!key) return;
      const value = cellToString(cells[idx]);
      if (key === "quantity") {
        raw.quantity = value;
      } else {
        raw[key] = value;
      }
    });

    // skip blank lines
    if (
      !raw.snsid &&
      !raw.visit_date &&
      !raw.visit_at &&
      !raw.store &&
      !raw.product
    ) {
      continue;
    }

    results.push(validateImportRow(i + 1, raw));
  }

  return results;
}

export function validateImportRow(
  rowNumber: number,
  raw: ImportRowInput,
): ParsedImportRow {
  const errors: string[] = [];
  const snsid = normalizeHandle(String(raw.snsid || ""));
  const snsurl = String(raw.snsurl || "").trim() || null;
  const visitRaw = String(raw.visit_date || raw.visit_at || "").trim();
  const visit_date = normalizeVisitDate(visitRaw);
  const store = String(raw.store || "").trim();
  const productRaw = String(raw.product || "").trim();
  const { name: product, quantity } = parseProductAndQty(
    productRaw,
    raw.quantity,
  );
  const name =
    String(raw.name || "").trim() || (snsid ? snsid : "");

  if (!snsid) errors.push("snsid(핸들) 필요");
  if (!visit_date)
    errors.push("visit_date 형식 오류 (예: 2026-08-11, 2026.08.11, 26-08-11)");
  if (!store) errors.push("방문지점(store) 필요");
  if (!product) errors.push("상품(product) 필요");
  if (!Number.isFinite(quantity) || quantity < 1) errors.push("수량 오류");

  return {
    rowNumber,
    snsid,
    snsurl,
    name: name || snsid,
    visit_date: visit_date || "",
    store,
    product,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    errors,
    ok: errors.length === 0,
  };
}

export function parseImportCsv(text: string): ParsedImportRow[] {
  return rowsFromCsvMatrix(parseCsv(text));
}

export async function parseImportExcel(
  buffer: ArrayBuffer,
): Promise<ParsedImportRow[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  return rowsFromCsvMatrix(matrix);
}

export async function parseImportFile(file: File): Promise<ParsedImportRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    return parseImportExcel(buffer);
  }
  if (name.endsWith(".csv") || file.type.includes("csv") || file.type === "text/plain") {
    const text = await file.text();
    return parseImportCsv(text);
  }
  // fallback: try excel then csv
  try {
    const buffer = await file.arrayBuffer();
    const rows = await parseImportExcel(buffer);
    if (rows.length > 0) return rows;
  } catch {
    // ignore
  }
  const text = await file.text();
  return parseImportCsv(text);
}

export const IMPORT_CSV_TEMPLATE = `snsid,snsurl,name,visit_date,store,product,quantity
@mina_beauty,https://instagram.com/mina_beauty,미나,2026-08-10,강남점,텔로액트 두피 스케일러,2
@beauty_lee,,이지,2026-08-10,홍대점,앰플 세트 1개,
`;

export const IMPORT_ACCEPT =
  ".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
