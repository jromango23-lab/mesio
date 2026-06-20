import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function CategoriesManager({ restaurantId, targetRestaurantId }) {
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const activeRestaurantId = targetRestaurantId || restaurantId;

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', activeRestaurantId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (!error && data) {
        setCategories(data);
      }
      setLoading(false);
    };

    fetchCategories();
  }, [activeRestaurantId]);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setCreating(true);
    const { data, error } = await supabase
      .from('categories')
      .insert([
        { restaurant_id: activeRestaurantId, name: newCategoryName }
      ])
      .select();

    if (!error && data) {
      setCategories([...categories, data[0]]);
      setNewCategoryName('');
    } else {
      alert('Error al agregar categoría');
    }
    setCreating(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta categoría? Se eliminarán todos los productos dentro de ella.')) return;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (!error) {
      setCategories(categories.filter(cat => cat.id !== id));
    } else {
      alert('Error al eliminar');
    }
  };

  if (loading) return <p className="text-gray-500">Cargando categorías...</p>;

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
      <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        Gestión de Categorías
      </h2>
      
      {/* Formulario para agregar */}
      <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2 mb-4 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
        <div className="flex-1">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nueva categoría (ej: Bebidas, Postres, Entradas)"
            className="block w-full rounded-md border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 border transition-all"
            required
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="inline-flex justify-center items-center gap-1 py-2 px-3.5 border border-transparent rounded-md shadow-sm text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {creating ? (
            <>
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
              Agregando...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v8m0 0v8m0-8h8m-8 0H4" />
              </svg>
              Agregar
            </>
          )}
        </button>
      </form>

      {/* Lista de categorías */}
      {categories.length === 0 ? (
        <div className="text-center py-6 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" className="mx-auto h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="mt-1.5 text-xs font-semibold text-slate-500">Sin categorías registradas</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Comienza agregando una arriba.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden shadow-sm bg-white">
          {categories.map((cat) => (
            <li key={cat.id} className="p-3 flex justify-between items-center hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0 animate-pulse"></span>
                <span className="font-semibold text-slate-700 text-xs">{cat.name}</span>
              </div>
              <button 
                onClick={() => handleDelete(cat.id)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
