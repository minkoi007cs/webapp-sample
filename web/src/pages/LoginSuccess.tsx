import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { message } from 'antd';
import { getSupabaseClient } from '../lib/supabase';
import api from '../api/client';

export const LoginSuccess = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const processedRef = useRef(false);

    useEffect(() => {
        let isMounted = true;

        async function processLogin() {
            if (processedRef.current) return;

            // 1. Kiểm tra token trực tiếp qua query params (Legacy)
            const queryToken = searchParams.get('token');
            if (queryToken) {
                processedRef.current = true;
                localStorage.setItem('token', queryToken);
                handleRedirect();
                return;
            }

            try {
                const supabase = await getSupabaseClient();

                // 2. Xử lý luồng PKCE (Supabase OAuth trả về ?code=...)
                const code = searchParams.get('code');
                if (code) {
                    console.log('Đang đổi mã PKCE code sang session Supabase...');
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) {
                        throw new Error(`Xác thực mã đăng nhập thất bại: ${error.message}`);
                    }
                    if (data?.session?.access_token) {
                        processedRef.current = true;
                        return await exchangeSupabaseToken(data.session.access_token);
                    }
                }

                // 3. Xử lý luồng Implicit Token từ URL Hash (#access_token=...)
                const hash = window.location.hash;
                if (hash && hash.includes('access_token')) {
                    const params = new URLSearchParams(hash.replace(/^#/, ''));
                    const accessToken = params.get('access_token');
                    if (accessToken) {
                        processedRef.current = true;
                        return await exchangeSupabaseToken(accessToken);
                    }
                }

                // 4. Kiểm tra session hiện có trong Supabase Client
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                    processedRef.current = true;
                    return await exchangeSupabaseToken(session.access_token);
                }

                // 5. Lắng nghe sự kiện đăng nhập nếu đang trong quá trình trao đổi
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
                    if (session?.access_token && !processedRef.current) {
                        processedRef.current = true;
                        await exchangeSupabaseToken(session.access_token);
                    }
                });

                // Timeout dự phòng nếu không nhận được token sau 5 giây
                setTimeout(() => {
                    if (!processedRef.current && isMounted) {
                        subscription.unsubscribe();
                        setErrorMessage('Không nhận được phiên đăng nhập hợp lệ từ Google/Supabase.');
                        setTimeout(() => navigate('/login', { replace: true }), 3500);
                    }
                }, 5000);

            } catch (err: any) {
                if (isMounted) {
                    const serverError = err.response?.data?.error || err.response?.data?.message;
                    const msg = serverError || err.message || 'Lỗi khi đồng bộ tài khoản';
                    setErrorMessage(msg);
                    setTimeout(() => navigate('/login', { replace: true }), 4000);
                }
            }
        }

        async function exchangeSupabaseToken(supabaseToken: string) {
            try {
                const res = await api.post('/auth/supabase', { token: supabaseToken });
                const appToken = res.data?.access_token;
                if (appToken) {
                    localStorage.setItem('token', appToken);
                    handleRedirect();
                } else {
                    throw new Error('Máy chủ không trả về token phiên làm việc');
                }
            } catch (err: any) {
                if (isMounted) {
                    const serverError = err.response?.data?.error || err.response?.data?.message;
                    const msg = serverError || err.message || 'Đăng nhập không thành công';
                    message.error(msg);
                    setErrorMessage(msg);
                    setTimeout(() => navigate('/login', { replace: true }), 4000);
                }
            }
        }

        function handleRedirect() {
            const pendingInviteToken = localStorage.getItem('pendingInviteToken');
            if (pendingInviteToken) {
                localStorage.removeItem('pendingInviteToken');
                navigate(`/accept-invite?token=${pendingInviteToken}`, { replace: true });
            } else {
                navigate('/', { replace: true });
            }
        }

        processLogin();

        return () => {
            isMounted = false;
        };
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-lg w-full mx-4">
                {errorMessage ? (
                    <>
                        <h2 className="text-2xl font-semibold text-red-600 mb-2">Đăng nhập thất bại</h2>
                        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-4 break-words">
                            {errorMessage}
                        </div>
                        <p className="text-sm text-gray-400">Đang chuyển hướng về trang đăng nhập...</p>
                    </>
                ) : (
                    <>
                        <h2 className="text-2xl font-semibold text-gray-900">Đang xác thực tài khoản...</h2>
                        <p className="mt-2 text-gray-600">Vui lòng chờ trong giây lát.</p>
                    </>
                )}
            </div>
        </div>
    );
};
