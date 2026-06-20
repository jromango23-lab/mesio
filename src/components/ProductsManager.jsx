import { useState, useEffect } from 'react';
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
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Gestión de Productos</h2>

      {message.text && (
        <div className={`p-3 mb-4 rounded ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md mb-6">
          <p className="text-yellow-700">Debes crear al menos una categoría antes de poder agregar productos.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mb-8 border border-gray-200 rounded-md p-4 bg-gray-50">
          <h3 className="font-semibold text-gray-700 mb-4">
            {editingId ? 'Editar Producto' : 'Añadir Nuevo Producto'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
              <select
                name="category_id"
                value={defaultCategoryId}
                onChange={handleInputChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white"
                required
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                step="0.01"
                min="0"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imagen del Producto</label>
              <div className="flex flex-col gap-2">
                {formData.image_url && (
                  <div className="relative w-full h-32 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                    <img src={formData.image_url} alt="Vista previa" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 shadow-sm"
                      title="Eliminar imagen"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {!formData.image_url && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                  />
                )}
                {uploadingImage && <span className="text-sm text-blue-600">Subiendo imagen...</span>}
                <div className="mt-2">
                  <label className="text-xs text-gray-500 mb-1 block">O pega una URL manualmente:</label>
                  <input
                    type="url"
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleInputChange}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    disabled={uploadingImage}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-sm disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows="2"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
            ></textarea>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : (editingId ? 'Actualizar Producto' : 'Añadir Producto')}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {/* Lista de productos */}
      <h3 className="font-semibold text-gray-700 mb-4">Lista de Productos</h3>
      
      {/* Barra de Acciones Masivas */}
      {products.length > 0 && (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAllToggle}
              className="text-xs bg-white border border-gray-300 hover:bg-gray-100 px-2.5 py-1.5 rounded text-gray-700 font-semibold shadow-sm transition-colors cursor-pointer"
            >
              {selectedProductIds.length === products.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            <span className="text-xs text-gray-500 font-medium">
              {selectedProductIds.length} seleccionado{selectedProductIds.length !== 1 ? 's' : ''} de {products.length} productos
            </span>
          </div>

          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedProductIds.length === 0 || deletingMultiple}
            className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3.5 py-1.5 rounded font-semibold shadow-sm transition-colors cursor-pointer flex items-center gap-1"
          >
            {deletingMultiple ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                Eliminando...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar seleccionados
              </>
            )}
          </button>
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No hay productos. Añade uno usando el formulario de arriba.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border rounded-md">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                  <input
                    type="checkbox"
                    checked={products.length > 0 && selectedProductIds.length === products.length}
                    onChange={handleSelectAllToggle}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map(product => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <tr key={product.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectToggle(product.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex items-center">
                        {product.image_url && (
                          <div className="flex-shrink-0 h-10 w-10 mr-4">
                            <img className="h-10 w-10 rounded-full object-cover border border-gray-100 shadow-sm" src={product.image_url} alt="" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">{product.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {product.categories?.name || 'Sin categoría'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(product.price || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4 cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-900 cursor-pointer"
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
      )}
    </div>
  );
}