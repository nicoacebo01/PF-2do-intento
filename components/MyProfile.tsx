import React, { useState, useCallback } from 'react';
import { useAppContext } from '../App';

const Widget: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = "" }) => (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700 ${className}`}>
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4 border-b dark:border-gray-600 pb-3">{title}</h3>
        {children}
    </div>
);

const MyProfile: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser } = state;

    // State for profile info form
    const [email, setEmail] = useState(currentUser?.email || '');

    // State for password change form
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        dispatch({ type: 'UPDATE_CURRENT_USER', payload: { email } });
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (currentPassword !== currentUser?.password_plaintext) {
            setPasswordError('La contraseña actual es incorrecta.');
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError('La nueva contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Las nuevas contraseñas no coinciden.');
            return;
        }

        dispatch({ type: 'UPDATE_CURRENT_USER', payload: { password_plaintext: newPassword } });
        setPasswordSuccess('¡Contraseña actualizada con éxito!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };
    
    const commonInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600";
    const commonButtonClass = "bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg";

    if (!currentUser) return null;

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">Mi Perfil</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Widget title="Información de Usuario">
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre de Usuario</label>
                            <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-gray-100">{currentUser.username}</p>
                        </div>
                         <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email de Contacto</label>
                            <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className={commonInputClass} />
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className={commonButtonClass}>Guardar Cambios</button>
                        </div>
                    </form>
                </Widget>

                <Widget title="Cambiar Contraseña">
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="current-password"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña Actual</label>
                            <input type="password" id="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={commonInputClass} required />
                        </div>
                         <div>
                            <label htmlFor="new-password"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nueva Contraseña</label>
                            <input type="password" id="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={commonInputClass} required />
                        </div>
                         <div>
                            <label htmlFor="confirm-password"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirmar Nueva Contraseña</label>
                            <input type="password" id="confirm-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={commonInputClass} required />
                        </div>

                        {passwordError && <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>}
                        {passwordSuccess && <p className="text-sm text-green-600 dark:text-green-400">{passwordSuccess}</p>}
                        
                        <div className="flex justify-end">
                            <button type="submit" className={commonButtonClass}>Cambiar Contraseña</button>
                        </div>
                    </form>
                </Widget>
            </div>
        </div>
    );
};

export default MyProfile;