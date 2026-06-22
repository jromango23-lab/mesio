import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Folder, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  X, 
  Check, 
  BookOpen, 
  AlertCircle,
  Upload
} from 'lucide-react';

const hexToRgba = (hex, alpha = 1) => {
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

export default function MenusManager({ restaurantId, targetRestaurantId }) {
  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    is_default: false,
    display_order: 0,
    icon_text: '',
    accent_color: '',
    cover_image_url: ''
  });

  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverImageUrl, setCoverImageUrl] = useState('');

  // Category associations state in modal
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [failedImages, setFailedImages] = useState(new Set());

  const handleImageError = (id) => {
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
  };

  const activeRestaurantId = targetRestaurantId || restaurantId;

  const fetchMenusAndCategories = async () => {
    if (!activeRestaurantId) return;
    setLoading(true);
    try {
      // 1. Fetch restaurant branding info
      const { data: restData, error: restError } = await supabase
        .from('restaurants')
        .select('id, name, logo_url, primary_color')
        .eq('id', activeRestaurantId)
        .single();
      
      if (!restError && restData) {
        setRestaurant(restData);
      }

      // 2. Fetch menus
      const { data: menuData, error: menuError } = await supabase
        .from('restaurant_menus')
        .select('*')
        .eq('restaurant_id', activeRestaurantId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (menuError) throw menuError;

      // 3. Fetch categories with nested products sorted by display_order
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select(`
          id, 
          name, 
          display_order, 
          menu_id, 
          products (
            id, 
            name, 
            description, 
            price, 
            image_url, 
            availability_status, 
            availability_note, 
            display_order
          )
        `)
        .eq('restaurant_id', activeRestaurantId)
        .order('display_order', { ascending: true });

      if (catError) throw catError;

      // Sort products locally inside each category
      const sortedCategories = (catData || []).map(cat => {
        const sortedProds = (cat.products || []).sort((a, b) => {
          const orderDiff = (a.display_order || 0) - (b.display_order || 0);
          if (orderDiff !== 0) return orderDiff;
          return a.name.localeCompare(b.name);
        });
        return { ...cat, products: sortedProds };
      });

      setMenus(menuData || []);
      setCategories(sortedCategories || []);

      // Set initial preview state based on active menus
      if (menuData && menuData.length > 0) {
        const activeMs = menuData.filter(m => m.is_active);
        if (activeMs.length === 1) {
          // If only 1 active menu, default preview directly to that menu
          setActiveMenuId(activeMs[0].id);
        } else {
          // If >= 2 active menus or 0 active menus, default to the index cover preview
          setActiveMenuId(null);
        }
      }
    } catch (err) {
      console.error('Error fetching menus/categories:', err);
      setMessage({ type: 'error', text: 'Error al cargar datos: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenusAndCategories();
  }, [activeRestaurantId]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCategoryToggle = (categoryId) => {
    setSelectedCategoryIds(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId) 
        : [...prev, categoryId]
    );
  };

  const handleEdit = (menu) => {
    setEditingId(menu.id);
    setFormData({
      name: menu.name,
      description: menu.description || '',
      is_active: menu.is_active,
      is_default: menu.is_default,
      display_order: menu.display_order || 0,
      icon_text: menu.icon_text || '',
      accent_color: menu.accent_color || '',
      cover_image_url: menu.cover_image_url || ''
    });
    setCoverImageUrl(menu.cover_image_url || '');
    setCoverImageFile(null);
    // Load currently associated categories
    const associatedIds = categories
      .filter(c => c.menu_id === menu.id)
      .map(c => c.id);
    setSelectedCategoryIds(associatedIds);
    setIsModalOpen(true);
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre es obligatorio.' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      // If we are marking this menu as default, first unset all other defaults
      if (formData.is_default) {
        const { error: unsetError } = await supabase
          .from('restaurant_menus')
          .update({ is_default: false })
          .eq('restaurant_id', activeRestaurantId);
        
        if (unsetError) throw unsetError;
      }

      const menuPayload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_active: formData.is_default ? true : formData.is_active, // Predeterminado siempre activo
        is_default: formData.is_default,
        display_order: parseInt(formData.display_order) || 0,
        restaurant_id: activeRestaurantId,
        icon_text: (formData.icon_text || '').trim(),
        accent_color: formData.accent_color || '',
        cover_image_url: coverImageUrl
      };

      let menuId = editingId;

      if (editingId) {
        // Edit menu
        const { error } = await supabase
          .from('restaurant_menus')
          .update(menuPayload)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        // Create menu
        const { data, error } = await supabase
          .from('restaurant_menus')
          .insert([menuPayload])
          .select();

        if (error) throw error;
        menuId = data[0].id;
      }

      // If a cover image file is chosen, upload it now
      if (coverImageFile) {
        const fileExt = coverImageFile.name.split('.').pop();
        const fileName = `${menuId}-${Date.now()}.${fileExt}`;
        const filePath = `restaurant_menus/${activeRestaurantId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('restaurant-assets')
          .upload(filePath, coverImageFile, {
            cacheControl: '3605',
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('restaurant-assets')
          .getPublicUrl(filePath);

        const uploadedUrl = publicUrlData.publicUrl;

        // Update menu with the uploaded URL
        const { error: updateImgError } = await supabase
          .from('restaurant_menus')
          .update({ cover_image_url: uploadedUrl })
          .eq('id', menuId);

        if (updateImgError) throw updateImgError;
      }

      // Update category assignments
      // 1. Link selected categories to this menu
      if (selectedCategoryIds.length > 0) {
        const { error: linkError } = await supabase
          .from('categories')
          .update({ menu_id: menuId })
          .in('id', selectedCategoryIds);
        
        if (linkError) throw linkError;
      }

      // 2. Unlink deselected categories (previously linked to this menu but not selected now)
      const unlinkIds = categories
        .filter(c => c.menu_id === menuId && !selectedCategoryIds.includes(c.id))
        .map(c => c.id);

      if (unlinkIds.length > 0) {
        const { error: unlinkError } = await supabase
          .from('categories')
          .update({ menu_id: null })
          .in('id', unlinkIds);
        
        if (unlinkError) throw unlinkError;
      }

      setMessage({ type: 'success', text: editingId ? 'Menú actualizado exitosamente.' : 'Menú creado exitosamente.' });
      setIsModalOpen(false);
      await fetchMenusAndCategories();
    } catch (err) {
      console.error('Error saving menu:', err);
      setMessage({ type: 'error', text: 'Error al guardar el menú: ' + err.message });
      await fetchMenusAndCategories();
    } finally {
      setSaving(false);
      setCoverImageFile(null);
    }
  };

  const handleSetDefault = async (menuId) => {
    setMessage({ type: '', text: '' });
    try {
      // Step 1: Unset other defaults for this restaurant
      const { error: unsetError } = await supabase
        .from('restaurant_menus')
        .update({ is_default: false })
        .eq('restaurant_id', activeRestaurantId);

      if (unsetError) throw unsetError;

      // Step 2: Set this menu as default and active
      const { error: setError } = await supabase
        .from('restaurant_menus')
        .update({ is_default: true, is_active: true })
        .eq('id', menuId);

      if (setError) throw setError;

      setMessage({ type: 'success', text: 'Menú predeterminado actualizado.' });
      await fetchMenusAndCategories();
    } catch (err) {
      console.error('Error setting default menu:', err);
      setMessage({ type: 'error', text: 'Error al cambiar menú predeterminado: ' + err.message });
      await fetchMenusAndCategories();
    }
  };

  const handleToggleActive = async (menu) => {
    if (menu.is_default) {
      setMessage({ type: 'error', text: 'No se puede desactivar el menú predeterminado.' });
      return;
    }

    setMessage({ type: '', text: '' });
    try {
      const { error } = await supabase
        .from('restaurant_menus')
        .update({ is_active: !menu.is_active })
        .eq('id', menu.id);

      if (error) throw error;

      setMessage({ type: 'success', text: `Menú ${!menu.is_active ? 'activado' : 'desactivado'} exitosamente.` });
      await fetchMenusAndCategories();
    } catch (err) {
      console.error('Error toggling active status:', err);
      setMessage({ type: 'error', text: 'Error al cambiar estado del menú: ' + err.message });
      await fetchMenusAndCategories();
    }
  };

  const handleDeleteMenu = async (menu) => {
    if (menu.is_default) {
      setMessage({ type: 'error', text: 'No se puede eliminar el menú predeterminado.' });
      return;
    }

    if (!window.confirm(`¿Estás seguro de eliminar el menú "${menu.name}"? Las categorías asociadas no se eliminarán, sino que quedarán sin menú asignado (se mostrarán en la Carta Principal).`)) {
      return;
    }

    setMessage({ type: '', text: '' });
    try {
      const { error } = await supabase
        .from('restaurant_menus')
        .delete()
        .eq('id', menu.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Menú eliminado correctamente.' });
      
      // If we deleted the currently active menu in preview, reset activeMenuId
      if (activeMenuId === menu.id) {
        setActiveMenuId(null);
      }
      
      await fetchMenusAndCategories();
    } catch (err) {
      console.error('Error deleting menu:', err);
      setMessage({ type: 'error', text: 'Error al eliminar el menú: ' + err.message });
      await fetchMenusAndCategories();
    }
  };

  // Reorder Menus
  const handleMoveMenu = async (menu, direction, onlyActive = false) => {
    const listToSwap = onlyActive ? menus.filter(m => m.is_active) : menus;
    const index = listToSwap.findIndex(m => m.id === menu.id);
    if (index === -1) return;

    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === listToSwap.length - 1) return;

    const neighborIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap elements in listToSwap
    const temp = [...listToSwap];
    const item = temp[index];
    temp[index] = temp[neighborIndex];
    temp[neighborIndex] = item;

    // Reassemble full menus list preserving inactive menus order but updating active ones
    let updatedMenus = [];
    if (onlyActive) {
      const inactiveMenus = menus.filter(m => !m.is_active);
      const normalizedActive = temp.map((m, idx) => ({ ...m, display_order: idx + 1 }));
      const normalizedInactive = inactiveMenus.map((m, idx) => ({ ...m, display_order: normalizedActive.length + idx + 1 }));
      updatedMenus = [...normalizedActive, ...normalizedInactive].sort((a, b) => a.display_order - b.display_order);
    } else {
      updatedMenus = temp.map((m, idx) => ({ ...m, display_order: idx + 1 }));
    }

    // Optimistic UI state update
    setMenus(updatedMenus);

    try {
      // Execute all updates in parallel
      const updatePromises = updatedMenus.map(m => 
        supabase
          .from('restaurant_menus')
          .update({ display_order: m.display_order })
          .eq('id', m.id)
      );
      
      const results = await Promise.all(updatePromises);
      const firstError = results.find(r => r.error);
      if (firstError) throw firstError.error;

      setMessage({ type: 'success', text: 'Orden del menú actualizado exitosamente.' });
    } catch (err) {
      console.error('Error swapping menu order:', err);
      setMessage({ type: 'error', text: 'Error al cambiar orden: ' + err.message });
      await fetchMenusAndCategories();
    }
  };

  // Reorder Categories
  const handleMoveCategory = async (category, direction) => {
    const defaultMenu = menus.find(m => m.is_default);
    const defaultMenuId = defaultMenu?.id;

    // Get categories visible in the currently active menu
    const visibleCats = categories.filter(cat => {
      if (!activeMenuId) return true;
      if (activeMenuId === defaultMenuId) {
        return cat.menu_id === activeMenuId || cat.menu_id === null;
      }
      return cat.menu_id === activeMenuId;
    });

    const index = visibleCats.findIndex(c => c.id === category.id);
    if (index === -1) return;

    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === visibleCats.length - 1) return;

    const neighborIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    const tempVisible = [...visibleCats];
    const temp = tempVisible[index];
    tempVisible[index] = tempVisible[neighborIndex];
    tempVisible[neighborIndex] = temp;

    // Normalise display_order (1, 2, 3...)
    const normalizedVisible = tempVisible.map((c, idx) => ({
      ...c,
      display_order: idx + 1
    }));

    // Optimistic local state update: merge back into categories
    setCategories(prev => {
      return prev.map(c => {
        const found = normalizedVisible.find(nv => nv.id === c.id);
        return found ? found : c;
      }).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    });

    try {
      const updatePromises = normalizedVisible.map(c =>
        supabase
          .from('categories')
          .update({ display_order: c.display_order })
          .eq('id', c.id)
      );

      const results = await Promise.all(updatePromises);
      const firstError = results.find(r => r.error);
      if (firstError) throw firstError.error;

      setMessage({ type: 'success', text: 'Orden de categorías actualizado exitosamente.' });
    } catch (err) {
      console.error('Error swapping category order:', err);
      setMessage({ type: 'error', text: 'Error al cambiar orden: ' + err.message });
      await fetchMenusAndCategories();
    }
  };

  // Reorder Products inside Category
  const handleMoveProduct = async (category, product, direction) => {
    const cat = categories.find(c => c.id === category.id);
    if (!cat) return;

    const allProds = cat.products || [];
    const visibleProds = allProds.filter(p => p.availability_status !== 'hidden');
    const hiddenProds = allProds.filter(p => p.availability_status === 'hidden');

    const index = visibleProds.findIndex(p => p.id === product.id);
    if (index === -1) return;

    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === visibleProds.length - 1) return;

    const neighborIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap visible
    const tempVisible = [...visibleProds];
    const temp = tempVisible[index];
    tempVisible[index] = tempVisible[neighborIndex];
    tempVisible[neighborIndex] = temp;

    // Normalise display_order (1, 2, 3...)
    const normalizedVisible = tempVisible.map((p, idx) => ({
      ...p,
      display_order: idx + 1
    }));

    const normalizedHidden = hiddenProds.map((p, idx) => ({
      ...p,
      display_order: normalizedVisible.length + idx + 1
    }));

    const normalizedProds = [...normalizedVisible, ...normalizedHidden];

    // Optimistic local update
    setCategories(prev => {
      return prev.map(c => {
        if (c.id === category.id) {
          return { ...c, products: normalizedProds };
        }
        return c;
      });
    });

    try {
      const updatePromises = normalizedProds.map(p =>
        supabase
          .from('products')
          .update({ display_order: p.display_order })
          .eq('id', p.id)
      );

      const results = await Promise.all(updatePromises);
      const firstError = results.find(r => r.error);
      if (firstError) throw firstError.error;

      setMessage({ type: 'success', text: 'Orden de productos actualizado exitosamente.' });
    } catch (err) {
      console.error('Error swapping product order:', err);
      setMessage({ type: 'error', text: 'Error al cambiar orden: ' + err.message });
      await fetchMenusAndCategories();
    }
  };

  // Helper to count categories in a menu
  const getCategoriesCount = (menuId) => {
    const menuObj = menus.find(m => m.id === menuId);
    if (menuObj?.is_default) {
      // Si es el predeterminado, contamos también las categorías huérfanas
      return categories.filter(c => c.menu_id === menuId || c.menu_id === null).length;
    }
    return categories.filter(c => c.menu_id === menuId).length;
  };

  // Filter categories for the phone mockup preview based on activeMenuId
  const defaultMenu = menus.find(m => m.is_default);
  const defaultMenuId = defaultMenu?.id;
  const visibleCategoriesForPreview = categories.filter(cat => {
    if (!activeMenuId) return true;
    if (activeMenuId === defaultMenuId) {
      return cat.menu_id === activeMenuId || cat.menu_id === null;
    }
    return cat.menu_id === activeMenuId;
  });

  if (!activeRestaurantId) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-md text-red-700">
        Error: No se ha especificado un identificador de restaurante válido.
      </div>
    );
  }

  if (loading && menus.length === 0) return <p className="text-gray-500 text-xs">Cargando menús...</p>;

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
      
      {message.text && (
        <div className={`p-2.5 mb-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
          message.type === 'error' 
            ? 'bg-rose-50 border border-rose-100 text-rose-700' 
            : 'bg-emerald-50 border border-emerald-100 text-emerald-700'
        }`}>
          {message.type === 'error' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4 text-rose-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {message.text}
        </div>
      )}

      {/* Grid of Two zones: Left Management, Right Mockup Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: management list & CTA */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* CTA card / button to create menu */}
          <div>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                const maxOrder = menus.reduce((max, m) => Math.max(max, m.display_order || 0), 0);
                setFormData({
                  name: '',
                  description: '',
                  is_active: true,
                  is_default: false,
                  display_order: maxOrder + 1,
                  icon_text: '',
                  accent_color: '',
                  cover_image_url: ''
                });
                setCoverImageFile(null);
                setCoverImageUrl('');
                setSelectedCategoryIds([]);
                setIsModalOpen(true);
                setMessage({ type: '', text: '' });
              }}
              className="w-full border-2 border-dashed border-indigo-200 rounded-2xl p-6 hover:border-indigo-500 hover:bg-indigo-50/20 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group shadow-xs bg-slate-50/30"
            >
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full group-hover:scale-110 transition-transform">
                <Plus className="h-6 w-6" />
              </div>
              <span className="font-extrabold text-slate-800 text-sm md:text-base">Crear nuevo menú interno</span>
              <span className="text-[11px] text-slate-400 max-w-sm text-center">
                Configura cartas separadas para bebidas, menús ejecutivos o promociones especiales.
              </span>
            </button>
          </div>

          {/* Menus List */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4 text-indigo-600">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.007 8.25H3.75v-.008h.007V15Zm0-3H3.75v-.008h.007V12Z" />
              </svg>
              Lista de Menús Registrados
            </h3>
            
            {menus.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No hay menús registrados.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {menus.map((menu, index) => {
                  const catCount = getCategoriesCount(menu.id);
                  return (
                    <div key={menu.id} className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-slate-800 text-xs md:text-sm">{menu.name}</h4>
                          {menu.is_default && (
                            <span className="px-1.5 py-0.5 inline-flex text-[8px] font-extrabold uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                              Predeterminado
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 inline-flex text-[8px] font-extrabold uppercase tracking-wider rounded ${
                            menu.is_active 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-slate-50 text-slate-500 border border-slate-200'
                          }`}>
                            {menu.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 max-w-xl">
                          {menu.description || <span className="text-slate-300 italic">Sin descripción</span>}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                          <span className="flex items-center gap-1">
                            <Folder className="h-3 w-3 text-slate-450" />
                            {catCount} {catCount === 1 ? 'categoría' : 'categorías'}
                          </span>
                          <span className="flex items-center gap-1">
                            Orden: {menu.display_order}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-end border-t border-slate-50 pt-2.5 md:border-t-0 md:pt-0">
                        {/* Order of menus inside left list */}
                        <div className="flex items-center gap-0.5 mr-1">
                          <button
                            onClick={() => handleMoveMenu(menu, 'up')}
                            disabled={index === 0}
                            className="p-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-md disabled:opacity-30 cursor-pointer"
                            title="Subir orden"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleMoveMenu(menu, 'down')}
                            disabled={index === menus.length - 1}
                            className="p-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-md disabled:opacity-30 cursor-pointer"
                            title="Bajar orden"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>

                        {!menu.is_default && (
                          <>
                            <button
                              onClick={() => handleSetDefault(menu.id)}
                              className="px-2 py-1 text-[10px] border border-indigo-250 text-indigo-700 rounded-lg bg-indigo-50 hover:bg-indigo-100 font-bold transition-colors cursor-pointer"
                            >
                              Establecer Default
                            </button>
                            <button
                              onClick={() => handleToggleActive(menu)}
                              className={`px-2 py-1 text-[10px] rounded-lg transition-colors font-bold border cursor-pointer ${
                                menu.is_active
                                  ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                  : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {menu.is_active ? 'Desactivar' : 'Activar'}
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => setActiveMenuId(menu.id)}
                          className={`px-2 py-1 text-[10px] border rounded-lg font-bold transition-colors cursor-pointer ${
                            activeMenuId === menu.id
                              ? 'bg-indigo-600 text-white border-transparent'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          Ver Preview
                        </button>

                        <button
                          onClick={() => handleEdit(menu)}
                          className="px-2 py-1 text-[10px] border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-bold cursor-pointer bg-white"
                        >
                          Editar
                        </button>

                        {!menu.is_default && (
                          <button
                            onClick={() => handleDeleteMenu(menu)}
                            className="px-2 py-1 text-[10px] rounded-lg bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100 transition-colors font-bold cursor-pointer"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right column: Sticky Phone Mockup Preview */}
        <div className="lg:col-span-5 flex justify-center sticky top-6">
          <div className="w-[330px] h-[640px] bg-slate-950 rounded-[42px] p-3 shadow-2xl border border-slate-800 flex flex-col relative select-none scale-95 sm:scale-100 transition-transform origin-top">
            
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-5.5 bg-slate-950 rounded-b-2xl z-20 flex items-center justify-center gap-1.5 p-1">
              <div className="w-10 h-1 bg-slate-800 rounded-full"></div>
              <div className="w-2 h-2 bg-slate-900 rounded-full border border-slate-850"></div>
            </div>
            
            {/* Screen */}
            <div 
              className="flex-1 rounded-[30px] overflow-hidden border border-slate-900 flex flex-col pt-3 relative z-0 transition-all duration-500"
              style={{
                background: restaurant?.background_url 
                  ? `url(${restaurant.background_url}) center/cover no-repeat` 
                  : (activeMenuId === null 
                      ? `linear-gradient(180deg, ${hexToRgba(restaurant?.primary_color || '#4f46e5', 0.08)} 0%, #ffffff 35%, #f8fafc 100%)`
                      : `linear-gradient(180deg, ${hexToRgba(restaurant?.primary_color || '#4f46e5', 0.04)} 0%, #ffffff 25%, #f8fafc 100%)`),
              }}
            >
              
              {/* Background image overlay layer for glassmorphism inside mockup */}
              {restaurant?.background_url && (
                <div 
                  className={`absolute inset-0 -z-10 pointer-events-none transition-all duration-500 ${
                    activeMenuId === null ? 'bg-white/80 backdrop-blur-[5px]' : 'bg-white/96 backdrop-blur-[8px]'
                  }`} 
                />
              )}

              {/* Dynamic identity background wrapper inside Mockup */}
              {!restaurant?.background_url && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 select-none">
                  <div 
                    className="absolute inset-0 opacity-[0.04] transition-all duration-500" 
                    style={{ 
                      background: `radial-gradient(circle at 10% 20%, ${restaurant?.primary_color || '#4f46e5'} 0%, transparent 80%)` 
                    }}
                  />
                  <div 
                    className="absolute -top-20 -left-20 w-48 h-48 rounded-full blur-[40px] transition-all duration-700"
                    style={{ 
                      backgroundColor: restaurant?.primary_color || '#4f46e5',
                      opacity: activeMenuId === null ? 0.08 : 0.04
                    }}
                  />
                  <div 
                    className="absolute top-1/2 -right-20 w-52 h-52 rounded-full blur-[45px] transition-all duration-700 -translate-y-1/2"
                    style={{ 
                      backgroundColor: restaurant?.primary_color || '#4f46e5',
                      opacity: activeMenuId === null ? 0.07 : 0.03
                    }}
                  />
                </div>
              )}

              {/* Header mockup */}
              <div className={`px-4 py-3 border-b border-slate-100/80 flex flex-col items-center text-center flex-shrink-0 z-10 ${
                activeMenuId === null && restaurant?.background_url 
                  ? 'bg-transparent border-transparent pt-6' 
                  : 'bg-white/95 backdrop-blur-3xs'
              }`}>
                {(() => {
                  const isHome = activeMenuId === null;
                  const logoSizeClass = isHome ? "w-16 h-16" : "w-10 h-10";
                  return (
                    <div className="relative inline-block mb-1">
                      {restaurant?.logo_url ? (
                        <img 
                          src={restaurant.logo_url} 
                          alt="Logo" 
                          className={`${logoSizeClass} rounded-full object-contain shadow-xs p-0.5 bg-white border transition-all duration-300`} 
                          style={{ borderColor: hexToRgba(restaurant?.primary_color || '#4f46e5', 0.25) }}
                        />
                      ) : (
                        <div 
                          className={`${logoSizeClass} rounded-full flex items-center justify-center font-extrabold transition-all duration-300 border`}
                          style={{ 
                            backgroundColor: hexToRgba(restaurant?.primary_color || '#4f46e5', 0.1), 
                            color: restaurant?.primary_color || '#4f46e5',
                            borderColor: hexToRgba(restaurant?.primary_color || '#4f46e5', 0.25),
                            fontSize: isHome ? '18px' : '12px'
                          }}
                        >
                          {restaurant?.name?.[0] || 'M'}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <h4 className="font-extrabold text-slate-800 text-[11px] truncate max-w-[220px]">{restaurant?.name || 'Mi Restaurante'}</h4>
                {activeMenuId !== null && (
                  <div className="text-[10px] font-bold mt-0.5" style={{ color: restaurant?.primary_color || '#4f46e5' }}>
                    {menus.find(m => m.id === activeMenuId)?.name}
                  </div>
                )}
              </div>

              {(() => {
                const currentM = menus.find(m => m.id === activeMenuId);
                if (currentM && !currentM.is_active) {
                  return (
                    <div className="bg-amber-500 text-white text-[9px] font-bold py-1.5 px-3 text-center flex items-center justify-center gap-1 select-none">
                      <AlertCircle className="h-3.5 w-3.5 text-white flex-shrink-0" />
                      <span>Menú inactivo (Sólo vista previa)</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Mockup screen content: Cover/Index Screen or Menu Detail View */}
              {activeMenuId === null ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar flex flex-col justify-start bg-transparent">
                  <div className="text-center space-y-1 py-3 bg-white/60 rounded-xl border border-slate-100/50 backdrop-blur-2xs mb-2">
                    <span className="text-[9px] uppercase font-extrabold tracking-widest text-slate-450">
                      Selecciona una carta
                    </span>
                    <h5 className="font-black text-slate-800 text-[11px] uppercase tracking-tight">Nuestras Cartas</h5>
                  </div>
                  
                  {menus.filter(m => m.is_active).length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-5 my-auto">
                      <Folder className="h-6 w-6 text-slate-300 mb-1" />
                      <p className="text-[10px] text-slate-455 font-bold italic">No hay menús internos activos.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-fade-in">
                      {menus.filter(m => m.is_active).map((menu, menuIdx, activeArr) => {
                        const accent = menu.accent_color || restaurant?.primary_color || '#4f46e5';
                        const hasCover = menu.cover_image_url && !failedImages.has(menu.id);
                        const cardStyles = hasCover 
                          ? { 
                              boxShadow: `0 4px 15px -3px ${hexToRgba(accent, 0.25)}`,
                              borderColor: hexToRgba(accent, 0.15)
                            }
                          : {
                              borderColor: hexToRgba(accent, 0.15),
                              borderLeftColor: accent,
                              boxShadow: `0 4px 15px -3px ${hexToRgba(accent, 0.1)}`
                            };

                        return (
                          <div
                            key={menu.id}
                            onClick={() => setActiveMenuId(menu.id)}
                            className={`relative overflow-hidden rounded-xl border transition-all duration-300 active:scale-98 flex items-center justify-between gap-3 group cursor-pointer ${
                              hasCover ? 'h-24 p-0' : 'bg-white/95 backdrop-blur-xs p-3 border-l-4'
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
                                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/60 to-transparent z-10" />
                              </>
                            )}
                            
                            <div className={`flex-1 min-w-0 space-y-0.5 relative z-20 ${hasCover ? 'p-3 text-white' : 'text-slate-800'}`}>
                              <div className="flex items-center gap-1.5">
                                {!hasCover ? (
                                  menu.icon_text ? (
                                    <span className="text-base flex-shrink-0">{menu.icon_text}</span>
                                  ) : (
                                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black text-white flex-shrink-0" style={{ backgroundColor: accent }}>
                                      {menu.name.charAt(0).toUpperCase()}
                                    </div>
                                  )
                                ) : (
                                  menu.icon_text && <span className="text-xs flex-shrink-0">{menu.icon_text}</span>
                                )}
                                <h6 className={`font-extrabold text-[10px] truncate transition-colors ${
                                  hasCover ? 'text-white' : 'text-slate-800 group-hover:text-indigo-650'
                                }`}>
                                  {menu.name}
                                </h6>
                              </div>
                              {menu.description && (
                                <p className={`text-[8px] line-clamp-2 leading-tight ${
                                  hasCover ? 'text-slate-200' : 'text-slate-500'
                                }`}>
                                  {menu.description}
                                </p>
                              )}
                            </div>
                            
                            {/* Up/Down buttons to reorder menus inside preview cover */}
                            <div className={`flex items-center gap-0.5 flex-shrink-0 pl-1.5 pr-2.5 relative z-10 transition-all ${
                              hasCover ? 'border-l border-white/20 text-white' : 'border-l border-slate-100/50 pl-1.5 opacity-60 hover:opacity-100'
                            }`}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveMenu(menu, 'up', true);
                                }}
                                disabled={menuIdx === 0}
                                className={`p-0.5 border rounded transition-all disabled:opacity-10 cursor-pointer ${
                                  hasCover 
                                    ? 'border-white/10 bg-white/10 hover:bg-white/20 text-white' 
                                    : 'border-slate-100/70 bg-white/60 hover:bg-white text-slate-400 hover:text-slate-650'
                                }`}
                                title="Subir orden"
                              >
                                <ArrowUp className="h-2 w-2" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveMenu(menu, 'down', true);
                                }}
                                disabled={menuIdx === activeArr.length - 1}
                                className={`p-0.5 border rounded transition-all disabled:opacity-10 cursor-pointer ${
                                  hasCover 
                                    ? 'border-white/10 bg-white/10 hover:bg-white/20 text-white' 
                                    : 'border-slate-100/70 bg-white/60 hover:bg-white text-slate-400 hover:text-slate-650'
                                }`}
                                title="Bajar orden"
                              >
                                <ArrowDown className="h-2 w-2" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Detail View in Telephone mockup */
                <div className="flex-1 overflow-y-auto p-2.5 space-y-3.5 no-scrollbar flex flex-col pt-2 relative">
                  
                  {/* Back to index cover button inside mockup */}
                  {menus.filter(m => m.is_active).length >= 2 && (
                    <div className="pb-1 border-b border-slate-100/60 flex items-center flex-shrink-0">
                      <button
                        onClick={() => setActiveMenuId(null)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md text-[9px] font-extrabold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-3xs transition-all active:scale-95"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-2.5 h-2.5 text-slate-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                        </svg>
                        <span>Volver a Menús</span>
                      </button>
                    </div>
                  )}

                  {/* Categories horizontal bar in Mockup */}
                  {visibleCategoriesForPreview.length > 1 && (
                    <div className="flex overflow-x-auto no-scrollbar gap-1.5 py-1.5 px-2 bg-white/95 backdrop-blur-3xs sticky top-0 z-10 flex-shrink-0 border-b border-slate-100/50 -mx-2.5 -mt-2">
                      {visibleCategoriesForPreview.map(cat => (
                        <a
                          key={`mockup-nav-${cat.id}`}
                          href={`#mockup-cat-${cat.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            const el = document.getElementById(`mockup-cat-${cat.id}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }
                          }}
                          className="whitespace-nowrap px-2.5 py-1 rounded-full text-[8px] font-extrabold transition-colors select-none border border-transparent"
                          style={{
                            backgroundColor: hexToRgba(restaurant?.primary_color || '#4f46e5', 0.04),
                            color: restaurant?.primary_color || '#4f46e5',
                            borderColor: hexToRgba(restaurant?.primary_color || '#4f46e5', 0.12)
                          }}
                        >
                          {cat.name}
                        </a>
                      ))}
                    </div>
                  )}

                  {visibleCategoriesForPreview.length === 0 ? (
                    <div className="h-full flex-1 flex flex-col items-center justify-center text-center p-5 my-auto">
                      <Folder className="h-6 w-6 text-slate-350 mb-1" />
                      <p className="text-[10px] text-slate-400 font-semibold italic">Este menú no tiene categorías asignadas.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {visibleCategoriesForPreview.map((cat, catIdx) => (
                        <div key={cat.id} id={`mockup-cat-${cat.id}`} className="space-y-2 scroll-mt-6">
                          
                          {/* Category Header with Up/Down buttons */}
                          <div className="flex items-center justify-between pb-1 border-b border-slate-200/50">
                            <span className="font-extrabold text-[10px] text-slate-800 uppercase tracking-wider">{cat.name}</span>
                            <div className="flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleMoveCategory(cat, 'up')}
                                disabled={catIdx === 0}
                                className="p-0.5 border border-slate-100/70 bg-white/60 hover:bg-white text-slate-400 hover:text-slate-650 rounded transition-all disabled:opacity-10 cursor-pointer"
                                title="Subir categoría"
                              >
                                <ArrowUp className="h-2 w-2" />
                              </button>
                              <button
                                onClick={() => handleMoveCategory(cat, 'down')}
                                disabled={catIdx === visibleCategoriesForPreview.length - 1}
                                className="p-0.5 border border-slate-100/70 bg-white/60 hover:bg-white text-slate-400 hover:text-slate-650 rounded transition-all disabled:opacity-10 cursor-pointer"
                                title="Bajar categoría"
                              >
                                <ArrowDown className="h-2 w-2" />
                              </button>
                            </div>
                          </div>

                          {/* Products list inside preview mockup */}
                          <div className="space-y-1.5">
                            {(cat.products || []).length === 0 ? (
                              <p className="text-[9px] text-slate-400 italic pl-0.5">Sin productos asignados.</p>
                            ) : (
                              cat.products
                                .filter(p => p.availability_status !== 'hidden')
                                .map((prod, prodIdx) => {
                                  const hasImage = !!prod.image_url;
                                  const isSoldOut = prod.availability_status === 'sold_out';
                                  const visibleProdsCount = cat.products.filter(p => p.availability_status !== 'hidden').length;
                                  
                                  return (
                                    <div key={prod.id} className="bg-white border border-slate-100 rounded-lg p-2 shadow-2xs flex gap-2 items-center relative overflow-hidden">
                                      {hasImage && (
                                        <div className="w-8 h-8 rounded bg-slate-50 flex-shrink-0 relative border border-slate-100 overflow-hidden">
                                          <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                                        </div>
                                      )}
                                      
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <h5 className="font-extrabold text-slate-750 text-[10px] truncate leading-tight">{prod.name}</h5>
                                          {isSoldOut && (
                                            <span className="px-1 py-0.2 inline-flex text-[6px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100 rounded">
                                              Agotado
                                            </span>
                                          )}
                                        </div>
                                        {prod.description && (
                                          <p className="text-[8px] text-slate-450 line-clamp-1 leading-normal mt-0.5">{prod.description}</p>
                                        )}
                                        {isSoldOut && prod.availability_note && (
                                          <p className="text-[8px] text-amber-600 font-medium italic mt-0.5">
                                            Nota: {prod.availability_note}
                                          </p>
                                        )}
                                        <span className="text-[9px] font-extrabold block mt-0.5" style={{ color: restaurant?.primary_color || '#4f46e5' }}>
                                          {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(prod.price || 0)}
                                        </span>
                                      </div>

                                      {/* Product reorder buttons */}
                                      <div className="flex flex-col gap-0.5 flex-shrink-0 border-l border-slate-100/50 pl-1 opacity-60 hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleMoveProduct(cat, prod, 'up')}
                                          disabled={prodIdx === 0}
                                          className="p-0.5 border border-slate-100/70 bg-white/60 hover:bg-white text-slate-400 hover:text-slate-650 rounded transition-all disabled:opacity-10 cursor-pointer"
                                          title="Subir producto"
                                        >
                                          <ArrowUp className="h-2 w-2" />
                                        </button>
                                        <button
                                          onClick={() => handleMoveProduct(cat, prod, 'down')}
                                          disabled={prodIdx === visibleProdsCount - 1}
                                          className="p-0.5 border border-slate-100/70 bg-white/60 hover:bg-white text-slate-400 hover:text-slate-650 rounded transition-all disabled:opacity-10 cursor-pointer"
                                          title="Bajar producto"
                                        >
                                          <ArrowDown className="h-2 w-2" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                          </div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Nav Bar in Mockup */}
              {activeMenuId !== null && (() => {
                const activeMs = menus.filter(m => m.is_active);
                if (activeMs.length < 2) return null;
                const half = Math.ceil(activeMs.length / 2);
                const left = activeMs.slice(0, half);
                const right = activeMs.slice(half);
                return (
                  <div className="bg-white/95 backdrop-blur-3xs border-t flex items-center justify-between px-2 py-1.5 h-12 flex-shrink-0 z-10" style={{ borderTopColor: hexToRgba(restaurant?.primary_color || '#4f46e5', 0.25) }}>
                    {/* Left Mockup Menus */}
                    <div className="flex-1 flex justify-around gap-1 overflow-x-auto no-scrollbar">
                      {left.map(m => {
                        const isActive = m.id === activeMenuId;
                        const accent = m.accent_color || restaurant?.primary_color || '#4f46e5';
                        const displayName = m.name.length > 12 ? `${m.name.slice(0, 10)}...` : m.name;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setActiveMenuId(m.id)}
                            className={`px-1.5 py-1 rounded text-[8px] font-extrabold truncate max-w-[55px] cursor-pointer text-center ${
                              isActive ? 'text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent'
                            }`}
                            style={isActive ? { backgroundColor: accent } : {}}
                          >
                            {m.icon_text ? `${m.icon_text} ` : ''}{displayName}
                          </button>
                        );
                      })}
                    </div>

                    {/* Center Mockup Home Button */}
                    <div className="flex-shrink-0 px-1.5">
                      <button
                        onClick={() => setActiveMenuId(null)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm active:scale-95 transition-transform hover:brightness-105 cursor-pointer"
                        style={{ backgroundColor: restaurant?.primary_color || '#4f46e5' }}
                        title="Inicio"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M11.47 3.84a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 1-1.06 1.06l-.22-.22v7.13a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75V13.37l-.22.22a.75.75 0 1 1-1.06-1.06l8.69-8.69Z" />
                        </svg>
                      </button>
                    </div>

                    {/* Right Mockup Menus */}
                    <div className="flex-1 flex justify-around gap-1 overflow-x-auto no-scrollbar">
                      {right.map(m => {
                        const isActive = m.id === activeMenuId;
                        const accent = m.accent_color || restaurant?.primary_color || '#4f46e5';
                        const displayName = m.name.length > 12 ? `${m.name.slice(0, 10)}...` : m.name;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setActiveMenuId(m.id)}
                            className={`px-1.5 py-1 rounded text-[8px] font-extrabold truncate max-w-[55px] cursor-pointer text-center ${
                              isActive ? 'text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent'
                            }`}
                            style={isActive ? { backgroundColor: accent } : {}}
                          >
                            {m.icon_text ? `${m.icon_text} ` : ''}{displayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Home Indicator */}
              <div className="h-4 bg-white flex justify-center items-center pb-1 flex-shrink-0">
                <div className="w-20 h-1 bg-slate-300 rounded-full"></div>
              </div>
            </div>
            
          </div>
        </div>

      </div>

      {/* Modal de Creación / Edición */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-4xl w-full overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
            
            {/* Form Column */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[90vh]">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  {editingId ? 'Editar Menú Interno' : 'Crear Menú Interno'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Nombre *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Ej: Carta de Vinos, Coctelería"
                      className="w-full rounded-md border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 border transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Descripción</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Ej: Disponible de Lunes a Viernes"
                      rows="2"
                      className="w-full rounded-md border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 border transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Orden de visualización</label>
                      <input
                        type="number"
                        name="display_order"
                        value={formData.display_order}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full rounded-md border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 border transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-6 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-650">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_default || (menus.length === 1 && menus[0].id === editingId) ? true : formData.is_active}
                        onChange={handleInputChange}
                        disabled={formData.is_default || (menus.length === 1 && menus[0].id === editingId) || (menus.length === 0)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4 disabled:opacity-50"
                      />
                      Activo
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-650">
                      <input
                        type="checkbox"
                        name="is_default"
                        checked={formData.is_default || (menus.length === 1 && menus[0].id === editingId) || (menus.length === 0)}
                        onChange={handleInputChange}
                        disabled={formData.is_default || (menus.length === 1 && menus[0].id === editingId) || (menus.length === 0)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4 disabled:opacity-50"
                      />
                      Predeterminado (Carta Principal)
                    </label>
                  </div>
                </div>

                {/* Diseño de la card */}
                <div className="border-t border-slate-100 pt-3">
                  <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Diseño de la card
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-3">
                    Esta personalización se verá en la portada del menú QR.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Icon text / Emoji */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ícono o emoji</label>
                      <input
                        type="text"
                        name="icon_text"
                        value={formData.icon_text}
                        onChange={handleInputChange}
                        placeholder="Ej: 🍷, 🍽️, 👶, ⭐"
                        className="w-full rounded-md border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 border transition-all"
                      />
                    </div>

                    {/* Accent Color */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Color de acento</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          name="accent_color"
                          value={formData.accent_color || restaurant?.primary_color || '#4f46e5'}
                          onChange={handleInputChange}
                          className="h-8 w-8 p-0.5 border border-slate-200 cursor-pointer bg-white rounded-md flex-shrink-0"
                        />
                        <input
                          type="text"
                          name="accent_color"
                          value={formData.accent_color}
                          onChange={handleInputChange}
                          placeholder={restaurant?.primary_color || '#4f46e5'}
                          className="block w-full rounded-md border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs p-1.5 border transition-all font-mono uppercase"
                        />
                        {formData.accent_color && (
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, accent_color: '' }))}
                            className="text-[10px] text-slate-400 hover:text-slate-650 font-bold border border-slate-200 rounded px-2 py-1 bg-white hover:bg-slate-50 transition-colors"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Cover Image Upload */}
                  <div className="mt-3">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Imagen de card</label>
                    <div className="flex items-center gap-4 mt-1">
                      {coverImageFile || coverImageUrl ? (
                        <div className="relative h-16 w-24 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {coverImageFile ? (
                            <span className="text-[9px] text-indigo-600 font-bold p-1 text-center truncate">{coverImageFile.name}</span>
                          ) : (
                            <img src={coverImageUrl} alt="Cover" className="h-full w-full object-cover" />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setCoverImageUrl('');
                              setCoverImageFile(null);
                            }}
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-650 text-white rounded-full p-0.5 shadow-sm transition-colors cursor-pointer"
                            title="Quitar imagen"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="h-16 w-24 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider text-center px-1">Sin imagen</span>
                        </div>
                      )}
                      <div>
                        <label htmlFor="cover-upload" className="cursor-pointer inline-flex items-center gap-1.5 bg-white py-1.5 px-3 border border-slate-200 rounded-lg shadow-sm text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                          <Upload className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          {coverImageFile ? 'Cambiar' : 'Subir imagen'}
                        </label>
                        <input id="cover-upload" name="cover-upload" type="file" className="sr-only" onChange={(e) => {
                          if (e.target.files.length > 0) {
                            setCoverImageFile(e.target.files[0]);
                          }
                        }} accept="image/png, image/jpeg, image/webp" />
                        <p className="text-[9px] text-slate-400 mt-1">PNG, JPG o WebP. Máx 5MB.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Categories Selection */}
                <div className="border-t border-slate-100 pt-3">
                  <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Categorías dentro de este menú
                  </h4>
                  <div className="text-[10px] text-slate-500 mb-2 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100 flex items-start gap-1">
                    <AlertCircle className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <span>Una categoría solo puede pertenecer a un menú interno a la vez. Si la mueves aquí, dejará de mostrarse en su menú anterior.</span>
                  </div>

                  {categories.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">No hay categorías registradas en el restaurante.</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-2 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                      {categories.map(cat => {
                        const belongsToThisMenu = cat.menu_id === editingId && editingId !== null;
                        const otherMenu = menus.find(m => m.id === cat.menu_id);
                        const isChecked = selectedCategoryIds.includes(cat.id);
                        
                        return (
                          <label key={cat.id} className="flex items-center justify-between text-xs text-slate-650 hover:bg-white p-1.5 rounded cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleCategoryToggle(cat.id)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                              />
                              <span className="font-bold text-slate-700">{cat.name}</span>
                            </span>
                            {!belongsToThisMenu && otherMenu && (
                              <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 border border-slate-200/50 rounded px-1.5 py-0.5">
                                En: {otherMenu.name}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex justify-center items-center gap-1 py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                        Guardando...
                      </>
                    ) : (editingId ? 'Guardar Cambios' : 'Crear Menú')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>

            {/* Visual Preview Column inside Modal */}
            <div className="w-full md:w-80 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-100 p-6 flex flex-col justify-start max-h-[90vh] overflow-y-auto">
              <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5 text-indigo-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                Vista previa
              </h4>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 w-full flex-1 flex flex-col min-h-[300px]">
                <div className="pb-3 border-b border-slate-100 text-center">
                  <h5 className="font-extrabold text-slate-800 text-xs md:text-sm">
                    {formData.name.trim() || <span className="text-slate-350 italic">Nombre del Menú</span>}
                  </h5>
                  {formData.description.trim() && (
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 italic">{formData.description.trim()}</p>
                  )}
                </div>

                <div className="mt-4 flex-1 flex flex-col justify-start">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Categorías visibles</span>
                  {selectedCategoryIds.length === 0 ? (
                    <div className="flex-1 border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center my-auto">
                      <span className="text-[10px] text-slate-400 font-semibold italic">Sin categorías asignadas.</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {categories
                        .filter(c => selectedCategoryIds.includes(c.id))
                        .map(cat => (
                          <span key={cat.id} className="px-2 py-1 text-[9px] font-extrabold rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700">
                            {cat.name}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-slate-100 pt-3 flex justify-between items-center text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                  <span>Mesio Menú Digital</span>
                  {formData.is_default && (
                    <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Predeterminado</span>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}