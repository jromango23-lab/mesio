import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import BrandManager from '../components/BrandManager';
import CategoriesManager from '../components/CategoriesManager';
import ProductsManager from '../components/ProductsManager';
import { QRCodeCanvas } from 'qrcode.react';

export default function AdminRestaurantManage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };
  const [importFile, setImportFile] = useState(null);
  const [importUrl, setImportUrl] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importRefreshKey, setImportRefreshKey] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  const handleConfirmImport = async () => {
    if (!importPreview || !importPreview.categories || importPreview.categories.length === 0) {
      setImportMessage('Error: No hay datos en la vista previa para importar.');
      setTimeout(() => setImportMessage(''), 6000);
      return;
    }

    const isConfirmed = window.confirm('¿Seguro que quieres importar estas categorías y productos al restaurante?');
    if (!isConfirmed) {
      return;
    }

    setIsImporting(true);
    setImportMessage('Iniciando importación...');

    try {
      // Recorrer categorías e insertarlas secuencialmente
      for (let i = 0; i < importPreview.categories.length; i++) {
        const cat = importPreview.categories[i];
        
        // Crear categoría
        const { data: newCat, error: catError } = await supabase
          .from('categories')
          .insert([{
            restaurant_id: restaurantId,
            name: cat.name,
            display_order: i
          }])
          .select('id')
          .single();

        if (catError) {
          throw new Error(`Error al crear la categoría "${cat.name}": ${catError.message}`);
        }

        if (!newCat || !newCat.id) {
          throw new Error(`No se pudo obtener el ID de la categoría recién creada "${cat.name}".`);
        }

        // Si la categoría tiene productos, crearlos
        if (cat.products && cat.products.length > 0) {
          const isFromUrl = !importFile;
          const productsToInsert = cat.products.map(prod => {
            let cleanPrice = 0;
            if (prod.price !== undefined && prod.price !== null) {
              const parsed = Number(prod.price);
              cleanPrice = isNaN(parsed) ? 0 : parsed;
            }

            let cleanImageUrl = null;
            if (
              isFromUrl &&
              prod.image_confidence === 'high' &&
              prod.image_url &&
              (prod.image_url.startsWith('http://') || prod.image_url.startsWith('https://'))
            ) {
              cleanImageUrl = prod.image_url;
            }

            return {
              category_id: newCat.id,
              name: prod.name,
              description: prod.description || null,
              price: cleanPrice,
              image_url: cleanImageUrl
            };
          });

          const { error: prodError } = await supabase
            .from('products')
            .insert(productsToInsert);

          if (prodError) {
            throw new Error(`Error al insertar productos en la categoría "${cat.name}": ${prodError.message}`);
          }
        }
      }

      // Éxito
      setImportMessage('¡Categorías y productos importados con éxito!');
      setImportPreview(null);
      setImportFile(null);
      setImportUrl('');
      setImportRefreshKey(prev => prev + 1);
      setTimeout(() => setImportMessage(''), 8000);
    } catch (err) {
      console.error('Error durante la importación:', err);
      setImportMessage(err.message || 'Ocurrió un error inesperado al guardar la importación.');
    } finally {
      setIsImporting(false);
    }
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-slate-400 font-mono hidden sm:inline">ID: {restaurant.id}</span>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-550" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        
        {/* Header con Info del Restaurante y Botones Rápidos */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                {restaurant.name}
                {restaurant.primary_color && (
                  <span className="h-4 w-4 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: restaurant.primary_color }} title={`Color primario: ${restaurant.primary_color}`}></span>
                )}
              </h1>
            </div>
            <p className="text-slate-450 text-sm mt-1 font-mono">slug: {restaurant.slug}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm border ${
              restaurant.is_active 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                : 'bg-rose-50 text-rose-700 border-rose-100'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${restaurant.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              {restaurant.is_active ? 'Activo' : 'Inactivo'}
            </span>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border capitalize shadow-sm ${
              restaurant.plan === 'pro' 
                ? 'bg-purple-50 text-purple-700 border-purple-100' 
                : restaurant.plan === 'basic'
                  ? 'bg-blue-50 text-blue-700 border-blue-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}>
              Plan {restaurant.plan}
            </span>

            <div className="h-6 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>

            <a 
              href={getPublicMenuUrl()} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              Ver menú público
            </a>

            <button 
              onClick={handleCopyLink}
              className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              {copied ? '¡Copiado!' : 'Copiar link'}
            </button>
          </div>
        </div>

        {/* Tarjetas de Resumen Tipo Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado del Menú</span>
              <div className="mt-2 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${restaurant.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                <span className="text-sm font-bold text-slate-800">
                  {restaurant.is_active ? 'Visible al público' : 'Desactivado temporalmente'}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 border-t border-slate-100 pt-2">Determina si los usuarios pueden ver el menú online.</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan de Suscripción</span>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800 capitalize flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${restaurant.plan === 'pro' ? 'bg-purple-500' : restaurant.plan === 'basic' ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                  Plan {restaurant.plan}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 border-t border-slate-100 pt-2">Define las funcionalidades y límites de subida de imágenes.</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Enlace Público (Slug)</span>
              <div className="mt-2">
                <span className="text-xs font-mono font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 select-all">
                  {restaurant.slug}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 border-t border-slate-100 pt-2">Identificador único utilizado en la dirección URL pública.</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Código QR del Menú</span>
              <div className="mt-2 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-bold text-slate-800">Generado y listo</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 border-t border-slate-100 pt-2">Código QR interactivo disponible para previsualizar e imprimir.</p>
          </div>
        </div>

        {/* Layout en Dos Columnas (Escritorio) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Columna Principal (2/3 de ancho) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Importar menú */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Importar menú</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Sube un PDF o pega una URL de una carta existente para convertirla en categorías y productos.</p>
                </div>
              </div>
              
              <div className="p-6">
                 <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (isAnalyzing) return;
                    
                    if (!importFile && !importUrl.trim()) {
                      setImportMessage('Por favor, selecciona un archivo PDF o ingresa una dirección URL válida para comenzar el análisis.');
                      setTimeout(() => setImportMessage(''), 6000);
                      return;
                    }

                    setIsAnalyzing(true);
                    setImportMessage('Iniciando análisis con IA...');
                    setImportPreview(null); // Limpiar previo anterior

                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session || !session.access_token) {
                        throw new Error('No hay sesión activa de administrador.');
                      }

                      let responseData = null;

                      if (importFile) {
                        // Validar límite de 10 MB
                        if (importFile.size > 10 * 1024 * 1024) {
                          throw new Error('El archivo PDF excede el límite de 10 MB.');
                        }

                        // Leer archivo como Base64
                        const base64Data = await new Promise((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const result = reader.result;
                            if (typeof result === 'string') {
                              resolve(result.split(',')[1]);
                            } else {
                              reject(new Error('Fallo al leer el archivo PDF.'));
                            }
                          };
                          reader.onerror = () => reject(reader.error);
                          reader.readAsDataURL(importFile);
                        });

                        const { data, error: invokeError } = await supabase.functions.invoke('analyze-menu-import', {
                          headers: {
                            Authorization: `Bearer ${session.access_token}`,
                          },
                          body: {
                            type: 'pdf',
                            pdfData: base64Data,
                            fileName: importFile.name
                          }
                        });

                        if (invokeError) throw invokeError;
                        responseData = data;
                      } else {
                        // Analizar desde URL
                        const { data, error: invokeError } = await supabase.functions.invoke('analyze-menu-import', {
                          headers: {
                            Authorization: `Bearer ${session.access_token}`,
                          },
                          body: {
                            type: 'url',
                            menuUrl: importUrl.trim()
                          }
                        });

                        if (invokeError) throw invokeError;
                        responseData = data;
                      }

                      if (!responseData || !responseData.categories) {
                        throw new Error('La respuesta del análisis no contiene categorías válidas.');
                      }

                      // Mapear "items" de la Edge Function a "products" esperados por la UI
                      const formattedCategories = responseData.categories.map((cat) => ({
                        name: cat.name,
                        products: cat.items || []
                      }));

                      setImportPreview({
                        categories: formattedCategories
                      });

                      setImportMessage('Análisis completado con éxito. Revisa la vista previa a continuación.');
                      setTimeout(() => setImportMessage(''), 8000);
                    } catch (err) {
                      console.error('Error analizando menú:', err);
                      setImportMessage(err.message || 'Ocurrió un error al intentar analizar el menú.');
                    } finally {
                      setIsAnalyzing(false);
                    }
                  }} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cargar Archivo PDF</label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100/50 transition-colors p-4">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-2.5 text-slate-450" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <p className="mb-1 text-xs text-slate-500 text-center"><span className="font-semibold text-indigo-600">Haz clic para subir</span> o arrastra</p>
                            <p className="text-[10px] text-slate-400 font-medium">Solo PDF (máx. 10MB)</p>
                          </div>
                          <input 
                            type="file" 
                            accept=".pdf" 
                            className="hidden" 
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                      {importFile && (
                        <p className="mt-2 text-xs text-slate-650 font-semibold flex items-center gap-1.5 bg-slate-50 p-2 rounded border border-slate-200 truncate" title={importFile.name}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Archivo: {importFile.name}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col justify-between">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Importar desde URL Web</label>
                        <input 
                          type="url" 
                          placeholder="Ej: https://misitio.com/carta-digital" 
                          value={importUrl} 
                          onChange={(e) => setImportUrl(e.target.value)} 
                          className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 text-sm border text-slate-800" 
                        />
                        <p className="text-[11px] text-slate-400 mt-2">Introduce la dirección URL de la carta actual de tu restaurante.</p>
                      </div>

                      <div className="pt-4 md:pt-0">
                        <button 
                          type="submit"
                          disabled={isAnalyzing}
                          className="w-full flex justify-center items-center gap-1.5 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors cursor-pointer"
                        >
                          {isAnalyzing ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Analizando...
                            </>
                          ) : 'Analizar menú'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {importMessage && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3.5 rounded-lg text-xs font-medium flex items-start gap-2.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-bold text-indigo-900">¡Información!</p>
                        <p className="mt-0.5">{importMessage}</p>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Vista previa de importación */}
            {importPreview && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden animate-fade-in">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-indigo-50/20">
                  <div className="flex items-center gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Vista previa de importación</h3>
                      <p className="text-slate-400 text-xs mt-0.5">Revisa las categorías y productos detectados antes de cargarlos en el sistema.</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-indigo-50 text-indigo-750 border border-indigo-150 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                    Vista previa del análisis
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  {importPreview.categories.map((cat, cIdx) => (
                    <div key={`preview-cat-${cIdx}`} className="space-y-3">
                      <h4 className="text-sm font-bold text-slate-800 bg-slate-50 px-3 py-1.5 rounded border border-slate-100 flex items-center justify-between">
                        <span>Categoría: {cat.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{cat.products.length} productos detectados</span>
                      </h4>
                      
                      <div className="divide-y divide-slate-100">
                        {cat.products.map((prod, pIdx) => (
                          <div key={`preview-prod-${pIdx}`} className="py-3 flex justify-between items-start gap-4 border-b border-slate-100/50 last:border-0">
                            <div className="flex gap-3 items-start">
                              {prod.image_url && (
                                <img 
                                  src={prod.image_url} 
                                  alt={prod.name} 
                                  className="h-12 w-12 rounded-lg object-cover border border-slate-200 p-0.5 bg-white flex-shrink-0"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              )}
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-bold text-slate-850">{prod.name}</p>
                                  {prod.image_confidence === 'high' && (
                                    <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-150 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                      Imagen detectada: alta confianza
                                    </span>
                                  )}
                                  {prod.image_confidence === 'medium' && (
                                    <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-150 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                      Posible imagen: revisar
                                    </span>
                                  )}
                                  {prod.image_confidence === 'low' && (
                                    <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                      Posible imagen: baja confianza
                                    </span>
                                  )}
                                </div>
                                {prod.description && (
                                  <p className="text-xs text-slate-550 max-w-xl">{prod.description}</p>
                                )}
                                {prod.image_hint && (
                                  <p className="text-[10px] text-slate-400 italic">
                                    Sugerencia visual: {prod.image_hint}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                              {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(prod.price || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
                    <button
                      onClick={() => {
                        setImportPreview(null);
                        setImportFile(null);
                        setImportUrl('');
                        setImportMessage('');
                      }}
                      className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer text-center"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={isImporting}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer text-center"
                    >
                      {isImporting ? 'Importando...' : 'Confirmar importación'}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                <CategoriesManager key={`categories-${importRefreshKey}`} targetRestaurantId={restaurantId} />
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
                <ProductsManager key={`products-${importRefreshKey}`} targetRestaurantId={restaurantId} />
              </div>
            </div>

          </div>

          {/* Columna Lateral (1/3 de ancho) */}
          <div className="space-y-8">
            
            {/* Identidad de marca */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Identidad de Marca</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Configuración de marca, logotipo y color.</p>
                </div>
              </div>
              <div className="p-6">
                <BrandManager 
                  targetRestaurantId={restaurantId} 
                  onBrandUpdate={(updatedData) => setRestaurant(updatedData)} 
                />
              </div>
            </div>

            {/* Código QR */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Código QR del Menú</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Acceso y previsualización para impresión.</p>
                </div>
              </div>
              <div className="p-6 flex flex-col items-center text-center">
                {restaurant && restaurant.slug && (
                  <>
                    <div className="flex justify-center mb-6 bg-white p-4 inline-block rounded-xl shadow-sm border border-slate-100">
                      <QRCodeCanvas 
                        id="admin-qr-code-canvas"
                        value={`${import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin}/menu/${restaurant.slug}`}
                        size={160}
                        level={"H"}
                        includeMargin={true}
                      />
                    </div>
                    
                    <p className="text-slate-600 text-[11px] mb-4 break-all bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono w-full select-all">
                      {`${import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin}/menu/${restaurant.slug}`}
                    </p>

                    <div className="flex flex-col gap-2 w-full">
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
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                      >
                        Descargar QR
                      </button>

                      <div className="flex gap-2">
                        <button 
                          onClick={handleCopyLink}
                          className="flex-1 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                        >
                          {copied ? '¡Copiado!' : 'Copiar link'}
                        </button>

                        <a 
                          href={getPublicMenuUrl()} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-sm text-center font-semibold"
                        >
                          Ver menú
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Acciones Rápidas</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Accesos directos e información técnica.</p>
                </div>
              </div>
              <div className="p-6 space-y-3">
                <a 
                  href={getPublicMenuUrl()} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full inline-flex justify-center items-center gap-1.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Visitar Menú Público
                </a>

                <button 
                  onClick={handleCopyLink}
                  className="w-full inline-flex justify-center items-center gap-1.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  {copied ? '¡Enlace Copiado!' : 'Copiar Enlace'}
                </button>

                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5 text-[11px] text-slate-500">
                  <div className="flex justify-between">
                    <span>ID de Restaurante:</span>
                    <span className="font-mono font-semibold text-slate-700">{restaurant.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fecha Registro:</span>
                    <span className="font-semibold text-slate-700">{new Date(restaurant.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer simple */}
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
