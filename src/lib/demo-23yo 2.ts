/**
 * 23yearsold 데모 목업 — DB 없이 진행현황·성과 탭 확인용.
 * JP 크리에이터 풀 실데이터 기반.
 */

export type DemoCreatorLink = {
  id: string;
  status: "제출" | "승인" | "발행완료" | "반려";
  link_url: string | null;
  submitted_at: string | null;
  verification_failed: boolean | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  metrics_collected_at: string | null;
};

export type DemoAllocation = {
  id: string;
  status: string;
  target_content_count: number;
  influencer_id: string;
  influencers: {
    id: string;
    name: string;
    instagram_handle_normalized: string;
    followers: number;
  };
  creator_links: DemoCreatorLink[];
  product: { id: string; name: string };
};

export type DemoCampaign = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  allocations: DemoAllocation[];
};

export type DemoMetricRow = {
  creator_link_id: string;
  collected_at: string;
  views: number;
  likes: number;
  comments: number;
};

// ── 캠페인 1: 비타민C 세럼 JP 시딩 (시행 중) ──────────────────────────────
const CAMPAIGN_A: DemoCampaign = {
  id: "demo-camp-a",
  name: "23YO 비타민C 세럼 JP 시딩",
  status: "시행",
  created_at: "2026-06-01T00:00:00+09:00",
  allocations: [
    {
      id: "demo-alloc-a1",
      status: "발행완료",
      target_content_count: 1,
      influencer_id: "jp-001",
      influencers: { id: "jp-001", name: "松芳", instagram_handle_normalized: "215ot_", followers: 274100 },
      product: { id: "prod-serum", name: "23YO 비타민C 세럼" },
      creator_links: [
        {
          id: "link-a1",
          status: "발행완료",
          link_url: "https://www.tiktok.com/@215ot_/video/7644875975037144340",
          submitted_at: "2026-06-10T12:00:00+09:00",
          verification_failed: null,
          views: 182300,
          likes: 9800,
          comments: 321,
          metrics_collected_at: "2026-08-18T09:00:00+09:00",
        },
      ],
    },
    {
      id: "demo-alloc-a2",
      status: "발행완료",
      target_content_count: 1,
      influencer_id: "jp-002",
      influencers: { id: "jp-002", name: "金山未来", instagram_handle_normalized: "2002_151", followers: 191800 },
      product: { id: "prod-serum", name: "23YO 비타민C 세럼" },
      creator_links: [
        {
          id: "link-a2",
          status: "발행완료",
          link_url: "https://www.tiktok.com/@2002_151/video/7644896105905523988",
          submitted_at: "2026-06-12T14:00:00+09:00",
          verification_failed: null,
          views: 97500,
          likes: 5200,
          comments: 148,
          metrics_collected_at: "2026-08-18T09:00:00+09:00",
        },
      ],
    },
    {
      id: "demo-alloc-a3",
      status: "발행완료",
      target_content_count: 1,
      influencer_id: "jp-003",
      influencers: { id: "jp-003", name: "山口", instagram_handle_normalized: "ippaiagetai", followers: 168500 },
      product: { id: "prod-serum", name: "23YO 비타민C 세럼" },
      creator_links: [
        {
          id: "link-a3",
          status: "발행완료",
          link_url: "https://www.tiktok.com/@ippaiagetai/video/7645283841367837973",
          submitted_at: "2026-06-15T10:00:00+09:00",
          verification_failed: null,
          views: 143200,
          likes: 7600,
          comments: 230,
          metrics_collected_at: "2026-08-18T09:00:00+09:00",
        },
      ],
    },
    {
      id: "demo-alloc-a4",
      status: "검수중",
      target_content_count: 1,
      influencer_id: "jp-004",
      influencers: { id: "jp-004", name: "蒔田千夏", instagram_handle_normalized: "churumisama", followers: 101600 },
      product: { id: "prod-serum", name: "23YO 비타민C 세럼" },
      creator_links: [
        {
          id: "link-a4",
          status: "제출",
          link_url: "https://www.tiktok.com/@churumisama/video/7645595427454160148",
          submitted_at: "2026-08-10T16:00:00+09:00",
          verification_failed: null,
          views: null,
          likes: null,
          comments: null,
          metrics_collected_at: null,
        },
      ],
    },
    {
      id: "demo-alloc-a5",
      status: "제작중",
      target_content_count: 1,
      influencer_id: "jp-009",
      influencers: { id: "jp-009", name: "山口奈々美", instagram_handle_normalized: "nanachannelnanami", followers: 21500 },
      product: { id: "prod-serum", name: "23YO 비타민C 세럼" },
      creator_links: [],
    },
  ],
};

// ── 캠페인 2: 글로우 앰플 인스타 협업 (결과) ──────────────────────────────
const CAMPAIGN_B: DemoCampaign = {
  id: "demo-camp-b",
  name: "23YO 글로우 앰플 인스타 협업",
  status: "결과",
  created_at: "2026-03-15T00:00:00+09:00",
  allocations: [
    {
      id: "demo-alloc-b1",
      status: "발행완료",
      target_content_count: 1,
      influencer_id: "jp-005",
      influencers: { id: "jp-005", name: "坂根青空", instagram_handle_normalized: "aozora723", followers: 42000 },
      product: { id: "prod-ampoule", name: "23YO 글로우 앰플" },
      creator_links: [
        {
          id: "link-b1",
          status: "발행완료",
          link_url: "https://www.instagram.com/reels/DaQDl9-zwZS/",
          submitted_at: "2026-04-03T12:00:00+09:00",
          verification_failed: null,
          views: 38400,
          likes: 2100,
          comments: 87,
          metrics_collected_at: "2026-08-18T09:00:00+09:00",
        },
      ],
    },
    {
      id: "demo-alloc-b2",
      status: "발행완료",
      target_content_count: 1,
      influencer_id: "jp-006",
      influencers: { id: "jp-006", name: "氏家もえ", instagram_handle_normalized: "moe.moet", followers: 29000 },
      product: { id: "prod-ampoule", name: "23YO 글로우 앰플" },
      creator_links: [
        {
          id: "link-b2",
          status: "발행완료",
          link_url: "https://www.instagram.com/p/DYYG00VSCXd/",
          submitted_at: "2026-04-05T14:00:00+09:00",
          verification_failed: null,
          views: 24600,
          likes: 1380,
          comments: 62,
          metrics_collected_at: "2026-08-18T09:00:00+09:00",
        },
      ],
    },
    {
      id: "demo-alloc-b3",
      status: "발행완료",
      target_content_count: 1,
      influencer_id: "jp-008",
      influencers: { id: "jp-008", name: "高橋ユナ", instagram_handle_normalized: "1111yun1111", followers: 26000 },
      product: { id: "prod-ampoule", name: "23YO 글로우 앰플" },
      creator_links: [
        {
          id: "link-b3",
          status: "발행완료",
          link_url: "https://www.instagram.com/reel/DYm0vhwTvv_/",
          submitted_at: "2026-04-07T11:00:00+09:00",
          verification_failed: null,
          views: 19800,
          likes: 1050,
          comments: 43,
          metrics_collected_at: "2026-08-18T09:00:00+09:00",
        },
      ],
    },
    {
      id: "demo-alloc-b4",
      status: "발행완료",
      target_content_count: 1,
      influencer_id: "jp-015",
      influencers: { id: "jp-015", name: "FUJII RIYU", instagram_handle_normalized: "miu_otonamake", followers: 10000 },
      product: { id: "prod-ampoule", name: "23YO 글로우 앰플" },
      creator_links: [
        {
          id: "link-b4",
          status: "발행완료",
          link_url: "https://www.instagram.com/reels/DaPzCF-SWMS/",
          submitted_at: "2026-04-10T10:00:00+09:00",
          verification_failed: null,
          views: 12300,
          likes: 720,
          comments: 29,
          metrics_collected_at: "2026-08-18T09:00:00+09:00",
        },
      ],
    },
  ],
};

export const DEMO_CAMPAIGNS_23YO: DemoCampaign[] = [CAMPAIGN_A, CAMPAIGN_B];

/** 성과 탭용 — 발행완료 링크 + content_metrics 시계열 (경과일 기준 가상) */
export function buildDemo23YoPerformance() {
  const links: Array<{
    id: string;
    link_url: string | null;
    status: string;
    published_at: string | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
    metrics_collected_at: string | null;
    allocations: {
      id: string;
      company_id: string;
      influencer_id: string;
      influencers: { id: string; name: string; instagram_handle_normalized: string; followers: number } | null;
      products: { id: string; name: string } | null;
    };
  }> = [];

  const metrics: DemoMetricRow[] = [];

  for (const camp of DEMO_CAMPAIGNS_23YO) {
    for (const alloc of camp.allocations) {
      for (const link of alloc.creator_links) {
        if (link.status !== "발행완료") continue;
        links.push({
          id: link.id,
          link_url: link.link_url,
          status: link.status,
          published_at: link.submitted_at,
          views: link.views,
          likes: link.likes,
          comments: link.comments,
          metrics_collected_at: link.metrics_collected_at,
          allocations: {
            id: alloc.id,
            company_id: "23yearsold",
            influencer_id: alloc.influencer_id,
            influencers: { ...alloc.influencers },
            products: alloc.product,
          },
        });

        // 발행 후 0/3/7/14/30/60일 시계열 (조회수 성장 곡선)
        if (link.views && link.submitted_at) {
          const pub = new Date(link.submitted_at).getTime();
          const curve = [0, 3, 7, 14, 30, 60];
          const ratios = [0.15, 0.4, 0.6, 0.75, 0.9, 1.0];
          for (let i = 0; i < curve.length; i++) {
            metrics.push({
              creator_link_id: link.id,
              collected_at: new Date(pub + curve[i] * 86400000).toISOString(),
              views: Math.round((link.views ?? 0) * ratios[i]),
              likes: Math.round((link.likes ?? 0) * ratios[i]),
              comments: Math.round((link.comments ?? 0) * ratios[i]),
            });
          }
        }
      }
    }
  }

  const collectedAt = "2026-08-18T09:00:00+09:00";
  return { links, metrics, collectedAt };
}

export type DemoKanbanCard = {
  id: string;
  campaignId: string;
  campaignName: string;
  status: "대기" | "수령완료" | "제작중" | "검수중" | "발행완료";
  influencerId: string;
  name: string;
  handle: string;
  productName: string;
  publishedCount: number;
  targetCount: number;
  updatedAt: string;
  submittedLinks: DemoCreatorLink[];
};

const KANBAN_STATUSES = ["대기", "수령완료", "제작중", "검수중", "발행완료"] as const;

/** 진행 현황 칸반용 — 캠페인 배정 flatten + 추가 데모 행 */
export function buildDemo23YoKanban(campaignFilter?: string): DemoKanbanCard[] {
  const extra: DemoKanbanCard[] = [
    {
      id: "demo-alloc-w1",
      campaignId: "demo-camp-a",
      campaignName: "23YO 비타민C 세럼 JP 시딩",
      status: "대기",
      influencerId: "jp-010",
      name: "宗﨑今日子",
      handle: "@kyochi.o",
      productName: "23YO 비타민C 세럼",
      publishedCount: 0,
      targetCount: 1,
      updatedAt: "2026-08-01",
      submittedLinks: [],
    },
    {
      id: "demo-alloc-w2",
      campaignId: "demo-camp-a",
      campaignName: "23YO 비타민C 세럼 JP 시딩",
      status: "대기",
      influencerId: "jp-011",
      name: "高橋ひとみ",
      handle: "@shizuku_1813",
      productName: "23YO 비타민C 세럼",
      publishedCount: 0,
      targetCount: 1,
      updatedAt: "2026-08-02",
      submittedLinks: [],
    },
    {
      id: "demo-alloc-p1",
      campaignId: "demo-camp-a",
      campaignName: "23YO 비타민C 세럼 JP 시딩",
      status: "수령완료",
      influencerId: "jp-012",
      name: "戸叶杏奈",
      handle: "@api_chan_tokyo",
      productName: "23YO 비타민C 세럼",
      publishedCount: 0,
      targetCount: 1,
      updatedAt: "2026-08-05",
      submittedLinks: [],
    },
    {
      id: "demo-alloc-p2",
      campaignId: "demo-camp-b",
      campaignName: "23YO 글로우 앰플 인스타 협업",
      status: "수령완료",
      influencerId: "jp-016",
      name: "大橋まゆみ",
      handle: "@a__ai__i",
      productName: "23YO 글로우 앰플",
      publishedCount: 0,
      targetCount: 1,
      updatedAt: "2026-04-01",
      submittedLinks: [],
    },
  ];

  const fromCampaigns: DemoKanbanCard[] = [];
  for (const camp of DEMO_CAMPAIGNS_23YO) {
    if (campaignFilter && camp.id !== campaignFilter) continue;
    for (const alloc of camp.allocations) {
      const status = alloc.status as DemoKanbanCard["status"];
      if (!KANBAN_STATUSES.includes(status)) continue;
      const pub = alloc.creator_links.filter((l) => l.status === "발행완료").length;
      fromCampaigns.push({
        id: alloc.id,
        campaignId: camp.id,
        campaignName: camp.name,
        status,
        influencerId: alloc.influencer_id,
        name: alloc.influencers.name,
        handle: `@${alloc.influencers.instagram_handle_normalized}`,
        productName: alloc.product.name,
        publishedCount: pub,
        targetCount: alloc.target_content_count,
        updatedAt: alloc.creator_links[0]?.submitted_at?.slice(0, 10) ?? "2026-08-10",
        submittedLinks: alloc.creator_links.filter((l) => l.status === "제출"),
      });
    }
  }

  const cards = [...fromCampaigns, ...(campaignFilter ? [] : extra)];
  if (campaignFilter) {
    return cards.filter((c) => c.campaignId === campaignFilter);
  }
  return cards;
}
