import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PublicMenu from './pages/PublicMenu';
import AdminDashboard from './pages/AdminDashboard';
import AdminRoute from './components/AdminRoute';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          {/* Ruta pública para el menú del restaurante */}
          <Route path="/menu/:slug" element={<PublicMenu />} />
          
          {/* Si no coincide con nada, muestra una página 404 */}
          <Route path="*" element={
            <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
              <h1 className="text-4xl font-bold mb-4">404</h1>
              <p className="text-xl text-gray-600">Página no encontrada</p>
              <Link to="/" className="mt-6 text-blue-600 hover:underline">Volver al inicio</Link>
            </div>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
