
/**
 * LoginScreen.tsx: Interfaz de acceso migrada a Firebase Auth.
 */
import React, { useState } from 'react';
import type { User } from '../types';
import { login, requestPasswordReset } from '../services/api';
import { BuildingOffice2Icon } from './Icons';

interface LoginScreenProps {
  users: User[];
  onLogin: (loginPayload: { user: User, token: string }) => void;
}

type AuthView = 'login' | 'requestReset';

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [authView, setAuthView] = useState<AuthView>('login');
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const loginPayload = await login([], email, password);
      onLogin(loginPayload);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al iniciar sesión.');
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
        await requestPasswordReset([], email);
        setMessage('Se ha enviado un enlace de recuperación a tu correo electrónico.');
        setAuthView('login');
    } catch(err: any) {
        setError(err.message || 'Error al enviar el correo.');
    } finally {
        setIsLoading(false);
    }
  };
  
  const renderLoginView = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200" placeholder="usuario@empresa.com" required autoFocus disabled={isLoading} />
        </div>
        <div>
            <label htmlFor="password"className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña</label>
            <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200" required disabled={isLoading} />
        </div>
        <div className="text-right">
            <button type="button" onClick={() => setAuthView('requestReset')} className="text-sm text-primary hover:underline dark:text-accent-dm">¿Olvidaste tu contraseña?</button>
        </div>
        <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-gray-400 disabled:cursor-not-allowed">
            {isLoading ? 'Autenticando...' : 'Iniciar Sesión'}
        </button>
    </form>
  );

  const renderRequestResetView = () => (
    <form onSubmit={handleRequestReset} className="space-y-4">
        <div>
            <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Correo Electrónico</label>
            <input type="email" id="reset-email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200" required autoFocus disabled={isLoading} />
        </div>
        <div className="flex items-center justify-between">
            <button type="button" onClick={() => { setAuthView('login'); setError(''); setMessage(''); }} className="text-sm text-primary hover:underline dark:text-accent-dm">Volver a Inicio</button>
        </div>
        <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-gray-400">
            {isLoading ? 'Enviando...' : 'Restablecer Contraseña'}
        </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-neutral dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <BuildingOffice2Icon />
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-2">Plataforma P.F.</h1>
            <p className="text-gray-600 dark:text-gray-300">
                {authView === 'login' && 'Gestión Financiera Segura con Firebase'}
                {authView === 'requestReset' && 'Recuperar acceso a su cuenta.'}
            </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}
          {message && <p className="text-sm text-green-600 dark:text-green-400 mb-4">{message}</p>}
          
          {authView === 'login' && renderLoginView()}
          {authView === 'requestReset' && renderRequestResetView()}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
