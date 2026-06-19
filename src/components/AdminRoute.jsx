import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Navigate, Link, useLocation } from 'react-router-dom';

export default function AdminRoute({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (authLoading) {
      return; // Esperar a que la autenticación termine
    }

    if (!user) {
      setCheckingAdmin(false);
      return; // Si no hay usuario, no es admin
    }

    const checkAdminStatus = async () => {
      try {
        setCheckingAdmin(true);
        const { data, error } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
          throw error;
        }

        if (data) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user, authLoading]);

  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Verificando permisos...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-4">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Acceso No Autorizado</h1>
        <p className="text-gray-700">No tienes los permisos necesarios para acceder a esta página.</p>
        <Link to="/" className="mt-6 text-blue-600 hover:underline">Volver al inicio</Link>
      </div>
    );
  }

  return children;
}
