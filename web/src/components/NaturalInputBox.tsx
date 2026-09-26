import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Input, Button, Card, Space, message, Tag, Popover, List, Tooltip } from 'antd';
import { SendOutlined, AudioOutlined, MutedOutlined, HistoryOutlined, RedoOutlined, QrcodeOutlined } from '@ant-design/icons';
import api from '../api/client';
import { naturalInputApi } from '../api/natural-input';
import type { NaturalInputHistory } from '../api/natural-input';
import { ParsedPreviewModal } from './ParsedPreviewModal';
import dayjs from 'dayjs';

// QRScannerModal pulls in html5-qrcode (a full QR/barcode decoding engine,
// ~250KB+ on its own) which used to be a static import here -- since
// NaturalInputBox sits directly on the Dashboard, that shipped the entire
// QR scanner to every dashboard visit even though almost nobody opens it.
// Deferring the import until the user actually clicks the scan button keeps
// it out of the Dashboard chunk entirely.
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
            rec.lang = 'en-US';

            rec.onstart = () => setIsListening(true);
            rec.onend = () => setIsListening(false);
            rec.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
                message.error('Speech recognition error: ' + event.error);
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
            message.warning('Please enter a command or prompt');
            return;
        }

        setLoading(true);
        try {
            const response = await naturalInputApi.parse(inputValue);

            const d = response.data;
            if (!d.success) {
                if (d.reason === 'openai_api_key_missing') {
                    message.error('Server OPENAI_API_KEY is not configured.');
                } else {
                    const extra = d.details || d.reason;
                    message.error(
                        extra
                            ? `Could not recognize intent: ${extra}`
                            : 'Could not recognize intent. Please try again.'
                    );
                }
            } else if (d.intent === 'unknown') {
                message.info(d.clarification || 'AI is unsure about your request. Please try phrasing differently.');
            } else {
                setParsedResult({
                    ...d,
                    originalText: inputValue
                });
                setShowModal(true);
                message.success('Analysis complete!');
            }
        } catch (error) {
            console.error('Parsing error:', error);
            message.error('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    const handleReuse = (text: string) => {
        setInputValue(text);
        setShowHistory(false);
        message.info('Loaded text from history!');
    };

    const handleQRResult = (result: string) => {
        setInputValue((prev) => (prev ? `${prev} ${result}` : result));
        setShowQRScanner(false);
        message.success('QR Code scanned successfully!');
    };

    const historyContent = (
        <div style={{ width: 350, maxHeight: 400, overflowY: 'auto' }}>
            <List
                itemLayout="horizontal"
                dataSource={history}
                renderItem={(item) => (
                    <List.Item
                        actions={[
                            <Tooltip title="Reuse">
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
                                        {Math.round(item.confidence * 100)}% match
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
                locale={{ emptyText: 'No input history recorded' }}
            />
        </div>
    );

    const handleConfirm = async (finalData: any) => {
        setLoading(true);
        try {
            // Mapping intent to actual API endpoints
            let endpoint = '';
            switch (finalData.intent) {
                case 'create_expense':
                case 'create_income': endpoint = '/expenses'; break;
                case 'create_asset': endpoint = '/assets'; break;
                case 'create_event': endpoint = '/calendar'; break;
                default: message.error('Action is not supported for auto-saving.'); return;
            }

            console.log(`[NaturalInput] Saving to ${endpoint}:`, finalData.data);
            await api.post(endpoint, finalData.data);

            message.success('Successfully saved!');
            setShowModal(false);
            setInputValue('');
            fetchHistory();
        } catch (error) {
            console.error('Save error:', error);
            message.error('Failed to save data to system');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card
            className="natural-input-card mb-6 border border-border bg-card shadow-sm rounded-lg"
            styles={{ body: { padding: '16px' } }}
        >
            <div className="flex items-center gap-2 mb-3">
                <SendOutlined className="text-primary text-sm" />
                <span className="font-semibold text-sm text-foreground">AI Smart Assistant</span>
                <Tag color="default" className="text-xs font-medium">AI Powered</Tag>
            </div>
            <div>
                <TextArea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="What would you like to record? e.g. 'Received $1,200 salary', 'Bought groceries for $85'..."
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
                            title={isListening ? 'Stop listening' : 'Voice input'}
                        />
                        <Button
                            shape="circle"
                            icon={<QrcodeOutlined />}
                            onClick={() => { setHasOpenedScanner(true); setShowQRScanner(true); }}
                            title="Scan QR Code"
                        />
                        <Popover
                            content={historyContent}
                            title={<span className="font-semibold text-xs">Input History</span>}
                            trigger="click"
                            open={showHistory}
                            onOpenChange={setShowHistory}
                            placement="bottomLeft"
                        >
                            <Button
                                shape="circle"
                                icon={<HistoryOutlined />}
                                title="View History"
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
                        title="Send for AI Analysis"
                        aria-label="Send for AI Analysis"
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
