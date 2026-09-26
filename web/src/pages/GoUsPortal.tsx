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

// ================= HELPERS: TỰ ĐỘNG TẠO TÊN GIẤY TỜ TỪ TÊN FILE =================
function cleanFileNameToTitle(fileName: string, fallback = 'Giấy tờ đính kèm'): string {
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
// Dùng chung giữa Modal Thêm/Sửa Giấy tờ và mục Giấy tờ trong Modal Thành viên (hỗ trợ nhiều hình / PDF)
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
      message.success(`Tải tệp "${file.name}" thành công`);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không thể tải tệp lên, vui lòng thử lại');
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
          <span className="text-xs font-semibold text-slate-600">Đã đính kèm ({fileList.length} tệp):</span>
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
                          Tệp #{idx + 1}
                        </a>
                        <span className="text-[11px] text-slate-500">{isImg ? 'Hình ảnh' : 'Tài liệu PDF'}</span>
                      </div>
                    </div>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<Trash2 size={13} />}
                      onClick={() => handleRemove(url)}
                      title="Xóa tệp này"
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
          {fileList.length > 0 ? 'Tải thêm ảnh hoặc PDF' : 'Tải ảnh hoặc PDF lên'}
        </Button>
      </Upload>
    </div>
  );
}

// Các giấy tờ đã có icon upload nhanh riêng ngay trong form — loại khỏi danh sách "Giấy tờ khác" để tránh hiện trùng
const QUICK_DOC_TITLES = new Set(['Hộ chiếu', 'Giấy khai sinh', 'Lý lịch tư pháp số 2', 'Giấy khám sức khỏe']);

// Icon upload nhanh đặt ngay cạnh field liên quan (Hộ chiếu, Giấy khai sinh...)
// Tự tìm giấy tờ đã có theo (memberId + title), có thì cập nhật/thêm file, chưa có thì tạo mới
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
  const existing = documents.find((d) => d.memberId === memberId && d.title === title);

  const fileList = useMemo(() => {
    if (!existing) return [];
    if (existing.fileUrls && existing.fileUrls.length > 0) return existing.fileUrls;
    if (existing.fileUrl) return [existing.fileUrl];
    return [];
  }, [existing]);

  if (!memberId) {
    return (
      <Tooltip title="Lưu thành viên trước để đính kèm giấy tờ">
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
      message.success(`Đã tải lên tệp cho "${title}"`);
      queryClient.invalidateQueries({ queryKey: ['gous-documents'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    } catch (err: any) {
      message.error(err?.response?.data?.message || `Không thể tải lên "${title}", vui lòng thử lại`);
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
      message.success('Đã xóa tệp đính kèm');
      queryClient.invalidateQueries({ queryKey: ['gous-documents'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    } catch (err: any) {
      message.error('Không thể xóa tệp đính kèm');
    }
  };

  return (
    <span className="flex items-center gap-1.5">
      {fileList.length > 0 && (
        <Popover
          trigger="click"
          placement="bottom"
          title={<span className="font-bold text-xs text-slate-800">Danh sách tệp {title} ({fileList.length})</span>}
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
                        title="Xóa tệp đính kèm này?"
                        onConfirm={() => handleDeleteFile(url)}
                        okText="Xóa"
                        cancelText="Hủy"
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
            <Paperclip size={11} /> {fileList.length} tệp
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
          title={fileList.length > 0 ? `Thêm ảnh/tệp cho ${title}` : `Tải ${title} lên`}
        />
      </Upload>
    </span>
  );
}

// Label kèm icon upload nhanh, dùng cho label của Form.Item (Số Hộ Chiếu, LLTP số 2...)
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
  { key: 'USCIS_PETITION', label: 'Nộp I-130 tại USCIS', step: 1, desc: 'Nộp đơn bảo lãnh và chờ USCIS chấp thuận (I-797)' },
  { key: 'NVC_CASE_CREATION', label: 'Chuyển NVC & Cấp mã', step: 2, desc: 'NVC cấp mã hồ sơ (HCM...) và Invoice ID' },
  { key: 'NVC_FEES', label: 'Đóng phí NVC', step: 3, desc: 'Đóng phí AOS ($120) & Phí thị thực IV ($345/người)' },
  { key: 'DS260_CIVIL_DOCS', label: 'Khai DS-260 & Nộp hồ sơ', step: 4, desc: 'Khai đơn DS-260 & Nộp hồ sơ Dân sự + Bảo trợ I-864' },
  { key: 'NVC_DQ', label: 'NVC duyệt hoàn tất (DQ)', step: 5, desc: 'Nhận thư hoàn tất hồ sơ (Documentarily Qualified)' },
  { key: 'INTERVIEW_LETTER', label: 'Thư mời phỏng vấn (P4)', step: 6, desc: 'Nhận lịch hẹn chính thức từ Lãnh sự quán Hoa Kỳ' },
  { key: 'MEDICAL_VACCINATION', label: 'Khám SK & Tiêm chủng', step: 7, desc: 'Khám tại IOM/Chợ Rẫy & Tiêm ngừa tại Pasteur' },
  { key: 'INTERVIEW_PREP', label: 'Chuẩn bị phỏng vấn', step: 8, desc: 'Đăng ký địa chỉ nhận visa & Sắp xếp bộ hồ sơ' },
  { key: 'INTERVIEW_CONSULATE', label: 'Phỏng vấn tại LSQ TP.HCM', step: 9, desc: 'Phỏng vấn trực tiếp tại số 4 Lê Duẩn, Q1, TP.HCM' },
  { key: 'VISA_ISSUED_USCIS_FEE', label: 'Nhận Visa & Phí thẻ xanh', step: 10, desc: 'Nhận hộ chiếu có visa & Đóng $220 USCIS Fee' },
  { key: 'FLIGHT_AND_POE', label: 'Bay & Nhập cảnh Mỹ', step: 11, desc: 'Chuẩn bị vé máy bay, hành lý và nhập cảnh (POE)' },
];

const DOCUMENT_CATEGORIES: Array<{ key: DocumentCategory; label: string }> = [
  { key: 'CIVIL_IDENTITY', label: 'Dân sự & Nhân thân' },
  { key: 'FINANCIAL_SUPPORT', label: 'Bảo trợ tài chính I-864' },
  { key: 'RELATIONSHIP_PROOF', label: 'Bằng chứng quan hệ F4' },
  { key: 'MEDICAL_VACCINE', label: 'Khám SK & Tiêm chủng' },
  { key: 'INTERVIEW_TRAVEL', label: 'Phỏng vấn & Nhập cảnh' },
  { key: 'OTHER', label: 'Khác' },
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
        const categoryLabel = catObj?.label || 'Dân sự & Nhân thân';
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
      message.success('Cập nhật thông tin hồ sơ thành công');
      queryClient.invalidateQueries({ queryKey: ['gous-case'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
      queryClient.invalidateQueries({ queryKey: ['gous-members'] });
      setIsCaseModalOpen(false);
    },
    onError: () => message.error('Không thể cập nhật hồ sơ'),
  });

  const saveMemberMutation = useMutation({
    mutationFn: (data: Partial<GoUsMember>) =>
      editingMember ? gousApi.updateMember(editingMember.id, data) : gousApi.addMember(data),
    onSuccess: () => {
      message.success(editingMember ? 'Cập nhật thành viên thành công' : 'Thêm thành viên mới thành công');
      queryClient.invalidateQueries({ queryKey: ['gous-members'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
      setIsMemberModalOpen(false);
      setEditingMember(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Có lỗi xảy ra khi lưu thông tin thành viên'));
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: (id: string) => gousApi.deleteMember(id),
    onSuccess: () => {
      message.success('Đã xóa thành viên khỏi hồ sơ');
      queryClient.invalidateQueries({ queryKey: ['gous-members'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Không thể xóa thành viên'));
    },
  });

  const saveDocMutation = useMutation({
    mutationFn: (data: Partial<GoUsDocument>) =>
      editingDoc ? gousApi.updateDocument(editingDoc.id, data) : gousApi.addDocument(data),
    onSuccess: () => {
      message.success(editingDoc ? 'Cập nhật giấy tờ thành công' : 'Thêm giấy tờ thành công');
      queryClient.invalidateQueries({ queryKey: ['gous-documents'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
      setIsDocModalOpen(false);
      setEditingDoc(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Có lỗi khi lưu giấy tờ'));
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => gousApi.deleteDocument(id),
    onSuccess: () => {
      message.success('Đã xóa giấy tờ');
      queryClient.invalidateQueries({ queryKey: ['gous-documents'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Không thể xóa giấy tờ'));
    },
  });

  const saveTaskMutation = useMutation({
    mutationFn: (data: Partial<GoUsTask>) =>
      editingTask ? gousApi.updateTask(editingTask.id, data) : gousApi.addTask(data),
    onSuccess: () => {
      message.success(editingTask ? 'Cập nhật nhiệm vụ thành công' : 'Thêm nhiệm vụ mới thành công');
      queryClient.invalidateQueries({ queryKey: ['gous-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
      setIsTaskModalOpen(false);
      setEditingTask(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Có lỗi khi lưu nhiệm vụ'));
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => gousApi.deleteTask(id),
    onSuccess: () => {
      message.success('Đã xóa nhiệm vụ');
      queryClient.invalidateQueries({ queryKey: ['gous-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Không thể xóa nhiệm vụ'));
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
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Không thể cập nhật trạng thái'));
    },
  });

  const saveExpenseMutation = useMutation({
    mutationFn: (data: Partial<GoUsExpense>) =>
      editingExpense ? gousApi.updateExpense(editingExpense.id, data) : gousApi.addExpense(data),
    onSuccess: () => {
      message.success(editingExpense ? 'Cập nhật chi phí thành công' : 'Thêm chi phí thành công');
      queryClient.invalidateQueries({ queryKey: ['gous-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
      setIsExpenseModalOpen(false);
      setEditingExpense(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Có lỗi khi lưu chi phí'));
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => gousApi.deleteExpense(id),
    onSuccess: () => {
      message.success('Đã xóa khoản chi');
      queryClient.invalidateQueries({ queryKey: ['gous-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Không thể xóa khoản chi'));
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
      message.error(err?.response?.data?.message || 'Không thể tính CSPA, vui lòng kiểm tra lại ngày tháng');
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
        petitionerRelationship: caseData.petitionerRelationship || 'Anh/Chị/Em ruột',
        petitionerAddress: caseData.petitionerAddress,
        petitionerPhone: caseData.petitionerPhone,
        petitionerEmail: caseData.petitionerEmail,
        principalApplicantName: caseData.principalApplicantName,
        jointSponsorInfo: caseData.jointSponsorInfo,
        interviewDate: caseData.interviewDate ? dayjs(caseData.interviewDate) : null,
        interviewLocation: caseData.interviewLocation || 'Tổng Lãnh sự quán Hoa Kỳ tại TP.HCM (4 Lê Duẩn, Q.1)',
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
        payer: 'Người bảo lãnh tại Mỹ',
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
          <h2 className="text-lg font-bold text-slate-800">Chọn Gia Đình Để Bắt Đầu</h2>
          <p className="text-xs text-slate-700">
            Hồ sơ định cư Hoa Kỳ diện F4 được quản lý theo từng gia đình. Vui lòng chọn gia đình đang hoạt động để mở hồ sơ.
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
                  Vào hồ sơ gia đình: {m.familyName}
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
      'Vui lòng thử lại hoặc liên hệ quản trị viên nếu lỗi vẫn tiếp diễn.';
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertTriangle size={32} />
        </div>
        <p className="text-base font-semibold text-slate-800">Không thể tải hồ sơ định cư Mỹ diện F4</p>
        <p className="max-w-md text-xs text-slate-700">{message}</p>
        <Button
          type="primary"
          className="!bg-rose-600"
          onClick={() => {
            refetchCase();
            refetchStats();
          }}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  if (isCaseLoading || isStatsLoading || !caseData) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-700">
        <PlaneTakeoff className="w-10 h-10 text-rose-400 animate-bounce" />
        <p className="text-base font-medium">Đang tải hồ sơ định cư Mỹ diện F4...</p>
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
                <ShieldAlert size={14} /> Diện F4 (Anh/Chị/Em công dân Mỹ)
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Compass size={14} /> {currentStageInfo.label} (Bước {currentStageInfo.step}/11)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              Cổng Quản Lý Định Cư Hoa Kỳ
            </h1>
            <p className="text-slate-600 text-sm max-w-2xl">
              Hệ thống đồng hành chuyên sâu cùng gia đình: kiểm soát hồ sơ NVC, lịch trình phỏng vấn, theo dõi giấy tờ,
              tính toán tuổi CSPA cho con và dự toán chi phí từ A-Z.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="primary"
              icon={<Calculator size={16} />}
              onClick={() => openCspaCalculator()}
              className="!bg-gradient-to-r !from-amber-500 !to-orange-500 !border-none !text-white !font-semibold !shadow-lg hover:!opacity-90"
            >
              Tính Tuổi CSPA
            </Button>
            <Button
              icon={<Edit2 size={16} />}
              onClick={openEditCaseModal}
              className="!bg-white/10 !border-white/20 !text-white hover:!bg-white/20"
            >
              Cập nhật Thông tin Hồ sơ
            </Button>
          </div>
        </div>

        {/* Quick Highlights Strip */}
        <div className="mt-6 pt-6 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm">
            <p className="text-slate-600 font-medium">Mã Hồ Sơ NVC</p>
            <p className="text-sm font-bold text-white mt-0.5">{caseData?.caseNumber || 'Chưa cập nhật'}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm">
            <p className="text-slate-600 font-medium">Ngày Ưu Tiên (PD)</p>
            <p className="text-sm font-bold text-amber-300 mt-0.5">
              {caseData?.priorityDate ? dayjs(caseData.priorityDate).format('DD/MM/YYYY') : 'Chưa cập nhật'}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm">
            <p className="text-slate-600 font-medium">Ngày Chấp Thuận (I-797)</p>
            <p className="text-sm font-bold text-emerald-300 mt-0.5">
              {caseData?.approvalDate ? dayjs(caseData.approvalDate).format('DD/MM/YYYY') : 'Chưa cập nhật'}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm">
            <p className="text-slate-600 font-medium">Đương Đơn Chính</p>
            <p className="text-sm font-bold text-white mt-0.5">{caseData?.principalApplicantName || 'Chủ gia đình'}</p>
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
                <Compass size={16} /> Tổng Quan & Tiến Trình
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
                <Users size={16} /> Thành Viên & CSPA
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
                <FileCheck size={16} /> Danh Mục Giấy Tờ
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
                <CheckSquare size={16} /> Lịch Trình & Nhắc Nhở
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
                <DollarSign size={16} /> Dự Toán & Chi Phí
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
                <BookOpen size={16} /> Cẩm Nang & Cố Vấn Rủi Ro
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
            <span className="text-lg font-bold text-slate-800 block">Thông Tin Hồ Sơ Chung Của Toàn Bộ Gia Đình</span>
            <span className="text-xs text-slate-500 font-normal">Các thông tin này áp dụng chung cho tất cả thành viên trong gia đình và tự động đồng bộ trên toàn hệ thống</span>
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
          <Divider className="my-2"><span className="text-xs text-rose-600 font-bold uppercase">1. Căn Cước Hồ Sơ & Cơ Quan Di Trú (USCIS & NVC)</span></Divider>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="caseNumber" label="Mã hồ sơ NVC (Case Number)">
              <Input placeholder="Ví dụ: HCM2010123456" />
            </Form.Item>
            <Form.Item name="invoiceId" label="Mã hóa đơn NVC (Invoice Identification Number)">
              <Input placeholder="Ví dụ: IIN12345678" />
            </Form.Item>
            <Form.Item name="receiptNumber" label="Số biên nhận Sở Di Trú (USCIS Receipt #)">
              <Input placeholder="Ví dụ: WAC2090123456 hoặc IOE..." />
            </Form.Item>
            <Form.Item name="visaCategory" label="Diện thị thực bảo lãnh">
              <Select>
                <Option value="F4 - Anh/Chị/Em công dân Mỹ">F4 - Anh/Chị/Em công dân Mỹ</Option>
                <Option value="F3 - Con đã có gia đình của công dân Mỹ">F3 - Con đã có gia đình của công dân Mỹ</Option>
                <Option value="F1 - Con độc thân trên 21 tuổi của CD Mỹ">F1 - Con độc thân trên 21 tuổi của CD Mỹ</Option>
                <Option value="F2A - Vợ/Chồng & Con độc thân dưới 21 của Thường trú nhân">F2A - Vợ/Chồng & Con dưới 21 của Thường trú nhân</Option>
                <Option value="F2B - Con độc thân trên 21 tuổi của Thường trú nhân">F2B - Con độc thân trên 21 của Thường trú nhân</Option>
                <Option value="CR1/IR1 - Vợ/Chồng công dân Mỹ">CR1/IR1 - Vợ/Chồng công dân Mỹ</Option>
                <Option value="IR5 - Cha/Mẹ của công dân Mỹ">IR5 - Cha/Mẹ của công dân Mỹ</Option>
              </Select>
            </Form.Item>
            <Form.Item name="priorityDate" label="Ngày ưu tiên (Priority Date - PD)">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày ưu tiên" />
            </Form.Item>
            <Form.Item name="approvalDate" label="Ngày chấp thuận I-797 (Notice of Action)">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày chấp thuận" />
            </Form.Item>
            <Form.Item name="currentStage" label="Giai đoạn tiến trình hiện tại" className="md:col-span-2">
              <Select>
                {STAGES.map((s) => (
                  <Option key={s.key} value={s.key}>
                    Bước {s.step}: {s.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <Divider className="my-3"><span className="text-xs text-rose-600 font-bold uppercase">2. Đương Đơn Chính, Người Bảo Lãnh & Đồng Bảo Trợ</span></Divider>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="principalApplicantName" label="Họ tên Đương đơn chính (Chủ hộ)">
              <Input placeholder="Nhập họ tên đầy đủ như trong hộ chiếu" />
            </Form.Item>
            <Form.Item name="petitionerName" label="Họ tên Người bảo lãnh tại Mỹ">
              <Input placeholder="Họ tên người thân bảo lãnh bên Mỹ" />
            </Form.Item>
            <Form.Item name="petitionerRelationship" label="Quan hệ với đương đơn chính">
              <Input placeholder="Ví dụ: Anh/Chị/Em ruột, Cha mẹ, Vợ chồng..." />
            </Form.Item>
            <Form.Item name="petitionerPhone" label="Số điện thoại người bảo lãnh">
              <Input placeholder="Ví dụ: +1 (714) 555-0199" />
            </Form.Item>
            <Form.Item name="petitionerEmail" label="Email người bảo lãnh (Nhận NVC)">
              <Input placeholder="Email để nhận thông báo hồ sơ" />
            </Form.Item>
            <Form.Item name="petitionerAddress" label="Địa chỉ người bảo lãnh tại Mỹ">
              <Input placeholder="Street, City, State, ZIP code" />
            </Form.Item>
            <Form.Item name="jointSponsorInfo" label="Thông tin Người đồng bảo trợ tài chính (Joint Sponsor - Nếu có)" className="md:col-span-2">
              <Input placeholder="Họ tên, quan hệ, địa chỉ, tình trạng thu nhập..." />
            </Form.Item>
          </div>

          <Divider className="my-3"><span className="text-xs text-rose-600 font-bold uppercase">3. Lịch Trình Chung Gia Đình & Nhập Cảnh Mỹ</span></Divider>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="interviewDate" label="Ngày & Giờ Phỏng Vấn Tại LSQ">
              <DatePicker showTime className="w-full" format="DD/MM/YYYY HH:mm" placeholder="Chọn ngày giờ PV" />
            </Form.Item>
            <Form.Item name="interviewLocation" label="Địa điểm phỏng vấn">
              <Input placeholder="Mặc định: Tổng Lãnh sự quán Hoa Kỳ tại TP.HCM" />
            </Form.Item>
            <Form.Item name="medicalExamDate" label="Ngày Khám Sức Khỏe Chung">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày khám" />
            </Form.Item>
            <Form.Item name="vaccinationDate" label="Ngày Tiêm Chủng Chung">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày tiêm" />
            </Form.Item>
            <Form.Item name="intendedDepartureDate" label="Ngày Dự Kiến Bay Sang Mỹ">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày bay" />
            </Form.Item>
            <Form.Item name="portOfEntry" label="Cảng nhập cảnh dự kiến (Port of Entry - POE)">
              <Input placeholder="Ví dụ: Los Angeles (LAX), San Francisco (SFO), New York (JFK)..." />
            </Form.Item>
            <Form.Item name="destinationAddress" label="Địa chỉ đăng ký nhận Thẻ Xanh & Cư trú tại Mỹ" className="md:col-span-2">
              <Input placeholder="Địa chỉ sẽ khai trên DS-260 để USCIS gửi Thẻ Xanh và thẻ SSN" />
            </Form.Item>
          </div>

          <Divider className="my-3"><span className="text-xs text-rose-600 font-bold uppercase">4. Ghi Chú Chung Hồ Sơ</span></Divider>

          <Form.Item name="notes" label="Ghi chú tổng quan hồ sơ gia đình">
            <TextArea rows={3} placeholder="Ghi chú thêm về diễn biến hồ sơ, tình trạng bảo lãnh, lưu ý của gia đình..." />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setIsCaseModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={updateCaseMutation.isPending} className="!bg-rose-600">
              Lưu Thông Tin Chung
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 2: ADD/EDIT MEMBER */}
      <Modal
        title={<span className="text-lg font-bold text-slate-800">{editingMember ? 'Cập nhật Thành viên' : 'Thêm Thành viên Mới'}</span>}
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
                Thông Tin Kế Thừa Từ Hồ Sơ Chung Của Gia Đình
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Tự động kế thừa không cần nhập lại</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Mã hồ sơ NVC:</span>
                <span className="font-bold text-slate-800">{caseData?.caseNumber || 'Chưa cập nhật'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Mã biên nhận USCIS:</span>
                <span className="font-bold text-slate-800">{caseData?.receiptNumber || 'Chưa cập nhật'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Ngày Ưu Tiên (PD):</span>
                <span className="font-bold text-amber-700">{caseData?.priorityDate ? dayjs(caseData.priorityDate).format('DD/MM/YYYY') : 'Chưa cập nhật'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Ngày Chấp Thuận I-797:</span>
                <span className="font-bold text-emerald-700">{caseData?.approvalDate ? dayjs(caseData.approvalDate).format('DD/MM/YYYY') : 'Chưa cập nhật'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Người bảo lãnh tại Mỹ:</span>
                <span className="font-bold text-slate-800 truncate block">{caseData?.petitionerName || 'Chưa cập nhật'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Lịch phỏng vấn LSQ:</span>
                <span className="font-bold text-rose-600 truncate block">{caseData?.interviewDate ? dayjs(caseData.interviewDate).format('DD/MM/YYYY HH:mm') : 'Chưa có'}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="fullName" label="Họ và tên đầy đủ" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
              <Input placeholder="NGUYEN VAN A (như hộ chiếu)" />
            </Form.Item>
            <Form.Item name="roleInCase" label="Vai trò trong hồ sơ" rules={[{ required: true }]}>
              <Select>
                <Option value="PRINCIPAL">Đương đơn chính (Chủ gia đình)</Option>
                <Option value="SPOUSE">Vợ / Chồng đi kèm</Option>
                <Option value="CHILD">Con đi kèm (Theo dõi CSPA)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="dob" label="Ngày sinh">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày sinh" />
            </Form.Item>
            <Form.Item name="gender" label="Giới tính">
              <Select placeholder="Chọn giới tính">
                <Option value="Nam">Nam</Option>
                <Option value="Nữ">Nữ</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="passportNumber"
              label={<FieldLabelWithUpload text="Số Hộ Chiếu" docTitle="Hộ chiếu" category="CIVIL_IDENTITY" memberId={editingMember?.id} documents={documents} />}
            >
              <Input placeholder="Ví dụ: C1234567" />
            </Form.Item>
            <Form.Item name="passportExpiry" label="Ngày hết hạn Hộ Chiếu">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày hết hạn" />
            </Form.Item>
            <Form.Item label={<FieldLabelWithUpload text="Giấy khai sinh" docTitle="Giấy khai sinh" category="CIVIL_IDENTITY" memberId={editingMember?.id} documents={documents} />}>
              <div className="flex items-center h-8 px-3 border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-500">
                {documents.find((d) => d.memberId === editingMember?.id && d.title === 'Giấy khai sinh')?.fileUrl
                  ? 'Đã có file'
                  : 'Chưa có file'}
              </div>
            </Form.Item>
          </div>

          <Divider className="my-3"><span className="text-xs text-slate-600 font-semibold uppercase">Tiến trình Thủ tục Cá nhân</span></Divider>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="ds260Status" label="Tình trạng Đơn DS-260">
              <Select>
                <Option value="NOT_STARTED">Chưa khai</Option>
                <Option value="IN_PROGRESS">Đang khai</Option>
                <Option value="COMPLETED">Đã nộp thành công</Option>
              </Select>
            </Form.Item>
            <Form.Item name="ds260ConfirmationNumber" label="Mã xác nhận DS-260">
              <Input placeholder="Ví dụ: AA00123456" />
            </Form.Item>
            <Form.Item
              name="policeCertStatus"
              label={<FieldLabelWithUpload text="Lý lịch tư pháp số 2 (Từ đủ 16 tuổi)" docTitle="Lý lịch tư pháp số 2" category="CIVIL_IDENTITY" memberId={editingMember?.id} documents={documents} />}
            >
              <Select>
                <Option value="NOT_STARTED">Chưa làm</Option>
                <Option value="IN_PROGRESS">Đang làm / Chờ cấp</Option>
                <Option value="COMPLETED">Đã có bản chính</Option>
                <Option value="EXPIRED">Đã hết hạn (Quá 1-2 năm)</Option>
                <Option value="NOT_APPLICABLE">Không áp dụng (Dưới 16 tuổi)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="policeCertIssueDate" label="Ngày cấp LLTP số 2">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày cấp" />
            </Form.Item>
            <Form.Item
              name="medicalStatus"
              label={<FieldLabelWithUpload text="Khám sức khỏe & Tiêm chủng" docTitle="Giấy khám sức khỏe" category="MEDICAL_VACCINE" memberId={editingMember?.id} documents={documents} />}
            >
              <Select>
                <Option value="NOT_STARTED">Chưa khám</Option>
                <Option value="IN_PROGRESS">Đã đặt hẹn / Đang khám</Option>
                <Option value="COMPLETED">Đã hoàn thành</Option>
              </Select>
            </Form.Item>
            <Form.Item name="visaStatus" label="Tình trạng Thị thực (Visa)">
              <Select>
                <Option value="NOT_STARTED">Chưa phỏng vấn</Option>
                <Option value="PENDING_221G">Giấy xanh 221(g) - Bổ sung hồ sơ</Option>
                <Option value="ISSUED">Đã cấp Visa (Issued)</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="notes" label="Ghi chú thành viên">
            <TextArea rows={2} placeholder="Ghi chú về tiền sử bệnh, tiêm ngừa, học bạ..." />
          </Form.Item>

          <Divider className="my-3"><span className="text-xs text-slate-600 font-semibold uppercase">Giấy tờ khác của thành viên</span></Divider>

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
                            <Paperclip size={12} /> {docFiles.length} tệp
                          </span>
                        ) : (
                          <Tag color="warning" className="m-0 text-[12px] shrink-0">Chưa có file</Tag>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button type="text" size="small" icon={<Edit2 size={14} />} onClick={() => openDocModal(doc)} />
                        <Popconfirm title="Xác nhận xóa giấy tờ này?" onConfirm={() => deleteDocMutation.mutate(doc.id)} okText="Xóa" cancelText="Hủy">
                          <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                        </Popconfirm>
                      </div>
                    </div>
                  );
                })}
              {allDocuments.filter((d) => d.memberId === editingMember.id && !QUICK_DOC_TITLES.has(d.title)).length === 0 && (
                <p className="text-xs text-slate-500 italic">Chưa có giấy tờ khác nào được gắn cho thành viên này.</p>
              )}
              <Button size="small" icon={<Plus size={14} />} onClick={() => openDocModal(undefined, editingMember.id)}>
                Thêm Giấy Tờ Khác cho Thành Viên Này
              </Button>
            </div>
          ) : (
            <Alert
              className="mb-3"
              type="info"
              showIcon
              message="Lưu thành viên trước, sau đó mở lại để thêm giấy tờ đính kèm."
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
                      Tất cả tệp đính kèm của thành viên ({allMemberAttachments.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Tổng hợp toàn bộ hình ảnh và tài liệu PDF từ mọi mục giấy tờ
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
                      const autoTitle = cleanFileNameToTitle(file.name, 'Giấy tờ đính kèm');
                      await gousApi.addDocument({
                        memberId: editingMember.id,
                        title: autoTitle,
                        category: 'CIVIL_IDENTITY',
                        status: 'ORIGINAL_OBTAINED',
                        isRequired: false,
                        fileUrls: [data.url],
                        fileUrl: data.url,
                      });
                      message.success(`Đã thêm tệp "${autoTitle}"`);
                      queryClient.invalidateQueries({ queryKey: ['gous-documents'] });
                      queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
                    } catch (err: any) {
                      message.error(err?.response?.data?.message || 'Không thể tải tệp lên');
                    }
                    return false;
                  }}
                >
                  <Button size="small" icon={<UploadCloud size={13} />} className="!bg-rose-50 !text-rose-600 !border-rose-200 hover:!bg-rose-100 shrink-0">
                    Tải thêm tệp / ảnh
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
                                <span className="text-[10px] font-semibold text-slate-600 mt-1">Xem PDF</span>
                              </a>
                            )}
                          </div>

                          <div className="p-2 space-y-1 bg-white">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-bold text-slate-800 truncate" title={item.docTitle}>
                                {item.docTitle} {item.totalInDoc > 1 ? `(#${item.index + 1})` : ''}
                              </span>
                              <Popconfirm
                                title="Xác nhận xóa tệp đính kèm này?"
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
                                    message.success('Đã xóa tệp đính kèm');
                                    queryClient.invalidateQueries({ queryKey: ['gous-documents'] });
                                    queryClient.invalidateQueries({ queryKey: ['gous-stats'] });
                                  } catch (e) {
                                    message.error('Không thể xóa tệp');
                                  }
                                }}
                                okText="Xóa"
                                cancelText="Hủy"
                              >
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<Trash2 size={12} />}
                                  className="!p-0 !h-5 !w-5 text-slate-400 hover:text-red-500 shrink-0"
                                  title="Xóa tệp này"
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
                                Mở <ExternalLink size={10} />
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
                  Chưa có tệp đính kèm nào được tải lên cho thành viên này.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => { setIsMemberModalOpen(false); setEditingMember(null); }}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={saveMemberMutation.isPending}>
              Lưu Thông Tin
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 3: ADD/EDIT DOCUMENT */}
      <Modal
        title={<span className="text-lg font-bold text-slate-800">{editingDoc ? 'Cập nhật Giấy tờ' : 'Thêm Giấy tờ vào Danh mục'}</span>}
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
          <Form.Item name="title" label="Tên Giấy tờ / Hồ sơ" rules={[{ required: true, message: 'Vui lòng nhập tên giấy tờ' }]}>
            <Input placeholder="Ví dụ: Giấy khai sinh trích lục, Tax Transcripts 3 năm gần nhất..." />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="category" label="Nhóm Giấy tờ" rules={[{ required: true }]}>
              <Select>
                <Option value="CIVIL_IDENTITY">Dân sự & Nhân thân</Option>
                <Option value="FINANCIAL_SUPPORT">Bảo trợ tài chính I-864</Option>
                <Option value="RELATIONSHIP_PROOF">Bằng chứng quan hệ F4</Option>
                <Option value="MEDICAL_VACCINE">Khám SK & Tiêm chủng</Option>
                <Option value="INTERVIEW_TRAVEL">Phỏng vấn & Nhập cảnh</Option>
                <Option value="OTHER">Khác</Option>
              </Select>
            </Form.Item>
            <Form.Item name="status" label="Trạng thái Hiện tại" rules={[{ required: true }]}>
              <Select>
                <Option value="NOT_PREPARED">Chưa chuẩn bị</Option>
                <Option value="ORIGINAL_OBTAINED">Đã có bản chính</Option>
                <Option value="TRANSLATED_NOTARIZED">Đã dịch thuật công chứng</Option>
                <Option value="SUBMITTED_NVC">Đã nộp lên CEAC (NVC)</Option>
                <Option value="READY_FOR_INTERVIEW">Đã sẵn sàng mang đi phỏng vấn</Option>
                <Option value="EXPIRED">Đã hết hạn</Option>
              </Select>
            </Form.Item>
            <Form.Item name="memberId" label="Thuộc Thành viên Cụ thể (Tùy chọn)">
              <Select allowClear placeholder="Giấy tờ chung cả hồ sơ hoặc chọn thành viên">
                {members.map((m: GoUsMember) => (
                  <Option key={m.id} value={m.id}>{m.fullName} ({m.roleInCase === 'PRINCIPAL' ? 'Đương đơn chính' : m.roleInCase === 'SPOUSE' ? 'Vợ/Chồng' : 'Con'})</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="expiryDate" label="Ngày Hết Hạn (Nếu có)">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày hết hạn" />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Hướng dẫn quy cách & Yêu cầu">
            <TextArea rows={2} placeholder="Yêu cầu bản gốc, số lượng bản sao, dịch thuật tiếng Anh..." />
          </Form.Item>

          <Form.Item name="fileUrls" label="File đính kèm (Hỗ trợ nhiều hình ảnh / PDF)">
            <DocumentFileUploader
              onAutoTitle={(suggested) => {
                const currentTitle = docForm.getFieldValue('title');
                if (!currentTitle || currentTitle.trim() === '') {
                  docForm.setFieldsValue({ title: suggested });
                }
              }}
            />
          </Form.Item>

          <Form.Item name="expertNotes" label="Lưu ý quan trọng từ Luật sư / Chuyên viên">
            <TextArea rows={2} placeholder="Lời khuyên để tránh bị cấp Giấy xanh 221(g)..." />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => { setIsDocModalOpen(false); setEditingDoc(null); }}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={saveDocMutation.isPending}>
              Lưu Giấy Tờ
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 4: ADD/EDIT TASK */}
      <Modal
        title={<span className="text-lg font-bold text-slate-800">{editingTask ? 'Cập nhật Nhiệm vụ' : 'Thêm Nhiệm vụ Mới'}</span>}
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
          <Form.Item name="title" label="Nhiệm vụ cần làm" rules={[{ required: true, message: 'Vui lòng nhập tên công việc' }]}>
            <Input placeholder="Ví dụ: Đặt lịch khám sức khỏe tại BV Chợ Rẫy..." />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Form.Item name="stage" label="Thuộc Giai đoạn" rules={[{ required: true }]}>
              <Select>
                {STAGES.map((s) => (
                  <Option key={s.key} value={s.key}>Bước {s.step}: {s.label}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="priority" label="Mức độ Ưu tiên" rules={[{ required: true }]}>
              <Select>
                <Option value="URGENT"><span className="text-red-600 font-bold">Khẩn cấp (Làm ngay)</span></Option>
                <Option value="HIGH"><span className="text-amber-600 font-semibold">Ưu tiên cao</span></Option>
                <Option value="MEDIUM">Trung bình</Option>
                <Option value="LOW">Thấp</Option>
              </Select>
            </Form.Item>
            <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
              <Select>
                <Option value="TODO">Chưa làm</Option>
                <Option value="IN_PROGRESS">Đang thực hiện</Option>
                <Option value="DONE">Đã hoàn thành</Option>
                <Option value="SKIPPED">Bỏ qua</Option>
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="dueDate" label="Hạn chót hoàn thành">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày hạn chót" />
            </Form.Item>
            <Form.Item name="assignedTo" label="Giao cho ai phụ trách">
              <Input placeholder="Tên người phụ trách trong gia đình" />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Chi tiết công việc">
            <TextArea rows={2} placeholder="Các bước thực hiện..." />
          </Form.Item>

          <Form.Item name="expertTips" label="Kinh nghiệm & Tips chuyên gia">
            <TextArea rows={2} placeholder="Mẹo và lưu ý thực tế để làm nhanh và đúng quy trình..." />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => { setIsTaskModalOpen(false); setEditingTask(null); }}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={saveTaskMutation.isPending}>
              Lưu Nhiệm Vụ
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 5: ADD/EDIT EXPENSE */}
      <Modal
        title={<span className="text-lg font-bold text-slate-800">{editingExpense ? 'Cập nhật Chi phí' : 'Thêm Khoản Chi phí Định cư'}</span>}
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
          <Form.Item name="title" label="Khoản chi phí" rules={[{ required: true, message: 'Vui lòng nhập tên khoản chi' }]}>
            <Input placeholder="Ví dụ: Phí thị thực di dân DS-260 ($345 x 4 người)..." />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="category" label="Nhóm chi phí" rules={[{ required: true }]}>
              <Select>
                <Option value="NVC_GOVERNMENT_FEE">Phí Chính phủ Mỹ (NVC)</Option>
                <Option value="MEDICAL_AND_VACCINE">Khám sức khỏe & Tiêm vắc xin</Option>
                <Option value="CIVIL_AND_LEGAL_DOCS">Dịch thuật, công chứng, LLTP số 2</Option>
                <Option value="USCIS_IMMIGRANT_FEE">Phí thẻ xanh USCIS ($220/người)</Option>
                <Option value="FLIGHT_AND_LOGISTICS">Vé máy bay & Di chuyển</Option>
                <Option value="SETTLEMENT_FUNDS">Quỹ tiền mặt mang theo</Option>
                <Option value="OTHER">Chi phí khác</Option>
              </Select>
            </Form.Item>
            <Form.Item name="currency" label="Loại tiền tệ" rules={[{ required: true }]}>
              <Select>
                <Option value="USD">USD (Đô la Mỹ)</Option>
                <Option value="VND">VNĐ (Việt Nam Đồng)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="estimatedAmount" label="Số tiền dự toán" rules={[{ required: true, message: 'Vui lòng nhập số tiền' }]}>
              <InputNumber className="w-full" min={0} formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
            <Form.Item name="actualAmount" label="Số tiền thực tế đã chi">
              <InputNumber className="w-full" min={0} formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái thanh toán" rules={[{ required: true }]}>
              <Select>
                <Option value="ESTIMATED">Dự toán</Option>
                <Option value="PAID">Đã thanh toán</Option>
                <Option value="UNPAID">Cần thanh toán</Option>
              </Select>
            </Form.Item>
            <Form.Item name="payer" label="Người chi trả">
              <Select placeholder="Chọn người chi trả">
                <Option value="Người bảo lãnh tại Mỹ">Người bảo lãnh tại Mỹ</Option>
                <Option value="Gia đình Việt Nam">Gia đình Việt Nam</Option>
                <Option value="Khác">Khác</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="paymentDate" label="Ngày thanh toán">
            <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày đã thanh toán" />
          </Form.Item>

          <Form.Item name="notes" label="Ghi chú chi phí">
            <TextArea rows={2} placeholder="Hóa đơn, số tài khoản nộp, tỷ giá quy đổi..." />
          </Form.Item>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => { setIsExpenseModalOpen(false); setEditingExpense(null); }}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={saveExpenseMutation.isPending}>
              Lưu Chi Phí
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 6: CSPA CALCULATOR */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <Calculator size={20} />
            <span className="font-bold text-lg text-slate-800">Máy Tính Tuổi CSPA Chuyên Sâu (Chuẩn USCIS)</span>
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
            message="Công thức tính tuổi CSPA theo Đạo luật Bảo vệ Tình trạng Con cái (Hoa Kỳ)"
            description="Tuổi CSPA = Tuổi thực tế tại thời điểm Visa sẵn sàng − Thời gian hồ sơ I-130 chờ duyệt (Ngày chấp thuận I-797 − Ngày ưu tiên PD). Nếu Tuổi CSPA < 21, con được đi cùng cha mẹ!"
            className="rounded-2xl"
          />

          <Form form={cspaForm} layout="vertical" onFinish={handleCalculateCspa}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="dob" label="1. Ngày sinh của con (Date of Birth)" rules={[{ required: true, message: 'Chọn ngày sinh của con' }]}>
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày sinh" />
              </Form.Item>
              <Form.Item name="priorityDate" label="2. Ngày ưu tiên (Priority Date - PD)" rules={[{ required: true, message: 'Chọn ngày ưu tiên' }]}>
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Ngày USCIS nhận đơn I-130" />
              </Form.Item>
              <Form.Item name="approvalDate" label="3. Ngày chấp thuận I-797 (Approval Date)" rules={[{ required: true, message: 'Chọn ngày chấp thuận' }]}>
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Ngày trên thư I-797 Approval" />
              </Form.Item>
              <Form.Item name="visaAvailableDate" label="4. Ngày xét tính tuổi (Mặc định hôm nay)">
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Ngày Visa Bulletin đáo hạn" />
              </Form.Item>
            </div>

            <Button type="primary" htmlType="submit" block loading={isCalculatingCspa} icon={<Calculator size={16} />} className="!bg-rose-600 !h-10 !font-semibold">
              Tính Toán Kết Quả Ngay
            </Button>
          </Form>

          {cspaResult && (
            <div className="mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">Kết quả Đánh giá Tuổi CSPA:</span>
                {cspaResult.cspaStatus === 'SAFE' && (
                  <Tag color="success" className="px-3 py-1 text-sm font-bold rounded-full">
                    AN TOÀN ĐI CÙNG (Dưới 21 tuổi)
                  </Tag>
                )}
                {cspaResult.cspaStatus === 'WARNING' && (
                  <Tag color="warning" className="px-3 py-1 text-sm font-bold rounded-full">
                    NGUY CƠ SÁT NGƯỠNG 21 TUỔI
                  </Tag>
                )}
                {cspaResult.cspaStatus === 'AGED_OUT' && (
                  <Tag color="error" className="px-3 py-1 text-sm font-bold rounded-full">
                    BỊ QUÁ TUỔI (Age-Out)
                  </Tag>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-600">Tuổi Thực Tế</p>
                  <p className="text-base font-bold text-slate-800 mt-1">{cspaResult.actualAgeAtVisaAvailability} tuổi</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-600">Ngày Chờ I-130</p>
                  <p className="text-base font-bold text-blue-600 mt-1">{cspaResult.i130PendingDays} ngày</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-600">Năm Được Trừ</p>
                  <p className="text-base font-bold text-emerald-600 mt-1">− {cspaResult.i130PendingYears} năm</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm">
                  <p className="text-xs text-rose-500 font-semibold">Tuổi CSPA Tính Toán</p>
                  <p className="text-xl font-extrabold text-rose-600 mt-0.5">{cspaResult.cspaAge} tuổi</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-100 space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Nhận định chuyên viên:</p>
                <p className="text-sm text-slate-700 font-medium">{cspaResult.message}</p>
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <p className="text-xs font-bold text-slate-700">Lời khuyên chiến lược:</p>
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
              <p className="text-xs font-medium text-slate-700">Tiến Độ Giấy Tờ</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats?.docProgress?.percentage || 0}%</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {stats?.docProgress?.ready || 0} / {stats?.docProgress?.total || 0} mục sẵn sàng
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
              <p className="text-xs font-medium text-slate-700">Nhiệm Vụ Đã Làm</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{stats?.taskProgress?.percentage || 0}%</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {stats?.taskProgress?.done || 0} / {stats?.taskProgress?.total || 0} đầu việc
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
              <p className="text-xs font-medium text-slate-700">Cảnh Báo Tuổi CSPA</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {stats?.warningCspaCount || 0} <span className="text-xs font-normal text-slate-700">nguy cơ</span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5">{stats?.totalMembers || 0} thành viên trong hồ sơ</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users size={24} />
            </div>
          </div>
          <Button type="link" size="small" onClick={onOpenCspa} className="!p-0 !text-xs !mt-2">
            Kiểm tra tuổi CSPA cho con →
          </Button>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-700">Dự Toán Chi Phí</p>
              <p className="text-xl font-bold text-slate-800 mt-1">
                ${(stats?.financialSummary?.totalEstimatedUsd || 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                + {(stats?.financialSummary?.totalEstimatedVnd || 0).toLocaleString()} VNĐ
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <DollarSign size={24} />
            </div>
          </div>
          <p className="text-xs text-emerald-600 font-semibold mt-3">
            Đã thanh toán: ${(stats?.financialSummary?.totalPaidUsd || 0).toLocaleString()}
          </p>
        </Card>
      </div>

      {/* 11-Stage Roadmap Stepper */}
      <Card
        title={
          <div className="flex items-center justify-between">
            <span className="font-bold text-base text-slate-800 flex items-center gap-2">
              <Compass className="text-rose-500" size={18} />
              Lộ Trình 11 Giai Đoạn Định Cư Diện F4
            </span>
            <Button size="small" onClick={onOpenEditCase}>Chuyển giai đoạn</Button>
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
                        {isCurrent && <Tag color="error" className="text-[12px] uppercase font-bold m-0">Hiện tại</Tag>}
                        {isPassed && <Tag color="success" className="text-[12px] uppercase font-bold m-0">Đã qua</Tag>}
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
                Thông Tin Bảo Lãnh & Căn Cứ Hồ Sơ
              </span>
            }
            extra={<Button size="small" onClick={onOpenEditCase}>Chỉnh sửa</Button>}
            className="rounded-2xl border-slate-200 shadow-sm"
          >
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered className="rounded-xl overflow-hidden">
              <Descriptions.Item label="Mã hồ sơ NVC">
                <span className="font-bold text-slate-800">{caseData.caseNumber || 'Chưa cập nhật'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Mã biên nhận Sở Di Trú (USCIS)">
                <span className="font-bold text-slate-800">{caseData.receiptNumber || 'Chưa cập nhật'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Mã hóa đơn NVC (Invoice ID)">
                {caseData.invoiceId || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Diện bảo lãnh thị thực">
                <span className="font-medium text-blue-700">{caseData.visaCategory || 'F4'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày ưu tiên (PD)">
                <span className="font-bold text-amber-700">
                  {caseData.priorityDate ? dayjs(caseData.priorityDate).format('DD/MM/YYYY') : 'Chưa cập nhật'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày chấp thuận I-797">
                <span className="font-bold text-emerald-700">
                  {caseData.approvalDate ? dayjs(caseData.approvalDate).format('DD/MM/YYYY') : 'Chưa cập nhật'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Đương đơn chính (Chủ hộ)">
                <span className="font-bold text-slate-800">{caseData.principalApplicantName || 'Chủ gia đình'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Người bảo lãnh (Mỹ)">
                <span className="font-bold text-slate-800">{caseData.petitionerName || 'Chưa cập nhật'}</span>
                {caseData.petitionerRelationship && <span className="text-slate-500 text-xs ml-1">({caseData.petitionerRelationship})</span>}
              </Descriptions.Item>
              <Descriptions.Item label="Điện thoại bảo lãnh">
                {caseData.petitionerPhone || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Email bảo lãnh">
                {caseData.petitionerEmail || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ người bảo lãnh tại Mỹ" span={2}>
                {caseData.petitionerAddress || 'Chưa cập nhật'}
              </Descriptions.Item>
              <Descriptions.Item label="Đồng bảo trợ (Joint Sponsor)" span={2}>
                {caseData.jointSponsorInfo || 'Không có (Người bảo lãnh đủ thu nhập)'}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ nhận Thẻ Xanh tại Mỹ" span={2}>
                <span className="font-medium text-slate-800">{caseData.destinationAddress || 'Chưa cập nhật'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày & Giờ Phỏng Vấn">
                <span className="font-bold text-rose-600">
                  {caseData.interviewDate ? dayjs(caseData.interviewDate).format('DD/MM/YYYY HH:mm') : 'Chưa có lịch hẹn'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Địa điểm phỏng vấn">
                {caseData.interviewLocation || 'Tổng Lãnh sự quán Hoa Kỳ tại TP.HCM (4 Lê Duẩn, Q.1)'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày Khám Sức Khỏe">
                {caseData.medicalExamDate ? dayjs(caseData.medicalExamDate).format('DD/MM/YYYY') : 'Chưa đặt hẹn'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày Tiêm Chủng">
                {caseData.vaccinationDate ? dayjs(caseData.vaccinationDate).format('DD/MM/YYYY') : 'Chưa đặt hẹn'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày Dự Kiến Bay">
                {caseData.intendedDepartureDate ? dayjs(caseData.intendedDepartureDate).format('DD/MM/YYYY') : 'Chưa có lịch bay'}
              </Descriptions.Item>
              <Descriptions.Item label="Cảng Nhập Cảnh (POE)">
                {caseData.portOfEntry || 'Chưa chọn'}
              </Descriptions.Item>
            </Descriptions>

            {caseData.notes && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
                <span className="font-bold">Ghi chú hồ sơ: </span>
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
                  Việc Cần Ưu Tiên Làm
                </span>
                <Button size="small" icon={<Plus size={14} />} onClick={onOpenTaskModal}>Thêm</Button>
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
                      {task.priority === 'URGENT' && <Tag color="error" className="text-[12px] m-0">Khẩn cấp</Tag>}
                      {task.priority === 'HIGH' && <Tag color="warning" className="text-[12px] m-0">Ưu tiên</Tag>}
                      {task.dueDate && (
                        <span className="text-[12px] text-slate-600 flex items-center gap-1">
                          <Clock size={10} /> Hạn: {dayjs(task.dueDate).format('DD/MM')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {(!caseData.tasks || caseData.tasks.filter((t) => t.status !== 'DONE').length === 0) && (
                <p className="text-xs text-slate-600 text-center py-4">Tất cả nhiệm vụ đã được hoàn thành!</p>
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
                  <ShieldAlert size={12} /> Hồ Sơ Chung Của Cả Gia Đình
                </span>
                <span className="text-xs text-slate-400">Dùng chung cho tất cả thành viên</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                Thông Tin Căn Cứ Bảo Lãnh Gia Đình
              </h3>
            </div>
            <Button
              size="small"
              icon={<Edit2 size={13} />}
              onClick={onOpenEditCase}
              className="!bg-white/10 !border-white/20 !text-white hover:!bg-white/20 shrink-0 self-start sm:self-auto"
            >
              Chỉnh sửa thông tin chung
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-700/60 text-xs">
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-slate-400 block text-[11px]">Mã Hồ Sơ NVC</span>
              <span className="font-bold text-white mt-0.5 block">{caseData.caseNumber || 'Chưa cập nhật'}</span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-slate-400 block text-[11px]">Số Biên Nhận USCIS</span>
              <span className="font-bold text-slate-200 mt-0.5 block">{caseData.receiptNumber || 'Chưa cập nhật'}</span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-slate-400 block text-[11px]">Ngày Ưu Tiên (PD)</span>
              <span className="font-bold text-amber-300 mt-0.5 block">
                {caseData.priorityDate ? dayjs(caseData.priorityDate).format('DD/MM/YYYY') : 'Chưa cập nhật'}
              </span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-slate-400 block text-[11px]">Ngày Chấp Thuận I-797</span>
              <span className="font-bold text-emerald-300 mt-0.5 block">
                {caseData.approvalDate ? dayjs(caseData.approvalDate).format('DD/MM/YYYY') : 'Chưa cập nhật'}
              </span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-slate-400 block text-[11px]">Người Bảo Lãnh Tại Mỹ</span>
              <span className="font-semibold text-white mt-0.5 block truncate">
                {caseData.petitionerName || 'Chưa cập nhật'}
                {caseData.petitionerRelationship ? ` (${caseData.petitionerRelationship})` : ''}
              </span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
              <span className="text-slate-400 block text-[11px]">Lịch Phỏng Vấn LSQ</span>
              <span className="font-semibold text-rose-300 mt-0.5 block truncate">
                {caseData.interviewDate ? dayjs(caseData.interviewDate).format('DD/MM/YYYY HH:mm') : 'Chưa có'}
              </span>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 sm:col-span-2">
              <span className="text-slate-400 block text-[11px]">Địa Chỉ Nhận Thẻ Xanh Tại Mỹ</span>
              <span className="font-semibold text-slate-200 mt-0.5 block truncate" title={caseData.destinationAddress}>
                {caseData.destinationAddress || 'Chưa cập nhật'}
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="flex items-center gap-1.5 text-[12px]">
            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
            Tất cả các thành viên bên dưới tự động sử dụng chung các thông số hồ sơ này.
          </span>
          {caseData.priorityDate && caseData.approvalDate && (
            <Tag color="success" className="m-0 text-[11px]">
              Đã kích hoạt tự động tính CSPA
            </Tag>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-800">Danh Sách Thành Viên Thụ Hưởng ({members.length} người)</h2>
          <p className="text-xs text-slate-700 mt-0.5">
            Quản lý giấy tờ tùy thân, hộ chiếu, đơn DS-260, LLTP số 2, khám sức khỏe và theo dõi tuổi CSPA cho con cái.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<Calculator size={14} />} onClick={() => onOpenCspa()}>
            Máy tính CSPA
          </Button>
          <Button type="primary" icon={<UserPlus size={14} />} onClick={onAddMember} className="!bg-rose-600">
            Thêm Thành Viên
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
                          {isPrincipal ? 'Đương đơn chính' : member.roleInCase === 'SPOUSE' ? 'Vợ / Chồng' : 'Con cái'}
                        </Tag>
                        {member.gender && (
                          <Tag color="default" className="text-[11px] m-0">
                            {member.gender}
                          </Tag>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="text" size="small" icon={<Edit2 size={14} />} onClick={() => onEditMember(member)} />
                    <Popconfirm title="Xác nhận xóa thành viên?" onConfirm={() => onDeleteMember(member.id)} okText="Xóa" cancelText="Hủy">
                      <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                    </Popconfirm>
                  </div>
                </div>
              }
            >
              <div className="space-y-2 text-xs">
                {/* 1. Thông tin cá nhân */}
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Ngày sinh:</span>
                  <span className="font-semibold text-slate-700">
                    {member.dob ? `${dayjs(member.dob).format('DD/MM/YYYY')} (${memberAge} tuổi)` : 'Chưa nhập'}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Hộ chiếu:</span>
                  <span className="font-semibold text-slate-700 text-right">
                    {member.passportNumber || 'Chưa nhập'}
                    {member.passportExpiry && (
                      <span className="text-slate-500 font-normal block text-[11px]">
                        Hạn: {dayjs(member.passportExpiry).format('DD/MM/YYYY')}
                      </span>
                    )}
                  </span>
                </div>

                {/* 2. Tiến trình thủ tục */}
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Đơn DS-260:</span>
                  <span>
                    {member.ds260Status === 'COMPLETED' ? (
                      <Tag color="success" className="m-0 text-[11px]">
                        Đã nộp {member.ds260ConfirmationNumber ? `(${member.ds260ConfirmationNumber})` : ''}
                      </Tag>
                    ) : member.ds260Status === 'IN_PROGRESS' ? (
                      <Tag color="processing" className="m-0 text-[11px]">Đang khai</Tag>
                    ) : (
                      <Tag color="default" className="m-0 text-[11px]">Chưa khai</Tag>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Lý lịch tư pháp số 2:</span>
                  <span>
                    {member.policeCertStatus === 'COMPLETED' ? (
                      <Tag color="success" className="m-0 text-[11px]">
                        Đã có {member.policeCertIssueDate ? `(${dayjs(member.policeCertIssueDate).format('DD/MM/YY')})` : ''}
                      </Tag>
                    ) : member.policeCertStatus === 'IN_PROGRESS' ? (
                      <Tag color="processing" className="m-0 text-[11px]">Đang làm</Tag>
                    ) : member.policeCertStatus === 'EXPIRED' ? (
                      <Tag color="error" className="m-0 text-[11px]">Đã hết hạn</Tag>
                    ) : member.policeCertStatus === 'NOT_APPLICABLE' ? (
                      <Tag color="default" className="m-0 text-[11px]">Dưới 16 tuổi</Tag>
                    ) : (
                      <Tag color="warning" className="m-0 text-[11px]">Chưa làm</Tag>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Khám SK & Tiêm chủng:</span>
                  <span>
                    {member.medicalStatus === 'COMPLETED' ? (
                      <Tag color="success" className="m-0 text-[11px]">Đã hoàn thành</Tag>
                    ) : member.medicalStatus === 'IN_PROGRESS' ? (
                      <Tag color="processing" className="m-0 text-[11px]">Đang khám / Đã hẹn</Tag>
                    ) : (
                      <Tag color="default" className="m-0 text-[11px]">Chưa khám</Tag>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Tình trạng Visa:</span>
                  <span>
                    {member.visaStatus === 'ISSUED' ? (
                      <Tag color="success" className="m-0 text-[11px]">Đã cấp Visa</Tag>
                    ) : member.visaStatus === 'PENDING_221G' ? (
                      <Tag color="warning" className="m-0 text-[11px]">Giấy xanh 221(g)</Tag>
                    ) : (
                      <Tag color="default" className="m-0 text-[11px]">Chưa phỏng vấn</Tag>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Phí Thẻ Xanh $220:</span>
                  <span>
                    {member.uscisFeePaid ? (
                      <Tag color="success" className="m-0 text-[11px]">Đã đóng $220</Tag>
                    ) : (
                      <Tag color="default" className="m-0 text-[11px]">Chưa đóng</Tag>
                    )}
                  </span>
                </div>

                {/* 3. CSPA Box for child */}
                {isChild && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900">Tuổi CSPA:</span>
                      {member.cspaAge ? (
                        <span className="font-extrabold text-sm text-amber-900">{member.cspaAge} tuổi</span>
                      ) : (
                        <Button type="link" size="small" onClick={() => onOpenCspa(member.dob)} className="!p-0 !text-[12px]">
                          Tính ngay →
                        </Button>
                      )}
                    </div>
                    {member.cspaStatus === 'SAFE' && (
                      <p className="text-[12px] text-emerald-700 font-semibold mt-0.5">✓ Đủ điều kiện đi cùng cha mẹ</p>
                    )}
                    {member.cspaStatus === 'WARNING' && (
                      <p className="text-[12px] text-amber-700 font-semibold mt-0.5">⚠ Sát 21 tuổi - Cần nộp DS-260 gấp!</p>
                    )}
                    {member.cspaStatus === 'AGED_OUT' && (
                      <p className="text-[12px] text-red-700 font-semibold mt-0.5">✕ Nguy cơ quá tuổi (Cần chuẩn bị F2B)</p>
                    )}
                  </div>
                )}

                {/* 4. Notes if present */}
                {member.notes && (
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-700">
                    <span className="font-semibold text-slate-800">Ghi chú: </span>
                    {member.notes}
                  </div>
                )}

                {/* 5. Attachments summary & preview */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Paperclip size={12} className="text-slate-500" />
                      Giấy tờ & Tệp đính kèm ({memberFiles.length})
                    </span>
                    <Button
                      type="link"
                      size="small"
                      className="!p-0 !text-[11px]"
                      onClick={() => onEditMember(member)}
                    >
                      Quản lý →
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
                    <p className="text-[11px] text-slate-400 italic">Chưa có tệp đính kèm nào</p>
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
    { key: 'ALL', label: 'Tất cả' },
    { key: 'CIVIL_IDENTITY', label: 'Dân sự & Nhân thân' },
    { key: 'FINANCIAL_SUPPORT', label: 'Bảo trợ tài chính I-864' },
    { key: 'RELATIONSHIP_PROOF', label: 'Bằng chứng quan hệ F4' },
    { key: 'MEDICAL_VACCINE', label: 'Khám SK & Tiêm chủng' },
    { key: 'INTERVIEW_TRAVEL', label: 'Phỏng vấn & Nhập cảnh' },
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
          Thêm Giấy Tờ
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
                    {doc.isRequired && <Tag color="red" className="text-[12px] m-0">Bắt buộc</Tag>}
                  </div>
                  {doc.member ? (
                    <Tag color="purple" className="text-[12px]">
                      Thành viên: {doc.member.fullName}
                    </Tag>
                  ) : (
                    <Tag color="cyan" className="text-[12px]">
                      Hồ sơ chung của gia đình
                    </Tag>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="text" size="small" icon={<Edit2 size={14} />} onClick={() => onEditDoc(doc)} />
                  <Popconfirm title="Xác nhận xóa giấy tờ này?" onConfirm={() => onDeleteDoc(doc.id)} okText="Xóa" cancelText="Hủy">
                    <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                  </Popconfirm>
                </div>
              </div>

              {doc.description && <p className="text-xs text-slate-700">{doc.description}</p>}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Trạng thái:</span>
                  {doc.status === 'READY_FOR_INTERVIEW' && <Tag color="success" className="m-0">Sẵn sàng phỏng vấn</Tag>}
                  {doc.status === 'SUBMITTED_NVC' && <Tag color="blue" className="m-0">Đã nộp NVC</Tag>}
                  {doc.status === 'TRANSLATED_NOTARIZED' && <Tag color="cyan" className="m-0">Đã dịch thuật công chứng</Tag>}
                  {doc.status === 'ORIGINAL_OBTAINED' && <Tag color="processing" className="m-0">Đã có bản chính</Tag>}
                  {doc.status === 'NOT_PREPARED' && <Tag color="default" className="m-0">Chưa chuẩn bị</Tag>}
                  {doc.status === 'EXPIRED' && <Tag color="error" className="m-0">Đã hết hạn</Tag>}
                </div>

                {doc.expiryDate && (
                  <span className="text-slate-700 font-medium">
                    Hạn: {dayjs(doc.expiryDate).format('DD/MM/YYYY')}
                  </span>
                )}
              </div>

              {doc.fileUrls && doc.fileUrls.length > 0 ? (
                <div className="pt-1">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Tệp đính kèm ({doc.fileUrls.length}):
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
                              Tệp #{i + 1}
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
                  <Paperclip size={13} /> Xem file đính kèm
                </a>
              ) : null}

              {doc.expertNotes && (
                <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200 text-[13px] text-amber-900">
                  <span className="font-bold">Lưu ý luật sư: </span>
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
          <span className="text-xs font-semibold text-slate-700">Lọc theo giai đoạn:</span>
          <Select value={stageFilter} onChange={onStageChange} className="w-56" size="small">
            <Option value="ALL">Tất cả giai đoạn</Option>
            {STAGES.map((s) => (
              <Option key={s.key} value={s.key}>Bước {s.step}: {s.label}</Option>
            ))}
          </Select>
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={onAddTask} className="!bg-rose-600">
          Thêm Nhiệm Vụ Mới
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
                      {task.priority === 'URGENT' && <Tag color="error" className="m-0 text-[12px]">Khẩn cấp</Tag>}
                      {task.priority === 'HIGH' && <Tag color="warning" className="m-0 text-[12px]">Ưu tiên cao</Tag>}
                      {task.priority === 'MEDIUM' && <Tag color="default" className="m-0 text-[12px]">Trung bình</Tag>}
                      <Button type="text" size="small" icon={<Edit2 size={14} />} onClick={() => onEditTask(task)} />
                      <Popconfirm title="Xác nhận xóa nhiệm vụ này?" onConfirm={() => onDeleteTask(task.id)} okText="Xóa" cancelText="Hủy">
                        <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                      </Popconfirm>
                    </div>
                  </div>

                  {task.description && <p className="text-xs text-slate-600">{task.description}</p>}

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                    {task.dueDate && (
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        <Calendar size={12} /> Hạn chót: {dayjs(task.dueDate).format('DD/MM/YYYY')}
                      </span>
                    )}
                    {task.assignedTo && (
                      <span className="flex items-center gap-1">
                        <User size={12} /> Phụ trách: {task.assignedTo}
                      </span>
                    )}
                  </div>

                  {task.expertTips && (
                    <div className="mt-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-1.5">
                      <Sparkles size={14} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Mẹo từ chuyên gia: </span>
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
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Chi Phí Đô La Mỹ (USD)</p>
          <div className="flex items-baseline justify-between mt-2">
            <div>
              <p className="text-2xl font-black text-slate-800">
                ${(stats?.financialSummary?.totalEstimatedUsd || 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">Tổng dự toán toàn bộ hồ sơ</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-emerald-600">
                ${(stats?.financialSummary?.totalPaidUsd || 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-600">Đã thanh toán</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm bg-gradient-to-r from-emerald-50/50 to-white">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Chi Phí Tiền Việt (VNĐ)</p>
          <div className="flex items-baseline justify-between mt-2">
            <div>
              <p className="text-2xl font-black text-slate-800">
                {(stats?.financialSummary?.totalEstimatedVnd || 0).toLocaleString()} <span className="text-sm font-normal">VNĐ</span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5">Khám SK, tiêm chủng, LLTP, dịch thuật</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-emerald-600">
                {(stats?.financialSummary?.totalPaidVnd || 0).toLocaleString()} VNĐ
              </p>
              <p className="text-xs text-slate-600">Đã chi</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">Bảng Kê Chi Tiết Chi Phí Định Cư F4</h2>
        <Button type="primary" icon={<Plus size={14} />} onClick={onAddExpense} className="!bg-rose-600">
          Thêm Khoản Chi
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
                <p className="text-xs text-slate-600 mt-0.5">Người chi trả: {exp.payer || 'Gia đình'}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="text" size="small" icon={<Edit2 size={14} />} onClick={() => onEditExpense(exp)} />
                <Popconfirm title="Xác nhận xóa khoản chi này?" onConfirm={() => onDeleteExpense(exp.id)} okText="Xóa" cancelText="Hủy">
                  <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                </Popconfirm>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                <span className="text-xs text-slate-600">Dự toán: </span>
                <span className="font-bold text-sm text-slate-800">
                  {exp.currency === 'USD' ? `$${Number(exp.estimatedAmount).toLocaleString()}` : `${Number(exp.estimatedAmount).toLocaleString()} VNĐ`}
                </span>
              </div>
              <div>
                {exp.status === 'PAID' ? (
                  <Tag color="success" className="m-0 text-xs">Đã thanh toán</Tag>
                ) : exp.status === 'UNPAID' ? (
                  <Tag color="error" className="m-0 text-xs">Cần thanh toán</Tag>
                ) : (
                  <Tag color="default" className="m-0 text-xs">Dự toán</Tag>
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
            <h2 className="text-lg font-bold text-slate-800">Cẩm Nang Luật Sư Di Trú & Nhận Diện Rủi Ro Diện F4</h2>
            <p className="text-xs text-slate-600 mt-1">
              Tổng hợp kinh nghiệm thực tế từ các luật sư và chuyên gia di trú hàng đầu về hồ sơ F4 (Anh/Chị/Em ruột của công dân Mỹ).
              Nắm chắc các lưu ý này giúp gia đình vượt qua phỏng vấn suôn sẻ, không bị cấp Giấy xanh 221(g) và đặt chân đến Mỹ an toàn.
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
              1. Rủi Ro Tuổi CSPA Của Con Cái (Age-Out)
            </span>
          }
          className="rounded-2xl border-slate-200 shadow-sm"
        >
          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong className="text-rose-700">Đặc thù diện F4:</strong> Do thời gian chờ F4 thường kéo dài từ 12 - 16 năm, con cái đi kèm rất dễ chạm mốc 21 tuổi.
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <p className="font-bold text-slate-800">Quy tắc vàng của Luật CSPA:</p>
              <p>• Tuổi CSPA = (Tuổi thực tế khi Visa đáo hạn) − (Thời gian xét duyệt đơn I-130).</p>
              <p>• <strong>Yêu cầu "Seek to Acquire":</strong> Phải đóng phí IV và nộp đơn DS-260 trong vòng 1 năm kể từ ngày visa sẵn sàng để "khóa tuổi" CSPA.</p>
              <p>• <strong>Tình trạng hôn nhân:</strong> Con cái TUYỆT ĐỐI KHÔNG ĐƯỢC KẾT HÔN trước khi đặt chân tới Mỹ. Nếu kết hôn, tư cách đi kèm sẽ bị hủy bỏ vĩnh viễn!</p>
            </div>
          </div>
        </Card>

        {/* Pillar 2: I-864 Financial Sponsorship */}
        <Card
          title={
            <span className="font-bold text-slate-800 flex items-center gap-2">
              <DollarSign className="text-emerald-500" size={18} />
              2. Rủi Ro Bảo Trợ Tài Chính (Form I-864)
            </span>
          }
          className="rounded-2xl border-slate-200 shadow-sm"
        >
          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <p>
              Người bảo lãnh phải chứng minh mức thu nhập vượt <strong>125% Chuẩn Nghèo Liên Bang (Poverty Guidelines)</strong> tính theo quy mô gia đình (Household size = Người nhà bên Mỹ + Toàn bộ số người trong gia đình F4 được bảo lãnh).
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <p className="font-bold text-slate-800">Giải pháp khi thiếu thu nhập:</p>
              <p>• <strong>Người đồng bảo trợ (Joint Sponsor):</strong> Phải là công dân Mỹ hoặc Thường trú nhân có thu nhập độc lập đủ bảo trợ cho quy mô gia đình của họ + gia đình F4.</p>
              <p>• Chuẩn bị Tax Transcripts 3 năm gần nhất tải trực tiếp từ IRS (irs.gov) thay vì bản khai thuế 1040 thông thường để đảm bảo tính xác thực 100%.</p>
            </div>
          </div>
        </Card>

        {/* Pillar 3: Sibling Relationship Proof */}
        <Card
          title={
            <span className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="text-blue-500" size={18} />
              3. Bằng Chứng Quan Hệ Huyết Thống Anh/Chị/Em
            </span>
          }
          className="rounded-2xl border-slate-200 shadow-sm"
        >
          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <p>
              Viên chức Lãnh sự quán xem xét rất kỹ tính chân thực của quan hệ anh/chị/em ruột:
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <p className="font-bold text-slate-800">Bộ bằng chứng cần chuẩn bị:</p>
              <p>• <strong>Giấy khai sinh gốc & trích lục mới:</strong> Kiểm tra kỹ họ tên cha mẹ, ngày sinh, năm sinh giữa người bảo lãnh và đương đơn chính.</p>
              <p>• <strong>Album ảnh chụp chung qua các năm:</strong> Ảnh chụp từ thuở nhỏ, ảnh gia đình tết, ảnh các chuyến người bảo lãnh về thăm Việt Nam.</p>
              <p>• <strong>Trường hợp cùng cha khác mẹ / cùng mẹ khác cha:</strong> Cần thêm Giấy chứng nhận kết hôn / ly hôn của cha mẹ để chứng minh tính hợp pháp.</p>
              <p>• Nếu Lãnh sự nghi ngờ, họ có thể yêu cầu thử ADN (DNA Test) tại đơn vị được chỉ định.</p>
            </div>
          </div>
        </Card>

        {/* Pillar 4: Interview Day Mastery */}
        <Card
          title={
            <span className="font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="text-purple-500" size={18} />
              4. Bí Quyết Phỏng Vấn Tại Lãnh Sự Quán (Số 4 Lê Duẩn)
            </span>
          }
          className="rounded-2xl border-slate-200 shadow-sm"
        >
          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <p className="font-bold text-slate-800">Các câu hỏi thường gặp nhất diện F4:</p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <p>1. <em>Người bảo lãnh qua Mỹ năm nào? Đi theo diện gì?</em></p>
              <p>2. <em>Người bảo lãnh hiện đang sống ở tiểu bang nào? Làm nghề gì? Đã kết hôn chưa?</em></p>
              <p>3. <em>Lần gần nhất người bảo lãnh về Việt Nam là khi nào?</em></p>
              <p>4. <em>Gia đình bạn qua Mỹ dự định sẽ sống ở đâu và làm công việc gì?</em></p>
            </div>
            <p className="text-slate-700 italic">
              * Nguyên tắc: Trả lời ngắn gọn, trung thực, khớp với thông tin đã khai trong đơn DS-260 và hồ sơ bảo trợ.
            </p>
          </div>
        </Card>

        {/* Pillar 5: Port of Entry & Departure */}
        <Card
          title={
            <span className="font-bold text-slate-800 flex items-center gap-2 md:col-span-2">
              <PlaneTakeoff className="text-amber-500" size={18} />
              5. Chuẩn Bị Bay & Thủ Tục Nhập Cảnh Hoa Kỳ (Port of Entry)
            </span>
          }
          className="rounded-2xl border-slate-200 shadow-sm md:col-span-2"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700 leading-relaxed">
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1">
              <p className="font-bold text-amber-900">Phí Thẻ Xanh USCIS ($220):</p>
              <p>Phải đóng phí USCIS Immigrant Fee ($220 / người) trực tuyến trên my.uscis.gov trước khi lên máy bay để Thẻ Xanh được in và gửi về địa chỉ Mỹ sau 3-8 tuần.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1">
              <p className="font-bold text-blue-900">Túi Hồ Sơ Niêm Phong:</p>
              <p>Nếu Lãnh sự giao túi hồ sơ giấy niêm phong màu nâu, TUYỆT ĐỐI KHÔNG ĐƯỢC BÓC MỞ. Chỉ viên chức Hải quan Mỹ (CBP) tại sân bay đầu tiên mới được phép mở.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
              <p className="font-bold text-emerald-900">Tài Chính & Hành Trang:</p>
              <p>Mang tiền mặt dưới $10,000 / gia đình (nếu mang trên $10k phải khai báo mẫu FinCEN 105). Không mang thực phẩm tươi, thịt động vật hoặc thuốc không rõ nguồn gốc.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
