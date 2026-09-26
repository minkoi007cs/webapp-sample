# System Architecture

## 1. High-level flow

```text
Browser
  -> React SPA (web)
  -> Bearer JWT
  -> NestJS API (/api/v1)
  -> TypeORM
  -> PostgreSQL
```

External integrations:

- Google OAuth2
- OpenAI API
- File storage module (nếu đang bật môi trường upload)

## 2. Request lifecycle

```text
Browser request
  -> AuthGuard('jwt')
  -> JwtStrategy resolve user + active family membership
  -> ActiveFamilyGuard (nếu route yêu cầu family session)
  -> PermissionGuard
  -> Controller
  -> Service
  -> Repository / QueryBuilder
```

Điểm quan trọng:

- `JwtStrategy` là lớp chốt membership đang hoạt động
- `PermissionGuard` map module/action sang permission template
- `APP_ADMIN` bị chặn khỏi các module tài chính

## 3. Multi-family model

```text
users
  1 --- n family_users n --- 1 families
```

`family_users` là nguồn sự thật cho:

- family membership
- family role
- membership status

`users.lastActiveFamilyId` chỉ là session preference.

## 4. RBAC model

```text
roles
  1 --- n role_permissions n --- 1 permissions

family_users.roleId -> roles.id
invites.roleId -> roles.id
```

### Permission modules

- `ADMIN`
- `FAMILY`
- `USER`
- `PERMISSION`
- `DASHBOARD`
- `CATEGORY`
- `CALENDAR`
- `ASSET`
- `TRANSACTION`
- `GOUS` (Định cư Hoa Kỳ diện F4)

### Actions

- `view`
- `create`
- `update`
- `delete`

## 5. Auth flow

```text
/auth/google
  -> Google callback
  -> validateOAuthUser()
      -> upsert user
      -> seed permissions/roles
      -> create default family if user has no membership
      -> choose active family
  -> sign JWT
  -> redirect frontend with token
```

Frontend:

```text
login-success
  -> save token
  -> load /auth/me
  -> SessionProvider caches session
  -> sidebar/routes derive family and permission state
```

## 6. Invite flow

```text
FAMILY_ADMIN
  -> POST /users/invite
  -> create invite token + expiry

Invited user
  -> login Google
  -> POST /auth/accept-invite
  -> create or reactivate family_users membership
  -> switch active family to invited family
```

Lưu ý:

- Hiện chưa có email sender thật
- Invite hiện là token-based backend flow

## 7. Finance category model

```text
Category(name, parentId?)
```

- **Danh mục cha**: `parentId = null`
- **Danh mục con**: `parentId` trỏ tới một danh mục cha (đúng 2 cấp)
- Không còn enum `type` trên bảng `categories`
- Danh mục hiện được dùng chung cho:
  - giao dịch tài chính
  - tài sản
  - bản ghi `bảo trì / khai thác / nợ`
- Không ép chọn danh mục con; asset và transaction có thể gắn vào bất kỳ node nào trong cây

Ví dụ:

```text
Sinh hoạt
  -> Ăn uống
Thu nhập
  -> Lương / Thu nhập chính
```

## 8. Transaction model

Entity transaction hiện dùng `Expense`:

- `entryType`: `INCOME | EXPENSE`
- `isTransfer`

Analytics rules:

- `isTransfer = true` không đi vào tổng thu chi
- transfer không đi vào breakdown income/expense bình thường

UI rules hiện tại:

- màn `Quản lý tài chính` chỉ có `INCOME` và `EXPENSE`
- không còn recurring transaction
- `Nợ` không còn là transaction type; nó là một nghiệp vụ tài sản và chỉ sinh ra `EXPENSE` khi ghi nhận thanh toán

## 9. Asset operations model

```text
AssetMaintenance(assetId, type, scheduledDate, status, expenseId?, calendarEventId?)
```

`type` hiện gồm:

- `maintenance`
- `operation`
- `liability`

Mapping nghiệp vụ:

- `maintenance` -> khi hoàn tất sinh transaction `EXPENSE`
- `operation` -> khi hoàn tất sinh transaction `INCOME`
- `liability` -> khi hoàn tất sinh transaction `EXPENSE`

Đồng thời mỗi bản ghi tạo/cập nhật một `calendar_event` để xuất hiện trên lịch gia đình.
Lịch này là dữ liệu dùng chung: sửa ở `Calendar` hay `Maintenance` đều phải sync cùng ngày, mô tả và nhắc lịch.

## 10. Frontend authorization model

Frontend không thay backend authorization, nhưng làm 3 việc:

1. load session qua `/auth/me`
2. ẩn menu theo permission template
3. redirect khỏi route không có `view` permission

Điều này giảm số màn `403` vô nghĩa và khớp trải nghiệm với backend.

## 11. Production concerns

Các điểm còn cần chú ý trước launch:

- chưa có admin web riêng cho `APP_ADMIN`
- chưa có outbound email cho invite
- test integration còn thiếu cho:
  - multi-family isolation
  - switch family
  - invite accept
  - finance migration loại bỏ `LIABILITY` và recurring
  - transfer exclusion
