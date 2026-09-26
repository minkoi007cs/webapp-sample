# GOUS CORE SPECS: Cổng Quản Lý Định Cư Hoa Kỳ Diện F4 (`/gous`)

> **Phiên bản:** 1.0.0  
> **Phân hệ:** Định cư Hoa Kỳ — Diện F4 (Anh/Chị/Em công dân Hoa Kỳ — INA § 203(a)(4))  
> **Mục tiêu:** Hệ thống trung tâm đồng hành, kiểm soát hồ sơ, thủ tục, giấy tờ, nhiệm vụ ưu tiên, chi phí và quản trị rủi ro pháp lý toàn diện từ lúc nhận hồ sơ tại NVC đến ngày đặt chân đến Hoa Kỳ.

---

## 1. Bản Đồ Tư Duy Hệ Thống (GoUS Mind Map Architecture)

```mermaid
mindmap
  root((GOUS CORE SPECS<br/>Portal /gous))
    🌿 Nhánh 1: Lộ Trình 11 Giai Đoạn
      USCIS Petition & Chấp thuận I-797
      NVC Case Number & Invoice ID
      Đóng phí NVC: AOS $120 & IV $345/người
      Khai DS-260 & Nộp Hồ sơ I-864 + Dân sự
      NVC duyệt hoàn tất Documentarily Qualified
      Thư mời phỏng vấn P4 & Lịch hẹn LSQ
      Khám SK tại IOM/Chợ Rẫy & Tiêm chủng Pasteur
      Đăng ký địa chỉ giao visa uvisitdas.com
      Phỏng vấn trực tiếp tại LSQ TP.HCM
      Nhận Visa & Đóng $220 USCIS Immigrant Fee
      Chuẩn bị bay & Nhập cảnh Port of Entry
    🌿 Nhánh 2: Thành Viên & Máy Tính CSPA
      Đương đơn chính Principal Applicant
      Vợ/Chồng đi kèm Derivative Spouse
      Con cái đi kèm Derivative Children
      Thuật toán tính tuổi CSPA chuẩn USCIS
      Cảnh báo An Toàn / Nguy Cơ / Quá Tuổi
      Quy tắc khóa tuổi Seek to Acquire
    🌿 Nhánh 3: Ma Trận Giấy Tờ & Hồ Sơ
      Dân sự & Nhân thân Khai sinh, Hộ chiếu, LLTP2
      Bảo trợ tài chính I-864, Thuế 3 năm IRS, W-2
      Bằng chứng huyết thống Album ảnh, Học bạ cũ
      Khám sức khỏe niêm phong & Phiếu tiêm chủng vàng
      Giấy tờ phỏng vấn DS-260 confirm, P4 Letter
    🌿 Nhánh 4: Lịch Trình & Nhắc Nhở Ưu Tiên
      Phân cấp Khẩn cấp / Cao / Trung bình / Thấp
      Checklist hoàn thành nhanh theo từng bước
      Nhắc nhở hạn chót Due Date & Người phụ trách
      Lời khuyên chuyên môn Expert Tips
    🌿 Nhánh 5: Dự Toán & Chi Phí A-Z
      Phí NVC Chính phủ Mỹ
      Phí Khám sức khỏe & Tiêm chủng
      Phí LLTP số 2 & Dịch thuật công chứng
      Phí Thẻ Xanh USCIS ELIS $220/người
      Vé máy bay & Hạch toán đa tiền tệ USD/VND
    🌿 Nhánh 6: Cẩm Nang Luật Sư & Quản Trị Rủi Ro
      Phòng ngừa Age-out CSPA cho con
      Khắc phục thiếu thu nhập I-864 & Joint Sponsor
      Bí quyết phỏng vấn tại Số 4 Lê Duẩn
      Xử lý Giấy xanh 221g trong hạn 1 năm
      Thủ tục Hải quan CBP tại Port of Entry
```

---

## 2. Cây Tài Liệu Chi Tiết (Branch Documentation Tree)

Từ file trung tâm **`GOUS_CORE_SPECS.md`**, hệ thống phân nhánh thành 6 tài liệu đặc tả chuyên sâu:

- 📖 **Nhánh 1:** [Quy Trình 11 Giai Đoạn Di Trú (Pipeline & Stages Spec)](./pipeline-and-stages.md)
- 📖 **Nhánh 2:** [Thành Viên & Thuật Toán Tính Tuổi CSPA (Beneficiaries & CSPA Engine)](./cspa-and-members.md)
- 📖 **Nhánh 3:** [Ma Trận Danh Mục Hồ Sơ & Giấy Tờ (Documents Matrix Spec)](./documents-matrix.md)
- 📖 **Nhánh 4:** [Kế Hoạch Hành Động & Nhắc Nhở Ưu Tiên (Tasks & Reminders Spec)](./tasks-and-reminders.md)
- 📖 **Nhánh 5:** [Quản Lý Dự Toán & Chi Phí Định Cư F4 (Immigration Financials Spec)](./expenses-and-budget.md)
- 📖 **Nhánh 6:** [Cẩm Nang Luật Sư Di Trú & Quản Trị Rủi Ro (Legal Advisory & Risk Matrix)](./expert-advisory-and-risks.md)

---

## 3. Ma Trận Truy Xuất Nguồn Gốc 1:1 (Specs:Code Traceability Matrix)

Hệ thống cam kết tính toàn vẹn và ánh xạ **1:1 giữa Tài Liệu Đặc Tả và Mã Nguồn Thực Tế**:

| Phân Hệ Nghiệp Vụ | Tài Liệu Đặc Tả (Spec File) | Backend Entity / Service / Controller | Frontend API / Page / Component |
| :--- | :--- | :--- | :--- |
| **0. Core Enums & Schema** | [`GOUS_CORE_SPECS.md`](./GOUS_CORE_SPECS.md) | • [`common/enums/gous.enums.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/common/enums/gous.enums.ts)<br/>• [`migrations/1780000000000-CreateGoUsTablesAndAddEnum.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/migrations/1780000000000-CreateGoUsTablesAndAddEnum.ts) | • [`api/gous.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/api/gous.ts) |
| **1. Case & Pipeline** | [`pipeline-and-stages.md`](./pipeline-and-stages.md) | • [`gous-case.entity.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/common/entities/gous-case.entity.ts)<br/>• [`gous.service.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/gous.service.ts)<br/>• [`gous.controller.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/gous.controller.ts) | • [`api/gous.ts` (`getCase`, `updateCase`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/api/gous.ts)<br/>• [`GoUsPortal.tsx` (`OverviewTab`, `STAGES`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/pages/GoUsPortal.tsx) |
| **2. Members & CSPA** | [`cspa-and-members.md`](./cspa-and-members.md) | • [`gous-member.entity.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/common/entities/gous-member.entity.ts)<br/>• [`gous.service.ts` (`calculateCspa`)](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/gous.service.ts)<br/>• [`dto/cspa.dto.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/dto/cspa.dto.ts) | • [`api/gous.ts` (`calculateCspa`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/api/gous.ts)<br/>• [`GoUsPortal.tsx` (`MembersTab`, `CspaModal`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/pages/GoUsPortal.tsx) |
| **3. Documents Matrix** | [`documents-matrix.md`](./documents-matrix.md) | • [`gous-document.entity.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/common/entities/gous-document.entity.ts)<br/>• [`gous.service.ts` (`seedDefaultF4Roadmap`)](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/gous.service.ts) | • [`api/gous.ts` (`getDocuments`, `addDocument`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/api/gous.ts)<br/>• [`GoUsPortal.tsx` (`DocumentsTab`, `DocModal`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/pages/GoUsPortal.tsx) |
| **4. Tasks & Reminders** | [`tasks-and-reminders.md`](./tasks-and-reminders.md) | • [`gous-task.entity.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/common/entities/gous-task.entity.ts)<br/>• [`dto/task.dto.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/dto/task.dto.ts) | • [`api/gous.ts` (`getTasks`, `updateTask`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/api/gous.ts)<br/>• [`GoUsPortal.tsx` (`TasksTab`, `TaskModal`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/pages/GoUsPortal.tsx) |
| **5. Expenses & Budget** | [`expenses-and-budget.md`](./expenses-and-budget.md) | • [`gous-expense.entity.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/common/entities/gous-expense.entity.ts)<br/>• [`dto/expense.dto.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/dto/expense.dto.ts) | • [`api/gous.ts` (`getExpenses`, `addExpense`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/api/gous.ts)<br/>• [`GoUsPortal.tsx` (`ExpensesTab`, `ExpenseModal`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/pages/GoUsPortal.tsx) |
| **6. Legal Advisory** | [`expert-advisory-and-risks.md`](./expert-advisory-and-risks.md) | • [`gous.service.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/gous.service.ts)<br/>• Khởi tạo sẵn các tips nghiệp vụ | • [`GoUsPortal.tsx` (`ExpertGuidelinesTab`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/pages/GoUsPortal.tsx) |
| **7. Multi-Family Lifecycle** | [`ARCHITECTURE.md`](../ARCHITECTURE.md) | • [`auth.service.ts` (`createNewFamily`)](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/auth/auth.service.ts)<br/>• [`admin.service.ts` (`createFamilyByAdmin`, `deleteFamily`, `removeMemberFromFamily`)](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/admin/admin.service.ts)<br/>• [`family.service.ts` (`update`, `deleteFamily`)](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/family/family.service.ts) | • [`Sidebar.tsx` (`+ Tạo mới`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/components/layout/Sidebar.tsx)<br/>• [`AdminPanel.tsx` (`Sửa/Xóa gia đình`, `Gán/Gỡ thành viên`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/pages/AdminPanel.tsx)<br/>• [`Settings.tsx` (`Sửa/Xóa gia đình`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/pages/Settings.tsx) |

---

## 4. Mô Hình Đa Gia Đình & Quản Trị Hệ Thống (Multi-Family Tenancy & RBAC)

1. **1 Gia Đình = 1 Hồ Sơ F4 Duy Nhất (`familyId` Unique):** Dữ liệu hồ sơ định cư được cách ly hoàn toàn theo không gian gia đình đang hoạt động (`familyId`).
2. **Khởi tạo gia đình:**
   - **Tự động:** Khi tài khoản Google đăng nhập lần đầu tiên chưa có gia đình, hệ thống tự động khởi tạo `{Tên}'s Family`.
   - **Người dùng tự tạo:** Thông qua nút `+ Tạo mới` trên Sidebar (`POST /auth/create-family`), người tạo trở thành `FAMILY_ADMIN`.
   - **Quản trị hệ thống (`APP_ADMIN`):** Thông qua trang `/admin` (`POST /admin/families`), có thể tạo gia đình và trực tiếp chỉ định Chủ hộ / Quản trị viên (`FAMILY_ADMIN`).
   - **Gán thành viên (`APP_ADMIN`):** Thông qua modal trên `/admin` (`POST /admin/families/:familyId/members`), có thể gán bất kỳ người dùng nào vào bất kỳ gia đình nào.
3. **Sửa & Xóa gia đình (Family Modification & Deletion Lifecycle):**
   - **Sửa tên gia đình:** Cả `FAMILY_ADMIN` (tại `/settings`) và `APP_ADMIN` (tại `/admin`) đều có thể đổi tên gia đình.
   - **Xóa gia đình:** 
     - **Điều kiện an toàn:** Chỉ cho phép xóa khi gia đình **không còn thành viên nào** (đối với `APP_ADMIN` tại `/admin`) hoặc **chỉ còn duy nhất 1 mình chủ hộ** (đối với `FAMILY_ADMIN` tại `/settings`).
     - **Chặn xóa khi còn thành viên:** Nếu gia đình còn thành viên, hệ thống chủ động khóa nút và thông báo lỗi rõ ràng bằng tiếng Việt yêu cầu gỡ thành viên trước.
     - **Dọn dẹp sạch (Cascade Cleanup):** Khi xóa gia đình, hệ thống dọn dẹp sạch sẽ toàn bộ các bản ghi phụ thuộc (`family_users`, `invites`, `categories`, `expenses`, `assets`, `calendar_events`, `gous_cases`).
   - **Gỡ thành viên:** Admin có thể gỡ thành viên khỏi gia đình (`DELETE /admin/families/:familyId/members/:userId`), hệ thống tự động cập nhật lại `lastActiveFamilyId` cho người dùng đó.
4. **Phân quyền RBAC:** Cả `FAMILY_ADMIN`, `MEMBER`, và `APP_ADMIN` đều được cấu hình quyền đầy đủ để truy cập và cộng tác trong module `GOUS`.
5. **Tiêu chuẩn UI:** Tuyệt đối không hiển thị thông tin kỹ thuật nội bộ (UUIDs, ID cơ sở dữ liệu thô, stack traces) trên giao diện người dùng.
