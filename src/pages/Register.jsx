import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export default function Register() {
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
            className="h-12 w-auto max-w-[200px] object-contain animate-fade-in"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/brand/mesio-icon.png";
            }}
          />
        </div>

        {/* Tarjeta de Registro Cerrado */}
        <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl border border-slate-200/80 shadow-md w-full max-w-md text-center">
        <div className="p-3 bg-red-50 text-red-750 rounded-full mb-4 inline-block border border-red-100/50">
          <ShieldAlert className="h-6 w-6 text-red-650" />
        </div>
        
        <h2 className="text-xl font-bold text-slate-800 mb-2">Registro cerrado</h2>
        <p className="text-xs text-slate-500 mb-6 max-w-xs mx-auto leading-relaxed">
          Mesio funciona con acceso autorizado. Las nuevas cuentas de clientes y restaurantes se crean exclusivamente desde el panel de administración.
        </p>

        <Link to="/login" className="w-full block">
          <Button variant="secondary" className="w-full h-10 gap-1.5 font-semibold">
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Login</span>
          </Button>
        </Link>
      </div>
      </div>
    </div>
  );
}
