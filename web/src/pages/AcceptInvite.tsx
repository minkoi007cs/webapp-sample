import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Spin } from 'antd';
import { UserPlus, AlertTriangle, LogIn } from 'lucide-react';
import { authApi } from '../api/auth';

const roleLabel = (role: string | null) => (role === 'FAMILY_ADMIN' ? 'Administrator' : 'Member');

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
            setErrorMessage('Invalid invitation link.');
            return;
        }

        authApi.previewInvite(token)
            .then((res) => {
                if (res.data.isExpired) {
                    setStatus('error');
                    setErrorMessage('This invitation has expired or has already been accepted.');
                    return;
                }
                setPreview({ familyName: res.data.familyName, role: res.data.role, email: res.data.email });
                setStatus('preview');
            })
            .catch(() => {
                setStatus('error');
                setErrorMessage('Invitation not found or was revoked by an administrator.');
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
            setErrorMessage(err?.response?.data?.message || 'Could not accept invitation. Please try again.');
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                <div className="rounded-xl border border-border bg-card p-8 shadow-sm text-card-foreground text-center">
                    {status === 'loading' && (
                        <div className="py-8">
                            <Spin size="large" />
                            <p className="mt-4 text-sm text-muted-foreground">Checking invitation...</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="space-y-4">
                            <div className="mx-auto inline-flex items-center justify-center w-12 h-12 bg-destructive/10 text-destructive rounded-lg">
                                <AlertTriangle size={24} />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight text-foreground">Unable to Join</h1>
                            <p className="text-sm text-muted-foreground">{errorMessage}</p>
                            <Button type="default" block onClick={() => (window.location.href = '/')}>
                                Return Home
                            </Button>
                        </div>
                    )}

                    {(status === 'preview' || status === 'accepting') && preview && (
                        <div className="space-y-5">
                            <div className="mx-auto inline-flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-lg shadow-xs">
                                <UserPlus size={24} />
                            </div>
                            <div>
                                <h1 className="text-lg font-semibold text-foreground">You are invited to join</h1>
                                <p className="mt-1 text-2xl font-bold tracking-tight text-primary">{preview.familyName || 'Workspace'}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    as <strong className="text-foreground">{roleLabel(preview.role)}</strong>
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
                                    Accept Invitation
                                </Button>
                            ) : (
                                <>
                                    <p className="text-xs text-muted-foreground">
                                        Sign in with Google using <strong>{preview.email}</strong> to accept.
                                    </p>
                                    <Button
                                        type="primary"
                                        size="large"
                                        block
                                        icon={<LogIn size={16} />}
                                        onClick={handleLoginToAccept}
                                        className="h-10 rounded-md"
                                    >
                                        Sign in with Google to Join
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


