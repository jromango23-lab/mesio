import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export default function ProductsManager({ restaurantId, targetRestaurantId }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image_url: '',
    category_id: ''
  });
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [uploadingImage, setUploadingImage] = useState(false);

  const activeRestaurantId = targetRestaurantId || restaurantId;

  // Filter/Sort/Pagination States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormCollapsed, setIsFormCollapsed] = useState(true);

  // Reset selection when filters, page, or restaurant changes
  useEffect(() => {
    setSelectedProductIds([]);
  }, [searchTerm, selectedCategory, sortBy, currentPage, activeRestaurantId]);

  // Go to page 1 when filter options are updated
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, sortBy]);

  // Locally filtered and sorted products list
  const filteredAndSortedProducts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const result = products.filter(p => {
      const nameMatch = p.name.toLowerCase().includes(search);
      const descMatch = (p.description || '').toLowerCase().includes(search);
      const matchesSearch = !search || nameMatch || descMatch;
      const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'price-asc') {
        return Number(a.price || 0) - Number(b.price || 0);
      }
      if (sortBy === 'price-desc') {
        return Number(b.price || 0) - Number(a.price || 0);
      }
      return 0;
    });
  }, [products, searchTerm, selectedCategory, sortBy]);

  // Keep page number valid if products list decreases
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredAndSortedProducts.length / 20));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [filteredAndSortedProducts.length, currentPage]);

  const itemsPerPage = 20;
  const totalFilteredCount = filteredAndSortedProducts.length;
  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage) || 1;
  const visibleProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedProducts.slice(start, start + itemsPerPage);
  }, [filteredAndSortedProducts, currentPage]);

  useEffect(() => {
    if (!activeRestaurantId) return;

    const fetchData = async () => {
      setLoading(true);
      setSelectedProductIds([]); // Limpiar selección al cambiar de restaurante o recargar
      // Fetch categories
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', activeRestaurantId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (!catError && catData) {
        setCategories(catData);
        
        // Si hay categorías, buscamos los productos que pertenecen a ellas
        if (catData.length > 0) {
          const categoryIds = catData.map(c => c.id);
          const { data: prodData, error: prodError } = await supabase
            .from('products')
            .select('*, categories(name)')
            .in('category_id', categoryIds)
            .order('created_at', { ascending: false });

          if (!prodError && prodData) {
            setProducts(prodData);
          }
        } else {
          setProducts([]); // Si no hay categorías, no hay productos que mostrar
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [activeRestaurantId]);

  const handleImageUpload = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;

      setUploadingImage(true);
      setMessage({ type: '', text: '' });

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${activeRestaurantId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, image_url: data.publicUrl }));
      setMessage({ type: 'success', text: 'Imagen subida correctamente.' });
    } catch (error) {
      console.error('Error uploading image:', error);
      setMessage({ type: 'error', text: 'Error al subir la imagen: ' + error.message });
    } finally {
      setUploadingImage(false);
      // Reseteamos el valor del input file para permitir subir el mismo archivo si es necesario
      e.target.value = '';
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (product) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price || '',
      image_url: product.image_url || '',
      category_id: product.category_id
    });
    setIsFormCollapsed(false);
    setMessage({ type: '', text: '' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      image_url: '',
      category_id: ''
    });
    setIsFormCollapsed(true);
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const resolvedCategoryId = formData.category_id || (categories.length > 0 ? categories[0].id : '');
    
    if (!formData.name.trim() || !resolvedCategoryId) {
      setMessage({ type: 'error', text: 'El nombre y la categoría son obligatorios.' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    const productPayload = {
      category_id: resolvedCategoryId,
      name: formData.name.trim(),
      description: formData.description.trim(),
      price: parseFloat(formData.price) || 0,
      image_url: formData.image_url.trim()
    };

    if (editingId) {
      // Update
      const { data, error } = await supabase
        .from('products')
        .update(productPayload)
        .eq('id', editingId)
        .select('*, categories(name)');

      if (error) {
        setMessage({ type: 'error', text: 'Error al actualizar el producto: ' + error.message });
      } else if (data) {
        setProducts(products.map(p => p.id === editingId ? data[0] : p));
        setMessage({ type: 'success', text: 'Producto actualizado exitosamente.' });
        handleCancelEdit();
      }
    } else {
      // Create
      const { data, error } = await supabase
        .from('products')
        .insert([productPayload])
        .select('*, categories(name)');

      if (error) {
        setMessage({ type: 'error', text: 'Error al crear el producto: ' + error.message });
      } else if (data) {
        setProducts([data[0], ...products]);
        setMessage({ type: 'success', text: 'Producto creado exitosamente.' });
        handleCancelEdit();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      setMessage({ type: 'error', text: 'Error al eliminar el producto: ' + error.message });
    } else {
      setProducts(products.filter(p => p.id !== id));
      setSelectedProductIds(prev => prev.filter(item => item !== id));
      setMessage({ type: 'success', text: 'Producto eliminado.' });
    }
  };

  const handleSelectToggle = (id) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllToggle = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map(p => p.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedProductIds.length === 0) return;

    if (!window.confirm(`¿Seguro que quieres eliminar los ${selectedProductIds.length} productos seleccionados?`)) {
      return;
    }

    setDeletingMultiple(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', selectedProductIds);

      if (error) {
        setMessage({ type: 'error', text: 'Error al eliminar productos seleccionados: ' + error.message });
      } else {
        setProducts(prev => prev.filter(p => !selectedProductIds.includes(p.id)));
        setSelectedProductIds([]);
        setMessage({ type: 'success', text: 'Productos seleccionados eliminados correctamente.' });
      }
    } catch (err) {
      console.error('Error deleting selected products:', err);
      setMessage({ type: 'error', text: 'Ocurrió un error inesperado al intentar eliminar los productos.' });
    } finally {
      setDeletingMultiple(false);
    }
  };

  if (!activeRestaurantId) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-md text-red-700">
        Error: No se ha especificado un identificador de restaurante válido.
      </div>
    );
  }

  if (loading) return <p className="text-gray-500">Cargando datos...</p>;

  const defaultCategoryId = formData.category_id || (categories.length > 0 ? categories[0].id : '');

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
      <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Gestión de Productos
      </h2>

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

      {categories.length === 0 ? (
        <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-lg mb-4 text-xs text-amber-700 font-semibold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Debes crear al menos una categoría antes de poder agregar productos.</span>
        </div>
      ) : (
        <div className="mb-6 border border-slate-100 rounded-lg p-4 bg-slate-50/50">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {editingId ? 'Editar Producto' : 'Añadir Nuevo Producto'}
            </h3>
            <button
              type="button"
              onClick={() => setIsFormCollapsed(!isFormCollapsed)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
            >
              {isFormCollapsed ? (
                <>
                  Mostrar formulario
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              ) : (
                <>
                  Ocultar formulario
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
          
          {!isFormCollapsed && (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Nombre *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full rounded-md border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 border transition-all"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Categoría *</label>
                  <select
                    name="category_id"
                    value={defaultCategoryId}
                    onChange={handleInputChange}
                    className="w-full rounded-md border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 border transition-all"
                    required
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Precio</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    className="w-full rounded-md border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 border transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Imagen del Producto</label>
                  <div className="flex flex-col gap-2 bg-white p-2 border border-slate-200 rounded-md">
                    {formData.image_url ? (
                      <div className="relative w-full h-24 bg-slate-50 rounded border border-slate-200 flex items-center justify-center overflow-hidden">
                        <img src={formData.image_url} alt="Vista previa" className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                          className="absolute top-1 right-1 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:bg-rose-600 shadow transition-colors cursor-pointer"
                          title="Eliminar imagen"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 transition-colors"
                        />
                        {uploadingImage && <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                          <svg className="animate-spin h-3.5 w-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Subiendo imagen...
                        </span>}
                      </div>
                    )}
                    <div className="border-t border-slate-100 pt-1">
                      <input
                        type="url"
                        name="image_url"
                        value={formData.image_url}
                        onChange={handleInputChange}
                        placeholder="O pega URL de imagen (ej: https://...)"
                        disabled={uploadingImage}
                        className="w-full rounded border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-[10px] p-1.5 border transition-all disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Descripción</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="2"
                  className="w-full rounded-md border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs p-2 border transition-all"
                ></textarea>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="inline-flex justify-center items-center gap-1 py-1.5 px-3 border border-transparent rounded-md shadow-sm text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                      Guardando...
                    </>
                  ) : (editingId ? 'Actualizar Producto' : 'Añadir Producto')}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        Lista de Productos
      </h3>

      <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg mb-4 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Buscar</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nombre o descripción..."
              className="w-full rounded border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs px-2 py-1.5 border transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Categoría</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs px-2 py-1.5 border transition-all"
            >
              <option value="">Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Ordenar por</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded border-slate-200 bg-white hover:bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs px-2 py-1.5 border transition-all"
            >
              <option value="name-asc">Nombre (A-Z)</option>
              <option value="name-desc">Nombre (Z-A)</option>
              <option value="price-asc">Precio (Menor a Mayor)</option>
              <option value="price-desc">Precio (Mayor a Menor)</option>
            </select>
          </div>

          <div className="flex items-end">
            {(searchTerm || selectedCategory || sortBy !== 'name-asc') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                  setSortBy('name-asc');
                }}
                className="w-full text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 py-1.5 px-3 rounded border border-indigo-100 transition-colors cursor-pointer text-center"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>
      
      {visibleProducts.length > 0 && (
        <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 mb-3 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllToggle}
              className="text-[10px] bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5 rounded-md text-slate-700 font-bold shadow-sm transition-colors cursor-pointer"
            >
              {visibleProducts.every(p => selectedProductIds.includes(p.id)) ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            <span className="text-[10px] text-slate-500 font-semibold">
              {selectedProductIds.length} seleccionado{selectedProductIds.length !== 1 ? 's' : ''} de esta página
            </span>
          </div>

          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedProductIds.length === 0 || deletingMultiple}
            className="text-[10px] bg-rose-50 border border-rose-100 hover:bg-rose-100 disabled:opacity-50 text-rose-700 px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1"
          >
            {deletingMultiple ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-rose-700"></div>
                Eliminando...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar seleccionados
              </>
            )}
          </button>
        </div>
      )}

      {visibleProducts.length === 0 ? (
        <div className="text-center py-6 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" className="mx-auto h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-1.5 text-xs font-semibold text-slate-500">No se encontraron productos</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Prueba cambiando la búsqueda o los filtros.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-slate-100 rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left w-10">
                    <input
                      type="checkbox"
                      checked={visibleProducts.length > 0 && visibleProducts.every(p => selectedProductIds.includes(p.id))}
                      onChange={handleSelectAllToggle}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5"
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider">Categoría</th>
                  <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider">Precio</th>
                  <th className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {visibleProducts.map(product => {
                  const isSelected = selectedProductIds.includes(product.id);
                  return (
                    <tr key={product.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectToggle(product.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {product.image_url ? (
                            <div className="flex-shrink-0 h-8 w-8">
                              <img className="h-8 w-8 rounded-md object-cover border border-slate-200/80 p-0.5 bg-white shadow-sm" src={product.image_url} alt="" />
                            </div>
                          ) : (
                            <div className="flex-shrink-0 h-8 w-8 bg-slate-100 border border-slate-200/60 rounded-md flex items-center justify-center text-[9px] text-slate-400 font-bold uppercase tracking-wider shadow-inner">
                              Sin Foto
                            </div>
                          )}
                          <div>
                            <div className="text-xs font-bold text-slate-800">{product.name}</div>
                            {product.description && (
                              <div className="text-[10px] text-slate-500 truncate max-w-[150px] font-normal mt-0.5" title={product.description}>{product.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 inline-flex text-[9px] font-bold uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {product.categories?.name || 'Sin categoría'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-700">
                        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(product.price || 0)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-semibold space-x-1">
                        <button
                          onClick={() => handleEdit(product)}
                          className="px-2 py-0.5 border border-slate-200 text-slate-700 rounded hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 rounded hover:bg-rose-100 transition-colors shadow-sm cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
            <span className="text-[10px] text-slate-500 font-semibold">
              Mostrando {Math.min(totalFilteredCount, (currentPage - 1) * itemsPerPage + 1)}–{Math.min(totalFilteredCount, currentPage * itemsPerPage)} de {totalFilteredCount} producto{totalFilteredCount !== 1 ? 's' : ''}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="inline-flex justify-center items-center p-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer"
                title="Anterior"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <span className="text-xs font-semibold text-slate-700 bg-slate-50 px-3 py-1 rounded border border-slate-200">
                Página {currentPage} de {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex justify-center items-center p-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer"
                title="Siguiente"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}