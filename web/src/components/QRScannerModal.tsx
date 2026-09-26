import React, { useEffect, useRef } from 'react';
import { Modal, Button } from 'antd';
import { X } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QRScannerModalProps {
    visible: boolean;
    onCancel: () => void;
    onResult: (result: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ visible, onCancel, onResult }) => {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        if (visible) {
            // Give a small delay to ensure DOM is ready
            const timer = setTimeout(() => {
                try {
                    const scanner = new Html5QrcodeScanner(
                        "qr-reader",
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0
                        },
                        /* verbose= */ false
                    );

                    scanner.render((decodedText) => {
                        console.log("QR Decoded:", decodedText);
                        scanner.clear().then(() => {
                            onResult(decodedText);
                        }).catch(error => {
                            console.error("Failed to clear scanner", error);
                            onResult(decodedText);
                        });
                    }, () => {
                        // Suppress frequent scanning errors in log
                    });

                    scannerRef.current = scanner;
                } catch (err) {
                    console.error("Scanner initialization error:", err);
                }
            }, 300);

            return () => {
                clearTimeout(timer);
                if (scannerRef.current) {
                    scannerRef.current.clear().catch(error => {
                        console.error("Failed to clear scanner on unmount", error);
                    });
                }
            };
        }
    }, [visible, onResult]);

    return (
        <Modal
            title="Quét mã QR"
            open={visible}
            onCancel={onCancel}
            footer={[
                <Button
                    key="cancel"
                    type="text"
                    icon={<X size={18} />}
                    title="Đóng"
                    aria-label="Đóng"
                    onClick={onCancel}
                />,
            ]}
            destroyOnClose
            width={450}
            centered
        >
            <div
                id="qr-reader"
                style={{
                    width: '100%',
                    overflow: 'hidden',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                }}
            ></div>
            <div style={{ marginTop: 12, textAlign: 'center', color: '#64748b' }}>
                Đưa mã QR vào khung hình để tự động quét
            </div>
        </Modal>
    );
};
