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

            const rawData = parsedData.data || {};
            const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
            const sanitizeId = (id: any) => isUUID(id) ? id : undefined;

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
                purchaseDate: rawData.purchaseDate || rawData.date,
                startDate: rawData.startDate || rawData.date,
                recurrenceRule: rawData.recurrenceRule,
                participantIds: rawData.participantIds || (rawData.participants ? rawData.participants.map((p: any) => typeof p === 'string' ? sanitizeId(p) : sanitizeId(p.id)) : []),
            };

            form.setFieldsValue({
                ...mappedData,
                expenseDate: mappedData.expenseDate ? dayjs(mappedData.expenseDate) : dayjs(),
                purchaseDate: mappedData.purchaseDate ? dayjs(mappedData.purchaseDate) : dayjs(),
                startDate: mappedData.startDate ? dayjs(mappedData.startDate) : dayjs(),
                date: mappedData.date ? dayjs(mappedData.date) : dayjs(),
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
                    title: 'Duplicate Transaction Detected',
                    summary: 'A transaction with the same amount, category, date, and asset already exists. You can still continue if this is intended.',
                    detailLines: [
                        `Amount: ${formatVndAmount(formattedValues.amount)}`,
                        `Category: ${getCategoryLabel(categories, formattedValues.categoryId)}`,
                        `Date: ${dayjs(formattedValues.expenseDate).format('YYYY-MM-DD')}`,
                        `Asset: ${getAssetLabel(assets, formattedValues.assetId)}`,
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
                    title: 'Duplicate Asset Detected',
                    summary: 'An asset with the same name and category already exists. You can still continue if this is a separate asset.',
                    detailLines: [
                        `Asset Name: ${formattedValues.name || '-'}`,
                        `Category: ${getCategoryLabel(categories, formattedValues.categoryId)}`,
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
                        <Form.Item name="entryType" label="Entry Type">
                            <Select
                                allowClear
                                placeholder="AI Default or Income/Expense"
                                options={(Object.keys(expenseEntryTypeLabels) as ExpenseEntryType[]).map((key) => ({
                                    value: key,
                                    label: expenseEntryTypeLabels[key],
                                }))}
                            />
                        </Form.Item>
                        <Form.Item name="isTransfer" label="Internal Transfer" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                        <Form.Item name="amount" label="Amount" rules={[{ required: true, message: 'Amount is required' }]}>
                            <InputNumber
                                style={{ width: '100%' }}
                                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                                addonAfter="$"
                            />
                        </Form.Item>
                        <Form.Item name="categoryId" label="Category" rules={[{ required: true, message: 'Category is required' }]}>
                            <Select
                                options={categories
                                    .map((category) => ({
                                        label: buildCategoryPathLabel(categories, category.id),
                                        value: category.id,
                                    }))
                                }
                                placeholder="Select category..."
                                showSearch
                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                            />
                        </Form.Item>
                        <Form.Item name="assignedToUserId" label="Assigned Member (Optional)">
                            <Select options={userOptions} placeholder="Select member..." allowClear />
                        </Form.Item>
                        <Form.Item name="assetId" label="Associated Asset (Optional)">
                            <Select options={assetOptions} placeholder="Select asset..." allowClear showSearch />
                        </Form.Item>
                        <Form.Item name="expenseDate" label="Transaction Date" rules={[{ required: true, message: 'Date is required' }]}>
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="note" label="Notes">
                            <Input.TextArea autoSize />
                        </Form.Item>
                    </>
                );
            }
            case 'create_asset':
            case 'update_asset':
                return (
                    <>
                        <Form.Item name="name" label="Asset Name" rules={[{ required: true, message: 'Name is required' }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item name="categoryId" label="Category">
                            <Select
                                options={categories
                                    .map((category) => ({
                                        label: buildCategoryPathLabel(categories, category.id),
                                        value: category.id,
                                    }))
                                }
                                placeholder="Select category..."
                                showSearch
                            />
                        </Form.Item>
                        {intent === 'create_asset' && (
                            <Form.Item name="purchasePrice" label="Purchase Price">
                                <InputNumber
                                    style={{ width: '100%' }}
                                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                                    addonAfter="$"
                                />
                            </Form.Item>
                        )}
                        <Form.Item name="purchaseDate" label="Purchase / Acquisition Date">
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="ownerId" label="Legal Owner (Optional)">
                            <Select options={userOptions} placeholder="Select member..." allowClear showSearch />
                        </Form.Item>
                        <Form.Item name="usedById" label="Primary User (Optional)">
                            <Select options={userOptions} placeholder="Select member..." allowClear showSearch />
                        </Form.Item>
                        <Form.Item name="description" label="Description / Notes">
                            <Input.TextArea autoSize />
                        </Form.Item>
                    </>
                );
            case 'create_event':
            case 'create_task':
                return (
                    <>
                        <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item name="startDate" label="Date" rules={[{ required: true, message: 'Date is required' }]}>
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="time" label="Time">
                            <Input placeholder="HH:mm" />
                        </Form.Item>
                        <Form.Item name="recurrenceRule" label="Recurrence">
                            <Select placeholder="Select recurrence pattern" allowClear>
                                <Select.Option value="DAILY">Daily</Select.Option>
                                <Select.Option value="WEEKLY">Weekly</Select.Option>
                                <Select.Option value="MONTHLY">Monthly</Select.Option>
                                <Select.Option value="YEARLY">Yearly</Select.Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="participantIds" label="Participants / Assignees">
                            <Select mode="multiple" options={userOptions} placeholder="Select members..." allowClear showSearch />
                        </Form.Item>
                        <Form.Item name="description" label="Description">
                            <Input.TextArea autoSize />
                        </Form.Item>
                    </>
                );
            default:
                return <Text type="secondary">Unrecognized intent or form not supported.</Text>;
        }
    };

    return (
        <Modal
            title={
                <Space>
                    <Text strong>Review AI Input Details</Text>
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
                    title="Cancel"
                    aria-label="Cancel"
                    onClick={onCancel}
                />,
                <Button
                    key="ok"
                    type="primary"
                    icon={<Check size={18} />}
                    title="Confirm and Save"
                    aria-label="Confirm and Save"
                    loading={loading}
                    onClick={() => form.submit()}
                />,
            ]}
            styles={{ body: { paddingTop: 16 } }}
        >
            <div style={{ marginBottom: 16 }}>
                <Text type="secondary">We have parsed your request. Please review the details below before saving.</Text>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                initialValues={{ currency: 'USD' }}
            >
                <Form.Item label="Action / Transaction Type">
                    <Radio.Group value={intent} onChange={(e) => setIntent(e.target.value)}>
                        <Radio.Button value="create_expense">Expense</Radio.Button>
                        <Radio.Button value="create_income">Income</Radio.Button>
                        <Radio.Button value="create_asset">Asset</Radio.Button>
                        <Radio.Button value="create_event">Event</Radio.Button>
                    </Radio.Group>
                </Form.Item>

                <Divider style={{ margin: '12px 0' }} />

                {renderFormFields()}

                <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <Text type="secondary">
                        AI Confidence: <Tag color={parsedData?.confidence > 0.8 ? 'green' : 'orange'}>
                            {(parsedData?.confidence * 100 || 0).toFixed(0)}%
                        </Tag>
                    </Text>
                </div>
            </Form>
        </Modal>
    );
};
