import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

function CreateClientForm({ onClientCreated, showNotification }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState('free');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="bg-white shadow-sm rounded-xl border border-slate-200/80 p-6 mb-8">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        Crear Nuevo Cliente / Restaurante
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nombre del Restaurante</label>
            <input 
              type="text" 
              placeholder="Ej: La Trattoria" 
              value={name} 
              onChange={handleNameChange} 
              className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 text-sm border text-slate-800" 
              required 
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Slug (Identificador URL)</label>
            <input 
              type="text" 
              placeholder="la-trattoria" 
              value={slug} 
              onChange={(e) => setSlug(e.target.value)} 
              className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 text-sm bg-slate-50 border text-slate-800 font-mono" 
              required 
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Plan de Suscripción</label>
            <select 
              value={plan} 
              onChange={(e) => setPlan(e.target.value)} 
              className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 text-sm bg-white border text-slate-800 font-medium" 
              required
            >
              <option value="free">Plan Free</option>
              <option value="basic">Plan Basic</option>
              <option value="pro">Plan Pro</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email del Cliente</label>
            <input 
              type="email" 
              placeholder="cliente@ejemplo.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 text-sm border text-slate-800" 
              required 
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Contraseña Temporal</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 text-sm border text-slate-800" 
              required 
            />
          </div>

          <div className="flex items-end">
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full flex justify-center items-center gap-1.5 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creando...
                </>
              ) : 'Crear Cliente'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function AdminDashboard() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

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
    Promise.resolve().then(() => {
      if (active) {
        fetchRestaurants();
      }
    });
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Toast Notification */}
      {notification.show && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-xl text-white font-medium flex items-center gap-2 border ${notification.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'} animate-fade-in`}>
          {notification.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {notification.message}
        </div>
      )}

      {/* Nav */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">M</span>
              <span className="text-xl font-bold text-slate-800 tracking-tight">Mesio Hub</span>
            </div>
            <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">
              Control de Administrador
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header Title */}
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Panel Administrador</h2>
          <p className="text-slate-500 mt-1">Gestión global de clientes, planes de suscripción y menús digitales de Mesio.</p>
        </div>

        {/* Analytics Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Restaurantes</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{totalCount}</p>
            <div className="mt-2 text-xs text-slate-500 font-medium">Clientes registrados</div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Menús Activos</p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">{activeCount}</p>
            <div className="mt-2 text-xs text-emerald-600/80 font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Visibles al público
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Menús Inactivos</p>
            <p className="text-3xl font-extrabold text-rose-600 mt-2">{inactiveCount}</p>
            <div className="mt-2 text-xs text-slate-500 font-medium">Desactivados temporalmente</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Distribución de Planes</p>
            <p className="text-3xl font-extrabold text-indigo-600 mt-2">{proCount + basicCount}</p>
            <div className="mt-2 text-xs text-slate-500 font-semibold flex gap-2">
              <span className="text-purple-600">Pro: {proCount}</span>
              <span className="text-blue-600">Basic: {basicCount}</span>
              <span className="text-slate-500">Free: {freeCount}</span>
            </div>
          </div>
        </div>

        {/* Form component */}
        <CreateClientForm onClientCreated={fetchRestaurants} showNotification={showNotification} />

        {/* List Header */}
        <div className="mb-6 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">Restaurantes Registrados</h3>
          <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100">
            Total: {restaurants.length}
          </span>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
            <p className="text-slate-500 font-medium">Cargando restaurantes...</p>
          </div>
        )}
        
        {error && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-700 mb-6 text-center font-medium">
            {error}
          </div>
        )}
        
        {!loading && !error && (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden mb-8">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider">Restaurante / Slug</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider">Plan</th>
                    <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider">ID de Usuario / Creado</th>
                    <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {restaurants.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {r.logo_url ? (
                            <img src={r.logo_url} alt="logo" className="h-10 w-10 rounded-lg object-cover border border-slate-200 p-0.5 bg-white"/>
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-400 font-semibold border border-slate-200">
                              Sin Logo
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                              {r.name}
                              {r.primary_color && (
                                <span className="h-2.5 w-2.5 rounded-full border border-slate-200" style={{ backgroundColor: r.primary_color }} title={`Color: ${r.primary_color}`}></span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{r.slug}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={r.plan}
                          onChange={(e) => handlePlanChange(r.id, e.target.value)}
                          className="rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1 px-2.5 text-xs font-semibold bg-white border text-slate-700 cursor-pointer capitalize"
                        >
                          <option value="free">Free</option>
                          <option value="basic">Basic</option>
                          <option value="pro">Pro</option>
                        </select>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleStatusToggle(r.id, r.is_active)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors shadow-sm ${
                            r.is_active 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${r.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                          {r.is_active ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-xs font-mono text-slate-500 truncate max-w-[150px]" title={r.user_id}>
                          {r.user_id}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-2">
                        <Link 
                          to={`/admin/restaurants/${r.id}/manage`} 
                          className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm font-semibold transition-colors"
                        >
                          Administrar
                        </Link>
                        
                        <button 
                          onClick={() => handleResetPassword(r)} 
                          title="Resetear contraseña" 
                          className="inline-flex items-center p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 shadow-sm transition-colors cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h2m4 0h2a2 2 0 012 2v7a2 2 0 01-2 2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </button>

                        <Link 
                          to={`/menu/${r.slug}`} 
                          target="_blank" 
                          className="inline-flex items-center px-2.5 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-semibold"
                        >
                          Ver menú
                        </Link>
                        
                        <button 
                          onClick={() => copyMenuLink(r.slug)} 
                          className="inline-flex items-center px-2.5 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-semibold cursor-pointer"
                        >
                          Copiar Link
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 mb-8">
              {restaurants.map(r => (
                <div key={`mobile-${r.id}`} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 space-y-4">
                  <div className="flex items-center gap-3 justify-between">
                    <div className="flex items-center gap-3">
                      {r.logo_url ? (
                        <img src={r.logo_url} alt="logo" className="h-10 w-10 rounded-lg object-cover border border-slate-200"/>
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-400 font-semibold border border-slate-200">
                          Logo
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-800 flex items-center gap-1.5">
                          {r.name}
                          {r.primary_color && <span className="h-2 w-2 rounded-full border border-slate-200" style={{ backgroundColor: r.primary_color }}></span>}
                        </p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{r.slug}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStatusToggle(r.id, r.is_active)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-colors shadow-sm border ${
                        r.is_active 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {r.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-100 py-3 text-xs">
                    <div>
                      <p className="text-slate-400 font-semibold uppercase tracking-wider">Plan</p>
                      <select
                        value={r.plan}
                        onChange={(e) => handlePlanChange(r.id, e.target.value)}
                        className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1 px-2.5 text-xs font-semibold bg-white border text-slate-700 capitalize"
                      >
                        <option value="free">Free</option>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                      </select>
                    </div>

                    <div>
                      <p className="text-slate-400 font-semibold uppercase tracking-wider">Creado</p>
                      <p className="mt-1 text-slate-700 font-medium">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link 
                      to={`/admin/restaurants/${r.id}/manage`} 
                      className="flex-1 text-center py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                    >
                      Administrar
                    </Link>

                    <button 
                      onClick={() => handleResetPassword(r)} 
                      className="px-3 py-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                      title="Resetear contraseña"
                    >
                      Contraseña
                    </button>

                    <Link 
                      to={`/menu/${r.slug}`} 
                      target="_blank" 
                      className="px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm transition-colors text-center"
                    >
                      Ver
                    </Link>

                    <button 
                      onClick={() => copyMenuLink(r.slug)} 
                      className="px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {restaurants.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl py-12 text-center shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="mt-4 text-slate-500 font-medium">No hay restaurantes registrados.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}