import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Input, Button, Card, Space, message, Tag, Popover, List, Tooltip } from 'antd';
import { SendOutlined, AudioOutlined, MutedOutlined, HistoryOutlined, RedoOutlined, QrcodeOutlined } from '@ant-design/icons';
import api from '../api/client';
import { naturalInputApi } from '../api/natural-input';
import type { NaturalInputHistory } from '../api/natural-input';
import { ParsedPreviewModal } from './ParsedPreviewModal';
import dayjs from 'dayjs';

const QRScannerModal = lazy(() => import('./QRScannerModal').then((m) => ({ default: m.QRScannerModal })));

const { TextArea } = Input;

export const NaturalInputBox: React.FC = () => {
    const [inputValue, setInputValue] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [loading, setLoading] = useState(false);
    const [parsedResult, setParsedResult] = useState<any>(null);
    const [showModal, setShowModal] = useState(false);
    const [history, setHistory] = useState<NaturalInputHistory[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [hasOpenedScanner, setHasOpenedScanner] = useState(false);

    // Web Speech API
    const [recognition, setRecognition] = useState<any>(null);

    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'speechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).speechRecognition;
            const rec = new SpeechRecognition();
            rec.continuous = false;
            rec.interimResults = false;
            rec.lang = 'vi-VN';

            rec.onstart = () => setIsListening(true);
            rec.onend = () => setIsListening(false);
            rec.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
                message.error('Lỗi nhận diện giọng nói: ' + event.error);
            };
            rec.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInputValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
            };

            setRecognition(rec);
        }
    }, []);

    const toggleListening = () => {
        if (isListening) {
            recognition?.stop();
        } else {
            recognition?.start();
        }
    };

    const fetchHistory = async () => {
        try {
            const response = await naturalInputApi.getHistory();
            setHistory(response.data);
        } catch (error) {
            console.error('Failed to fetch history:', error);
        }
    };

    useEffect(() => {
        if (showHistory) {
            fetchHistory();
        }
    }, [showHistory]);

    const handleParse = async () => {
        if (!inputValue.trim()) {
            message.warning('Vui lòng nhập lệnh hoặc mô tả');
            return;
        }

        setLoading(true);
        try {
            const response = await naturalInputApi.parse(inputValue);

            const d = response.data;
            if (!d.success) {
                if (d.reason === 'openai_api_key_missing') {
                    message.error('OPENAI_API_KEY chưa được cấu hình trên server.');
                } else {
                    const extra = d.details || d.reason;
                    message.error(
                        extra
                            ? `Không nhận diện được nội dung: ${extra}`
                            : 'Không thể nhận diện nội dung. Vui lòng thử lại.'
                    );
                }
            } else if (d.intent === 'unknown') {
                message.info(d.clarification || 'AI chưa hiểu rõ yêu cầu. Vui lòng diễn đạt chi tiết hơn.');
            } else {
                setParsedResult({
                    ...d,
                    originalText: inputValue
                });
                setShowModal(true);
                message.success('Phân tích thành công!');
            }
        } catch (error) {
            console.error('Parsing error:', error);
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
        }
    };

    const handleReuse = (text: string) => {
        setInputValue(text);
        setShowHistory(false);
        message.info('Đã tải lại lệnh từ lịch sử!');
    };

    const handleQRResult = (result: string) => {
        setInputValue((prev) => (prev ? `${prev} ${result}` : result));
        setShowQRScanner(false);
        message.success('Quét mã QR thành công!');
    };

    const historyContent = (
        <div style={{ width: 350, maxHeight: 400, overflowY: 'auto' }}>
            <List
                itemLayout="horizontal"
                dataSource={history}
                renderItem={(item) => (
                    <List.Item
                        actions={[
                            <Tooltip title="Sử dụng lại">
                                <Button
                                    type="text"
                                    icon={<RedoOutlined />}
                                    onClick={() => handleReuse(item.inputMessage)}
                                />
                            </Tooltip>
                        ]}
                    >
                        <List.Item.Meta
                            title={
                                <Space>
                                    <Tag color={item.confidence > 0.8 ? 'green' : 'orange'}>
                                        {Math.round(item.confidence * 100)}% khớp
                                    </Tag>
                                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                                        {dayjs(item.createdAt).format('MM/DD HH:mm')}
                                    </span>
                                </Space>
                            }
                            description={
                                <div style={{ color: 'inherit', fontWeight: 500 }}>
                                    {item.inputMessage}
                                </div>
                            }
                        />
                    </List.Item>
                )}
                locale={{ emptyText: 'Chưa có lịch sử nhập liệu' }}
            />
        </div>
    );

    const handleConfirm = async (finalData: any) => {
        setLoading(true);
        try {
            let endpoint = '';
            switch (finalData.intent) {
                case 'create_sample':
                case 'create_asset': endpoint = '/samples'; break;
                case 'create_event': endpoint = '/calendar'; break;
                default: message.error('Thao tác chưa hỗ trợ lưu tự động.'); return;
            }

            console.log(`[NaturalInput] Saving to ${endpoint}:`, finalData.data);
            await api.post(endpoint, finalData.data);

            message.success('Đã lưu thành công!');
            setShowModal(false);
            setInputValue('');
            fetchHistory();
        } catch (error) {
            console.error('Save error:', error);
            message.error('Không thể lưu dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card
            className="natural-input-card mb-6 border border-border bg-card shadow-xs rounded-xl"
            styles={{ body: { padding: '16px' } }}
        >
            <div className="flex items-center gap-2 mb-3">
                <SendOutlined className="text-primary text-sm" />
                <span className="font-semibold text-sm text-foreground">Trợ lý nhập liệu AI</span>
                <Tag color="default" className="text-xs font-medium">AI Powered</Tag>
            </div>
            <div>
                <TextArea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Bạn muốn ghi chép gì? Ví dụ: 'Tạo mẫu vải A-102 loại sợi cao cấp', 'Họp kiểm tra mẫu sáng mai lúc 9h'..."
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    className="mb-3 rounded-md"
                />
                <div className="flex justify-between items-center">
                    <Space size="small">
                        <Button
                            type={isListening ? 'primary' : 'default'}
                            danger={isListening}
                            shape="circle"
                            icon={isListening ? <MutedOutlined /> : <AudioOutlined />}
                            onClick={toggleListening}
                            title={isListening ? 'Dừng nghe' : 'Nhập bằng giọng nói'}
                        />
                        <Button
                            shape="circle"
                            icon={<QrcodeOutlined />}
                            onClick={() => { setHasOpenedScanner(true); setShowQRScanner(true); }}
                            title="Quét mã QR"
                        />
                        <Popover
                            content={historyContent}
                            title={<span className="font-semibold text-xs">Lịch sử nhập liệu</span>}
                            trigger="click"
                            open={showHistory}
                            onOpenChange={setShowHistory}
                            placement="bottomLeft"
                        >
                            <Button
                                shape="circle"
                                icon={<HistoryOutlined />}
                                title="Xem lịch sử"
                            />
                        </Popover>
                    </Space>
                    <Button
                        type="primary"
                        shape="circle"
                        size="large"
                        icon={<SendOutlined />}
                        loading={loading}
                        onClick={handleParse}
                        title="Gửi cho AI phân tích"
                        aria-label="Gửi cho AI phân tích"
                    />
                </div>
            </div>

            <ParsedPreviewModal
                visible={showModal}
                onCancel={() => setShowModal(false)}
                onConfirm={handleConfirm}
                parsedData={parsedResult}
                loading={loading}
            />
            {hasOpenedScanner && (
                <Suspense fallback={null}>
                    <QRScannerModal
                        visible={showQRScanner}
                        onCancel={() => setShowQRScanner(false)}
                        onResult={handleQRResult}
                    />
                </Suspense>
            )}
        </Card>
    );
};
