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
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Gestión de Categorías</h2>
      
      {/* Formulario para agregar */}
      <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nueva categoría (ej: Bebidas, Postres)"
          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Agregando...' : 'Agregar'}
        </button>
      </form>

      {/* Lista de categorías */}
      {categories.length === 0 ? (
        <p className="text-gray-500 text-sm italic">Aún no tienes categorías. Agrega una arriba.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border rounded-md">
          {categories.map((cat) => (
            <li key={cat.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
              <span className="font-medium text-gray-700">{cat.name}</span>
              <button 
                onClick={() => handleDelete(cat.id)}
                className="text-red-500 hover:text-red-700 text-sm font-medium"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
