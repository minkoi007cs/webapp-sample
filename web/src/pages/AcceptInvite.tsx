import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Spin } from 'antd';
import { UserPlus, AlertTriangle, LogIn } from 'lucide-react';
import { authApi } from '../api/auth';

const roleLabel = (role: string | null) => (role === 'FAMILY_ADMIN' ? 'Quản trị viên' : 'Thành viên');

export const AcceptInvite = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';

    const [status, setStatus] = useState<'loading' | 'preview' | 'accepting' | 'accepted' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const [preview, setPreview] = useState<{ familyName: string | null; role: string | null; email: string } | null>(null);

    const isLoggedIn = Boolean(localStorage.getItem('token'));

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setErrorMessage('Đường dẫn lời mời không hợp lệ.');
            return;
        }

        authApi.previewInvite(token)
            .then((res) => {
                if (res.data.isExpired) {
                    setStatus('error');
                    setErrorMessage('Lời mời này đã hết hạn hoặc đã được sử dụng. Vui lòng nhờ quản trị viên gửi lời mời mới.');
                    return;
                }
                setPreview({ familyName: res.data.familyName, role: res.data.role, email: res.data.email });
                setStatus('preview');
            })
            .catch(() => {
                setStatus('error');
                setErrorMessage('Không tìm thấy lời mời này. Đường dẫn có thể đã bị sai hoặc lời mời đã bị hủy.');
            });
    }, [token]);

    const handleLoginToAccept = () => {
        localStorage.setItem('pendingInviteToken', token);
        window.location.href = '/login';
    };

    const handleAccept = async () => {
        setStatus('accepting');
        try {
            const res = await authApi.acceptInvite(token);
            localStorage.setItem('token', res.data.access_token);
            setStatus('accepted');
            window.location.href = '/';
        } catch (err: any) {
            setStatus('error');
            setErrorMessage(err?.response?.data?.message || 'Không thể chấp nhận lời mời. Vui lòng thử lại.');
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                <div className="rounded-xl border border-border bg-card p-8 shadow-sm text-card-foreground text-center">
                    {status === 'loading' && (
                        <div className="py-8">
                            <Spin size="large" />
                            <p className="mt-4 text-sm text-muted-foreground">Đang kiểm tra lời mời...</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="space-y-4">
                            <div className="mx-auto inline-flex items-center justify-center w-12 h-12 bg-destructive/10 text-destructive rounded-lg">
                                <AlertTriangle size={24} />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight text-foreground">Không thể tham gia</h1>
                            <p className="text-sm text-muted-foreground">{errorMessage}</p>
                            <Button type="default" block onClick={() => (window.location.href = '/')}>
                                Về trang chủ
                            </Button>
                        </div>
                    )}

                    {(status === 'preview' || status === 'accepting') && preview && (
                        <div className="space-y-5">
                            <div className="mx-auto inline-flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-lg shadow-xs">
                                <UserPlus size={24} />
                            </div>
                            <div>
                                <h1 className="text-lg font-semibold text-foreground">Bạn được mời tham gia</h1>
                                <p className="mt-1 text-2xl font-bold tracking-tight text-primary">{preview.familyName || 'một không gian'}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    với vai trò <strong className="text-foreground">{roleLabel(preview.role)}</strong>
                                </p>
                            </div>

                            {isLoggedIn ? (
                                <Button
                                    type="primary"
                                    size="large"
                                    block
                                    loading={status === 'accepting'}
                                    onClick={handleAccept}
                                    className="h-10 rounded-md"
                                >
                                    Chấp nhận lời mời
                                </Button>
                            ) : (
                                <>
                                    <p className="text-xs text-muted-foreground">
                                        Đăng nhập bằng Google với email <strong>{preview.email}</strong> để tham gia.
                                    </p>
                                    <Button
                                        type="primary"
                                        size="large"
                                        block
                                        icon={<LogIn size={16} />}
                                        onClick={handleLoginToAccept}
                                        className="h-10 rounded-md"
                                    >
                                        Đăng nhập với Google để tham gia
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

