import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function BrandManager({ restaurant, onBrandUpdate }) {
  const [logoFile, setLogoFile] = useState(null);
  const [primaryColor, setPrimaryColor] = useState(restaurant?.primary_color || '#2563eb');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setLogoFile(e.target.files[0]);
      setSuccess(null);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError(null);
    setSuccess(null);

    let newLogoUrl = restaurant.logo_url;

    try {
      // 1. Si hay un nuevo archivo de logo, subirlo
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${restaurant.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('restaurant-assets')
          .upload(filePath, logoFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Obtener la URL pública del archivo subido
        const { data: publicUrlData } = supabase.storage
          .from('restaurant-assets')
          .getPublicUrl(filePath);

        newLogoUrl = publicUrlData.publicUrl;
      }

      // 2. Actualizar la tabla del restaurante con los nuevos datos
      const { data, error: updateError } = await supabase
        .from('restaurants')
        .update({
          logo_url: newLogoUrl,
          primary_color: primaryColor,
        })
        .eq('id', restaurant.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setSuccess('¡Marca actualizada con éxito!');
      if (onBrandUpdate) {
        onBrandUpdate(data); // Notificar al Dashboard del cambio
      }

    } catch (err) {
      console.error('Error updating brand:', err);
      setError(err.message || 'Ocurrió un error al actualizar la marca.');
    } finally {
      setUploading(false);
      setLogoFile(null); // Reset file input
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-3">Identidad de Marca</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="restaurantName" className="block text-sm font-medium text-gray-700">
            Nombre del Restaurante
          </label>
          <input
            type="text"
            id="restaurantName"
            value={restaurant?.name || ''}
            disabled
            className="mt-1 block w-full bg-gray-100 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Logo Actual
          </label>
          <div className="mt-1 flex items-center gap-4">
            {restaurant?.logo_url ? (
              <img src={restaurant.logo_url} alt="Logo" className="h-16 w-16 object-contain rounded-md bg-gray-100 p-1" />
            ) : (
              <div className="h-16 w-16 bg-gray-100 rounded-md flex items-center justify-center">
                <span className="text-xs text-gray-500">Sin logo</span>
              </div>
            )}
            <div>
              <label htmlFor="logo-upload" className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                {logoFile ? 'Archivo seleccionado' : 'Cambiar logo'}
              </label>
              <input id="logo-upload" name="logo-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp, image/svg+xml" />
              {logoFile && <p className="text-xs text-gray-500 mt-1">{logoFile.name}</p>}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700">
            Color Principal
          </label>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="color"
              id="primaryColor"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-10 p-1 border-gray-300 rounded-md shadow-sm"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="block w-full max-w-xs border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
          >
            {uploading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
