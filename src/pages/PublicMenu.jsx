import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Bell, Receipt } from 'lucide-react';

const hexToRgba = (hex, alpha) => {
  if (!hex) return `rgba(79, 70, 229, ${alpha})`;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex.substring(0, 1).repeat(2), 16);
    const g = parseInt(cleanHex.substring(1, 2).repeat(2), 16);
    const b = parseInt(cleanHex.substring(2, 3).repeat(2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(79, 70, 229, ${alpha})`;
};

export default function PublicMenu() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const tableToken = searchParams.get('table');

  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [failedImages, setFailedImages] = useState(new Set());
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [serviceMessage, setServiceMessage] = useState({ type: '', text: '' });
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  // Estimator / Cart States
  const [cart, setCart] = useState(() => {
    try {
      const stored = localStorage.getItem(`mesio_cart_${slug}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Error loading cart from localStorage", e);
    }
    return [];
  });

  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [tipPercentage, setTipPercentage] = useState(0);
  const [customTipVal, setCustomTipVal] = useState('');
  const [splitPeopleCount, setSplitPeopleCount] = useState(1);

  // Sync cart to localStorage
  useEffect(() => {
    if (slug) {
      localStorage.setItem(`mesio_cart_${slug}`, JSON.stringify(cart));
    }
  }, [cart, slug]);

  // Sync loaded cart when slug changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`mesio_cart_${slug}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCart(parsed);
          return;
        }
      }
    } catch (e) {
      console.error("Error loading cart on slug update", e);
    }
    setCart([]);
  }, [slug]);

  // Modal and Drawer layers cannot be open at the same time
  const openProductModal = (product) => {
    setSelectedProductForModal(product);
    setModalQuantity(1);
    setIsCartDrawerOpen(false);
  };

  const openCartDrawer = () => {
    setIsCartDrawerOpen(true);
    setSelectedProductForModal(null);
  };

  // Block body scroll when overlay is active
  useEffect(() => {
    if (selectedProductForModal || isCartDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedProductForModal, isCartDrawerOpen]);

  // Close overlays on Escape keypress
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedProductForModal(null);
        setIsCartDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isPriceValid = (price) => {
    if (price === null || price === undefined || price === '') return false;
    const num = Number(price);
    return Number.isFinite(num) && num > 0;
  };

  const addToCart = (product, qty = 1) => {
    if (product.availability_status === 'sold_out' || product.availability_status === 'hidden') return;
    if (!isPriceValid(product.price)) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        const newQty = Math.min(99, existing.quantity + qty);
        return prev.map(item => item.id === product.id ? { ...item, quantity: newQty } : item);
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        quantity: Math.min(99, Math.max(1, qty)),
        image_url: product.image_url || ''
      }];
    });
  };

  const updateQuantity = (productId, change) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (!existing) return prev;
      const newQty = existing.quantity + change;
      if (newQty <= 0) {
        return prev.filter(item => item.id !== productId);
      }
      return prev.map(item => item.id === productId ? { ...item, quantity: Math.min(99, newQty) } : item);
    });
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cart]);

  const tip = useMemo(() => {
    if (tipPercentage === 0) return 0;
    if (tipPercentage === 10) return Math.round(subtotal * 0.1);
    if (tipPercentage === 15) return Math.round(subtotal * 0.15);
    if (tipPercentage === 'custom') {
      const customPercent = parseFloat(customTipVal || 0);
      if (Number.isFinite(customPercent) && customPercent >= 0 && customPercent <= 100) {
        return Math.round(subtotal * (customPercent / 100));
      }
    }
    return 0;
  }, [subtotal, tipPercentage, customTipVal]);

  const total = subtotal + tip;

  const totalPerPerson = useMemo(() => {
    const count = parseInt(splitPeopleCount) || 1;
    return Math.round(total / Math.max(1, count));
  }, [total, splitPeopleCount]);

  async function fetchMenuData() {
    try {
      setLoading(true);
      setError(null);
      setTableData(null); // Reset table state on new fetch

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

      if (!restData.is_active) {
        setLoading(false);
        return;
      }

      // Check and fetch table data if tableToken exists
      if (tableToken) {
        try {
          const { data: tableRows, error: tableError } = await supabase
            .rpc('get_public_table_by_token', { p_table_token: tableToken });

          if (!tableError && tableRows && tableRows.length > 0) {
            const tbl = tableRows[0];
            if (tbl.restaurant_id === restData.id) {
              setTableData(tbl);
            }
          }
        } catch (tblErr) {
          console.error('Error validating table token:', tblErr);
        }
      }

      const { data: menuData, error: menuError } = await supabase
        .from('categories')
        .select(`id, name, display_order, products (id, name, description, price, image_url, availability_status, availability_note)`)
        .eq('restaurant_id', restData.id)
        .order('display_order', { ascending: true });

      if (menuError) {
        console.error('Error fetching menu:', menuError);
        setError('Error al cargar el menú');
      } else {
        const sortedMenuData = menuData.map(cat => {
          const visibleProducts = (cat.products || []).filter(p => p.availability_status !== 'hidden');
          return {
            ...cat,
            products: visibleProducts.sort((a, b) => a.name.localeCompare(b.name))
          };
        });
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
  }, [slug, tableToken]);

  // Clean Scroll Spy implementation
  useEffect(() => {
    if (categories.length === 0) return;

    const handleScroll = () => {
      if (isScrollingRef.current) return;

      const scrollPosition = window.scrollY + 200;
      let currentActiveId = null;

      for (const cat of categories) {
        const el = document.getElementById(`category-${cat.id}`);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            currentActiveId = cat.id;
            break;
          }
        }
      }

      if (currentActiveId) {
        setActiveCategoryId(prev => (prev !== currentActiveId ? currentActiveId : prev));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [categories]);

  // Auto-scroll active category pill into view
  useEffect(() => {
    if (!activeCategoryId) return;
    const activeBtn = document.getElementById(`nav-btn-${activeCategoryId}`);
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [activeCategoryId]);

  const handleServiceRequest = async (type) => {
    if (!tableToken) return;
    try {
      setRequestLoading(true);
      setServiceMessage({ type: '', text: '' });

      const { data, error: rpcError } = await supabase.rpc('create_service_request_from_table', {
        p_table_token: tableToken,
        p_request_type: type
      });

      if (rpcError) throw rpcError;

      if (data && data.length > 0) {
        const result = data[0];
        if (result.is_new) {
          setServiceMessage({
            type: 'success',
            text: 'Solicitud enviada al restaurante.'
          });
        } else {
          setServiceMessage({
            type: 'info',
            text: 'Ya hay una solicitud pendiente para esta mesa.'
          });
        }
      }
    } catch (err) {
      console.error('Error sending service request:', err);
      setServiceMessage({
        type: 'error',
        text: 'Ocurrió un error al enviar la solicitud.'
      });
    } finally {
      setRequestLoading(false);
      // Auto clear message after 4 seconds
      setTimeout(() => {
        setServiceMessage({ type: '', text: '' });
      }, 4000);
    }
  };

  const handleCategoryClick = (catId) => {
    setActiveCategoryId(catId);
    isScrollingRef.current = true;
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Resume listening to scroll spy after scroll animation finishes
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 800);
  };

  const handleImageError = (productId) => {
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(productId);
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
        {/* Compact Hero skeleton */}
        <div className="w-full h-28 md:h-36 bg-slate-200 animate-pulse relative"></div>
        
        {/* Floating card skeleton */}
        <div className="max-w-6xl mx-auto px-4 relative z-10 -mt-10 mb-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm text-center max-w-lg mx-auto animate-pulse">
            <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-slate-200 border border-slate-100 mx-auto -mt-16 mb-3"></div>
            <div className="h-6 bg-slate-200 rounded w-1/2 mx-auto mb-2.5"></div>
            <div className="h-4 bg-slate-200 rounded w-1/4 mx-auto"></div>
          </div>
        </div>

        {/* Sticky category skeleton */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm py-2.5">
          <div className="max-w-6xl mx-auto px-4 flex gap-2 overflow-x-auto no-scrollbar">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 w-20 bg-slate-200 rounded-full animate-pulse flex-shrink-0"></div>
            ))}
          </div>
        </div>

        {/* Products skeleton grid */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-16">
          <div className="space-y-12">
            <section>
              <div className="h-6 bg-slate-200 rounded w-48 mb-6 animate-pulse"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-4 flex flex-col justify-between min-h-[140px] animate-pulse">
                    <div className="space-y-3">
                      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                    <div className="h-5 bg-slate-200 rounded w-1/4 mt-4"></div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm max-w-md w-full">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Oops!</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Link to="/" className="text-indigo-600 hover:underline font-semibold">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  if (restaurant && !restaurant.is_active) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm max-w-md w-full">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Menú no disponible</h2>
          <p className="text-slate-500">Este menú se encuentra temporalmente inactivo.</p>
        </div>
      </div>
    );
  }
  
  const dynamicStyles = {
    categoryTitle: { color: restaurant?.primary_color || '#1e293b' },
  };

  return (
    <div 
      className="min-h-screen bg-slate-50/50 font-sans text-slate-800"
      style={{ paddingBottom: cart.length > 0 ? '90px' : '0px' }}
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(15px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-slide-up {
          animation: slideUp 0.25s ease-out forwards;
        }
        .animate-slide-left {
          animation: slideLeft 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Banner superior compacto */}
      <div 
        className="w-full h-28 md:h-36 relative overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, ${hexToRgba(restaurant.primary_color, 0.95)} 0%, ${hexToRgba(restaurant.primary_color, 0.45)} 100%)`
        }}
      >
        <div className="absolute inset-0 bg-black/5"></div>
      </div>

      {/* Floating Logo and Info center card */}
      <div className="max-w-6xl mx-auto px-4 relative z-10 -mt-10 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm text-center max-w-lg mx-auto transition-all duration-350 hover:shadow-md">
          {restaurant.logo_url && (
            <div className="relative inline-block -mt-16 mb-3">
              <img 
                src={restaurant.logo_url} 
                alt={`${restaurant.name} logo`} 
                className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-white p-1 shadow-md border border-slate-100 object-contain mx-auto ring-4 ring-white" 
              />
            </div>
          )}
          
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
            {restaurant.name}
          </h1>

          <div className="mt-2.5 flex items-center justify-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Menú Online
              </span>
            </div>
            {tableData && (
              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-fade-in flex items-center gap-1 animate-slide-up">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
                Mesa {tableData.table_number}{tableData.table_name ? ` - ${tableData.table_name}` : ''}
              </span>
            )}
          </div>

          {tableData && (
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex gap-2.5 justify-center w-full max-w-xs mx-auto animate-fade-in">
              <button
                onClick={() => handleServiceRequest('attention')}
                disabled={requestLoading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Bell className="h-3.5 w-3.5 text-blue-650" />
                <span>Llamar Garzón</span>
              </button>
              <button
                onClick={() => handleServiceRequest('bill')}
                disabled={requestLoading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Receipt className="h-3.5 w-3.5 text-emerald-650" />
                <span>Pedir Cuenta</span>
              </button>
            </div>
          )}

          {serviceMessage.text && (
            <div className={`mt-3 text-center text-[11px] font-bold px-3 py-1.5 rounded-lg border animate-fade-in ${
              serviceMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
              serviceMessage.type === 'info' ? 'bg-blue-50 text-blue-700 border-blue-100' :
              'bg-red-50 text-red-700 border-red-100'
            }`}>
              {serviceMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Glassmorphic sticky categories pills bar */}
      {categories.length > 1 && (
        <div className="bg-white/70 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-30 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex overflow-x-auto no-scrollbar gap-2 scroll-smooth">
            {categories.map(cat => {
              const isActive = activeCategoryId === cat.id;
              return (
                <a
                  key={`nav-${cat.id}`}
                  id={`nav-btn-${cat.id}`}
                  href={`#category-${cat.id}`}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer select-none border ${
                    isActive
                      ? 'text-white shadow-sm border-transparent'
                      : 'text-slate-600 bg-slate-100/80 border-transparent hover:bg-slate-200/80 hover:text-slate-800'
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

      {/* Main menu content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-16">
        {categories.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm max-w-lg mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <h3 className="mt-3 text-lg font-bold text-slate-700">Menú en construcción</h3>
            <p className="mt-1 text-sm text-slate-400">Este restaurante aún no ha añadido productos a su menú.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {categories.map(category => (
              <section key={category.id} id={`category-${category.id}`} className="scroll-mt-20">
                {/* Category title section */}
                <div className="flex items-center gap-3 mb-6">
                  <span 
                    className="h-6 w-1 rounded-full flex-shrink-0"
                    style={{ backgroundColor: restaurant?.primary_color || '#4f46e5' }}
                  ></span>
                  <h2 
                    className="text-lg font-extrabold tracking-tight text-slate-800" 
                    style={dynamicStyles.categoryTitle}
                  >
                    {category.name}
                  </h2>
                  <div className="flex-1 h-[1px] bg-slate-200"></div>
                </div>

                {/* Adaptive product grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {category.products.length === 0 ? (
                    <p className="text-center text-slate-400 col-span-full text-sm italic">No hay productos en esta categoría.</p>
                  ) : (
                    category.products.map(product => {
                      const hasImage = product.image_url && !failedImages.has(product.id);
                      return (
                        <div key={product.id} className="w-full">
                          {/* Desktop view (Premium Grid Cards) */}
                          <div 
                            onClick={() => openProductModal(product)}
                            className="hidden sm:flex sm:flex-col group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer h-full justify-between"
                          >
                            {hasImage && (
                              <div className="w-full h-36 md:h-40 overflow-hidden bg-slate-50 border-b border-slate-100/60 flex-shrink-0 relative">
                                <img 
                                  src={product.image_url} 
                                  alt={product.name} 
                                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out" 
                                  onError={() => handleImageError(product.id)}
                                />
                              </div>
                            )}
                            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="font-bold text-slate-800 text-sm md:text-base leading-snug group-hover:text-slate-900 transition-colors">{product.name}</h3>
                                  {product.availability_status === 'sold_out' && (
                                    <span className="inline-block px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-amber-700 bg-amber-50 border border-amber-100 rounded uppercase">
                                      Agotado
                                    </span>
                                  )}
                                </div>
                                {product.description && (
                                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mt-1">{product.description}</p>
                                )}
                                {product.availability_status === 'sold_out' && product.availability_note && (
                                  <p className="text-[10px] text-amber-600 font-medium italic mt-1 bg-amber-50/50 px-2 py-1 rounded border border-amber-100/50">
                                    {product.availability_note}
                                  </p>
                                )}
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-slate-100/60 mt-auto">
                                <span 
                                  className="font-bold text-sm md:text-base" 
                                  style={{ color: restaurant?.primary_color || '#4f46e5' }}
                                >
                                  {isPriceValid(product.price) 
                                    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(product.price) 
                                    : 'Precio por consultar'}
                                </span>
                                {isPriceValid(product.price) && (
                                  product.availability_status === 'sold_out' ? (
                                    <button
                                      disabled
                                      className="px-3 py-1.5 text-xs font-bold rounded-lg text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed shadow-none select-none pointer-events-none"
                                    >
                                      Agotado
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addToCart(product, 1);
                                      }}
                                      className="px-3 py-1.5 text-xs font-bold rounded-lg text-white transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm"
                                      style={{ backgroundColor: restaurant?.primary_color || '#4f46e5' }}
                                    >
                                      Agregar
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Mobile view (Compact Horizontal Rows) */}
                          <div 
                            onClick={() => openProductModal(product)}
                            className="flex sm:hidden group bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 ease-out cursor-pointer w-full"
                          >
                            {hasImage && (
                              <div className="w-20 h-20 overflow-hidden bg-slate-50 flex-shrink-0 relative my-auto ml-3 rounded-lg border border-slate-100">
                                <img 
                                  src={product.image_url} 
                                  alt={product.name} 
                                  className="w-full h-full object-cover object-center" 
                                  onError={() => handleImageError(product.id)}
                                />
                              </div>
                            )}
                            <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
                              <div className="min-w-0">
                                <h3 className="font-bold text-slate-800 text-xs leading-snug truncate">{product.name}</h3>
                                {product.description && (
                                  <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight mt-0.5">{product.description}</p>
                                )}
                              </div>
                              <div className="flex justify-between items-center mt-1.5">
                                <span 
                                  className="font-bold text-xs" 
                                  style={{ color: restaurant?.primary_color || '#4f46e5' }}
                                >
                                  {isPriceValid(product.price) 
                                    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(product.price) 
                                    : 'Precio por consultar'}
                                </span>
                                {isPriceValid(product.price) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToCart(product, 1);
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg text-white transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm"
                                    style={{ backgroundColor: restaurant?.primary_color || '#4f46e5' }}
                                  >
                                    Agregar
                                  </button>
                                )}
                              </div>
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

      {/* Product Detail Modal */}
      {selectedProductForModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setSelectedProductForModal(null)}
        >
          <div 
            className="bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-100 max-w-lg w-full relative flex flex-col max-h-[90vh] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Close Button */}
            <button 
              type="button"
              onClick={() => setSelectedProductForModal(null)}
              className="absolute top-3 right-3 bg-slate-100/80 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-full p-1.5 transition-colors cursor-pointer z-10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Product Image inside Modal */}
            {selectedProductForModal.image_url && !failedImages.has(selectedProductForModal.id) && (
              <div className="w-full h-48 sm:h-56 bg-slate-50 overflow-hidden relative flex-shrink-0">
                <img 
                  src={selectedProductForModal.image_url} 
                  alt={selectedProductForModal.name} 
                  className="w-full h-full object-cover object-center"
                  onError={() => handleImageError(selectedProductForModal.id)}
                />
              </div>
            )}

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-extrabold text-slate-900">{selectedProductForModal.name}</h2>
                  {selectedProductForModal.availability_status === 'sold_out' && (
                    <span className="inline-block px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-amber-700 bg-amber-50 border border-amber-100 rounded uppercase">
                      Agotado
                    </span>
                  )}
                </div>
                <span 
                  className="text-base font-extrabold block mt-1" 
                  style={{ color: restaurant?.primary_color || '#4f46e5' }}
                >
                  {isPriceValid(selectedProductForModal.price) 
                    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(selectedProductForModal.price) 
                    : 'Precio por consultar'}
                </span>
              </div>

              {selectedProductForModal.description && (
                <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {selectedProductForModal.description}
                </p>
              )}

              {selectedProductForModal.availability_status === 'sold_out' && selectedProductForModal.availability_note && (
                <p className="text-xs text-amber-600 font-medium italic mt-2 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/50">
                  Nota: {selectedProductForModal.availability_note}
                </p>
              )}

              {/* Quantity Select and Action Add */}
              {isPriceValid(selectedProductForModal.price) ? (
                selectedProductForModal.availability_status === 'sold_out' ? (
                  <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                    <p className="text-xs text-amber-600 font-semibold italic text-center">
                      Este producto está temporalmente agotado y no se puede agregar a la estimación.
                    </p>
                    <button
                      disabled
                      type="button"
                      className="w-full px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed text-center select-none pointer-events-none"
                    >
                      Agotado
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setModalQuantity(prev => Math.max(1, prev - 1))}
                        disabled={modalQuantity <= 1}
                        className="w-8 h-8 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 rounded shadow-sm transition-colors cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="text-sm font-extrabold text-slate-800 w-6 text-center">{modalQuantity}</span>
                      <button
                        type="button"
                        onClick={() => setModalQuantity(prev => Math.min(99, prev + 1))}
                        disabled={modalQuantity >= 99}
                        className="w-8 h-8 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 rounded shadow-sm transition-colors cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        addToCart(selectedProductForModal, modalQuantity);
                        setSelectedProductForModal(null);
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all cursor-pointer text-center"
                      style={{ backgroundColor: restaurant?.primary_color || '#4f46e5' }}
                    >
                      Agregar a mi selección
                    </button>
                  </div>
                )
              ) : (
                <p className="text-xs text-rose-600 font-semibold italic pt-2 text-center">
                  Este producto no cuenta con precio establecido y no puede sumarse a la estimación.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 py-3 shadow-lg z-40 flex items-center justify-between animate-slide-up max-w-lg mx-auto rounded-t-2xl sm:border-x">
          <div>
            <span className="text-[10px] text-slate-500 font-semibold block">Total Estimado</span>
            <span className="text-base font-extrabold text-slate-900">
              {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(total)}
            </span>
          </div>
          <button
            type="button"
            onClick={openCartDrawer}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Ver selección ({cart.reduce((sum, item) => sum + item.quantity, 0)})
          </button>
        </div>
      )}

      {/* Cart / Estimador Drawer */}
      {isCartDrawerOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end animate-fade-in"
          onClick={() => setIsCartDrawerOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col relative animate-slide-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Estimación de Consumo {tableData ? `· Mesa ${tableData.table_number}` : ''}
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">Revisa tus productos y propina</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg p-1.5 transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Warning Disclaimer */}
            <div className="bg-amber-50 border-y border-amber-100 px-4 py-2.5 text-[10px] text-amber-800 font-semibold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Esta selección es solo una estimación y no envía el pedido al restaurante.</span>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-xs text-slate-400 text-center italic py-10">Tu selección está vacía.</p>
              ) : (
                cart.map(item => (
                  <div key={`cart-${item.id}`} className="flex gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 items-center justify-between">
                    {item.image_url && !failedImages.has(item.id) && (
                      <div className="w-12 h-12 rounded-lg bg-white overflow-hidden border border-slate-200/80 p-0.5 flex-shrink-0">
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-md" onError={() => handleImageError(item.id)} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                      <span className="text-[10px] text-slate-500 block">
                        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(item.price)} c/u
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-0.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <span className="text-xs font-extrabold text-slate-800 w-4 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          disabled={item.quantity >= 99}
                          className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-40 cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setCart(prev => prev.filter(p => p.id !== item.id))}
                        className="p-1 hover:bg-rose-50 text-rose-600 rounded transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Calculations & Summary Section */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-4 flex-shrink-0">
              {/* Tip Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Propina</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '0%', val: 0 },
                    { label: '10% Sug.', val: 10 },
                    { label: '15%', val: 15 },
                    { label: 'Otro', val: 'custom' }
                  ].map(opt => {
                    const isSelected = tipPercentage === opt.val;
                    return (
                      <button
                        key={`tip-opt-${opt.label}`}
                        type="button"
                        onClick={() => setTipPercentage(opt.val)}
                        className={`text-[10px] font-bold py-1.5 px-2 rounded-lg border transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'bg-slate-900 text-white border-transparent'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                
                {tipPercentage === 'custom' && (
                  <div className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 mt-1.5">
                    <span className="text-xs text-slate-500 font-bold">%</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customTipVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        const num = parseFloat(val);
                        if (val === '' || (Number.isFinite(num) && num >= 0 && num <= 100)) {
                          setCustomTipVal(val);
                        }
                      }}
                      placeholder="Porcentaje (0-100)"
                      className="w-full text-xs outline-none bg-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Divide total option */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dividir Cuenta</label>
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold">Personas:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={splitPeopleCount}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = parseInt(val);
                      if (val === '' || (Number.isFinite(num) && num >= 1 && num <= 100)) {
                        setSplitPeopleCount(val);
                      }
                    }}
                    className="w-full text-xs outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Totals Summary */}
              <div className="space-y-2 border-t border-slate-200/80 pt-3 text-xs font-semibold text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-slate-800 font-bold">
                    {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(subtotal)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span>Propina</span>
                  <span className="text-slate-800 font-bold">
                    {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(tip)}
                  </span>
                </div>

                <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t border-dashed border-slate-200 pt-2">
                  <span>Total Estimado</span>
                  <span style={{ color: restaurant?.primary_color || '#4f46e5' }}>
                    {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(total)}
                  </span>
                </div>

                {parseInt(splitPeopleCount) > 1 && (
                  <div className="flex justify-between text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 p-2 rounded-lg mt-2">
                    <span>Estimado por persona</span>
                    <span>
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totalPerPerson)}
                    </span>
                  </div>
                )}
              </div>

              {/* Reset / Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCart([])}
                  disabled={cart.length === 0}
                  className="flex-1 py-2 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer text-center disabled:opacity-40"
                >
                  Vaciar selección
                </button>
                <button
                  type="button"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="flex-1 py-2 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer text-center"
                >
                  Volver al menú
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}