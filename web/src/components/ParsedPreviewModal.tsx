import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Radio, Space, Typography, Tag, Divider, Select, Button } from 'antd';
import { X, Check } from 'lucide-react';
import dayjs from 'dayjs';
import { userApi } from '../api/user';
import { asArray } from '../api/client';
import { buildCategoryPathLabel, categoryApi } from '../api/category';
import { sampleApi } from '../api/sample';
import type { User } from '../api/user';
import type { Category } from '../api/category';
import type { Sample } from '../api/sample';
import {
  confirmDuplicateWarning,
  findDuplicateSample,
  getCategoryLabel,
} from '../utils/duplicates';

const { Text } = Typography;

interface ParsedPreviewModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (data: any) => void | Promise<void>;
  parsedData: any;
  loading?: boolean;
}

export const ParsedPreviewModal: React.FC<ParsedPreviewModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  parsedData,
  loading,
}) => {
  const [form] = Form.useForm();
  const [intent, setIntent] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    if (visible) {
      Promise.all([
        userApi.findAll(),
        categoryApi.findAll(),
        sampleApi.findAll(),
      ]).then(([userRes, catRes, sampleRes]) => {
        setUsers(asArray(userRes.data));
        setCategories(catRes.data);
        setSamples(asArray(sampleRes.data));
      });
    }
  }, [visible]);

  useEffect(() => {
    if (parsedData && visible) {
      const rawIntent = parsedData.intent === 'create_asset' ? 'create_sample' : parsedData.intent;
      setIntent(rawIntent);

      const rawData = parsedData.data || {};
      const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const sanitizeId = (id: any) => (isUUID(id) ? id : undefined);

      const mappedData = {
        ...rawData,
        name: rawData.name || parsedData.originalText,
        description: parsedData.originalText || rawData.description || rawData.note,
        categoryId: sanitizeId(rawData.categoryId || rawData.category),
        startDate: rawData.startDate || rawData.date,
        recurrenceRule: rawData.recurrenceRule,
        participantIds: rawData.participantIds || (rawData.participants ? rawData.participants.map((p: any) => typeof p === 'string' ? sanitizeId(p) : sanitizeId(p.id)) : []),
      };

      form.setFieldsValue({
        ...mappedData,
        startDate: mappedData.startDate ? dayjs(mappedData.startDate) : dayjs(),
        date: mappedData.date ? dayjs(mappedData.date) : dayjs(),
      });
    }
  }, [parsedData, visible, form]);

  const handleFinish = async (values: any) => {
    const formattedValues: any = {
      ...values,
      date: values.date?.format('YYYY-MM-DD'),
      participantIds: values.participantIds,
    };

    if (intent === 'create_event' || intent === 'create_task') {
      let start = values.startDate ? dayjs(values.startDate) : dayjs();
      if (values.time && typeof values.time === 'string' && values.time.includes(':')) {
        const [hours, minutes] = values.time.split(':');
        start = start.hour(parseInt(hours) || 0).minute(parseInt(minutes) || 0).second(0).millisecond(0);
      }
      formattedValues.startDate = start.toISOString();
    }

    if (intent === 'create_sample' || intent === 'create_asset') {
      const duplicateSample = findDuplicateSample(samples, {
        name: formattedValues.name,
        categoryId: formattedValues.categoryId,
      });

      if (duplicateSample) {
        const shouldContinue = await confirmDuplicateWarning({
          title: 'Phát hiện mẫu trùng tên',
          summary: 'Đã có mẫu cùng tên và phân loại trong nhóm. Bạn có muốn tiếp tục lưu?',
          detailLines: [
            `Tên mẫu: ${formattedValues.name || '-'}`,
            `Phân loại: ${getCategoryLabel(categories, formattedValues.categoryId)}`,
          ],
        });

        if (!shouldContinue) return;
      }
    }

    await Promise.resolve(onConfirm({
      intent: intent === 'create_asset' ? 'create_sample' : intent,
      data: formattedValues,
    }));
  };

  const renderFormFields = () => {
    const userOptions = users.map((u) => ({ label: u.fullName || u.email, value: u.id }));

    switch (intent) {
      case 'create_sample':
      case 'create_asset':
        return (
          <>
            <Form.Item name="name" label="Tên mẫu" rules={[{ required: true, message: 'Vui lòng nhập tên mẫu' }]}>
              <Input placeholder="Ví dụ: Mẫu vải A-102" />
            </Form.Item>
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="code" label="Mã mẫu">
                <Input placeholder="SMP-001" />
              </Form.Item>
              <Form.Item name="type" label="Loại">
                <Input placeholder="Vải, Phụ kiện..." />
              </Form.Item>
            </div>
            <Form.Item name="categoryId" label="Phân loại">
              <Select
                options={categories.map((category) => ({
                  label: buildCategoryPathLabel(categories, category.id),
                  value: category.id,
                }))}
                placeholder="Chọn phân loại..."
                showSearch
                allowClear
              />
            </Form.Item>
            <Form.Item name="description" label="Mô tả / Ghi chú">
              <Input.TextArea autoSize rows={2} />
            </Form.Item>
          </>
        );
      case 'create_event':
      case 'create_task':
        return (
          <>
            <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}>
              <Input placeholder="Lịch họp, nhắc nhở..." />
            </Form.Item>
            <Form.Item name="startDate" label="Ngày" rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="time" label="Thời gian">
              <Input placeholder="HH:mm" />
            </Form.Item>
            <Form.Item name="participantIds" label="Thành viên tham gia">
              <Select mode="multiple" options={userOptions} placeholder="Chọn thành viên..." allowClear showSearch />
            </Form.Item>
            <Form.Item name="description" label="Mô tả">
              <Input.TextArea autoSize rows={2} />
            </Form.Item>
          </>
        );
      default:
        return <Text type="secondary">Ý định không xác định hoặc form không được hỗ trợ.</Text>;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <Text strong>Xác nhận thông tin từ AI</Text>
          <Tag color="cyan">{intent?.toUpperCase()}</Tag>
        </Space>
      }
      open={visible}
      forceRender
      onCancel={onCancel}
      width={500}
      footer={[
        <Button
          key="cancel"
          type="text"
          icon={<X size={18} />}
          title="Hủy"
          aria-label="Hủy"
          onClick={onCancel}
        />,
        <Button
          key="ok"
          type="primary"
          icon={<Check size={18} />}
          title="Lưu dữ liệu"
          aria-label="Lưu dữ liệu"
          loading={loading}
          onClick={() => form.submit()}
        />,
      ]}
      styles={{ body: { paddingTop: 16 } }}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">Vui lòng kiểm tra lại thông tin trước khi lưu.</Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
      >
        <Form.Item label="Loại hành động">
          <Radio.Group value={intent} onChange={(e) => setIntent(e.target.value)}>
            <Radio.Button value="create_sample">Mẫu (Sample)</Radio.Button>
            <Radio.Button value="create_event">Sự kiện (Event)</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Divider style={{ margin: '12px 0' }} />

        {renderFormFields()}

        <div style={{ marginTop: 8, textAlign: 'right' }}>
          <Text type="secondary">
            Độ chính xác AI: <Tag color={parsedData?.confidence > 0.8 ? 'green' : 'orange'}>
              {(parsedData?.confidence * 100 || 0).toFixed(0)}%
            </Tag>
          </Text>
        </div>
      </Form>
    </Modal>
  );
};
