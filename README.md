# QLTT — Hệ thống Quản lý Trung tâm

Ứng dụng quản lý trung tâm đào tạo: học viên, lớp học, chi nhánh, điểm danh và học phí. Kiến trúc multi-tenant (mỗi trung tâm là một tenant riêng, dữ liệu cách ly hoàn toàn).

## Công nghệ sử dụng

- **Backend:** Express, TypeScript, Drizzle ORM, PostgreSQL
- **Frontend:** React 19, Vite, Tailwind CSS
- **Xác thực:** Firebase Auth
- **Nhận diện khuôn mặt:** face-api.js (chạy trong trình duyệt) và tích hợp camera AI Hanet (qua webhook)
- **Khác:** Google Gemini API, xlsx (nhập/xuất Excel)

## Tính năng chính

- Quản lý học viên, lớp học, ghi danh, chi nhánh
- Phân quyền theo vai trò: `admin`, `manager`, `staff`, `teacher`
- Điểm danh: thao tác tay, quét khuôn mặt qua webcam, hoặc tự động qua camera AI Hanet
- Quản lý thu chi, học phí, chương trình ưu đãi
- Đăng ký trung tâm mới hoặc tham gia trung tâm có sẵn qua mã mời

## Yêu cầu trước khi cài đặt

- Node.js
- PostgreSQL (đã tạo sẵn database trống)
- Một Firebase project đã bật Authentication
- (Tuỳ chọn) Tài khoản Gemini API nếu dùng tính năng AI
- (Tuỳ chọn) Tài khoản đã tạo App trên `developers.hanet.ai` nếu dùng tích hợp camera Hanet

## Cài đặt

1. Cài dependencies:
   ```
   npm install
   ```

2. Tạo file `.env` từ `.env.example`, điền đầy đủ giá trị:
   - `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME` — thông tin kết nối PostgreSQL lúc chạy app
   - `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` — tài khoản Postgres riêng dùng khi chạy migration (nên có quyền cao hơn tài khoản app)
   - `GEMINI_API_KEY` — API key cho các tính năng dùng Gemini
   - `APP_URL` — URL nơi app được host
   - `HANET_CLIENT_SECRET` — lấy từ App tạo trên `developers.hanet.ai`, dùng xác thực webhook
   - `HANET_DEFAULT_TENANT_ID` — tenant mặc định khi webhook Hanet nhận được khuôn mặt chưa liên kết học viên nào

3. Cấu hình Firebase: file `firebase-applet-config.json` ở thư mục gốc chứa cấu hình client Firebase (không phải bí mật, an toàn để commit). Nếu deploy sang một Firebase project khác, thay nội dung file này bằng cấu hình project mới. Phía server dùng Application Default Credentials của Firebase Admin — cần đăng nhập `gcloud`/thiết lập service account tương ứng khi chạy ở môi trường mới.

4. Khởi tạo cấu trúc database: chạy file SQL migration lên đúng database đã cấu hình ở bước 2 (khuyến khích sao lưu database trước khi chạy). Sau khi có migration đầu tiên, các thay đổi schema về sau nên đi qua `drizzle-kit` (`npx drizzle-kit generate` / `npx drizzle-kit push`, cấu hình tại `src/db/drizzle.config.ts`).

## Chạy dự án

| Lệnh | Chức năng |
|---|---|
| `npm run dev` | Chạy ở chế độ phát triển (`tsx server.ts`) |
| `npm run build` | Build frontend (Vite) + đóng gói server (esbuild) vào `dist/` |
| `npm start` | Chạy bản đã build (`node dist/server.cjs`) |
| `npm run lint` | Kiểm tra kiểu dữ liệu TypeScript toàn bộ dự án (`tsc --noEmit`) — nên chạy trước khi commit |
| `npm run clean` | Xoá thư mục build |

## Tích hợp camera Hanet AI

Camera Hanet hoạt động theo mô hình đẩy dữ liệu một chiều: khuôn mặt được đăng ký qua app riêng của Hanet, hệ thống này chỉ nhận sự kiện qua webhook tại `POST /api/webhooks/hanet`, xác thực bằng chữ ký MD5 (`HANET_CLIENT_SECRET`). Điểm danh chỉ được tự động ghi khi có đúng một phiên điểm danh đang mở cho lớp của học viên (`POST /api/attendance-sessions`); các trường hợp còn lại được đưa vào hàng chờ (`GET /api/hanet-pending-checkins`) để nhân viên xác nhận thủ công.

## Đa tenant (multi-tenant)

Mỗi trung tâm là một tenant độc lập, tạo qua `POST /api/onboarding/create-tenant` (người tạo trở thành `admin`), hoặc tham gia tenant có sẵn qua mã mời tại `POST /api/onboarding/join-tenant`. Toàn bộ bảng dữ liệu chính đều có cột `tenant_id` và mọi truy vấn đều lọc theo tenant hiện tại.
