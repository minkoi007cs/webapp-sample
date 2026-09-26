import { Button, message } from 'antd';
import { Shield } from 'lucide-react';
import { useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';

export const Login = () => {
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            const supabase = await getSupabaseClient();
            const redirectTarget = window.location.origin.replace(/\/+$/, '');
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${redirectTarget}/login-success`,
                },
            });

            if (error) {
                message.error(`Login failed: ${error.message}`);
                setLoading(false);
            }
        } catch (err: any) {
            message.error(err.message || 'Error connecting to Google authentication');
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                <div className="rounded-xl border border-border bg-card p-8 shadow-sm text-card-foreground">
                    <div className="flex flex-col space-y-2 text-center mb-8">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground mb-2 shadow-xs">
                            <Shield className="h-6 w-6" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
                            Family Assets
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Sign in with your Google account to access your workspace
                        </p>
                    </div>

                    <div className="grid gap-4">
                        <Button
                            type="default"
                            size="large"
                            block
                            loading={loading}
                            onClick={handleGoogleLogin}
                            className="h-11 rounded-md !border-input hover:!bg-accent hover:!text-accent-foreground flex items-center justify-center text-sm font-medium font-sans shadow-xs"
                            title="Sign in with Google"
                            aria-label="Sign in with Google"
                            icon={!loading && (
                                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                        fill="#EA4335"
                                    />
                                </svg>
                            )}
                        >
                            {loading ? 'Connecting...' : 'Continue with Google'}
                        </Button>
                    </div>

                    <div className="mt-8 text-center text-xs text-muted-foreground">
                        Secure & real-time encrypted data synchronization
                    </div>
                </div>
            </div>
        </div>
    );
};

