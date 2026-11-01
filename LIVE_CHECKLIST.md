# Bụt Ơi Live — Checklist trước và trong buổi Live thử (T38)

## 1. Checklist kỹ thuật trước mỗi buổi live (`IMPLEMENTATION_PLAN.md` §9)

- [ ] **Chế độ một cổng**: Chạy `pnpm start`; kiểm tra `http://localhost:7777/overlay/` và `http://localhost:7777/admin/` mở bình thường.
- [ ] **Trang quản trị trên điện thoại**: Mở địa chỉ LAN `http://<IP_LAN>:7777/admin/` trên điện thoại cùng Wi-Fi, đăng nhập bằng `ADMIN_PIN` thành công.
- [ ] **Nguồn sự kiện chính & dự phòng**: Kiểm tra kết nối `tiktok-live-connector` (phiên live đang mở) và thử chuyển nóng sang `tikfinity` (`ws://127.0.0.1:21213`) hoặc `simulator`.
- [ ] **Kiểm tra 4 bậc quà**: Từ tab **Giả lập** trên điện thoại, bấm thử 1 lượt mỗi bậc (`Đom đóm ước`, `Bụt hiện`, `Phép màu`, `Đại phép`), xác nhận nghe rõ giọng Bụt và hiệu ứng đúng.
- [ ] **Cân bằng âm lượng & Ducking**: Nhạc nền (`bgm`) thấp hơn giọng streamer; khi Bụt nói nhạc nền tự giảm xuống 40% trong 300ms để giọng Bụt luôn rõ.
- [ ] **Cấu hình Browser Source (OBS / TikTok LIVE Studio)**:
  - Kích thước cố định: `1080 × 1920` px, `30 fps`.
  - Bật điều khiển âm thanh qua OBS/LIVE Studio để âm thanh overlay đi vào luồng phát.
- [ ] **Ràng buộc hiển thị bắt buộc**:
  - Dòng chú thích *"Trò chơi giải trí lấy cảm hứng từ truyện cổ tích"* luôn hiển thị tại `y = 372`.
  - Không hiển thị số xu hay bảng giá quà trên overlay.
  - Không có biểu tượng tôn giáo trong cảnh hoặc trên nhân vật Ông Bụt.
- [ ] **Dung lượng ổ đĩa**: Kiểm tra ổ đĩa còn trống `> 5 GB` cho log và cache giọng đọc.

---

## 2. Kiểm tra hiển thị thực tế trên điện thoại (`UI_SPEC.md` §10)

- [ ] **Bước 1 — Phát thử riêng tư**: Mở phiên live riêng tư bằng tài khoản phụ; mở xem đồng thời trên **1 máy Android tầm thấp** và **1 máy iPhone**.
- [ ] **Bước 2 — Độ rõ chữ**: Kiểm tra tên người xem trên băng rôn (`60 px`) và phụ đề lời Bụt (`42 px`) đọc rõ ràng ở khoảng cách cầm tay bình thường.
- [ ] **Bước 3 — Vùng an toàn TikTok**: Đối chiếu với chế độ `?debug=safe&ref=/ref.png`, xác nhận không thông tin quan trọng nào (Băng rôn vùng ②, Ô thông điệp/Phụ đề vùng ③, Sân khấu vùng ④, Chip hàng chờ vùng ⑤) bị giao diện TikTok che khuất.
- [ ] **Bước 4 — Căn chỉnh `giftGraceMs`**: Quan sát hiệu ứng quà mặc định của TikTok; nếu hiệu ứng quà che mất lúc Bụt bắt đầu nói, vào tab **Cấu hình** trên Admin tăng `giftGraceMs` (`visit: 1500ms`, `miracle: 2500ms`, `grand: 3500ms`).
- [ ] **Bước 5 — Kiểm tra nén hình & sọc màu (banding)**: Quan sát nền trời đêm và sương mù trên điện thoại; đảm bảo lớp hạt film grain (`3.5%`) giữ nền mịn, không bị vỡ ô vuông hay sọc dải màu.
- [ ] **Bước 6 — Ghi hình & nghiệm thu**: Quay màn hình điện thoại suốt buổi live thử, rà soát lại từng lượt xuất hiện của Bụt.

