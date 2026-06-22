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
  const [menus, setMenus] = useState([]);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [allCategories, setAllCategories] = useState([]);
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

  // Derive categories from activeMenuId and allCategories
  useEffect(() => {
    if (allCategories.length === 0) {
      setCategories([]);
      return;
    }

    const defaultMenu = menus.find(m => m.is_default);
    const defaultMenuId = defaultMenu?.id;

    const filtered = allCategories.filter(cat => {
      if (!activeMenuId) return true;
      if (activeMenuId === defaultMenuId) {
        return cat.menu_id === activeMenuId || cat.menu_id === null;
      }
      return cat.menu_id === activeMenuId;
    });

    setCategories(filtered);

    if (filtered.length > 0) {
      setActiveCategoryId(filtered[0].id);
    } else {
      setActiveCategoryId(null);
    }
  }, [allCategories, activeMenuId, menus]);

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
        .select('id, name, logo_url, primary_color, is_active, background_url')
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

      // Fetch menus
      const { data: menusData, error: menusError } = await supabase
        .from('restaurant_menus')
        .select('*')
        .eq('restaurant_id', restData.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (menusError) {
        console.error('Error fetching menus:', menusError);
      } else {
        const activeMs = menusData || [];
        setMenus(activeMs);
        if (activeMs.length === 1) {
          // If only 1 menu is active, directly select it
          setActiveMenuId(activeMs[0].id);
        } else {
          // If >= 2 menus are active, start at the index cover screen (activeMenuId = null)
          setActiveMenuId(null);
        }
      }

      const { data: menuData, error: menuError } = await supabase
        .from('categories')
        .select(`id, name, display_order, menu_id, products (id, name, description, price, image_url, availability_status, availability_note, display_order)`)
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
            products: visibleProducts.sort((a, b) => {
              const orderDiff = (a.display_order || 0) - (b.display_order || 0);
              if (orderDiff !== 0) return orderDiff;
              return a.name.localeCompare(b.name);
            })
          };
        });
        const activeCategories = sortedMenuData.filter(cat => cat.products && cat.products.length > 0);
        setAllCategories(activeCategories);
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

  const primary = restaurant?.primary_color || '#4f46e5';
  const dynamicPaddingBottom = (cart.length > 0 ? 80 : 0) + (menus.length >= 2 && activeMenuId !== null ? 80 : 20) + 'px';
  const isHome = activeMenuId === null && menus.length >= 2;

  const dynamicBackgroundStyle = {
    background: restaurant?.background_url 
      ? `url(${restaurant.background_url}) center/cover no-repeat fixed` 
      : (isHome 
          ? `linear-gradient(180deg, ${hexToRgba(primary, 0.08)} 0%, #ffffff 35%, #f8fafc 100%)`
          : `linear-gradient(180deg, ${hexToRgba(primary, 0.04)} 0%, #ffffff 25%, #f8fafc 100%)`),
    paddingBottom: dynamicPaddingBottom
  };

  return (
    <div 
      className="min-h-screen relative overflow-hidden font-sans text-slate-800"
      style={dynamicBackgroundStyle}
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

      {/* Background image overlay layer for glassmorphism cover */}
      {restaurant.background_url && (
        <div 
          className={`absolute inset-0 z-0 pointer-events-none transition-all duration-500 ${
            isHome ? 'bg-white/80 backdrop-blur-[5px]' : 'bg-white/96 backdrop-blur-[8px]'
          }`} 
        />
      )}

      {/* Dynamic identity background wrapper */}
      {!restaurant.background_url && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
          {/* Dynamic gradient background */}
          <div 
            className="absolute inset-0 opacity-[0.04] transition-all duration-500" 
            style={{ 
              background: `radial-gradient(circle at 10% 20%, ${restaurant.primary_color || '#4f46e5'} 0%, transparent 80%)` 
            }}
          />
          {/* Decorative blur circle 1 */}
          <div 
            className="absolute -top-40 -left-40 w-[450px] h-[450px] rounded-full blur-[100px] transition-all duration-700"
            style={{ 
              backgroundColor: restaurant.primary_color || '#4f46e5',
              opacity: isHome ? 0.06 : 0.03
            }}
          />
          {/* Decorative blur circle 2 */}
          <div 
            className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full blur-[120px] transition-all duration-700 -translate-y-1/2"
            style={{ 
              backgroundColor: restaurant.primary_color || '#4f46e5',
              opacity: isHome ? 0.05 : 0.02
            }}
          />
        </div>
      )}

      {/* Banner superior compacto */}
      {(!isHome || !restaurant.background_url) && (
        <div 
          className="w-full h-28 md:h-36 relative overflow-hidden border-b border-slate-100/50"
          style={{ 
            background: `linear-gradient(135deg, ${hexToRgba(primary, 0.18)} 0%, ${hexToRgba(primary, 0.04)} 100%)`
          }}
        >
          <div className="absolute inset-0 bg-white/10"></div>
        </div>
      )}

      {/* Floating Logo and Info center card */}
      <div className={`max-w-6xl mx-auto px-4 relative z-10 ${isHome && restaurant.background_url ? 'pt-16' : '-mt-16'} mb-6`}>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm text-center max-w-lg mx-auto transition-all duration-350 hover:shadow-md">
          {(() => {
            const logoClasses = isHome 
              ? "h-28 w-28 md:h-36 md:w-36 rounded-full bg-white p-1.5 shadow-md border object-contain mx-auto ring-4 ring-white/60 transition-all duration-300"
              : "h-20 w-20 md:h-24 md:w-24 rounded-full bg-white p-1 shadow-md border object-contain mx-auto ring-4 ring-white/60 transition-all duration-300";
            
            const fallbackClasses = isHome
              ? "h-28 w-28 md:h-36 md:w-36 rounded-full mx-auto flex items-center justify-center font-black text-4xl shadow-md ring-4 ring-white/60 border transition-all duration-300"
              : "h-20 w-20 md:h-24 md:w-24 rounded-full mx-auto flex items-center justify-center font-black text-3xl shadow-md ring-4 ring-white/60 border transition-all duration-300";

            return (
              <div className={`relative inline-block ${isHome && restaurant.background_url ? '-mt-24 mb-4' : (isHome ? '-mt-28 mb-4' : '-mt-20 mb-3')} transition-all duration-300`}>
                {restaurant.logo_url ? (
                  <img 
                    src={restaurant.logo_url} 
                    alt={`${restaurant.name} logo`} 
                    className={logoClasses}
                    style={{ borderColor: hexToRgba(primary, 0.25) }}
                  />
                ) : (
                  <div 
                    className={fallbackClasses}
                    style={{ 
                      backgroundColor: hexToRgba(primary, 0.06), 
                      color: primary, 
                      borderColor: hexToRgba(primary, 0.25) 
                    }}
                  >
                    {restaurant.name?.[0] || 'M'}
                  </div>
                )}
              </div>
            );
          })()}
          
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
            {restaurant.name}
          </h1>

          {activeMenuId !== null && menus.length >= 2 && (
            <p className="text-sm font-extrabold text-slate-500 mt-1 uppercase tracking-wider">
              {menus.find(m => m.id === activeMenuId)?.name}
            </p>
          )}

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

      {/* Botón de volver al índice (si hay 2 o más menús y estamos en el detalle de uno) */}
      {menus.length >= 2 && activeMenuId !== null && (
        <div className="max-w-6xl mx-auto px-4 mb-4 animate-fade-in">
          <button
            onClick={() => setActiveMenuId(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5 text-slate-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            <span>Volver a Menús</span>
          </button>
        </div>
      )}

      {/* Glassmorphic sticky categories pills bar */}
      {activeMenuId !== null && categories.length > 1 && (
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
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer select-none border`}
                  style={isActive ? { 
                    backgroundColor: restaurant?.primary_color || '#4f46e5',
                    color: '#ffffff',
                    borderColor: 'transparent'
                  } : {
                    backgroundColor: hexToRgba(restaurant?.primary_color || '#4f46e5', 0.04),
                    color: restaurant?.primary_color || '#4f46e5',
                    borderColor: hexToRgba(restaurant?.primary_color || '#4f46e5', 0.15)
                  }}
                >
                  {cat.name}
                </a>
              );
            })}
          </div>
        </div>
      )}
      {/* Main menu content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-16 relative z-10">
        {menus.length >= 2 && activeMenuId === null ? (
          <div className="max-w-md mx-auto space-y-6 py-6 animate-fade-in animate-slide-up">
            <div className="text-center space-y-1.5 mb-2">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-500" style={{ color: hexToRgba(primary, 0.7) }}>
                Selecciona una carta
              </span>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                Nuestras Cartas
              </h2>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {menus.map(menu => {
                const accent = menu.accent_color || primary;
                const hasCover = menu.cover_image_url && !failedImages.has(menu.id);
                const catCount = allCategories.filter(c => {
                  const defaultMenu = menus.find(m => m.is_default);
                  if (menu.id === defaultMenu?.id) {
                    return c.menu_id === menu.id || c.menu_id === null;
                  }
                  return c.menu_id === menu.id;
                }).length;

                const cardStyles = hasCover 
                  ? { 
                      boxShadow: `0 10px 30px -4px ${hexToRgba(accent, 0.25)}`,
                      borderColor: hexToRgba(accent, 0.2)
                    }
                  : {
                      borderColor: hexToRgba(accent, 0.15),
                      borderLeftColor: accent,
                      boxShadow: `0 8px 30px -4px ${hexToRgba(accent, 0.12)}`
                    };

                return (
                  <button
                    key={menu.id}
                    onClick={() => {
                      setActiveMenuId(menu.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`w-full text-left rounded-2xl border transition-all duration-300 active:scale-98 flex items-center justify-between group cursor-pointer ${
                      hasCover ? 'min-h-[140px] p-6 relative overflow-hidden' : 'bg-white/95 backdrop-blur-md p-6 border-l-4'
                    }`}
                    style={cardStyles}
                  >
                    {hasCover && (
                      <>
                        <img 
                          src={menu.cover_image_url} 
                          alt={menu.name}
                          className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-500 group-hover:scale-105"
                          onError={() => handleImageError(menu.id)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/65 to-transparent z-10" />
                      </>
                    )}

                    <div className={`space-y-1.5 pr-4 flex-1 relative z-20 ${hasCover ? 'text-white' : 'text-slate-800'}`}>
                      <div className="flex items-center gap-2.5">
                        {!hasCover ? (
                          menu.icon_text ? (
                            <span className="text-3xl flex-shrink-0">{menu.icon_text}</span>
                          ) : (
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black text-white flex-shrink-0" style={{ backgroundColor: accent }}>
                              {menu.name.charAt(0).toUpperCase()}
                            </div>
                          )
                        ) : (
                          menu.icon_text && <span className="text-xl md:text-2xl flex-shrink-0">{menu.icon_text}</span>
                        )}
                        <h3 className={`font-extrabold text-base md:text-xl transition-colors ${
                          hasCover ? 'text-white' : 'text-slate-900 group-hover:text-indigo-650'
                        }`}>
                          {menu.name}
                        </h3>
                      </div>
                      {menu.description && (
                        <p className={`text-xs line-clamp-2 leading-relaxed ${
                          hasCover ? 'text-slate-200' : 'text-slate-500'
                        }`}>
                          {menu.description}
                        </p>
                      )}
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold mt-1 ${
                        hasCover ? 'text-slate-300' : 'text-slate-455'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.007 8.25H3.75v-.008h.007V15Zm0 2.25H3.75v-.008h.007v.008Z" />
                        </svg>
                        {catCount} {catCount === 1 ? 'categoría' : 'categorías'}
                      </span>
                    </div>

                    <div 
                      className="p-3 rounded-full text-white flex-shrink-0 group-hover:translate-x-1 transition-all relative z-20"
                      style={{ backgroundColor: accent }}
                    >
                      <svg xmlns="http://www.w3.org/2050/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : categories.length === 0 ? (
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
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="font-bold text-slate-800 text-xs leading-snug truncate">{product.name}</h3>
                                  {product.availability_status === 'sold_out' && (
                                    <span className="inline-block px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider text-amber-700 bg-amber-50 border border-amber-100 rounded uppercase">
                                      Agotado
                                    </span>
                                  )}
                                </div>
                                {product.description && (
                                  <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight mt-0.5">{product.description}</p>
                                )}
                                {product.availability_status === 'sold_out' && product.availability_note && (
                                  <p className="text-[9px] text-amber-600 font-medium italic mt-1 bg-amber-50/50 px-2 py-0.5 rounded border border-amber-100/50">
                                    {product.availability_note}
                                  </p>
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
                                  product.availability_status === 'sold_out' ? (
                                    <button
                                      disabled
                                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed shadow-none select-none pointer-events-none"
                                    >
                                      Agotado
                                    </button>
                                  ) : (
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
                                  )
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
        <div 
          className="fixed inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 py-3 shadow-lg z-40 flex items-center justify-between animate-slide-up max-w-lg mx-auto rounded-t-2xl sm:border-x"
          style={{ bottom: menus.length >= 2 && activeMenuId !== null ? '64px' : '0px' }}
        >
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
      {/* Sticky Bottom Navigation Bar for menus */}
      {menus.length >= 2 && activeMenuId !== null && (() => {
        const activeMs = menus.filter(m => m.is_active);
        if (activeMs.length < 2) return null;
        const half = Math.ceil(activeMs.length / 2);
        const left = activeMs.slice(0, half);
        const right = activeMs.slice(half);
        return (
          <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t shadow-lg z-40 max-w-lg mx-auto rounded-t-2xl sm:border-x" style={{ borderTopColor: hexToRgba(restaurant?.primary_color || '#4f46e5', 0.25) }}>
            <div className="flex items-center justify-between px-3 py-2 h-16">
              {/* Left Menus */}
              <div className="flex-1 flex justify-around gap-1 overflow-x-auto no-scrollbar">
                {left.map(m => {
                  const isActive = m.id === activeMenuId;
                  const accent = m.accent_color || restaurant?.primary_color || '#4f46e5';
                  const displayName = m.name.length > 12 ? `${m.name.slice(0, 10)}...` : m.name;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setActiveMenuId(m.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-extrabold transition-all truncate max-w-[90px] cursor-pointer text-center ${
                        isActive 
                           ? 'text-white shadow-2xs' 
                           : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                      style={isActive ? { backgroundColor: accent } : {}}
                    >
                      {m.icon_text ? `${m.icon_text} ` : ''}{displayName}
                    </button>
                  );
                })}
              </div>

              {/* Center Home Button */}
              <div className="flex-shrink-0 px-2.5">
                <button
                  onClick={() => {
                    setActiveMenuId(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-11 h-11 rounded-full flex flex-col items-center justify-center text-white shadow-md active:scale-95 transition-transform hover:brightness-105 cursor-pointer"
                  style={{ backgroundColor: restaurant?.primary_color || '#4f46e5' }}
                  title="Inicio"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5.5 h-5.5">
                    <path d="M11.47 3.84a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 1-1.06 1.06l-.22-.22v7.13a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75V13.37l-.22.22a.75.75 0 1 1-1.06-1.06l8.69-8.69Z" />
                  </svg>
                </button>
              </div>

              {/* Right Menus */}
              <div className="flex-1 flex justify-around gap-1 overflow-x-auto no-scrollbar">
                {right.map(m => {
                  const isActive = m.id === activeMenuId;
                  const accent = m.accent_color || restaurant?.primary_color || '#4f46e5';
                  const displayName = m.name.length > 12 ? `${m.name.slice(0, 10)}...` : m.name;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setActiveMenuId(m.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-extrabold transition-all truncate max-w-[90px] cursor-pointer text-center ${
                        isActive 
                           ? 'text-white shadow-2xs' 
                           : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                      style={isActive ? { backgroundColor: accent } : {}}
                    >
                      {m.icon_text ? `${m.icon_text} ` : ''}{displayName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}