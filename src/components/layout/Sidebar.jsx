import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function Sidebar({
  navigationItems = [],
  activeItem,
  onNavigate,
  userRole,
  isMobile = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  className = '',
}) {
  const brandName = 'Mesio';
  const subtitleText = userRole === 'admin' ? 'Administración Mesio' : 'Menú Digital';

  const handleItemClick = (itemId) => {
    onNavigate(itemId);
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={`h-full bg-white border-r border-slate-200 flex flex-col transition-all duration-300 relative ${
        isMobile ? 'w-64' : isCollapsed ? 'w-16' : 'w-64'
      } ${className}`}
    >
      {/* Header del Sidebar */}
      <div className="h-14 px-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          {/* Logo */}
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-extrabold text-base flex-shrink-0">
            M
          </div>
          {/* Nombre de Marca */}
          {(!isCollapsed || isMobile) && (
            <div className="flex flex-col truncate">
              <span className="text-sm font-bold text-slate-800 tracking-tight leading-none">
                {brandName}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 font-semibold truncate">
                {subtitleText}
              </span>
            </div>
          )}
        </div>

        {/* Botón Cerrar (en móvil) */}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Cerrar menú de navegación"
            title="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-4 overflow-y-auto px-3 space-y-1">
        {navigationItems.map((item) => {
          const isActive = activeItem === item.id;
          const Icon = item.icon;

          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                } ${isCollapsed && !isMobile ? 'justify-center px-2' : ''}`}
                aria-label={item.label}
              >
                {Icon && <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />}
                {(!isCollapsed || isMobile) && <span className="truncate text-left">{item.label}</span>}
              </button>

              {/* Tooltip cuando está plegado */}
              {isCollapsed && !isMobile && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-md">
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer del Sidebar / Botón de Plegar */}
      {!isMobile && onToggleCollapse && (
        <div className="p-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-450 hover:bg-slate-50 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-500"
            aria-label={isCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
            title={isCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      )}
    </aside>
  );
}
