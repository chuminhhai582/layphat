# Bụt Ơi Live

Overlay game tương tác cổ tích Việt Nam cho TikTok LIVE (`1080×1920`, Phaser 3 + Fastify + Socket.IO + SQLite + React Admin).

## Yêu cầu hệ thống

- Node.js 20+
- pnpm 9+
- `ffmpeg` trên `PATH` (tùy chọn, dùng để thêm hiệu ứng vang nhẹ reverb cho giọng Bụt; nếu chưa cài, hệ thống tự động dùng luồng audio trực tiếp).

## Cài đặt & Khởi tạo

```bash
cp .env.example .env
pnpm install
pnpm placeholders
pnpm seed
pnpm voices
```

## Chạy môi trường phát triển (3 cổng)

```bash
pnpm dev
```

- **Server**: `http://localhost:7777` (kiểm tra: `http://localhost:7777/health`)
- **Overlay**: `http://localhost:5173`
  - Chế độ kiểm tra vùng an toàn: `http://localhost:5173/?debug=safe` (hoặc `?debug=safe&ref=/ref.png`)
  - Chế độ ép khung giờ: `http://localhost:5173/?time=day|dusk|night`
  - Chế độ chạy thử không cần server: `http://localhost:5173/?demo=visit`
- **Admin**: `http://localhost:5174`

## Chạy chế độ Live thực tế (1 cổng duy nhất — T36)

```bash
pnpm start
```

- **Overlay (dán vào OBS / TikTok LIVE Studio)**: `http://localhost:7777/overlay/`
- **Admin (mở trên điện thoại cùng Wi-Fi)**: `http://<IP_LAN>:7777/admin/` (địa chỉ cụ thể được in ra console khi khởi động).

## Ghi chú về nguồn sự kiện TikTok

- **`connector` (`tiktok-live-connector` 2.x)**: Đây là thư viện **không chính thức** (reverse-engineering), **chỉ kết nối được khi kênh TikTok đang mở phiên LIVE thực tế**. Nếu TikTok thay đổi giao thức hoặc gặp lỗi kết nối, có thể chuyển nóng ngay trên trang Admin sang nguồn dự phòng `tikfinity` (`ws://127.0.0.1:21213`) hoặc `simulator`.

## Các lệnh chính

- `pnpm dev`: Chạy đồng thời server, overlay và admin.
- `pnpm build`: Build toàn bộ các gói và ứng dụng.
- `pnpm start`: Build và chạy chế độ live một cổng tại `http://localhost:7777`.
- `pnpm test`: Chạy toàn bộ bộ test Vitest.
- `pnpm lint`: Kiểm tra mã nguồn bằng ESLint.
- `pnpm placeholders`: Sinh bộ ảnh placeholder, atlas và hiệu ứng âm thanh từ `assets/manifest.json`.
- `pnpm seed`: Khởi tạo CSDL SQLite và nạp kho 150 lời chúc + danh sách từ cấm.
- `pnpm voices`: Tạo sẵn các file âm thanh cho kho lời chúc.
