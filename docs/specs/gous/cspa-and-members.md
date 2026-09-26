# Thành Viên Hồ Sơ & Thuật Toán Tính Tuổi CSPA (Beneficiaries & CSPA Engine Spec)

Tài liệu đặc tả chi tiết cấu trúc thành viên thụ hưởng trong hồ sơ F4, căn cứ pháp lý của Đạo luật Bảo vệ Tình trạng Con cái (Child Status Protection Act - CSPA), công thức toán học và cơ chế tự động hóa trong hệ thống.

---

## 1. Cấu Trúc Thành Viên Trong Hồ Sơ F4 (Beneficiary Roles)

Mỗi hồ sơ F4 bao gồm:
1. **Đương đơn chính (Principal Applicant):** Anh/Chị/Em ruột của Công dân Mỹ (chủ gia đình).
2. **Người phụ thuộc đi kèm (Derivative Beneficiaries):**
   - **Vợ / Chồng hợp pháp (Spouse):** Đã đăng ký kết hôn hợp pháp trước ngày phỏng vấn/nhập cảnh.
   - **Con cái độc thân dưới 21 tuổi (Unmarried Children under 21):** Được bảo vệ hoặc tính toán tuổi theo Đạo luật CSPA.

---

## 2. Căn Cứ Pháp Lý & Thuật Toán CSPA

### 2.1 Căn Cứ Luật Di Trú Hoa Kỳ
- Đạo luật CSPA (Public Law 107-208, có hiệu lực từ ngày 06/08/2002).
- Hướng dẫn của Bộ Ngoại Giao Hoa Kỳ (Foreign Affairs Manual - 9 FAM 502.1-1(D)) và Sổ tay Chính sách USCIS (USCIS Policy Manual Volume 7, Part A, Chapter 7).

### 2.2 Công Thức Toán Học Chuẩn CSPA Diện Ưu Tiên Gia Đình (F4)

$$\text{Thời Gian I-130 Chờ Duyệt (Pending Time)} = \text{Approval Date (I-797)} - \text{Priority Date (PD)}$$

$$\text{Tuổi Thực Tế Tại Thời Điểm Visa Đáo Hạn} = \text{Visa Available Date} - \text{Date of Birth (DOB)}$$

$$\text{Tuổi CSPA (CSPA Age)} = \text{Tuổi Thực Tế} - \text{Thời Gian Chờ Duyệt}$$

```text
Ví dụ thực tế:
- Ngày sinh con (DOB): 15/06/2004
- Ngày ưu tiên (PD): 10/01/2010
- Ngày chấp thuận (Approval): 10/01/2014 (Thời gian chờ duyệt = đúng 4 năm)
- Ngày Visa đáo hạn / Xét duyệt: 15/06/2026 (Tuổi thực tế = 22.0 tuổi)
-> Tuổi CSPA = 22.0 - 4.0 = 18.0 tuổi (< 21 tuổi)
=> KẾT LUẬN: ĐỦ ĐIỀU KIỆN ĐI CÙNG CHA MẸ THEO DIỆN F4!
```

---

## 3. Ba Trạng Thái Đánh Giá Tuổi CSPA Trong Hệ Thống

| Trạng Thái | Điều Kiện | Ý Nghĩa Pháp Lý & Hành Động Cần Làm |
| :--- | :--- | :--- |
| **`SAFE` (An toàn)** | $\text{Tuổi CSPA} < 20.5$ | Con chắc chắn đủ điều kiện đi cùng hồ sơ. Phải giữ tình trạng độc thân cho đến khi nhập cảnh Mỹ. |
| **`WARNING` (Nguy cơ)** | $20.5 \le \text{Tuổi CSPA} < 21.0$ | Sát ngưỡng 21 tuổi! Cần nộp ngay đơn DS-260 và đóng phí IV để "khóa tuổi" theo quy tắc *Seek to Acquire*. |
| **`AGED_OUT` (Quá tuổi)** | $\text{Tuổi CSPA} \ge 21.0$ | Con bị quá tuổi theo luật. Không được đi cùng cha mẹ. Sau khi cha mẹ sang Mỹ nhận Thẻ Xanh, cha mẹ sẽ mở hồ sơ bảo lãnh riêng diện **F2B** (Con độc thân trên 21 tuổi của Thường trú nhân). |

---

## 4. Quy Tắc Pháp Lý "Seek to Acquire" (Khóa Tuổi CSPA)

> [!IMPORTANT]
> - Theo luật CSPA, đương đơn con **PHẢI** thực hiện hành động chính thức nộp hồ sơ xin thị thực (Seek to Acquire) trong vòng **1 NĂM (12 tháng)** kể từ ngày Visa chính thức có hiệu lực (Visa Availability Date).
> - Hành động đáp ứng "Seek to Acquire" bao gồm:
>   1. Đóng phí xử lý thị thực di dân (IV Fee $345) trên cổng CEAC.
>   2. Hoàn tất nộp đơn DS-260 trực tuyến.
> - Nếu quá 1 năm mà không có hành động, quyền lợi giữ tuổi CSPA sẽ bị mất vĩnh viễn!

---

## 5. Liên Kết Mã Nguồn (Specs:Code 1:1 Mapping)

| Thành Phần Đặc Tả | Backend Source File | Frontend Source File |
| :--- | :--- | :--- |
| **Entity GoUsMember** | [`gous-member.entity.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/common/entities/gous-member.entity.ts) | [`api/gous.ts`](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/api/gous.ts#L30-L45) |
| **Thuật toán CSPA Engine** | [`gous.service.ts` (`calculateCspa`)](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/gous.service.ts#L225-L290) | [`GoUsPortal.tsx` (`handleCalculateCspa`)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/pages/GoUsPortal.tsx#L245-L265) |
| **Tự động Recalculate CSPA** | [`gous.service.ts` (`recalculateAllMembersCspa`)](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/gous.service.ts#L295-L310) | Tự động kích hoạt khi cập nhật `priorityDate` hoặc `approvalDate` |
| **Máy tính CSPA UI Modal** | [`gous.controller.ts` (`POST /gous/cspa/calculate`)](file:///d:/Hoa%20Hoang/Apps/family-management/server/src/modules/gous/gous.controller.ts#L43-L47) | [`GoUsPortal.tsx` (CSPA Modal & Result Card)](file:///d:/Hoa%20Hoang/Apps/family-management/web/src/pages/GoUsPortal.tsx#L960-L1050) |
