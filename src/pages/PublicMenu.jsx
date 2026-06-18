import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PublicMenu() {
  const { slug } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMenuData();
  }, [slug]);

  const fetchMenuData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Buscar el restaurante por su slug
      const { data: restData, error: restError } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('slug', slug)
        .single();

      if (restError || !restData) {
        setError('Restaurante no encontrado');
        setLoading(false);
        return;
      }

      setRestaurant(restData);

      // 2. Buscar categorías y sus productos anidados
      // Nota: Supabase requiere que la relación de claves foráneas esté configurada.
      // Como Products tiene un category_id que apunta a Categories.id,
      // podemos pedir 'products(*)' dentro de la consulta de categories.
      const { data: menuData, error: menuError } = await supabase
        .from('categories')
        .select(`
          id, 
          name, 
          display_order,
          products (
            id,
            name,
            description,
            price,
            image_url
          )
        `)
        .eq('restaurant_id', restData.id)
        .order('display_order', { ascending: true });

      if (menuError) {
        console.error('Error fetching menu:', menuError);
        setError('Error al cargar el menú');
      } else {
        // Ordenamos los productos alfabéticamente dentro de cada categoría 
        // (ya que la consulta anidada no siempre garantiza el orden de los hijos)
        const sortedMenuData = menuData.map(cat => ({
          ...cat,
          products: cat.products.sort((a, b) => a.name.localeCompare(b.name))
        }));
        
        // Filtramos categorías que no tengan productos para no mostrar títulos vacíos
        const activeCategories = sortedMenuData.filter(cat => cat.products && cat.products.length > 0);
        
        setCategories(activeCategories);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-gray-300 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <div className="bg-white p-8 rounded-lg shadow-sm max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link to="/" className="text-blue-600 hover:underline">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Cabecera (Header) */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Menú Digital</p>
        </div>
      </header>

      {/* Navegación rápida por categorías (opcional, muy útil en móviles) */}
      {categories.length > 1 && (
        <div className="bg-white border-b border-gray-200 overflow-x-auto no-scrollbar">
          <div className="max-w-3xl mx-auto px-4 py-3 flex space-x-4">
            {categories.map(cat => (
              <a 
                key={`nav-${cat.id}`} 
                href={`#category-${cat.id}`}
                className="whitespace-nowrap px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200"
              >
                {cat.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Contenido del Menú */}
      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-10">
        {categories.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            Este restaurante aún no ha añadido productos a su menú.
          </div>
        ) : (
          categories.map(category => (
            <section key={category.id} id={`category-${category.id}`} className="scroll-mt-32">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">
                {category.name}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.products.map(product => (
                  <div key={product.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex gap-4">
                    {/* Imagen del producto */}
                    {product.image_url && (
                      <div className="flex-shrink-0">
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="w-24 h-24 object-cover rounded-md"
                        />
                      </div>
                    )}
                    
                    {/* Detalles del producto */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-semibold text-gray-900">{product.name}</h3>
                          <span className="font-bold text-gray-900 whitespace-nowrap">
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(product.price || 0)}
                          </span>
                        </div>
                        {product.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-3">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
      
      {/* Footer / Branding discreto de Mesio */}
      <footer className="mt-12 text-center pb-8">
        <a href="/" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Menú impulsado por <span className="font-bold text-blue-500">Mesio</span>
        </a>
      </footer>
    </div>
  );
}