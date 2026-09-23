import { JWT } from "google-auth-library";

const CHAT_SCOPES = [
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages.readonly",
];

export type ChatMessage = {
  name: string; // spaces/x/messages/y
  sender?: { name?: string; displayName?: string; type?: string };
  text?: string;
  createTime?: string;
  thread?: { name?: string };
};

function loadServiceAccountKey() {
  const raw = process.env.GOOGLE_CHAT_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new Error("GOOGLE_CHAT_SERVICE_ACCOUNT_JSON이 설정되지 않았습니다.");
  const decoded = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(decoded) as { client_email: string; private_key: string };
}

/**
 * ponytail: 도메인 전체 위임(subject)이 있으면 관리자 권한으로 방 전체 기록을 읽고,
 * 없으면 앱(서비스 계정) 인증으로 봇이 접근 가능한 범위만 읽는다 — 상한은 Google Chat API 쪽 정책.
 */
async function getAuthClient() {
  const key = loadServiceAccountKey();
  const subject = process.env.GOOGLE_CHAT_IMPERSONATE_EMAIL?.trim() || undefined;
  const client = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: CHAT_SCOPES,
    subject,
  });
  await client.authorize();
  return client;
}

async function chatFetch(
  client: JWT,
  path: string,
  query?: Record<string, string | undefined>,
) {
  const url = new URL(`https://chat.googleapis.com/v1/${path}`);
  for (const [k, v] of Object.entries(query ?? {})) if (v) url.searchParams.set(k, v);
  const res = await client.request<Record<string, unknown>>({ url: url.toString() });
  return res.data;
}

/** 특정 스페이스(방)의 메시지를 전체 페이지네이션으로 가져온다. */
export async function fetchAllSpaceMessages(spaceId: string): Promise<ChatMessage[]> {
  const client = await getAuthClient();
  const space = spaceId.startsWith("spaces/") ? spaceId : `spaces/${spaceId}`;
  const out: ChatMessage[] = [];
  let pageToken: string | undefined;
  do {
    const data = await chatFetch(client, `${space}/messages`, {
      pageSize: "1000",
      pageToken,
      orderBy: "createTime asc",
    });
    const messages = (data.messages as ChatMessage[] | undefined) ?? [];
    out.push(...messages);
    pageToken = (data.nextPageToken as string | undefined) || undefined;
  } while (pageToken);
  return out;
}

export async function listSpaces() {
  const client = await getAuthClient();
  const out: { name: string; displayName?: string; type?: string }[] = [];
  let pageToken: string | undefined;
  do {
    const data = await chatFetch(client, "spaces", { pageSize: "1000", pageToken });
    out.push(...((data.spaces as typeof out) ?? []));
    pageToken = (data.nextPageToken as string | undefined) || undefined;
  } while (pageToken);
  return out;
}
