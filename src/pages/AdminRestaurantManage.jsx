import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import BrandManager from '../components/BrandManager';
import CategoriesManager from '../components/CategoriesManager';
import ProductsManager from '../components/ProductsManager';
import { QRCodeCanvas } from 'qrcode.react';

export default function AdminRestaurantManage() {
  const { restaurantId } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', restaurantId)
          .single();

        if (fetchError) throw fetchError;
        setRestaurant(data);
      } catch (err) {
        console.error('Error fetching restaurant details for support:', err);
        setError('No se pudo obtener la información del restaurante.');
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurant();
  }, [restaurantId]);

  const getPublicMenuUrl = () => {
    if (!restaurant) return '';
    const baseUrl = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;
    return `${baseUrl}/menu/${restaurant.slug}`;
  };

  const handleCopyLink = () => {
    const url = getPublicMenuUrl();
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => console.error('Error copying link:', err));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando datos de soporte...</p>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-6">{error || 'Restaurante no encontrado'}</p>
          <Link to="/admin" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium transition-colors">
            Volver al panel admin
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Nav */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <Link to="/admin" className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors font-semibold text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver al Panel
              </Link>
              <span className="text-slate-300">|</span>
              <span className="text-xs bg-rose-50 text-rose-700 border border-rose-100 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                Modo Soporte / Admin
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-slate-400 font-mono hidden sm:inline">ID: {restaurant.id}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Resumen del restaurante */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold text-slate-850 flex items-center gap-2">
                  {restaurant.name}
                  {restaurant.primary_color && (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: restaurant.primary_color }} title={`Color primario: ${restaurant.primary_color}`}></span>
                  )}
                </h2>
              </div>
              <p className="text-slate-450 text-xs mt-1 font-mono">slug: {restaurant.slug}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm border ${
                restaurant.is_active 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                  : 'bg-rose-50 text-rose-700 border-rose-100'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${restaurant.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                {restaurant.is_active ? 'Activo' : 'Inactivo'}
              </span>

              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border capitalize shadow-sm ${
                restaurant.plan === 'pro' 
                  ? 'bg-purple-50 text-purple-700 border-purple-100' 
                  : restaurant.plan === 'basic'
                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}>
                Plan {restaurant.plan}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre del Restaurante</span>
                <span className="block mt-1 text-slate-800 font-bold text-base">{restaurant.name}</span>
              </div>
              
              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Identificador URL (Slug)</span>
                <span className="block mt-1 text-slate-800 font-mono text-sm bg-slate-50 px-2.5 py-0.5 rounded border border-slate-100 w-fit">{restaurant.slug}</span>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Plan de Suscripción</span>
                <span className="block mt-1 text-slate-850 font-semibold capitalize text-sm">{restaurant.plan}</span>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha de Creación</span>
                <span className="block mt-1 text-slate-600 text-sm font-medium">
                  {new Date(restaurant.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enlace Público del Menú</span>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input 
                  type="text" 
                  readOnly 
                  value={getPublicMenuUrl()} 
                  className="flex-1 bg-slate-50 text-slate-600 text-sm px-3 py-2.5 rounded-lg border border-slate-200 font-mono select-all focus:outline-none"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={handleCopyLink}
                    className="flex-1 sm:flex-initial px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                  >
                    {copied ? '¡Copiado!' : 'Copiar link'}
                  </button>
                  <a 
                    href={getPublicMenuUrl()} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold text-center transition-colors shadow-sm"
                  >
                    Ver menú
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Identidad y marca */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Identidad y Marca</h3>
              <p className="text-slate-400 text-xs mt-0.5">Gestiona la identidad visual del restaurante como administrador de soporte.</p>
            </div>
          </div>
          <div className="p-6">
            <BrandManager 
              targetRestaurantId={restaurantId} 
              onBrandUpdate={(updatedData) => setRestaurant(updatedData)} 
            />
          </div>
        </div>

        {/* Categorías del menú */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Categorías del Menú</h3>
              <p className="text-slate-400 text-xs mt-0.5">Crea, edita o elimina las categorías del menú de este restaurante.</p>
            </div>
          </div>
          <div className="p-6">
            <CategoriesManager targetRestaurantId={restaurantId} />
          </div>
        </div>

        {/* Productos del menú */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Productos del Menú</h3>
              <p className="text-slate-400 text-xs mt-0.5">Gestiona la lista de productos y precios para este restaurante.</p>
            </div>
          </div>
          <div className="p-6">
            <ProductsManager targetRestaurantId={restaurantId} />
          </div>
        </div>

        {/* Código QR del menú */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Código QR del Menú</h3>
              <p className="text-slate-400 text-xs mt-0.5">Código QR listo para impresión y distribución para acceder directamente al menú público.</p>
            </div>
          </div>
          <div className="p-6 flex flex-col items-center text-center">
            {restaurant && restaurant.slug && (
              <>
                <div className="flex justify-center mb-6 bg-white p-4 inline-block rounded-xl shadow-sm border border-slate-100">
                  <QRCodeCanvas 
                    id="admin-qr-code-canvas"
                    value={`${import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin}/menu/${restaurant.slug}`}
                    size={200}
                    level={"H"}
                    includeMargin={true}
                  />
                </div>
                
                <p className="text-slate-600 text-xs mb-6 break-all bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono w-full select-all max-w-lg">
                  {`${import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin}/menu/${restaurant.slug}`}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md">
                  <button 
                    onClick={() => {
                      const canvas = document.getElementById('admin-qr-code-canvas');
                      if (canvas) {
                        const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
                        const downloadLink = document.createElement('a');
                        downloadLink.href = pngUrl;
                        downloadLink.download = `qr-${restaurant.slug}.png`;
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                      }
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                  >
                    Descargar QR
                  </button>

                  <button 
                    onClick={handleCopyLink}
                    className="w-full py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                  >
                    {copied ? '¡Copiado!' : 'Copiar link'}
                  </button>

                  <a 
                    href={getPublicMenuUrl()} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm text-center font-semibold"
                  >
                    Ver menú
                  </a>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Acciones rápidas / Footer */}
        <div className="flex justify-center pt-4">
          <Link 
            to="/admin" 
            className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-colors text-sm font-semibold flex items-center gap-1.5 shadow-sm bg-white cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Panel de Administración
          </Link>
        </div>
      </main>
    </div>
  );
}
