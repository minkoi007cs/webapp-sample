# Production Backlog

Backlog này phản ánh trạng thái sau các refactor lớn về finance category, multi-family RBAC và UI.

## P0 — Phải chốt trước production launch

### 1. Bổ sung integration tests cho flow sống còn

Thiếu test cho:

- login lần đầu -> auto create family -> FAMILY_ADMIN
- switch active family
- invite + accept invite
- APP_ADMIN không truy cập finance data
- transfer không vào dashboard tổng thu/chi
- last FAMILY_ADMIN không bị remove/demote

### 2. Hoàn thiện web admin riêng cho APP_ADMIN

Backend API cho admin đã có, nhưng frontend admin tách biệt chưa hoàn thiện. Không nên launch `APP_ADMIN` cho user thật nếu chưa có bề mặt quản trị phù hợp.

### 3. Tích hợp email sender cho invite flow

Hiện tại invite là token-based backend flow. Muốn production thật cần:

- mail provider
- template email
- deep link nhận lời mời

## P1 — Nên xử lý ngay sau P0

### 4. Tách user settings backend riêng theo user

Hiện chỉnh hồ sơ trên web còn đi qua endpoint user trong active family. Về lâu dài nên có endpoint user-scoped độc lập với family session.

### 5. Audit lại migration trên dữ liệu thật

Đặc biệt với:

- category legacy có `subTypes`
- transaction legacy `DEBT`
- membership legacy từ `users.familyId`

### 6. Chuẩn hóa family status lifecycle

Hiện có `ACTIVE | INACTIVE`. Cần xác nhận nghiệp vụ suspend/reactivate trên UI admin và quy trình support.

### 6.1 Rà soát lại migration tài chính trên dữ liệu thật

Cần kiểm tra kỹ sau khi bỏ `LIABILITY` và recurring:

- transaction legacy `LIABILITY` đã được đổi sang `EXPENSE` an toàn
- dữ liệu cũ không còn phụ thuộc các cột recurring
- dashboard không còn báo cáo nhầm nợ như một transaction type

## P2 — Nâng chất lượng kỹ thuật

### 7. Tăng chỉ số và index cho bảng mới

Xem lại index cho:

- `family_users(userId, status)`
- `invites(email, status, expiresAt)`
- `users(lastActiveFamilyId)`

### 8. Rà soát DTO validation

Một số route mới đang nhận object inline trong controller/service. Nên chuyển dần sang DTO + class-validator cho:

- invite
- switch family
- accept invite
- update role

### 9. Thêm observability

- request logging có correlation id
- audit log cho invite, role change, family status change
- error monitoring cho frontend và backend

### 10. Tiếp tục tối ưu bundle frontend

Đã tách lazy route, nhưng build hiện vẫn còn 2 chunk lớn từ dashboard/vendor. Nên cân nhắc:

- `manualChunks`
- tách `NaturalInputBox`
- tách chart/editor nặng khỏi luồng khởi động chính

## P3 — UX polish

### 11. Màn nhận lời mời trên web

Hiện backend đã có `/auth/accept-invite`, nhưng UX trên web còn tối giản. Nên có route nhận token rõ ràng hơn.

### 12. Màn chọn family khi user có nhiều family

Đã có switcher trong sidebar, nhưng có thể thêm selector rõ hơn ngay sau login với user nhiều gia đình.

### 13. Admin/family analytics tách bạch hơn

Hiện `APP_ADMIN` được điều hướng về bề mặt an toàn. Sau này cần tách dashboard hệ thống riêng thay vì dùng chung shell tài chính gia đình.

## DONE (completed 2026-04-30)
- ✅ Replace `console.log` with NestJS `Logger` in auth, permission guard, natural-input, notification services
- ✅ Add `@Index` on `familyId`, `(familyId, status)`, `(familyId, warrantyExpiredAt)` for assets; `familyId`, `(familyId, expenseDate)` for expenses; `familyId` for users; `familyId`, `(familyId, userId)` for notifications
- ✅ Migration `1745971200000-AddIndexesAvatarAndScheduledAt` created for all index + column changes
- ✅ Extract duplicate `computeNextOccurrence()` in `expense.service.ts`; remove `as any` enum casts
- ✅ Wrap family+user creation in `dataSource.transaction()` in `auth.service.ts`
- ✅ Fix auth: each new user now creates their own unique family (was sharing "Default Family")
- ✅ Fix `scheduleNotification`: replaced `setTimeout` with DB-based `scheduledAt` column; `findAll` filters to only show due notifications — survives Vercel cold starts
- ✅ Remove dead `parse()` method from `natural-input.service.ts`; controller already calls `parseWithUser()`
- ✅ Fix asset search `LIKE` → `ILIKE` (PostgreSQL case-insensitive)
- ✅ Save `avatarUrl` from Google OAuth profile to users table; added `avatarUrl` to `User` entity and `generateToken` response
- ✅ Fix Google strategy: properly typed with `Profile` from passport-google-oauth20; added `avatarUrl` and null-safe name concatenation
- ✅ Fix JWT `expiresIn as any` → `|| '7d'` fallback in `auth.module.ts`
- ✅ Replace dynamic `await import('csv-stringify/sync')` with static imports in `asset.service.ts` and `expense.service.ts`
- ✅ Read `OPENAI_MODEL` from config (defaults to `gpt-4o-mini`)
- ✅ Revoke blob URL after CSV download in `AssetList.tsx`
- ✅ Type `OAuthProfile` interface in `auth.service.ts` (remove `profile: any`)
- ✅ Type `contextCache` with `ContextCacheEntry` interface in `natural-input.service.ts`
- ✅ Type `getSystemPrompt` context parameter; `parseAssistantJson` return type; `fillAmountFromUserText` parameter
- ✅ Replace `filters: any` with typed interface in `AssetList.tsx`
- ✅ Fix redundant `UserRole.SYSTEM_ADMIN || 'SYSTEM_ADMIN'` string literal checks in `permission.guard.ts`
- ✅ `customFields: any` → `Record<string, unknown>` in asset and expense entities; `metadata: any` → `Record<string, unknown>` in notification entity
- ✅ Updated `REQUIREMENTS.md` to reflect actual tech stack (PostgreSQL/Vercel, not MySQL/Cloud Run)
- ✅ Updated `AI_HANDOVER.md` with accurate stack table, env var docs, link to TODO.md
- ✅ Created `docs/specs/ARCHITECTURE.md` with full system diagram, DB schema, RBAC flow
- ✅ Cleaned up `server/.env.example`: removed duplicate key, removed real credentials, added `OPENAI_MODEL` doc
- ✅ Fix `MaintenanceScheduler` not registered in `notification.module.ts` — added to providers + `Asset` entity to imports
- ✅ Fix `category.service.ts` `update()` and `delete()` returning `null` → now throw `NotFoundException`
- ✅ Fix `expense.service.ts` `update()` and `delete()` returning `null` → now throw `NotFoundException`
- ✅ Fix `asset.service.ts` `update()` returning `null` silently when asset not found → verify existence first, then throw `NotFoundException`; same for `delete()`
- ✅ Fix `calendar.service.ts` `{ id } as any` participants cast → typed as `User`
- ✅ Add `isError` state to `Dashboard.tsx`, `AssetList.tsx`, `CategoryList.tsx`, `ExpenseList.tsx`
- ✅ Standardize `web/src/api/calendar.ts` — remove internal `.data` unwrapping to match all other API modules; update `CalendarPage.tsx` usages
- ✅ Fix `ParsedPreviewModal.tsx` — respect `entryType` and `isTransfer` from AI response instead of always deriving from intent
- ✅ Updated REQUIREMENTS.md: `ExpenseEntryType`, `isTransfer`, mô hình danh mục 2 cấp (không còn `CategoryType` trên danh mục), DB-backed notifications, avatarUrl auto-provisioning
- ✅ Updated `AI_HANDOVER.md`: notification implementation, OpenAI model config, known issues trimmed to actual remaining debt
- ✅ Fix `category.service.ts` `update()` TypeORM FK bug — switched from `save()` to `repository.update()` to fix parent change not reflecting in tree
- ✅ Add `PATCH /auth/me` endpoint (no permission guard) for self-profile update; fix Settings page profile save for MEMBER role
- ✅ Add Settings page family info card: show name/status, allow FAMILY_ADMIN to rename family via `PATCH /family`
- ✅ Create `web/src/api/family.ts` with `getMyFamily` and `updateMyFamily`
- ✅ Quyết định business đã được chốt: danh mục dùng chung toàn project, tối đa 2 cấp, asset/transaction không bắt buộc chọn danh mục con
- ✅ Loại bỏ `LIABILITY` khỏi transaction domain; `Nợ` chỉ còn là nghiệp vụ trong module `Bảo trì khai thác và nợ`
- ✅ Loại bỏ recurring transaction khỏi backend/frontend domain hiện tại
- ✅ Đồng bộ lịch hai chiều giữa `Calendar` và `Bảo trì khai thác và nợ`
