import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
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
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  const handlePlanChange = async (restaurantId, newPlan) => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ plan: newPlan })
        .eq('id', restaurantId);

      if (error) throw error;

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
      const { error } = await supabase
        .from('restaurants')
        .update({ is_active: newStatus })
        .eq('id', restaurantId);
        
      if (error) throw error;
      
      setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, is_active: newStatus } : r));
      showNotification(`Restaurante ${newStatus ? 'activado' : 'desactivado'}.`, 'success');
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

  return (
    <div className="min-h-screen bg-gray-50">
      {notification.show && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-2 rounded-md shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {notification.message}
        </div>
      )}

      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-800">Panel Administrador Mesio</h1>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-700">Todos los Restaurantes</h2>
          <p className="text-lg font-medium text-gray-600">
            Total: <span className="font-bold text-blue-600">{restaurants.length}</span>
          </p>
        </div>

        {loading && <p>Cargando restaurantes...</p>}
        {error && <p className="text-red-500">{error}</p>}
        
        {!loading && !error && (
          <div className="space-y-4">
            {restaurants.map(r => (
              <div key={r.id} className="bg-white shadow-sm rounded-lg border p-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  
                  <div className="md:col-span-3 flex items-center gap-3">
                    {r.logo_url ? (
                      <img src={r.logo_url} alt="logo" className="h-10 w-10 rounded-full object-cover border"/>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">Sin logo</div>
                    )}
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 flex items-center gap-2">
                        {r.name}
                        {r.primary_color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: r.primary_color }}></span>}
                      </p>
                      <p className="text-sm text-gray-500 font-mono">{r.slug}</p>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500">Plan</label>
                    <select
                      value={r.plan}
                      onChange={(e) => handlePlanChange(r.id, e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-1.5 text-sm"
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 flex items-center justify-center">
                    <div className="text-center">
                      <label className="text-xs text-gray-500">Estado</label>
                      <button
                        onClick={() => handleStatusToggle(r.id, r.is_active)}
                        className={`mt-1 w-24 text-sm font-bold py-1 rounded-full ${r.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                      >
                        {r.is_active ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2 text-center md:text-left">
                     <p className="text-xs text-gray-500">User ID</p>
                     <p className="text-sm font-mono text-gray-600">{r.user_id}</p>
                     <p className="text-xs text-gray-400 mt-1">
                        Creado: {new Date(r.created_at).toLocaleDateString()}
                     </p>
                  </div>
                  
                  <div className="md:col-span-3 flex items-center justify-center md:justify-end gap-2">
                    <Link to={`/menu/${r.slug}`} target="_blank" className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200">
                      Ver menú
                    </Link>
                    <button onClick={() => copyMenuLink(r.slug)} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                      Copiar link
                    </button>
                  </div>

                </div>
              </div>
            ))}
            {restaurants.length === 0 && (
              <p className="text-center py-8 text-gray-500">No hay restaurantes registrados.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}