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
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              &larr; Volver
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-xs bg-red-100 text-red-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Modo soporte/admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-slate-500 font-mono">ID: {restaurant.id}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 sm:p-8 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{restaurant.name}</h1>
                {restaurant.primary_color && (
                  <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: restaurant.primary_color }} title={`Color primario: ${restaurant.primary_color}`}></span>
                )}
              </div>
              <p className="text-slate-400 text-sm font-mono">slug: {restaurant.slug}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${restaurant.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {restaurant.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </div>

          {/* Details Body */}
          <div className="p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-bold text-slate-700 border-b pb-2">Datos Básicos</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Nombre del Restaurante</p>
                <p className="mt-1 text-slate-800 font-medium text-lg">{restaurant.name}</p>
              </div>

              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Plan de Suscripción</p>
                <p className="mt-1 text-slate-800 font-bold capitalize text-lg flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${restaurant.plan === 'pro' ? 'bg-purple-500' : restaurant.plan === 'basic' ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                  {restaurant.plan}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Identificador URL (Slug)</p>
                <p className="mt-1 text-slate-800 font-mono bg-slate-100 px-2.5 py-1 rounded inline-block text-sm">
                  {restaurant.slug}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Estado de Visibilidad</p>
                <p className="mt-1 text-slate-800 font-semibold flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${restaurant.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  {restaurant.is_active ? 'Activo (Visible al público)' : 'Inactivo (Deshabilitado)'}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Enlace Público del Menú</p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={getPublicMenuUrl()} 
                  className="flex-1 bg-slate-50 text-slate-600 text-sm px-3 py-2 rounded-lg border border-slate-200 font-mono select-all focus:outline-none"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={handleCopyLink}
                    className="flex-1 sm:flex-initial px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    {copied ? '¡Copiado!' : 'Copiar'}
                  </button>
                  <a 
                    href={getPublicMenuUrl()} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium text-center transition-colors"
                  >
                    Ver Menú
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 bg-slate-900 text-white">
            <h2 className="text-xl font-bold">Marca del Restaurante</h2>
            <p className="text-slate-400 text-sm">Gestiona la identidad visual del restaurante como administrador de soporte.</p>
          </div>
          <div className="p-6 sm:p-8">
            <BrandManager 
              targetRestaurantId={restaurantId} 
              onBrandUpdate={(updatedData) => setRestaurant(updatedData)} 
            />
          </div>
        </div>

        <div className="mt-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 bg-slate-900 text-white">
            <h2 className="text-xl font-bold">Categorías del Menú</h2>
            <p className="text-slate-400 text-sm">Crea, edita o elimina las categorías del menú de este restaurante.</p>
          </div>
          <div className="p-6 sm:p-8">
            <CategoriesManager targetRestaurantId={restaurantId} />
          </div>
        </div>

        <div className="mt-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 bg-slate-900 text-white">
            <h2 className="text-xl font-bold">Productos del Menú</h2>
            <p className="text-slate-400 text-sm">Gestiona la lista de productos y precios para este restaurante.</p>
          </div>
          <div className="p-6 sm:p-8">
            <ProductsManager targetRestaurantId={restaurantId} />
          </div>
        </div>

        <div className="mt-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 bg-slate-900 text-white">
            <h2 className="text-xl font-bold">Código QR del Menú</h2>
            <p className="text-slate-400 text-sm">Código QR listo para impresión y distribución para acceder directamente al menú público.</p>
          </div>
          <div className="p-6 sm:p-8 flex flex-col items-center text-center">
            {restaurant && restaurant.slug && (
              <>
                <div className="flex justify-center mb-6 bg-white p-4 inline-block rounded-lg shadow-sm border border-slate-100">
                  <QRCodeCanvas 
                    id="admin-qr-code-canvas"
                    value={`${import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin}/menu/${restaurant.slug}`}
                    size={200}
                    level={"H"}
                    includeMargin={true}
                  />
                </div>
                
                <p className="text-slate-600 text-sm mb-6 break-all bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono w-full select-all">
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
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                  >
                    Descargar QR
                  </button>

                  <button 
                    onClick={handleCopyLink}
                    className="w-full py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    {copied ? '¡Copiado!' : 'Copiar link'}
                  </button>

                  <a 
                    href={getPublicMenuUrl()} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm text-center"
                  >
                    Ver menú
                  </a>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Link 
            to="/admin" 
            className="px-6 py-2.5 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-colors text-sm font-semibold flex items-center gap-1.5 shadow-sm"
          >
            &larr; Volver al Panel de Administración
          </Link>
        </div>
      </main>
    </div>
  );
}
