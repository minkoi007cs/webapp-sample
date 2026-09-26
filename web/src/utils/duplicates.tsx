import { Modal } from 'antd';
import type { Sample } from '../api/sample';
import type { Category } from '../api/category';

type SampleCandidate = {
  id?: string;
  name?: string | null;
  categoryId?: string | null;
};

const normalizeText = (value: string | null | undefined) => (
  value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? ''
);

const normalizeId = (value: string | null | undefined) => value?.trim() || '';

export const findDuplicateSample = (samples: Sample[], candidate: SampleCandidate) => {
  const name = normalizeText(candidate.name);
  const categoryId = normalizeId(candidate.categoryId);

  if (!name || !categoryId) return null;

  return samples.find((sample) => {
    if (candidate.id && sample.id === candidate.id) return false;

    return normalizeText(sample.name) === name
      && normalizeId(sample.categoryId || sample.category?.id) === categoryId;
  }) ?? null;
};

// Backward compatibility alias
export const findDuplicateAsset = findDuplicateSample;

type DuplicateWarningOptions = {
  title: string;
  summary: string;
  detailLines: string[];
  okText?: string;
};

export const confirmDuplicateWarning = ({
  title,
  summary,
  detailLines,
  okText = 'Tiếp tục',
}: DuplicateWarningOptions) => new Promise<boolean>((resolve) => {
  Modal.confirm({
    title,
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>{summary}</p>
        <div className="rounded-lg bg-secondary p-3 text-foreground font-medium text-xs">
          {detailLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </div>
    ),
    okText,
    cancelText: 'Quay lại',
    onOk: () => resolve(true),
    onCancel: () => resolve(false),
  });
});

export const getCategoryLabel = (categories: Category[], categoryId?: string | null) => (
  categories.find((category) => category.id === categoryId)?.name || 'Chưa phân loại'
);

export const getSampleLabel = (samples: Sample[], sampleId?: string | null) => (
  samples.find((sample) => sample.id === sampleId)?.name || 'Chưa gán mẫu'
);
