import React from 'react';
import { Menu, LogOut, ArrowLeft, ExternalLink, ShieldAlert } from 'lucide-react';
import Button from '../ui/Button';

export default function Topbar({
  userName,
  userRole,
  onLogout,
  supportContext,
  onMenuClick,
  activeItemLabel,
  className = '',
}) {
  const isSupportMode = !!supportContext;

  return (
    <div className={`flex flex-col border-b border-slate-200 sticky top-0 z-30 bg-white ${className}`}>
      {/* Banner de Modo Soporte */}
      {isSupportMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-amber-900 text-xs sm:text-sm font-medium">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 animate-pulse flex-shrink-0" />
            <span>
              <strong>Modo Soporte</strong> &mdash; Administrando: <span className="font-bold text-amber-950">{supportContext.restaurantName}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {supportContext.onBackToAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={supportContext.onBackToAdmin}
                className="text-amber-800 hover:bg-amber-100 hover:text-amber-950 font-semibold h-7 px-2.5 text-xs gap-1 border border-amber-200 bg-amber-50/50"
                aria-label="Volver al panel administrador"
                title="Volver al panel administrador"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Volver al Panel</span>
              </Button>
            )}
            {supportContext.onViewPublicMenu && (
              <Button
                variant="ghost"
                size="sm"
                onClick={supportContext.onViewPublicMenu}
                className="text-amber-800 hover:bg-amber-100 hover:text-amber-950 font-semibold h-7 px-2.5 text-xs gap-1 border border-amber-200 bg-amber-50/50"
                aria-label="Ver menú público"
                title="Ver menú público"
              >
                <ExternalLink className="h-3 w-3" />
                <span>Ver Menú Público</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Barra superior principal */}
      <header className="h-14 px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Botón menú móvil */}
          <button
            onClick={onMenuClick}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Abrir menú de navegación"
            title="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          {/* Título de sección activa */}
          {activeItemLabel && (
            <h1 className="text-sm font-semibold text-slate-700 hidden sm:block">
              {activeItemLabel}
            </h1>
          )}
        </div>

        {/* Info usuario y Cierre de Sesión */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden xs:block">
            <p className="text-xs font-semibold text-slate-800 leading-tight">
              {userName}
            </p>
            <p className="text-[10px] text-slate-400 font-medium capitalize">
              {userRole === 'admin' ? 'Administrador' : 'Cliente'}
            </p>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 hidden xs:block"></div>

          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg text-slate-450 hover:bg-red-50 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-500"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
    </div>
  );
}
