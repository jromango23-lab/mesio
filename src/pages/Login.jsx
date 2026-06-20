import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
    } else {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-tr from-slate-100 to-blue-50/30 bg-[url('/brand/fondo-movil.png')] md:bg-[url('/brand/fondo-computadora.png')] bg-cover bg-center bg-no-repeat p-4 relative">
      {/* Soft Overlay */}
      <div className="absolute inset-0 bg-slate-900/15 backdrop-blur-[1px]" />

      {/* Content wrapper with z-index */}
      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Logo de Mesio */}
        <div className="mb-8 flex justify-center">
          <img
            src="/brand/mesio-logo.png"
            alt="Mesio"
            className="h-12 w-auto max-w-[200px] object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/brand/mesio-icon.png";
            }}
          />
        </div>

        {/* Tarjeta de Login */}
        <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl border border-slate-200/80 shadow-md w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">Iniciar Sesión</h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">Administra tu menú digital</p>
        </div>

        {error && (
          <div 
            className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-xs font-semibold flex items-center gap-2 mb-5 animate-fade-in"
            role="alert"
          >
            <ShieldAlert className="h-4 w-4 text-red-650 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Correo electrónico"
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 gap-1.5 mt-2"
            aria-label="Iniciar sesión"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" />
                <span>Entrando...</span>
              </>
            ) : (
              <span>Entrar</span>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400 font-medium">
          ¿Quieres usar Mesio? Solicita acceso al administrador.
        </p>
      </div>
      </div>
    </div>
  );
}
