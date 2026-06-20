import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function BrandManager({ restaurant, onBrandUpdate, targetRestaurantId }) {
  const [localRestaurant, setLocalRestaurant] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [primaryColor, setPrimaryColor] = useState(restaurant?.primary_color || '#2563eb');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const currentRestaurant = targetRestaurantId ? localRestaurant : restaurant;

  // Sincronizar el color del picker con los cambios de props (patrón recomendado por React para evitar effects)
  const [prevColorProp, setPrevColorProp] = useState(restaurant?.primary_color);
  if (!targetRestaurantId && restaurant && restaurant.primary_color !== prevColorProp) {
    setPrevColorProp(restaurant.primary_color);
    setPrimaryColor(restaurant.primary_color || '#2563eb');
  }

  useEffect(() => {
    if (targetRestaurantId) {
      const fetchRestaurant = async () => {
        try {
          const { data, error: fetchError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', targetRestaurantId)
            .single();

          if (fetchError) throw fetchError;
          setLocalRestaurant(data);
          setPrimaryColor(data.primary_color || '#2563eb');
        } catch (err) {
          console.error('Error fetching restaurant in BrandManager:', err);
          setError('No se pudo cargar la información del restaurante.');
        }
      };
      fetchRestaurant();
    }
  }, [targetRestaurantId]);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setLogoFile(e.target.files[0]);
      setSuccess(null);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentRestaurant) {
      setError('No hay un restaurante cargado para actualizar.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    let newLogoUrl = currentRestaurant.logo_url;

    try {
      // 1. Si hay un nuevo archivo de logo, subirlo
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${currentRestaurant.id}/${fileName}`;

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
        .eq('id', currentRestaurant.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setSuccess('¡Marca actualizada con éxito!');
      if (targetRestaurantId) {
        setLocalRestaurant(data);
      }
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
    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
      <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Identidad de Marca
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="restaurantName" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Nombre del Restaurante
          </label>
          <input
            type="text"
            id="restaurantName"
            value={currentRestaurant?.name || ''}
            disabled
            className="block w-full bg-slate-50 border-slate-200 rounded-lg text-slate-500 text-xs p-2 border"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Logo Actual
          </label>
          <div className="mt-1 flex items-center gap-4">
            {currentRestaurant?.logo_url ? (
              <img src={currentRestaurant.logo_url} alt="Logo" className="h-12 w-12 object-contain rounded-lg bg-slate-50 border border-slate-200 p-1" />
            ) : (
              <div className="h-12 w-12 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Sin logo</span>
              </div>
            )}
            <div>
              <label htmlFor="logo-upload" className="cursor-pointer inline-flex items-center gap-1.5 bg-white py-1.5 px-3 border border-slate-200 rounded-lg shadow-sm text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {logoFile ? 'Cambiar archivo' : 'Subir logo'}
              </label>
              <input id="logo-upload" name="logo-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp, image/svg+xml" />
              {logoFile ? (
                <p className="text-[11px] text-indigo-600 font-semibold mt-1 flex items-center gap-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                  </svg>
                  {logoFile.name}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, WebP o SVG. Máx 5MB.</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="primaryColor" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Color Principal del Menú
          </label>
          <div className="mt-1 flex items-center gap-2 max-w-xs">
            <input
              type="color"
              id="primaryColor"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-8 w-8 p-0.5 border border-slate-200 rounded-md cursor-pointer bg-white"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#4f46e5"
              className="block w-full rounded-md border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 text-xs p-1.5 border transition-all font-mono uppercase"
            />
            <div className="h-5 w-5 rounded-full border border-slate-200 shadow-inner flex-shrink-0" style={{ backgroundColor: primaryColor }} title="Previsualización"></div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex-1 w-full sm:w-auto">
            {error && (
              <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2 flex items-center gap-1 animate-fade-in">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4 text-rose-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
            {success && (
              <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2 flex items-center gap-1 animate-fade-in">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {success}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="w-full sm:w-auto inline-flex justify-center items-center gap-1.5 py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
