# Project Requirements & Specifications

## 1. Kiến trúc tổng thể

- Monorepo npm workspaces
- Backend: NestJS 11 + TypeORM + PostgreSQL
- Frontend: React 19 + Vite + TypeScript + Ant Design
- Node.js: `>=24`
- API versioning: `/api/v1`
- Ngôn ngữ UI: tiếng Việt
- Dark Mode: đã chạy thật

## 2. Mô hình tenant và phiên làm việc

- Một `User` có thể thuộc nhiều `Family`
- Quan hệ membership nằm ở `family_users`
- Mỗi request nghiệp vụ của user thường phải gắn với đúng một `activeFamilyId`
- Tất cả query nghiệp vụ tài chính phải scope theo `familyId`
- `APP_ADMIN` không dùng `activeFamilyId` để xem dữ liệu tài chính

## 3. Onboarding

- Đăng nhập: Google OAuth2
- Nếu user chưa thuộc gia đình nào và không phải `APP_ADMIN`:
  - hệ thống bắt buộc tạo một gia đình mặc định cho user
  - user đó trở thành `FAMILY_ADMIN`
- Sau khi đăng nhập thành công:
  - backend trả JWT
  - JWT chứa `systemRole`, `activeFamilyId`, `activeRole`

## 4. Vai trò và phân quyền

### 4.1 System role

- `USER`
- `APP_ADMIN`

### 4.2 Family role template

- `FAMILY_ADMIN`
- `MEMBER`

Không dùng per-user custom permission. Quyền được áp theo role template.

### 4.3 Module permissions

Modules:

- `ASSET`
- `TRANSACTION`
- `CATEGORY`
- `CALENDAR`
- `DASHBOARD`
- `USER`
- `FAMILY`
- `PERMISSION`
- `ADMIN`

Actions:

- `view`
- `create`
- `update`
- `delete`

### 4.4 Permission templates hiện tại

`FAMILY_ADMIN`
- Toàn quyền `ASSET`, `TRANSACTION`, `CATEGORY`, `CALENDAR`
- `view/update` với `FAMILY`
- `view/create/update/delete` với `USER`
- `view` với `DASHBOARD`

`MEMBER`
- `view/create/update/delete` với `ASSET`, `TRANSACTION`, `CALENDAR`
- `view` với `CATEGORY`, `USER`, `FAMILY`, `DASHBOARD`

`APP_ADMIN`
- Chỉ quản trị hệ thống: `ADMIN`, `FAMILY`, `USER`, `PERMISSION`
- Không được truy cập dữ liệu tài chính của gia đình

## 5. Hành vi theo vai trò

### 5.1 FAMILY_ADMIN

- Mời user vào gia đình bằng email + token
- Đổi role của thành viên trong gia đình
- Quản lý toàn bộ dữ liệu gia đình theo permission template

### 5.2 MEMBER

- Truy cập dữ liệu gia đình theo role template
- Không bị giới hạn vào “dữ liệu do chính mình tạo”

### 5.3 APP_ADMIN

- Xem cấu trúc gia đình và membership
- Quản trị template role/permission ở mức hệ thống
- Không xem asset, transaction, dashboard tài chính của bất kỳ gia đình nào

## 6. Family behavior

- Dữ liệu tài chính, danh mục, lịch, dashboard phải gắn với `familyId`
- `family.status = INACTIVE` phải chặn user family truy cập bằng session đó
- Gia đình luôn phải giữ ít nhất một `FAMILY_ADMIN`
- Family admin không được tự đổi `family.status`

## 7. Category system

Danh mục hiện là cây **2 cấp**, dùng chung toàn project:

- **Danh mục cha** (`parentId = null`)
- **Danh mục con** (`parentId` trỏ tới một danh mục cha)

Ràng buộc:

- Không có cấp thứ 3
- Không có `type` trên bảng `categories`
- Cùng một cây danh mục được dùng chung cho tài sản, tài chính và các nghiệp vụ tài sản
- Tài sản và giao dịch có thể gắn vào **bất kỳ danh mục nào**, không bắt buộc là danh mục con

## 8. Transaction model

Transaction (`Expense` entity hiện tại) hỗ trợ:

- `entryType`: `INCOME | EXPENSE`
- `isTransfer: boolean`

Quy tắc vận hành hiện tại:

- Module `Quản lý tài chính` chỉ vận hành trực tiếp với `INCOME` và `EXPENSE`
- Không còn recurring transaction trong domain hiện tại
- Không còn `LIABILITY` trong transaction domain
- `Bảo trì` và `Nợ` từ module tài sản khi thanh toán sẽ tạo transaction `EXPENSE`
- `Khai thác` từ module tài sản khi hoàn tất sẽ tạo transaction `INCOME`
- `isTransfer = true` dùng cho chuyển nội bộ
- transfer không được cộng vào tổng thu/chi dashboard
- transfer không được làm méo analytics thu nhập/chi phí

## 9. Asset management

- Asset luôn thuộc một `familyId`
- Asset dùng danh mục chung như toàn hệ thống, không bắt buộc là danh mục con
- Hỗ trợ các trường giá mua, giá trị hiện tại, bảo hành, bảo trì, ảnh, tài liệu

### 9.1 Asset operations

Module `Bảo trì khai thác và nợ` là module nghiệp vụ tài sản:

- `Bảo trì`
- `Khai thác`
- `Nợ`

Mỗi bản ghi:

- gắn với một tài sản
- có ngày thực hiện
- có trạng thái `open | completed | skipped`
- khi hoàn tất có thể sinh transaction tài chính tương ứng
- đồng thời tạo lịch trong `Lịch gia đình`
- lịch này là dữ liệu dùng chung với module lịch, sửa ở đâu cũng phải phản ánh sang nơi còn lại

## 10. Dashboard

- Chỉ load khi role có `DASHBOARD.view`
- Tổng thu chi không tính transfer nội bộ
- Dữ liệu luôn bám theo `activeFamilyId`

## 11. Calendar

- Dữ liệu theo gia đình
- Hiển thị hay cho phép thao tác dựa trên permission template
- Hiển thị đồng thời:
  - sự kiện của ngày đang chọn
  - danh sách sự kiện tương lai
  - danh sách sự kiện đã qua
- Các bản ghi từ module `Bảo trì khai thác và nợ` phải xuất hiện trong lịch gia đình
- Event sinh từ `Bảo trì khai thác và nợ` dùng chung dữ liệu với module đó; sửa ngày, mô tả, nhắc lịch ở lịch hay ở module tài sản đều phải đồng bộ

## 12. User settings

- Là dữ liệu riêng theo user, không chia sẻ giữa các family
- Giao diện hiện đã có phần settings và dark mode
- Backend settings riêng theo user vẫn cần hoàn thiện thêm nếu muốn tách hẳn khỏi luồng family-scoped update

## 13. Invite flow

- Family admin tạo invite với:
  - `email`
  - `token`
  - `familyId`
  - `role`
  - `status`
  - `expiry`
- User đăng nhập Google rồi gọi accept invite theo token
- Nếu membership cũ đang `REMOVED`, hệ thống có thể kích hoạt lại membership đó

Lưu ý hiện tại:

- Flow token-based đã có
- Email sender thật chưa được tích hợp

## 14. UI/UX

- Toàn bộ UI dùng tiếng Việt
- Giao diện tối ưu cho không gian gọn
- Dark Mode hoạt động thật
- Menu và route phải ẩn/redirect theo quyền, tránh để user đi vào màn không có quyền rồi mới nhận `403`

## 15. Technical requirements

- Schema/migration phải phản ánh:
  - multi-family membership
  - role templates
  - permissions
  - invites
  - finance category hierarchy 2 cấp dùng chung
  - transfer flag
  - loại bản ghi `maintenance / operation / liability` cho nghiệp vụ tài sản
- Phải có validation cho:
  - active family membership
  - role safety
  - family admin floor
- App phải build sạch ở cả backend và frontend trước khi release
