export enum GoUsStage {
  USCIS_PETITION = 'USCIS_PETITION', // Nộp đơn I-130 tại USCIS & Chờ chấp thuận
  NVC_CASE_CREATION = 'NVC_CASE_CREATION', // Chuyển NVC & Cấp Case Number / Invoice ID
  NVC_FEES = 'NVC_FEES', // Đóng phí NVC (AOS $120 & IV $345/người)
  DS260_CIVIL_DOCS = 'DS260_CIVIL_DOCS', // Khai DS-260 & Nộp hồ sơ Dân sự + Bảo trợ I-864
  NVC_DQ = 'NVC_DQ', // NVC xét duyệt & Cấp thư hoàn tất DQ
  INTERVIEW_LETTER = 'INTERVIEW_LETTER', // Nhận thư mời phỏng vấn (P4 Letter)
  MEDICAL_VACCINATION = 'MEDICAL_VACCINATION', // Khám sức khỏe & Chích ngừa
  INTERVIEW_PREP = 'INTERVIEW_PREP', // Đăng ký địa chỉ nhận visa & Chuẩn bị bộ hồ sơ PV
  INTERVIEW_CONSULATE = 'INTERVIEW_CONSULATE', // Tham gia phỏng vấn tại LSQ Hoa Kỳ (TP.HCM)
  VISA_ISSUED_USCIS_FEE = 'VISA_ISSUED_USCIS_FEE', // Nhận visa & Đóng phí thẻ xanh USCIS ($220/người)
  FLIGHT_AND_POE = 'FLIGHT_AND_POE', // Chuẩn bị bay & Nhập cảnh Hoa Kỳ (Port of Entry)
}

export enum MemberRoleInCase {
  PRINCIPAL = 'PRINCIPAL', // Đương đơn chính (Chủ gia đình)
  SPOUSE = 'SPOUSE', // Vợ / Chồng đi kèm
  CHILD = 'CHILD', // Con đi kèm (Cần theo dõi tuổi CSPA)
}

export enum ProcessStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  ISSUED = 'ISSUED',
  PENDING_221G = 'PENDING_221G',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export enum DocumentCategory {
  CIVIL_IDENTITY = 'CIVIL_IDENTITY', // Giấy tờ tùy thân & Dân sự (Khai sinh, Kết hôn, LLTP2...)
  FINANCIAL_SUPPORT = 'FINANCIAL_SUPPORT', // Bảo trợ tài chính I-864 (Thuế 3 năm, W2, Việc làm...)
  RELATIONSHIP_PROOF = 'RELATIONSHIP_PROOF', // Bằng chứng quan hệ huyết thống anh chị em ruột F4
  MEDICAL_VACCINE = 'MEDICAL_VACCINE', // Khám sức khỏe, Phiếu tiêm chủng
  INTERVIEW_TRAVEL = 'INTERVIEW_TRAVEL', // Giấy tờ mang đi phỏng vấn, Đăng ký địa chỉ visa, Vé máy bay
  OTHER = 'OTHER',
}

export enum DocumentStatus {
  NOT_PREPARED = 'NOT_PREPARED', // Chưa chuẩn bị
  ORIGINAL_OBTAINED = 'ORIGINAL_OBTAINED', // Đã có bản gốc
  TRANSLATED_NOTARIZED = 'TRANSLATED_NOTARIZED', // Đã dịch thuật công chứng tiếng Anh
  SUBMITTED_NVC = 'SUBMITTED_NVC', // Đã nộp lên CEAC (NVC)
  READY_FOR_INTERVIEW = 'READY_FOR_INTERVIEW', // Đã sẵn sàng mang đi phỏng vấn
  EXPIRED = 'EXPIRED', // Đã hết hạn (Cần làm lại)
}

export enum TaskPriority {
  URGENT = 'URGENT', // Khẩn cấp (Phải làm ngay)
  HIGH = 'HIGH', // Ưu tiên cao
  MEDIUM = 'MEDIUM', // Trung bình
  LOW = 'LOW', // Thấp
}

export enum TaskStatus {
  TODO = 'TODO', // Chưa làm
  IN_PROGRESS = 'IN_PROGRESS', // Đang thực hiện
  DONE = 'DONE', // Đã hoàn thành
  SKIPPED = 'SKIPPED', // Bỏ qua / Không áp dụng
}

export enum ExpenseCategory {
  NVC_GOVERNMENT_FEE = 'NVC_GOVERNMENT_FEE', // Phí NVC chính phủ (AOS, DS-260)
  MEDICAL_AND_VACCINE = 'MEDICAL_AND_VACCINE', // Khám sức khỏe & Tiêm vắc xin
  CIVIL_AND_LEGAL_DOCS = 'CIVIL_AND_LEGAL_DOCS', // Dịch thuật, công chứng, làm hộ chiếu, LLTP số 2
  USCIS_IMMIGRANT_FEE = 'USCIS_IMMIGRANT_FEE', // Phí cấp thẻ xanh $220/người
  FLIGHT_AND_LOGISTICS = 'FLIGHT_AND_LOGISTICS', // Vé máy bay, hành lý, di chuyển
  SETTLEMENT_FUNDS = 'SETTLEMENT_FUNDS', // Tiền mặt & tài chính mang theo dự phòng
  OTHER = 'OTHER',
}

export enum ExpensePaymentStatus {
  ESTIMATED = 'ESTIMATED', // Mới dự toán
  PAID = 'PAID', // Đã thanh toán
  UNPAID = 'UNPAID', // Cần thanh toán
}
