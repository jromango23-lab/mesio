import { Link } from 'react-router-dom';

export default function Register() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Registro cerrado</h2>
        <p className="text-gray-700 mb-6">
          Mesio funciona con acceso autorizado. Solicita tu cuenta al administrador.
        </p>
        <Link to="/login" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
          Volver al Login
        </Link>
      </div>
    </div>
  );
}
