import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export default function Register() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-tr from-slate-50 to-slate-100/50 p-4">
      {/* Logo y Nombre de Marca */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-extrabold text-xl shadow-sm">
          M
        </div>
        <span className="text-2xl font-extrabold text-slate-800 tracking-tight animate-fade-in">Mesio</span>
      </div>

      {/* Tarjeta de Registro Cerrado */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-md w-full max-w-md text-center">
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
  );
}
