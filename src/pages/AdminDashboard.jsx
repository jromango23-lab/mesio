import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppShell from '../components/layout/AppShell';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import SectionHeader from '../components/ui/SectionHeader';
import { 
  LayoutDashboard, 
  Store, 
  UserPlus, 
  LogOut, 
  KeyRound, 
  ExternalLink, 
  Copy, 
  Plus, 
  Loader2, 
  Check, 
  ShieldAlert, 
  TrendingUp, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';

function CreateClientForm({
  email,
  setEmail,
  password,
  setPassword,
  name,
  setName,
  slug,
  setSlug,
  plan,
  setPlan,
  isSubmitting,
  setIsSubmitting,
  onClientCreated,
  showNotification
}) {
  const handleNameChange = (e) => {
    const newName = e.target.value;
    setName(newName);
    // Auto-generar slug simple
    setSlug(newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || !name || !slug) {
      showNotification('Todos los campos son obligatorios.', 'error');
      return;
    }
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-restaurant-client', {
        body: { email, password, name, slug, plan },
      });

      if (error) throw error;

      showNotification(data.message || 'Cliente creado con éxito.', 'success');
      // Resetear formulario
      setEmail('');
      setPassword('');
      setName('');
      setSlug('');
      setPlan('free');
      onClientCreated(); // Refrescar la lista de restaurantes
    } catch (err) {
      console.error('Error al invocar la función:', err);
      const errorMessage = err.context?.json?.error || err.message || 'Ocurrió un error inesperado.';
      showNotification(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow-sm rounded-xl border border-slate-200/80 p-6 mb-8 max-w-4xl">
      <SectionHeader
        title="Crear Nuevo Cliente / Restaurante"
        description="Registra una nueva cuenta de restaurante y configura sus datos de acceso iniciales."
        icon={UserPlus}
        className="pb-4 mb-6"
      />
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input 
            label="Nombre del Restaurante"
            type="text" 
            placeholder="Ej: La Trattoria" 
            value={name} 
            onChange={handleNameChange} 
            required 
          />

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Slug (Identificador URL)
            </label>
            <div className="flex rounded-lg shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-sm select-none">
                mesio.com/menu/
              </span>
              <input 
                type="text" 
                placeholder="la-trattoria" 
                value={slug} 
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} 
                className="flex-1 block w-full rounded-r-lg border-slate-250 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500 text-sm p-2.5 border border-slate-200 transition-all shadow-sm font-mono text-slate-800" 
                required 
              />
            </div>
          </div>

          <Input 
            label="Email del Cliente"
            type="email" 
            placeholder="cliente@ejemplo.com" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />

          <Input 
            label="Contraseña Temporal"
            type="password" 
            placeholder="••••••••" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />

          <Input 
            label="Plan de Suscripción"
            type="select"
            value={plan} 
            onChange={(e) => setPlan(e.target.value)} 
            required
          >
            <option value="free">Plan Free</option>
            <option value="basic">Plan Basic</option>
            <option value="pro">Plan Pro</option>
          </Input>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full sm:w-auto min-w-[140px] h-10"
            aria-label="Registrar y crear cliente"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" />
                <span>Creando...</span>
              </>
            ) : (
              <span>Crear Cliente</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [currentView, setCurrentView] = useState('resumen');

  // Form states lifted to prevent data loss on view transitions
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formPlan, setFormPlan] = useState('free');
  const [formIsSubmitting, setFormIsSubmitting] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Error signing out:', err);
      showNotification('Error al cerrar sesión.', 'error');
    }
  };

  const fetchRestaurants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      setRestaurants(data);
    } catch (err) {
      console.error("Error fetching restaurants:", err);
      setError('No se pudo cargar la lista de restaurantes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (active) {
      fetchRestaurants();
    }
    return () => {
      active = false;
    };
  }, [fetchRestaurants]);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const handlePlanChange = async (restaurantId, newPlan) => {
    try {
      const { error: updateError } = await supabase
        .from('restaurants')
        .update({ plan: newPlan })
        .eq('id', restaurantId);

      if (updateError) throw updateError;

      setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, plan: newPlan } : r));
      showNotification('Plan actualizado con éxito.', 'success');
    } catch (err) {
      console.error("Error updating plan:", err);
      showNotification('Error al actualizar el plan.', 'error');
    }
  };

  const handleStatusToggle = async (restaurantId, currentStatus) => {
    const newStatus = !currentStatus;
    try {
      const { error: updateError } = await supabase
        .from('restaurants')
        .update({ is_active: newStatus })
        .eq('id', restaurantId);
        
      if (updateError) throw updateError;
      
      setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, is_active: newStatus } : r));
      showNotification(`Restaurante ${newStatus ? 'activado' : 'desactivado'} con éxito.`, 'success');
    } catch (err) {
      console.error("Error toggling status:", err);
      showNotification('Error al cambiar el estado.', 'error');
    }
  };

  const copyMenuLink = (slug) => {
    const baseUrl = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;
    const menuUrl = `${baseUrl}/menu/${slug}`;
    navigator.clipboard.writeText(menuUrl)
      .then(() => showNotification('Enlace copiado al portapapeles.', 'success'))
      .catch(() => showNotification('No se pudo copiar el enlace.', 'error'));
  };

  const handleResetPassword = async (restaurant) => {
    const isConfirmed = window.confirm(`¿Estás seguro de que quieres resetear la contraseña del restaurante "${restaurant.name}"? Se generará una nueva contraseña temporal.`);
    if (!isConfirmed) {
      return;
    }

    // Generar contraseña temporal segura
    const tempPassword = Math.random().toString(36).slice(-10);

    try {
      const { error: invokeError } = await supabase.functions.invoke('reset-restaurant-password', {
        body: { user_id: restaurant.user_id, new_password: tempPassword },
      });

      if (invokeError) throw invokeError;

      showNotification(`Éxito. La nueva contraseña temporal es: ${tempPassword}`, 'success');
    } catch (err) {
      console.error('Error al resetear la contraseña:', err);
      const errorMessage = err.context?.json?.error || err.message || 'Ocurrió un error inesperado.';
      showNotification(errorMessage, 'error');
    }
  };

  // Cálculos estadísticos
  const totalCount = restaurants.length;
  const activeCount = restaurants.filter(r => r.is_active).length;
  const inactiveCount = restaurants.filter(r => !r.is_active).length;
  const proCount = restaurants.filter(r => r.plan === 'pro').length;
  const basicCount = restaurants.filter(r => r.plan === 'basic').length;
  const freeCount = restaurants.filter(r => r.plan === 'free').length;

  const navigationItems = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'restaurantes', label: 'Restaurantes', icon: Store },
    { id: 'crear-cliente', label: 'Crear cliente', icon: UserPlus },
    { id: 'cerrar-sesion', label: 'Cerrar sesión', icon: LogOut }
  ];

  const handleNavigate = (itemId) => {
    if (itemId === 'cerrar-sesion') {
      handleSignOut();
    } else {
      setCurrentView(itemId);
    }
  };

  return (
    <AppShell
      navigationItems={navigationItems}
      activeItem={currentView}
      onNavigate={handleNavigate}
      userName={user?.email || 'Administrador'}
      userRole="admin"
      onLogout={handleSignOut}
    >
      {/* Toast Notification */}
      {notification.show && (
        <div 
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-xl text-white font-medium flex items-center gap-2 border ${
            notification.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-red-600 border-red-500'
          } animate-fade-in`}
          role="alert"
        >
          {notification.type === 'success' ? (
            <Check className="h-5 w-5" />
          ) : (
            <ShieldAlert className="h-5 w-5" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {currentView === 'resumen' && (
        <div className="space-y-6">
          <SectionHeader
            title="Administración Mesio"
            description="Gestión global de clientes, planes de suscripción y menús digitales de Mesio."
            icon={LayoutDashboard}
          />

          {/* Analytics Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Restaurantes"
              value={totalCount}
              description="Clientes registrados en el sistema"
              icon={Store}
            />
            <StatCard
              title="Menús Activos"
              value={activeCount}
              description="Visibles al público general"
              icon={CheckCircle2}
              className="border-emerald-100/50"
            />
            <StatCard
              title="Menús Inactivos"
              value={inactiveCount}
              description="Desactivados temporalmente"
              icon={XCircle}
              className="border-rose-100/50"
            />
            <StatCard
              title="Distribución de Planes"
              value={proCount + basicCount}
              description={`Pro: ${proCount} | Basic: ${basicCount} | Free: ${freeCount}`}
              icon={TrendingUp}
            />
          </div>
        </div>
      )}

      {currentView === 'restaurantes' && (
        <div className="space-y-6">
          <SectionHeader
            title="Restaurantes Registrados"
            description={`Listado completo de clientes activos e inactivos (${restaurants.length} en total)`}
            icon={Store}
            actions={
              <Button onClick={() => setCurrentView('crear-cliente')} size="sm">
                <Plus className="h-4 w-4" />
                <span>Nuevo Cliente</span>
              </Button>
            }
          />

          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="animate-spin h-10 w-10 text-blue-600 mb-3" />
              <p className="text-slate-500 font-medium">Cargando restaurantes...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-red-700 font-medium flex items-center justify-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && (
            <>
              {restaurants.length === 0 ? (
                <EmptyState
                  title="No hay restaurantes registrados"
                  description="Comienza creando un cliente para registrar su restaurante y asignarle un plan."
                  icon={Store}
                  action={
                    <Button onClick={() => setCurrentView('crear-cliente')} variant="primary">
                      Crear Cliente
                    </Button>
                  }
                />
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden mb-8">
                    <div className="overflow-x-auto w-full">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider">Restaurante / Slug</th>
                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider">Plan</th>
                            <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider">Detalles</th>
                            <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {restaurants.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  {r.logo_url ? (
                                    <img src={r.logo_url} alt="logo" className="h-9 w-9 rounded-lg object-cover border border-slate-200 p-0.5 bg-white flex-shrink-0"/>
                                  ) : (
                                    <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center text-xs text-slate-400 font-semibold border border-slate-200 flex-shrink-0">
                                      Sin Logo
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                      <span className="truncate">{r.name}</span>
                                      {r.primary_color && (
                                        <span className="h-2.5 w-2.5 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: r.primary_color }} title={`Color: ${r.primary_color}`}></span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400 font-mono truncate">{r.slug}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <Input
                                  type="select"
                                  value={r.plan}
                                  onChange={(e) => handlePlanChange(r.id, e.target.value)}
                                  className="py-1 px-2.5 text-xs font-semibold bg-white border text-slate-700 cursor-pointer capitalize w-28 h-8 rounded-lg"
                                  aria-label="Cambiar plan"
                                >
                                  <option value="free">Free</option>
                                  <option value="basic">Basic</option>
                                  <option value="pro">Pro</option>
                                </Input>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={() => handleStatusToggle(r.id, r.is_active)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors shadow-xs border ${
                                    r.is_active 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100' 
                                      : 'bg-rose-50 text-rose-700 border-rose-250 hover:bg-rose-100'
                                  }`}
                                  aria-label={`Cambiar estado. Actual: ${r.is_active ? 'Activo' : 'Inactivo'}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${r.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                                  {r.is_active ? 'Activo' : 'Inactivo'}
                                </button>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <p className="text-xs font-mono text-slate-400 truncate max-w-[120px]" title={r.user_id}>
                                  {r.user_id}
                                </p>
                                <p className="text-[10px] text-slate-450 mt-0.5">
                                  {new Date(r.created_at).toLocaleDateString()}
                                </p>
                              </td>
                              
                              <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-2">
                                <Link 
                                  to={`/admin/restaurants/${r.id}/manage`} 
                                  className="inline-flex items-center justify-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm font-semibold transition-colors h-8"
                                  aria-label={`Administrar restaurante ${r.name}`}
                                  title="Administrar"
                                >
                                  Soporte
                                </Link>
                                
                                <button 
                                  onClick={() => handleResetPassword(r)} 
                                  title="Resetear contraseña" 
                                  className="inline-flex items-center justify-center p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-250 shadow-sm transition-colors cursor-pointer h-8 w-8"
                                  aria-label={`Resetear contraseña de ${r.name}`}
                                >
                                  <KeyRound className="h-4 w-4" />
                                </button>

                                <Link 
                                  to={`/menu/${r.slug}`} 
                                  target="_blank" 
                                  className="inline-flex items-center justify-center px-2.5 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-550 transition-colors shadow-sm font-semibold h-8"
                                  aria-label={`Ver menú público de ${r.name}`}
                                  title="Ver menú público"
                                >
                                  Ver menú
                                </Link>
                                
                                <button 
                                  onClick={() => copyMenuLink(r.slug)} 
                                  className="inline-flex items-center justify-center px-2.5 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-semibold cursor-pointer h-8"
                                  aria-label={`Copiar enlace del menú de ${r.name}`}
                                  title="Copiar enlace"
                                >
                                  Copiar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4 mb-8">
                    {restaurants.map(r => (
                      <div key={`mobile-${r.id}`} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                        <div className="flex items-center gap-3 justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            {r.logo_url ? (
                              <img src={r.logo_url} alt="logo" className="h-10 w-10 rounded-lg object-cover border border-slate-200 flex-shrink-0"/>
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-slate-550 flex items-center justify-center text-xs text-slate-400 font-semibold border border-slate-200 flex-shrink-0">
                                Logo
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span className="truncate">{r.name}</span>
                                {r.primary_color && <span className="h-2 w-2 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: r.primary_color }}></span>}
                              </p>
                              <p className="text-xs text-slate-400 font-mono truncate">{r.slug}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleStatusToggle(r.id, r.is_active)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-colors shadow-xs border flex-shrink-0 ${
                              r.is_active 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                            aria-label={`Cambiar estado. Actual: ${r.is_active ? 'Activo' : 'Inactivo'}`}
                          >
                            {r.is_active ? 'Activo' : 'Inactivo'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-100 py-3 text-xs">
                          <div>
                            <p className="text-slate-400 font-semibold uppercase tracking-wider mb-1">Plan</p>
                            <Input
                              type="select"
                              value={r.plan}
                              onChange={(e) => handlePlanChange(r.id, e.target.value)}
                              className="block w-full text-xs bg-white h-8"
                              aria-label="Cambiar plan"
                            >
                              <option value="free">Free</option>
                              <option value="basic">Basic</option>
                              <option value="pro">Pro</option>
                            </Input>
                          </div>

                          <div>
                            <p className="text-slate-400 font-semibold uppercase tracking-wider mb-1">Creado</p>
                            <p className="text-slate-700 font-medium h-8 flex items-center">{new Date(r.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Link 
                            to={`/admin/restaurants/${r.id}/manage`} 
                            className="flex-1 text-center py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center h-9"
                            aria-label={`Administrar restaurante ${r.name}`}
                            title="Administrar"
                          >
                            Soporte
                          </Link>

                          <button 
                            onClick={() => handleResetPassword(r)} 
                            className="px-3 py-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-250 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer flex items-center justify-center h-9"
                            title="Resetear contraseña"
                            aria-label="Resetear contraseña"
                          >
                            <KeyRound className="h-4.5 w-4.5" />
                          </button>

                          <Link 
                            to={`/menu/${r.slug}`} 
                            target="_blank" 
                            className="px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm transition-colors text-center flex items-center justify-center h-9 font-semibold"
                            aria-label="Ver menú público"
                          >
                            Ver
                          </Link>

                          <button 
                            onClick={() => copyMenuLink(r.slug)} 
                            className="px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-550 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer flex items-center justify-center h-9"
                            aria-label="Copiar enlace"
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {currentView === 'crear-cliente' && (
        <div className="space-y-6">
          <CreateClientForm
            email={formEmail}
            setEmail={setFormEmail}
            password={formPassword}
            setPassword={setFormPassword}
            name={formName}
            setName={setFormName}
            slug={formSlug}
            setSlug={setFormSlug}
            plan={formPlan}
            setPlan={setFormPlan}
            isSubmitting={formIsSubmitting}
            setIsSubmitting={setFormIsSubmitting}
            onClientCreated={fetchRestaurants}
            showNotification={showNotification}
          />
        </div>
      )}
    </AppShell>
  );
}