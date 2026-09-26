# Family Management

Ứng dụng quản lý tài sản, thu chi và lịch gia đình theo mô hình nhiều gia đình, mỗi phiên làm việc gắn với đúng một gia đình hoạt động.

## Thành phần chính

- `server/`: NestJS + TypeORM + PostgreSQL
- `web/`: React + Vite + Ant Design
- Đăng nhập Google OAuth2
- Phân quyền theo vai trò mẫu trong gia đình
- Dữ liệu tài chính tách biệt chặt theo `familyId`

## Tính năng hiện tại

- Quản lý tài sản
- Quản lý tài chính cho giao dịch thu nhập và chi phí
- Module `Bảo trì khai thác và nợ` gắn với tài sản:
  - `Bảo trì` và `Nợ` khi thanh toán sẽ ghi nhận chi phí
  - `Khai thác` khi hoàn tất sẽ ghi nhận thu nhập
- Danh mục 2 cấp, dùng chung toàn project
- Tài sản và giao dịch có thể dùng bất kỳ danh mục nào, không bắt buộc là danh mục con
- Chuyển nội bộ với `isTransfer` để không double count vào tổng thu chi
- Lịch gia đình hiển thị:
  - sự kiện theo ngày
  - danh sách sự kiện sắp tới
  - danh sách sự kiện đã qua
  - các lịch `bảo trì / khai thác / nợ` tạo từ module tài sản
  - sửa từ `Lịch gia đình` hay từ module `Bảo trì khai thác và nợ` đều dùng chung lịch đó
- AI nhập liệu tự nhiên bằng tiếng Việt
- Multi-family membership + chọn `active family`
- Giao diện tiếng Việt, có Dark Mode

## Vai trò hệ thống

- `APP_ADMIN`: quản trị cấu trúc hệ thống, gia đình, vai trò mẫu; không được truy cập dữ liệu tài chính
- `FAMILY_ADMIN`: quản trị một gia đình, mời thành viên, đổi vai trò thành viên
- `MEMBER`: thao tác dữ liệu gia đình theo permission template

## Chạy local

### Yêu cầu

- Node.js 24+
- PostgreSQL

### Cài đặt

```bash
npm install
```

Tạo file môi trường:

- `server/.env`
- `web/.env`

### Chạy dev

```bash
npm run dev
```

- API: `http://localhost:3173/api/v1`
- Swagger: `http://localhost:3173/api/docs`
- Web: `http://localhost:5173`

### Build

```bash
npm run build -w server
npm run build -w web
```

### Migration

```bash
npm run migration:run -w server
```

Các migration gần đây cần được áp dụng trước khi chạy production:

- `1775304000000-RefactorFinanceCategoryHierarchy`
- `1775400000000-AddMultiFamilyRbac`
- `1778000000000-RemoveCategoryTypeColumn` (bỏ cột `type` khỏi `categories`)
- `1779811200000-AddAssetMaintenanceType`
- `1779900000000-RemoveLiabilityAndRecurringFromExpenses`

## Tài liệu

- [REQUIREMENTS.md](./REQUIREMENTS.md)
- [AI_HANDOVER.md](./AI_HANDOVER.md)
- [docs/specs/ARCHITECTURE.md](./docs/specs/ARCHITECTURE.md)
- [docs/specs/TODO.md](./docs/specs/TODO.md)

## Ghi chú production hiện tại

- Invite flow đã có token-based backend, nhưng chưa có outbound email sender thật
- `APP_ADMIN` đã có backend API, nhưng web admin riêng chưa hoàn thiện
- Chưa có test integration đủ cho RBAC, multi-family isolation và migration
