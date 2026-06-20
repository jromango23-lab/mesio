import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import CategoriesManager from '../components/CategoriesManager';
import ProductsManager from '../components/ProductsManager';
import BrandManager from '../components/BrandManager';
import TablesManager from '../components/TablesManager';
import ServiceRequestsManager from '../components/ServiceRequestsManager';
import AppShell from '../components/layout/AppShell';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
import { 
  LayoutDashboard, 
  Folder, 
  Store, 
  Palette, 
  QrCode, 
  LogOut, 
  ExternalLink,
  Loader2,
  Globe,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Bell
} from 'lucide-react';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState(null);
  
  // Estado para el formulario de nuevo restaurante
  const [newRestName, setNewRestName] = useState('');
  const [newRestSlug, setNewRestSlug] = useState('');
  const [creating, setCreating] = useState(false);

  // Estado para controlar qué vista se muestra en el panel
  const [currentView, setCurrentView] = useState('home'); // 'home', 'categories', 'products', 'brand', 'qrcode'

  const [categoriesCount, setCategoriesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    if (user) {
      checkRestaurant();
    }
  }, [user]);

  // Fetch counts dynamically when restaurant changes or when switching view
  useEffect(() => {
    if (!restaurant?.id) return;

    const fetchCounts = async () => {
      try {
        const { data: catData, error: catError } = await supabase
          .from('categories')
          .select('id')
          .eq('restaurant_id', restaurant.id);

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

        // Fetch pending/seen service requests
        const { count: reqCount, error: reqError } = await supabase
          .from('service_requests')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurant.id)
          .in('status', ['pending', 'seen']);

        if (!reqError) {
          setPendingRequestsCount(reqCount || 0);
        }
      } catch (err) {
        console.error('Error fetching counts for client dashboard:', err);
      }
    };

    fetchCounts();
  }, [restaurant?.id, currentView]);

  const checkRestaurant = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('user_id', user.id)
        .single(); // Solo esperamos un restaurante por usuario por ahora

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching restaurant:', error);
      }
      
      if (data) {
        setRestaurant(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRestaurant = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const { data, error } = await supabase
        .from('restaurants')
        .insert([
          { user_id: user.id, name: newRestName, slug: newRestSlug }
        ])
        .select()
        .single();

      if (error) {
        alert('Error al crear: ' + error.message);
      } else {
        setRestaurant(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <Loader2 className="animate-spin h-10 w-10 text-blue-600 mb-4" />
          <p className="text-slate-500 font-medium">Cargando panel...</p>
        </div>
      </div>
    );
  }

  // Si el usuario aún no tiene un restaurante configurado
  if (!restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        {/* Header con Logo */}
        <div className="flex items-center gap-2.5 mb-6">
          <img
            src="/brand/mesio-icon.png"
            alt="Mesio"
            className="h-8 w-8 object-contain animate-fade-in"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/brand/mesio-logo.png";
            }}
          />
          <span className="text-xl font-bold text-slate-800 tracking-tight animate-fade-in">Mesio</span>
        </div>

        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-md w-full max-w-md">
          <h2 className="text-xl font-bold mb-2 text-center text-slate-800">Configura tu Restaurante</h2>
          <p className="text-xs text-slate-400 mb-6 text-center">Para comenzar a crear tu menú digital, necesitamos algunos datos básicos.</p>
          
          <form onSubmit={handleCreateRestaurant} className="space-y-5">
            <Input 
              label="Nombre del Restaurante"
              type="text" 
              value={newRestName} 
              onChange={(e) => {
                setNewRestName(e.target.value);
                // Autogenerar un slug simple basado en el nombre (ej: "Mis Tacos" -> "mis-tacos")
                setNewRestSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
              }}
              placeholder="Ej: Taquería El Paisa"
              required 
            />

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Identificador URL (Slug)</label>
              <div className="mt-1 flex rounded-lg shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-505 text-sm select-none font-medium text-slate-500">
                  mesio.com/menu/
                </span>
                <input 
                  type="text" 
                  value={newRestSlug} 
                  onChange={(e) => setNewRestSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="flex-1 block w-full rounded-r-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500 text-sm p-2.5 border transition-all shadow-sm font-mono text-slate-800" 
                  placeholder="taqueria-el-paisa"
                  required 
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={creating}
              className="w-full h-10 mt-2 gap-1.5"
            >
              {creating ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>Creando...</span>
                </>
              ) : (
                <span>Comenzar a usar Mesio</span>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center">
            <button 
              onClick={handleSignOut}
              className="text-xs font-semibold text-red-650 hover:underline flex items-center gap-1.5"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5 text-red-500" />
              <span className="text-red-600">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getPublicMenuUrl = () => {
    const baseUrl = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;
    return `${baseUrl}/menu/${restaurant.slug}`;
  };

  const copyMenuLink = () => {
    navigator.clipboard.writeText(getPublicMenuUrl())
      .then(() => alert('Enlace copiado al portapapeles.'))
      .catch((err) => console.error('Error al copiar link:', err));
  };

  const navigationItems = [
    { id: 'home', label: 'Resumen', icon: LayoutDashboard },
    { id: 'requests', label: 'Solicitudes', icon: Bell },
    { id: 'categories', label: 'Categorías', icon: Folder },
    { id: 'products', label: 'Productos', icon: Store },
    { id: 'tables', label: 'Mesas / QR', icon: QrCode },
    { id: 'brand', label: 'Identidad de marca', icon: Palette },
    { id: 'qrcode', label: 'Código QR', icon: QrCode },
    { id: 'menu-publico', label: 'Ver menú público', icon: ExternalLink },
    { id: 'cerrar-sesion', label: 'Cerrar sesión', icon: LogOut }
  ];

  const handleNavigate = (itemId) => {
    if (itemId === 'cerrar-sesion') {
      handleSignOut();
    } else if (itemId === 'menu-publico') {
      window.open(getPublicMenuUrl(), '_blank');
    } else {
      setCurrentView(itemId);
    }
  };

  return (
    <AppShell
      navigationItems={navigationItems}
      activeItem={currentView}
      onNavigate={handleNavigate}
      userName={user?.email || 'Cliente'}
      userRole="restaurant"
      onLogout={handleSignOut}
    >
      {currentView === 'home' && (
        <div className="space-y-6">
          <SectionHeader
            title={`Panel de Control: ${restaurant.name}`}
            description="Gestiona las categorías, productos, marca y código QR de tu menú digital."
            icon={LayoutDashboard}
            actions={
              <a
                href={getPublicMenuUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-sm font-semibold shadow-sm transition-colors gap-1.5"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Ver Menú</span>
              </a>
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Nombre del Restaurante"
              value={restaurant.name}
              description="Nombre público configurado"
              icon={Store}
            />
            <StatCard
              title="Estado de Visibilidad"
              value={restaurant.is_active ? 'Visible' : 'Oculto'}
              description="Define si el público puede ver el menú"
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
              title="Enlace Público (Slug)"
              value={restaurant.slug}
              description="Identificador en la URL"
              icon={Globe}
            />
            <StatCard
              title="Categorías"
              value={categoriesCount}
              description="Administra secciones del menú"
              icon={Folder}
              className="cursor-pointer"
              onClick={() => setCurrentView('categories')}
            />
            <StatCard
              title="Productos"
              value={productsCount}
              description="Administra los platillos y precios"
              icon={Store}
              className="cursor-pointer"
              onClick={() => setCurrentView('products')}
            />
            <StatCard
              title="Solicitudes Activas"
              value={pendingRequestsCount}
              description="Llamados de mesa pendientes"
              icon={Bell}
              className="cursor-pointer"
              onClick={() => setCurrentView('requests')}
            />
          </div>
        </div>
      )}

      {currentView === 'qrcode' && (
        <div className="space-y-6">
          <SectionHeader
            title="Código QR del Menú"
            description="Genera y descarga el código QR oficial de tu restaurante para imprimir en mesas."
            icon={QrCode}
          />
          <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md mx-auto text-center flex flex-col items-center shadow-xs">
            <div className="flex justify-center mb-6 bg-white p-4 inline-block rounded-xl shadow-xs border border-slate-100">
              <QRCodeCanvas 
                id="qr-code-canvas"
                value={getPublicMenuUrl()}
                size={180}
                level={"H"}
                includeMargin={true}
              />
            </div>
            <p className="text-slate-650 text-xs mb-6 break-all bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono w-full select-all text-slate-500">
              {getPublicMenuUrl()}
            </p>
            <div className="flex flex-col gap-2.5 w-full">
              <Button 
                onClick={() => {
                  const canvas = document.getElementById('qr-code-canvas');
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
                aria-label="Descargar código QR"
              >
                Descargar Código QR
              </Button>
              <div className="flex gap-2">
                <Button 
                  onClick={copyMenuLink}
                  variant="secondary"
                  className="flex-1 h-9 text-xs"
                >
                  Copiar enlace
                </Button>
                <a 
                  href={getPublicMenuUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center border border-slate-200 text-slate-700 bg-white hover:bg-slate-550 rounded-lg text-xs font-semibold shadow-xs transition-colors h-9"
                >
                  Ver menú
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentView === 'categories' && (
        <div className="space-y-6">
          <SectionHeader
            title="Categorías del Menú"
            description="Administra las secciones principales de tu carta digital (bebidas, entradas, platos principales)."
            icon={Folder}
          />
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
            <CategoriesManager restaurantId={restaurant.id} />
          </div>
        </div>
      )}

      {currentView === 'products' && (
        <div className="space-y-6">
          <SectionHeader
            title="Productos"
            description="Añade, edita o elimina platillos y asócialos a sus categorías respectivas."
            icon={Store}
          />
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
            <ProductsManager restaurantId={restaurant.id} />
          </div>
        </div>
      )}

      {currentView === 'tables' && (
        <TablesManager restaurantId={restaurant.id} />
      )}

      {currentView === 'requests' && (
        <div className="space-y-6">
          <SectionHeader
            title="Solicitudes de Mesa"
            description="Atiende los llamados de tus clientes y solicitudes de cuentas en tiempo real."
            icon={Bell}
          />
          <ServiceRequestsManager restaurantId={restaurant.id} />
        </div>
      )}

      {currentView === 'brand' && (
        <div className="space-y-6">
          <SectionHeader
            title="Identidad de Marca"
            description="Personaliza el color de acento y sube el logotipo de tu restaurante."
            icon={Palette}
          />
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
            <BrandManager restaurant={restaurant} onBrandUpdate={setRestaurant} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
