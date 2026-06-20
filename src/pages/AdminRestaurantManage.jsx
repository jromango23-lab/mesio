import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import BrandManager from '../components/BrandManager';
import CategoriesManager from '../components/CategoriesManager';
import ProductsManager from '../components/ProductsManager';
import TablesManager from '../components/TablesManager';
import ServiceRequestsManager from '../components/ServiceRequestsManager';
import { QRCodeCanvas } from 'qrcode.react';
import AppShell from '../components/layout/AppShell';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
import { 
  LayoutDashboard, 
  FileUp, 
  Folder, 
  Store, 
  Palette, 
  QrCode, 
  ShieldAlert, 
  ArrowLeft, 
  ExternalLink, 
  Globe, 
  Copy, 
  Loader2, 
  Check, 
  TrendingUp,
  CheckCircle2,
  XCircle,
  UploadCloud,
  Bell
} from 'lucide-react';

export default function AdminRestaurantManage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [currentView, setCurrentView] = useState('resumen');

  // Counts for the summary tab
  const [categoriesCount, setCategoriesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);

  // Import State variables
  const [importFile, setImportFile] = useState(null);
  const [importUrl, setImportUrl] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importRefreshKey, setImportRefreshKey] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

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

  // Fetch counts when restaurantId or importRefreshKey changes
  useEffect(() => {
    if (!restaurantId) return;
    
    const fetchCounts = async () => {
      try {
        const { data: catData, error: catError } = await supabase
          .from('categories')
          .select('id')
          .eq('restaurant_id', restaurantId);

        if (!catError && catData) {
          setCategoriesCount(catData.length);
          if (catData.length > 0) {
            const catIds = catData.map(c => c.id);
            const { count, error: prodError } = await supabase
              .from('products')
              .select('*', { count: 'exact', head: true })
              .in('category_id', catIds);

            if (!prodError) {
              setProductsCount(count || 0);
            }
          } else {
            setProductsCount(0);
          }
        }
      } catch (err) {
        console.error('Error fetching counts for support dashboard:', err);
      }
    };

    fetchCounts();
  }, [restaurantId, importRefreshKey]);

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

  const handleImportSubmit = async (e) => {
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
          <Loader2 className="animate-spin h-10 w-10 text-blue-600 mb-4" />
          <p className="text-slate-500 font-medium">Cargando datos de soporte...</p>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-xl border border-slate-200 max-w-md w-full text-center shadow-sm">
          <ShieldAlert className="h-12 w-12 text-red-650 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-750 mb-2">Error</h2>
          <p className="text-slate-650 mb-6">{error || 'Restaurante no encontrado'}</p>
          <Button onClick={() => navigate('/admin')} variant="primary" className="w-full">
            Volver al panel admin
          </Button>
        </div>
      </div>
    );
  }

  const navigationItems = [
    { id: 'resumen', label: 'Resumen del restaurante', icon: LayoutDashboard },
    { id: 'importar', label: 'Importar carta', icon: FileUp },
    { id: 'requests', label: 'Solicitudes', icon: Bell },
    { id: 'categorias', label: 'Categorías', icon: Folder },
    { id: 'productos', label: 'Productos', icon: Store },
    { id: 'tables', label: 'Mesas / QR', icon: QrCode },
    { id: 'marca', label: 'Marca', icon: Palette },
    { id: 'qrcode', label: 'Código QR', icon: QrCode }
  ];

  const supportContext = {
    restaurantName: restaurant.name,
    onBackToAdmin: () => navigate('/admin'),
    onViewPublicMenu: () => window.open(getPublicMenuUrl(), '_blank')
  };

  return (
    <AppShell
      navigationItems={navigationItems}
      activeItem={currentView}
      onNavigate={setCurrentView}
      userName={user?.email || 'Soporte'}
      userRole="admin"
      onLogout={handleSignOut}
      supportContext={supportContext}
    >
      {currentView === 'resumen' && (
        <div className="space-y-6">
          <SectionHeader
            title="Resumen del Restaurante"
            description="Resumen operativo del restaurante administrado."
            icon={LayoutDashboard}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Nombre del Restaurante"
              value={restaurant.name}
              description="Nombre oficial registrado"
              icon={Store}
            />
            <StatCard
              title="Estado del Menú"
              value={restaurant.is_active ? 'Visible al público' : 'Desactivado'}
              description="Estado de visibilidad en la web"
              icon={restaurant.is_active ? CheckCircle2 : XCircle}
              className={restaurant.is_active ? 'border-emerald-100/50' : 'border-rose-100/50'}
            />
            <StatCard
              title="Plan de Suscripción"
              value={`Plan ${restaurant.plan}`}
              description="Nivel de suscripción actual"
              icon={TrendingUp}
              className={restaurant.plan === 'pro' ? 'border-purple-100/50' : 'border-blue-100/50'}
            />
            <StatCard
              title="Slug Público"
              value={restaurant.slug}
              description="URL identificadora en Mesio"
              icon={Globe}
            />
            <StatCard
              title="Categorías Creadas"
              value={categoriesCount}
              description="Secciones activas en el menú"
              icon={Folder}
            />
            <StatCard
              title="Productos Registrados"
              value={productsCount}
              description="Platillos y bebidas listados"
              icon={Store}
            />
          </div>
        </div>
      )}

      {currentView === 'importar' && (
        <div className="space-y-6">
          <SectionHeader
            title="Importar menú"
            description="Sube un PDF o pega una URL de una carta existente para convertirla en categorías y productos."
            icon={FileUp}
          />
          
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
            <form onSubmit={handleImportSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cargar Archivo PDF</label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-slate-200 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100/50 transition-colors p-4">
                      <div className="flex flex-col items-center justify-center pt-2 pb-3">
                        <UploadCloud className="w-8 h-8 mb-2.5 text-slate-400" />
                        <p className="mb-1 text-xs text-slate-550 text-center"><span className="font-semibold text-blue-600">Haz clic para subir</span> o arrastra</p>
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
                    <p className="mt-2 text-xs text-slate-600 font-semibold flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200 truncate" title={importFile.name}>
                      <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>Archivo: {importFile.name}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-col justify-between">
                  <Input 
                    label="Importar desde URL Web"
                    type="url" 
                    placeholder="Ej: https://misitio.com/carta-digital" 
                    value={importUrl} 
                    onChange={(e) => setImportUrl(e.target.value)} 
                    description="Introduce la dirección URL de la carta actual de tu restaurante."
                  />

                  <div className="pt-4 md:pt-0">
                    <Button 
                      type="submit"
                      disabled={isAnalyzing}
                      className="w-full h-10 gap-1.5"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="animate-spin h-4 w-4" />
                          <span>Analizando...</span>
                        </>
                      ) : (
                        <span>Analizar menú</span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {importMessage && (
                <div className="bg-blue-50 border border-blue-150 text-blue-800 p-4 rounded-lg text-xs font-medium flex items-start gap-2.5">
                  <ShieldAlert className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-blue-900">¡Información!</p>
                    <p className="mt-0.5">{importMessage}</p>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Vista previa de importación */}
          {importPreview && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden animate-fade-in">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Vista previa de importación</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Revisa las categorías y productos detectados antes de cargarlos en el sistema.</p>
                  </div>
                </div>
                <Badge variant="primary" className="uppercase font-bold tracking-wider">
                  Vista previa del análisis
                </Badge>
              </div>

              <div className="p-6 space-y-6">
                {importPreview.categories.map((cat, cIdx) => (
                  <div key={`preview-cat-${cIdx}`} className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border border-slate-150 flex items-center justify-between">
                      <span>Categoría: {cat.name}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{cat.products.length} productos detectados</span>
                    </h4>
                    
                    <div className="divide-y divide-slate-100">
                      {cat.products.map((prod, pIdx) => (
                        <div key={`preview-prod-${pIdx}`} className="py-3 flex justify-between items-start gap-4 border-b border-slate-100/50 last:border-0">
                          <div className="flex gap-3 items-start min-w-0">
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
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-slate-850 truncate">{prod.name}</p>
                                {prod.image_confidence === 'high' && (
                                  <Badge variant="success" className="text-[9px] uppercase tracking-wider">
                                    Imagen detectada: alta confianza
                                  </Badge>
                                )}
                                {prod.image_confidence === 'medium' && (
                                  <Badge variant="warning" className="text-[9px] uppercase tracking-wider">
                                    Posible imagen: revisar
                                  </Badge>
                                )}
                                {prod.image_confidence === 'low' && (
                                  <Badge variant="secondary" className="text-[9px] uppercase tracking-wider">
                                    Posible imagen: baja confianza
                                  </Badge>
                                )}
                              </div>
                              {prod.description && (
                                <p className="text-xs text-slate-500 max-w-xl truncate">{prod.description}</p>
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
                  <Button
                    onClick={() => {
                      setImportPreview(null);
                      setImportFile(null);
                      setImportUrl('');
                      setImportMessage('');
                    }}
                    variant="secondary"
                    className="text-xs h-9"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="text-xs h-9"
                  >
                    {isImporting ? 'Importando...' : 'Confirmar importación'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {currentView === 'categorias' && (
        <div className="space-y-6">
          <SectionHeader
            title="Categorías del Menú"
            description="Crea, edita o elimina las categorías del menú de este restaurante."
            icon={Folder}
          />
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
            <CategoriesManager key={`categories-${importRefreshKey}`} targetRestaurantId={restaurantId} />
          </div>
        </div>
      )}

      {currentView === 'productos' && (
        <div className="space-y-6">
          <SectionHeader
            title="Productos"
            description="Gestiona la lista de productos y precios para este restaurante."
            icon={Store}
          />
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
            <ProductsManager key={`products-${importRefreshKey}`} targetRestaurantId={restaurantId} />
          </div>
        </div>
      )}

      {currentView === 'tables' && (
        <TablesManager targetRestaurantId={restaurantId} />
      )}

      {currentView === 'requests' && (
        <div className="space-y-6">
          <SectionHeader
            title="Solicitudes de Mesa"
            description="Llamados de mesa y pedidos de cuentas de los clientes."
            icon={Bell}
          />
          <ServiceRequestsManager targetRestaurantId={restaurantId} />
        </div>
      )}

      {currentView === 'marca' && (
        <div className="space-y-6">
          <SectionHeader
            title="Identidad de Marca"
            description="Configuración de marca, logotipo y color del menú digital."
            icon={Palette}
          />
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
            <BrandManager 
              targetRestaurantId={restaurantId} 
              onBrandUpdate={(updatedData) => setRestaurant(updatedData)} 
            />
          </div>
        </div>
      )}

      {currentView === 'qrcode' && (
        <div className="space-y-6">
          <SectionHeader
            title="Código QR del Menú"
            description="Acceso, previsualización y descarga del código QR para imprimir."
            icon={QrCode}
          />
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-8 max-w-md mx-auto text-center flex flex-col items-center">
            <div className="flex justify-center mb-6 bg-white p-4 inline-block rounded-xl shadow-xs border border-slate-100">
              <QRCodeCanvas 
                id="admin-qr-code-canvas"
                value={getPublicMenuUrl()}
                size={180}
                level={"H"}
                includeMargin={true}
              />
            </div>
            
            <p className="text-slate-600 text-xs mb-6 break-all bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono w-full select-all">
              {getPublicMenuUrl()}
            </p>

            <div className="flex flex-col gap-2.5 w-full">
              <Button 
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
                className="w-full h-10"
                aria-label="Descargar código QR en formato PNG"
              >
                Descargar QR
              </Button>

              <div className="flex gap-2">
                <Button 
                  onClick={handleCopyLink}
                  variant="secondary"
                  className="flex-1 h-9 text-xs"
                  aria-label="Copiar enlace al portapapeles"
                >
                  {copied ? '¡Copiado!' : 'Copiar link'}
                </Button>

                <a 
                  href={getPublicMenuUrl()} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-xs transition-colors h-9 bg-white"
                  aria-label="Ver menú público en una pestaña nueva"
                >
                  Ver menú
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
