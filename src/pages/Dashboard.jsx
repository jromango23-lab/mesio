﻿import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import CategoriesManager from '../components/CategoriesManager';
import ProductsManager from '../components/ProductsManager';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState(null);
  
  // Estado para el formulario de nuevo restaurante
  const [newRestName, setNewRestName] = useState('');
  const [newRestSlug, setNewRestSlug] = useState('');
  const [creating, setCreating] = useState(false);

  // Estado para controlar qué vista se muestra en el panel
  const [currentView, setCurrentView] = useState('home'); // 'home', 'categories', 'products'

  useEffect(() => {
    if (user) {
      checkRestaurant();
    }
  }, [user]);

  const checkRestaurant = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('user_id', user.id)
        .single(); // Solo esperamos un restaurante por usuario por ahora

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching restaurant:', error);
      }
      
      if (data) {
        setRestaurant(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRestaurant = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const { data, error } = await supabase
        .from('restaurants')
        .insert([
          { user_id: user.id, name: newRestName, slug: newRestSlug }
        ])
        .select()
        .single();

      if (error) {
        alert('Error al crear: ' + error.message);
      } else {
        setRestaurant(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p>Cargando panel...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra de navegación superior */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-blue-600">Mesio</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user?.email}</span>
              <button onClick={handleSignOut} className="text-sm text-red-600 hover:text-red-800">Salir</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {!restaurant ? (
          /* Pantalla si el usuario aún no tiene un restaurante configurado */
          <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow mt-10">
            <h2 className="text-xl font-bold mb-4 text-center">Configura tu Restaurante</h2>
            <p className="text-sm text-gray-500 mb-6 text-center">Para comenzar a crear tu menú digital, necesitamos algunos datos básicos.</p>
            <form onSubmit={handleCreateRestaurant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre del Restaurante</label>
                <input 
                  type="text" 
                  value={newRestName} 
                  onChange={(e) => {
                    setNewRestName(e.target.value);
                    // Autogenerar un slug simple basado en el nombre (ej: "Mis Tacos" -> "mis-tacos")
                    setNewRestSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" 
                  placeholder="Ej: Taquería El Paisa"
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Identificador URL (Slug)</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    mesio.com/
                  </span>
                  <input 
                    type="text" 
                    value={newRestSlug} 
                    onChange={(e) => setNewRestSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 block w-full rounded-none rounded-r-md sm:text-sm border-gray-300 focus:ring-blue-500 focus:border-blue-500 p-2 border" 
                    placeholder="taqueria-el-paisa"
                    required 
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={creating}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Comenzar a usar Mesio'}
              </button>
            </form>
          </div>
        ) : (
          /* Pantalla principal del Dashboard si ya tiene un restaurante */
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Panel de Control: {restaurant.name}</h2>
                <p className="text-gray-500">Gestiona tu menú digital desde aquí.</p>
              </div>
              <a
                href={`/menu/${restaurant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 sm:mt-0 inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Ver Menú
              </a>
            </div>
            
            {currentView === 'home' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div 
                   onClick={() => setCurrentView('categories')}
                   className="border rounded-lg p-6 hover:shadow-md transition cursor-pointer bg-blue-50 border-blue-100"
                 >
                   <h3 className="font-bold text-lg text-blue-800 mb-2">Categorías</h3>
                   <p className="text-sm text-blue-600">Administra las secciones de tu menú (Ej: Bebidas, Postres).</p>
                 </div>
                 <div 
                   onClick={() => setCurrentView('products')}
                   className="border rounded-lg p-6 hover:shadow-md transition cursor-pointer bg-green-50 border-green-100"
                 >
                   <h3 className="font-bold text-lg text-green-800 mb-2">Productos</h3>
                   <p className="text-sm text-green-600">Añade y edita los platillos dentro de tus categorías.</p>
                 </div>
                 {restaurant?.slug && (
                   <div 
                     onClick={() => setCurrentView('qrcode')}
                     className="border rounded-lg p-6 hover:shadow-md transition cursor-pointer bg-purple-50 border-purple-100"
                   >
                     <h3 className="font-bold text-lg text-purple-800 mb-2">Código QR</h3>
                     <p className="text-sm text-purple-600">Genera y descarga el código QR de tu menú.</p>
                   </div>
                 )}
              </div>
            )}

            {currentView === 'qrcode' && restaurant?.slug && (
              <div>
                <button onClick={() => setCurrentView('home')} className="mb-4 text-blue-600 hover:underline font-medium">&larr; Volver al inicio</button>
                <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm max-w-md mx-auto text-center">
                  <h3 className="text-xl font-bold mb-6 text-gray-800">Código QR de tu Menú</h3>
                  <div className="flex justify-center mb-6 bg-white p-4 inline-block rounded-lg shadow-sm border border-gray-100">
                    <QRCodeCanvas 
                      id="qr-code-canvas"
                      value={`${import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin}/menu/${restaurant.slug}`}
                      size={200}
                      level={"H"}
                      includeMargin={true}
                    />
                  </div>
                  <p className="text-gray-600 text-sm mb-6 break-all bg-gray-50 p-3 rounded border border-gray-100">
                    {`${import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin}/menu/${restaurant.slug}`}
                  </p>
                  <button 
                    onClick={() => {
                      const canvas = document.getElementById('qr-code-canvas');
                      if (canvas) {
                        const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
                        const downloadLink = document.createElement('a');
                        downloadLink.href = pngUrl;
                        downloadLink.download = `qr-${restaurant.slug}.png`;
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                      }
                    }}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                  >
                    Descargar Código QR
                  </button>
                </div>
              </div>
            )}

            {currentView === 'categories' && (
              <div>
                <button onClick={() => setCurrentView('home')} className="mb-4 text-blue-600 hover:underline font-medium">&larr; Volver al inicio</button>
                <CategoriesManager restaurantId={restaurant.id} />
              </div>
            )}

            {currentView === 'products' && (
              <div>
                <button onClick={() => setCurrentView('home')} className="mb-4 text-blue-600 hover:underline font-medium">&larr; Volver al inicio</button>
                <ProductsManager restaurantId={restaurant.id} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
