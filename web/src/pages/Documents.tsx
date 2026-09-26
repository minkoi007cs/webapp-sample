import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Input,
  Modal,
  Form,
  Select,
  Upload,
  Tag,
  Tooltip,
  message,
  Popconfirm,
  Spin,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  Search,
  UploadCloud,
  FileText,
  Sparkles,
  Download,
  Eye,
  Trash2,
  Edit3,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  Send,
  Building,
  HeartPulse,
  CreditCard,
  GraduationCap,
  Car,
  FileCheck,
  FolderArchive,
} from 'lucide-react';
import { documentApi, type FamilyDocument, type DocumentSynthesisResponse } from '../api/document';
import { useSession } from '../components/auth/SessionProvider';

const CATEGORIES = [
  'Tất cả',
  'Y tế & Sức khỏe',
  'Nhà đất & Bất động sản',
  'Giấy tờ tùy thân',
  'Học tập & Giáo dục',
  'Hóa đơn & Hợp đồng',
  'Xe cộ & Tài sản',
  'Tài chính & Bảo hiểm',
  'Khác',
];

const PROMPT_SUGGESTIONS = [
  { label: '🏡 Hồ sơ về nhà Mỹ Ca', query: 'Hãy tổng hợp toàn bộ hồ sơ, giấy tờ, diễn tiến lịch sử và thông tin liên quan đến nhà Mỹ Ca' },
  { label: '👓 Lịch sử đo kính Mi Mi', query: 'Lập bảng theo dõi lịch sử các lần đo mắt, độ cận, độ loạn và cắt kính của Mi Mi' },
  { label: '🏥 Sổ khám & Tiêm chủng', query: 'Tổng hợp tình hình khám chữa bệnh, đơn thuốc và lịch tiêm chủng của gia đình' },
  { label: '📑 Giấy tờ tùy thân quan trọng', query: 'Liệt kê và tóm tắt các giấy tờ tùy thân, CCCD, hộ chiếu và bằng cấp hiện có' },
];

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Y tế & Sức khỏe': return <HeartPulse className="w-4 h-4 text-rose-500" />;
    case 'Nhà đất & Bất động sản': return <Building className="w-4 h-4 text-amber-500" />;
    case 'Giấy tờ tùy thân': return <FileCheck className="w-4 h-4 text-blue-500" />;
    case 'Học tập & Giáo dục': return <GraduationCap className="w-4 h-4 text-emerald-500" />;
    case 'Hóa đơn & Hợp đồng': return <CreditCard className="w-4 h-4 text-purple-500" />;
    case 'Xe cộ & Tài sản': return <Car className="w-4 h-4 text-cyan-500" />;
    default: return <FileText className="w-4 h-4 text-slate-500" />;
  }
};

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const Documents = () => {
  const queryClient = useQueryClient();
  const { activeFamilyName } = useSession();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<FamilyDocument | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<FamilyDocument | null>(null);

  // AI Dossier / Synthesis state
  const [isAiBoxExpanded, setIsAiBoxExpanded] = useState(true);
  const [synthesisQuery, setSynthesisQuery] = useState('');
  const [synthesisResult, setSynthesisResult] = useState<DocumentSynthesisResponse | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isOcrCopied, setIsOcrCopied] = useState(false);

  // Upload Form
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const [uploadForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Fetch documents query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', selectedCategory, selectedTag, searchTerm],
    queryFn: async () => {
      const res = await documentApi.getAll({
        search: searchTerm || undefined,
        category: selectedCategory !== 'Tất cả' ? selectedCategory : undefined,
        tag: selectedTag || undefined,
        pageSize: 100,
      });
      return res.data;
    },
  });

  const documents = data?.items || [];
  const meta = data?.meta || { categories: {}, availableTags: [] };

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: async (values: { file: File; title?: string; category?: string; tags?: string[]; userNote?: string }) => {
      const res = await documentApi.upload(values.file, {
        title: values.title,
        category: values.category,
        tags: values.tags,
        userNote: values.userNote,
      });
      return res.data;
    },
    onSuccess: () => {
      message.success('Tải lên và trích xuất tài liệu bằng AI thành công!');
      setIsUploadModalOpen(false);
      uploadForm.resetFields();
      setUploadFileList([]);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Không thể tải tài liệu lên');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: { id: string; data: any }) => {
      const res = await documentApi.update(values.id, values.data);
      return res.data;
    },
    onSuccess: (updated) => {
      message.success('Đã cập nhật thông tin tài liệu');
      setIsEditModalOpen(false);
      if (selectedDoc?.id === updated.id) setSelectedDoc(updated);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: () => message.error('Cập nhật thất bại'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await documentApi.delete(id);
    },
    onSuccess: () => {
      message.success('Đã xóa tài liệu');
      setIsViewerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: () => message.error('Không thể xóa tài liệu'),
  });

  const reanalyzeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await documentApi.reanalyze(id);
      return res.data;
    },
    onSuccess: (updated) => {
      message.success('Đã phân tích lại tài liệu thành công!');
      setSelectedDoc(updated);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: any) => message.error(err?.response?.data?.message || 'Phân tích lại thất bại'),
  });

  const synthesizeMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await documentApi.synthesize(q);
      return res.data;
    },
    onSuccess: (resData) => {
      setSynthesisResult(resData);
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Lỗi khi trợ lý AI tổng hợp dữ liệu');
    },
  });

  const handleRunSynthesis = (promptText?: string) => {
    const q = promptText || synthesisQuery;
    if (!q.trim()) {
      message.warning('Vui lòng nhập chủ đề bạn muốn AI tổng hợp');
      return;
    }
    setSynthesisQuery(q);
    synthesizeMutation.mutate(q);
  };

  const handleCopySynthesis = () => {
    if (synthesisResult?.synthesis) {
      navigator.clipboard.writeText(synthesisResult.synthesis);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      message.success('Đã sao chép bản tổng hợp');
    }
  };

  const handleCopyOcr = (text?: string) => {
    if (text) {
      navigator.clipboard.writeText(text);
      setIsOcrCopied(true);
      setTimeout(() => setIsOcrCopied(false), 2000);
      message.success('Đã sao chép toàn bộ nội dung văn bản');
    }
  };

  const handleUploadSubmit = async () => {
    const values = await uploadForm.validateFields();
    if (uploadFileList.length === 0 || !uploadFileList[0].originFileObj) {
      message.error('Vui lòng chọn 1 file hình ảnh hoặc tài liệu');
      return;
    }
    uploadMutation.mutate({
      file: uploadFileList[0].originFileObj as File,
      title: values.title,
      category: values.category,
      tags: values.tags,
      userNote: values.userNote,
    });
  };

  const handleOpenEdit = (doc: FamilyDocument) => {
    setEditingDoc(doc);
    editForm.setFieldsValue({
      title: doc.title,
      category: doc.category,
      tags: doc.tags || [],
      userNote: doc.userNote,
      summary: doc.summary,
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingDoc) return;
    const values = await editForm.validateFields();
    updateMutation.mutate({ id: editingDoc.id, data: values });
  };

  const availableTags = useMemo(() => meta.availableTags || [], [meta]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-r from-[#fff7f2] via-[#fffbf9] to-[#f5fcf8] p-6 lg:p-8 shadow-[0_16px_36px_rgba(242,204,183,0.15)] backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f97370]/15 text-[#f97370]">
                <Layers className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">
                {activeFamilyName ? `Gia đình: ${activeFamilyName}` : 'Kho Dữ Liệu Gia Đình'}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#44332d] tracking-tight">
              Kho Lưu Trữ & Trích Xuất Tài Liệu Thông Minh
            </h1>
            <p className="mt-1 text-sm text-[#735c53]">
              Tải lên mọi hóa đơn, sổ đỏ, phiếu khám, giấy tờ tùy thân. AI tự động đọc nội dung (OCR), phân loại và tổng hợp hồ sơ.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              type="primary"
              size="large"
              icon={<UploadCloud className="w-4 h-4" />}
              onClick={() => setIsUploadModalOpen(true)}
              className="!bg-[linear-gradient(135deg,#ff9f90,#f97370)] hover:brightness-105 border-none shadow-md shadow-[#f97370]/20 rounded-2xl h-11 px-5"
            >
              Tải tài liệu lên (AI Phân tích)
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Trợ lý AI Tổng hợp Hồ sơ Chuyên đề (AI Synthesis Dossier) */}
      <div className="rounded-[24px] border border-[#fbdcd0] bg-white/90 p-5 shadow-[0_12px_32px_rgba(247,163,143,0.1)] transition-all">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsAiBoxExpanded(!isAiBoxExpanded)}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#ff9f90] to-[#f97370] text-white shadow-sm shadow-[#f97370]/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#4a3a34] flex items-center gap-2">
                Trợ lý AI Tổng Hợp Hồ Sơ Chuyên Đề
                <span className="text-[11px] font-semibold bg-[#ffefe9] text-[#f97370] px-2 py-0.5 rounded-full border border-[#ffd5c8]">
                  GPT-4o Trích Xuất
                </span>
              </h2>
              <p className="text-xs text-[#7e6960]">
                Hỏi bất kỳ điều gì về hồ sơ nhà đất, lịch sử đo kính, sổ tiêm chủng để nhận bản tổng hợp có dòng thời gian & bảng so sánh.
              </p>
            </div>
          </div>
          <Button type="text" size="small" className="text-xs text-[#7e6960]">
            {isAiBoxExpanded ? 'Thu gọn' : 'Mở rộng'}
          </Button>
        </div>

        {isAiBoxExpanded && (
          <div className="mt-4 pt-4 border-t border-[#f5ded4]/80 space-y-4">
            {/* Gợi ý chủ đề nhanh */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[#7e6960]">Gợi ý nhanh:</span>
              {PROMPT_SUGGESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleRunSynthesis(item.query)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-[#fff6f2] hover:bg-[#ffece4] text-[#c2410c] border border-[#fed7aa] font-medium transition-all hover:scale-[1.02] active:scale-95"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Ô nhập câu hỏi tổng hợp */}
            <div className="flex gap-2">
              <Input
                size="large"
                placeholder="Ví dụ: Lập báo cáo tổng hợp hồ sơ nhà Mỹ Ca, hoặc tóm tắt các lần đo mắt của Mi Mi..."
                value={synthesisQuery}
                onChange={(e) => setSynthesisQuery(e.target.value)}
                onPressEnter={() => handleRunSynthesis()}
                className="rounded-2xl border-[#fcd3c1] focus:border-[#f97370]"
                prefix={<Search className="w-4 h-4 text-[#a89085] mr-1" />}
                allowClear
              />
              <Button
                type="primary"
                size="large"
                loading={synthesizeMutation.isPending}
                onClick={() => handleRunSynthesis()}
                icon={<Send className="w-4 h-4" />}
                className="!bg-[#f97370] hover:!bg-[#e05b58] rounded-2xl px-6 h-10 border-none shrink-0"
              >
                Tổng hợp
              </Button>
            </div>

            {/* Kết quả tổng hợp AI */}
            {synthesizeMutation.isPending && (
              <div className="p-8 rounded-2xl bg-[#fff9f6] border border-[#fed7aa] flex flex-col items-center justify-center text-center space-y-3">
                <Spin size="large" />
                <p className="text-sm font-semibold text-[#4a3a34]">
                  Trợ lý AI đang đọc toàn bộ tài liệu liên quan và lập bản tổng hợp...
                </p>
                <p className="text-xs text-[#8c746a]">
                  Đang đối chiếu số liệu, phân tích mốc thời gian và trích xuất bảng thông số chi tiết
                </p>
              </div>
            )}

            {synthesisResult && !synthesizeMutation.isPending && (
              <div className="p-5 rounded-2xl bg-[#fffdfc] border border-[#fcd5c7] shadow-inner space-y-4">
                <div className="flex items-center justify-between border-b border-[#f5ded4] pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="font-bold text-sm text-[#4a3a34]">Bản Tổng Hợp Hồ Sơ Từ AI</span>
                  </div>
                  <Button
                    size="small"
                    icon={isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={handleCopySynthesis}
                    className="text-xs rounded-xl"
                  >
                    {isCopied ? 'Đã sao chép' : 'Sao chép'}
                  </Button>
                </div>

                {/* Markdown view */}
                <div className="prose prose-sm max-w-none text-[#3d2f2a] whitespace-pre-line leading-relaxed font-sans bg-white/70 p-4 rounded-xl border border-slate-100">
                  {synthesisResult.synthesis}
                </div>

                {/* Nguồn tài liệu tham chiếu */}
                {synthesisResult.sourceDocuments && synthesisResult.sourceDocuments.length > 0 && (
                  <div className="pt-3 border-t border-[#f5ded4]">
                    <p className="text-xs font-semibold text-[#7e6960] mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Tài liệu nguồn được sử dụng để tổng hợp:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {synthesisResult.sourceDocuments.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#fed7aa] text-xs font-medium text-[#c2410c] hover:bg-[#fff6f2] hover:border-[#f97370] transition-colors shadow-sm"
                        >
                          {doc.mimeType?.startsWith('image/') ? (
                            <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                          )}
                          <span className="max-w-[180px] truncate">{doc.title}</span>
                          <Download className="w-3 h-3 text-slate-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Thanh Tìm Kiếm & Bộ Lọc Danh Mục */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="w-full md:max-w-md">
            <Input
              size="large"
              placeholder="Tìm theo tiêu đề, nội dung OCR, người liên quan, số đo..."
              prefix={<Search className="w-4 h-4 text-slate-400 mr-1" />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              className="rounded-2xl border-slate-200"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1">
            {availableTags.length > 0 && (
              <Select
                placeholder="Lọc theo thẻ (Tag)"
                allowClear
                value={selectedTag}
                onChange={(val) => setSelectedTag(val)}
                className="min-w-[150px]"
                size="large"
                options={availableTags.map((t) => ({ label: `#${t}`, value: t }))}
              />
            )}
            <Button
              size="large"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => refetch()}
              className="rounded-2xl shrink-0"
              title="Làm mới danh sách"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const count = cat === 'Tất cả' ? documents.length : (meta.categories[cat] || 0);
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#f97370] text-white shadow-md shadow-[#f97370]/30 scale-[1.02]'
                    : 'bg-white/80 text-[#5c4a43] hover:bg-white hover:text-[#f97370] border border-slate-200/80'
                }`}
              >
                {cat !== 'Tất cả' && getCategoryIcon(cat)}
                <span>{cat}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Danh Sách Tài Liệu (Grid Cards) */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Spin size="large" />
          <p className="text-sm text-slate-500">Đang nạp kho tài liệu gia đình...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="py-16 bg-white/70 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-6 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#ffefe9] flex items-center justify-center text-[#f97370]">
            <FolderArchive className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#4a3a34]">Chưa có tài liệu nào</h3>
          <p className="text-xs text-[#7e6960] max-w-md">
            {searchTerm || selectedCategory !== 'Tất cả' || selectedTag
              ? 'Không tìm thấy tài liệu phù hợp với bộ lọc hiện tại.'
              : 'Hãy bấm nút "Tải tài liệu lên" để lưu trữ hóa đơn, sổ đỏ, phiếu khám bệnh hoặc giấy tờ quan trọng của gia đình.'}
          </p>
          <Button
            type="primary"
            icon={<UploadCloud className="w-4 h-4" />}
            onClick={() => setIsUploadModalOpen(true)}
            className="!bg-[#f97370] rounded-xl mt-2"
          >
            Tải lên tài liệu đầu tiên
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documents.map((doc) => {
            const isImage = doc.mimeType?.startsWith('image/');
            return (
              <div
                key={doc.id}
                className="group relative flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-all hover:border-[#fcd5c7]"
              >
                {/* Thumbnail / Header */}
                <div
                  className="relative h-44 w-full overflow-hidden rounded-xl bg-slate-50 cursor-pointer border border-slate-100 flex items-center justify-center mb-3"
                  onClick={() => {
                    setSelectedDoc(doc);
                    setIsViewerOpen(true);
                  }}
                >
                  {isImage && doc.fileUrl ? (
                    <img
                      src={doc.fileUrl}
                      alt={doc.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                      <FileText className="w-14 h-14 text-rose-400 mb-2" />
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{doc.mimeType?.split('/')[1] || 'PDF/DOC'}</span>
                      <span className="text-[11px] text-slate-400 mt-1 max-w-[200px] truncate">{doc.originalFileName}</span>
                    </div>
                  )}

                  {/* Category Badge overlay */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/95 text-xs font-semibold text-[#4a3a34] shadow-sm backdrop-blur-sm">
                      {getCategoryIcon(doc.category)}
                      <span>{doc.category}</span>
                    </span>
                  </div>

                  {/* Size overlay */}
                  <div className="absolute bottom-2.5 right-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-black/60 text-[10px] font-medium text-white backdrop-blur-sm">
                      {formatFileSize(doc.fileSize)}
                    </span>
                  </div>
                </div>

                {/* Body Details */}
                <div className="flex-1 flex flex-col">
                  <h3
                    className="font-bold text-base text-[#4a3a34] line-clamp-1 hover:text-[#f97370] cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedDoc(doc);
                      setIsViewerOpen(true);
                    }}
                    title={doc.title}
                  >
                    {doc.title}
                  </h3>

                  {/* Tóm tắt AI */}
                  <p className="text-xs text-[#7e6960] line-clamp-2 mt-1.5 flex-1 min-h-[32px]">
                    {doc.summary || (doc.extractedContent ? doc.extractedContent.slice(0, 120) : 'Chưa có bản tóm tắt nội dung.')}
                  </p>

                  {/* Tags */}
                  {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {doc.tags.slice(0, 3).map((t, idx) => (
                        <Tag
                          key={idx}
                          color="orange"
                          className="!text-[10px] !rounded-md !px-1.5 !py-0 cursor-pointer"
                          onClick={() => setSelectedTag(t)}
                        >
                          #{t}
                        </Tag>
                      ))}
                      {doc.tags.length > 3 && (
                        <span className="text-[10px] text-slate-400 self-center">+{doc.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#8c746a]">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(doc.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Tooltip title="Xem chi tiết & Nội dung trích xuất">
                        <Button
                          type="text"
                          size="small"
                          icon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setSelectedDoc(doc);
                            setIsViewerOpen(true);
                          }}
                        />
                      </Tooltip>
                      <Tooltip title="Tải file về máy">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download>
                          <Button type="text" size="small" icon={<Download className="w-3.5 h-3.5" />} />
                        </a>
                      </Tooltip>
                      <Tooltip title="Chỉnh sửa">
                        <Button
                          type="text"
                          size="small"
                          icon={<Edit3 className="w-3.5 h-3.5" />}
                          onClick={() => handleOpenEdit(doc)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="Xác nhận xóa tài liệu?"
                        description="Hành động này sẽ xóa vĩnh viễn file và dữ liệu trích xuất."
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => deleteMutation.mutate(doc.id)}
                      >
                        <Button type="text" danger size="small" icon={<Trash2 className="w-3.5 h-3.5" />} />
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Modal Tải Lên & AI Phân Tích (Upload Modal) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-[#4a3a34]">
            <Sparkles className="w-5 h-5 text-[#f97370]" />
            <span>Tải Lên Tài Liệu & Phân Tích Tự Động Bằng AI</span>
          </div>
        }
        open={isUploadModalOpen}
        onCancel={() => {
          if (!uploadMutation.isPending) {
            setIsUploadModalOpen(false);
            uploadForm.resetFields();
            setUploadFileList([]);
          }
        }}
        footer={null}
        width={600}
        centered
        destroyOnClose
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-[#7e6960]">
            Hỗ trợ hình ảnh (JPG, PNG, WEBP, HEIC) hoặc PDF, văn bản. AI sẽ tự động đọc chữ (OCR), nhận diện tên người, số liệu, mốc thời gian và lập tóm tắt.
          </p>

          <Form form={uploadForm} layout="vertical">
            {/* File Upload Box */}
            <Form.Item label="Chọn tệp đính kèm" required>
              <Upload.Dragger
                fileList={uploadFileList}
                maxCount={1}
                beforeUpload={(file) => {
                  setUploadFileList([file as any]);
                  return false;
                }}
                onRemove={() => setUploadFileList([])}
                accept="image/*,.pdf,.doc,.docx,.txt"
                className="!bg-[#fffbf9] !border-[#fed7aa] rounded-2xl"
              >
                <div className="p-4 flex flex-col items-center justify-center space-y-2 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#ffefe9] flex items-center justify-center text-[#f97370]">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-[#4a3a34]">Kéo thả file vào đây hoặc bấm để duyệt</p>
                  <p className="text-xs text-slate-400">Hình ảnh hóa đơn, sổ đỏ, phiếu khám, hợp đồng (tối đa 25MB)</p>
                </div>
              </Upload.Dragger>
            </Form.Item>

            <Form.Item name="title" label="Tiêu đề gợi ý (Tùy chọn - để trống AI sẽ tự đặt)">
              <Input placeholder="Ví dụ: Phiếu khám mắt Mi Mi, Sổ hồng nhà Mỹ Ca..." size="large" />
            </Form.Item>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Form.Item name="category" label="Danh mục">
                <Select placeholder="Chọn danh mục" size="large">
                  {CATEGORIES.filter((c) => c !== 'Tất cả').map((c) => (
                    <Select.Option key={c} value={c}>{c}</Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="tags" label="Thẻ từ khóa (Tags)">
                <Select mode="tags" placeholder="Nhập tag rồi ấn Enter" size="large" />
              </Form.Item>
            </div>

            <Form.Item name="userNote" label="Ghi chú thêm cho AI (Tùy chọn)">
              <Input.TextArea
                placeholder="Ví dụ: Đây là đợt khám mắt định kỳ tháng 12 của bé Mi Mi..."
                rows={2}
              />
            </Form.Item>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button onClick={() => setIsUploadModalOpen(false)} disabled={uploadMutation.isPending}>
                Hủy
              </Button>
              <Button
                type="primary"
                loading={uploadMutation.isPending}
                onClick={handleUploadSubmit}
                icon={<Sparkles className="w-4 h-4" />}
                className="!bg-[#f97370] hover:!bg-[#e05b58] border-none px-5"
              >
                {uploadMutation.isPending ? 'Đang đọc & phân tích AI...' : 'Tải lên & Phân tích'}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* 6. Modal Chi Tiết Tài Liệu & Nội Dung OCR (Viewer Modal) */}
      <Modal
        title={
          selectedDoc && (
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-2">
                {getCategoryIcon(selectedDoc.category)}
                <span className="font-bold text-base text-[#4a3a34]">{selectedDoc.title}</span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {selectedDoc.category}
              </span>
            </div>
          )
        }
        open={isViewerOpen}
        onCancel={() => setIsViewerOpen(false)}
        footer={null}
        width={950}
        centered
        destroyOnClose
      >
        {selectedDoc && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-3 max-h-[78vh] overflow-y-auto pr-1">
            {/* Cột Trái: Xem Trước File */}
            <div className="lg:col-span-5 space-y-3">
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center min-h-[280px] max-h-[460px]">
                {selectedDoc.mimeType?.startsWith('image/') ? (
                  <img
                    src={selectedDoc.fileUrl}
                    alt={selectedDoc.title}
                    className="w-full h-auto max-h-[460px] object-contain"
                  />
                ) : (
                  <div className="p-8 text-center space-y-3">
                    <FileText className="w-20 h-20 text-rose-400 mx-auto" />
                    <p className="text-sm font-semibold text-slate-700">{selectedDoc.originalFileName}</p>
                    <p className="text-xs text-slate-400">{selectedDoc.mimeType} · {formatFileSize(selectedDoc.fileSize)}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <a
                  href={selectedDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button block icon={<Eye className="w-4 h-4" />}>
                    Mở tệp gốc
                  </Button>
                </a>
                <a
                  href={selectedDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex-1"
                >
                  <Button type="primary" block icon={<Download className="w-4 h-4" />} className="!bg-[#f97370]">
                    Tải về máy
                  </Button>
                </a>
              </div>

              {/* Tags list */}
              {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-semibold text-slate-600 block mb-1.5">Thẻ từ khóa:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedDoc.tags.map((t, i) => (
                      <Tag key={i} color="orange">#{t}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cột Phải: Nội dung trích xuất AI, Tóm tắt & Dữ liệu có cấu trúc */}
            <div className="lg:col-span-7 space-y-4">
              {/* Tóm tắt AI */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#fff9f6] to-[#fffbf9] border border-[#fcd5c7] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#c2410c] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#f97370]" />
                    Tóm Tắt Nội Dung (AI)
                  </span>
                  <Button
                    size="small"
                    type="text"
                    loading={reanalyzeMutation.isPending}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => reanalyzeMutation.mutate(selectedDoc.id)}
                    className="text-xs text-[#c2410c]"
                  >
                    Phân tích lại
                  </Button>
                </div>
                <p className="text-sm text-[#44332d] leading-relaxed">
                  {selectedDoc.summary || 'Chưa có tóm tắt.'}
                </p>
              </div>

              {/* Dữ liệu có cấu trúc (Structured Data) */}
              {selectedDoc.structuredData && Object.keys(selectedDoc.structuredData).length > 0 && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Thông số & Dữ liệu trích xuất quan trọng:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(selectedDoc.structuredData).map(([k, v]) => {
                      if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return null;
                      return (
                        <div key={k} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 block text-[11px] capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="font-semibold text-slate-800">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Toàn bộ văn bản OCR Trích xuất */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-500" />
                    Toàn Bộ Văn Bản Đọc Được (OCR)
                  </span>
                  <Button
                    size="small"
                    type="text"
                    icon={isOcrCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={() => handleCopyOcr(selectedDoc.extractedContent)}
                    className="text-xs"
                  >
                    {isOcrCopied ? 'Đã sao chép' : 'Sao chép chữ'}
                  </Button>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 max-h-56 overflow-y-auto font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {selectedDoc.extractedContent || 'Không tìm thấy nội dung văn bản trích xuất.'}
                </div>
              </div>

              {/* Thông tin Meta */}
              <div className="text-[11px] text-slate-600 flex justify-between items-center px-1">
                <span>Ngày tạo: {new Date(selectedDoc.createdAt).toLocaleString('vi-VN')}</span>
                <Button type="link" size="small" onClick={() => handleOpenEdit(selectedDoc)}>
                  Chỉnh sửa thông tin
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 7. Modal Chỉnh Sửa Thông Tin Tài Liệu */}
      <Modal
        title="Chỉnh sửa thông tin tài liệu"
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit} className="pt-2">
          <Form.Item name="title" label="Tiêu đề tài liệu" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}>
            <Input size="large" />
          </Form.Item>

          <Form.Item name="category" label="Danh mục">
            <Select size="large">
              {CATEGORIES.filter((c) => c !== 'Tất cả').map((c) => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="tags" label="Thẻ từ khóa (Tags)">
            <Select mode="tags" size="large" />
          </Form.Item>

          <Form.Item name="summary" label="Bản tóm tắt">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="userNote" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => setIsEditModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={updateMutation.isPending} className="!bg-[#f97370]">
              Lưu thay đổi
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
