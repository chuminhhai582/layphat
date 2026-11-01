export type Viewer = {
  userId: string;        // id ổn định từ TikTok
  uniqueId: string;      // @handle
  nickname: string;      // tên hiển thị gốc
  displayName: string;   // tên đã chuẩn hóa để đọc
  avatarSeed: number;    // sinh biến thể avatar dân làng
};

export type LiveEvent =
  | { type: 'join'; viewer: Viewer; at: number }
  | { type: 'like'; viewer: Viewer; count: number; at: number }
  | { type: 'chat'; viewer: Viewer; text: string; at: number }
  | { type: 'follow'; viewer: Viewer; at: number }
  | { type: 'share'; viewer: Viewer; at: number }
  | {
    type: 'gift';
    viewer: Viewer;
    giftId: number;
    giftName: string;
    coinsEach: number;
    repeatCount: number;
    totalCoins: number;
    at: number;
  };

export type TierId = 'firefly' | 'visit' | 'miracle' | 'grand';

export type WishCategory =
  | 'binh_an'
  | 'suc_khoe'
  | 'hoc_hanh'
  | 'cong_viec'
  | 'gia_dao'
  | 'tinh_duyen'
  | 'tai_loc'
  | 'tuong_nho'
  | 'khac';

export type Visit = {
  id: string;
  viewer: Viewer;
  tier: TierId;
  totalCoins: number;
  enqueuedAt: number;
  hadWish: boolean;
  wishRejected: boolean; // true → overlay diễn cảnh lá ước tan trước khi Bụt nói
  blessing?: {
    text: string;
    openerText?: string;
    openerAudioUrl?: string;
    openerDurationMs?: number;
    source: 'ai' | 'bank';
    category: WishCategory;
    audioUrl: string;
    durationMs: number;
  };
  status: 'queued' | 'preparing' | 'ready' | 'performing' | 'done' | 'skipped';
};

export type BlessingLength = 'short' | 'full' | 'opener' | 'reject' | 'group' | 'grand';

export type OccasionType = 'trung_thu' | 'tet' | 'cuoi_nam' | null;

export type MiracleId =
  | 'glowing_book'
  | 'well_water'
  | 'golden_rice'
  | 'lit_cottage'
  | 'sparrow_pair'
  | 'lotus_bloom';

export type TierSetting = {
  id: TierId;
  minCoins: number;
  durationMs: number;
  appear: boolean;
  blessingLength: 'short' | 'full';
  miracle?: boolean;
  villageBook?: boolean;
  blessWholeVillage?: boolean;
};

export type AudioVolumes = {
  bgm: number;
  sfx: number;
  voice: number;
};

export type Settings = {
  tiers: TierSetting[];
  miracleByCategory: {
    hoc_hanh: MiracleId;
    suc_khoe: MiracleId;
    cong_viec: MiracleId;
    gia_dao: MiracleId;
    tinh_duyen: MiracleId;
    default: MiracleId;
    [key: string]: MiracleId;
  };
  giftGraceMs: {
    visit: number;
    miracle: number;
    grand: number;
  };
  comboWindowMs: number;
  maxWaitMs: number;
  shortenWhenQueueOver: number;
  groupVisitEveryMs: number;
  seatCount: number;
  wishPrefixes: string[];
  wishTtlMs: number;
  budShadowCooldownMs: number;
  volumes?: AudioVolumes;
  webcamEnabled?: boolean;
  ttsVoice?: string;
  ttsSpeed?: number;
};

export type SourceName = 'connector' | 'tikfinity' | 'simulator';

export type SourceStatusState = 'connecting' | 'live' | 'offline' | 'error';

export type SourceStatusInfo = {
  source: SourceName;
  status: SourceStatusState;
  detail?: string;
  latencyMs?: number;
  updatedAt: number;
};

export type BlessingRecord = {
  id: number;
  category: WishCategory;
  length: BlessingLength;
  text: string;
  occasion: OccasionType;
  weight: number;
  active: number;
  audio_path: string | null;
};

export type GroupVisitPayload = {
  id: string;
  names: string[];
  text: string;
  audioUrl: string;
  durationMs: number;
};

export type FireflyBurstPayload = {
  id: string;
  names: string[];
  text: string;
  audioUrl: string;
  durationMs: number;
};
