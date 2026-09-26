# Quản Lý Dự Toán & Chi Phí Định Cư F4 (Immigration Financials Spec)

Tài liệu đặc tả toàn bộ các danh mục chi phí định cư từ giai đoạn NVC đến khi đặt chân đến Mỹ, hạch toán đa tiền tệ (USD và VNĐ), phân loại đối tượng chi trả và thống kê tài chính.

---

## 1. Bảng Kê Chi Phí Chuẩn Xác Thực Tế Diện F4

| Khoản Chi Phí | Nhóm Mục (`ExpenseCategory`) | Đơn Vị Tính | Mức Tiền Dự Kiến (Tham Khảo) | Người Chi Trả Thường Thấy |
| :--- | :--- | :--- | :--- | :--- |
| **Phí hồ sơ bảo trợ tài chính AOS** | `NVC_GOVERNMENT_FEE` | USD | **$120** (1 lần/case) | Người bảo lãnh tại Mỹ |
| **Phí xét duyệt thị thực di dân IV Fee** | `NVC_GOVERNMENT_FEE` | USD | **$345 / người** | Người bảo lãnh tại Mỹ |
| **Phí khám sức khỏe xuất cảnh** | `MEDICAL_AND_VACCINE` | USD | **~$240 - $275 / người lớn**<br/>(Trẻ em: ~$165 - $240) | Gia đình Việt Nam |
| **Phí tiêm chủng vắc-xin quốc tế** | `MEDICAL_AND_VACCINE` | VND | **~ 1.500.000 - 3.500.000 VNĐ / người** | Gia đình Việt Nam |
| **Phí cấp Lý lịch tư pháp số 2 & Dịch thuật** | `CIVIL_AND_LEGAL_DOCS` | VND | **~ 500.000 - 1.500.000 VNĐ / người** | Gia đình Việt Nam |
| **Phí thẻ xanh USCIS Immigrant Fee** | `USCIS_IMMIGRANT_FEE` | USD | **$220 / người** | Người bảo lãnh hoặc gia đình |
| **Vé máy bay 1 chiều sang Mỹ** | `FLIGHT_AND_LOGISTICS` | USD | **~$800 - $1,200 / vé** | Gia đình Việt Nam |
| **Quỹ tiền mặt mang theo dự phòng** | `SETTLEMENT_FUNDS` | USD | **~$3,000 - $10,000** | Gia đình Việt Nam |

---

## 2. Quy Tắc Kế Toán & Quản Lý Dòng Tiền

1. **Hạch toán 2 luồng tiền tệ độc lập:**
   - `USD`: Các khoản phí chính phủ Mỹ (NVC, USCIS), vé máy bay quốc tế, tiền mang theo.
   - `VND`: Các khoản phí nhà nước Việt Nam (LLTP số 2, tiêm chủng Pasteur, khám sức khỏe BV Chợ Rẫy, dịch thuật công chứng).
2. **Trạng thái thanh toán (`ExpensePaymentStatus`):**
   - `ESTIMATED`: Mới lên dự toán ngân sách.
   - `PAID`: Đã chính thức chi trả (ghi nhận ngày chi và số tiền thực tế).
   - `UNPAID`: Khoản chi bắt buộc đến hạn cần thanh toán ngay.

---

## 3. Liên Kết Mã Nguồn (Specs:Code 1:1 Mapping)

| Thành Phần Đặc Tả | Backend Source File | Frontend Source File |
| :--- | :--- | :--- |
| **Entity GoUsExpense** | [`gous-expense.entity.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/common/entities/gous-expense.entity.ts) | [`api/gous.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/api/gous.ts#L77-L89) |
| **Khởi tạo bảng dự toán mẫu** | [`gous.service.ts` (`seedDefaultF4Roadmap`)](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/gous.service.ts#L535-L620) | [`GoUsPortal.tsx` (ExpensesTab)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/pages/GoUsPortal.tsx#L1725-L1820) |
| **CRUD Expense API** | [`gous.controller.ts` (`/gous/expenses`)](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/gous.controller.ts#L120-L145) | [`GoUsPortal.tsx` (ExpenseModal & Mutation)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/pages/GoUsPortal.tsx#L225-L245) |
