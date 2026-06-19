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
        .select('id, name, logo_url, primary_color')
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

      // Estilos dinámicos
      const dynamicStyles = {
      categoryTitle: {
      color: restaurant?.primary_color || '#1f2937', // Default a un gris oscuro
      },
      categoryBorder: {
      backgroundColor: restaurant?.primary_color || '#d1d5db', // Default a un gris
      },
      };

      return (
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800">
      {/* Cabecera (Header) */}
      <header className="bg-white/75 backdrop-blur-lg shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-5 text-center">
          {restaurant.logo_url && (
            <img 
              src={restaurant.logo_url} 
              alt={`${restaurant.name} logo`} 
              className="h-20 w-auto mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{restaurant.name}</h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Menú Digital</p>
        </div>
      </header>

      {/* Navegación rápida por categorías */}
      {categories.length > 1 && (
        <div className="bg-white/75 backdrop-blur-lg border-b border-gray-200 overflow-x-auto no-scrollbar sticky top-[calc(88px+2rem)] z-10">
          <div className="max-w-4xl mx-auto px-6 py-3 flex justify-center space-x-2 sm:space-x-4">
            {categories.map(cat => (
              <a 
                key={`nav-${cat.id}`} 
                href={`#category-${cat.id}`}
                className="whitespace-nowrap px-4 py-2 text-gray-600 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors duration-200"
              >
                {cat.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Contenido del Menú */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 mt-8 mb-16">
        {categories.length === 0 ? (
          <div className="text-center py-20">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-700">Menú en construcción</h3>
            <p className="mt-1 text-sm text-gray-500">
              Este restaurante aún no ha añadido productos a su menú.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {categories.map(category => (
              <section key={category.id} id={`category-${category.id}`} className="scroll-mt-40">
                <div className="text-center mb-8">
                  <h2 
                    className="text-3xl font-light tracking-wide"
                    style={dynamicStyles.categoryTitle}
                  >
                    {category.name}
                  </h2>
                  <div 
                    className="mt-2 h-0.5 w-16 mx-auto"
                    style={dynamicStyles.categoryBorder}
                  ></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {category.products.length === 0 ? (
                    <p className="text-center text-gray-500 col-span-full">No hay productos en esta categoría.</p>
                  ) : (
                    category.products.map(product => (
                      <div key={product.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200/50">
                        <div className="flex items-center gap-4 p-2">
                           {/* Imagen del producto a la izquierda */}
                           {product.image_url && (
                            <div className="flex-shrink-0 bg-gray-50 rounded-lg">
                              <img 
                                src={product.image_url} 
                                alt={product.name} 
                                className="w-22 h-22 object-contain"
                              />
                            </div>
                          )}

                          {/* Detalles del producto */}
                          <div className="flex-1">
                            <div className="flex justify-between items-start gap-3">
                              <h3 className="font-bold text-gray-800 text-base leading-snug">{product.name}</h3>
                              <span className="font-semibold text-gray-900 whitespace-nowrap text-base">
                                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(product.price || 0)}
                              </span>
                            </div>
                            {product.description && (
                              <p className="text-sm text-gray-500 mt-1">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Footer / Branding discreto de Mesio */}
      <footer className="text-center pb-8 px-4">
        <a href="https://mesio.com" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-500 transition-colors">
          Menú digital por Mesio
        </a>
      </footer>
      </div>
      );
      }