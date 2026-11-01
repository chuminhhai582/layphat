# Bụt Ơi Live — Kế hoạch thực thi code

> Tài liệu bàn giao cho AI coding tool (Antigravity / Claude Code). Đọc toàn bộ file này và `UI_SPEC.md` trước khi viết dòng code đầu tiên.
> Phiên bản: 2026-10-31.

---

## 0. Tóm tắt sản phẩm (đủ để hiểu việc mình làm)

**Bụt Ơi Live** là một **overlay dọc 1080×1920** chạy trên PC của streamer, được gắn vào **TikTok LIVE Studio hoặc OBS** dưới dạng *Browser Source*. Nó nghe sự kiện của phiên live (vào xem, thả tim, bình luận, theo dõi, chia sẻ, tặng quà) và diễn hoạt trong bối cảnh một **làng quê cổ tích Việt Nam**.

- Người xem vào live → thành một **dân làng** ngồi quanh gốc đa, mang tên TikTok của họ.
- Người xem **tặng quà** → mây ngũ sắc kéo đến, **Ông Bụt** (nhân vật cổ tích) hiện ra trước mặt họ, hỏi chuyện, rồi đọc **lời chúc**:
  - Có lời ước riêng (bình luận bắt đầu bằng `ước:`) → AI kiểm duyệt và viết lại thành lời Bụt.
  - Không có → lấy lời chúc trong kho.
- Ai vào xem cũng được Bụt chúc miễn phí theo lượt (**Bụt ghé làng** mỗi 4 phút). Quà chỉ làm phép màu lớn hơn.

**Ràng buộc bắt buộc, không được vi phạm:**

1. Đây là **trò chơi giải trí lấy cảm hứng từ truyện cổ tích**, không phải nghi lễ tôn giáo. Cảnh **không có** bàn thờ, bát hương, miếu, lễ vật.
2. Ông Bụt **không có** biểu tượng Phật giáo: không tòa sen, không tràng hạt, không chữ Vạn, không vòng hào quang sau đầu, không tư thế thiền, không áo cà sa.
3. **Không văn bản nào người xem gõ được đọc lên sóng** nếu chưa qua bộ kiểm duyệt.
4. Overlay **không hiển thị số xu hay bảng giá quà**. Luôn hiện dòng chú thích *"Trò chơi giải trí lấy cảm hứng từ truyện cổ tích"*.
5. Bảng lời ước gốc **tự xóa sau 24 giờ**.

---

## 1. Kiến trúc

```
TikTok LIVE
   │ (sự kiện)
   ▼
┌───────────────────┐      ┌──────────────────────────────────────────────┐
│ Nguồn sự kiện      │      │ Server Node.js (chạy trên PC streamer)       │
│ • TikTok-Live-     │ ───► │  Chuẩn hóa sự kiện → Hàng chờ Bụt hiện       │
│   Connector (chính)│      │        → Bộ soạn lời chúc (AI + kho)         │ ◄──► Claude API
│ • TikFinity WS     │      │        → Dịch vụ giọng đọc (TTS + cache)     │ ◄──► TTS API
│   (dự phòng)       │      │  SQLite: log, kho câu, cấu hình              │
│ • Bộ giả lập       │      └───────────────┬──────────────────────────────┘
└───────────────────┘                      │ Socket.IO
                               ┌────────────┴────────────┐
                               ▼                         ▼
                     Overlay (Phaser 3)          Trang quản trị (React)
                     Browser Source              mở trên điện thoại
                               │
                               ▼
                   TikTok LIVE Studio / OBS → phát lên sóng
```

Toàn bộ chạy trên PC phát live, chỉ gọi ra ngoài cho AI và giọng đọc. Mục tiêu: **< 1 giây** từ lúc nhận quà đến lúc server phát lệnh; hệ thống vẫn chạy (bằng kho lời chúc) khi mất mạng ra ngoài.

---

## 2. Tech stack

| Lớp | Chọn | Ghi chú |
|---|---|---|
| Kết nối TikTok | `tiktok-live-connector` 2.x (TypeScript) | Thư viện **không chính thức** (reverse-engineering); có thể hỏng khi TikTok đổi giao thức → bắt buộc có nguồn dự phòng |
| Nguồn dự phòng | TikFinity Events API (WebSocket cục bộ, mặc định `ws://127.0.0.1:21213`) | Cần mở app TikFinity desktop trên cùng PC |
| Server | Node.js 20+, TypeScript, Fastify, Socket.IO | |
| Overlay | Phaser 3 + Vite | MVP: nhân vật dạng "puppet" nhiều lớp PNG + tween; giai đoạn sau nâng lên Spine (`@esotericsoftware/spine-phaser`) |
| Trang quản trị | React + Vite + Tailwind + shadcn/ui | Mở trên điện thoại cùng Wi-Fi |
| CSDL | SQLite (`better-sqlite3`) | Một file, không cần cài đặt |
| AI | `@anthropic-ai/sdk`, model `claude-haiku-5-5` (đổi qua env) | Câu ngắn, cần nhanh và rẻ |
| Giọng đọc | Adapter: FPT.AI / Vbee / Viettel AI / Google Cloud TTS | Đổi nhà cung cấp không sửa code nghiệp vụ |
| Hậu kỳ audio | `ffmpeg` (reverb nhẹ, ghép tên) | |
| Test | Vitest | |

---

## 3. Ngày 0 — Thiết lập dự án (Task T00)

### 3.1. Lệnh khởi tạo

```bash
mkdir but-oi-live && cd but-oi-live
pnpm init
mkdir -p apps/server apps/overlay apps/admin packages/shared content assets/placeholder

# server
cd apps/server && pnpm init && pnpm add fastify @fastify/static @fastify/cors socket.io tiktok-live-connector \
  @anthropic-ai/sdk better-sqlite3 zod dotenv nanoid pino ws
pnpm add -D typescript tsx @types/node @types/better-sqlite3 @types/ws vitest && cd ../..

# overlay
pnpm create vite apps/overlay --template vanilla-ts && cd apps/overlay && pnpm add phaser socket.io-client && cd ../..

# admin
pnpm create vite apps/admin --template react-ts && cd apps/admin && pnpm add socket.io-client \
  && pnpm add -D tailwindcss @tailwindcss/vite && pnpm dlx shadcn@latest init && cd ../..

# công cụ chung
pnpm add -Dw concurrently eslint prettier typescript
```

### 3.2. `pnpm-workspace.yaml`

```yaml
packages:
  - apps/*
  - packages/*
```

### 3.3. Scripts ở `package.json` gốc

```json
{
  "scripts": {
    "dev": "concurrently -n server,overlay,admin \"pnpm -C apps/server dev\" \"pnpm -C apps/overlay dev\" \"pnpm -C apps/admin dev\"",
    "dev:server": "pnpm -C apps/server dev",
    "build": "pnpm -r build",
    "start": "pnpm build && pnpm -C apps/server start",
    "test": "pnpm -r test",
    "lint": "eslint . --ext .ts,.tsx",
    "seed": "pnpm -C apps/server seed",
    "voices": "pnpm -C apps/server voices"
  }
}
```

- `pnpm dev`: overlay cổng 5173, admin 5174, server 7777.
- `pnpm start` (chế độ live): server build overlay + admin thành file tĩnh và phục vụ ở `http://localhost:7777/overlay` và `/admin` — **một cổng duy nhất**.
- `pnpm voices`: tạo lại toàn bộ file giọng đọc cho kho lời chúc.

### 3.4. Quy ước

- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`.
- File camelCase, class PascalCase.
- **Mọi chuỗi hiển thị tiếng Việt** đặt trong `packages/shared/strings.vi.ts`.
- Log bằng pino; `info` khi live, `debug` khi phát triển; ghi ra `logs/YYYY-MM-DD.log`, giữ 14 ngày.
- Git: `main` luôn chạy được; mỗi task một nhánh (`t07-queue`).

### 3.5. Cấu trúc thư mục

```text
but-oi-live/
├── apps/
│   ├── server/
│   │   └── src/
│   │       ├── sources/      # tiktokConnector.ts, tikfinity.ts, simulator.ts, index.ts
│   │       ├── core/         # normalizer.ts, queue.ts, tiers.ts, seats.ts, preparer.ts, groupVisit.ts, retention.ts
│   │       ├── blessing/     # moderator.ts, bank.ts, picker.ts, nameSanitizer.ts, bannedWords.ts
│   │       ├── voice/        # tts/fpt.ts, tts/vbee.ts, tts/viettel.ts, tts/google.ts, cache.ts, post.ts
│   │       ├── db/           # schema.sql, repo.ts
│   │       ├── scripts/      # seed.ts, voices.ts, evalModeration.ts
│   │       ├── realtime.ts
│   │       ├── static.ts
│   │       ├── config.ts
│   │       └── index.ts
│   ├── overlay/
│   │   └── src/
│   │       ├── main.ts
│   │       ├── scenes/       # VillageScene.ts, DayNight.ts, SeatGrid.ts, Villager.ts, VisitDirector.ts, Miracles.ts, FX.ts
│   │       ├── puppets/      # BudPuppet.ts, VillagerPuppet.ts (MVP: PNG nhiều lớp + tween)
│   │       ├── ui/           # Hud.ts, NameBanner.ts, QueueChip.ts, HowToCard.ts, Subtitle.ts, Disclaimer.ts, Counter.ts
│   │       ├── audio/        # AudioBus.ts
│   │       └── theme.ts      # token màu, chữ (xem UI_SPEC.md)
│   └── admin/
│       └── src/pages/        # Live.tsx, Manual.tsx, Bank.tsx, Words.tsx, Settings.tsx, Simulator.tsx, Stats.tsx
├── packages/shared/          # types.ts, events.ts, strings.vi.ts
├── content/blessings.json    # kho lời chúc khởi tạo
├── assets/
│   ├── manifest.json         # danh sách ảnh, âm thanh (code chỉ đọc qua đây)
│   ├── placeholder/          # ảnh tạm sinh tự động
│   └── art/                  # ảnh thật từ họa sĩ (thay sau)
├── test/fixtures/troll.json  # 200 lời ước xấu để kiểm duyệt
└── .env.example
```

---

## 4. Hợp đồng dữ liệu (`packages/shared`)

### 4.1. Kiểu dữ liệu

```typescript
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
  | { type: 'gift'; viewer: Viewer; giftId: number; giftName: string;
      coinsEach: number; repeatCount: number; totalCoins: number; at: number };

export type TierId = 'firefly' | 'visit' | 'miracle' | 'grand';

export type WishCategory = 'binh_an' | 'suc_khoe' | 'hoc_hanh' | 'cong_viec'
  | 'gia_dao' | 'tinh_duyen' | 'tai_loc' | 'tuong_nho' | 'khac';

export type Visit = {
  id: string;
  viewer: Viewer;
  tier: TierId;
  totalCoins: number;
  enqueuedAt: number;
  hadWish: boolean;
  wishRejected: boolean;  // true → overlay diễn cảnh lá ước tan trước khi Bụt nói
  blessing?: { text: string; source: 'ai' | 'bank'; category: WishCategory; audioUrl: string; durationMs: number };
  status: 'queued' | 'preparing' | 'ready' | 'performing' | 'done' | 'skipped';
};
```

### 4.2. Sự kiện Socket.IO

| Tên | Chiều | Dữ liệu | Overlay làm gì |
|---|---|---|---|
| `seat:add` | server → overlay | `Viewer` | Dân làng đi vào, ngồi xuống |
| `seat:remove` | server → overlay | `userId` | Dân làng rời đi |
| `fx:firefly` | server → overlay | `userId`, `count` | Đom đóm + chữ nổi "may mắn +1" |
| `fx:wave` | server → overlay | `userId` | Vẫy tay gọi Bụt; bóng Bụt thấp thoáng trên ngọn đa (tối đa 1 lần/30s) |
| `fx:leaf` | server → overlay | `userId` | Lá ước treo trên đầu |
| `fx:fish` / `fx:sparrow` | server → overlay | `userId` | Cá bống (follow), chim sẻ (share) |
| `visit:start` | server → overlay | `Visit` (đã có lời chúc + audio) | Chạy kịch bản theo bậc |
| `visit:done` | overlay → server | `visitId` | Báo xong để phát lượt kế |
| `queue:update` | server → overlay, admin | 5 lượt kế tiếp | Cập nhật chip hàng chờ |
| `visit:group` | server → overlay | danh sách tên + audio | Lượt Bụt ghé làng miễn phí |
| `state:pause` | server → overlay | `boolean` | Ẩn hàng chờ, hiện "Bụt đang nghỉ chân một lát" |
| `admin:*` | admin → server | lệnh | Bỏ qua, đưa lên đầu, tạm dừng, Bụt hiện thủ công, đổi nguồn |

Server chỉ phát `visit:start` khi lời chúc và audio đã sẵn sàng. Nếu overlay không gửi `visit:done` sau `durationMs + 10s`, server tự chuyển lượt.

### 4.3. Bảng SQLite

| Bảng | Cột chính | Dùng để |
|---|---|---|
| `blessings` | id, category, length (`short`/`full`/`opener`/`reject`/`group`/`grand`), text, occasion (`null`/`trung_thu`/`tet`/`cuoi_nam`), weight, active, audio_path | Kho lời chúc |
| `wishes` | id, user_id, raw_text, created_at, used_visit_id — **tự xóa sau 24 giờ** | Lời ước chờ |
| `visits` | id, user_id, nickname, tier, total_coins, blessing_source, category, wish_rejected, created_at | Log, thống kê, Sổ làng |
| `banned_words` | word | Lọc nhanh trước khi gọi AI |
| `settings` | key, value (JSON) | Cấu hình chỉnh từ admin |

### 4.4. Cấu hình (`settings`)

```json
{
  "tiers": [
    { "id": "firefly", "minCoins": 1,    "durationMs": 5000,  "appear": false, "blessingLength": "short" },
    { "id": "visit",   "minCoins": 30,   "durationMs": 20000, "appear": true,  "blessingLength": "full" },
    { "id": "miracle", "minCoins": 300,  "durationMs": 28000, "appear": true,  "blessingLength": "full", "miracle": true, "villageBook": true },
    { "id": "grand",   "minCoins": 3000, "durationMs": 45000, "appear": true,  "blessingLength": "full", "villageBook": true, "blessWholeVillage": true }
  ],
  "miracleByCategory": {
    "hoc_hanh": "glowing_book", "suc_khoe": "well_water", "cong_viec": "golden_rice",
    "gia_dao": "lit_cottage", "tinh_duyen": "sparrow_pair", "default": "lotus_bloom"
  },
  "giftGraceMs": { "visit": 1500, "miracle": 2500, "grand": 3500 },
  "comboWindowMs": 5000,
  "maxWaitMs": 90000,
  "shortenWhenQueueOver": 8,
  "groupVisitEveryMs": 240000,
  "seatCount": 36,
  "wishPrefixes": ["ước:", "uoc:", "#uoc"],
  "wishTtlMs": 1800000,
  "budShadowCooldownMs": 30000
}
```

`giftGraceMs`: quà lớn của TikTok có hiệu ứng riêng che giữa màn hình vài giây → chờ trước khi phát `visit:start`. Đo lại bằng buổi live thử và chỉnh trong admin.

### 4.5. Biến môi trường (`.env.example`)

```bash
TIKTOK_USERNAME=ten_kenh_cua_ban
EVENT_SOURCE=connector          # connector | tikfinity | simulator
TIKFINITY_WS=ws://127.0.0.1:21213
ANTHROPIC_API_KEY=
AI_MODEL=claude-haiku-5-5
AI_TIMEOUT_MS=2500
TTS_PROVIDER=fpt                # fpt | vbee | viettel | google
TTS_API_KEY=
TTS_VOICE=
TTS_SPEED=0.85
TTS_REVERB=0.15
PORT=7777
ADMIN_PIN=
```

---

## 5. Bậc quà và luồng một lượt

| Bậc | Tổng xu 1 lần tặng | Diễn biến | Thời lượng |
|---|---|---|---|
| Đom đóm ước (`firefly`) | 1–29 | Đàn đom đóm bay lên từ chỗ người đó; giọng Bụt vọng từ xa chúc 1 câu (gộp tối đa 5 tên nếu dồn dập). **Không vào hàng chờ** | 5s |
| Bụt hiện (`visit`) | 30–299 | Mây ngũ sắc, Bụt hiện trước người đó, hỏi chuyện, chúc 2–3 câu, gõ gậy cho hoa cỏ nở | 20s |
| Phép màu (`miracle`) | 300–2.999 | Như trên + phép riêng theo loại điều ước; tên được ghi Sổ làng | 28s |
| Đại phép (`grand`) | ≥ 3.000 | Chuyển đêm trăng rằm, Bụt cưỡi mây bay quanh làng, mưa hoa, chúc cả làng | 45s |

Phép riêng ở bậc Phép màu:

| `category` | Phép |
|---|---|
| `hoc_hanh` | Cuốn sách bay ra từ tay áo Bụt, trang sách phát sáng |
| `suc_khoe` | Nước giếng làng sáng lên, gáo nước trong bay đến |
| `cong_viec` | Ruộng lúa phía sau chín vàng, gió thổi thành sóng |
| `gia_dao` | Mái nhà tranh nhỏ hiện ra, cửa sổ sáng đèn |
| `tinh_duyen` | Đôi chim sẻ đậu cạnh nhau trên cành đa |
| khác | Hoa sen trong ao nở đồng loạt |

Bảng sự kiện → phản hồi:

| Sự kiện | Phản hồi | Giới hạn |
|---|---|---|
| Vào xem | Dân làng đi vào, ngồi xuống | Hết chỗ → thay người im lặng lâu nhất |
| Thả tim | Đom đóm + chữ nổi "may mắn +1" | 1 hiệu ứng/2s/người |
| Bình luận "Bụt ơi" | Vẫy tay; bóng Bụt thấp thoáng | 1 lần/30s |
| Bình luận `ước: …` | Lá ước trên đầu | Giữ 30 phút, 1 lời ước mới nhất/người |
| Lời ước bị từ chối | Lá rơi xuống ao, tan thành bọt | Không đọc nội dung |
| Theo dõi | Cá bống ngoi lên | — |
| Chia sẻ | Chim sẻ đậu cạnh người đó | — |
| Tặng quà | Bụt hiện theo bậc | Vào hàng chờ (trừ `firefly`) |
| Hẹn giờ 4 phút | Bụt ghé làng, chúc 3–5 người mới vào | Hoãn nếu đang có lượt |

---

## 6. Thuật toán then chốt

### 6.1. Nguồn sự kiện và tự kết nối lại (T10–T12)

```typescript
export interface EventSource {
  readonly name: 'connector' | 'tikfinity' | 'simulator';
  connect(): Promise<void>;
  disconnect(): void;
  on(handler: (e: LiveEvent) => void): void;
  onStatus(handler: (s: 'connecting' | 'live' | 'offline' | 'error', detail?: string) => void): void;
}

async function connectWithRetry(src: EventSource) {
  let delay = 2000;
  for (;;) {
    try { await src.connect(); delay = 2000; return; }
    catch (err) { log.warn({ err }, 'connect failed'); await sleep(delay); delay = Math.min(delay * 2, 30000); }
  }
}
```

### 6.2. Gộp quà combo (T05)

```typescript
// Quà dạng chuỗi (giftType 1) bắn nhiều sự kiện; chỉ tính khi repeatEnd = true.
// Cộng mọi quà của cùng userId trong comboWindowMs thành một lượt.
const pending = new Map<string, { total: number; timer: NodeJS.Timeout; viewer: Viewer }>();

function onRawGift(g: RawGift) {
  if (g.giftType === 1 && !g.repeatEnd) return;
  const coins = g.diamondCount * g.repeatCount;
  const p = pending.get(g.userId);
  if (p) { p.total += coins; return; }
  const timer = setTimeout(() => flush(g.userId), cfg.comboWindowMs);
  pending.set(g.userId, { total: coins, timer, viewer: toViewer(g) });
}

function flush(userId: string) {
  const p = pending.get(userId)!; pending.delete(userId);
  emit({ type: 'gift', viewer: p.viewer, totalCoins: p.total, at: Date.now() /* … */ });
}
```

### 6.3. Hàng chờ (T07)

```typescript
const RANK: Record<TierId, number> = { firefly: 0, visit: 1, miracle: 2, grand: 3 };

function enqueue(v: Viewer, coins: number) {
  const existing = queue.find(x => x.viewer.userId === v.userId && ['queued', 'preparing', 'ready'].includes(x.status));
  if (existing) {                      // tặng thêm khi đang chờ → nâng bậc, không tạo lượt mới
    existing.totalCoins += coins;
    existing.tier = tierFor(existing.totalCoins);
    return existing;
  }
  const item: Visit = { id: nanoid(), viewer: v, totalCoins: coins, tier: tierFor(coins),
    enqueuedAt: Date.now(), status: 'queued', hadWish: false, wishRejected: false };
  queue.push(item);
  return item;
}

function pickNext(now = Date.now()) {
  const ready = queue.filter(x => x.status === 'ready');
  const starving = ready.filter(x => now - x.enqueuedAt > cfg.maxWaitMs)
                        .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  if (starving[0]) return starving[0];             // chống chờ vô hạn
  return ready.sort((a, b) => RANK[b.tier] - RANK[a.tier] || a.enqueuedAt - b.enqueuedAt)[0];
}

const durationFor = (t: TierId) =>
  t === 'visit' && queue.length > cfg.shortenWhenQueueOver ? 12000 : cfg.tiers[t].durationMs;
```

Giữa hai lượt liên tiếp nghỉ tối thiểu 1,5 giây.

### 6.4. Chuẩn bị lời và giọng (T26)

```typescript
// Luôn chuẩn bị lượt đầu hàng và lượt kế tiếp, song song tối đa 2.
async function prepare(item: Visit) {
  item.status = 'preparing';
  const wish = repo.latestWish(item.viewer.userId, cfg.wishTtlMs);
  const result = wish ? await moderator.check(item.viewer.displayName, wish.raw_text) : null; // null nếu lỗi/timeout
  item.hadWish = !!wish;
  item.wishRejected = !!wish && result?.allowed === false;
  const text = result?.allowed ? result.blessing : picker.pick({ category: result?.category, tier: item.tier });
  const { url, durationMs } = await voice.render(fillName(text, item.viewer.displayName));
  item.blessing = { text, source: result?.allowed ? 'ai' : 'bank', category: result?.category ?? 'binh_an', audioUrl: url, durationMs };
  item.status = 'ready';
}
```

Dự phòng: TTS lỗi → câu kho có sẵn audio + tên từ cache; vẫn lỗi → phát lượt chỉ có phụ đề.

### 6.5. Máy trạng thái overlay (T18)

```typescript
type Phase = 'IDLE' | 'SUMMON' | 'APPEAR' | 'ASK' | 'SPEAK' | 'MIRACLE' | 'LEAVE';

const PLAN = {
  visit:   { SUMMON: 2000, APPEAR: 2000, ASK: 2000, SPEAK: 'audio', MIRACLE: 2000,  LEAVE: 2000 },
  miracle: { SUMMON: 2500, APPEAR: 2000, ASK: 2000, SPEAK: 'audio', MIRACLE: 6000,  LEAVE: 2500 },
  grand:   { SUMMON: 5000, APPEAR: 3000, ASK: 2000, SPEAK: 'audio', MIRACLE: 15000, LEAVE: 5000 },
} as const;

class VisitDirector {
  async run(v: Visit) {
    this.guard = setTimeout(() => this.abort(), totalOf(v) + 10000);
    await this.phase('SUMMON', v);   // gió, mây kéo đến; dân làng được chọn bước lên sân khấu
    await this.phase('APPEAR', v);   // khói, Bụt hiện
    if (v.wishRejected) await this.leafDrop(v);
    await this.phase('ASK', v);      // câu mở đầu có sẵn audio
    await this.phase('SPEAK', v);    // audio lời chúc + phụ đề
    await this.phase('MIRACLE', v);  // phép theo category hoặc hoa nở
    await this.phase('LEAVE', v);    // Bụt tan vào mây, dân làng về chỗ
    clearTimeout(this.guard);
    socket.emit('visit:done', v.id);
  }
}
```

---

## 7. AI kiểm duyệt và kho lời chúc

### 7.1. Luồng

1. Lấy lời ước mới nhất của người này (≤ 30 phút). Không có → dùng kho (bước 4).
2. Lọc nhanh bằng `banned_words`; trúng → coi như bị từ chối, không gọi AI.
3. Gọi AI, quá `AI_TIMEOUT_MS` → dùng kho.
4. Chọn từ kho theo: mùa đặc biệt → khung giờ → ngẫu nhiên có trọng số, không lặp trong 20 lượt gần nhất.
5. Chuẩn hóa tên: bỏ emoji, ký tự đặc biệt, số đuôi dài; rỗng → "con".
6. Ghép giọng, phát, ghi log.

### 7.2. Prompt hệ thống (dán thẳng vào `moderator.ts`)

```text
Bạn đóng vai Ông Bụt trong truyện cổ tích Việt Nam: một ông lão hiền hậu, hóm hỉnh, hiện ra giúp người tốt.
Đây là trò chơi giải trí trên livestream, KHÔNG phải nghi lễ tôn giáo.
Đầu vào: tên người xem và lời ước họ gõ (có thể sai chính tả, viết tắt, không dấu, teencode).
Nhiệm vụ: quyết định có dùng được không, rồi viết lại thành lời Bụt chúc.

TỪ CHỐI (allowed=false) nếu lời ước: tục tĩu; xúc phạm bất kỳ tôn giáo, dân tộc, nhóm người nào; trù ẻo, mong người khác gặp hại; bùa yêu, ép người khác yêu mình; chính trị, người nổi tiếng có thật; xin số đề, kết quả cá cược; quảng cáo, link; nội dung tình dục; nhắc tới tự hại.

VỚI LỜI ƯỚC HỢP LỆ, viết lời Bụt:
- 2 đến 4 câu, tổng dưới 70 từ, tiếng Việt có dấu.
- Bụt xưng "Bụt", gọi người nhận là "con" và nhắc tên bằng {ten} (giữ nguyên placeholder này).
- Giọng ông già ấm áp, mộc mạc, có thể hóm hỉnh nhẹ; được dùng hình ảnh làng quê (lúa, giếng, gốc đa, trăng).
- Là lời CHÚC, không phải lời HỨA: "Bụt chúc", "Bụt mong"; không khẳng định điều ước chắc chắn thành.
- Không dùng từ ngữ Phật giáo hay nghi lễ: không "Nam mô", "A Di Đà", "Phật", "công đức", "cúng dường", "siêu độ", "giải hạn", "phù hộ độ trì".
- Sức khỏe, bệnh tật: không nhắc tên bệnh cụ thể, chỉ nói "người thân đang mệt"; chúc mau khỏe, an tâm điều trị; không nói thay thầy thuốc.
- Người thân đã mất: an ủi người đang nhớ thương, không nói về kiếp sau hay siêu thoát.
- Không nhắc tên người thứ ba có trong lời ước; dùng "người con thương", "mẹ con".
- Không nhắc tiền hay quà tặng.
Phân loại category: binh_an | suc_khoe | hoc_hanh | cong_viec | gia_dao | tinh_duyen | tai_loc | tuong_nho | khac.
Chỉ trả về JSON: {"allowed": bool, "category": string, "blessing": string, "reason": string}
```

Parse bằng zod; JSON lỗi → coi như timeout (dùng kho).

### 7.3. Kho lời chúc — câu mẫu (seed vào `content/blessings.json`, mục tiêu MVP 150 câu)

```json
[
  { "category": "khac", "length": "opener", "text": "Vì sao con buồn? À, Bụt nghe rồi." },
  { "category": "khac", "length": "opener", "text": "Ồ, {ten} đấy à. Lại đây Bụt bảo." },
  { "category": "binh_an", "length": "full", "text": "Bụt chúc {ten} ra đường gặp nắng đẹp, về nhà gặp cơm ngon. Chuyện gì nặng lòng thì để gió đồng thổi đi con nhé." },
  { "category": "suc_khoe", "length": "full", "text": "Người con thương đang mệt phải không? Bụt mong người ấy ăn được ngủ được, khỏe dần lên từng ngày. Con cũng nhớ giữ sức mình nữa đấy." },
  { "category": "hoc_hanh", "length": "full", "text": "Học hành vất vả lắm hả {ten}? Bụt chúc con đầu óc sáng như trăng rằm, đi thi bình tĩnh, làm bài trơn tru." },
  { "category": "cong_viec", "length": "full", "text": "Bụt chúc {ten} làm đâu chắc đó, như lúa trổ đúng mùa. Gặp người tốt giúp, gặp việc khó cũng có cách." },
  { "category": "gia_dao", "length": "full", "text": "Bụt mong nhà {ten} lúc nào cũng có tiếng cười, mâm cơm có đủ người. Ai nóng thì nhịn, ai buồn thì thương, thế là ấm." },
  { "category": "tinh_duyen", "length": "full", "text": "Duyên đến cũng như mưa xuân, không vội được đâu {ten} ạ. Bụt chúc con gặp người thương mình thật lòng, và lúc chờ thì vẫn vui." },
  { "category": "tai_loc", "length": "full", "text": "Bụt chúc {ten} làm ăn ngay thẳng, đủ ăn đủ để, có dư chút lo cho cha mẹ. Giàu thì vui, mà đủ cũng là phúc con ạ." },
  { "category": "tuong_nho", "length": "full", "text": "Bụt biết con đang nhớ người thân. Người ấy chắc mong con sống vui, ăn uống đầy đủ. Nhớ thì cứ nhớ, nhưng đừng buồn lâu con nhé." },
  { "category": "khac", "length": "reject", "text": "Ước gì kỳ thế, Bụt không nghe đâu. Thôi, Bụt chúc {ten} tối nay vui vẻ là được rồi." },
  { "category": "khac", "length": "group", "text": "Ồ, làng hôm nay đông thế! {ten_1}, {ten_2}, {ten_3} mới đến phải không? Bụt chúc các con một tối thật bình yên." },
  { "category": "khac", "length": "grand", "text": "Nhờ tấm lòng của {ten}, Bụt chúc cả làng mình đêm nay ai cũng ngủ ngon, sáng mai ai cũng có chuyện vui." }
]
```

### 7.4. Giọng đọc

- Giọng nam lớn tuổi, ấm, chậm; tốc độ 0,85; reverb nhẹ (`TTS_REVERB`) như vọng từ trong mây.
- Tạo sẵn audio cho toàn kho khi khởi động; tên người đọc riêng rồi ghép, cache theo tên.
- Cache key = sha1(provider + voice + speed + text).

---

## 8. Bảng task chi tiết (39 task / 4 tuần)

Mỗi task: < 300 dòng thay đổi; **xong** = build + lint + test của task qua, chạy được qua bộ giả lập, overlay không lỗi console, README cập nhật nếu có lệnh mới.

### Tuần 1 — M1: Lõi server

| Mã | Việc | File chính | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| T00 | Khung monorepo | gốc, `apps/*` | — | `pnpm dev` chạy 3 app trống; `pnpm test` chạy |
| T01 | Kiểu dùng chung, chuỗi tiếng Việt | `shared/types.ts`, `events.ts`, `strings.vi.ts` | T00 | 3 app import được, build qua |
| T02 | Cấu hình, biến môi trường | server `config.ts` | T01 | zod kiểm tra `.env` + settings; thiếu biến báo lỗi rõ |
| T03 | SQLite: schema, repo, seed | server `db/*`, `content/blessings.json` (20 câu) | T02 | `pnpm seed` tạo DB; test thêm/sửa/đọc |
| T04 | Bộ giả lập | server `sources/simulator.ts`, `POST /sim` | T01 | Bắn đủ 6 loại sự kiện qua REST và code |
| T05 | Chuẩn hóa sự kiện | server `core/normalizer.ts` | T04 | Gộp combo theo `repeatEnd` và `comboWindowMs`; test 6 tình huống |
| T06 | Bậc quà | server `core/tiers.ts` | T02 | Test biên 0, 1, 29, 30, 299, 300, 2999, 3000 |
| T07 | Hàng chờ | server `core/queue.ts` | T05, T06 | Test ưu tiên, chờ tối đa, nâng bậc, rút ngắn > 8 lượt, firefly không vào hàng |
| T08 | Chỗ ngồi | server `core/seats.ts` | T05 | 36 chỗ; hết chỗ thay người im lâu nhất |
| T09 | Socket.IO hub | server `realtime.ts` | T07, T08 | Phát đúng tên sự kiện mục 4.2 |
| T10 | Nguồn TikTok-Live-Connector | server `sources/tiktokConnector.ts` | T05 | Kết nối một phiên live thật, log sự kiện đã chuẩn hóa |
| T11 | Nguồn TikFinity | server `sources/tikfinity.ts` | T05 | Nhận sự kiện từ WebSocket cục bộ |
| T12 | Chọn nguồn, tự kết nối lại | server `sources/index.ts` | T10, T11 | Thử lại 2s/4s/8s… tối đa 30s; đổi nguồn khi đang chạy |

### Tuần 2 — M2: Overlay

| Mã | Việc | File chính | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| T13 | Khung Phaser, manifest, ảnh tạm | overlay `main.ts`, `assets/manifest.json`, script sinh placeholder | T00 | Canvas 1080×1920 nền trong suốt; tải ảnh qua manifest; 30 fps |
| T14 | Cảnh làng tách lớp, debug vùng an toàn | overlay `scenes/VillageScene.ts` | T13 | Parallax nhẹ; `?debug=safe` hiện khung vùng an toàn (UI_SPEC §3) |
| T15 | Ánh sáng theo giờ | overlay `scenes/DayNight.ts` | T14 | 4 khung giờ; `?time=night` để test |
| T16 | Chỗ ngồi, puppet dân làng | overlay `scenes/SeatGrid.ts`, `puppets/VillagerPuppet.ts` | T14, T09 | Nhận `seat:add/remove`; 6 biến thể; nhãn tên theo UI_SPEC |
| T17 | Hiệu ứng nền | overlay `scenes/FX.ts` | T16 | Đom đóm, lá ước, cá bống, chim sẻ; ≤ 150 hạt cùng lúc |
| T18 | VisitDirector + BudPuppet | overlay `scenes/VisitDirector.ts`, `puppets/BudPuppet.ts` | T16, T09 | 7 pha đúng mốc; gửi `visit:done`; `?demo=visit` chạy không cần server |
| T19 | 4 bậc, 6 phép màu | overlay `scenes/Miracles.ts` | T18 | Mọi bậc/phép bấm thử được từ giả lập |
| T20 | HUD | overlay `ui/*` | T18 | Đúng vị trí, cỡ chữ, màu trong UI_SPEC §4–5 |
| T21 | Âm thanh, ducking | overlay `audio/AudioBus.ts` | T18 | Nhạc nền giảm còn 40% trong 300ms khi có thoại |

### Tuần 3 — M3: Lời Bụt và giọng

| Mã | Việc | File chính | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| T22 | Lọc từ cấm, chuẩn hóa tên | server `blessing/nameSanitizer.ts`, `bannedWords.ts` | T03 | Test emoji, teencode, tên rỗng, toàn số |
| T23 | Kiểm duyệt bằng Claude | server `blessing/moderator.ts` | T22 | zod parse; quá 2,5s trả null; test mock |
| T24 | Chọn lời chúc | server `blessing/picker.ts` | T03 | Mùa, giờ, trọng số; không lặp 20 lượt |
| T25 | Giọng đọc: adapter, cache, reverb | server `voice/*` | T02 | 1 nhà cung cấp chạy thật; trả `durationMs` |
| T26 | Chuẩn bị lượt | server `core/preparer.ts` | T07, T23–T25 | `visit:start` chỉ khi đủ lời + audio; chuẩn bị trước lượt kế |
| T27 | Kho 150 câu, `pnpm voices` | `content/blessings.json`, server `scripts/voices.ts` | T25 | Đủ 9 nhóm + opener/reject/group/grand; có audio |
| T28 | Bụt ghé làng | server `core/groupVisit.ts` | T26 | Mỗi 4 phút; hoãn nếu đang có lượt hoặc hàng dài |
| T29 | Phụ đề đồng bộ | overlay `ui/Subtitle.ts` | T26 | Chia đoạn ≤ 3 dòng, lật theo audio, không tràn khung |
| T30 | Bộ test 200 câu troll | `test/fixtures/troll.json`, `scripts/evalModeration.ts` | T23 | Chặn ≥ 95%, chặn nhầm < 5% |

### Tuần 4 — M4: Admin, ảnh thật, live thử

| Mã | Việc | File chính | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| T31 | Admin: PIN, bảng điều khiển | admin `pages/Live.tsx` | T09 | Trạng thái nguồn, hàng chờ, bỏ qua/đưa lên/tạm dừng |
| T32 | Admin: Bụt hiện thủ công, xem trước lời Bụt | admin `pages/Manual.tsx` | T31, T26 | Tạo lượt thủ công; đổi câu trong 3s xem trước (bậc ≥ Phép màu) |
| T33 | Admin: kho lời chúc, từ cấm, cấu hình | admin `pages/Bank.tsx`, `Words.tsx`, `Settings.tsx` | T31 | Có hiệu lực ngay, không khởi động lại |
| T34 | Admin: giả lập | admin `pages/Simulator.tsx` | T31, T04 | Nút cho mọi sự kiện + đợt 50 quà |
| T35 | Thay ảnh thật, tối ưu | `assets/art/*`, manifest | T19 | Atlas ≤ 4096px; tổng ≤ 40MB; giữ 30 fps |
| T36 | Chế độ live một cổng | server `static.ts` | T31 | `pnpm start` phục vụ `/overlay`, `/admin` ở 7777 |
| T37 | Xóa lời ước 24h, xoay log | server `core/retention.ts` | T03 | Job mỗi giờ; log giữ 14 ngày |
| T38 | 3 buổi live thử, sửa lỗi | — | tất cả | Đạt DoD MVP (mục 9) |

---

## 9. Test và định nghĩa "xong" cho MVP

**DoD MVP:**
- 3 buổi live thử × 60 phút, không treo, không khởi động lại.
- Từ nhận quà đến lúc mây bắt đầu kéo đến < 3,5s (đã gồm `giftGraceMs`).
- Chặn ≥ 95% bộ 200 lời ước troll.
- Overlay ≥ 30 fps trên máy CPU 6 nhân, RAM 16GB.

**Kịch bản giả lập bắt buộc:**

| Kịch bản | Cách tạo | Mong đợi |
|---|---|---|
| Mưa quà | 50 quà các bậc trong 10s | Đúng thứ tự; bậc visit tự rút ngắn; không lượt nào chờ quá 90s trước khi được đẩy lên |
| Combo dài | 1 người 20 quà chuỗi | Đúng 1 lượt, bậc theo tổng xu |
| Tặng thêm khi chờ | Vị trí 4 tặng thêm 300 xu | Nâng lên Phép màu, không sinh lượt mới |
| AI sập | Sai `ANTHROPIC_API_KEY` | Dùng câu kho; không chậm hơn |
| TTS sập | Sai `TTS_API_KEY` | Câu kho vẫn có tiếng; câu mới chỉ phụ đề |
| Rớt kết nối | Tắt mạng 20s | Overlay vẫn chạy; tự kết nối lại; admin báo |
| Làng đông | 400 lượt vào xem/phút | Xoay chỗ mượt; 30 fps |
| Tên khó | Emoji, toàn số, 40 ký tự | Đọc "con" hoặc tên rút gọn; nhãn không tràn |
| Lời ước xấu | 20 câu troll | Lá tan; không đọc nội dung |
| Chạy dài | Giả lập 2 giờ | RAM server tăng < 100MB; fps không giảm |

**Checklist trước mỗi buổi live:**
- [ ] `pnpm start` chạy; `/overlay` và `/admin` mở được
- [ ] Admin trên điện thoại kết nối, PIN đúng
- [ ] Nguồn sự kiện sẵn sàng; đã thử nguồn dự phòng
- [ ] Bấm thử 1 lượt mỗi bậc từ Giả lập, nghe rõ tiếng
- [ ] Nhạc nền thấp hơn giọng streamer; giọng Bụt rõ hơn nhạc
- [ ] Browser source đúng 1080×1920, âm thanh vào luồng live
- [ ] Dòng chú thích đang hiện
- [ ] Ổ đĩa còn > 5GB

---

## 10. Prompt giao việc cho AI coding tool

### 10.1. Prompt khởi tạo (dán một lần, kèm `IMPLEMENTATION_PLAN.md` và `UI_SPEC.md`)

```text
Bạn là senior full-stack engineer cho dự án "Bụt Ơi Live". Đính kèm: IMPLEMENTATION_PLAN.md và UI_SPEC.md.
Quy tắc:
- Chỉ làm đúng task tôi giao; không tự làm task khác.
- Tuân thủ kiểu dữ liệu, tên sự kiện, schema trong IMPLEMENTATION_PLAN.md; cần đổi thì hỏi tôi trước.
- Giao diện overlay theo đúng UI_SPEC.md: vùng an toàn, cỡ chữ, token màu, chuyển động, manifest ảnh.
- Mọi chuỗi tiếng Việt đặt trong packages/shared/strings.vi.ts.
- Tuân thủ mục 0 "Ràng buộc bắt buộc".
- Kết thúc mỗi task: liệt kê file tạo/sửa, lệnh chạy, cách kiểm tra thủ công, xác nhận từng tiêu chí xong.
Trả lời "Sẵn sàng" và tóm tắt 5 dòng kiến trúc để tôi kiểm tra bạn đã hiểu đúng.
```

### 10.2. Mẫu giao task

```text
Task {MÃ}: {Việc}
File chính: {File chính}
Phụ thuộc đã xong: {Phụ thuộc}
Tiêu chí xong: {Tiêu chí xong}
Ghi chú thêm: {nếu có}
Làm xong thì chạy test và lint, rồi báo cáo theo quy tắc.
```

### 10.3. Ví dụ đã điền

```text
Task T07: Hàng chờ
File chính: apps/server/src/core/queue.ts (+ queue.test.ts)
Phụ thuộc đã xong: T05, T06
Tiêu chí xong: theo mục 6.3. Test ít nhất: (1) bậc cao đi trước; (2) cùng bậc ai đến trước đi trước;
(3) lượt chờ quá maxWaitMs được đẩy lên; (4) người đang chờ tặng thêm thì nâng bậc, không tạo lượt mới;
(5) hàng > 8 lượt thì bậc visit còn 12000ms; (6) firefly không vào hàng chờ.
Ghi chú thêm: dùng fake timers của Vitest, không sleep thật.
```

```text
Task T18: VisitDirector + BudPuppet
File chính: apps/overlay/src/scenes/VisitDirector.ts, apps/overlay/src/puppets/BudPuppet.ts
Phụ thuộc đã xong: T16, T09
Tiêu chí xong: máy trạng thái 7 pha theo mục 6.5; nhận visit:start, gửi visit:done; watchdog tự hủy sau tổng thời lượng + 10s;
wishRejected → diễn cảnh lá rơi trước pha ASK; dân làng được chọn đi từ chỗ ngồi lên vùng sân khấu rồi quay về.
BudPuppet theo UI_SPEC §7 (các lớp và animation idle/appear/talk/bless/leave bằng tween).
Ghi chú thêm: dùng ảnh tạm từ manifest; thêm ?demo=visit để chạy thử không cần server.
```

```text
Task T20: HUD
File chính: apps/overlay/src/ui/* 
Phụ thuộc đã xong: T18
Tiêu chí xong: đúng toạ độ, kích thước, cỡ chữ, token màu UI_SPEC §4–5; thẻ hướng dẫn xoay 3 câu mỗi 8s;
chip hàng chờ thu gọn khi Bụt đang nói; khung trang trí theo UI_SPEC §5.2.
Ghi chú thêm: dựng bằng Phaser (Text, Graphics, NineSlice), không dùng DOM, để OBS chụp ổn định.
```
