import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Button from './ui/Button';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import SectionHeader from './ui/SectionHeader';
import { 
  Bell, 
  Receipt, 
  Check, 
  X, 
  Eye, 
  RefreshCw, 
  Loader2, 
  Clock, 
  History 
} from 'lucide-react';

export default function ServiceRequestsManager({ restaurantId, targetRestaurantId }) {
  const activeRestaurantId = targetRestaurantId || restaurantId;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' (pending, seen) or 'history' (completed, cancelled)
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchRequests = async () => {
    if (!activeRestaurantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          id,
          request_type,
          status,
          message,
          created_at,
          restaurant_tables (
            table_number,
            table_name
          )
        `)
        .eq('restaurant_id', activeRestaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching service requests:', err);
      showMsg('error', 'No se pudieron cargar las solicitudes de servicio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [activeRestaurantId]);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const handleUpdateStatus = async (requestId, newStatus) => {
    try {
      setUpdatingId(requestId);
      const { error } = await supabase
        .from('service_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;
      
      setRequests(prev => 
        prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r)
      );
      showMsg('success', 'Solicitud actualizada con éxito.');
    } catch (err) {
      console.error('Error updating status:', err);
      showMsg('error', 'No se pudo actualizar el estado de la solicitud.');
    } finally {
      setUpdatingId(null);
    }
  };

  const showActive = activeTab === 'active';
  const filteredRequests = requests.filter(r => 
    showActive 
      ? (r.status === 'pending' || r.status === 'seen')
      : (r.status === 'completed' || r.status === 'cancelled')
  );

  const getRelativeTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} hr`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Toast Messages */}
      {message.text && (
        <div 
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-xl text-white font-medium flex items-center gap-2 border ${
            message.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-red-600 border-red-500'
          } animate-fade-in`}
          role="alert"
        >
          {message.type === 'success' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              showActive 
                ? 'bg-white text-slate-800 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Activas ({requests.filter(r => r.status === 'pending' || r.status === 'seen').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              !showActive 
                ? 'bg-white text-slate-800 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Historial ({requests.filter(r => r.status === 'completed' || r.status === 'cancelled').length})</span>
          </button>
        </div>

        {/* Refresh Button */}
        <Button 
          onClick={fetchRequests} 
          variant="secondary"
          size="sm"
          disabled={loading}
          className="gap-1.5 text-xs h-9 px-3"
        >
          {loading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span>Actualizar</span>
        </Button>
      </div>

      {loading && requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600 mb-2.5" />
          <p className="text-slate-500 text-xs font-medium">Cargando solicitudes de mesa...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          title={showActive ? "No hay solicitudes pendientes" : "Historial vacío"}
          description={
            showActive 
              ? "Aquí aparecerán las solicitudes de atención y cuenta en cuanto los clientes las envíen desde sus mesas."
              : "Las solicitudes completadas o canceladas se registrarán aquí como historial."
          }
          icon={showActive ? Bell : History}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map(req => {
            const table = req.restaurant_tables || {};
            const isPending = req.status === 'pending';
            const isSeen = req.status === 'seen';
            const isUpdating = updatingId === req.id;

            return (
              <div 
                key={req.id} 
                className={`bg-white rounded-xl border p-4 flex flex-col justify-between gap-4 transition-all ${
                  isPending 
                    ? 'border-blue-200 shadow-xs bg-blue-50/5' 
                    : isSeen 
                    ? 'border-slate-200 bg-white' 
                    : 'border-slate-150 opacity-75 bg-slate-50/50'
                }`}
              >
                {/* Header Info */}
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-base">
                        Mesa {table.table_number || '?'}
                      </h4>
                      {table.table_name && (
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          Ubicación: {table.table_name}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap" title={new Date(req.created_at).toLocaleString()}>
                      {getRelativeTime(req.created_at)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {/* Request Type Badge */}
                    {req.request_type === 'attention' ? (
                      <Badge variant="primary" className="gap-1 flex items-center py-0.5 text-[9px] uppercase tracking-wider font-bold">
                        <Bell className="h-3 w-3" />
                        <span>Atención</span>
                      </Badge>
                    ) : (
                      <Badge variant="success" className="gap-1 flex items-center py-0.5 text-[9px] uppercase tracking-wider font-bold">
                        <Receipt className="h-3 w-3" />
                        <span>Pedir Cuenta</span>
                      </Badge>
                    )}

                    {/* Status Badge */}
                    {isPending && (
                      <Badge variant="warning" className="py-0.5 text-[9px] uppercase tracking-wider font-bold">
                        Pendiente
                      </Badge>
                    )}
                    {isSeen && (
                      <Badge variant="purple" className="py-0.5 text-[9px] uppercase tracking-wider font-bold">
                        Atendiendo
                      </Badge>
                    )}
                    {req.status === 'completed' && (
                      <Badge variant="secondary" className="py-0.5 text-[9px] uppercase tracking-wider font-bold">
                        Completada
                      </Badge>
                    )}
                    {req.status === 'cancelled' && (
                      <Badge variant="danger" className="py-0.5 text-[9px] uppercase tracking-wider font-bold">
                        Cancelada
                      </Badge>
                    )}
                  </div>

                  {req.message && (
                    <p className="text-xs text-slate-650 bg-slate-50 p-2 rounded-lg border border-slate-100 italic mt-2">
                      "{req.message}"
                    </p>
                  )}
                </div>

                {/* Actions Button Group */}
                {(isPending || isSeen) && (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 text-xs">
                    {isPending && (
                      <Button
                        onClick={() => handleUpdateStatus(req.id, 'seen')}
                        disabled={isUpdating}
                        variant="secondary"
                        size="sm"
                        className="flex-1 h-8 text-[11px] gap-1 px-2 font-bold"
                      >
                        <Eye className="h-3 w-3 text-indigo-600" />
                        <span>Atender</span>
                      </Button>
                    )}
                    <Button
                      onClick={() => handleUpdateStatus(req.id, 'completed')}
                      disabled={isUpdating}
                      variant="primary"
                      size="sm"
                      className="flex-1 h-8 text-[11px] gap-1 px-2 font-bold"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Resolver</span>
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(req.id, 'cancelled')}
                      disabled={isUpdating}
                      variant="danger"
                      size="sm"
                      className="h-8 w-8 px-0 flex items-center justify-center"
                      title="Cancelar solicitud"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
