import { type CreatorPlatform } from "@/lib/creator-link";

/** 성과 수집 출처. Apify 연동 후 live 로 바뀝니다. */
export type ContentMetricsSource = "mock" | "apify";

export type ContentPeriod = "month" | "all";

export type ContentPostInsight = {
  id: string;
  url: string;
  platform: CreatorPlatform;
  allocationId: string | null;
  linkId: string | null;
  productId: string | null;
  productName: string;
  influencerId: string | null;
  influencerName: string;
  influencerHandle: string;
  storeName: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  postedAt: string | null;
  collectedAt: string | null;
  source: ContentMetricsSource;
};

export type ContentProductInsight = {
  productId: string;
  productName: string;
  posts: number;
  views: number;
  likes: number;
  comments: number;
  influencerCount: number;
};

export type ContentInfluencerInsight = {
  influencerId: string;
  name: string;
  handle: string;
  posts: number;
  views: number;
  likes: number;
  comments: number;
  productNames: string[];
};

export type ContentInsightsSnapshot = {
  source: ContentMetricsSource;
  generatedAt: string;
  period: ContentPeriod;
  totals: {
    views: number;
    likes: number;
    comments: number;
    posts: number;
    influencers: number;
    products: number;
  };
  products: ContentProductInsight[];
  influencers: ContentInfluencerInsight[];
  posts: ContentPostInsight[];
};

export function emptyContentInsights(
  period: ContentPeriod,
  source: ContentMetricsSource = "mock",
): ContentInsightsSnapshot {
  return {
    source,
    generatedAt: new Date().toISOString(),
    period,
    totals: {
      views: 0,
      likes: 0,
      comments: 0,
      posts: 0,
      influencers: 0,
      products: 0,
    },
    products: [],
    influencers: [],
    posts: [],
  };
}

export function aggregateContentInsights(
  posts: ContentPostInsight[],
  period: ContentPeriod,
  source: ContentMetricsSource,
): ContentInsightsSnapshot {
  const productMap = new Map<
    string,
    ContentProductInsight & { influencerIds: Set<string> }
  >();
  const infMap = new Map<
    string,
    ContentInfluencerInsight & { productSet: Set<string> }
  >();

  for (const post of posts) {
    const productKey = post.productId || post.productName || "unknown";
    const product = productMap.get(productKey) || {
      productId: post.productId || productKey,
      productName: post.productName || "상품",
      posts: 0,
      views: 0,
      likes: 0,
      comments: 0,
      influencerCount: 0,
      influencerIds: new Set<string>(),
    };
    product.posts += 1;
    product.views += post.views;
    product.likes += post.likes;
    product.comments += post.comments;
    if (post.influencerId) product.influencerIds.add(post.influencerId);
    productMap.set(productKey, product);

    if (post.influencerId) {
      const inf = infMap.get(post.influencerId) || {
        influencerId: post.influencerId,
        name: post.influencerName,
        handle: post.influencerHandle,
        posts: 0,
        views: 0,
        likes: 0,
        comments: 0,
        productNames: [],
        productSet: new Set<string>(),
      };
      inf.posts += 1;
      inf.views += post.views;
      inf.likes += post.likes;
      inf.comments += post.comments;
      if (post.productName) inf.productSet.add(post.productName);
      infMap.set(post.influencerId, inf);
    }
  }

  const products = [...productMap.values()]
    .map(({ influencerIds, ...row }) => ({
      ...row,
      influencerCount: influencerIds.size,
    }))
    .sort((a, b) => b.views - a.views);

  const influencers = [...infMap.values()]
    .map(({ productSet, ...row }) => ({
      ...row,
      productNames: [...productSet],
    }))
    .sort((a, b) => b.views - a.views);

  return {
    source,
    generatedAt: new Date().toISOString(),
    period,
    totals: {
      views: posts.reduce((s, p) => s + p.views, 0),
      likes: posts.reduce((s, p) => s + p.likes, 0),
      comments: posts.reduce((s, p) => s + p.comments, 0),
      posts: posts.length,
      influencers: influencers.length,
      products: products.length,
    },
    products,
    influencers,
    posts: [...posts].sort((a, b) => {
      const da = a.postedAt || "";
      const db = b.postedAt || "";
      if (da !== db) return db.localeCompare(da);
      return b.views - a.views;
    }),
  };
}

export function formatMetric(n: number) {
  if (n >= 10000) {
    const man = n / 10000;
    return `${man >= 10 ? man.toFixed(0) : man.toFixed(1)}만`;
  }
  return n.toLocaleString("ko-KR");
}

export function engagementRate(views: number, likes: number, comments: number) {
  if (views <= 0) return 0;
  return ((likes + comments) / views) * 100;
}
