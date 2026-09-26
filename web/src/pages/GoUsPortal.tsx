import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tabs,
  Card,
  Button,
  Tag,
  Progress,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Popconfirm,
  Alert,
  Badge,
  Descriptions,
  Divider,
  Upload,
  Image,
  Popover,
  Tooltip,
} from 'antd';
import {
  PlaneTakeoff,
  FileCheck,
  CheckSquare,
  DollarSign,
  AlertTriangle,
  BookOpen,
  Calendar,
  Users,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Plus,
  Edit2,
  Trash2,
  Calculator,
  Compass,
  UserPlus,
  Sparkles,
  User,
  HeartHandshake,
  UploadCloud,
  Paperclip,
  FileText,
  ExternalLink,
} from 'lucide-react';
import dayjs from 'dayjs';
import {
  gousApi,
  type GoUsCase,
  type GoUsMember,
  type GoUsDocument,
  type GoUsTask,
  type GoUsExpense,
  type GoUsStage,
  type DocumentCategory,
  type TaskStatus,
  type CspaResult,
} from '../api/gous';
import { filesApi } from '../api/files';

import { useSession } from '../components/auth/SessionProvider';

// ================= HELPERS: AUTO GENERATE DOCUMENT TITLE FROM FILE NAME =================
function cleanFileNameToTitle(fileName: string, fallback = 'Attached Document'): string {
  if (!fileName) return fallback;
  const withoutExt = fileName.replace(/\.[^/.]+$/, '').trim();
  if (!withoutExt) return fallback;
  const cleaned = withoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : fallback;
}

// ================= SHARED: DOCUMENT FILE UPLOADER =================
// Shared across Add/Edit Document Modal and Member Attachments Modal (supports multiple images / PDFs)
function DocumentFileUploader({
  value,
  onChange,
  onAutoTitle,
}: {
  value?: string | string[];
  onChange?: (urls?: string[] | string) => void;
  onAutoTitle?: (suggestedTitle: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const fileList: string[] = useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return [value].filter(Boolean);
  }, [value]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await filesApi.upload(file, 'gous-documents');
      const nextUrls = [...fileList, res.data.url];
      onChange?.(nextUrls);
      onAutoTitle?.(cleanFileNameToTitle(file.name));
      message.success(`Uploaded "${file.name}" successfully`);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (urlToRemove: string) => {
    const nextUrls = fileList.filter((u) => u !== urlToRemove);
    onChange?.(nextUrls.length > 0 ? nextUrls : undefined);
  };

  return (
    <div className="space-y-3">
      {fileList.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600">Attached ({fileList.length} files):</span>
          <Image.PreviewGroup>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {fileList.map((url, idx) => {
                const isImg = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || url.includes('/images/');
                return (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {isImg ? (
                        <Image src={url} width={36} height={36} className="rounded-lg object-cover border border-slate-200" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                          <FileText size={18} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium truncate block hover:underline" title={url}>
                          File #{idx + 1}
                        </a>
                        <span className="text-[11px] text-slate-500">{isImg ? 'Image' : 'PDF Document'}</span>
                      </div>
                    </div>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<Trash2 size={13} />}
                      onClick={() => handleRemove(url)}
                      title="Remove this file"
                    />
                  </div>
                );
              })}
            </div>
          </Image.PreviewGroup>
        </div>
      )}
      <Upload
        accept="image/*,application/pdf"
        multiple
        showUploadList={false}
        beforeUpload={(file) => { handleUpload(file); return false; }}
      >
        <Button icon={<UploadCloud size={14} />} loading={uploading}>
          {fileList.length > 0 ? 'Upload More Images or PDFs' : 'Upload Image or PDF'}
        </Button>
      </Upload>
    </div>
  );
}

// Quick upload documents matched by title
const QUICK_DOC_TITLES = new Set([
  'Hộ chiếu',
  'Giấy khai sinh',
  'Lý lịch tư pháp số 2',
  'Giấy khám sức khỏe',
  'Passport',
  'Birth Certificate',
  'Police Certificate (Form 2)',
  'Police Certificate #2',
  'Medical Examination',
]);

// Quick upload icon placed next to relevant fields (Passport, Birth Certificate...)
function QuickDocUploadIcon({
  memberId,
  title,
  category,
  documents,
}: {
  memberId?: string;
  title: string;
  category: DocumentCategory;
  documents: GoUsDocument[];
}) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const existing = documents.find(
    (d) =>
      d.memberId === memberId &&
      (d.title === title ||
        (title === 'Passport' && (d.title === 'Passport' || d.title === 'Hộ chiếu')) ||
        (title === 'Birth Certificate' && (d.title === 'Birth Certificate' || d.title === 'Giấy khai sinh')) ||
        (title === 'Police Certificate (Form 2)' && (d.title === 'Police Certificate (Form 2)' || d.title === 'Police Certificate #2' || d.title === 'Lý lịch tư pháp số 2')) ||
        (title === 'Medical Examination' && (d.title === 'Medical Examination' || d.title === 'Giấy khám sức khỏe')))
  );

  const fileList = useMemo(() => {
    if (!existing) return [];
    if (existing.fileUrls && existing.fileUrls.length > 0) return existing.fileUrls;
    if (existing.fileUrl) return [existing.fileUrl];
    return [];
  }, [existing]);

  if (!memberId) {
    return (
      <Tooltip title="Save applicant first before attaching documents">
        <Paperclip size={14} className="text-slate-300" />
      </Tooltip>
    );
  }

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data } = await filesApi.upload(file, 'gous-documents');
      if (existing) {
        const nextUrls = [...fileList, data.url];
        await gousApi.updateDocument(existing.id, {
          title: existing.title,
          fileUrls: nextUrls,
          fileUrl: nextUrls[0],
        });
      } else {
        await gousApi.addDocument({
          memberId,
          title,
          category,
          status: 'ORIGINAL_OBTAINED',
          isRequired: true,
          fileUrls: [data.url],
          fileUrl: data.url,
        });
      }
      message.success(`Uploaded file for "${title}" successfully`);
      queryClient.invalidateQueries({ queryKey: ['gous-documents'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    } catch (err: any) {
      message.error(err?.response?.data?.message || `Failed to upload "${title}". Please try again.`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (urlToDelete: string) => {
    if (!existing) return;
    try {
      const nextUrls = fileList.filter((u) => u !== urlToDelete);
      await gousApi.updateDocument(existing.id, {
        title: existing.title,
        fileUrls: nextUrls,
        fileUrl: nextUrls[0] || undefined,
      });
      message.success('Attachment removed');
      queryClient.invalidateQueries({ queryKey: ['gous-documents'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    } catch (err: any) {
      message.error('Failed to remove attachment');
    }
  };

  return (
    <span className="flex items-center gap-1.5">
      {fileList.length > 0 && (
        <Popover
          trigger="click"
          placement="bottom"
          title={<span className="font-bold text-xs text-slate-800">Files for {title} ({fileList.length})</span>}
          content={
            <div className="space-y-2 w-64 max-h-60 overflow-y-auto pt-1">
              <Image.PreviewGroup>
                {fileList.map((url, idx) => {
                  const isImg = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || url.includes('/images/');
                  return (
                    <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded-lg border border-slate-100 bg-slate-50 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {isImg ? (
                          <Image src={url} width={28} height={28} className="rounded object-cover border border-slate-200" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                            <FileText size={14} />
                          </div>
                        )}
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 truncate max-w-[130px]" title={url}>
                          {title} #{idx + 1}
                        </a>
                      </div>
                      <Popconfirm
                        title="Delete this attachment?"
                        onConfirm={() => handleDeleteFile(url)}
                        okText="Delete"
                        cancelText="Cancel"
                      >
                        <Button type="text" size="small" danger icon={<Trash2 size={12} />} className="!p-0 !h-5 !w-5" />
                      </Popconfirm>
                    </div>
                  );
                })}
              </Image.PreviewGroup>
            </div>
          }
        >
          <Tag color="success" className="m-0 text-[11px] cursor-pointer flex items-center gap-1 hover:opacity-80">
            <Paperclip size={11} /> {fileList.length} files
          </Tag>
        </Popover>
      )}
      <Upload
        accept="image/*,application/pdf"
        multiple
        showUploadList={false}
        beforeUpload={(file) => {
          handleUpload(file);
          return false;
        }}
      >
        <Button
          type="text"
          size="small"
          className="!p-0 !h-auto !w-auto !min-w-0 flex items-center"
          icon={<UploadCloud size={14} className={fileList.length > 0 ? 'text-slate-500 hover:text-blue-600' : 'text-rose-500 hover:text-rose-600'} />}
          loading={uploading}
          title={fileList.length > 0 ? `Add more files for ${title}` : `Upload ${title}`}
        />
      </Upload>
    </span>
  );
}

// Field label with quick upload icon
function FieldLabelWithUpload({
  text,
  docTitle,
  category,
  memberId,
  documents,
}: {
  text: string;
  docTitle: string;
  category: DocumentCategory;
  memberId?: string;
  documents: GoUsDocument[];
}) {
  return (
    <div className="flex items-center justify-between w-full gap-2">
      <span>{text}</span>
      <QuickDocUploadIcon memberId={memberId} title={docTitle} category={category} documents={documents} />
    </div>
  );
}

const { Option } = Select;
const { TextArea } = Input;

// ================= STAGE DEFINITIONS & METADATA =================
const STAGES: Array<{ key: GoUsStage; label: string; step: number; desc: string }> = [
  { key: 'USCIS_PETITION', label: 'I-130 Petition at USCIS', step: 1, desc: 'File petition and await USCIS Approval Notice (Form I-797)' },
  { key: 'NVC_CASE_CREATION', label: 'NVC Transfer & Case Creation', step: 2, desc: 'NVC assigns Case Number (HCM...) and Invoice ID' },
  { key: 'NVC_FEES', label: 'Pay NVC Fees', step: 3, desc: 'Pay AOS Fee ($120) & Immigrant Visa IV Fee ($345/person)' },
  { key: 'DS260_CIVIL_DOCS', label: 'File DS-260 & Civil Docs', step: 4, desc: 'Submit DS-260, Civil Documents & Form I-864 Affidavit of Support' },
  { key: 'NVC_DQ', label: 'Documentarily Qualified (DQ)', step: 5, desc: 'Receive Documentarily Qualified (DQ) Notice from NVC' },
  { key: 'INTERVIEW_LETTER', label: 'Interview Letter (P4)', step: 6, desc: 'Receive official interview appointment from U.S. Consulate' },
  { key: 'MEDICAL_VACCINATION', label: 'Medical & Vaccinations', step: 7, desc: 'Panel physician exam (IOM/Cho Ray) & Vaccines (Pasteur)' },
  { key: 'INTERVIEW_PREP', label: 'Interview Preparation', step: 8, desc: 'Register courier address & assemble interview document packet' },
  { key: 'INTERVIEW_CONSULATE', label: 'Consulate Interview (HCMC)', step: 9, desc: 'Attend in-person interview at 4 Le Duan, Dist. 1, HCMC' },
  { key: 'VISA_ISSUED_USCIS_FEE', label: 'Visa Issued & USCIS Immigrant Fee', step: 10, desc: 'Receive visa stamped passport & pay $220 USCIS immigrant fee' },
  { key: 'FLIGHT_AND_POE', label: 'Flight & U.S. Port of Entry', step: 11, desc: 'Book flight, pack luggage, and clear U.S. Customs & Border (POE)' },
];

const DOCUMENT_CATEGORIES: Array<{ key: DocumentCategory; label: string }> = [
  { key: 'CIVIL_IDENTITY', label: 'Civil & Identity Documents' },
  { key: 'FINANCIAL_SUPPORT', label: 'Financial Support (I-864)' },
  { key: 'RELATIONSHIP_PROOF', label: 'Relationship Proof (F4)' },
  { key: 'MEDICAL_VACCINE', label: 'Medical & Vaccinations' },
  { key: 'INTERVIEW_TRAVEL', label: 'Interview & Travel' },
  { key: 'OTHER', label: 'Other' },
];

export function GoUsPortal() {
  const queryClient = useQueryClient();
  const { activeFamilyId, memberships, switchFamily } = useSession();
  const [activeTab, setActiveTab] = useState('overview');

  // Modals state
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<GoUsMember | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<GoUsDocument | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<GoUsTask | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<GoUsExpense | null>(null);
  const [isCspaModalOpen, setIsCspaModalOpen] = useState(false);

  // Filters
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('ALL');
  const [taskStageFilter, setTaskStageFilter] = useState<string>('ALL');

  // Forms
  const [caseForm] = Form.useForm();
  const [memberForm] = Form.useForm();
  const [docForm] = Form.useForm();
  const [taskForm] = Form.useForm();
  const [expenseForm] = Form.useForm();
  const [cspaForm] = Form.useForm();

  // Queries
  const {
    data: caseData,
    isLoading: isCaseLoading,
    isError: isCaseError,
    error: caseError,
    refetch: refetchCase,
  } = useQuery({
    queryKey: ['gous-case', activeFamilyId],
    enabled: Boolean(activeFamilyId),
    queryFn: async () => (await gousApi.getCase()).data,
  });

  const {
    data: statsData,
    isLoading: isStatsLoading,
    isError: isStatsError,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['gous-stats', activeFamilyId],
    enabled: Boolean(activeFamilyId),
    queryFn: async () => (await gousApi.getStats()).data,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['gous-members', activeFamilyId],
    enabled: Boolean(activeFamilyId),
    queryFn: async () => (await gousApi.getMembers()).data,
  });

  const { data: allDocuments = [] } = useQuery({
    queryKey: ['gous-documents', activeFamilyId],
    enabled: Boolean(activeFamilyId),
    queryFn: async () => (await gousApi.getDocuments()).data,
  });

  const documents = useMemo(() => {
    if (docCategoryFilter === 'ALL') return allDocuments;
    return allDocuments.filter((d) => d.category === docCategoryFilter);
  }, [allDocuments, docCategoryFilter]);

  const allMemberAttachments = useMemo(() => {
    if (!editingMember) return [];
    const items: Array<{
      docId: string;
      docTitle: string;
      category: DocumentCategory;
      categoryLabel: string;
      url: string;
      index: number;
      totalInDoc: number;
    }> = [];
    allDocuments
      .filter((d) => d.memberId === editingMember.id)
      .forEach((doc) => {
        const urls = doc.fileUrls && doc.fileUrls.length > 0 ? doc.fileUrls : (doc.fileUrl ? [doc.fileUrl] : []);
        const catObj = DOCUMENT_CATEGORIES.find((c) => c.key === doc.category);
        const categoryLabel = catObj?.label || 'Civil & Identity Documents';
        urls.forEach((url, idx) => {
          items.push({
            docId: doc.id,
            docTitle: doc.title,
            category: doc.category,
            categoryLabel,
            url,
            index: idx,
            totalInDoc: urls.length,
          });
        });
      });
    return items;
  }, [allDocuments, editingMember]);

  const { data: tasks = [] } = useQuery({
    queryKey: ['gous-tasks', activeFamilyId, taskStageFilter],
    enabled: Boolean(activeFamilyId),
    queryFn: async () =>
      (await gousApi.getTasks(taskStageFilter !== 'ALL' ? (taskStageFilter as GoUsStage) : undefined)).data,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['gous-expenses', activeFamilyId],
    enabled: Boolean(activeFamilyId),
    queryFn: async () => (await gousApi.getExpenses()).data,
  });

  // Mutations
  const updateCaseMutation = useMutation({
    mutationFn: (data: Partial<GoUsCase>) => gousApi.updateCase(data),
    onSuccess: () => {
      message.success('Case details updated successfully');
      queryClient.invalidateQueries({ queryKey: ['gous-case'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
      queryClient.invalidateQueries({ queryKey: ['gous-members'] });
      setIsCaseModalOpen(false);
    },
    onError: () => message.error('Failed to update case details'),
  });

  const saveMemberMutation = useMutation({
    mutationFn: (data: Partial<GoUsMember>) =>
      editingMember ? gousApi.updateMember(editingMember.id, data) : gousApi.addMember(data),
    onSuccess: () => {
      message.success(editingMember ? 'Applicant updated successfully' : 'New applicant added successfully');
      queryClient.invalidateQueries({ queryKey: ['gous-members'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
      setIsMemberModalOpen(false);
      setEditingMember(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'An error occurred while saving applicant information'));
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: (id: string) => gousApi.deleteMember(id),
    onSuccess: () => {
      message.success('Applicant removed from case');
      queryClient.invalidateQueries({ queryKey: ['gous-members'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to remove applicant'));
    },
  });

  const saveDocMutation = useMutation({
    mutationFn: (data: Partial<GoUsDocument>) =>
      editingDoc ? gousApi.updateDocument(editingDoc.id, data) : gousApi.addDocument(data),
    onSuccess: () => {
      message.success(editingDoc ? 'Document updated successfully' : 'Document added successfully');
      queryClient.invalidateQueries({ queryKey: ['gous-documents'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
      setIsDocModalOpen(false);
      setEditingDoc(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'An error occurred while saving document'));
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => gousApi.deleteDocument(id),
    onSuccess: () => {
      message.success('Document deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['gous-documents'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to delete document'));
    },
  });

  const saveTaskMutation = useMutation({
    mutationFn: (data: Partial<GoUsTask>) =>
      editingTask ? gousApi.updateTask(editingTask.id, data) : gousApi.addTask(data),
    onSuccess: () => {
      message.success(editingTask ? 'Task updated successfully' : 'New task added successfully');
      queryClient.invalidateQueries({ queryKey: ['gous-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
      setIsTaskModalOpen(false);
      setEditingTask(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'An error occurred while saving task'));
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => gousApi.deleteTask(id),
    onSuccess: () => {
      message.success('Task deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['gous-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to delete task'));
    },
  });

  const toggleTaskStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      gousApi.updateTask(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gous-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to update status'));
    },
  });

  const saveExpenseMutation = useMutation({
    mutationFn: (data: Partial<GoUsExpense>) =>
      editingExpense ? gousApi.updateExpense(editingExpense.id, data) : gousApi.addExpense(data),
    onSuccess: () => {
      message.success(editingExpense ? 'Expense updated successfully' : 'Expense added successfully');
      queryClient.invalidateQueries({ queryKey: ['gous-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
      setIsExpenseModalOpen(false);
      setEditingExpense(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'An error occurred while saving expense'));
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => gousApi.deleteExpense(id),
    onSuccess: () => {
      message.success('Expense deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['gous-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to delete expense'));
    },
  });

  // CSPA Calculator state
  const [cspaResult, setCspaResult] = useState<CspaResult | null>(null);
  const [isCalculatingCspa, setIsCalculatingCspa] = useState(false);

  const handleCalculateCspa = async (values: any) => {
    try {
      setIsCalculatingCspa(true);
      const res = await gousApi.calculateCspa({
        dob: dayjs(values.dob).format('YYYY-MM-DD'),
        priorityDate: dayjs(values.priorityDate).format('YYYY-MM-DD'),
        approvalDate: dayjs(values.approvalDate).format('YYYY-MM-DD'),
        visaAvailableDate: values.visaAvailableDate ? dayjs(values.visaAvailableDate).format('YYYY-MM-DD') : undefined,
      });
      setCspaResult(res.data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to calculate CSPA. Please verify the dates.');
    } finally {
      setIsCalculatingCspa(false);
    }
  };

  // Helper methods
  const openEditCaseModal = () => {
    if (caseData) {
      caseForm.setFieldsValue({
        visaCategory: caseData.visaCategory,
        caseNumber: caseData.caseNumber,
        invoiceId: caseData.invoiceId,
        receiptNumber: caseData.receiptNumber,
        priorityDate: caseData.priorityDate ? dayjs(caseData.priorityDate) : null,
        approvalDate: caseData.approvalDate ? dayjs(caseData.approvalDate) : null,
        currentStage: caseData.currentStage,
        petitionerName: caseData.petitionerName,
        petitionerRelationship: caseData.petitionerRelationship || 'Sibling (Brother/Sister)',
        petitionerAddress: caseData.petitionerAddress,
        petitionerPhone: caseData.petitionerPhone,
        petitionerEmail: caseData.petitionerEmail,
        principalApplicantName: caseData.principalApplicantName,
        jointSponsorInfo: caseData.jointSponsorInfo,
        interviewDate: caseData.interviewDate ? dayjs(caseData.interviewDate) : null,
        interviewLocation: caseData.interviewLocation || 'U.S. Consulate General in HCMC (4 Le Duan, Dist. 1)',
        medicalExamDate: caseData.medicalExamDate ? dayjs(caseData.medicalExamDate) : null,
        vaccinationDate: caseData.vaccinationDate ? dayjs(caseData.vaccinationDate) : null,
        intendedDepartureDate: caseData.intendedDepartureDate ? dayjs(caseData.intendedDepartureDate) : null,
        portOfEntry: caseData.portOfEntry,
        destinationAddress: caseData.destinationAddress,
        notes: caseData.notes,
      });
    }
    setIsCaseModalOpen(true);
  };

  const openMemberModal = (member?: GoUsMember) => {
    setEditingMember(member || null);
    if (member) {
      memberForm.setFieldsValue({
        fullName: member.fullName,
        roleInCase: member.roleInCase,
        dob: member.dob ? dayjs(member.dob) : null,
        gender: member.gender,
        passportNumber: member.passportNumber,
        passportExpiry: member.passportExpiry ? dayjs(member.passportExpiry) : null,
        ds260ConfirmationNumber: member.ds260ConfirmationNumber,
        ds260Status: member.ds260Status,
        policeCertStatus: member.policeCertStatus,
        policeCertIssueDate: member.policeCertIssueDate ? dayjs(member.policeCertIssueDate) : null,
        medicalStatus: member.medicalStatus,
        visaStatus: member.visaStatus,
        uscisFeePaid: member.uscisFeePaid,
        notes: member.notes,
      });
    } else {
      memberForm.resetFields();
      memberForm.setFieldsValue({
        roleInCase: 'CHILD',
        ds260Status: 'NOT_STARTED',
        policeCertStatus: 'NOT_STARTED',
        medicalStatus: 'NOT_STARTED',
        visaStatus: 'NOT_STARTED',
        uscisFeePaid: false,
      });
    }
    setIsMemberModalOpen(true);
  };

  const openDocModal = (doc?: GoUsDocument, presetMemberId?: string) => {
    setEditingDoc(doc || null);
    if (doc) {
      const urls = doc.fileUrls && doc.fileUrls.length > 0 ? doc.fileUrls : (doc.fileUrl ? [doc.fileUrl] : []);
      docForm.setFieldsValue({
        title: doc.title,
        category: doc.category,
        memberId: doc.memberId,
        description: doc.description,
        isRequired: doc.isRequired,
        status: doc.status,
        issueDate: doc.issueDate ? dayjs(doc.issueDate) : null,
        expiryDate: doc.expiryDate ? dayjs(doc.expiryDate) : null,
        fileUrls: urls,
        fileUrl: doc.fileUrl,
        expertNotes: doc.expertNotes,
      });
    } else {
      docForm.resetFields();
      docForm.setFieldsValue({
        category: 'CIVIL_IDENTITY',
        isRequired: true,
        status: 'NOT_PREPARED',
        memberId: presetMemberId,
        fileUrls: [],
      });
    }
    setIsDocModalOpen(true);
  };

  const openTaskModal = (task?: GoUsTask) => {
    setEditingTask(task || null);
    if (task) {
      taskForm.setFieldsValue({
        title: task.title,
        stage: task.stage,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate ? dayjs(task.dueDate) : null,
        assignedTo: task.assignedTo,
        description: task.description,
        expertTips: task.expertTips,
      });
    } else {
      taskForm.resetFields();
      taskForm.setFieldsValue({
        stage: caseData?.currentStage || 'NVC_CASE_CREATION',
        priority: 'MEDIUM',
        status: 'TODO',
      });
    }
    setIsTaskModalOpen(true);
  };

  const openExpenseModal = (exp?: GoUsExpense) => {
    setEditingExpense(exp || null);
    if (exp) {
      expenseForm.setFieldsValue({
        title: exp.title,
        category: exp.category,
        currency: exp.currency,
        estimatedAmount: exp.estimatedAmount,
        actualAmount: exp.actualAmount,
        status: exp.status,
        paymentDate: exp.paymentDate ? dayjs(exp.paymentDate) : null,
        payer: exp.payer,
        notes: exp.notes,
      });
    } else {
      expenseForm.resetFields();
      expenseForm.setFieldsValue({
        category: 'NVC_GOVERNMENT_FEE',
        currency: 'USD',
        status: 'ESTIMATED',
        payer: 'Petitioner in the U.S.',
      });
    }
    setIsExpenseModalOpen(true);
  };

  const openCspaCalculator = (defaultDob?: string) => {
    cspaForm.setFieldsValue({
      dob: defaultDob ? dayjs(defaultDob) : null,
      priorityDate: caseData?.priorityDate ? dayjs(caseData.priorityDate) : null,
      approvalDate: caseData?.approvalDate ? dayjs(caseData.approvalDate) : null,
      visaAvailableDate: dayjs(),
    });
    setCspaResult(null);
    setIsCspaModalOpen(true);
  };

  const currentStageInfo = useMemo(() => {
    if (!caseData?.currentStage) return STAGES[1];
    return STAGES.find((s) => s.key === caseData.currentStage) || STAGES[1];
  }, [caseData?.currentStage]);

  if (!activeFamilyId) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-md space-y-4">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <PlaneTakeoff size={32} />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Select a Family to Begin</h2>
          <p className="text-xs text-slate-700">
            U.S. F4 immigration cases are managed per family profile. Please select an active family to open the case portal.
          </p>
          {memberships.length > 0 && (
            <div className="space-y-2 pt-2">
              {memberships.map((m) => (
                <Button
                  key={m.familyId}
                  block
                  type="primary"
                  className="!bg-rose-600"
                  onClick={() => switchFamily(m.familyId)}
                >
                  Enter family case: {m.familyName}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isCaseError || isStatsError) {
    const message =
      (caseError as any)?.response?.data?.message ||
      (statsError as any)?.response?.data?.message ||
      'Please try again or contact support if the issue persists.';
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertTriangle size={32} />
        </div>
        <p className="text-base font-semibold text-slate-800">Failed to load U.S. F4 immigration case</p>
        <p className="max-w-md text-xs text-slate-700">{message}</p>
        <Button
          type="primary"
          className="!bg-rose-600"
          onClick={() => {
            refetchCase();
            refetchStats();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (isCaseLoading || isStatsLoading || !caseData) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-700">
        <PlaneTakeoff className="w-10 h-10 text-rose-400 animate-bounce" />
        <p className="text-base font-medium">Loading U.S. F4 immigration case...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1e293b] via-[#243552] to-[#1e3a8a] text-white p-6 sm:p-8 shadow-xl border border-slate-700/50">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <ShieldAlert size={14} /> F4 Category (U.S. Citizen Sibling)
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Compass size={14} /> {currentStageInfo.label} (Step {currentStageInfo.step}/11)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              U.S. F4 Immigration Case Management
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              Comprehensive companion system for your family: track NVC case milestones, interview timeline, document checklist,
              CSPA age calculations, and complete immigration expenses.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="primary"
              icon={<Calculator size={16} />}
              onClick={() => openCspaCalculator()}
              className="!bg-gradient-to-r !from-amber-500 !to-orange-500 !border-none !text-white !font-semibold !shadow-lg hover:!opacity-90"
            >
              Calculate CSPA Age
            </Button>
            <Button
              icon={<Edit2 size={16} />}
              onClick={openEditCaseModal}
              className="!bg-white/10 !border-white/20 !text-white hover:!bg-white/20"
            >
              Update Case Details
            </Button>
          </div>
        </div>

        {/* Quick Highlights Strip */}
        <div className="mt-6 pt-6 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm">
            <p className="text-slate-400 font-medium">NVC Case Number</p>
            <p className="text-sm font-bold text-white mt-0.5">{caseData?.caseNumber || 'Not provided'}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm">
            <p className="text-slate-400 font-medium">Priority Date (PD)</p>
            <p className="text-sm font-bold text-amber-300 mt-0.5">
              {caseData?.priorityDate ? dayjs(caseData.priorityDate).format('DD/MM/YYYY') : 'Not set'}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm">
            <p className="text-slate-400 font-medium">Approval Date (I-797)</p>
            <p className="text-sm font-bold text-emerald-300 mt-0.5">
              {caseData?.approvalDate ? dayjs(caseData.approvalDate).format('DD/MM/YYYY') : 'Not set'}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm">
            <p className="text-slate-400 font-medium">Principal Applicant</p>
            <p className="text-sm font-bold text-white mt-0.5">{caseData?.principalApplicantName || 'Primary Applicant'}</p>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        className="gous-portal-tabs"
        items={[
          {
            key: 'overview',
            label: (
              <span className="flex items-center gap-2">
                <Compass size={16} /> Overview & Roadmap
              </span>
            ),
            children: (
              <OverviewTab
                caseData={caseData!}
                stats={statsData!}
                onOpenEditCase={openEditCaseModal}
                onOpenTaskModal={openTaskModal}
                onToggleTask={(id, status) => toggleTaskStatusMutation.mutate({ id, status })}
                onOpenCspa={openCspaCalculator}
              />
            ),
          },
          {
            key: 'members',
            label: (
              <span className="flex items-center gap-2">
                <Users size={16} /> Applicants & CSPA
                {statsData?.warningCspaCount ? (
                  <Badge count={statsData.warningCspaCount} className="ml-1" />
                ) : null}
              </span>
            ),
            children: (
              <MembersTab
                members={members}
                documents={allDocuments}
                caseData={caseData!}
                onOpenEditCase={openEditCaseModal}
                onAddMember={() => openMemberModal()}
                onEditMember={(m) => openMemberModal(m)}
                onDeleteMember={(id) => deleteMemberMutation.mutate(id)}
                onOpenCspa={(dob) => openCspaCalculator(dob)}
              />
            ),
          },
          {
            key: 'documents',
            label: (
              <span className="flex items-center gap-2">
                <FileCheck size={16} /> NVC Document Repository
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
                  {statsData?.docProgress.ready}/{statsData?.docProgress.total}
                </span>
              </span>
            ),
            children: (
              <DocumentsTab
                documents={documents}
                categoryFilter={docCategoryFilter}
                onCategoryChange={setDocCategoryFilter}
                onAddDoc={() => openDocModal()}
                onEditDoc={(d) => openDocModal(d)}
                onDeleteDoc={(id) => deleteDocMutation.mutate(id)}
              />
            ),
          },
          {
            key: 'tasks',
            label: (
              <span className="flex items-center gap-2">
                <CheckSquare size={16} /> Action Tasks & Reminders
                {statsData?.taskProgress.urgentCount ? (
                  <Badge count={statsData.taskProgress.urgentCount} className="ml-1" />
                ) : null}
              </span>
            ),
            children: (
              <TasksTab
                tasks={tasks}
                stageFilter={taskStageFilter}
                onStageChange={setTaskStageFilter}
                onAddTask={() => openTaskModal()}
                onEditTask={(t) => openTaskModal(t)}
                onDeleteTask={(id) => deleteTaskMutation.mutate(id)}
                onToggleTask={(id, status) => toggleTaskStatusMutation.mutate({ id, status })}
              />
            ),
          },
          {
            key: 'expenses',
            label: (
              <span className="flex items-center gap-2">
                <DollarSign size={16} /> Expenses & Budget
              </span>
            ),
            children: (
              <ExpensesTab
                expenses={expenses}
                stats={statsData!}
                onAddExpense={() => openExpenseModal()}
                onEditExpense={(e) => openExpenseModal(e)}
                onDeleteExpense={(id) => deleteExpenseMutation.mutate(id)}
              />
            ),
          },
          {
            key: 'expert',
            label: (
              <span className="flex items-center gap-2 text-rose-600 font-semibold">
                <BookOpen size={16} /> Interview Handbook & Risk Advisory
              </span>
            ),
            children: <ExpertGuidelinesTab />,
          },
        ]}
      />

      {/* MODAL 1: EDIT CASE DETAILS */}
      <Modal
        title={
          <div>
            <span className="text-lg font-bold text-slate-800 block">Family Immigration Case Information</span>
            <span className="text-xs text-slate-500 font-normal">This information applies to all family members and automatically synchronizes across the entire portal</span>
          </div>
        }
        open={isCaseModalOpen}
        onCancel={() => setIsCaseModalOpen(false)}
        footer={null}
        width={780}
        destroyOnClose
      >
        <Form form={caseForm} layout="vertical" onFinish={(vals) => updateCaseMutation.mutate({
          ...vals,
          priorityDate: vals.priorityDate ? dayjs(vals.priorityDate).format('YYYY-MM-DD') : null,
          approvalDate: vals.approvalDate ? dayjs(vals.approvalDate).format('YYYY-MM-DD') : null,
          interviewDate: vals.interviewDate ? vals.interviewDate.toDate() : null,
          medicalExamDate: vals.medicalExamDate ? dayjs(vals.medicalExamDate).format('YYYY-MM-DD') : null,
          vaccinationDate: vals.vaccinationDate ? dayjs(vals.vaccinationDate).format('YYYY-MM-DD') : null,
          intendedDepartureDate: vals.intendedDepartureDate ? dayjs(vals.intendedDepartureDate).format('YYYY-MM-DD') : null,
        })} className="pt-2">
          <Divider className="my-2"><span className="text-xs text-rose-600 font-bold uppercase">1. Case Identifiers & Immigration Authorities (USCIS & NVC)</span></Divider>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="caseNumber" label="NVC Case Number">
              <Input placeholder="e.g. HCM2010123456" />
            </Form.Item>
            <Form.Item name="invoiceId" label="NVC Invoice Identification Number (IIN)">
              <Input placeholder="e.g. IIN12345678" />
            </Form.Item>
            <Form.Item name="receiptNumber" label="USCIS Receipt Number">
              <Input placeholder="e.g. WAC2090123456 or IOE..." />
            </Form.Item>
            <Form.Item name="visaCategory" label="Visa Category">
              <Select>
                <Option value="F4 - Brothers and Sisters of U.S. Citizens">F4 - Brothers and Sisters of U.S. Citizens</Option>
                <Option value="F3 - Married Sons and Daughters of U.S. Citizens">F3 - Married Sons and Daughters of U.S. Citizens</Option>
                <Option value="F1 - Unmarried Sons and Daughters (21+) of U.S. Citizens">F1 - Unmarried Sons and Daughters (21+) of U.S. Citizens</Option>
                <Option value="F2A - Spouses and Children (<21) of Permanent Residents">F2A - Spouses and Children (&lt;21) of Permanent Residents</Option>
                <Option value="F2B - Unmarried Sons and Daughters (21+) of Permanent Residents">F2B - Unmarried Sons and Daughters (21+) of Permanent Residents</Option>
                <Option value="CR1/IR1 - Spouses of U.S. Citizens">CR1/IR1 - Spouses of U.S. Citizens</Option>
                <Option value="IR5 - Parents of U.S. Citizens">IR5 - Parents of U.S. Citizens</Option>
              </Select>
            </Form.Item>
            <Form.Item name="priorityDate" label="Priority Date (PD)">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select Priority Date" />
            </Form.Item>
            <Form.Item name="approvalDate" label="I-797 Approval Date (Notice of Action)">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select Approval Date" />
            </Form.Item>
            <Form.Item name="currentStage" label="Current Process Stage" className="md:col-span-2">
              <Select>
                {STAGES.map((s) => (
                  <Option key={s.key} value={s.key}>
                    Step {s.step}: {s.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <Divider className="my-3"><span className="text-xs text-rose-600 font-bold uppercase">2. Principal Applicant, Petitioner & Joint Sponsor</span></Divider>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="principalApplicantName" label="Principal Applicant Full Name">
              <Input placeholder="Full name as shown in passport" />
            </Form.Item>
            <Form.Item name="petitionerName" label="U.S. Petitioner Full Name">
              <Input placeholder="Full name of U.S. petitioner" />
            </Form.Item>
            <Form.Item name="petitionerRelationship" label="Relationship to Principal Applicant">
              <Input placeholder="e.g. Sibling (Brother/Sister), Parent, Spouse..." />
            </Form.Item>
            <Form.Item name="petitionerPhone" label="Petitioner Phone Number">
              <Input placeholder="e.g. +1 (714) 555-0199" />
            </Form.Item>
            <Form.Item name="petitionerEmail" label="Petitioner Email (NVC Contact)">
              <Input placeholder="Email to receive NVC notices" />
            </Form.Item>
            <Form.Item name="petitionerAddress" label="Petitioner U.S. Address">
              <Input placeholder="Street, City, State, ZIP code" />
            </Form.Item>
            <Form.Item name="jointSponsorInfo" label="Joint Financial Sponsor Information (If applicable)" className="md:col-span-2">
              <Input placeholder="Full name, relationship, address, income status..." />
            </Form.Item>
          </div>

          <Divider className="my-3"><span className="text-xs text-rose-600 font-bold uppercase">3. Family Schedule & U.S. Entry Details</span></Divider>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="interviewDate" label="Consulate Interview Date & Time">
              <DatePicker showTime className="w-full" format="DD/MM/YYYY HH:mm" placeholder="Select interview date & time" />
            </Form.Item>
            <Form.Item name="interviewLocation" label="Interview Location">
              <Input placeholder="Default: U.S. Consulate General in HCMC" />
            </Form.Item>
            <Form.Item name="medicalExamDate" label="Family Medical Examination Date">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select exam date" />
            </Form.Item>
            <Form.Item name="vaccinationDate" label="Family Vaccination Date">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select vaccination date" />
            </Form.Item>
            <Form.Item name="intendedDepartureDate" label="Intended U.S. Departure Date">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select departure date" />
            </Form.Item>
            <Form.Item name="portOfEntry" label="Intended Port of Entry (POE)">
              <Input placeholder="e.g. Los Angeles (LAX), San Francisco (SFO), New York (JFK)..." />
            </Form.Item>
            <Form.Item name="destinationAddress" label="U.S. Green Card & SSN Delivery Address" className="md:col-span-2">
              <Input placeholder="Address declared on DS-260 for USCIS to mail Green Card & SSN card" />
            </Form.Item>
          </div>

          <Divider className="my-3"><span className="text-xs text-rose-600 font-bold uppercase">4. General Case Notes</span></Divider>

          <Form.Item name="notes" label="General Family Case Notes">
            <TextArea rows={3} placeholder="Additional notes on case history, petition status, family considerations..." />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setIsCaseModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={updateCaseMutation.isPending} className="!bg-rose-600">
              Save Case Information
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 2: ADD/EDIT MEMBER */}
      <Modal
        title={<span className="text-lg font-bold text-slate-800">{editingMember ? 'Update Applicant Information' : 'Add New Applicant'}</span>}
        open={isMemberModalOpen}
        onCancel={() => { setIsMemberModalOpen(false); setEditingMember(null); }}
        footer={null}
        width={650}
        destroyOnClose
      >
        <Form form={memberForm} layout="vertical" onFinish={(vals) => saveMemberMutation.mutate({
          ...vals,
          dob: vals.dob ? dayjs(vals.dob).format('YYYY-MM-DD') : null,
          passportExpiry: vals.passportExpiry ? dayjs(vals.passportExpiry).format('YYYY-MM-DD') : null,
          policeCertIssueDate: vals.policeCertIssueDate ? dayjs(vals.policeCertIssueDate).format('YYYY-MM-DD') : null,
        })} className="pt-2">
          {/* Shared Family Case Summary Card inside Member Modal */}
          <div className="mb-4 p-3 rounded-2xl bg-gradient-to-br from-rose-50/70 to-slate-50 border border-rose-100 shadow-sm">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-rose-200/60 text-xs">
              <span className="font-bold text-rose-900 flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-rose-600" />
                Shared Family Case Information
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Automatically inherited from family case</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">NVC Case #:</span>
                <span className="font-bold text-slate-800">{caseData?.caseNumber || 'Not provided'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">USCIS Receipt #:</span>
                <span className="font-bold text-slate-800">{caseData?.receiptNumber || 'Not provided'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Priority Date (PD):</span>
                <span className="font-bold text-amber-700">{caseData?.priorityDate ? dayjs(caseData.priorityDate).format('DD/MM/YYYY') : 'Not set'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">I-797 Approval Date:</span>
                <span className="font-bold text-emerald-700">{caseData?.approvalDate ? dayjs(caseData.approvalDate).format('DD/MM/YYYY') : 'Not set'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">U.S. Petitioner:</span>
                <span className="font-bold text-slate-800 truncate block">{caseData?.petitionerName || 'Not provided'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Consulate Interview:</span>
                <span className="font-bold text-rose-600 truncate block">{caseData?.interviewDate ? dayjs(caseData.interviewDate).format('DD/MM/YYYY HH:mm') : 'None'}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="fullName" label="Full Name" rules={[{ required: true, message: 'Please enter full name' }]}>
              <Input placeholder="JOHN DOE (as shown in passport)" />
            </Form.Item>
            <Form.Item name="roleInCase" label="Role in Case" rules={[{ required: true }]}>
              <Select>
                <Option value="PRINCIPAL">Principal Applicant</Option>
                <Option value="SPOUSE">Accompanying Spouse</Option>
                <Option value="CHILD">Accompanying Child (Track CSPA)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="dob" label="Date of Birth">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select date of birth" />
            </Form.Item>
            <Form.Item name="gender" label="Gender">
              <Select placeholder="Select gender">
                <Option value="Male">Male</Option>
                <Option value="Female">Female</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="passportNumber"
              label={<FieldLabelWithUpload text="Passport Number" docTitle="Passport" category="CIVIL_IDENTITY" memberId={editingMember?.id} documents={documents} />}
            >
              <Input placeholder="e.g. C1234567" />
            </Form.Item>
            <Form.Item name="passportExpiry" label="Passport Expiration Date">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select expiration date" />
            </Form.Item>
            <Form.Item label={<FieldLabelWithUpload text="Birth Certificate" docTitle="Birth Certificate" category="CIVIL_IDENTITY" memberId={editingMember?.id} documents={documents} />}>
              <div className="flex items-center h-8 px-3 border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-500">
                {documents.find((d) => d.memberId === editingMember?.id && (d.title === 'Birth Certificate' || d.title === 'Giấy khai sinh'))?.fileUrl
                  ? 'File attached'
                  : 'No file attached'}
              </div>
            </Form.Item>
          </div>

          <Divider className="my-3"><span className="text-xs text-slate-600 font-semibold uppercase">Individual Immigration Procedures</span></Divider>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="ds260Status" label="DS-260 Form Status">
              <Select>
                <Option value="NOT_STARTED">Not Started</Option>
                <Option value="IN_PROGRESS">In Progress</Option>
                <Option value="COMPLETED">Submitted Successfully</Option>
              </Select>
            </Form.Item>
            <Form.Item name="ds260ConfirmationNumber" label="DS-260 Confirmation Number">
              <Input placeholder="e.g. AA00123456" />
            </Form.Item>
            <Form.Item
              name="policeCertStatus"
              label={<FieldLabelWithUpload text="Police Certificate (Form 2 / Age 16+)" docTitle="Police Certificate (Form 2)" category="CIVIL_IDENTITY" memberId={editingMember?.id} documents={documents} />}
            >
              <Select>
                <Option value="NOT_STARTED">Not Started</Option>
                <Option value="IN_PROGRESS">In Progress / Pending</Option>
                <Option value="COMPLETED">Original Certificate Obtained</Option>
                <Option value="EXPIRED">Expired (&gt;1-2 years)</Option>
                <Option value="NOT_APPLICABLE">Not Applicable (Under 16)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="policeCertIssueDate" label="Police Certificate Issue Date">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select issue date" />
            </Form.Item>
            <Form.Item
              name="medicalStatus"
              label={<FieldLabelWithUpload text="Medical Exam & Vaccinations" docTitle="Medical Examination" category="MEDICAL_VACCINE" memberId={editingMember?.id} documents={documents} />}
            >
              <Select>
                <Option value="NOT_STARTED">Not Started</Option>
                <Option value="IN_PROGRESS">Appointment Booked / In Progress</Option>
                <Option value="COMPLETED">Completed</Option>
              </Select>
            </Form.Item>
            <Form.Item name="visaStatus" label="Visa Issuance Status">
              <Select>
                <Option value="NOT_STARTED">Not Interviewed</Option>
                <Option value="PENDING_221G">Form 221(g) - Administrative Processing</Option>
                <Option value="ISSUED">Visa Issued</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="notes" label="Applicant Notes">
            <TextArea rows={2} placeholder="Notes on medical history, immunization, school records..." />
          </Form.Item>

          <Divider className="my-3"><span className="text-xs text-slate-600 font-semibold uppercase">Other Documents for this Applicant</span></Divider>

          {editingMember ? (
            <div className="space-y-2 mb-3">
              {allDocuments
                .filter((d) => d.memberId === editingMember.id && !QUICK_DOC_TITLES.has(d.title))
                .map((doc) => {
                  const docFiles = doc.fileUrls && doc.fileUrls.length > 0 ? doc.fileUrls : (doc.fileUrl ? [doc.fileUrl] : []);
                  return (
                    <div key={doc.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-slate-800 truncate">{doc.title}</span>
                        {docFiles.length > 0 ? (
                          <span className="flex items-center gap-1 text-emerald-600 shrink-0 font-medium">
                            <Paperclip size={12} /> {docFiles.length} files
                          </span>
                        ) : (
                          <Tag color="warning" className="m-0 text-[12px] shrink-0">No file</Tag>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button type="text" size="small" icon={<Edit2 size={14} />} onClick={() => openDocModal(doc)} />
                        <Popconfirm title="Delete this document?" onConfirm={() => deleteDocMutation.mutate(doc.id)} okText="Delete" cancelText="Cancel">
                          <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                        </Popconfirm>
                      </div>
                    </div>
                  );
                })}
              {allDocuments.filter((d) => d.memberId === editingMember.id && !QUICK_DOC_TITLES.has(d.title)).length === 0 && (
                <p className="text-xs text-slate-500 italic">No additional documents attached to this applicant yet.</p>
              )}
              <Button size="small" icon={<Plus size={14} />} onClick={() => openDocModal(undefined, editingMember.id)}>
                Add Document for this Applicant
              </Button>
            </div>
          ) : (
            <Alert
              className="mb-3"
              type="info"
              showIcon
              message="Save the applicant first, then reopen to attach documents."
            />
          )}

          {/* ================= BOTTOM ATTACHMENTS GALLERY ================= */}
          {editingMember && (
            <div className="mt-5 pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Paperclip size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      All Attachments for this Applicant ({allMemberAttachments.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Consolidated view of all images and PDF documents across all checklist items
                    </p>
                  </div>
                </div>
                <Upload
                  accept="image/*,application/pdf"
                  multiple
                  showUploadList={false}
                  beforeUpload={async (file) => {
                    try {
                      const { data } = await filesApi.upload(file, 'gous-documents');
                      const autoTitle = cleanFileNameToTitle(file.name, 'Attached Document');
                      await gousApi.addDocument({
                        memberId: editingMember.id,
                        title: autoTitle,
                        category: 'CIVIL_IDENTITY',
                        status: 'ORIGINAL_OBTAINED',
                        isRequired: false,
                        fileUrls: [data.url],
                        fileUrl: data.url,
                      });
                      message.success(`Added file "${autoTitle}"`);
                      queryClient.invalidateQueries({ queryKey: ['gous-documents'] });
                      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
                    } catch (err: any) {
                      message.error(err?.response?.data?.message || 'Failed to upload file');
                    }
                    return false;
                  }}
                >
                  <Button size="small" icon={<UploadCloud size={13} />} className="!bg-rose-50 !text-rose-600 !border-rose-200 hover:!bg-rose-100 shrink-0">
                    Upload Files / Photos
                  </Button>
                </Upload>
              </div>

              {allMemberAttachments.length > 0 ? (
                <Image.PreviewGroup>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto p-1 bg-slate-50/70 rounded-2xl border border-slate-200/80">
                    {allMemberAttachments.map((item, idx) => {
                      const isImg = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(item.url) || item.url.includes('/images/');
                      return (
                        <div
                          key={`${item.docId}-${idx}`}
                          className="group relative flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:shadow-md transition-all"
                        >
                          <div className="relative h-24 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                            {isImg ? (
                              <Image
                                src={item.url}
                                alt={item.docTitle}
                                className="w-full h-full object-cover"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center justify-center w-full h-full text-red-500 hover:text-red-600 hover:bg-red-50/50"
                              >
                                <FileText size={28} />
                                <span className="text-[10px] font-semibold text-slate-600 mt-1">View PDF</span>
                              </a>
                            )}
                          </div>

                          <div className="p-2 space-y-1 bg-white">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-bold text-slate-800 truncate" title={item.docTitle}>
                                {item.docTitle} {item.totalInDoc > 1 ? `(#${item.index + 1})` : ''}
                              </span>
                              <Popconfirm
                                title="Delete this attachment?"
                                onConfirm={async () => {
                                  try {
                                    const doc = allDocuments.find((d) => d.id === item.docId);
                                    if (!doc) return;
                                    const currentUrls = doc.fileUrls && doc.fileUrls.length > 0 ? doc.fileUrls : (doc.fileUrl ? [doc.fileUrl] : []);
                                    const nextUrls = currentUrls.filter((u, i) => i !== item.index || u !== item.url);
                                    await gousApi.updateDocument(doc.id, {
                                      title: doc.title,
                                      fileUrls: nextUrls,
                                      fileUrl: nextUrls[0] || undefined,
                                    });
                                    message.success('Attachment removed');
                                    queryClient.invalidateQueries({ queryKey: ['gous-documents'] });
                                    queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
                                  } catch (e) {
                                    message.error('Failed to remove file');
                                  }
                                }}
                                okText="Delete"
                                cancelText="Cancel"
                              >
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<Trash2 size={12} />}
                                  className="!p-0 !h-5 !w-5 text-slate-400 hover:text-red-500 shrink-0"
                                  title="Remove this file"
                                />
                              </Popconfirm>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span className="truncate">{item.categoryLabel}</span>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-0.5 shrink-0"
                              >
                                Open <ExternalLink size={10} />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Image.PreviewGroup>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500 bg-slate-50/50">
                  No attachments uploaded for this applicant yet.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => { setIsMemberModalOpen(false); setEditingMember(null); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saveMemberMutation.isPending}>
              Save Information
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 3: ADD/EDIT DOCUMENT */}
      <Modal
        title={<span className="text-lg font-bold text-slate-800">{editingDoc ? 'Update Document' : 'Add Document to Repository'}</span>}
        open={isDocModalOpen}
        onCancel={() => { setIsDocModalOpen(false); setEditingDoc(null); }}
        footer={null}
        width={650}
        destroyOnClose
      >
        <Form
          form={docForm}
          layout="vertical"
          onFinish={(vals) => {
            const rawUrls = vals.fileUrls;
            const fileUrls: string[] = Array.isArray(rawUrls) ? rawUrls.filter(Boolean) : (rawUrls ? [rawUrls] : []);
            const payload: any = {
              title: vals.title?.trim(),
              category: vals.category,
              isRequired: vals.isRequired,
              status: vals.status,
              fileUrls: fileUrls.length > 0 ? fileUrls : undefined,
              fileUrl: fileUrls.length > 0 ? fileUrls[0] : undefined,
            };
            if (vals.memberId) payload.memberId = vals.memberId;
            if (vals.issueDate) payload.issueDate = dayjs(vals.issueDate).format('YYYY-MM-DD');
            if (vals.expiryDate) payload.expiryDate = dayjs(vals.expiryDate).format('YYYY-MM-DD');
            if (vals.description?.trim()) payload.description = vals.description.trim();
            if (vals.expertNotes?.trim()) payload.expertNotes = vals.expertNotes.trim();
            saveDocMutation.mutate(payload);
          }}
          className="pt-2"
        >
          <Form.Item name="title" label="Document / Certificate Name" rules={[{ required: true, message: 'Please enter document title' }]}>
            <Input placeholder="e.g. Certified Copy of Birth Certificate, 3 Years IRS Tax Transcripts..." />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="category" label="Document Category" rules={[{ required: true }]}>
              <Select>
                <Option value="CIVIL_IDENTITY">Civil & Identity Documents</Option>
                <Option value="FINANCIAL_SUPPORT">Financial Support (I-864)</Option>
                <Option value="RELATIONSHIP_PROOF">Relationship Proof (F4)</Option>
                <Option value="MEDICAL_VACCINE">Medical & Vaccinations</Option>
                <Option value="INTERVIEW_TRAVEL">Interview & Travel</Option>
                <Option value="OTHER">Other</Option>
              </Select>
            </Form.Item>
            <Form.Item name="status" label="Current Status" rules={[{ required: true }]}>
              <Select>
                <Option value="NOT_PREPARED">Not Prepared</Option>
                <Option value="ORIGINAL_OBTAINED">Original Obtained</Option>
                <Option value="TRANSLATED_NOTARIZED">Translated & Notarized</Option>
                <Option value="SUBMITTED_NVC">Submitted to CEAC (NVC)</Option>
                <Option value="READY_FOR_INTERVIEW">Ready for Interview</Option>
                <Option value="EXPIRED">Expired</Option>
              </Select>
            </Form.Item>
            <Form.Item name="memberId" label="Assigned Applicant (Optional)">
              <Select allowClear placeholder="Shared family document or select specific applicant">
                {members.map((m) => (
                  <Option key={m.id} value={m.id}>
                    {m.fullName} ({m.roleInCase === 'PRINCIPAL' ? 'Principal Applicant' : m.roleInCase === 'SPOUSE' ? 'Spouse' : 'Child'})
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="isRequired" label="Requirement Level" valuePropName="checked" initialValue={true}>
              <Select>
                <Option value={true}>Mandatory Document</Option>
                <Option value={false}>Optional / Supplementary</Option>
              </Select>
            </Form.Item>
            <Form.Item name="issueDate" label="Issue Date">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select issue date" />
            </Form.Item>
            <Form.Item name="expiryDate" label="Expiration Date">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select expiration date" />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Specifications & Document Requirements">
            <TextArea rows={2} placeholder="Original requirements, number of photocopies, certified English translation..." />
          </Form.Item>

          <Form.Item name="fileUrls" label="Attachments (Supports multiple Images / PDFs)">
            <DocumentFileUploader
              onAutoTitle={(suggested) => {
                const currentTitle = docForm.getFieldValue('title');
                if (!currentTitle || currentTitle.trim() === '') {
                  docForm.setFieldsValue({ title: suggested });
                }
              }}
            />
          </Form.Item>

          <Form.Item name="expertNotes" label="Important Notes from Immigration Attorney / Specialist">
            <TextArea rows={2} placeholder="Expert advice to avoid Form 221(g) refusal..." />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => { setIsDocModalOpen(false); setEditingDoc(null); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saveDocMutation.isPending}>
              Save Document
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 4: ADD/EDIT TASK */}
      <Modal
        title={<span className="text-lg font-bold text-slate-800">{editingTask ? 'Update Task' : 'Add New Task'}</span>}
        open={isTaskModalOpen}
        onCancel={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
        footer={null}
        width={650}
        destroyOnClose
      >
        <Form
          form={taskForm}
          layout="vertical"
          onFinish={(vals) => {
            const payload: any = {
              title: vals.title?.trim(),
              stage: vals.stage,
              priority: vals.priority,
              status: vals.status,
            };
            if (vals.dueDate) {
              payload.dueDate = dayjs(vals.dueDate).format('YYYY-MM-DD');
            }
            if (vals.assignedTo?.trim()) {
              payload.assignedTo = vals.assignedTo.trim();
            }
            if (vals.description?.trim()) {
              payload.description = vals.description.trim();
            }
            if (vals.expertTips?.trim()) {
              payload.expertTips = vals.expertTips.trim();
            }
            saveTaskMutation.mutate(payload);
          }}
          className="pt-2"
        >
          <Form.Item name="title" label="Task Title" rules={[{ required: true, message: 'Please enter task title' }]}>
            <Input placeholder="e.g. Schedule medical examination at Cho Ray Hospital..." />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Form.Item name="stage" label="Process Stage" rules={[{ required: true }]}>
              <Select>
                {STAGES.map((s) => (
                  <Option key={s.key} value={s.key}>Step {s.step}: {s.label}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="priority" label="Priority Level" rules={[{ required: true }]}>
              <Select>
                <Option value="URGENT"><span className="text-red-600 font-bold">Urgent (Immediate Action)</span></Option>
                <Option value="HIGH"><span className="text-amber-600 font-semibold">High Priority</span></Option>
                <Option value="MEDIUM">Medium</Option>
                <Option value="LOW">Low</Option>
              </Select>
            </Form.Item>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select>
                <Option value="TODO">To Do</Option>
                <Option value="IN_PROGRESS">In Progress</Option>
                <Option value="DONE">Done</Option>
                <Option value="SKIPPED">Skipped</Option>
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="dueDate" label="Due Date">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select due date" />
            </Form.Item>
            <Form.Item name="assignedTo" label="Assigned To">
              <Input placeholder="Name of responsible family member" />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Task Details">
            <TextArea rows={2} placeholder="Action steps..." />
          </Form.Item>

          <Form.Item name="expertTips" label="Expert Tips & Insights">
            <TextArea rows={2} placeholder="Practical tips and notes to ensure smooth and accurate execution..." />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => { setIsTaskModalOpen(false); setEditingTask(null); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saveTaskMutation.isPending}>
              Save Task
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 5: ADD/EDIT EXPENSE */}
      <Modal
        title={<span className="text-lg font-bold text-slate-800">{editingExpense ? 'Update Expense' : 'Add Immigration Expense'}</span>}
        open={isExpenseModalOpen}
        onCancel={() => { setIsExpenseModalOpen(false); setEditingExpense(null); }}
        footer={null}
        width={650}
        destroyOnClose
      >
        <Form
          form={expenseForm}
          layout="vertical"
          onFinish={(vals) => {
            const payload: any = {
              title: vals.title?.trim(),
              category: vals.category,
              currency: vals.currency,
              estimatedAmount: Number(vals.estimatedAmount) || 0,
              status: vals.status,
            };
            if (vals.actualAmount !== undefined && vals.actualAmount !== null) {
              payload.actualAmount = Number(vals.actualAmount) || 0;
            }
            if (vals.paymentDate) {
              payload.paymentDate = dayjs(vals.paymentDate).format('YYYY-MM-DD');
            }
            if (vals.payer?.trim()) payload.payer = vals.payer.trim();
            if (vals.notes?.trim()) payload.notes = vals.notes.trim();
            saveExpenseMutation.mutate(payload);
          }}
          className="pt-2"
        >
          <Form.Item name="title" label="Expense Item" rules={[{ required: true, message: 'Please enter expense item name' }]}>
            <Input placeholder="e.g. DS-260 Immigrant Visa Fee ($345 x 4 applicants)..." />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="category" label="Expense Category" rules={[{ required: true }]}>
              <Select>
                <Option value="NVC_GOVERNMENT_FEE">U.S. Government Fees (NVC)</Option>
                <Option value="MEDICAL_AND_VACCINE">Medical Exam & Vaccinations</Option>
                <Option value="CIVIL_AND_LEGAL_DOCS">Translation, Notarization & Police Clearance</Option>
                <Option value="USCIS_IMMIGRANT_FEE">USCIS Immigrant Fee ($220/person)</Option>
                <Option value="FLIGHT_AND_LOGISTICS">Airfare & Relocation Logistics</Option>
                <Option value="SETTLEMENT_FUNDS">Settlement Funds & Cash on Hand</Option>
                <Option value="OTHER">Other Expenses</Option>
              </Select>
            </Form.Item>
            <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
              <Select>
                <Option value="USD">USD (U.S. Dollar)</Option>
                <Option value="VND">VND (Vietnamese Dong)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="estimatedAmount" label="Estimated Amount" rules={[{ required: true, message: 'Please enter estimated amount' }]}>
              <InputNumber className="w-full" min={0} formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
            <Form.Item name="actualAmount" label="Actual Amount Paid">
              <InputNumber className="w-full" min={0} formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
            <Form.Item name="status" label="Payment Status" rules={[{ required: true }]}>
              <Select>
                <Option value="ESTIMATED">Estimated</Option>
                <Option value="PAID">Paid</Option>
                <Option value="UNPAID">Unpaid</Option>
              </Select>
            </Form.Item>
            <Form.Item name="payer" label="Payer">
              <Select placeholder="Select payer">
                <Option value="Petitioner in the U.S.">Petitioner in the U.S.</Option>
                <Option value="Family in Vietnam">Family in Vietnam</Option>
                <Option value="Other">Other</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="paymentDate" label="Payment Date">
            <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select payment date" />
          </Form.Item>

          <Form.Item name="notes" label="Expense Notes">
            <TextArea rows={2} placeholder="Receipt number, bank transfer details, exchange rate..." />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => { setIsExpenseModalOpen(false); setEditingExpense(null); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saveExpenseMutation.isPending}>
              Save Expense
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 6: CSPA CALCULATOR */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <Calculator size={20} />
            <span className="font-bold text-lg text-slate-800">Advanced CSPA Age Calculator (USCIS Standard)</span>
          </div>
        }
        open={isCspaModalOpen}
        onCancel={() => setIsCspaModalOpen(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <div className="space-y-4 pt-2">
          <Alert
            type="info"
            showIcon
            message="CSPA Formula under the Child Status Protection Act (CSPA)"
            description="CSPA Age = Actual Age at Visa Availability Date − I-130 Petition Pending Time (I-797 Approval Date − Priority Date). If CSPA Age < 21, the child remains eligible to immigrate with parents!"
            className="rounded-2xl"
          />

          <Form form={cspaForm} layout="vertical" onFinish={handleCalculateCspa}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="dob" label="1. Child's Date of Birth (DOB)" rules={[{ required: true, message: 'Select child date of birth' }]}>
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Select date of birth" />
              </Form.Item>
              <Form.Item name="priorityDate" label="2. Priority Date (PD)" rules={[{ required: true, message: 'Select Priority Date' }]}>
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Date USCIS received I-130 petition" />
              </Form.Item>
              <Form.Item name="approvalDate" label="3. I-797 Approval Date" rules={[{ required: true, message: 'Select approval date' }]}>
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Date on I-797 Notice of Action" />
              </Form.Item>
              <Form.Item name="visaAvailableDate" label="4. Visa Availability Date (Default: Today)">
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Visa Bulletin final action date" />
              </Form.Item>
            </div>

            <Button type="primary" htmlType="submit" block loading={isCalculatingCspa} icon={<Calculator size={16} />} className="!bg-rose-600 !h-10 !font-semibold">
              Calculate CSPA Age Now
            </Button>
          </Form>

          {cspaResult && (
            <div className="mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">CSPA Assessment Result:</span>
                {cspaResult.cspaStatus === 'SAFE' && (
                  <Tag color="success" className="px-3 py-1 text-sm font-bold rounded-full">
                    ELIGIBLE TO IMMIGRATE (Under 21)
                  </Tag>
                )}
                {cspaResult.cspaStatus === 'WARNING' && (
                  <Tag color="warning" className="px-3 py-1 text-sm font-bold rounded-full">
                    WARNING: NEAR 21 THRESHOLD
                  </Tag>
                )}
                {cspaResult.cspaStatus === 'AGED_OUT' && (
                  <Tag color="error" className="px-3 py-1 text-sm font-bold rounded-full">
                    AGED OUT (Over 21)
                  </Tag>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-600">Actual Age</p>
                  <p className="text-base font-bold text-slate-800 mt-1">{cspaResult.actualAgeAtVisaAvailability} yrs</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-600">I-130 Pending Days</p>
                  <p className="text-base font-bold text-blue-600 mt-1">{cspaResult.i130PendingDays} days</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-600">Deducted Time</p>
                  <p className="text-base font-bold text-emerald-600 mt-1">− {cspaResult.i130PendingYears} yrs</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm">
                  <p className="text-xs text-rose-500 font-semibold">Calculated CSPA Age</p>
                  <p className="text-xl font-extrabold text-rose-600 mt-0.5">{cspaResult.cspaAge} yrs</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-100 space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Specialist Assessment:</p>
                <p className="text-sm text-slate-700 font-medium">{cspaResult.message}</p>
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <p className="text-xs font-bold text-slate-700">Strategic Recommendations:</p>
                  {cspaResult.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ================= TAB 1: OVERVIEW & TIMELINE =================
function OverviewTab({
  caseData,
  stats,
  onOpenEditCase,
  onOpenTaskModal,
  onToggleTask,
  onOpenCspa,
}: {
  caseData: GoUsCase;
  stats: any;
  onOpenEditCase: () => void;
  onOpenTaskModal: () => void;
  onToggleTask: (id: string, status: TaskStatus) => void;
  onOpenCspa: () => void;
}) {
  const currentStageIndex = STAGES.findIndex((s) => s.key === caseData.currentStage);

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-700">Document Progress</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats?.docProgress?.percentage || 0}%</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {stats?.docProgress?.ready || 0} / {stats?.docProgress?.total || 0} items ready
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileCheck size={24} />
            </div>
          </div>
          <Progress percent={stats?.docProgress?.percentage || 0} size="small" strokeColor="#3b82f6" className="mt-3" />
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-700">Tasks Completed</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats?.taskProgress?.percentage || 0}%</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {stats?.taskProgress?.done || 0} / {stats?.taskProgress?.total || 0} tasks
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckSquare size={24} />
            </div>
          </div>
          <Progress percent={stats?.taskProgress?.percentage || 0} size="small" strokeColor="#10b981" className="mt-3" />
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-700">CSPA Age Warnings</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {stats?.warningCspaCount || 0} <span className="text-xs font-normal text-slate-700">at risk</span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5">{stats?.totalMembers || 0} applicants in case</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users size={24} />
            </div>
          </div>
          <Button type="link" size="small" onClick={onOpenCspa} className="!p-0 !text-xs !mt-2">
            Check child&apos;s CSPA age →
          </Button>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-700">Estimated Budget</p>
              <p className="text-xl font-bold text-slate-800 mt-1">
                ${(stats?.financialSummary?.totalEstimatedUsd || 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                + {(stats?.financialSummary?.totalEstimatedVnd || 0).toLocaleString()} VND
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <DollarSign size={24} />
            </div>
          </div>
          <p className="text-xs text-emerald-600 font-semibold mt-3">
            Paid to date: ${(stats?.financialSummary?.totalPaidUsd || 0).toLocaleString()}
          </p>
        </Card>
      </div>

      {/* 11-Stage Roadmap Stepper */}
      <Card
        title={
          <div className="flex items-center justify-between">
            <span className="font-bold text-base text-slate-800 flex items-center gap-2">
              <Compass className="text-rose-500" size={18} />
              11-Stage Roadmap for U.S. F4 Immigration
            </span>
            <Button size="small" onClick={onOpenEditCase}>Change stage</Button>
          </div>
        }
        className="rounded-2xl border-slate-200 shadow-sm"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {STAGES.map((st, idx) => {
              const isCurrent = st.key === caseData.currentStage;
              const isPassed = idx < currentStageIndex;

              return (
                <div
                  key={st.key}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-rose-50/80 border-rose-300 shadow-md ring-2 ring-rose-200'
                      : isPassed
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-50/70 border-slate-200 opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                        isCurrent
                          ? 'bg-rose-600 text-white'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      {isPassed ? <CheckCircle2 size={16} /> : st.step}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-sm font-bold truncate ${isCurrent ? 'text-rose-900' : 'text-slate-800'}`}>
                          {st.label}
                        </p>
                        {isCurrent && <Tag color="error" className="text-[12px] uppercase font-bold m-0">Current</Tag>}
                        {isPassed && <Tag color="success" className="text-[12px] uppercase font-bold m-0">Completed</Tag>}
                      </div>
                      <p className="text-xs text-slate-700 mt-1 line-clamp-2">{st.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Case Details & Urgent Tasks Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Case Detailed Profiles */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            title={
              <span className="font-bold text-base text-slate-800 flex items-center gap-2">
                <HeartHandshake className="text-blue-500" size={18} />
                Petitioner Information & Case Basis
              </span>
            }
            extra={<Button size="small" onClick={onOpenEditCase}>Edit</Button>}
            className="rounded-2xl border-slate-200 shadow-sm"
          >
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered className="rounded-xl overflow-hidden">
              <Descriptions.Item label="NVC Case Number">
                <span className="font-bold text-slate-800">{caseData.caseNumber || 'Not provided'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="USCIS Receipt Number">
                <span className="font-bold text-slate-800">{caseData.receiptNumber || 'Not provided'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="NVC Invoice ID">
                {caseData.invoiceId || 'Not provided'}
              </Descriptions.Item>
              <Descriptions.Item label="Visa Classification">
                <span className="font-medium text-blue-700">{caseData.visaCategory || 'F4'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Priority Date (PD)">
                <span className="font-bold text-amber-700">
                  {caseData.priorityDate ? dayjs(caseData.priorityDate).format('DD/MM/YYYY') : 'Not set'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="I-797 Approval Date">
                <span className="font-bold text-emerald-700">
                  {caseData.approvalDate ? dayjs(caseData.approvalDate).format('DD/MM/YYYY') : 'Not set'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Principal Applicant">
                <span className="font-bold text-slate-800">{caseData.principalApplicantName || 'Primary Applicant'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="U.S. Petitioner">
                <span className="font-bold text-slate-800">{caseData.petitionerName || 'Not provided'}</span>
                {caseData.petitionerRelationship && <span className="text-slate-500 text-xs ml-1">({caseData.petitionerRelationship})</span>}
              </Descriptions.Item>
              <Descriptions.Item label="Petitioner Phone">
                {caseData.petitionerPhone || 'Not provided'}
              </Descriptions.Item>
              <Descriptions.Item label="Petitioner Email">
                {caseData.petitionerEmail || 'Not provided'}
              </Descriptions.Item>
              <Descriptions.Item label="Petitioner U.S. Address" span={2}>
                {caseData.petitionerAddress || 'Not provided'}
              </Descriptions.Item>
              <Descriptions.Item label="Joint Sponsor (Form I-864)" span={2}>
                {caseData.jointSponsorInfo || 'None (Petitioner meets 125% Poverty Guidelines)'}
              </Descriptions.Item>
              <Descriptions.Item label="U.S. Green Card Mailing Address" span={2}>
                <span className="font-medium text-slate-800">{caseData.destinationAddress || 'Not provided'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Interview Date & Time">
                <span className="font-bold text-rose-600">
                  {caseData.interviewDate ? dayjs(caseData.interviewDate).format('DD/MM/YYYY HH:mm') : 'No appointment yet'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Interview Location">
                {caseData.interviewLocation || 'U.S. Consulate General in HCMC (4 Le Duan, Dist. 1)'}
              </Descriptions.Item>
              <Descriptions.Item label="Medical Exam Date">
                {caseData.medicalExamDate ? dayjs(caseData.medicalExamDate).format('DD/MM/YYYY') : 'Not scheduled'}
              </Descriptions.Item>
              <Descriptions.Item label="Vaccination Date">
                {caseData.vaccinationDate ? dayjs(caseData.vaccinationDate).format('DD/MM/YYYY') : 'Not scheduled'}
              </Descriptions.Item>
              <Descriptions.Item label="Intended Flight Date">
                {caseData.intendedDepartureDate ? dayjs(caseData.intendedDepartureDate).format('DD/MM/YYYY') : 'No flight booked'}
              </Descriptions.Item>
              <Descriptions.Item label="Port of Entry (POE)">
                {caseData.portOfEntry || 'Not selected'}
              </Descriptions.Item>
            </Descriptions>

            {caseData.notes && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
                <span className="font-bold">Case Notes: </span>
                {caseData.notes}
              </div>
            )}
          </Card>
        </div>

        {/* Right Col: Urgent Reminders */}
        <div className="space-y-4">
          <Card
            title={
              <div className="flex items-center justify-between">
                <span className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="text-red-500" size={18} />
                  Priority Action Items
                </span>
                <Button size="small" icon={<Plus size={14} />} onClick={onOpenTaskModal}>Add</Button>
              </div>
            }
            className="rounded-2xl border-slate-200 shadow-sm"
          >
            <div className="space-y-2.5">
              {(caseData.tasks || []).filter((t) => t.status !== 'DONE').slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 hover:bg-slate-100 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={task.status === 'DONE'}
                    onChange={(e) => onToggleTask(task.id, e.target.checked ? 'DONE' : 'TODO')}
                    className="mt-1 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {task.priority === 'URGENT' && <Tag color="error" className="text-[12px] m-0">Urgent</Tag>}
                      {task.priority === 'HIGH' && <Tag color="warning" className="text-[12px] m-0">High Priority</Tag>}
                      {task.dueDate && (
                        <span className="text-[12px] text-slate-600 flex items-center gap-1">
                          <Clock size={10} /> Due: {dayjs(task.dueDate).format('DD/MM')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {(!caseData.tasks || caseData.tasks.filter((t) => t.status !== 'DONE').length === 0) && (
                <p className="text-xs text-slate-600 text-center py-4">All tasks have been completed!</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ================= TAB 2: MEMBERS & CSPA =================
function MembersTab({
  members,
  documents,
  caseData,
  onOpenEditCase,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onOpenCspa,
}: {
  members: GoUsMember[];
  documents: GoUsDocument[];
  caseData: GoUsCase;
  onOpenEditCase: () => void;
  onAddMember: () => void;
  onEditMember: (m: GoUsMember) => void;
  onDeleteMember: (id: string) => void;
  onOpenCspa: (dob?: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* SHARED CASE PROFILE BANNER - APPLIES TO ALL MEMBERS */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/30 text-rose-300 border border-rose-500/40">
                  <ShieldAlert size={12} /> Shared Family Case Profile
                </span>
                <span className="text-xs text-slate-400">Applies to all applicants in the family</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                Family Petition Foundation Details
              </h3>
            </div>
            <Button
              size="small"
              icon={<Edit2 size={13} />}
              onClick={onOpenEditCase}
              className="!bg-white/10 !border-white/20 !text-white hover:!bg-white/20 shrink-0 self-start sm:self-auto"
            >
              Edit Case Details
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-700/60 text-xs">
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-slate-400 block text-[11px]">NVC Case #</span>
              <span className="font-bold text-white mt-0.5 block">{caseData.caseNumber || 'Not provided'}</span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-slate-400 block text-[11px]">USCIS Receipt #</span>
              <span className="font-bold text-slate-200 mt-0.5 block">{caseData.receiptNumber || 'Not provided'}</span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-slate-400 block text-[11px]">Priority Date (PD)</span>
              <span className="font-bold text-amber-300 mt-0.5 block">
                {caseData.priorityDate ? dayjs(caseData.priorityDate).format('DD/MM/YYYY') : 'Not set'}
              </span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-slate-400 block text-[11px]">I-797 Approval Date</span>
              <span className="font-bold text-emerald-300 mt-0.5 block">
                {caseData.approvalDate ? dayjs(caseData.approvalDate).format('DD/MM/YYYY') : 'Not set'}
              </span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-slate-400 block text-[11px]">U.S. Petitioner</span>
              <span className="font-semibold text-white mt-0.5 block truncate">
                {caseData.petitionerName || 'Not provided'}
                {caseData.petitionerRelationship ? ` (${caseData.petitionerRelationship})` : ''}
              </span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-slate-400 block text-[11px]">Consulate Interview</span>
              <span className="font-semibold text-rose-300 mt-0.5 block truncate">
                {caseData.interviewDate ? dayjs(caseData.interviewDate).format('DD/MM/YYYY HH:mm') : 'None'}
              </span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 sm:col-span-2">
              <span className="text-slate-400 block text-[11px]">U.S. Green Card Mailing Address</span>
              <span className="font-semibold text-slate-200 mt-0.5 block truncate" title={caseData.destinationAddress}>
                {caseData.destinationAddress || 'Not provided'}
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="flex items-center gap-1.5 text-[12px]">
            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
            All applicants below automatically share these case parameters.
          </span>
          {caseData.priorityDate && caseData.approvalDate && (
            <Tag color="success" className="m-0 text-[11px]">
              Automatic CSPA calculation enabled
            </Tag>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-800">Beneficiary Applicants ({members.length} people)</h2>
          <p className="text-xs text-slate-700 mt-0.5">
            Manage identity documents, passports, DS-260 forms, police clearances, medical exams, and track child CSPA aging status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<Calculator size={14} />} onClick={() => onOpenCspa()}>
            CSPA Calculator
          </Button>
          <Button type="primary" icon={<UserPlus size={14} />} onClick={onAddMember} className="!bg-rose-600">
            Add Applicant
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => {
          const isChild = member.roleInCase === 'CHILD';
          const isPrincipal = member.roleInCase === 'PRINCIPAL';
          const memberAge = member.dob ? dayjs().diff(dayjs(member.dob), 'year') : null;
          const memberDocs = documents.filter((d) => d.memberId === member.id);
          const memberFiles = memberDocs.flatMap((d) =>
            (d.fileUrls && d.fileUrls.length > 0 ? d.fileUrls : (d.fileUrl ? [d.fileUrl] : [])).map((url, idx) => ({
              docTitle: d.title,
              category: d.category,
              url,
              idx,
            }))
          );

          return (
            <Card
              key={member.id}
              className={`rounded-2xl border shadow-sm transition-all hover:shadow-md ${
                isPrincipal
                  ? 'border-rose-300 bg-gradient-to-b from-rose-50/30 to-white'
                  : 'border-slate-200 bg-white'
              }`}
              title={
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                      <User size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 leading-tight truncate">{member.fullName}</p>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <Tag color={isPrincipal ? 'magenta' : member.roleInCase === 'SPOUSE' ? 'blue' : 'cyan'} className="text-[11px] m-0">
                          {isPrincipal ? 'Principal Applicant' : member.roleInCase === 'SPOUSE' ? 'Spouse' : 'Child'}
                        </Tag>
                        {member.gender && (
                          <Tag color="default" className="text-[11px] m-0">
                            {member.gender === 'Nam' || member.gender === 'Male'
                              ? 'Male'
                              : member.gender === 'Nữ' || member.gender === 'Female'
                              ? 'Female'
                              : member.gender}
                          </Tag>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="text" size="small" icon={<Edit2 size={14} />} onClick={() => onEditMember(member)} />
                    <Popconfirm title="Delete this applicant?" onConfirm={() => onDeleteMember(member.id)} okText="Delete" cancelText="Cancel">
                      <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                    </Popconfirm>
                  </div>
                </div>
              }
            >
              <div className="space-y-2 text-xs">
                {/* 1. Personal Info */}
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Date of birth:</span>
                  <span className="font-semibold text-slate-700">
                    {member.dob ? `${dayjs(member.dob).format('DD/MM/YYYY')} (${memberAge} yrs)` : 'Not set'}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Passport:</span>
                  <span className="font-semibold text-slate-700 text-right">
                    {member.passportNumber || 'Not entered'}
                    {member.passportExpiry && (
                      <span className="text-slate-500 font-normal block text-[11px]">
                        Exp: {dayjs(member.passportExpiry).format('DD/MM/YYYY')}
                      </span>
                    )}
                  </span>
                </div>

                {/* 2. Procedural Status */}
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">DS-260 Form:</span>
                  <span>
                    {member.ds260Status === 'COMPLETED' ? (
                      <Tag color="success" className="m-0 text-[11px]">
                        Submitted {member.ds260ConfirmationNumber ? `(${member.ds260ConfirmationNumber})` : ''}
                      </Tag>
                    ) : member.ds260Status === 'IN_PROGRESS' ? (
                      <Tag color="processing" className="m-0 text-[11px]">In Progress</Tag>
                    ) : (
                      <Tag color="default" className="m-0 text-[11px]">Not Started</Tag>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Police Certificate #2:</span>
                  <span>
                    {member.policeCertStatus === 'COMPLETED' ? (
                      <Tag color="success" className="m-0 text-[11px]">
                        Obtained {member.policeCertIssueDate ? `(${dayjs(member.policeCertIssueDate).format('DD/MM/YY')})` : ''}
                      </Tag>
                    ) : member.policeCertStatus === 'IN_PROGRESS' ? (
                      <Tag color="processing" className="m-0 text-[11px]">In Progress</Tag>
                    ) : member.policeCertStatus === 'EXPIRED' ? (
                      <Tag color="error" className="m-0 text-[11px]">Expired</Tag>
                    ) : member.policeCertStatus === 'NOT_APPLICABLE' ? (
                      <Tag color="default" className="m-0 text-[11px]">Under 16</Tag>
                    ) : (
                      <Tag color="warning" className="m-0 text-[11px]">Not Started</Tag>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Medical & Vaccines:</span>
                  <span>
                    {member.medicalStatus === 'COMPLETED' ? (
                      <Tag color="success" className="m-0 text-[11px]">Completed</Tag>
                    ) : member.medicalStatus === 'IN_PROGRESS' ? (
                      <Tag color="processing" className="m-0 text-[11px]">In Progress / Scheduled</Tag>
                    ) : (
                      <Tag color="default" className="m-0 text-[11px]">Not Started</Tag>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Visa Status:</span>
                  <span>
                    {member.visaStatus === 'ISSUED' ? (
                      <Tag color="success" className="m-0 text-[11px]">Visa Issued</Tag>
                    ) : member.visaStatus === 'PENDING_221G' ? (
                      <Tag color="warning" className="m-0 text-[11px]">Form 221(g)</Tag>
                    ) : (
                      <Tag color="default" className="m-0 text-[11px]">Not Interviewed</Tag>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">USCIS $220 Fee:</span>
                  <span>
                    {member.uscisFeePaid ? (
                      <Tag color="success" className="m-0 text-[11px]">Paid $220</Tag>
                    ) : (
                      <Tag color="default" className="m-0 text-[11px]">Unpaid</Tag>
                    )}
                  </span>
                </div>

                {/* 3. CSPA Box for child */}
                {isChild && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900">CSPA Age:</span>
                      {member.cspaAge ? (
                        <span className="font-extrabold text-sm text-amber-900">{member.cspaAge} yrs</span>
                      ) : (
                        <Button type="link" size="small" onClick={() => onOpenCspa(member.dob)} className="!p-0 !text-[12px]">
                          Calculate now →
                        </Button>
                      )}
                    </div>
                    {member.cspaStatus === 'SAFE' && (
                      <p className="text-[12px] text-emerald-700 font-semibold mt-0.5">✓ Eligible to immigrate with parents</p>
                    )}
                    {member.cspaStatus === 'WARNING' && (
                      <p className="text-[12px] text-amber-700 font-semibold mt-0.5">⚠ Near 21 threshold - File DS-260 urgently!</p>
                    )}
                    {member.cspaStatus === 'AGED_OUT' && (
                      <p className="text-[12px] text-red-700 font-semibold mt-0.5">✕ Age-out risk (Prepare F2B filing plan)</p>
                    )}
                  </div>
                )}

                {/* 4. Notes if present */}
                {member.notes && (
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-700">
                    <span className="font-semibold text-slate-800">Notes: </span>
                    {member.notes}
                  </div>
                )}

                {/* 5. Attachments summary & preview */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Paperclip size={12} className="text-slate-500" />
                      Documents & Attachments ({memberFiles.length})
                    </span>
                    <Button
                      type="link"
                      size="small"
                      className="!p-0 !text-[11px]"
                      onClick={() => onEditMember(member)}
                    >
                      Manage →
                    </Button>
                  </div>
                  {memberFiles.length > 0 ? (
                    <Image.PreviewGroup>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {memberFiles.map((file, fIdx) => {
                          const isImg = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file.url) || file.url.includes('/images/');
                          return (
                            <div
                              key={fIdx}
                              className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-1.5 py-1 text-[11px]"
                            >
                              {isImg ? (
                                <Image
                                  src={file.url}
                                  width={18}
                                  height={18}
                                  className="rounded object-cover border border-slate-200"
                                />
                              ) : (
                                <FileText size={13} className="text-red-500 shrink-0" />
                              )}
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate max-w-[90px]"
                                title={file.docTitle}
                              >
                                {file.docTitle}
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </Image.PreviewGroup>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No attachments uploaded</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ================= TAB 3: DOCUMENTS MATRIX =================
function DocumentsTab({
  documents,
  categoryFilter,
  onCategoryChange,
  onAddDoc,
  onEditDoc,
  onDeleteDoc,
}: {
  documents: GoUsDocument[];
  categoryFilter: string;
  onCategoryChange: (cat: string) => void;
  onAddDoc: () => void;
  onEditDoc: (d: GoUsDocument) => void;
  onDeleteDoc: (id: string) => void;
}) {
  const categories = [
    { key: 'ALL', label: 'All' },
    { key: 'CIVIL_IDENTITY', label: 'Civil & Identity' },
    { key: 'FINANCIAL_SUPPORT', label: 'Financial Support (I-864)' },
    { key: 'RELATIONSHIP_PROOF', label: 'Relationship Proof (F4)' },
    { key: 'MEDICAL_VACCINE', label: 'Medical & Vaccines' },
    { key: 'INTERVIEW_TRAVEL', label: 'Interview & Travel' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <Button
              key={cat.key}
              size="small"
              type={categoryFilter === cat.key ? 'primary' : 'default'}
              onClick={() => onCategoryChange(cat.key)}
              className={categoryFilter === cat.key ? '!bg-rose-600' : ''}
            >
              {cat.label}
            </Button>
          ))}
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={onAddDoc} className="!bg-rose-600 shrink-0">
          Add Document
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {documents.map((doc) => {
          const isReady = ['READY_FOR_INTERVIEW', 'SUBMITTED_NVC'].includes(doc.status);

          return (
            <div
              key={doc.id}
              className={`p-4 rounded-2xl border transition-all ${
                isReady
                  ? 'bg-white border-emerald-200 hover:border-emerald-300'
                  : doc.status === 'EXPIRED'
                  ? 'bg-red-50/50 border-red-200'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              } shadow-sm space-y-2`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800">{doc.title}</span>
                    {doc.isRequired && <Tag color="red" className="text-[12px] m-0">Required</Tag>}
                  </div>
                  {doc.member ? (
                    <Tag color="purple" className="text-[12px]">
                      Applicant: {doc.member.fullName}
                    </Tag>
                  ) : (
                    <Tag color="cyan" className="text-[12px]">
                      Shared Family Document
                    </Tag>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="text" size="small" icon={<Edit2 size={14} />} onClick={() => onEditDoc(doc)} />
                  <Popconfirm title="Delete this document?" onConfirm={() => onDeleteDoc(doc.id)} okText="Delete" cancelText="Cancel">
                    <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                  </Popconfirm>
                </div>
              </div>

              {doc.description && <p className="text-xs text-slate-700">{doc.description}</p>}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Status:</span>
                  {doc.status === 'READY_FOR_INTERVIEW' && <Tag color="success" className="m-0">Ready for Interview</Tag>}
                  {doc.status === 'SUBMITTED_NVC' && <Tag color="blue" className="m-0">Submitted to NVC</Tag>}
                  {doc.status === 'TRANSLATED_NOTARIZED' && <Tag color="cyan" className="m-0">Translated & Notarized</Tag>}
                  {doc.status === 'ORIGINAL_OBTAINED' && <Tag color="processing" className="m-0">Original Obtained</Tag>}
                  {doc.status === 'NOT_PREPARED' && <Tag color="default" className="m-0">Not Prepared</Tag>}
                  {doc.status === 'EXPIRED' && <Tag color="error" className="m-0">Expired</Tag>}
                </div>

                {doc.expiryDate && (
                  <span className="text-slate-700 font-medium">
                    Expires: {dayjs(doc.expiryDate).format('DD/MM/YYYY')}
                  </span>
                )}
              </div>

              {doc.fileUrls && doc.fileUrls.length > 0 ? (
                <div className="pt-1">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Attached Files ({doc.fileUrls.length}):
                  </span>
                  <Image.PreviewGroup>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {doc.fileUrls.map((url, i) => {
                        const isImg = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || url.includes('/images/');
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-xs transition-colors"
                          >
                            {isImg ? (
                              <Image
                                src={url}
                                width={20}
                                height={20}
                                className="rounded object-cover border border-slate-200"
                              />
                            ) : (
                              <FileText size={14} className="text-red-500 shrink-0" />
                            )}
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 font-medium hover:underline text-[11px]"
                            >
                              File #{i + 1}
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </Image.PreviewGroup>
                </div>
              ) : doc.fileUrl ? (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:underline"
                >
                  <Paperclip size={13} /> View attachment
                </a>
              ) : null}

              {doc.expertNotes && (
                <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200 text-[13px] text-amber-900">
                  <span className="font-bold">Attorney Notes: </span>
                  {doc.expertNotes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ================= TAB 4: TASKS & TIMELINE =================
function TasksTab({
  tasks,
  stageFilter,
  onStageChange,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTask,
}: {
  tasks: GoUsTask[];
  stageFilter: string;
  onStageChange: (stage: string) => void;
  onAddTask: () => void;
  onEditTask: (t: GoUsTask) => void;
  onDeleteTask: (id: string) => void;
  onToggleTask: (id: string, status: TaskStatus) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Filter by stage:</span>
          <Select value={stageFilter} onChange={onStageChange} className="w-64" size="small">
            <Option value="ALL">All Stages</Option>
            {STAGES.map((s) => (
              <Option key={s.key} value={s.key}>Step {s.step}: {s.label}</Option>
            ))}
          </Select>
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={onAddTask} className="!bg-rose-600">
          Add New Task
        </Button>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => {
          const isDone = task.status === 'DONE';

          return (
            <div
              key={task.id}
              className={`p-4 rounded-2xl border transition-all ${
                isDone
                  ? 'bg-slate-50 border-slate-200 opacity-75'
                  : task.priority === 'URGENT'
                  ? 'bg-red-50/30 border-red-300 shadow-sm'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={(e) => onToggleTask(task.id, e.target.checked ? 'DONE' : 'TODO')}
                  className="mt-1 w-5 h-5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-sm font-bold ${isDone ? 'line-through text-slate-600' : 'text-slate-800'}`}>
                      {task.title}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {task.priority === 'URGENT' && <Tag color="error" className="m-0 text-[12px]">Urgent</Tag>}
                      {task.priority === 'HIGH' && <Tag color="warning" className="m-0 text-[12px]">High Priority</Tag>}
                      {task.priority === 'MEDIUM' && <Tag color="default" className="m-0 text-[12px]">Medium</Tag>}
                      <Button type="text" size="small" icon={<Edit2 size={14} />} onClick={() => onEditTask(task)} />
                      <Popconfirm title="Delete this task?" onConfirm={() => onDeleteTask(task.id)} okText="Delete" cancelText="Cancel">
                        <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                      </Popconfirm>
                    </div>
                  </div>

                  {task.description && <p className="text-xs text-slate-600">{task.description}</p>}

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                    {task.dueDate && (
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        <Calendar size={12} /> Due: {dayjs(task.dueDate).format('DD/MM/YYYY')}
                      </span>
                    )}
                    {task.assignedTo && (
                      <span className="flex items-center gap-1">
                        <User size={12} /> Assignee: {task.assignedTo}
                      </span>
                    )}
                  </div>

                  {task.expertTips && (
                    <div className="mt-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-1.5">
                      <Sparkles size={14} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Expert Tip: </span>
                        {task.expertTips}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ================= TAB 5: EXPENSES & BUDGET =================
function ExpensesTab({
  expenses,
  stats,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
}: {
  expenses: GoUsExpense[];
  stats: any;
  onAddExpense: () => void;
  onEditExpense: (e: GoUsExpense) => void;
  onDeleteExpense: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-gradient-to-r from-blue-50/50 to-white">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">U.S. Dollar Expenses (USD)</p>
          <div className="flex items-baseline justify-between mt-2">
            <div>
              <p className="text-2xl font-black text-slate-800">
                ${(stats?.financialSummary?.totalEstimatedUsd || 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">Total estimated case budget</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-emerald-600">
                ${(stats?.financialSummary?.totalPaidUsd || 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-600">Paid to date</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm bg-gradient-to-r from-emerald-50/50 to-white">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Vietnamese Dong Expenses (VND)</p>
          <div className="flex items-baseline justify-between mt-2">
            <div>
              <p className="text-2xl font-black text-slate-800">
                {(stats?.financialSummary?.totalEstimatedVnd || 0).toLocaleString()} <span className="text-sm font-normal">VND</span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5">Medical, vaccines, police clearance, translations</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-emerald-600">
                {(stats?.financialSummary?.totalPaidVnd || 0).toLocaleString()} VND
              </p>
              <p className="text-xs text-slate-600">Paid to date</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">F4 Immigration Itemized Expense Schedule</h2>
        <Button type="primary" icon={<Plus size={14} />} onClick={onAddExpense} className="!bg-rose-600">
          Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {expenses.map((exp) => (
          <div
            key={exp.id}
            className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-sm text-slate-800">{exp.title}</p>
                <p className="text-xs text-slate-600 mt-0.5">Payer: {exp.payer || 'Family'}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="text" size="small" icon={<Edit2 size={14} />} onClick={() => onEditExpense(exp)} />
                <Popconfirm title="Delete this expense?" onConfirm={() => onDeleteExpense(exp.id)} okText="Delete" cancelText="Cancel">
                  <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                </Popconfirm>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                <span className="text-xs text-slate-600">Estimated: </span>
                <span className="font-bold text-sm text-slate-800">
                  {exp.currency === 'USD' ? `$${Number(exp.estimatedAmount).toLocaleString()}` : `${Number(exp.estimatedAmount).toLocaleString()} VND`}
                </span>
              </div>
              <div>
                {exp.status === 'PAID' ? (
                  <Tag color="success" className="m-0 text-xs">Paid</Tag>
                ) : exp.status === 'UNPAID' ? (
                  <Tag color="error" className="m-0 text-xs">Unpaid</Tag>
                ) : (
                  <Tag color="default" className="m-0 text-xs">Estimated</Tag>
                )}
              </div>
            </div>

            {exp.notes && <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-xl">{exp.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= TAB 6: EXPERT GUIDELINES & RISK ADVISORY =================
function ExpertGuidelinesTab() {
  return (
    <div className="space-y-6">
      {/* Intro Box */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-blue-500/10 border border-rose-200">
        <div className="flex items-start gap-3">
          <BookOpen className="w-8 h-8 text-rose-600 shrink-0 mt-1" />
          <div>
            <h2 className="text-lg font-bold text-slate-800">Immigration Attorney Handbook & F4 Risk Advisory</h2>
            <p className="text-xs text-slate-600 mt-1">
              Real-world insights from top U.S. immigration attorneys and specialists for F4 cases (Brothers and Sisters of U.S. Citizens).
              Mastering these guidelines ensures a smooth interview, avoids Form 221(g) delays, and guarantees safe arrival in the United States.
            </p>
          </div>
        </div>
      </div>

      {/* 5 Deep Advisory Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pillar 1: CSPA & Child Status */}
        <Card
          title={
            <span className="font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="text-rose-500" size={18} />
              1. Child CSPA Age-Out Risks
            </span>
          }
          className="rounded-2xl border-slate-200 shadow-sm"
        >
          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong className="text-rose-700">F4 Category Characteristic:</strong> Because F4 waiting times typically span 12 to 16 years, derivative children are at high risk of turning 21 (aging out).
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <p className="font-bold text-slate-800">Golden Rules of the Child Status Protection Act (CSPA):</p>
              <p>• CSPA Age = (Actual age when visa becomes available) − (I-130 petition pending time).</p>
              <p>• <strong>&quot;Seek to Acquire&quot; Requirement:</strong> You MUST pay the IV fee and submit Form DS-260 within 1 year of visa availability to lock in the child&apos;s CSPA age.</p>
              <p>• <strong>Marital Status:</strong> Children MUST NOT MARRY before entering the United States. Marrying before admission permanently terminates derivative beneficiary eligibility!</p>
            </div>
          </div>
        </Card>

        {/* Pillar 2: I-864 Financial Sponsorship */}
        <Card
          title={
            <span className="font-bold text-slate-800 flex items-center gap-2">
              <DollarSign className="text-emerald-500" size={18} />
              2. Financial Sponsorship Risks (Form I-864)
            </span>
          }
          className="rounded-2xl border-slate-200 shadow-sm"
        >
          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <p>
              The petitioner must prove an income exceeding <strong>125% of the Federal Poverty Guidelines</strong> based on total household size (Household Size = U.S. petitioner&apos;s family + All sponsored family members in the F4 case).
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <p className="font-bold text-slate-800">Solutions for Insufficient Income:</p>
              <p>• <strong>Joint Sponsor:</strong> Must be a U.S. citizen or Permanent Resident whose independent household income is sufficient for their own household plus the entire sponsored F4 family.</p>
              <p>• Always obtain IRS Tax Transcripts for the past 3 tax years directly from IRS.gov rather than standard 1040 forms to guarantee 100% authenticity.</p>
            </div>
          </div>
        </Card>

        {/* Pillar 3: Sibling Relationship Proof */}
        <Card
          title={
            <span className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="text-blue-500" size={18} />
              3. Proving Sibling Blood Relationship
            </span>
          }
          className="rounded-2xl border-slate-200 shadow-sm"
        >
          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <p>
              Consular officers closely examine the authenticity of the biological sibling relationship:
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <p className="font-bold text-slate-800">Evidence Packet Required:</p>
              <p>• <strong>Original Birth Certificates &amp; Certified Extracts:</strong> Carefully verify parent names, dates of birth, and birthplaces across both the petitioner and principal applicant.</p>
              <p>• <strong>Historical Photo Album:</strong> Childhood photos, Lunar New Year family gatherings, and photos from petitioner&apos;s trips visiting Vietnam over the years.</p>
              <p>• <strong>Half-Sibling Cases (Same Father or Same Mother):</strong> Marriage and divorce certificates of parents are strictly required to establish legitimacy.</p>
              <p>• If the consular officer is uncertain, they may issue a 221(g) request for official DNA testing at an accredited facility.</p>
            </div>
          </div>
        </Card>

        {/* Pillar 4: Interview Day Mastery */}
        <Card
          title={
            <span className="font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="text-purple-500" size={18} />
              4. Consulate Interview Mastery (4 Le Duan, Dist. 1)
            </span>
          }
          className="rounded-2xl border-slate-200 shadow-sm"
        >
          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <p className="font-bold text-slate-800">Most Frequent F4 Interview Questions:</p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <p>1. <em>What year did the petitioner move to the U.S., and under which visa category?</em></p>
              <p>2. <em>Which state does the petitioner currently live in? What is their occupation? Are they married?</em></p>
              <p>3. <em>When was the petitioner&apos;s most recent visit to Vietnam?</em></p>
              <p>4. <em>Where does your family intend to reside in the U.S., and what line of work will you pursue?</em></p>
            </div>
            <p className="text-slate-700 italic">
              * Core Principle: Answer concisely, honestly, and in strict alignment with information declared on Form DS-260 and the Affidavit of Support.
            </p>
          </div>
        </Card>

        {/* Pillar 5: Port of Entry & Departure */}
        <Card
          title={
            <span className="font-bold text-slate-800 flex items-center gap-2 md:col-span-2">
              <PlaneTakeoff className="text-amber-500" size={18} />
              5. Travel Preparation &amp; U.S. Port of Entry (POE)
            </span>
          }
          className="rounded-2xl border-slate-200 shadow-sm md:col-span-2"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700 leading-relaxed">
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1">
              <p className="font-bold text-amber-900">USCIS Immigrant Fee ($220):</p>
              <p>Must pay the $220 USCIS Immigrant Fee per person online at my.uscis.gov before boarding the flight to ensure the physical Green Card is produced and mailed to your U.S. address within 3 to 8 weeks.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1">
              <p className="font-bold text-blue-900">Sealed Immigrant Visa Packet:</p>
              <p>If the consulate provides a sealed brown paper packet, NEVER OPEN IT. Only U.S. Customs and Border Protection (CBP) officers at the initial Port of Entry airport are authorized to open it.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
              <p className="font-bold text-emerald-900">Finances &amp; Luggage:</p>
              <p>Carry under $10,000 in cash per family (if carrying $10,000 or more, you must declare it on FinCEN Form 105). Do not pack fresh agricultural produce, meat products, or unlabeled medicines.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
