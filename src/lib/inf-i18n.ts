export const INF_LOCALES = ["ko", "en", "ja", "zh"] as const;
export type InfLocale = (typeof INF_LOCALES)[number];

export const INF_LOCALE_STORAGE_KEY = "inf-locale";

export const INF_LOCALE_LABEL: Record<InfLocale, string> = {
  ko: "한국어",
  en: "EN",
  ja: "日本語",
  zh: "中文",
};

export type InfMessages = {
  serverConfigError: string;
  sessionExpired: string;
  listPreparing: string;
  enterSnsId: string;
  snsPlatforms: string;
  confirm: string;
  confirming: string;
  logout: string;
  guest: string;
  welcomeName: (name: string) => string;
  loadingVisitInfo: string;
  loadingHard: string;
  movingToList: string;
  verifyFailed: string;
  verifyError: string;
  bootstrapFailed: string;
  handleRequired: string;
  handleNotFound: string;
  helloName: (name: string) => string;
  allocationListTitle: (name: string) => string;
  todayPickupCount: (n: number) => string;
  checkProductsBelow: string;
  verifiedDone: string;
  snsProfile: string;
  noAllocations: string;
  visitStore: string;
  visitSchedule: string;
  quantity: string;
  quantityUnit: (n: number) => string;
  product: string;
  productFallback: string;
  storeFallback: string;
  today: string;
  cancelled: string;
  pickupDone: string;
  pickupAvailable: string;
  openPickupInfo: string;
  dateUndecided: string;
  recheck: string;
  close: string;
  previous: string;
  pickupReviewTitle: string;
  pickupConfirmTitle: string;
  pickupReviewHint: string;
  pickupConfirmHint: string;
  showToPharmacist: string;
  pickupConfirmBtn: string;
  finalPickupConfirm: string;
  pickupIrreversible: string;
  pickupDoneBanner: string;
  cancelledCannotPickup: string;
  pickupFailed: string;
  pickupError: string;
  /** 시트 본문 라벨 (사용자 언어) */
  sheet: InfSheetLabels;
  /** 약사님께 보이는 한국어 고정 라벨 (시트 본문) */
  koSheet: InfSheetLabels;
};

export type InfSheetLabels = {
  product: string;
  store: string;
  visitDate: string;
  dateUndecided: string;
  influencer: string;
  quantity: string;
  quantityUnit: (n: number) => string;
  visitCode: string;
  pickupStatus: string;
  pickupDone: string;
  pickupWaiting: string;
  pickupTime: string;
  cancelled: string;
};

const koSheet: InfSheetLabels = {
  product: "상품",
  store: "매장",
  visitDate: "방문 예정일",
  dateUndecided: "날짜 미정",
  influencer: "인플루언서",
  quantity: "수량",
  quantityUnit: (n) => `${n}개`,
  visitCode: "방문 코드",
  pickupStatus: "수령 여부",
  pickupDone: "수령 완료",
  pickupWaiting: "수령 대기",
  pickupTime: "수령 시간",
  cancelled: "취소",
};

/** 사용자 언어 + 한국어 병기 (한국어 UI는 한국어만) */
export function bilingualSheetText(
  locale: InfLocale,
  localized: string,
  korean: string,
): string {
  if (locale === "ko" || localized === korean) return korean;
  return `${localized} / ${korean}`;
}

export const INF_MESSAGES: Record<InfLocale, InfMessages> = {
  ko: {
    serverConfigError: "서버 설정 오류입니다. 잠시 후 다시 시도해 주세요.",
    sessionExpired: "세션이 만료되었습니다. 다시 로그인해 주세요.",
    listPreparing: "목록 준비 중…",
    enterSnsId: "SNS 아이디를 입력해주세요",
    snsPlatforms: "샤오홍슈 · 인스타그램 · 틱톡",
    confirm: "확인",
    confirming: "확인 중…",
    logout: "로그아웃",
    guest: "게스트",
    welcomeName: (name) => `${name}님 환영합니다`,
    loadingVisitInfo: "방문 정보를 불러오는 중…",
    loadingHard: "열심히 불러오고 있어요!",
    movingToList: "상품 목록으로 이동 중…",
    verifyFailed: "본인확인에 실패했습니다.",
    verifyError: "본인확인 중 오류가 발생했습니다.",
    bootstrapFailed: "배정 정보를 불러오지 못했습니다.",
    handleRequired: "인스타그램 핸들을 입력하세요.",
    handleNotFound: "등록된 SNS 아이디와 일치하지 않습니다.",
    helloName: (name) => `안녕하세요, ${name}님!`,
    allocationListTitle: (name) => `${name}님의 배정 목록`,
    todayPickupCount: (n) => `오늘 수령 가능한 상품이 ${n}건 있습니다`,
    checkProductsBelow: "아래에서 상품을 확인해 주세요",
    verifiedDone: "본인 확인이 완료되었습니다.",
    snsProfile: "SNS 프로필",
    noAllocations: "배정된 상품이 없습니다.",
    visitStore: "방문 지점",
    visitSchedule: "방문 일정",
    quantity: "수량",
    quantityUnit: (n) => `${n}개`,
    product: "상품",
    productFallback: "상품",
    storeFallback: "매장",
    today: "오늘",
    cancelled: "취소됨",
    pickupDone: "수령 완료",
    pickupAvailable: "수령 가능",
    openPickupInfo: "수령 정보 확인하기 →",
    dateUndecided: "날짜 미정",
    recheck: "다시 확인",
    close: "닫기",
    previous: "이전",
    pickupReviewTitle: "수령 정보 확인",
    pickupConfirmTitle: "수령 최종 확인",
    pickupReviewHint: "관계자에게 제시 후 상품을 수령하세요.",
    pickupConfirmHint: "아래 내용이 맞다면 최종 확인을 눌러 주세요.",
    showToPharmacist: "약사님께 보여주세요",
    pickupConfirmBtn: "수령 확인",
    finalPickupConfirm: "최종 수령 확인",
    pickupIrreversible: "수령 확정 후에는 취소할 수 없습니다.",
    pickupDoneBanner: "✓ 수령 확인 완료",
    cancelledCannotPickup: "취소된 배정은 수령 확인할 수 없습니다.",
    pickupFailed: "수령 확인 실패",
    pickupError: "수령 확인 중 오류가 발생했습니다.",
    sheet: koSheet,
    koSheet,
  },
  en: {
    serverConfigError: "Server configuration error. Please try again later.",
    sessionExpired: "Your session has expired. Please sign in again.",
    listPreparing: "Preparing list…",
    enterSnsId: "Enter your SNS ID",
    snsPlatforms: "Xiaohongshu · Instagram · TikTok",
    confirm: "Confirm",
    confirming: "Checking…",
    logout: "Log out",
    guest: "Guest",
    welcomeName: (name) => `Welcome, ${name}`,
    loadingVisitInfo: "Loading your visit info…",
    loadingHard: "Almost ready…",
    movingToList: "Opening your product list…",
    verifyFailed: "Verification failed.",
    verifyError: "An error occurred during verification.",
    bootstrapFailed: "Could not load your allocations.",
    handleRequired: "Please enter your Instagram handle.",
    handleNotFound: "This SNS ID is not registered.",
    helloName: (name) => `Hello, ${name}!`,
    allocationListTitle: (name) => `${name}'s allocations`,
    todayPickupCount: (n) =>
      n === 1
        ? "1 product is available for pickup today"
        : `${n} products are available for pickup today`,
    checkProductsBelow: "Please check your products below",
    verifiedDone: "Identity verified.",
    snsProfile: "SNS profile",
    noAllocations: "No products assigned.",
    visitStore: "Store",
    visitSchedule: "Visit date",
    quantity: "Qty",
    quantityUnit: (n) => `${n}`,
    product: "Product",
    productFallback: "Product",
    storeFallback: "Store",
    today: "Today",
    cancelled: "Cancelled",
    pickupDone: "Picked up",
    pickupAvailable: "Ready",
    openPickupInfo: "View pickup info →",
    dateUndecided: "Date TBD",
    recheck: "Sign in again",
    close: "Close",
    previous: "Back",
    pickupReviewTitle: "Pickup info",
    pickupConfirmTitle: "Confirm pickup",
    pickupReviewHint: "Show this to staff, then pick up your product.",
    pickupConfirmHint: "If everything looks correct, confirm pickup.",
    showToPharmacist: "Please show this to the pharmacist",
    pickupConfirmBtn: "Confirm pickup",
    finalPickupConfirm: "Final confirm",
    pickupIrreversible: "Pickup cannot be undone once confirmed.",
    pickupDoneBanner: "✓ Pickup confirmed",
    cancelledCannotPickup: "Cancelled allocations cannot be picked up.",
    pickupFailed: "Pickup confirmation failed",
    pickupError: "An error occurred while confirming pickup.",
    sheet: {
      product: "Product",
      store: "Store",
      visitDate: "Visit date",
      dateUndecided: "Date TBD",
      influencer: "Influencer",
      quantity: "Qty",
      quantityUnit: (n) => `${n}`,
      visitCode: "Visit code",
      pickupStatus: "Pickup status",
      pickupDone: "Picked up",
      pickupWaiting: "Waiting for pickup",
      pickupTime: "Pickup time",
      cancelled: "Cancelled",
    },
    koSheet,
  },
  ja: {
    serverConfigError:
      "サーバー設定エラーです。しばらくしてから再度お試しください。",
    sessionExpired: "セッションの有効期限が切れました。再度ログインしてください。",
    listPreparing: "リストを準備中…",
    enterSnsId: "SNS IDを入力してください",
    snsPlatforms: "小紅書 · Instagram · TikTok",
    confirm: "確認",
    confirming: "確認中…",
    logout: "ログアウト",
    guest: "ゲスト",
    welcomeName: (name) => `${name}様、ようこそ`,
    loadingVisitInfo: "来店情報を読み込み中…",
    loadingHard: "読み込み中です…",
    movingToList: "商品リストへ移動中…",
    verifyFailed: "本人確認に失敗しました。",
    verifyError: "本人確認中にエラーが発生しました。",
    bootstrapFailed: "割り当て情報を読み込めませんでした。",
    handleRequired: "Instagramのハンドルを入力してください。",
    handleNotFound: "登録されたSNS IDと一致しません。",
    helloName: (name) => `こんにちは、${name}様！`,
    allocationListTitle: (name) => `${name}様の割り当て一覧`,
    todayPickupCount: (n) => `本日受け取り可能な商品が${n}件あります`,
    checkProductsBelow: "下の商品をご確認ください",
    verifiedDone: "本人確認が完了しました。",
    snsProfile: "SNSプロフィール",
    noAllocations: "割り当てられた商品はありません。",
    visitStore: "来店店舗",
    visitSchedule: "来店日",
    quantity: "数量",
    quantityUnit: (n) => `${n}個`,
    product: "商品",
    productFallback: "商品",
    storeFallback: "店舗",
    today: "本日",
    cancelled: "キャンセル",
    pickupDone: "受取済",
    pickupAvailable: "受取可",
    openPickupInfo: "受取情報を確認する →",
    dateUndecided: "日付未定",
    recheck: "再確認",
    close: "閉じる",
    previous: "戻る",
    pickupReviewTitle: "受取情報の確認",
    pickupConfirmTitle: "受取の最終確認",
    pickupReviewHint: "スタッフに提示してから商品を受け取ってください。",
    pickupConfirmHint: "内容に問題なければ最終確認を押してください。",
    showToPharmacist: "薬剤師の方に見せてください",
    pickupConfirmBtn: "受取確認",
    finalPickupConfirm: "最終受取確認",
    pickupIrreversible: "受取確定後は取り消せません。",
    pickupDoneBanner: "✓ 受取確認完了",
    cancelledCannotPickup: "キャンセルされた割り当ては受け取れません。",
    pickupFailed: "受取確認に失敗しました",
    pickupError: "受取確認中にエラーが発生しました。",
    sheet: {
      product: "商品",
      store: "店舗",
      visitDate: "来店予定日",
      dateUndecided: "日付未定",
      influencer: "インフルエンサー",
      quantity: "数量",
      quantityUnit: (n) => `${n}個`,
      visitCode: "来店コード",
      pickupStatus: "受取状況",
      pickupDone: "受取済",
      pickupWaiting: "受取待ち",
      pickupTime: "受取時間",
      cancelled: "キャンセル",
    },
    koSheet,
  },
  zh: {
    serverConfigError: "服务器配置错误，请稍后再试。",
    sessionExpired: "登录已过期，请重新登录。",
    listPreparing: "正在准备列表…",
    enterSnsId: "请输入您的 SNS 账号",
    snsPlatforms: "小红书 · Instagram · TikTok",
    confirm: "确认",
    confirming: "确认中…",
    logout: "退出登录",
    guest: "访客",
    welcomeName: (name) => `欢迎您，${name}`,
    loadingVisitInfo: "正在加载到访信息…",
    loadingHard: "正在加载中…",
    movingToList: "正在进入商品列表…",
    verifyFailed: "身份验证失败。",
    verifyError: "身份验证时发生错误。",
    bootstrapFailed: "无法加载分配信息。",
    handleRequired: "请输入 Instagram 账号。",
    handleNotFound: "与已登记的 SNS 账号不符。",
    helloName: (name) => `您好，${name}！`,
    allocationListTitle: (name) => `${name} 的分配列表`,
    todayPickupCount: (n) => `今天有 ${n} 件商品可领取`,
    checkProductsBelow: "请在下方查看您的商品",
    verifiedDone: "身份验证已完成。",
    snsProfile: "SNS 主页",
    noAllocations: "暂无分配商品。",
    visitStore: "到访门店",
    visitSchedule: "到访日期",
    quantity: "数量",
    quantityUnit: (n) => `${n}个`,
    product: "商品",
    productFallback: "商品",
    storeFallback: "门店",
    today: "今天",
    cancelled: "已取消",
    pickupDone: "已领取",
    pickupAvailable: "可领取",
    openPickupInfo: "查看领取信息 →",
    dateUndecided: "日期待定",
    recheck: "重新确认",
    close: "关闭",
    previous: "返回",
    pickupReviewTitle: "领取信息确认",
    pickupConfirmTitle: "最终领取确认",
    pickupReviewHint: "请向工作人员出示后领取商品。",
    pickupConfirmHint: "如信息无误，请点击最终确认。",
    showToPharmacist: "请出示给药剂师查看",
    pickupConfirmBtn: "确认领取",
    finalPickupConfirm: "最终确认领取",
    pickupIrreversible: "确认领取后无法取消。",
    pickupDoneBanner: "✓ 领取确认完成",
    cancelledCannotPickup: "已取消的分配无法领取。",
    pickupFailed: "领取确认失败",
    pickupError: "领取确认时发生错误。",
    sheet: {
      product: "商品",
      store: "门店",
      visitDate: "到访日期",
      dateUndecided: "日期待定",
      influencer: "达人",
      quantity: "数量",
      quantityUnit: (n) => `${n}个`,
      visitCode: "到访码",
      pickupStatus: "领取状态",
      pickupDone: "已领取",
      pickupWaiting: "待领取",
      pickupTime: "领取时间",
      cancelled: "已取消",
    },
    koSheet,
  },
};

/** API가 한국어로 내려준 오류를 현재 로케일 문구로 매핑 */
export function translateInfApiError(
  message: string | undefined | null,
  t: InfMessages,
): string {
  const msg = (message || "").trim();
  if (!msg) return t.verifyError;

  const map: Record<string, string> = {
    "인스타그램 핸들을 입력하세요.": t.handleRequired,
    "등록된 SNS 아이디와 일치하지 않습니다.": t.handleNotFound,
    "본인확인에 실패했습니다.": t.verifyFailed,
    "본인확인 중 오류가 발생했습니다.": t.verifyError,
    "배정 정보를 불러오지 못했습니다.": t.bootstrapFailed,
    "세션이 만료되었습니다. 다시 로그인해 주세요.": t.sessionExpired,
    "수령 확인 실패": t.pickupFailed,
    "수령 확인 중 오류가 발생했습니다.": t.pickupError,
  };

  return map[msg] || msg;
}

const WEEKDAY: Record<InfLocale, string[]> = {
  ko: ["일", "월", "화", "수", "목", "금", "토"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ja: ["日", "月", "火", "水", "木", "金", "土"],
  zh: ["日", "一", "二", "三", "四", "五", "六"],
};

export function formatVisitDateLocalized(
  ymd: string | null,
  locale: InfLocale,
  undecided: string,
): string {
  if (!ymd) return undecided;
  const [, m, d] = ymd.split("-").map(Number);
  if (!m || !d) return ymd;
  if (locale === "ko") return `${m}월 ${d}일`;
  if (locale === "ja") return `${m}月${d}日`;
  if (locale === "zh") return `${m}月${d}日`;
  return `${m}/${d}`;
}

export function formatVisitWeekdayLocalized(
  ymd: string | null,
  locale: InfLocale,
): string {
  if (!ymd) return "";
  const date = new Date(ymd + "T00:00:00+09:00");
  return WEEKDAY[locale][date.getDay()] || "";
}

/** 약사용 한국어 날짜 (시트 본문 고정) */
export function formatVisitDateKo(ymd: string | null) {
  if (!ymd) return "날짜 미정";
  const [, m, d] = ymd.split("-").map(Number);
  if (!m || !d) return ymd;
  return `${m}월 ${d}일`;
}

export function formatVisitDayOfWeekKo(ymd: string | null) {
  if (!ymd) return "";
  const date = new Date(ymd + "T00:00:00+09:00");
  return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
}

export function isInfLocale(value: unknown): value is InfLocale {
  return (
    typeof value === "string" &&
    (INF_LOCALES as readonly string[]).includes(value)
  );
}
