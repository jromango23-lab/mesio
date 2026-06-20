import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell({
  navigationItems = [],
  activeItem,
  onNavigate,
  userName,
  userRole,
  onLogout,
  supportContext,
  children,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Cerrar el drawer móvil al presionar Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeItemLabel = navigationItems.find(item => item.id === activeItem)?.label || '';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar para pantallas grandes (Desktop & Tablet) */}
      <div className="hidden md:block flex-shrink-0 h-full">
        <Sidebar
          navigationItems={navigationItems}
          activeItem={activeItem}
          onNavigate={onNavigate}
          userRole={userRole}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Drawer para pantallas móviles */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Capa de fondo oscura (Overlay) */}
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setIsMobileOpen(false)}
          />
          {/* Contenedor del Sidebar móvil */}
          <div className="relative flex-shrink-0 w-64 max-w-[80vw] bg-white shadow-xl flex flex-col h-full z-10 transition-transform duration-200">
            <Sidebar
              navigationItems={navigationItems}
              activeItem={activeItem}
              onNavigate={onNavigate}
              userRole={userRole}
              isMobile={true}
              onClose={() => setIsMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Panel principal de contenido */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <Topbar
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
          supportContext={supportContext}
          activeItemLabel={activeItemLabel}
          onMenuClick={() => setIsMobileOpen(true)}
        />
        
        {/* Cuerpo del contenido (scrollable) */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
