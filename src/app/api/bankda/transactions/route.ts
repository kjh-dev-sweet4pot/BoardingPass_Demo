import { NextRequest, NextResponse } from "next/server";
import { fetchTransactions, type BankdaTransaction } from "@/lib/bankda";
import { isSuperAdminSession } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

function toNum(val: unknown): number {
  if (val === undefined || val === null || val === "") return 0;
  const n = Number(String(val).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatTranDate(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return "";
  const d = String(dateStr).trim();
  const t = String(timeStr || "").trim();
  const formattedDate = d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
  if (!t) return formattedDate;
  const formattedTime = t.length === 6 ? `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}` : t;
  return `${formattedDate} ${formattedTime}`.trim();
}

export async function GET(req: NextRequest) {
  // 최고 관리자(wjdghl) 세션만 허용
  if (!(await isSuperAdminSession())) {
    return NextResponse.json(
      { error: "최고 관리자(wjdghl) 계정으로 로그인해야 조회할 수 있습니다." },
      { status: 403 },
    );
  }

  const { searchParams } = req.nextUrl;
  const datefrom = searchParams.get("from") ?? "";
  const dateto = searchParams.get("to") ?? "";
  const accountnum = searchParams.get("accountnum") ?? undefined;
  const istest = searchParams.get("istest") === "y";

  if (!datefrom || !dateto) {
    return NextResponse.json({ error: "from, to 파라미터 필요 (YYYYMMDD)" }, { status: 400 });
  }

  try {
    const result = await fetchTransactions({
      datefrom,
      dateto,
      accountnum,
      istest,
    });

    let savedToDbCount = 0;
    let dbError: string | null = null;

    // Supabase DB 자동 저장 (bankda_transactions 테이블)
    // ID(bkcode) 기준 중복 시 자동 대치 (ignoreDuplicates: false)
    if (hasServiceRoleKey() && result.transactions.length > 0) {
      try {
        const supabase = createServiceClient();
        const rowsToUpsert = result.transactions.map((r: BankdaTransaction, idx: number) => {
          const inAmt = toNum(r.bkinput ?? r.in_amt ?? r.inamt);
          const outAmt = toNum(r.bkoutput ?? r.out_amt ?? r.outamt);
          const balance = toNum(r.bkjango ?? r.balance ?? r.remain);
          const tranDate = formatTranDate(r.bkdate, r.bktime) || String(r.tran_date || r.trandate || "");
          const remark = [r.bkjukyo, r.bkcontent, r.bketc].filter(Boolean).join(" ").trim() || String(r.remark || "");
          const acc = [r.bkname, r.accountnum || accountnum].filter(Boolean).join(" ").trim();
          const bkcode = String(r.bkcode ?? `${tranDate}_${inAmt}_${outAmt}_${idx}`);
          const tranType = inAmt > 0 ? "입금" : outAmt > 0 ? "출금" : "기타";

          return {
            bkcode,
            account_num: acc || null,
            tran_date: tranDate,
            tran_type: tranType,
            in_amt: inAmt,
            out_amt: outAmt,
            balance,
            remark: remark || null,
            raw_json: r,
            updated_at: new Date().toISOString(),
          };
        });

        const { error: upsertErr } = await supabase
          .from("bankda_transactions")
          .upsert(rowsToUpsert, { onConflict: "bkcode", ignoreDuplicates: false });

        if (!upsertErr) {
          savedToDbCount = rowsToUpsert.length;
        } else {
          dbError = upsertErr.message;
          console.warn("[Bankda DB Sync Notice]", upsertErr.message);
        }
      } catch (dbErr) {
        dbError = dbErr instanceof Error ? dbErr.message : String(dbErr);
        console.warn("[Bankda DB Sync Error]", dbErr);
      }
    }

    return NextResponse.json({
      ...result,
      savedToDbCount,
      dbError,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
