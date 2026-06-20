import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PublicMenu() {
  const { slug } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [failedImages, setFailedImages] = useState(new Set());
  const [activeCategoryId, setActiveCategoryId] = useState(null);

  async function fetchMenuData() {
    try {
      setLoading(true);
      setError(null);

      const { data: restData, error: restError } = await supabase
        .from('restaurants')
        .select('id, name, logo_url, primary_color, is_active')
        .eq('slug', slug)
        .single();
      
      if (restError || !restData) {
        setError('Restaurante no encontrado');
        setLoading(false);
        return;
      }
      
      setRestaurant(restData);

      // Si el restaurante no está activo, no necesitamos cargar el resto del menú.
      if (!restData.is_active) {
        setLoading(false);
        return;
      }

      const { data: menuData, error: menuError } = await supabase
        .from('categories')
        .select(`id, name, display_order, products (id, name, description, price, image_url)`)
        .eq('restaurant_id', restData.id)
        .order('display_order', { ascending: true });

      if (menuError) {
        console.error('Error fetching menu:', menuError);
        setError('Error al cargar el menú');
      } else {
        const sortedMenuData = menuData.map(cat => ({
          ...cat,
          products: cat.products.sort((a, b) => a.name.localeCompare(b.name))
        }));
        const activeCategories = sortedMenuData.filter(cat => cat.products && cat.products.length > 0);
        setCategories(activeCategories);
        if (activeCategories.length > 0) {
          setActiveCategoryId(activeCategories[0].id);
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        fetchMenuData();
      }
    });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (categories.length === 0) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 80; // Offset for sticky category nav
      
      for (const cat of categories) {
        const el = document.getElementById(`category-${cat.id}`);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveCategoryId(cat.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [categories]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-10 w-10 bg-indigo-100 rounded-full mb-3 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
          </div>
          <div className="h-3 w-28 bg-indigo-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm max-w-md w-full">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Oops!</h2>
          <p className="text-slate-650 mb-6">{error}</p>
          <Link to="/" className="text-indigo-600 hover:underline font-semibold">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  // Comprobación de restaurante inactivo después de la carga
  if (restaurant && !restaurant.is_active) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm max-w-md w-full">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Menú no disponible</h2>
          <p className="text-slate-650">Este menú se encuentra temporalmente inactivo.</p>
        </div>
      </div>
    );
  }
  
  const handleImageError = (productId) => {
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(productId);
      return newSet;
    });
  };

  const dynamicStyles = {
    categoryTitle: { color: restaurant?.primary_color || '#1e293b' },
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Header Estático Compacto */}
      <header className="bg-white shadow-sm border-b border-slate-150 py-6 px-4 text-center">
        {restaurant.logo_url && (
          <img src={restaurant.logo_url} alt={`${restaurant.name} logo`} className="h-14 w-auto mx-auto mb-2 object-contain" />
        )}
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">{restaurant.name}</h1>
        <p className="text-[10px] text-slate-450 font-bold uppercase tracking-widest mt-1">Carta Digital</p>
      </header>

      {/* Barra de Categorías Sticky Deslizable */}
      {categories.length > 1 && (
        <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex overflow-x-auto no-scrollbar gap-2 scroll-smooth">
            {categories.map(cat => {
              const isActive = activeCategoryId === cat.id;
              return (
                <a
                  key={`nav-${cat.id}`}
                  href={`#category-${cat.id}`}
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? 'text-white shadow-sm font-extrabold'
                      : 'text-slate-600 bg-slate-100 hover:bg-slate-200/70'
                  }`}
                  style={isActive ? { backgroundColor: restaurant?.primary_color || '#4f46e5' } : {}}
                >
                  {cat.name}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Contenedor de Productos */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-16">
        {categories.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <h3 className="mt-2 text-lg font-semibold text-slate-700">Menú en construcción</h3>
            <p className="mt-1 text-sm text-slate-500">Este restaurante aún no ha añadido productos a su menú.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {categories.map(category => (
              <section key={category.id} id={`category-${category.id}`} className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-6">
                  <h2 
                    className="text-lg font-bold tracking-tight text-slate-800" 
                    style={dynamicStyles.categoryTitle}
                  >
                    {category.name}
                  </h2>
                  <div className="flex-1 h-[1px]" style={{ backgroundColor: '#e2e8f0' }}></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {category.products.length === 0 ? (
                    <p className="text-center text-slate-400 col-span-full">No hay productos en esta categoría.</p>
                  ) : (
                    category.products.map(product => {
                      const hasImage = product.image_url && !failedImages.has(product.id);
                      return (
                        <div 
                          key={product.id} 
                          className="bg-white rounded-xl border border-slate-150 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow duration-200"
                        >
                          {hasImage && (
                            <div className="w-full h-36 md:h-40 overflow-hidden bg-slate-50 border-b border-slate-100 flex-shrink-0">
                              <img 
                                src={product.image_url} 
                                alt={product.name} 
                                className="w-full h-full object-cover object-center" 
                                onError={() => handleImageError(product.id)}
                              />
                            </div>
                          )}
                          <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                            <div className="space-y-1">
                              <h3 className="font-bold text-slate-850 text-base leading-snug">{product.name}</h3>
                              {product.description && (
                                <p className="text-xs text-slate-550 line-clamp-3">{product.description}</p>
                              )}
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-50 mt-auto">
                              <span 
                                className="font-bold text-base" 
                                style={{ color: restaurant?.primary_color || '#4f46e5' }}
                              >
                                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(product.price || 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center pb-8 px-4">
        <a href="https://mesio.com" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-slate-500 transition-colors font-medium">
          Menú digital por Mesio
        </a>
      </footer>
    </div>
  );
}