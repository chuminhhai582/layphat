# Bụt Ơi Live — Đặc tả giao diện overlay TikTok LIVE

> Tài liệu bàn giao cho AI coding tool, đi kèm `IMPLEMENTATION_PLAN.md`.
> Khung overlay: **1080×1920 px, dọc**, chạy trong Phaser 3, gắn vào TikTok LIVE Studio/OBS dạng Browser Source.
> Mọi toạ độ trong file này tính trên khung 1080×1920, gốc (0,0) ở góc trên trái.

---

## 1. Nguyên tắc tổng quát

1. **Người xem nhìn trên điện thoại.** Khung 1080 px chỉ còn khoảng 35–40% kích thước trên màn hình máy: chữ 42 px trên overlay ≈ 16 px trên máy. Không chữ nào dưới 22 px; nội dung cần đọc từ 38 px trở lên.
2. **Giao diện TikTok che một phần màn hình** (xem §3). Mọi thông tin quan trọng nằm trong dải Y 230–1180.
3. **Luồng live bị nén mạnh.** Chi tiết nhỏ chuyển động nhanh sẽ vỡ ô vuông; gradient mịn diện rộng bị sọc. Dùng mảng lớn, chuyển động chậm, chất liệu vẽ tay có hạt (grain) thay cho gradient trơn.
4. **Mỗi lúc một tâm điểm.** Khi Bụt đang nói, mọi thứ khác dịu xuống.
5. **Trưởng thành, không trẻ con.** Không chibi, không màu cơ bản rực, không thẻ bo tròn phồng kiểu ứng dụng thiếu nhi.

---

## 2. Định hướng mỹ thuật: Cổ phong thủy mặc 2.5D

### 2.1. Cảm giác tổng thể

Một làng quê Bắc Bộ trong truyện cổ tích, vẽ theo lối **thủy mặc hiện đại**: nền núi mực loang, sương mù tầng lớp, ánh hoàng hôn hoặc trăng; điểm xuyết **viền vàng ánh kim** mảnh và họa tiết **vân mây**. Nhân vật vẽ **bán tả thực (semi-realistic painterly)**, ánh sáng có khối (volumetric light), tông tối trầm để chữ sáng nổi rõ. Cảm giác: tĩnh, sang, huyền ảo, có chiều sâu điện ảnh.

**Tránh:** hoạt hình tròn trịa, mắt to kiểu chibi, viền đen dày, màu bão hòa cao, nền trắng phẳng, gradient cầu vồng, emoji.

### 2.2. Bảng màu (token — đặt trong `apps/overlay/src/theme.ts`)

| Token | Mã màu | Dùng cho |
|---|---|---|
| `ink900` | #0E1719 | Nền tối nhất, viền chữ nổi |
| `teal800` | #16343A | Trời đêm, mảng tối của cảnh |
| `teal600` | #2C5A5E | Núi xa, nước |
| `mist300` | #9DB5AE | Sương, mây xa |
| `paper100` | #F3EAD7 | Giấy dó, điểm sáng |
| `gold500` | #D4AF5A | Viền khung, tên người, điểm nhấn chính |
| `gold300` | #F0DCA0 | Nhãn phụ, ánh sáng phép |
| `vermilion600` | #A9362A | Nhấn rất ít: dấu triện, nhãn "Đại phép" |
| `jade500` | #5E9C80 | Lá ước, phép màu |
| `textOnDark` | #F6F1E4 | Chữ chính trên nền tối |
| `textMuted` | #C9C1AE | Chữ phụ trên nền tối |
| `panelBg` | rgba(14,23,25,0.80) | Nền khung HUD |

Ngũ sắc của mây (giảm bão hòa, pha khói): hồng phấn #E8B9B0, vàng ngà #EED9A2, ngọc #A9CDB8, tím khói #B9B0D6, lam khói #A9C4D8.

### 2.3. Phông chữ

| Vai trò | Phông | Ghi chú |
|---|---|---|
| Tên người, tiêu đề | **Noto Serif**, 600 | Đủ dấu tiếng Việt; dáng thanh lịch |
| Phụ đề, thẻ hướng dẫn, nhãn | **Be Vietnam Pro**, 500–700 | Rõ ràng trên điện thoại |
| Số đồng hồ | Be Vietnam Pro 700, `tabular-nums` | |

Tải qua Google Fonts; preload trước khi tạo Text của Phaser (dùng `document.fonts.load`). Kiểm tra đủ dấu: ắ ằ ẳ ẵ ặ ơ ư ữ ỹ.

### 2.4. Nhân vật

**Ông Bụt** — tiên ông cổ tích, KHÔNG phải Đức Phật:
- Đầu hói, tóc bạc dài hai bên, râu bạc dài mềm, lông mày bạc dài rủ xuống; mắt hiền, nếp cười.
- Áo nâu đất giản dị kiểu nông phu, thắt dây vải; chân đất hoặc dép cỏ.
- Gậy trúc có đốt, buộc một quả bầu nậm nhỏ bằng dây đỏ.
- Đứng hoặc lơ lửng trên mây ngũ sắc khói.
- **Cấm:** vòng hào quang sau đầu, tòa sen, tràng hạt, chữ Vạn, áo cà sa, tay bắt ấn, tư thế ngồi thiền.

**Dân làng** — người lớn, tỷ lệ thật (không chibi):
- 6 biến thể trang phục: áo nâu, áo tứ thân, áo bà ba chàm, áo cánh trắng, áo the đen, áo nâu sồng; 3 kiểu đầu: nón lá, khăn mỏ quạ, búi tóc.
- Vẽ cùng chất liệu painterly với cảnh, nhỏ hơn và ít chi tiết hơn Bụt.

---

## 3. Vùng an toàn trên khung 1080×1920

```
Y    0 ┌──────────────────────────────────────┐
       │ ① Thanh trên TikTok (tên kênh, số    │  KHÔNG đặt chữ — chỉ bầu trời
   220 ├──────────────────────────────────────┤
   230 │ ② Băng rôn tên  (x80–1000)           │
   390 │    + dòng chú thích                  │
   400 │ ③ Ô thông điệp (x60–1020)            │  chờ: thẻ hướng dẫn · lượt: phụ đề
   640 ├──────────────────────────────────────┤
   650 │ ④ Sân khấu: Bụt, dân làng, phép màu  │ ⑤ Chip hàng chờ x790–1050, y660–
       │                                      │
  1050 │ ⑥ Thông báo quà TikTok (x0–620)      │
  1180 ├──────────────────────────────────────┤
       │ ⑦ Làng (chỗ ngồi dân làng)           │
  1250 │ ⑧ Bình luận TikTok che (x0–700)      │ ⑨ Webcam tùy chọn (tâm 910,1410)
       │                                      │
  1720 ├──────────────────────────────────────┤
       │ ⑩ Thanh nhập + nút quà TikTok        │  KHÔNG đặt gì
  1920 └──────────────────────────────────────┘
```

| # | Vùng | Toạ độ | Quy tắc |
|---|---|---|---|
| ① | Thanh trên TikTok | Y 0–220 | Chỉ cảnh nền |
| ② | Băng rôn tên | X 80–1000, Y 230–390 | Thông tin "ai đang được thăm" |
| ③ | Ô thông điệp | X 60–1020, Y 400–640 | Thẻ hướng dẫn (chờ) hoặc phụ đề (lượt) |
| ④ | Sân khấu | Y 650–1180 | Bụt, dân làng được chọn, phép màu |
| ⑤ | Chip/thẻ hàng chờ | X 790–1050, Y 660–920 | |
| ⑥ | Thông báo quà TikTok | X 0–620, Y 1050–1250 | Không đặt chữ chính |
| ⑦ | Làng | Y 1180–1720 | Chỉ tạo không khí |
| ⑧ | Bình luận TikTok | X 0–700, Y 1250–1720 | Cảnh chạy phía sau |
| ⑨ | Webcam | tâm (910,1410), Ø 260 | Tùy chọn |
| ⑩ | Thanh nhập, nút quà | Y 1720–1920 | Không đặt gì |

Vị trí giao diện TikTok khác nhau theo máy/phiên bản. `?debug=safe` phải vẽ các khung trên (viền đỏ nét đứt, nhãn số) và cho phép nạp ảnh chụp màn hình live thật làm lớp tham chiếu: `?debug=safe&ref=/ref.png`.

---

## 4. Các trạng thái màn hình và bố cục

### 4.1. Thứ tự lớp (sau → trước)

1. Trời (sky) · 2. Trăng/mặt trời · 3. Núi mực xa · 4. Sương tầng 1 (trôi chậm) · 5. Đồi, ruộng lúa · 6. Giếng, ao (nước lấp lánh) · 7. Tán đa phía sau · 8. Thân đa · 9. Dân làng ngồi · 10. Mây sau Bụt · 11. **Bụt** · 12. Dân làng được chọn · 13. Mây trước · 14. Hiệu ứng phép màu · 15. Sương tầng 2 + tán lá rủ phía trước · 16. Đom đóm, cánh hoa · 17. Lớp làm tối (dim) · 18. Lớp hạt (grain 3–4%) · 19. HUD · 20. Debug

### 4.2. Bảng trạng thái

| Trạng thái | Khi nào | Hiển thị |
|---|---|---|
| **Chờ** | Không có lượt | Cảnh sống động (sương trôi, lá rung, đom đóm tối); bóng Bụt mờ thấp thoáng trên ngọn đa mỗi 45–60s; ③ = thẻ hướng dẫn xoay vòng; ② = logo "Làng Bụt Ơi" + đồng hồ "Bụt ghé làng sau 02:10" |
| **Bụt hiện** | Bậc `visit` | Dim 25%; ② = băng rôn tên; ③ = phụ đề; chip hàng chờ thu 1 dòng; FX nền giảm 50% tốc độ và độ sáng |
| **Phép màu** | Bậc `miracle` | Như Bụt hiện + phép riêng ở sân khấu; huy hiệu "Đã ghi vào Sổ làng" (x760, y1000, 280×110) |
| **Đại phép** | Bậc `grand` | Chuyển đêm trăng rằm trong 2s; trăng lớn sau lưng Bụt; mưa cánh hoa; **ẩn mọi HUD trừ băng rôn tên, chú thích và phụ đề** |
| **Lá ước tan** | Lời ước bị từ chối | Lá trên đầu người đó rơi xuống ao, gợn nước, 1,5s; không chữ, không tên |
| **Bụt ghé làng** | Hẹn giờ 4 phút | Bụt lướt ngang làng trái → phải, dừng giữa chúc 3–5 tên; không dim |
| **Làng đông** | > 36 người | Chỗ ngồi xoay vòng; bộ đếm "+128 dân làng đang ghé chơi" |
| **Tạm dừng** | Admin bấm | Ẩn chip hàng chờ; dòng nhỏ "Bụt đang nghỉ chân một lát" dưới ② |
| **Mất kết nối** | Nguồn rớt | Overlay vẫn ở trạng thái Chờ; chỉ admin hiện cảnh báo |

### 4.3. Toạ độ các điểm neo

| Điểm | Toạ độ |
|---|---|
| Bụt (neo chân, giữa đáy) | (540, 1230); chiều cao nhân vật ≈ 720 px |
| Dân làng được chọn (neo chân) | (210, 1180); phóng to 1,8× so với khi ngồi |
| Phép màu (tâm) | (240, 900) cho sách/gáo nước; toàn cảnh cho lúa chín, hoa sen |
| Chỗ ngồi | 6 hàng × 6 cột: `x = 60 + c*170 + (r%2 ? 85 : 0)`, `y = 1270 + r*72` (neo đỉnh đầu) |
| Trăng Đại phép | tâm (560, 860), Ø 380 + quầng Ø 600 |

---

## 5. Thành phần HUD

### 5.1. Thông số

| Thành phần | Vị trí (x, y, w × h) | Nội dung | Chữ | Khi nào hiện |
|---|---|---|---|---|
| **Băng rôn tên** | 80, 236, 920 × 128 | Trái: avatar tròn 92 px viền vàng 3 px (chữ cái đầu nếu không có ảnh). Giữa: nhãn "ÔNG BỤT ĐANG THĂM" + tên. Phải: con dấu bậc | Nhãn: Be Vietnam Pro 700, 24, `gold300`, giãn chữ 0.12em. Tên: Noto Serif 600, 60, `textOnDark`, tối đa 16 ký tự, quá thì cắt "…" | Suốt lượt; lúc chờ đổi sang logo + đồng hồ |
| **Con dấu bậc** | trong băng rôn, bên phải, 150 × 56 | "Bụt hiện" / "Phép màu" / "Đại phép" | Be Vietnam Pro 700, 24 | Theo bậc: nền `teal600` / `jade500` / `vermilion600`, chữ `paper100` |
| **Logo chờ** | trong băng rôn | Họa tiết vân mây vàng + "Làng Bụt Ơi" | Noto Serif 600, 56, `gold500` | Lúc chờ |
| **Đồng hồ ghé làng** | trong băng rôn, bên phải | "Bụt ghé làng sau" + "02:10" | Nhãn 22 `textMuted`; số 44 700 `textOnDark` | Lúc chờ |
| **Chú thích** | căn giữa, y 372, cao 32 | "Trò chơi giải trí lấy cảm hứng từ truyện cổ tích" | Be Vietnam Pro 500, 22, `textMuted`, nền `panelBg` bo 16 | Luôn hiện |
| **Thẻ hướng dẫn** | 60, 410, 960 × 220 | Tiêu đề nhỏ "CÁCH CHƠI" + 1 câu xoay vòng mỗi 8s + 3 chấm chỉ báo | Tiêu đề 22 700 `gold300`; câu 38 600 `textOnDark`, giãn dòng 1.3 | Lúc chờ |
| **Phụ đề** | 60, 410, 960 × 224 | Lời Bụt; chia đoạn ≤ 3 dòng (~36 ký tự/dòng), lật theo thời lượng audio; vạch phân cách hình lá ở trên | Be Vietnam Pro 500, 42, giãn dòng 1.38, `textOnDark`, căn giữa | Pha ASK + SPEAK |
| **Chip hàng chờ** | 790, 660, 260 × 64 | 3 avatar chồng nhau + "+4 đang chờ" | 26 700 `textOnDark` | Khi có hàng chờ và Bụt đang nói |
| **Thẻ hàng chờ** | 790, 660, 260 × 260 | "Bụt sắp ghé thăm" + tối đa 5 tên | Tiêu đề 22 `gold300`; tên 28 `textOnDark` | Có hàng chờ, giữa hai lượt |
| **Nhãn tên dân làng** | trên đầu avatar | Tên rút gọn 12 ký tự | Be Vietnam Pro 600, 26, `textOnDark`, viền chữ 5 px `ink900` | Chỉ người vừa tương tác trong 60s |
| **Chữ nổi "may mắn +1"** | trên đầu người thả tim | | 28 700 `gold300`, viền 5 px `ink900` | Bay lên 60 px rồi mờ trong 1,2s |
| **Bộ đếm dân làng** | 790, 1584, 260 × 52 | "+128 dân làng" | 26 600 `textOnDark` trên `panelBg` | > 36 người |
| **Khung webcam** | tâm 910,1410, Ø 260 | Khung tròn viền vàng + vân mây | — | Tùy chọn trong admin |

### 5.2. Khung trang trí (dùng chung cho mọi panel)

- Nền `panelBg`; bo góc **10 px** (không bo tròn phồng).
- Viền ngoài 1.5 px `gold500` độ mờ 70%; viền trong 1 px `gold300` độ mờ 25%, cách vào 6 px.
- Bốn góc gắn họa tiết **vân mây** 48×48 (asset `ui/ornament_corner.png`, xoay 0/90/180/270°).
- Bóng: 0 10 30 rgba(0,0,0,0.45).
- Dựng bằng `NineSlice` của Phaser từ `ui/panel_9slice.png` (96×96, cắt 24 px) + 4 sprite góc.

### 5.3. Ba câu thẻ hướng dẫn

1. Gõ **"ước: …"** để treo một lá ước lên cây đa.
2. Thả tim để thả đom đóm, gõ **"Bụt ơi"** để gọi Bụt.
3. Bụt ghé thăm cả làng mỗi 4 phút, và hay hiện ra thăm người tặng quà.

(Từ khóa in đậm: nền `jade500`, chữ `paper100`, bo 8 px. Không nhắc số xu hay tên quà.)

---

## 6. Chuyển động và âm thanh

- **Thời gian:** hiện 400–600ms `easeOutCubic`; ẩn 250–350ms `easeInQuad`; chuyển cảnh lớn 1,5–2s `easeInOutSine`.
- **Không nhấp nháy** quá 3 lần/giây.
- **Giới hạn hạt:** ≤ 150 particle cùng lúc; sprite hạt ≥ 16 px.
- **Parallax nền:** núi xa trôi 6 px/10s, sương tầng 1 trôi 20 px/10s, sương tầng 2 ngược chiều 30 px/10s — lặp liền mạch.
- **Một tâm điểm:** khi Bụt nói, FX nền giảm 50% tốc độ và độ sáng; chip hàng chờ thu gọn.
- **Báo trước bằng âm thanh:** 0,3s tiếng gió + lá xào xạc trước pha SUMMON.
- **Ducking:** nhạc nền giảm còn 40% trong 300ms khi có thoại, trả lại sau 500ms.
- **Nhịp:** giữa hai lượt Bụt hiện nghỉ ≥ 1,5s.

Hiệu ứng âm thanh cần có: `wind_gust`, `chime_soft` (chuông gió, không phải chuông chùa), `staff_tap`, `firefly_twinkle`, `water_bloop`, `sparrow`, `page_glow`; nhạc nền `bgm_day`, `bgm_night` (sáo trúc, đàn bầu, đàn tranh — tự sản xuất hoặc có giấy phép dùng cho livestream).

---

## 7. Nhân vật: puppet nhiều lớp

MVP dựng nhân vật bằng **PNG tách lớp + tween của Phaser** (miễn phí). Giai đoạn sau có thể chuyển sang Spine (cần giấy phép Spine Editor) mà không đổi API của `BudPuppet`.

### 7.1. BudPuppet — các lớp và điểm xoay

| Lớp | Điểm xoay (pivot) | Cha |
|---|---|---|
| `cloud_back` | giữa | — |
| `robe` (thân) | giữa đáy | — |
| `sleeve_l`, `sleeve_r` | vai | `robe` |
| `arm_staff` (tay cầm gậy) | vai phải | `robe` |
| `staff` | điểm tay nắm | `arm_staff` |
| `gourd` | đỉnh dây buộc | `staff` |
| `head` | cổ | `robe` |
| `hair_l`, `hair_r` | chân tóc | `head` |
| `brow_l`, `brow_r` | đầu mày phía trong | `head` |
| `eyes_open`, `eyes_closed` | — | `head` |
| `beard_1`, `beard_2`, `beard_3` | mép trên từng đoạn (chuỗi) | `head` → nối tiếp |
| `mustache` | giữa | `head` |
| `cloud_front` | giữa | — |

### 7.2. Animation (API: `play(name)`)

| Tên | Mô tả tween |
|---|---|
| `idle` | `robe.scaleY` 1→1.012, 4s, yoyo, sine; `head.y` −2 px; `beard_1..3` xoay ±2° lệch pha 0/0,2/0,4s; `gourd` xoay ±4°, 2,6s; chớp mắt 120ms mỗi 3–6s ngẫu nhiên |
| `appear` | alpha 0→1 và y +40→0 trong 900ms `easeOutCubic`; mây scale 0,6→1 trong 600ms; 30 hạt khói bung ra |
| `talk` | `head` xoay ±1,5° chu kỳ 0,8s; `beard_2` xoay theo biên độ âm thanh (AnalyserNode RMS → 0–4°) |
| `bless` | `arm_staff` xoay −18° 500ms → gõ gậy xuống 200ms + vòng sóng sáng tại đầu gậy → về 400ms |
| `leave` | alpha 1→0, y 0→−30, mây trôi lên, 1200ms; vệt lấp lánh |

### 7.3. VillagerPuppet

- Lớp: `body_{1..6}`, `head_{1..3}`, `hat_{non|khan|none}`, `arm_l`, `arm_r`. Tổ hợp chọn theo `avatarSeed`.
- Animation: `sit_idle` (nhún 1 px, 3s), `wave` (tay xoay 0→−35° lặp 3 lần), `walk_to(x,y)` (nhảy nhẹ theo đường cong 1,2s), `cheer`.

---

## 8. Danh sách asset và manifest

Code **chỉ** đọc ảnh/âm thanh qua `assets/manifest.json`. Trước khi có ảnh thật, script `pnpm placeholders` sinh ảnh tạm cho mọi khóa: khối màu đúng kích thước, đúng tông token, có nhãn tên khóa — để code chạy được ngay.

### 8.1. Danh sách

| Khóa | Kích thước (px) | Định dạng | Ghi chú |
|---|---|---|---|
| `bg.sky.day` / `.dusk` / `.night` | 1080×1300 | webp | Có hạt, không gradient trơn |
| `bg.mountains` | 1600×700 | png (alpha) | Rộng hơn khung để parallax |
| `bg.mist.a`, `bg.mist.b` | 1600×300 | png | Lặp ngang liền mạch |
| `bg.hills_rice` | 1300×420 | png | |
| `bg.banyan.back` | 1200×900 | png | Tán sau |
| `bg.banyan.trunk` | 520×720 | png | |
| `bg.banyan.front` | 1200×500 | png | Tán + rễ rủ phía trước |
| `bg.well` | 260×200 | png | |
| `bg.pond` + `bg.pond.mask` | 440×170 | png | Mask cho nước lấp lánh |
| `bg.ground` | 1080×820 | webp | |
| `fx.cloud.1..5` | 420×220 | png | 5 màu ngũ sắc khói |
| `fx.smoke` | sheet 8 khung 256×256 | png | |
| `fx.firefly` | 48×48 | png | Quầng sáng mềm |
| `fx.leaf_wish` | 110×110 | png | |
| `fx.lotus_bloom` | sheet 8 khung 160×160 | png | |
| `fx.book_glow`, `fx.well_water`, `fx.cottage`, `fx.sparrow_pair`, `fx.rice_wave` | theo nhu cầu, ≤ 512 | png / sheet | Phép màu |
| `fx.petal.1..4` | 40×30 | png | |
| `fx.moon` | 600×600 | png | |
| `ui.panel_9slice` | 96×96 | png | Cắt 24 px |
| `ui.ornament_corner` | 48×48 | png | Vân mây vàng |
| `ui.leaf_divider` | 360×24 | png | Vạch phân cách phụ đề |
| `ui.webcam_frame` | 300×300 | png | |
| `char.bud.*` | theo §7.1, nhân vật cao 720 | png | Vẽ ở 2× rồi thu nhỏ |
| `char.villager.*` | nhân vật cao ~90 khi ngồi | png | 6 thân × 3 đầu × 3 mũ |

Đóng atlas (TexturePacker hoặc free-tex-packer), mỗi atlas ≤ 4096×4096; tổng dung lượng ảnh ≤ 40MB.

### 8.2. Mẫu `manifest.json`

```json
{
  "images": {
    "bg.sky.dusk": { "src": "art/bg/sky_dusk.webp", "placeholder": { "w": 1080, "h": 1300, "color": "#16343A" } },
    "bg.banyan.trunk": { "src": "art/bg/banyan_trunk.png", "placeholder": { "w": 520, "h": 720, "color": "#3A2A1E" } }
  },
  "atlases": {
    "char.bud": { "src": "art/char/bud.png", "data": "art/char/bud.json" }
  },
  "audio": {
    "sfx.wind_gust": { "src": "audio/wind_gust.ogg" },
    "bgm.day": { "src": "audio/bgm_day.ogg", "loop": true, "volume": 0.35 }
  }
}
```

Thiếu file thật → tự dùng placeholder và log cảnh báo, không bao giờ làm overlay dừng.

---

## 9. Art brief cho họa sĩ / tạo ảnh

Gửi kèm §2 và §7–8. Yêu cầu chung: cùng một phong cách cho mọi asset; nhân vật vẽ trên nền trơn để tách lớp; bàn giao file PSD tách lớp đúng tên khóa.

**Prompt tham khảo — cảnh nền (không nhân vật):**

```text
Vertical 9:16 background for a mobile game, Eastern fantasy ink-wash 2.5D painterly style. A misty northern Vietnamese countryside village at dusk: a huge ancient banyan tree with hanging aerial roots in the center, rice fields, a small stone well on the left, a lotus pond on the right, distant ink-wash mountains, layered mist, soft paper lanterns. Dark muted palette of deep teal, ink black and warm gold, subtle film grain, volumetric light, cinematic, no characters, no text, no religious structures.
```

**Prompt tham khảo — Ông Bụt (bảng nhân vật):**

```text
Character sheet, front and three-quarter view, plain neutral background, semi-realistic painterly style matching an Eastern ink-wash fantasy game. A kind elderly sage from Vietnamese folk tales: bald head with long white hair at the sides, long soft white beard, long white drooping eyebrows, gentle smiling eyes, plain earth-brown peasant robe tied with a cloth belt, barefoot, holding a jointed bamboo walking staff with a small gourd tied by a red cord. Mature realistic proportions, warm rim light. No halo, no lotus, no prayer beads, no religious symbols, no text.
```

**Prompt tham khảo — dân làng:**

```text
Character sheet of six seated adult Vietnamese villagers, realistic proportions, painterly ink-wash game style: brown peasant shirt, four-panel ao tu than, indigo ao ba ba, white blouse, black the robe, rough brown robe; headwear variations: conical leaf hat, mo qua headscarf, hair bun. Plain neutral background, consistent lighting, no text.
```

Loại trừ (negative): `halo, lotus throne, prayer beads, Buddha statue, monk robe, swastika, chibi, childish, saturated cartoon, thick black outlines, text, watermark, extra fingers`.

---

## 10. Kiểm tra trên điện thoại (bắt buộc trước khi chốt giao diện)

1. Live riêng tư bằng tài khoản phụ; xem đồng thời trên một Android tầm thấp và một iPhone.
2. Tên và phụ đề đọc được ở khoảng cách tay cầm.
3. Không thông tin quan trọng nào bị giao diện TikTok che (so với `?debug=safe&ref=`).
4. Hiệu ứng quà TikTok không che mất lúc Bụt bắt đầu nói (chỉnh `giftGraceMs`).
5. Nền tối không bị sọc dải màu; nếu có, tăng grain hoặc thêm chất liệu vào vùng gradient.
6. Quay màn hình điện thoại, xem lại từng lượt, ghi lỗi vào bảng task.
