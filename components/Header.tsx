// This is a new file: components/Header.tsx
import React from 'react';
import type { Company, Notification, AppSettings } from '../types';
import { BuildingOffice2Icon, UsersIcon, Cog6ToothIcon, UserIcon } from './Icons';
import NotificationsBell from './NotificationsBell';
import { useAppContext } from '../App';

interface HeaderProps {
  accessibleCompanies: Company[];
  notifications: Notification[];
  unreadCount: number;
}

const Header: React.FC<HeaderProps> = ({ 
    accessibleCompanies,
    notifications, 
    unreadCount,
}) => {
    const { state, dispatch } = useAppContext();
    const { currentUser, selectedCompanyId, viewMode, selectedConsolidatedCompanyIds, appSettings } = state;

    if (!currentUser) return null;

    const handleLogout = () => dispatch({ type: 'LOGOUT' });
    const onSelectCompany = (id: string) => dispatch({ type: 'SET_STATE', payload: { selectedCompanyId: id } });
    const onManage = () => dispatch({ type: 'SET_STATE', payload: { activeView: 'settings' } });
    const onNavigate = (view: any) => dispatch({ type: 'SET_STATE', payload: { activeView: view } });
    const onSetViewMode = (mode: 'individual' | 'consolidated') => dispatch({ type: 'SET_STATE', payload: { viewMode: mode } });
    const onOpenConsolidatedSelector = () => dispatch({ type: 'SET_STATE', payload: { isConsolidatedSelectorOpen: true } });
    const onToggleSidebar = () => dispatch({ type: 'SET_STATE', payload: { isSidebarOpen: !state.isSidebarOpen } });
    const onUpdateSettings = (settings: AppSettings) => dispatch({ type: 'SET_STATE', payload: { appSettings: settings }});
    
    const handleThemeToggle = () => {
        onUpdateSettings({
            ...appSettings,
            theme: appSettings.theme === 'dark' ? 'light' : 'dark',
        });
    };

  return (
    <header className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm dark:border-b dark:border-gray-700 sticky top-0 z-20">
      <div className="container mx-auto px-4 md:px-6 py-2 flex justify-between items-center">
        {/* Left Side: View Mode & Company Selector */}
        <div className="flex items-center gap-4">
          <button onClick={onToggleSidebar} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
           {/* View Mode Switcher */}
          <div className="bg-gray-200 dark:bg-gray-700 p-1 rounded-lg flex items-center text-sm">
            <button
              onClick={() => onSetViewMode('individual')}
              className={`px-3 py-1 rounded-md transition-colors ${viewMode === 'individual' ? 'bg-white dark:bg-primary text-primary dark:text-white font-semibold' : 'text-gray-700 dark:text-gray-200'}`}
            >
              Individual
            </button>
            <button
              onClick={() => onSetViewMode('consolidated')}
              className={`px-3 py-1 rounded-md transition-colors ${viewMode === 'consolidated' ? 'bg-white dark:bg-primary text-primary dark:text-white font-semibold' : 'text-gray-700 dark:text-gray-200'}`}
            >
              Consolidado
            </button>
          </div>
           {/* Company Selector */}
          {viewMode === 'individual' ? (
            <div className="relative">
                <select
                value={selectedCompanyId || ''}
                onChange={(e) => onSelectCompany(e.target.value)}
                className="bg-gray-100 dark:bg-gray-700 rounded-md py-2 pl-3 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Seleccionar empresa"
                >
                {accessibleCompanies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                ))}
                </select>
            </div>
            ) : (
                <button
                    onClick={onOpenConsolidatedSelector}
                    className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <UsersIcon />
                    <span>{selectedConsolidatedCompanyIds.length} Empresas</span>
                </button>
          )}
        </div>

        {/* Right Side: Actions & User */}
        <div className="flex items-center gap-4">
          <NotificationsBell notifications={notifications} unreadCount={unreadCount} onMarkAsRead={() => {}} />

          {currentUser.permissions.settings === 'admin' && (
            <button
              onClick={onManage}
              className="flex items-center gap-2 bg-primary hover:bg-secondary text-white font-semibold py-2 px-4 rounded-md transition-colors"
              title="Gestionar"
            >
              <Cog6ToothIcon />
              <span className="hidden sm:inline">Gestionar</span>
            </button>
          )}
          
           <button onClick={handleThemeToggle} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Cambiar Tema">
                {appSettings.theme === 'dark' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                )}
           </button>

          <div className="flex items-center gap-2 border-l pl-4 dark:border-gray-600">
             <div className="text-right">
                <p className="font-semibold text-sm">{currentUser.username}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                    {Object.keys(currentUser.permissions).length > 0 ? 'Usuario' : 'Sin Permisos'}
                </p>
             </div>
             <button onClick={() => onNavigate('my-profile')} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Mi Perfil">
                <UserIcon />
             </button>
              <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold text-sm py-1 px-3 rounded-md">
                Salir
              </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;