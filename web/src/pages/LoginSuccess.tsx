import { useEffect, useState, useRef } from 'react';
import { Spin, message } from 'antd';
import { getSupabaseClient } from '../lib/supabase';
import api from '../api/client';

export const LoginSuccess = () => {
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const processedRef = useRef(false);

    useEffect(() => {
        let isMounted = true;

        const completeLogin = (appToken: string) => {
            localStorage.setItem('token', appToken);
            const pendingInvite = localStorage.getItem('pendingInviteToken');
            if (pendingInvite) {
                localStorage.removeItem('pendingInviteToken');
                window.location.replace(`/accept-invite?token=${pendingInvite}`);
            } else {
                window.location.replace('/');
            }
        };

        const handleAuthError = (err: any) => {
            if (!isMounted) return;
            const serverError = err.response?.data?.error || err.response?.data?.message;
            const msg = serverError || err.message || 'Đăng nhập không thành công';
            message.error(msg);
            setErrorMessage(msg);
            setTimeout(() => {
                window.location.replace('/login');
            }, 2000);
        };

        async function processLogin() {
            if (processedRef.current) return;
            processedRef.current = true;

            try {
                // 1. Check direct query token (?token=...)
                const searchParams = new URLSearchParams(window.location.search);
                const directToken = searchParams.get('token');
                if (directToken) {
                    return completeLogin(directToken);
                }

                // 2. Extract access_token directly from hash (#access_token=...) or query (?access_token=...)
                let sbAccessToken = searchParams.get('access_token');
                if (!sbAccessToken && window.location.hash) {
                    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
                    sbAccessToken = hashParams.get('access_token');
                }

                if (sbAccessToken) {
                    const res = await api.post('/auth/supabase', { token: sbAccessToken });
                    if (res.data?.access_token) {
                        return completeLogin(res.data.access_token);
                    }
                }

                // 3. Check PKCE code flow (?code=...)
                const code = searchParams.get('code');
                if (code) {
                    const supabase = await getSupabaseClient();
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                    if (data?.session?.access_token) {
                        const res = await api.post('/auth/supabase', { token: data.session.access_token });
                        if (res.data?.access_token) {
                            return completeLogin(res.data.access_token);
                        }
                    }
                }

                // 4. Check existing session in Supabase client
                const supabase = await getSupabaseClient();
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                    const res = await api.post('/auth/supabase', { token: session.access_token });
                    if (res.data?.access_token) {
                        return completeLogin(res.data.access_token);
                    }
                }

                throw new Error('Không tìm thấy thông tin phiên đăng nhập hợp lệ.');
            } catch (err: any) {
                handleAuthError(err);
            }
        }

        processLogin();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="text-center p-8 bg-card rounded-xl shadow-sm border border-border max-w-md w-full text-card-foreground">
                {errorMessage ? (
                    <>
                        <h2 className="text-xl font-semibold text-destructive mb-2">Đăng nhập thất bại</h2>
                        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm mb-4 break-words">
                            {errorMessage}
                        </div>
                        <p className="text-xs text-muted-foreground">Đang quay lại trang đăng nhập...</p>
                    </>
                ) : (
                    <>
                        <Spin size="large" className="mb-4" />
                        <h2 className="text-xl font-semibold text-foreground">Đang xác thực tài khoản...</h2>
                        <p className="mt-2 text-sm text-muted-foreground">Vui lòng đợi giây lát trong khi hoàn tất phiên làm việc.</p>
                    </>
                )}
            </div>
        </div>
    );
};


