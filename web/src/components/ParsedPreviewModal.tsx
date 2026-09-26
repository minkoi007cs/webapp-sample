import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Radio, Space, Typography, Tag, Divider, Select, Switch, Button } from 'antd';
import { X, Check } from 'lucide-react';
import dayjs from 'dayjs';
import { userApi } from '../api/user';
import { asArray } from '../api/client';
import {
    buildCategoryPathLabel,
    categoryApi,
    expenseEntryTypeLabels,
    type ExpenseEntryType,
} from '../api/category';
import { assetApi } from '../api/asset';
import { expenseApi } from '../api/expense';
import type { User } from '../api/user';
import type { Category } from '../api/category';
import type { Asset } from '../api/asset';
import type { Expense } from '../api/expense';
import { formatVndAmount } from '../utils/currency';
import {
    confirmDuplicateWarning,
    findDuplicateAsset,
    findDuplicateExpense,
    getAssetLabel,
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
    const [assets, setAssets] = useState<Asset[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);

    useEffect(() => {
        if (visible) {
            Promise.all([
                userApi.findAll(),
                categoryApi.findAll(),
                assetApi.findAll(),
                expenseApi.findAll(),
            ]).then(([userRes, catRes, assetRes, expenseRes]) => {
                setUsers(asArray(userRes.data));
                setCategories(catRes.data);
                setAssets(asArray(assetRes.data));
                setExpenses(asArray(expenseRes.data));
            });
        }
    }, [visible]);

    useEffect(() => {
        if (parsedData && visible) {
            setIntent(parsedData.intent);

            // Map common aliases or legacy field names from AI
            const rawData = parsedData.data || {};

            // Helper to validate UUIDs to prevent backend errors from AI placeholders
            const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

            const sanitizeId = (id: any) => isUUID(id) ? id : undefined;

            // Chuẩn hóa từ phản hồi AI để form và backend nhận đúng enum / boolean
            const normalizeEntryType = (v: any): ExpenseEntryType | undefined => {
                if (typeof v !== 'string') return undefined;
                const u = v.trim().toUpperCase();
                if (u === 'INCOME' || u === 'EXPENSE') return u as ExpenseEntryType;
                return undefined;
            };

            const normalizeIsTransfer = (raw: any): boolean => {
                if (typeof raw === 'boolean') return raw;
                if (raw === 'true' || raw === 1 || raw === '1') return true;
                if (raw === 'false' || raw === 0 || raw === '0' || raw == null || raw === '') return false;
                return false;
            };

            const entryTypeFromIntent: ExpenseEntryType | undefined =
                parsedData.intent === 'create_income'
                    ? 'INCOME'
                    : parsedData.intent === 'create_expense'
                      ? 'EXPENSE'
                      : undefined;

            const mappedData = {
                ...rawData,
                // Expense mapping
                expenseDate: rawData.expenseDate || rawData.date,
                note: parsedData.originalText || rawData.note || rawData.description,
                description: parsedData.originalText || rawData.description || rawData.note,
                categoryId: sanitizeId(rawData.categoryId || rawData.category),
                entryType: normalizeEntryType(rawData.entryType) ?? entryTypeFromIntent,
                isTransfer: normalizeIsTransfer(rawData.isTransfer),
                assignedToUserId: sanitizeId(rawData.assignedToUserId),
                ownerId: sanitizeId(rawData.ownerId),
                usedById: sanitizeId(rawData.usedById),
                assetId: sanitizeId(rawData.assetId),
                // Asset mapping
                purchaseDate: rawData.purchaseDate || rawData.date,
                // Event mapping
                startDate: rawData.startDate || rawData.date,
                recurrenceRule: rawData.recurrenceRule,
                participantIds: rawData.participantIds || (rawData.participants ? rawData.participants.map((p: any) => typeof p === 'string' ? sanitizeId(p) : sanitizeId(p.id)) : []),
            };

            form.setFieldsValue({
                ...mappedData,
                expenseDate: mappedData.expenseDate ? dayjs(mappedData.expenseDate) : dayjs(),
                purchaseDate: mappedData.purchaseDate ? dayjs(mappedData.purchaseDate) : dayjs(),
                startDate: mappedData.startDate ? dayjs(mappedData.startDate) : dayjs(),
                date: mappedData.date ? dayjs(mappedData.date) : dayjs(), // For other intents
            });
        }
    }, [parsedData, visible, form]);

    const handleFinish = async (values: any) => {
        const formattedValues: any = {
            ...values,
            expenseDate: values.expenseDate?.format('YYYY-MM-DD'),
            purchaseDate: values.purchaseDate?.format('YYYY-MM-DD'),
            date: values.date?.format('YYYY-MM-DD'),
            participantIds: values.participantIds,
        };

        // Ưu tiên giá trị form (đã map từ AI), chỉ khi trống mới suy theo tab Chi/Thu
        if (intent === 'create_expense' || intent === 'create_income') {
            const intentDefaultEntry: ExpenseEntryType =
                intent === 'create_income' ? 'INCOME' : 'EXPENSE';
            formattedValues.entryType =
                (values.entryType as ExpenseEntryType | undefined) ?? intentDefaultEntry;
            formattedValues.isTransfer = typeof values.isTransfer === 'boolean' ? values.isTransfer : false;
        }

        if (intent === 'create_event' || intent === 'create_task') {
            let start = values.startDate ? dayjs(values.startDate) : dayjs();
            if (values.time && typeof values.time === 'string' && values.time.includes(':')) {
                const [hours, minutes] = values.time.split(':');
                start = start.hour(parseInt(hours) || 0).minute(parseInt(minutes) || 0).second(0).millisecond(0);
            }
            formattedValues.startDate = start.toISOString();
        }

        if (intent === 'create_expense' || intent === 'create_income') {
            const duplicateExpense = findDuplicateExpense(expenses, {
                amount: formattedValues.amount,
                categoryId: formattedValues.categoryId,
                expenseDate: formattedValues.expenseDate,
                assetId: formattedValues.assetId,
            });

            if (duplicateExpense) {
                const shouldContinue = await confirmDuplicateWarning({
                    title: 'Phát hiện giao dịch trùng',
                    summary: 'Đã có giao dịch cùng số tiền, danh mục, ngày thực hiện và tài sản. Bạn vẫn có thể tiếp tục nếu đây là bản ghi hợp lệ.',
                    detailLines: [
                        `Số tiền: ${formatVndAmount(formattedValues.amount)}`,
                        `Danh mục: ${getCategoryLabel(categories, formattedValues.categoryId)}`,
                        `Ngày: ${dayjs(formattedValues.expenseDate).format('DD/MM/YYYY')}`,
                        `Tài sản: ${getAssetLabel(assets, formattedValues.assetId)}`,
                    ],
                });

                if (!shouldContinue) return;
            }
        }

        if (intent === 'create_asset') {
            const duplicateAsset = findDuplicateAsset(assets, {
                name: formattedValues.name,
                categoryId: formattedValues.categoryId,
            });

            if (duplicateAsset) {
                const shouldContinue = await confirmDuplicateWarning({
                    title: 'Phát hiện tài sản trùng',
                    summary: 'Đã có tài sản cùng tên và danh mục. Bạn vẫn có thể tiếp tục nếu đây là một tài sản khác nhưng trùng cách đặt tên.',
                    detailLines: [
                        `Tên tài sản: ${formattedValues.name || '-'}`,
                        `Danh mục: ${getCategoryLabel(categories, formattedValues.categoryId)}`,
                    ],
                });

                if (!shouldContinue) return;
            }
        }

        await Promise.resolve(onConfirm({
            intent,
            data: formattedValues,
        }));
    };

    const renderFormFields = () => {
        const userOptions = users.map(u => ({ label: u.fullName || u.email, value: u.id }));
        const assetOptions = assets.map(a => ({ label: a.name, value: a.id }));

        switch (intent) {
            case 'create_expense':
            case 'create_income': {
                return (
                    <>
                        <Form.Item name="entryType" label="Loại bút toán">
                            <Select
                                allowClear
                                placeholder="Theo AI hoặc Chi/Thu mặc định"
                                options={(Object.keys(expenseEntryTypeLabels) as ExpenseEntryType[]).map((key) => ({
                                    value: key,
                                    label: expenseEntryTypeLabels[key],
                                }))}
                            />
                        </Form.Item>
                        <Form.Item name="isTransfer" label="Chuyển nội bộ" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                        <Form.Item name="amount" label="Số tiền" rules={[{ required: true }]}>
                            <InputNumber
                                style={{ width: '100%' }}
                                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                                addonAfter="đồng"
                            />
                        </Form.Item>
                        <Form.Item name="categoryId" label="Danh mục" rules={[{ required: true }]}>
                            <Select
                                options={categories
                                    .map((category) => ({
                                        label: buildCategoryPathLabel(categories, category.id),
                                        value: category.id,
                                    }))
                                }
                                placeholder="Chọn danh mục..."
                                showSearch
                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                            />
                        </Form.Item>
                        <Form.Item name="assignedToUserId" label="Người thực hiện (Không bắt buộc)">
                            <Select options={userOptions} placeholder="Chọn thành viên..." allowClear />
                        </Form.Item>
                        <Form.Item name="assetId" label="Liên quan đến tài sản (Không bắt buộc)">
                            <Select options={assetOptions} placeholder="Chọn tài sản..." allowClear showSearch />
                        </Form.Item>
                        <Form.Item name="expenseDate" label="Ngày giao dịch" rules={[{ required: true }]}>
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="note" label="Ghi chú">
                            <Input.TextArea autoSize />
                        </Form.Item>
                    </>
                );
            }
            case 'create_asset':
            case 'update_asset':
                return (
                    <>
                        <Form.Item name="name" label="Tên tài sản" rules={[{ required: true }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item name="categoryId" label="Danh mục">
                            <Select
                                options={categories
                                    .map((category) => ({
                                        label: buildCategoryPathLabel(categories, category.id),
                                        value: category.id,
                                    }))
                                }
                                placeholder="Chọn danh mục..."
                                showSearch
                            />
                        </Form.Item>
                        {intent === 'create_asset' && (
                            <Form.Item name="purchasePrice" label="Giá mua">
                                <InputNumber
                                    style={{ width: '100%' }}
                                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                                    addonAfter="đồng"
                                />
                            </Form.Item>
                        )}
                        <Form.Item name="purchaseDate" label="Ngày mua/cập nhật">
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="ownerId" label="Người đứng tên (Không bắt buộc)">
                            <Select options={userOptions} placeholder="Chọn thành viên..." allowClear showSearch />
                        </Form.Item>
                        <Form.Item name="usedById" label="Người sử dụng (Không bắt buộc)">
                            <Select options={userOptions} placeholder="Chọn thành viên..." allowClear showSearch />
                        </Form.Item>
                        <Form.Item name="description" label="Ghi chú/Mô tả">
                            <Input.TextArea autoSize />
                        </Form.Item>
                    </>
                );
            case 'create_event':
            case 'create_task':
                return (
                    <>
                        <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item name="startDate" label="Ngày" rules={[{ required: true }]}>
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="time" label="Giờ">
                            <Input placeholder="HH:mm" />
                        </Form.Item>
                        <Form.Item name="recurrenceRule" label="Lặp lại">
                            <Select placeholder="Chọn chế độ lặp" allowClear>
                                <Select.Option value="DAILY">Hàng ngày</Select.Option>
                                <Select.Option value="WEEKLY">Hàng tuần</Select.Option>
                                <Select.Option value="MONTHLY">Hàng tháng</Select.Option>
                                <Select.Option value="YEARLY">Hàng năm</Select.Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="participantIds" label="Người tham gia / Nhắc cho ai">
                            <Select mode="multiple" options={userOptions} placeholder="Chọn thành viên..." allowClear showSearch />
                        </Form.Item>
                        <Form.Item name="description" label="Mô tả">
                            <Input.TextArea autoSize />
                        </Form.Item>
                    </>
                );
            default:
                return <Text type="secondary">Ý định không xác định hoặc chưa được hỗ trợ form chỉnh sửa.</Text>;
        }
    };

    return (
        <Modal
            title={
                <Space>
                    <Text strong>Xác nhận thông tin nhập liệu</Text>
                    <Tag color="cyan">{intent?.toUpperCase()}</Tag>
                </Space>
            }
            open={visible}
            forceRender
            onCancel={onCancel}
            width={520}
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
                    title="Xác nhận và lưu"
                    aria-label="Xác nhận và lưu"
                    loading={loading}
                    onClick={() => form.submit()}
                />,
            ]}
            styles={{ body: { paddingTop: 16 } }}
        >
            <div style={{ marginBottom: 16 }}>
                <Text type="secondary">Chúng tôi đã phân tích yêu cầu của bạn. Vui lòng kiểm tra lại độ chính xác trước khi lưu vào hệ thống.</Text>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                initialValues={{ currency: 'VND' }}
            >
                <Form.Item label="Loại giao dịch/hành động">
                    <Radio.Group value={intent} onChange={(e) => setIntent(e.target.value)}>
                        <Radio.Button value="create_expense">Chi tiêu</Radio.Button>
                        <Radio.Button value="create_income">Thu nhập</Radio.Button>
                        <Radio.Button value="create_asset">Tài sản</Radio.Button>
                        <Radio.Button value="create_event">Sự kiện</Radio.Button>
                    </Radio.Group>
                </Form.Item>

                <Divider style={{ margin: '12px 0' }} />

                {renderFormFields()}

                <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <Text type="secondary">
                        Độ tin cậy AI: <Tag color={parsedData?.confidence > 0.8 ? 'green' : 'orange'}>
                            {(parsedData?.confidence * 100 || 0).toFixed(0)}%
                        </Tag>
                    </Text>
                </div>
            </Form>
        </Modal>
    );
};
