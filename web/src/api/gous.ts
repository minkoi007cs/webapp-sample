import api from './client';

export type GoUsStage =
  | 'USCIS_PETITION'
  | 'NVC_CASE_CREATION'
  | 'NVC_FEES'
  | 'DS260_CIVIL_DOCS'
  | 'NVC_DQ'
  | 'INTERVIEW_LETTER'
  | 'MEDICAL_VACCINATION'
  | 'INTERVIEW_PREP'
  | 'INTERVIEW_CONSULATE'
  | 'VISA_ISSUED_USCIS_FEE'
  | 'FLIGHT_AND_POE';

export type MemberRoleInCase = 'PRINCIPAL' | 'SPOUSE' | 'CHILD';
export type ProcessStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'ISSUED' | 'PENDING_221G' | 'NOT_APPLICABLE';
export type DocumentCategory = 'CIVIL_IDENTITY' | 'FINANCIAL_SUPPORT' | 'RELATIONSHIP_PROOF' | 'MEDICAL_VACCINE' | 'INTERVIEW_TRAVEL' | 'OTHER';
export type DocumentStatus = 'NOT_PREPARED' | 'ORIGINAL_OBTAINED' | 'TRANSLATED_NOTARIZED' | 'SUBMITTED_NVC' | 'READY_FOR_INTERVIEW' | 'EXPIRED';
export type TaskPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';
export type ExpenseCategory = 'NVC_GOVERNMENT_FEE' | 'MEDICAL_AND_VACCINE' | 'CIVIL_AND_LEGAL_DOCS' | 'USCIS_IMMIGRANT_FEE' | 'FLIGHT_AND_LOGISTICS' | 'SETTLEMENT_FUNDS' | 'OTHER';
export type ExpensePaymentStatus = 'ESTIMATED' | 'PAID' | 'UNPAID';

export interface GoUsCase {
  id: string;
  familyId: string;
  visaCategory: string;
  caseNumber?: string;
  invoiceId?: string;
  receiptNumber?: string;
  priorityDate?: string;
  approvalDate?: string;
  currentStage: GoUsStage;
  petitionerName?: string;
  petitionerRelationship?: string;
  petitionerAddress?: string;
  petitionerPhone?: string;
  petitionerEmail?: string;
  principalApplicantName?: string;
  jointSponsorInfo?: string;
  interviewDate?: string;
  interviewLocation?: string;
  medicalExamDate?: string;
  vaccinationDate?: string;
  intendedDepartureDate?: string;
  portOfEntry?: string;
  destinationAddress?: string;
  notes?: string;
  members?: GoUsMember[];
  documents?: GoUsDocument[];
  tasks?: GoUsTask[];
  expenses?: GoUsExpense[];
}

export interface GoUsMember {
  id: string;
  caseId: string;
  fullName: string;
  roleInCase: MemberRoleInCase;
  dob?: string;
  gender?: string;
  passportNumber?: string;
  passportExpiry?: string;
  ds260ConfirmationNumber?: string;
  ds260Status: ProcessStatus;
  policeCertStatus: ProcessStatus;
  policeCertIssueDate?: string;
  medicalStatus: ProcessStatus;
  visaStatus: ProcessStatus;
  uscisFeePaid: boolean;
  cspaAge?: number;
  cspaStatus?: 'SAFE' | 'WARNING' | 'AGED_OUT' | 'NOT_APPLICABLE';
  notes?: string;
}

export interface GoUsDocument {
  id: string;
  caseId: string;
  memberId?: string;
  member?: GoUsMember;
  category: DocumentCategory;
  title: string;
  description?: string;
  isRequired: boolean;
  status: DocumentStatus;
  issueDate?: string;
  expiryDate?: string;
  fileUrl?: string;
  fileUrls?: string[];
  expertNotes?: string;
}

export interface GoUsTask {
  id: string;
  caseId: string;
  stage: GoUsStage;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  assignedTo?: string;
  isSystemSuggested: boolean;
  expertTips?: string;
}

export interface GoUsExpense {
  id: string;
  caseId: string;
  category: ExpenseCategory;
  title: string;
  currency: string;
  estimatedAmount: number;
  actualAmount: number;
  status: ExpensePaymentStatus;
  paymentDate?: string;
  payer?: string;
  notes?: string;
}

export interface CspaResult {
  actualAgeAtVisaAvailability: number;
  i130PendingDays: number;
  i130PendingYears: number;
  cspaAge: number;
  cspaStatus: 'SAFE' | 'WARNING' | 'AGED_OUT';
  message: string;
  recommendations: string[];
}

export interface GoUsOverviewStats {
  caseInfo: GoUsCase;
  totalMembers: number;
  agedOutCount: number;
  warningCspaCount: number;
  docProgress: {
    total: number;
    ready: number;
    percentage: number;
  };
  taskProgress: {
    total: number;
    done: number;
    urgentCount: number;
    percentage: number;
  };
  financialSummary: {
    totalEstimatedUsd: number;
    totalPaidUsd: number;
    totalEstimatedVnd: number;
    totalPaidVnd: number;
  };
}

export const gousApi = {
  getCase: () => api.get<GoUsCase>('/gous/case'),
  updateCase: (data: Partial<GoUsCase>) => api.put<GoUsCase>('/gous/case', data),
  getStats: () => api.get<GoUsOverviewStats>('/gous/stats'),
  calculateCspa: (data: { dob: string; priorityDate: string; approvalDate: string; visaAvailableDate?: string }) =>
    api.post<CspaResult>('/gous/cspa/calculate', data),

  // Members
  getMembers: () => api.get<GoUsMember[]>('/gous/members'),
  addMember: (data: Partial<GoUsMember>) => api.post<GoUsMember>('/gous/members', data),
  updateMember: (id: string, data: Partial<GoUsMember>) => api.put<GoUsMember>(`/gous/members/${id}`, data),
  deleteMember: (id: string) => api.delete(`/gous/members/${id}`),

  // Documents
  getDocuments: (category?: DocumentCategory) =>
    api.get<GoUsDocument[]>('/gous/documents', { params: category ? { category } : {} }),
  addDocument: (data: Partial<GoUsDocument>) => api.post<GoUsDocument>('/gous/documents', data),
  updateDocument: (id: string, data: Partial<GoUsDocument>) => api.put<GoUsDocument>(`/gous/documents/${id}`, data),
  deleteDocument: (id: string) => api.delete(`/gous/documents/${id}`),

  // Tasks
  getTasks: (stage?: GoUsStage) => api.get<GoUsTask[]>('/gous/tasks', { params: stage ? { stage } : {} }),
  addTask: (data: Partial<GoUsTask>) => api.post<GoUsTask>('/gous/tasks', data),
  updateTask: (id: string, data: Partial<GoUsTask>) => api.put<GoUsTask>(`/gous/tasks/${id}`, data),
  deleteTask: (id: string) => api.delete(`/gous/tasks/${id}`),

  // Expenses
  getExpenses: () => api.get<GoUsExpense[]>('/gous/expenses'),
  addExpense: (data: Partial<GoUsExpense>) => api.post<GoUsExpense>('/gous/expenses', data),
  updateExpense: (id: string, data: Partial<GoUsExpense>) => api.put<GoUsExpense>(`/gous/expenses/${id}`, data),
  deleteExpense: (id: string) => api.delete(`/gous/expenses/${id}`),
};
