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

            // 1. Check for direct query parameter token (Legacy)
            const queryToken = searchParams.get('token');
            if (queryToken) {
                processedRef.current = true;
                localStorage.setItem('token', queryToken);
                handleRedirect();
                return;
            }

            try {
                const supabase = await getSupabaseClient();

                // 2. Handle PKCE code flow (Supabase OAuth returns ?code=...)
                const code = searchParams.get('code');
                if (code) {
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) {
                        throw new Error(`Authentication failed: ${error.message}`);
                    }
                    if (data?.session?.access_token) {
                        processedRef.current = true;
                        return await exchangeSupabaseToken(data.session.access_token);
                    }
                }

                // 3. Handle Implicit Token flow from URL Hash (#access_token=...)
                const hash = window.location.hash;
                if (hash && hash.includes('access_token')) {
                    const params = new URLSearchParams(hash.replace(/^#/, ''));
                    const accessToken = params.get('access_token');
                    if (accessToken) {
                        processedRef.current = true;
                        return await exchangeSupabaseToken(accessToken);
                    }
                }

                // 4. Check existing session in Supabase Client
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                    processedRef.current = true;
                    return await exchangeSupabaseToken(session.access_token);
                }

                // 5. Listen for auth state change
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
                    if (session?.access_token && !processedRef.current) {
                        processedRef.current = true;
                        await exchangeSupabaseToken(session.access_token);
                    }
                });

                // Fallback timeout after 5 seconds
                setTimeout(() => {
                    if (!processedRef.current && isMounted) {
                        subscription.unsubscribe();
                        setErrorMessage('Did not receive a valid session from authentication provider.');
                        setTimeout(() => navigate('/login', { replace: true }), 3500);
                    }
                }, 5000);

            } catch (err: any) {
                if (isMounted) {
                    const serverError = err.response?.data?.error || err.response?.data?.message;
                    const msg = serverError || err.message || 'Error synchronizing account session';
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
                    throw new Error('Server did not return a valid session token');
                }
            } catch (err: any) {
                if (isMounted) {
                    const serverError = err.response?.data?.error || err.response?.data?.message;
                    const msg = serverError || err.message || 'Login was unsuccessful';
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
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="text-center p-8 bg-card rounded-xl shadow-sm border border-border max-w-md w-full text-card-foreground">
                {errorMessage ? (
                    <>
                        <h2 className="text-xl font-semibold text-destructive mb-2">Authentication Failed</h2>
                        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm mb-4 break-words">
                            {errorMessage}
                        </div>
                        <p className="text-xs text-muted-foreground">Redirecting to login page...</p>
                    </>
                ) : (
                    <>
                        <h2 className="text-xl font-semibold text-foreground">Verifying account...</h2>
                        <p className="mt-2 text-sm text-muted-foreground">Please wait a moment while we set up your session.</p>
                    </>
                )}
            </div>
        </div>
    );
};
