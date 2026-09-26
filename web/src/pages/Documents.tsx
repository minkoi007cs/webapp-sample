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
import { documentApi, type GroupDocument, type DocumentSynthesisResponse } from '../api/document';
import { useSession } from '../components/auth/SessionProvider';

const CATEGORIES = [
  'All',
  'Medical & Health',
  'Real Estate & Property',
  'Identity & Civil Docs',
  'Education & Diplomas',
  'Bills & Contracts',
  'Samples & Specs',
  'Certificates & Quality',
  'Other',
];

const PROMPT_SUGGESTIONS = [
  { label: '📦 Mẫu & Đặc tính kỹ thuật', query: 'Tóm tắt các hồ sơ, đặc tính kỹ thuật và xuất xứ của các mẫu trong nhóm.' },
  { label: '📑 Giấy tờ pháp lý & Chứng nhận', query: 'Tổng hợp và đối chiếu các chứng chỉ chất lượng, kiểm định và giấy tờ pháp lý.' },
  { label: '🏥 Hồ sơ y tế & Sức khỏe', query: 'Tổng hợp hồ sơ khám sức khỏe và giấy tờ liên quan.' },
  { label: '📄 Hợp đồng & Hóa đơn', query: 'Liệt kê và tóm tắt các hóa đơn, hợp đồng đã lưu trữ.' },
];

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Medical & Health':
    case 'Y tế & Sức khỏe': return <HeartPulse className="w-4 h-4 text-rose-500" />;
    case 'Real Estate & Property':
    case 'Nhà đất & Bất động sản': return <Building className="w-4 h-4 text-amber-500" />;
    case 'Identity & Civil Docs':
    case 'Giấy tờ tùy thân': return <FileCheck className="w-4 h-4 text-blue-500" />;
    case 'Education & Diplomas':
    case 'Học tập & Giáo dục': return <GraduationCap className="w-4 h-4 text-emerald-500" />;
    case 'Bills & Contracts':
    case 'Hóa đơn & Hợp đồng': return <CreditCard className="w-4 h-4 text-purple-500" />;
    case 'Samples & Specs':
    case 'Mẫu & Đặc tính kỹ thuật': return <Car className="w-4 h-4 text-cyan-500" />;
    default: return <FileText className="w-4 h-4 text-muted-foreground" />;
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
  const { activeGroupName } = useSession();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<GroupDocument | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<GroupDocument | null>(null);

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
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
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
      message.success('Document uploaded and analyzed with AI successfully!');
      setIsUploadModalOpen(false);
      uploadForm.resetFields();
      setUploadFileList([]);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Failed to upload document');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: { id: string; data: any }) => {
      const res = await documentApi.update(values.id, values.data);
      return res.data;
    },
    onSuccess: (updated) => {
      message.success('Document details updated');
      setIsEditModalOpen(false);
      if (selectedDoc?.id === updated.id) setSelectedDoc(updated);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: () => message.error('Failed to update document'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await documentApi.delete(id);
    },
    onSuccess: () => {
      message.success('Document deleted successfully');
      setIsViewerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: () => message.error('Failed to delete document'),
  });

  const reanalyzeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await documentApi.reanalyze(id);
      return res.data;
    },
    onSuccess: (updated) => {
      message.success('Document re-analyzed successfully!');
      setSelectedDoc(updated);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: any) => message.error(err?.response?.data?.message || 'Failed to re-analyze document'),
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
      message.error(err?.response?.data?.message || 'AI dossier synthesis failed');
    },
  });

  const handleRunSynthesis = (promptText?: string) => {
    const q = promptText || synthesisQuery;
    if (!q.trim()) {
      message.warning('Please enter a query or topic for AI synthesis');
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
      message.success('Synthesis copied to clipboard');
    }
  };

  const handleCopyOcr = (text?: string) => {
    if (text) {
      navigator.clipboard.writeText(text);
      setIsOcrCopied(true);
      setTimeout(() => setIsOcrCopied(false), 2000);
      message.success('OCR content copied to clipboard');
    }
  };

  const handleUploadSubmit = async () => {
    const values = await uploadForm.validateFields();
    if (uploadFileList.length === 0 || !uploadFileList[0].originFileObj) {
      message.error('Please select an image or document file');
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

  const handleOpenEdit = (doc: GroupDocument) => {
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
      <div className="relative overflow-hidden rounded-[24px] border border-border bg-card p-6 lg:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {activeGroupName ? `Nhóm: ${activeGroupName}` : 'Kho lưu trữ tài liệu'}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight font-sans">
              Smart Document Repository & OCR
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload contracts, medical records, invoices, and certificates. AI automatically extracts text (OCR), categorizes documents, and synthesizes dossiers.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              type="primary"
              size="large"
              icon={<UploadCloud className="w-4 h-4" />}
              onClick={() => setIsUploadModalOpen(true)}
              className="rounded-xl h-11 px-5"
            >
              Upload Document (AI OCR)
            </Button>
          </div>
        </div>
      </div>

      {/* 2. AI Synthesis Dossier */}
      <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm transition-all">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsAiBoxExpanded(!isAiBoxExpanded)}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                AI Document Dossier & Synthesis
                <span className="text-[11px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                  GPT-4o Vision & OCR
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Query records, health chronologies, and asset documents to generate comparative summaries.
              </p>
            </div>
          </div>
          <Button type="text" size="small" className="text-xs text-muted-foreground">
            {isAiBoxExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>

        {isAiBoxExpanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-4">
            {/* Quick Suggestions */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Quick Prompts:</span>
              {PROMPT_SUGGESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleRunSynthesis(item.query)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border font-medium transition-all"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Prompt Input Box */}
            <div className="flex gap-2">
              <Input
                size="large"
                placeholder="e.g., Generate a chronological summary of vision tests, or summarize property purchase deeds..."
                value={synthesisQuery}
                onChange={(e) => setSynthesisQuery(e.target.value)}
                onPressEnter={() => handleRunSynthesis()}
                className="rounded-xl border-border"
                prefix={<Search className="w-4 h-4 text-muted-foreground mr-1" />}
                allowClear
              />
              <Button
                type="primary"
                size="large"
                loading={synthesizeMutation.isPending}
                onClick={() => handleRunSynthesis()}
                icon={<Send className="w-4 h-4" />}
                className="rounded-xl px-6 h-10 shrink-0"
              >
                Synthesize
              </Button>
            </div>

            {/* AI Result View */}
            {synthesizeMutation.isPending && (
              <div className="p-8 rounded-2xl bg-muted/30 border border-border flex flex-col items-center justify-center text-center space-y-3">
                <Spin size="large" />
                <p className="text-sm font-semibold text-foreground">
                  AI is analyzing relevant repository documents...
                </p>
                <p className="text-xs text-muted-foreground">
                  Cross-referencing metrics, timestamps, and structured data tables
                </p>
              </div>
            )}

            {synthesisResult && !synthesizeMutation.isPending && (
              <div className="p-5 rounded-2xl bg-muted/20 border border-border shadow-inner space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="font-bold text-sm text-foreground">AI Dossier Synthesis Result</span>
                  </div>
                  <Button
                    size="small"
                    icon={isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={handleCopySynthesis}
                    className="text-xs rounded-xl"
                  >
                    {isCopied ? 'Copied' : 'Copy'}
                  </Button>
                </div>

                {/* Markdown view */}
                <div className="prose prose-sm max-w-none text-foreground whitespace-pre-line leading-relaxed font-sans bg-card p-4 rounded-xl border border-border">
                  {synthesisResult.synthesis}
                </div>

                {/* Source Documents */}
                {synthesisResult.sourceDocuments && synthesisResult.sourceDocuments.length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Source documents referenced:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {synthesisResult.sourceDocuments.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
                        >
                          {doc.mimeType?.startsWith('image/') ? (
                            <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                          )}
                          <span className="max-w-[180px] truncate">{doc.title}</span>
                          <Download className="w-3 h-3 text-muted-foreground" />
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

      {/* 3. Search Bar & Category Filters */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="w-full md:max-w-md">
            <Input
              size="large"
              placeholder="Search title, OCR content, tags, notes..."
              prefix={<Search className="w-4 h-4 text-muted-foreground mr-1" />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              className="rounded-xl border-border"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1">
            {availableTags.length > 0 && (
              <Select
                placeholder="Filter by Tag"
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
              className="rounded-xl shrink-0"
              title="Refresh repository"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const count = cat === 'All' ? documents.length : (meta.categories[cat] || 0);
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border'
                }`}
              >
                {cat !== 'All' && getCategoryIcon(cat)}
                <span>{cat}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Document Grid Cards */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Spin size="large" />
          <p className="text-sm text-muted-foreground">Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="py-16 bg-card rounded-3xl border border-dashed border-border flex flex-col items-center justify-center text-center p-6 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <FolderArchive className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No documents found</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            {searchTerm || selectedCategory !== 'All' || selectedTag
              ? 'No documents match current filters.'
              : 'Click "Upload Document" to upload and OCR receipts, certificates, or real estate contracts.'}
          </p>
          <Button
            type="primary"
            icon={<UploadCloud className="w-4 h-4" />}
            onClick={() => setIsUploadModalOpen(true)}
            className="rounded-xl mt-2"
          >
            Upload First Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documents.map((doc) => {
            const isImage = doc.mimeType?.startsWith('image/');
            return (
              <div
                key={doc.id}
                className="group relative flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all"
              >
                {/* Thumbnail / Header */}
                <div
                  className="relative h-44 w-full overflow-hidden rounded-xl bg-muted/40 cursor-pointer border border-border flex items-center justify-center mb-3"
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
                    <div className="flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                      <FileText className="w-14 h-14 text-rose-400 mb-2" />
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wider">{doc.mimeType?.split('/')[1] || 'PDF/DOC'}</span>
                      <span className="text-[11px] text-muted-foreground mt-1 max-w-[200px] truncate">{doc.originalFileName}</span>
                    </div>
                  )}

                  {/* Category Badge overlay */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background/90 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm border border-border">
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
                    className="font-bold text-base text-foreground line-clamp-1 hover:text-primary cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedDoc(doc);
                      setIsViewerOpen(true);
                    }}
                    title={doc.title}
                  >
                    {doc.title}
                  </h3>

                  {/* AI Summary */}
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 flex-1 min-h-[32px]">
                    {doc.summary || (doc.extractedContent ? doc.extractedContent.slice(0, 120) : 'No summary generated.')}
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
                        <span className="text-[10px] text-muted-foreground self-center">+{doc.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="mt-3.5 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(doc.createdAt).toLocaleDateString('en-US')}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Tooltip title="View details & OCR extracted content">
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
                      <Tooltip title="Download file">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download>
                          <Button type="text" size="small" icon={<Download className="w-3.5 h-3.5" />} />
                        </a>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <Button
                          type="text"
                          size="small"
                          icon={<Edit3 className="w-3.5 h-3.5" />}
                          onClick={() => handleOpenEdit(doc)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="Delete this document?"
                        description="This will permanently delete the file and extracted OCR data."
                        okText="Delete"
                        cancelText="Cancel"
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

      {/* 5. Upload & AI OCR Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <Sparkles className="w-5 h-5 text-primary" />
            <span>Upload Document & AI OCR Extraction</span>
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
          <p className="text-xs text-muted-foreground">
            Supports images (JPG, PNG, WEBP, HEIC), PDF, and text. AI extracts text, dates, names, amounts, and structured summaries.
          </p>

          <Form form={uploadForm} layout="vertical">
            <Form.Item label="Select Attachment" required>
              <Upload.Dragger
                fileList={uploadFileList}
                maxCount={1}
                beforeUpload={(file) => {
                  setUploadFileList([file as any]);
                  return false;
                }}
                onRemove={() => setUploadFileList([])}
                accept="image/*,.pdf,.doc,.docx,.txt"
                className="rounded-2xl"
              >
                <div className="p-4 flex flex-col items-center justify-center space-y-2 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Drag and drop file here, or click to browse</p>
                  <p className="text-xs text-muted-foreground">Receipts, certificates, contracts, and medical scans (Max 25MB)</p>
                </div>
              </Upload.Dragger>
            </Form.Item>

            <Form.Item name="title" label="Document Title (Optional — AI auto-names if empty)">
              <Input placeholder="e.g., Annual Vision Prescription, House Deed..." size="large" />
            </Form.Item>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Form.Item name="category" label="Category">
                <Select placeholder="Select category" size="large">
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <Select.Option key={c} value={c}>{c}</Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="tags" label="Tags">
                <Select mode="tags" placeholder="Enter tags and press Enter" size="large" />
              </Form.Item>
            </div>

            <Form.Item name="userNote" label="Context Notes for AI (Optional)">
              <Input.TextArea
                placeholder="e.g., Routine eye exam for child in December..."
                rows={2}
              />
            </Form.Item>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button onClick={() => setIsUploadModalOpen(false)} disabled={uploadMutation.isPending}>
                Cancel
              </Button>
              <Button
                type="primary"
                loading={uploadMutation.isPending}
                onClick={handleUploadSubmit}
                icon={<Sparkles className="w-4 h-4" />}
              >
                {uploadMutation.isPending ? 'Reading & Analyzing AI...' : 'Upload & Analyze'}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* 6. Document Detail & OCR Viewer Modal */}
      <Modal
        title={
          selectedDoc && (
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-2">
                {getCategoryIcon(selectedDoc.category)}
                <span className="font-bold text-base text-foreground">{selectedDoc.title}</span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
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
            {/* Left Column: Preview */}
            <div className="lg:col-span-5 space-y-3">
              <div className="rounded-2xl border border-border overflow-hidden bg-muted/30 flex items-center justify-center min-h-[280px] max-h-[460px]">
                {selectedDoc.mimeType?.startsWith('image/') ? (
                  <img
                    src={selectedDoc.fileUrl}
                    alt={selectedDoc.title}
                    className="w-full h-auto max-h-[460px] object-contain"
                  />
                ) : (
                  <div className="p-8 text-center space-y-3">
                    <FileText className="w-20 h-20 text-rose-400 mx-auto" />
                    <p className="text-sm font-semibold text-foreground">{selectedDoc.originalFileName}</p>
                    <p className="text-xs text-muted-foreground">{selectedDoc.mimeType} · {formatFileSize(selectedDoc.fileSize)}</p>
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
                    Open Original
                  </Button>
                </a>
                <a
                  href={selectedDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex-1"
                >
                  <Button type="primary" block icon={<Download className="w-4 h-4" />}>
                    Download
                  </Button>
                </a>
              </div>

              {/* Tags */}
              {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-xs font-semibold text-foreground block mb-1.5">Tags:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedDoc.tags.map((t, i) => (
                      <Tag key={i} color="orange">#{t}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: AI Extraction, Summary & Structured Data */}
            <div className="lg:col-span-7 space-y-4">
              {/* Summary */}
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    AI Summary
                  </span>
                  <Button
                    size="small"
                    type="text"
                    loading={reanalyzeMutation.isPending}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => reanalyzeMutation.mutate(selectedDoc.id)}
                    className="text-xs text-primary"
                  >
                    Re-analyze
                  </Button>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {selectedDoc.summary || 'No summary available.'}
                </p>
              </div>

              {/* Structured Data */}
              {selectedDoc.structuredData && Object.keys(selectedDoc.structuredData).length > 0 && (
                <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                    Extracted Metrics & Structured Data:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(selectedDoc.structuredData).map(([k, v]) => {
                      if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return null;
                      return (
                        <div key={k} className="p-2 rounded-lg bg-muted/40 border border-border">
                          <span className="text-muted-foreground block text-[11px] capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="font-semibold text-foreground">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Extracted OCR Text */}
              <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-500" />
                    Extracted OCR Text
                  </span>
                  <Button
                    size="small"
                    type="text"
                    icon={isOcrCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={() => handleCopyOcr(selectedDoc.extractedContent)}
                    className="text-xs"
                  >
                    {isOcrCopied ? 'Copied' : 'Copy Text'}
                  </Button>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border max-h-56 overflow-y-auto font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                  {selectedDoc.extractedContent || 'No text extracted from document.'}
                </div>
              </div>

              {/* Meta */}
              <div className="text-[11px] text-muted-foreground flex justify-between items-center px-1">
                <span>Created: {new Date(selectedDoc.createdAt).toLocaleString('en-US')}</span>
                <Button type="link" size="small" onClick={() => handleOpenEdit(selectedDoc)}>
                  Edit Metadata
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 7. Edit Modal */}
      <Modal
        title="Edit Document Details"
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit} className="pt-2">
          <Form.Item name="title" label="Document Title" rules={[{ required: true, message: 'Please enter title' }]}>
            <Input size="large" />
          </Form.Item>

          <Form.Item name="category" label="Category">
            <Select size="large">
              {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="tags" label="Tags">
            <Select mode="tags" size="large" />
          </Form.Item>

          <Form.Item name="summary" label="Summary">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="userNote" label="Context Notes">
            <Input.TextArea rows={2} />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
