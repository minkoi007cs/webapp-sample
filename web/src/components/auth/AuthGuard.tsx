import { Navigate, Outlet, useLocation } from 'react-router-dom';

export const AuthGuard = () => {
    const location = useLocation();
    const token = localStorage.getItem('token');
    const hasOAuthParams = location.search.includes('code=') || location.hash.includes('access_token=');

    if (hasOAuthParams) {
        return <Navigate to={`/login-success${location.search}${location.hash}`} replace />;
    }

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};
