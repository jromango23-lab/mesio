import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { QRCodeCanvas } from 'qrcode.react';
import Button from './ui/Button';
import Input from './ui/Input';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import SectionHeader from './ui/SectionHeader';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Copy, 
  Download, 
  Loader2, 
  QrCode, 
  ShieldAlert 
} from 'lucide-react';

export default function TablesManager({ restaurantId, targetRestaurantId }) {
  const activeRestaurantId = targetRestaurantId || restaurantId;

  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restaurantSlug, setRestaurantSlug] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Creation form states
  const [tableNumber, setTableNumber] = useState('');
  const [tableName, setTableName] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit states
  const [editingId, setEditingId] = useState(null);
  const [editNumber, setEditNumber] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  // Generation of cryptographically secure random 24-char tokens
  const generateTableToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(24);
    window.crypto.getRandomValues(array);
    let token = '';
    for (let i = 0; i < 24; i++) {
      token += chars[array[i] % chars.length];
    }
    return token;
  };

  const fetchTables = async () => {
    if (!activeRestaurantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', activeRestaurantId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTables(data || []);
    } catch (err) {
      console.error('Error fetching tables:', err);
      showMsg('error', 'No se pudieron cargar las mesas del restaurante.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantSlug = async () => {
    if (!activeRestaurantId) return;
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('slug')
        .eq('id', activeRestaurantId)
        .single();
      if (error) throw error;
      if (data) {
        setRestaurantSlug(data.slug);
      }
    } catch (err) {
      console.error('Error fetching restaurant slug:', err);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchRestaurantSlug();
  }, [activeRestaurantId]);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!tableNumber.trim()) return;
    setCreating(true);

    let inserted = false;
    let retries = 3;
    let lastError = null;

    // Retry loop in case of unique token collision
    while (!inserted && retries > 0) {
      const token = generateTableToken();
      try {
        const { error } = await supabase
          .from('restaurant_tables')
          .insert([{
            restaurant_id: activeRestaurantId,
            table_number: tableNumber.trim(),
            table_name: tableName.trim() || null,
            table_token: token,
            is_active: true
          }]);

        if (error) {
          lastError = error;
          // Code 23505 indicates unique constraint violation in Postgres
          if (error.code === '23505') {
            if (error.message.includes('table_token')) {
              retries--;
              continue; // try again with a new random token
            } else if (error.message.includes('unique_restaurant_table_number')) {
              showMsg('error', 'Este número de mesa ya está registrado en el restaurante.');
              setCreating(false);
              return;
            }
          }
          throw error;
        }

        inserted = true;
      } catch (err) {
        console.error('Error creating table:', err);
        showMsg('error', err.message || 'No se pudo crear la mesa.');
        setCreating(false);
        return;
      }
    }

    if (inserted) {
      showMsg('success', 'Mesa creada con éxito.');
      setTableNumber('');
      setTableName('');
      fetchTables();
    } else if (lastError) {
      showMsg('error', 'Error de colisión de tokens. Inténtalo de nuevo.');
    }
    setCreating(false);
  };

  const handleToggleActive = async (tableId, currentStatus) => {
    const newStatus = !currentStatus;
    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .update({ is_active: newStatus })
        .eq('id', tableId);

      if (error) throw error;
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, is_active: newStatus } : t));
      showMsg('success', `Mesa ${newStatus ? 'activada' : 'desactivada'} con éxito.`);
    } catch (err) {
      console.error('Error updating table status:', err);
      showMsg('error', 'No se pudo cambiar el estado de la mesa.');
    }
  };

  const startEdit = (table) => {
    setEditingId(table.id);
    setEditNumber(table.table_number);
    setEditName(table.table_name || '');
  };

  const handleSaveEdit = async (tableId) => {
    if (!editNumber.trim()) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .update({
          table_number: editNumber.trim(),
          table_name: editName.trim() || null
        })
        .eq('id', tableId);

      if (error) {
        if (error.code === '23505' && error.message.includes('unique_restaurant_table_number')) {
          showMsg('error', 'Este número de mesa ya está registrado en el restaurante.');
          setSaving(false);
          return;
        }
        throw error;
      }

      setTables(prev => prev.map(t => t.id === tableId ? { ...t, table_number: editNumber.trim(), table_name: editName.trim() || null } : t));
      showMsg('success', 'Mesa modificada con éxito.');
      setEditingId(null);
    } catch (err) {
      console.error('Error saving table edits:', err);
      showMsg('error', 'No se pudieron guardar los cambios de la mesa.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tableId, tableNumber) => {
    const isConfirmed = window.confirm(`¿Estás seguro de que quieres eliminar la Mesa ${tableNumber}? Esta acción no se puede deshacer.`);
    if (!isConfirmed) return;

    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .delete()
        .eq('id', tableId);

      if (error) throw error;
      setTables(prev => prev.filter(t => t.id !== tableId));
      showMsg('success', 'Mesa eliminada con éxito.');
    } catch (err) {
      console.error('Error deleting table:', err);
      showMsg('error', 'No se pudo eliminar la mesa.');
    }
  };

  const getPublicTableUrl = (token) => {
    const baseUrl = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;
    return `${baseUrl}/menu/${restaurantSlug}?table=${token}`;
  };

  const copyTableLink = (token) => {
    const url = getPublicTableUrl(token);
    navigator.clipboard.writeText(url)
      .then(() => showMsg('success', 'Enlace copiado al portapapeles.'))
      .catch((err) => console.error('Error copying table link:', err));
  };

  const downloadQR = (token, tableNumber) => {
    const canvas = document.getElementById(`qr-table-canvas-${token}`);
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `mesa-${tableNumber}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mensajes de Alerta */}
      {message.text && (
        <div 
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-xl text-white font-medium flex items-center gap-2 border ${
            message.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-red-600 border-red-500'
          } animate-fade-in`}
          role="alert"
        >
          {message.type === 'success' ? <Check className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Formulario de Creación */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs max-w-3xl">
        <SectionHeader
          title="Crear Nueva Mesa"
          description="Agrega una mesa con su número identificador y genera su código QR único."
          icon={QrCode}
          className="pb-4 mb-4"
        />

        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <Input 
            label="Número de Mesa"
            type="text"
            placeholder="Ej: 5"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            required
          />
          <Input 
            label="Nombre / Ubicación (Opcional)"
            type="text"
            placeholder="Ej: Terraza 1"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
          />
          <Button 
            type="submit" 
            disabled={creating}
            className="h-10 w-full gap-1.5"
          >
            {creating ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>Agregar Mesa</span>
          </Button>
        </form>
      </div>

      {/* Lista de Mesas */}
      <div className="space-y-4">
        <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
          <h3 className="text-base font-bold text-slate-800">Mesas del Restaurante</h3>
          <Badge variant="primary">Total: {tables.length}</Badge>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-blue-600 mb-2" />
            <p className="text-slate-500 text-xs">Cargando listado de mesas...</p>
          </div>
        ) : tables.length === 0 ? (
          <EmptyState 
            title="No hay mesas registradas"
            description="Agrega tu primera mesa para descargar su código QR único para que tus clientes escaneen desde su mesa."
            icon={QrCode}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tables.map(table => {
              const isEditing = editingId === table.id;

              return (
                <div 
                  key={table.id} 
                  className={`bg-white rounded-xl border p-4 flex flex-col justify-between gap-4 transition-all ${
                    table.is_active ? 'border-slate-200' : 'border-slate-150 bg-slate-50/50 opacity-80'
                  }`}
                >
                  {/* Fila superior: Info y estado */}
                  <div className="flex justify-between items-start gap-4">
                    {isEditing ? (
                      <div className="space-y-3 flex-1">
                        <Input 
                          label="Número de Mesa"
                          type="text"
                          value={editNumber}
                          onChange={(e) => setEditNumber(e.target.value)}
                          required
                          className="h-8 py-1"
                        />
                        <Input 
                          label="Nombre / Ubicación"
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 py-1"
                        />
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleSaveEdit(table.id)}
                            disabled={saving}
                            size="sm"
                            className="h-8 px-2.5 gap-1 text-xs"
                          >
                            {saving ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                            <span>Guardar</span>
                          </Button>
                          <Button 
                            onClick={() => setEditingId(null)}
                            variant="secondary"
                            size="sm"
                            className="h-8 px-2.5 gap-1 text-xs"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Cancelar</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-800 text-lg leading-tight">
                            Mesa {table.table_number}
                          </span>
                          <Badge variant={table.is_active ? 'success' : 'danger'}>
                            {table.is_active ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </div>
                        {table.table_name && (
                          <p className="text-xs text-slate-450 mt-1 font-semibold text-slate-500">
                            Ubicación: {table.table_name}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 font-mono mt-1 select-all break-all" title="Token de Mesa">
                          Token: {table.table_token}
                        </p>
                      </div>
                    )}

                    {/* QR Canvas (Oculto, necesario para descarga) */}
                    <div className="hidden">
                      <QRCodeCanvas 
                        id={`qr-table-canvas-${table.table_token}`}
                        value={getPublicTableUrl(table.table_token)}
                        size={300}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                  </div>

                  {/* Fila inferior: Acciones */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleToggleActive(table.id, table.is_active)}
                        variant="secondary"
                        size="sm"
                        className="h-8 px-2 text-xs font-semibold"
                        aria-label={table.is_active ? "Desactivar mesa" : "Activar mesa"}
                        title={table.is_active ? "Desactivar mesa" : "Activar mesa"}
                      >
                        {table.is_active ? 'Desactivar' : 'Activar'}
                      </Button>

                      {!isEditing && (
                        <>
                          <Button
                            onClick={() => startEdit(table)}
                            variant="secondary"
                            size="sm"
                            className="h-8 w-8"
                            aria-label="Editar mesa"
                            title="Editar mesa"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(table.id, table.table_number)}
                            variant="danger"
                            size="sm"
                            className="h-8 w-8"
                            aria-label="Eliminar mesa"
                            title="Eliminar mesa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => copyTableLink(table.table_token)}
                        variant="secondary"
                        size="sm"
                        className="h-8 px-2 text-xs font-semibold gap-1"
                        aria-label="Copiar link de mesa"
                        title="Copiar link de mesa"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copiar Link</span>
                      </Button>
                      <Button
                        onClick={() => downloadQR(table.table_token, table.table_number)}
                        variant="primary"
                        size="sm"
                        className="h-8 px-2 text-xs font-semibold gap-1"
                        aria-label="Descargar código QR de mesa"
                        title="Descargar QR"
                      >
                        <Download className="h-3 w-3" />
                        <span>Descargar QR</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
