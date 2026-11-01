# Bụt Ơi Live — Bộ prompt giao việc cho AI code

Cách dùng:
1. Mở phiên mới trong Antigravity (hoặc Claude Code), đính kèm `IMPLEMENTATION_PLAN.md` và `UI_SPEC.md`.
2. Dán **Prompt 00 – Khởi tạo**. Kiểm tra AI tóm tắt kiến trúc đúng rồi mới giao task.
3. Dán từng prompt T00 → T38 theo thứ tự. Mỗi task xong, tự kiểm tra theo phần "Kiểm tra" trước khi sang task kế.
4. Nếu phiên làm việc bị mất ngữ cảnh: dán lại Prompt 00, rồi nói "Các task đã xong: T00–Txx", rồi giao task tiếp theo.

---

## Prompt 00 – Khởi tạo

```text
Bạn là senior full-stack engineer cho dự án "Bụt Ơi Live" — overlay game tương tác cho TikTok LIVE.
Đính kèm 2 tài liệu: IMPLEMENTATION_PLAN.md (kiến trúc, dữ liệu, thuật toán, bảng task) và UI_SPEC.md (giao diện, asset, chuyển động).

Quy tắc làm việc:
1. Đọc kỹ toàn bộ 2 tài liệu trước khi code.
2. Chỉ làm đúng task tôi giao; không tự làm task khác, không tự thêm tính năng.
3. Tuân thủ chính xác kiểu dữ liệu, tên sự kiện Socket.IO, schema SQLite, cấu hình trong IMPLEMENTATION_PLAN.md. Nếu thấy cần đổi, dừng lại hỏi tôi trước.
4. Giao diện overlay theo đúng UI_SPEC.md: vùng an toàn, toạ độ, cỡ chữ, token màu, chuyển động; ảnh và âm thanh chỉ đọc qua assets/manifest.json.
5. Mọi chuỗi hiển thị tiếng Việt đặt trong packages/shared/strings.vi.ts.
6. Tuân thủ tuyệt đối mục 0 "Ràng buộc bắt buộc" (không biểu tượng tôn giáo, không đọc văn bản người xem khi chưa kiểm duyệt, không hiện số xu, luôn có dòng chú thích, xóa lời ước sau 24 giờ).
7. TypeScript strict; mỗi task kèm test Vitest khi có logic.
8. Kết thúc mỗi task, báo cáo đúng mẫu:
   - File đã tạo/sửa
   - Lệnh chạy
   - Cách kiểm tra thủ công
   - Xác nhận từng tiêu chí xong (đạt / chưa đạt + lý do)
   - Việc còn thiếu so với tài liệu

Bây giờ hãy trả lời "Sẵn sàng" và tóm tắt kiến trúc trong 5 dòng để tôi kiểm tra bạn đã hiểu đúng. Chưa viết code.
```

---

## TUẦN 1 — Lõi server

### T00 – Khung monorepo

```text
Task T00: Khung monorepo.
Làm theo IMPLEMENTATION_PLAN.md mục 3 (3.1 → 3.5):
- Tạo monorepo pnpm với apps/server, apps/overlay, apps/admin, packages/shared đúng cấu trúc thư mục mục 3.5 (tạo thư mục rỗng + file index tối thiểu).
- Cài đúng thư viện ở mục 3.1; pnpm-workspace.yaml; scripts gốc ở mục 3.3.
- tsconfig gốc strict + noUncheckedIndexedAccess, các app kế thừa; eslint + prettier.
- Server: Fastify chạy cổng 7777, route GET /health trả {ok:true}.
- Overlay: trang Vite trắng; Admin: trang React trắng có chữ "Bụt Ơi Live – Admin".
- Tạo .env.example theo mục 4.5, .gitignore, README ngắn (cách cài, cách chạy).
Tiêu chí xong: `pnpm install && pnpm dev` chạy cả 3 app không lỗi; `pnpm test` chạy (có 1 test mẫu); `pnpm lint` qua.
```
Kiểm tra: mở localhost:7777/health, localhost:5173, localhost:5174.

### T01 – Kiểu dùng chung, chuỗi tiếng Việt

```text
Task T01: Kiểu dùng chung và chuỗi tiếng Việt.
- packages/shared/types.ts: đúng nguyên văn các kiểu ở IMPLEMENTATION_PLAN.md mục 4.1 (Viewer, LiveEvent, TierId, WishCategory, Visit) + kiểu Settings khớp JSON mục 4.4.
- packages/shared/events.ts: hằng số tên sự kiện Socket.IO mục 4.2 + kiểu payload cho từng sự kiện (ServerToOverlay, OverlayToServer, AdminToServer).
- packages/shared/strings.vi.ts: mọi chuỗi giao diện trong UI_SPEC.md §5 (nhãn băng rôn, con dấu bậc, chú thích, 3 câu hướng dẫn §5.3, "Bụt sắp ghé thăm", "+{n} đang chờ", "Bụt ghé làng sau", "Bụt đang nghỉ chân một lát", "+{n} dân làng", "may mắn +1", "Đã ghi vào Sổ làng").
- Cả 3 app import được từ packages/shared.
Tiêu chí xong: build cả 3 app qua; không còn chuỗi tiếng Việt cứng trong code app.
```

### T02 – Cấu hình

```text
Task T02: Cấu hình và biến môi trường.
- apps/server/src/config.ts: đọc .env bằng dotenv, validate bằng zod theo mục 4.5; thiếu biến bắt buộc → báo lỗi rõ ràng bằng tiếng Việt và thoát.
- Settings mặc định đúng JSON mục 4.4; có hàm getSettings() / updateSettings(partial) (tạm lưu bộ nhớ, T03 sẽ lưu SQLite); validate settings bằng zod.
- Biến không bắt buộc khi EVENT_SOURCE=simulator: TIKTOK_USERNAME. ANTHROPIC_API_KEY và TTS_API_KEY không bắt buộc (thiếu thì chạy chế độ chỉ dùng kho).
Tiêu chí xong: test cho validate .env thiếu/đủ; test updateSettings từ chối giá trị sai kiểu.
```

### T03 – SQLite

```text
Task T03: SQLite schema, repo, seed.
- apps/server/src/db/schema.sql: 5 bảng mục 4.3 (blessings, wishes, visits, banned_words, settings) + index cần thiết.
- db/repo.ts (better-sqlite3): hàm CRUD cho blessings; addWish/latestWish(userId, ttlMs)/markWishUsed; insertVisit; listBannedWords/add/remove; loadSettings/saveSettings (thay bộ nhớ tạm của T02).
- content/blessings.json: 13 câu mẫu ở mục 7.3 + thêm 7 câu tự soạn đúng giọng Bụt (đủ 20), theo đúng quy tắc giọng văn ở prompt mục 7.2.
- scripts/seed.ts + lệnh `pnpm seed`: tạo DB, nạp blessings.json (không nhân đôi khi chạy lại), nạp settings mặc định.
Tiêu chí xong: `pnpm seed` tạo file DB; test thêm/sửa/đọc blessings, latestWish đúng TTL.
```

### T04 – Bộ giả lập

```text
Task T04: Bộ giả lập sự kiện.
- apps/server/src/sources/simulator.ts implement interface EventSource (mục 6.1).
- REST POST /sim nhận {type, user?, text?, coins?, count?, repeat?} và phát LiveEvent tương ứng; user mặc định sinh ngẫu nhiên từ danh sách 20 tên Việt (có cả tên emoji, tên toàn số, tên dài để test).
- POST /sim/burst {kind:"gifts"|"joins", n, seconds} để tạo mưa quà/mưa người vào.
- Giả lập cả quà dạng chuỗi: gửi nhiều sự kiện repeatEnd=false rồi 1 sự kiện repeatEnd=true.
Tiêu chí xong: bắn đủ 6 loại sự kiện qua curl; log ra console dạng LiveEvent.
```

### T05 – Chuẩn hóa sự kiện

```text
Task T05: Chuẩn hóa sự kiện.
- apps/server/src/core/normalizer.ts: nhận sự kiện thô từ mọi nguồn → LiveEvent.
- Gộp combo đúng mục 6.2: giftType 1 chỉ tính khi repeatEnd=true; cộng quà cùng userId trong comboWindowMs thành 1 sự kiện gift.
- Lọc trùng sự kiện join cùng userId trong 60 giây; gộp like theo người trong 2 giây.
- Tạo displayName qua hàm tạm (T22 sẽ thay bằng nameSanitizer).
Tiêu chí xong: test 6 tình huống: quà đơn, quà chuỗi 10 lần, 2 quà khác loại cùng người trong cửa sổ, 2 người khác nhau, quà ngay sau khi hết cửa sổ, join trùng.
```

### T06 – Bậc quà

```text
Task T06: Bậc quà.
- apps/server/src/core/tiers.ts: tierFor(coins, settings) theo settings.tiers (mục 4.4, 5); durationFor(tier, queueLength).
Tiêu chí xong: test biên 0 (không tạo lượt), 1, 29, 30, 299, 300, 2999, 3000; test settings đổi ngưỡng thì kết quả đổi.
```

### T07 – Hàng chờ

```text
Task T07: Hàng chờ.
File chính: apps/server/src/core/queue.ts (+ queue.test.ts).
Làm đúng khung code IMPLEMENTATION_PLAN.md mục 6.3.
Test ít nhất: (1) bậc cao đi trước; (2) cùng bậc ai đến trước đi trước; (3) lượt chờ quá maxWaitMs được đẩy lên;
(4) người đang chờ tặng thêm thì nâng bậc, không tạo lượt mới; (5) hàng > 8 lượt thì bậc visit còn 12000ms;
(6) firefly không vào hàng chờ mà phát ngay sự kiện riêng; (7) nghỉ tối thiểu 1,5s giữa hai lượt.
Ghi chú: dùng fake timers của Vitest, không sleep thật. Hàng chờ phát sự kiện nội bộ để T09 đẩy queue:update.
```

### T08 – Chỗ ngồi

```text
Task T08: Chỗ ngồi dân làng.
- apps/server/src/core/seats.ts: quản lý seatCount chỗ (mặc định 36); join → cấp chỗ; hết chỗ → thay người có lastActiveAt cũ nhất; mọi tương tác cập nhật lastActiveAt; đếm tổng người đã vào (cho bộ đếm "+n dân làng").
- Phát sự kiện nội bộ seat:add / seat:remove.
Tiêu chí xong: test cấp chỗ, thay người, người đã có chỗ vào lại không cấp chỗ mới.
```

### T09 – Socket.IO hub

```text
Task T09: Trung tâm Socket.IO.
- apps/server/src/realtime.ts: gắn Socket.IO vào Fastify; 2 namespace /overlay và /admin; admin yêu cầu ADMIN_PIN khi kết nối.
- Phát đúng tên và payload sự kiện mục 4.2 từ queue, seats, normalizer (fx:firefly, fx:wave, fx:leaf, fx:fish, fx:sparrow).
- Khi overlay kết nối lại: gửi lại toàn bộ chỗ ngồi hiện tại và hàng chờ.
- Bình luận: nhận diện "Bụt ơi" (không phân biệt dấu/hoa thường) → fx:wave (cooldown budShadowCooldownMs); bình luận bắt đầu bằng wishPrefixes → lưu wish + fx:leaf.
Tiêu chí xong: script test client giả kết nối 2 namespace và nhận đúng sự kiện khi bắn /sim.
```

### T10 – Nguồn TikTok-Live-Connector

```text
Task T10: Nguồn TikTok-Live-Connector.
- apps/server/src/sources/tiktokConnector.ts implement EventSource, dùng tiktok-live-connector 2.x (TikTokLiveConnection, WebcastEvent).
- Map các sự kiện member/like/chat/follow/share/gift → sự kiện thô cho normalizer (giữ giftType, repeatEnd, repeatCount, diamondCount).
- onStatus báo connecting/live/offline/error; streamEnd → offline.
- Ghi chú trong README: đây là thư viện không chính thức, chỉ kết nối được khi phiên live đang mở.
Tiêu chí xong: kết nối một phiên live thật bất kỳ (username công khai đang live), log ra sự kiện đã chuẩn hóa trong 2 phút không lỗi.
```

### T11 – Nguồn TikFinity

```text
Task T11: Nguồn TikFinity.
- apps/server/src/sources/tikfinity.ts implement EventSource, kết nối WebSocket TIKFINITY_WS (mặc định ws://127.0.0.1:21213).
- Map payload sự kiện TikFinity → sự kiện thô cho normalizer (ghi log payload lạ để bổ sung mapping sau).
Tiêu chí xong: khi mở app TikFinity và đang live, nhận được gift/chat/like; khi không có TikFinity thì báo offline rõ ràng, không crash.
```

### T12 – Chọn nguồn, tự kết nối lại

```text
Task T12: Chọn nguồn và tự kết nối lại.
- apps/server/src/sources/index.ts: chọn nguồn theo EVENT_SOURCE; connectWithRetry đúng mục 6.1 (2s, 4s, 8s… tối đa 30s).
- API nội bộ switchSource(name) để admin đổi nguồn khi đang chạy (ngắt nguồn cũ, nối nguồn mới, không mất hàng chờ).
- Trạng thái nguồn phát lên namespace /admin.
Tiêu chí xong: tắt mạng 20s → tự kết nối lại; đổi nguồn connector ↔ simulator khi đang chạy không mất hàng chờ.
```

---

## TUẦN 2 — Overlay

### T13 – Khung Phaser, manifest, ảnh tạm

```text
Task T13: Khung Phaser, manifest và ảnh tạm.
- apps/overlay: Phaser 3, canvas 1080×1920, scale FIT, nền trong suốt, 30 fps.
- assets/manifest.json theo UI_SPEC.md §8.2, liệt kê ĐỦ mọi khóa trong §8.1 (src có thể chưa tồn tại).
- Script `pnpm placeholders`: sinh ảnh PNG tạm cho mọi khóa — khối màu theo placeholder.color, đúng kích thước, có nhãn tên khóa; với char.bud.* và char.villager.* sinh từng lớp theo UI_SPEC §7.1/§7.3.
- Loader: đọc manifest; file thật thiếu → dùng placeholder + console.warn; không bao giờ dừng overlay.
- Tải phông Noto Serif và Be Vietnam Pro, chờ document.fonts trước khi tạo Text.
- theme.ts: token màu và chữ đúng UI_SPEC §2.2–2.3.
Tiêu chí xong: mở overlay thấy ảnh tạm hiển thị, 30 fps ổn định, console không lỗi.
```

### T14 – Cảnh làng tách lớp, debug vùng an toàn

```text
Task T14: Cảnh làng và chế độ debug vùng an toàn.
- scenes/VillageScene.ts: dựng đủ thứ tự lớp UI_SPEC §4.1 (bỏ qua lớp chưa có ở task này); parallax núi và 2 tầng sương theo §6; lớp grain 3–4% phủ toàn cảnh; lá đa phía trước rung nhẹ.
- Lớp dim (0–60%) điều khiển được bằng API setDim(value, ms).
- ?debug=safe: vẽ 10 vùng UI_SPEC §3 (viền đỏ nét đứt, nhãn số); ?debug=safe&ref=/ref.png nạp ảnh tham chiếu đè lên với độ mờ 50%.
Tiêu chí xong: cảnh chạy mượt 30 fps; debug hiện đúng toạ độ bảng §3.
```

### T15 – Ánh sáng theo giờ

```text
Task T15: Ánh sáng theo giờ.
- scenes/DayNight.ts: 4 khung giờ (sáng 5–11h, chiều 11–17h, hoàng hôn 17–19h, đêm 19–5h) chọn sky tương ứng và tông màu phủ (tint) cho các lớp; chuyển mượt 2s khi đổi khung.
- ?time=day|dusk|night để ép khung giờ khi test; API forceNight(ms) cho Đại phép.
- Đêm: bật đom đóm nền (tối đa 20 con).
Tiêu chí xong: đổi ?time thấy 3 tông rõ ràng; forceNight chuyển trong 2s rồi trả lại.
```

### T16 – Chỗ ngồi, puppet dân làng

```text
Task T16: Chỗ ngồi và puppet dân làng.
- puppets/VillagerPuppet.ts theo UI_SPEC §7.3: ghép lớp theo avatarSeed; animation sit_idle, wave, walk_to(x,y), cheer.
- scenes/SeatGrid.ts: vị trí chỗ ngồi theo công thức UI_SPEC §4.3; nhận seat:add (đi vào từ mép phải rồi ngồi) và seat:remove (đứng dậy đi ra).
- Nhãn tên theo §5.1: chỉ hiện với người tương tác trong 60s; viền chữ 5px ink900.
- Bộ đếm dân làng §5.1 khi tổng > 36.
Tiêu chí xong: /sim/burst 100 joins → chỗ ngồi xoay vòng mượt, không chồng chéo, 30 fps.
```

### T17 – Hiệu ứng nền

```text
Task T17: Hiệu ứng nền.
- scenes/FX.ts: fx:firefly (đom đóm bay lên + chữ "may mắn +1" theo §5.1), fx:wave (dân làng vẫy tay + bóng Bụt mờ trên ngọn đa 1,5s), fx:leaf (lá ước trên đầu, đung đưa), lá ước rơi xuống ao + gợn nước (dùng cho wishRejected), fx:fish (cá bống ngoi lên ao), fx:sparrow (chim sẻ bay đến đậu cạnh người).
- Bộ đếm toàn cục giới hạn ≤ 150 hạt cùng lúc; hiệu ứng vượt hạn mức thì bỏ qua.
- API dimBackgroundFx(true/false) giảm 50% tốc độ và độ sáng khi Bụt nói.
Tiêu chí xong: bắn 200 like trong 10s vẫn giữ 30 fps; mọi hiệu ứng bấm thử được qua /sim.
```

### T18 – VisitDirector và BudPuppet

```text
Task T18: VisitDirector + BudPuppet.
File chính: scenes/VisitDirector.ts, puppets/BudPuppet.ts.
- BudPuppet đúng UI_SPEC §7.1 (lớp, pivot, cha-con) và §7.2 (idle, appear, talk, bless, leave, chớp mắt). talk lấy biên độ âm thanh qua AnalyserNode.
- VisitDirector: máy trạng thái 7 pha đúng IMPLEMENTATION_PLAN mục 6.5; nhận visit:start, gửi visit:done; watchdog tự hủy sau tổng thời lượng + 10s.
- SUMMON: tiếng gió 0,3s trước, dim 25%, mây kéo đến, dân làng được chọn walk_to điểm neo (210,1180) và phóng to 1,8×. APPEAR: Bụt appear tại neo (540,1230). wishRejected → lá rơi trước ASK. LEAVE: Bụt leave, dân làng về chỗ, bỏ dim.
- ?demo=visit chạy một lượt mẫu không cần server.
Tiêu chí xong: bậc visit chạy đúng mốc thời gian (in log từng pha); watchdog hoạt động khi giả lập treo.
```

### T19 – 4 bậc và 6 phép màu

```text
Task T19: 4 bậc và 6 phép màu.
- scenes/Miracles.ts: 6 phép theo miracleByCategory (IMPLEMENTATION_PLAN mục 5): glowing_book, well_water, golden_rice, lit_cottage, sparrow_pair, lotus_bloom.
- Bậc firefly: đom đóm + giọng vọng, không dim, không Bụt hiện (gộp tối đa 5 tên).
- Bậc miracle: phép riêng trong pha MIRACLE + huy hiệu "Đã ghi vào Sổ làng" (UI_SPEC §4.2).
- Bậc grand: forceNight, trăng lớn §4.3, Bụt bay một vòng quanh làng trên mây, mưa cánh hoa (≤ 80 cánh), ẩn HUD trừ băng rôn, chú thích, phụ đề.
- Visit group (Bụt ghé làng): Bụt lướt ngang trái → phải, dừng giữa, không dim.
Tiêu chí xong: mọi bậc và mọi phép bấm thử được từ /sim; 30 fps kể cả Đại phép.
```

### T20 – HUD

```text
Task T20: HUD.
File chính: apps/overlay/src/ui/* (Hud.ts, NameBanner.ts, QueueChip.ts, HowToCard.ts, Subtitle.ts (khung, nội dung làm ở T29), Disclaimer.ts, Counter.ts).
- Đúng toạ độ, kích thước, phông, cỡ chữ, token màu UI_SPEC §5.1; khung trang trí §5.2 bằng NineSlice + 4 góc vân mây.
- Băng rôn: trạng thái chờ (logo + đồng hồ đếm ngược tới lượt Bụt ghé làng) ↔ trạng thái lượt (avatar, nhãn, tên, con dấu bậc). Tên dài quá 16 ký tự cắt "…".
- Thẻ hướng dẫn xoay 3 câu §5.3 mỗi 8s; chip hàng chờ thu gọn khi Bụt đang nói, mở thành thẻ 5 tên giữa hai lượt.
- Chú thích luôn hiện. Trạng thái tạm dừng (state:pause) theo §4.2.
- Dựng bằng Phaser (Text, Graphics, NineSlice), không dùng DOM.
Tiêu chí xong: so khớp với ?debug=safe — mọi thành phần nằm đúng vùng; chuyển trạng thái mượt theo §6.
```

### T21 – Âm thanh

```text
Task T21: Âm thanh và ducking.
- audio/AudioBus.ts: phát nhạc nền theo khung giờ (bgm.day / bgm.night), hiệu ứng âm thanh UI_SPEC §6, thoại từ audioUrl.
- Ducking: nhạc nền xuống 40% trong 300ms khi có thoại, trả lại sau 500ms.
- Âm lượng từng kênh (nhạc, hiệu ứng, thoại) chỉnh được qua settings.
- Xử lý chính sách tự phát âm thanh của trình duyệt: overlay trong OBS/LIVE Studio phát được; khi mở bằng trình duyệt thường hiện nút "Bật âm thanh" một lần.
Tiêu chí xong: thoại luôn rõ hơn nhạc; không có tiếng bị chồng khi 2 lượt liền nhau.
```

---

## TUẦN 3 — Lời Bụt và giọng

### T22 – Lọc từ cấm, chuẩn hóa tên

```text
Task T22: Lọc từ cấm và chuẩn hóa tên.
- blessing/nameSanitizer.ts: bỏ emoji, ký tự đặc biệt, số đuôi dài (>3 chữ số), khoảng trắng thừa; giữ chữ Việt có dấu và chữ Latin; tối đa 24 ký tự để đọc, 16 ký tự để hiển thị; rỗng → "con". Thay hàm tạm ở T05.
- blessing/bannedWords.ts: so khớp không dấu, không phân biệt hoa thường, bắt cả biến thể chèn dấu chấm/khoảng trắng (vd "đ.m"); danh sách lấy từ bảng banned_words; seed sẵn danh sách từ tục, từ chính trị nhạy cảm, "số đề", "lô đề", "bùa yêu".
Tiêu chí xong: test emoji, teencode, tên toàn số, tên 40 ký tự, biến thể né lọc.
```

### T23 – Kiểm duyệt bằng Claude

```text
Task T23: Kiểm duyệt bằng Claude.
- blessing/moderator.ts: check(displayName, rawWish) → {allowed, category, blessing, reason} | null.
- Lọc nhanh bannedWords trước; trúng → trả allowed=false, không gọi AI.
- Gọi @anthropic-ai/sdk với model AI_MODEL, system prompt NGUYÊN VĂN ở IMPLEMENTATION_PLAN mục 7.2; max_tokens 300; timeout AI_TIMEOUT_MS → null.
- Parse JSON bằng zod; lỗi parse → null. Kiểm tra lại blessing không chứa từ cấm và không chứa từ ngữ tôn giáo bị cấm trong prompt; vi phạm → null.
- Không có ANTHROPIC_API_KEY → luôn trả null (chế độ chỉ dùng kho).
Tiêu chí xong: test với SDK mock: hợp lệ, từ chối, JSON lỗi, timeout, blessing chứa từ cấm.
```

### T24 – Chọn lời chúc

```text
Task T24: Chọn lời chúc từ kho.
- blessing/picker.ts: pick({category?, tier, length?, now}) theo thứ tự: mùa đặc biệt hôm nay (occasion) → khung giờ → ngẫu nhiên có trọng số weight; không lặp câu trong 20 lượt gần nhất; tier firefly dùng length "short".
- Hỗ trợ lấy câu opener, reject, group, grand.
- Mùa: trung_thu (rằm tháng 8 âm lịch ±3 ngày), tet (từ 23 tháng Chạp đến mùng 7 tháng Giêng), cuoi_nam (31/12) — dùng thư viện âm lịch nhỏ hoặc bảng ngày tính sẵn 2026–2030.
Tiêu chí xong: test không lặp 20 lượt, ưu tiên mùa, rơi về binh_an khi category không có câu.
```

### T25 – Giọng đọc

```text
Task T25: Giọng đọc — adapter, cache, hậu kỳ.
- voice/tts/*.ts: interface TtsProvider { synth(text, voice, speed): Promise<Buffer> }; làm thật 1 nhà cung cấp theo TTS_PROVIDER (ưu tiên FPT.AI), các nhà còn lại để khung.
- voice/post.ts: dùng ffmpeg thêm reverb nhẹ theo TTS_REVERB, chuẩn hóa âm lượng, xuất .ogg; đo durationMs.
- voice/cache.ts: key = sha1(provider+voice+speed+text); lưu file tại data/voice/; phục vụ qua GET /voice/:key.ogg.
- voice/index.ts: render(text) → {url, durationMs}; ghép "câu kho đã có audio" + "tên đọc riêng" khi câu có {ten}.
Tiêu chí xong: render một câu thật nghe được; gọi lần 2 lấy từ cache (không gọi API).
```

### T26 – Chuẩn bị lượt

```text
Task T26: Chuẩn bị lượt Bụt hiện.
- core/preparer.ts đúng khung IMPLEMENTATION_PLAN mục 6.4: luôn chuẩn bị lượt đầu hàng và lượt kế tiếp, song song tối đa 2.
- Kèm audio câu mở đầu (opener) cho pha ASK; với wishRejected dùng câu reject thay vì câu thường.
- Dự phòng: TTS lỗi → câu kho có sẵn audio; vẫn lỗi → lượt chỉ có phụ đề (audioUrl rỗng, durationMs ước lượng 70ms/ký tự).
- Chỉ phát visit:start khi status=ready; áp giftGraceMs theo bậc trước khi phát; ghi bảng visits.
Tiêu chí xong: mưa 50 quà → không lượt nào phát khi chưa có audio; tắt TTS vẫn chạy.
```

### T27 – Kho 150 câu, lệnh voices

```text
Task T27: Kho 150 câu và lệnh `pnpm voices`.
- Mở rộng content/blessings.json lên 150 câu: 9 nhóm category × (5 câu full + 5 câu short) + 10 opener + 8 reject + 8 group + 6 grand + câu theo mùa (trung_thu, tet, cuoi_nam). Đúng giọng và quy tắc ở prompt mục 7.2 (không từ ngữ tôn giáo, là lời chúc không phải lời hứa, không nhắc tiền/quà).
- scripts/voices.ts: tạo audio cho mọi câu (phần không chứa tên), cập nhật audio_path; bỏ qua câu đã có cache.
Tiêu chí xong: `pnpm seed && pnpm voices` chạy hết; tự kiểm tra bằng script không câu nào chứa từ bị cấm.
```

### T28 – Bụt ghé làng

```text
Task T28: Lượt Bụt ghé làng.
- core/groupVisit.ts: mỗi groupVisitEveryMs chọn 3–5 người vào gần nhất chưa được chúc; tạo câu group + audio; phát visit:group.
- Hoãn nếu đang có lượt hoặc hàng chờ > 3; phát ngay khi rảnh. Phát đồng hồ đếm ngược cho băng rôn trạng thái chờ.
Tiêu chí xong: để chạy 15 phút không quà → có 3 lượt ghé làng; có quà liên tục → lượt ghé làng được hoãn đúng.
```

### T29 – Phụ đề đồng bộ

```text
Task T29: Phụ đề đồng bộ.
- ui/Subtitle.ts: chia lời thành đoạn ≤ 3 dòng (~36 ký tự/dòng, ngắt theo câu/dấu phẩy, không cắt giữa từ); thời gian mỗi đoạn tỉ lệ số ký tự trên durationMs; chữ hiện dần theo từ (fade 120ms mỗi từ).
- Đúng phông, cỡ, màu UI_SPEC §5.1 (Phụ đề); vạch phân cách hình lá phía trên.
Tiêu chí xong: câu 70 từ hiển thị 2–3 đoạn, không tràn khung 960×224; đồng bộ với audio sai lệch < 300ms.
```

### T30 – Bộ test 200 câu troll

```text
Task T30: Bộ test kiểm duyệt 200 câu.
- test/fixtures/troll.json: 200 lời ước xấu tiếng Việt đa dạng (tục có dấu/không dấu/teencode/chèn ký tự, trù ẻo, chính trị, xin số đề, bùa yêu, quảng cáo link, xúc phạm tôn giáo/dân tộc, nhắc tự hại) + 50 lời ước tốt (để đo chặn nhầm).
- scripts/evalModeration.ts: chạy moderator thật trên toàn bộ; in tỷ lệ chặn đúng, tỷ lệ chặn nhầm, danh sách câu lọt.
Tiêu chí xong: chặn ≥ 95% câu xấu, chặn nhầm < 5% câu tốt. Nếu chưa đạt: đề xuất bổ sung bannedWords hoặc chỉnh prompt (hỏi tôi trước khi sửa prompt).
```

---

## TUẦN 4 — Admin, ảnh thật, live thử

### T31 – Admin: PIN và bảng điều khiển

```text
Task T31: Admin — đăng nhập PIN và bảng điều khiển live.
- apps/admin: React + Tailwind + shadcn/ui, giao diện tiếng Việt, tối ưu điện thoại (nút ≥ 44px), kết nối namespace /admin bằng ADMIN_PIN.
- pages/Live.tsx: trạng thái nguồn (tên, live/offline, độ trễ), nút đổi nguồn; hàng chờ với nút Bỏ qua / Đưa lên đầu / Đọc lại; nút Tạm dừng Bụt; lượt đang diễn (tên, bậc, lời chúc, nguồn ai/bank).
Tiêu chí xong: điều khiển được từ điện thoại cùng Wi-Fi; thao tác có hiệu lực trên overlay ngay.
```

### T32 – Admin: Bụt hiện thủ công, xem trước

```text
Task T32: Admin — Bụt hiện thủ công và xem trước lời Bụt.
- pages/Manual.tsx: nhập tên + bậc + lời ước (tùy chọn) → tạo lượt (vẫn đi qua kiểm duyệt).
- Xem trước: lượt bậc miracle/grand có lời do AI viết → admin nhận popup 3 giây với nút "Đổi câu" (thay bằng câu kho); hết 3 giây tự dùng câu AI.
Tiêu chí xong: tạo lượt thủ công chạy trên overlay; nút Đổi câu thay lời trước khi Bụt nói.
```

### T33 – Admin: kho lời chúc, từ cấm, cấu hình

```text
Task T33: Admin — kho lời chúc, từ cấm, cấu hình.
- pages/Bank.tsx: bảng câu, lọc theo category/length/occasion, thêm/sửa/tắt, nút Nghe thử và Tạo lại giọng.
- pages/Words.tsx: danh sách từ cấm, thêm hàng loạt (mỗi dòng một từ).
- pages/Settings.tsx: ngưỡng xu từng bậc, thời lượng, giftGraceMs, số chỗ ngồi, chu kỳ ghé làng, âm lượng 3 kênh, giọng đọc, bật/tắt khung webcam.
- Lưu là có hiệu lực ngay, không cần khởi động lại.
Tiêu chí xong: đổi ngưỡng bậc trên điện thoại → quà kế tiếp áp dụng ngưỡng mới.
```

### T34 – Admin: giả lập

```text
Task T34: Admin — màn hình giả lập.
- pages/Simulator.tsx: nút cho từng sự kiện (vào xem, thả tim, "Bụt ơi", lời ước tốt, lời ước xấu, theo dõi, chia sẻ, quà từng bậc); nút Mưa quà 50 lượt, Mưa người vào 100; ô nhập tên tùy chọn.
Tiêu chí xong: chạy được toàn bộ kịch bản test ở IMPLEMENTATION_PLAN mục 9 từ màn hình này.
```

### T35 – Thay ảnh thật, tối ưu

```text
Task T35: Thay ảnh thật và tối ưu.
- Tôi đã đặt ảnh thật vào assets/art/ (đúng tên khóa theo UI_SPEC §8.1). Cập nhật manifest.json trỏ src tới file thật; đóng atlas cho char.bud, char.villager, fx (mỗi atlas ≤ 4096×4096).
- Căn lại pivot BudPuppet/VillagerPuppet theo ảnh thật; chỉnh toạ độ nếu lệch vùng an toàn.
- Đo: tổng ảnh ≤ 40MB, overlay ≥ 30 fps, thời gian tải < 5s.
Tiêu chí xong: không còn placeholder nào hiển thị; báo cáo số đo fps, dung lượng, thời gian tải.
```

### T36 – Chế độ live một cổng

```text
Task T36: Chế độ live một cổng.
- server/static.ts: `pnpm start` build overlay + admin thành file tĩnh, phục vụ tại http://localhost:7777/overlay và /admin; Socket.IO cùng cổng.
- In ra console khi khởi động: địa chỉ overlay để dán vào LIVE Studio/OBS, địa chỉ admin theo IP mạng LAN để mở trên điện thoại.
Tiêu chí xong: chỉ chạy `pnpm start` là đủ để live; mở /admin từ điện thoại được.
```

### T37 – Xóa lời ước, xoay log

```text
Task T37: Lưu giữ dữ liệu.
- core/retention.ts: job mỗi giờ xóa bản ghi wishes cũ hơn 24 giờ; xoay log giữ 14 ngày; dọn cache giọng đọc không dùng quá 30 ngày (trừ câu kho).
- Log không ghi nội dung lời ước gốc ở mức info.
Tiêu chí xong: test với fake timers; kiểm tra DB sau khi job chạy.
```

### T38 – Live thử và sửa lỗi

```text
Task T38: Chuẩn bị live thử.
- Tạo file LIVE_CHECKLIST.md từ checklist ở IMPLEMENTATION_PLAN mục 9 và các bước kiểm tra trên điện thoại ở UI_SPEC §10.
- Chạy lại toàn bộ kịch bản giả lập mục 9, báo cáo kết quả từng kịch bản.
- Sau mỗi buổi live thử tôi sẽ gửi log và danh sách lỗi; sửa từng lỗi, mỗi lỗi một commit, báo cáo nguyên nhân và cách sửa.
Tiêu chí xong: đạt toàn bộ DoD MVP ở mục 9.
```

---

## Prompt xử lý sự cố (dùng khi cần)

**Khi AI làm sai tài liệu:**

```text
Phần vừa làm chưa đúng tài liệu ở chỗ: {mô tả}. Đối chiếu lại {IMPLEMENTATION_PLAN.md mục … / UI_SPEC.md §…} và sửa đúng như tài liệu. Không thay đổi phần khác.
```

**Khi có lỗi chạy:**

```text
Lỗi khi chạy `{lệnh}`:
{dán log lỗi}
Tìm nguyên nhân gốc, sửa, chạy lại test liên quan. Báo cáo nguyên nhân, cách sửa, file đã đổi.
```

**Khi muốn rà soát giữa chừng (cuối mỗi tuần):**

```text
Rà soát toàn bộ code đã làm từ T{xx} đến T{yy} so với 2 tài liệu: liệt kê chỗ lệch tài liệu, chỗ thiếu test, chỗ có rủi ro hiệu năng hoặc crash. Chưa sửa, chỉ báo cáo để tôi quyết định.
```
