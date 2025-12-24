
// Sidebar.tsx
import React, { useMemo, useState } from 'react';
import { ChartPieIcon, BanknotesIcon, PresentationChartLineIcon, ArrowsRightLeftIcon, ScaleIcon, ClipboardDocumentListIcon, Cog6ToothIcon, PresentationChartBarIcon, CurrencyDollarIcon, DocumentChartBarIcon, ChevronUpIcon, ChevronDownIcon, ChartBarSquareIcon } from './Icons';
import type { View } from '../types';
import { useAppContext } from '../App';
import { isFirebaseEnabled } from '../firebaseConfig';

interface NavItemProps {
  view: View;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  isSidebarOpen: boolean;
  onClick: (view: View) => void;
  isSubItem?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ view, label, icon, isActive, isSidebarOpen, onClick, isSubItem = false }) => {
  return (
    <button
      onClick={() => onClick(view)}
      title={isSidebarOpen ? '' : label}
      className={`flex items-center w-full h-11 transition-colors duration-200 ${
        isSubItem && isSidebarOpen ? 'pl-8' : 'pl-4'
      } ${
        isActive
          ? 'bg-primary/90 text-white shadow-inner'
          : 'text-gray-600 dark:text-gray-300 hover:bg-primary/10 dark:hover:bg-primary/20'
      } ${isSidebarOpen ? 'rounded-lg' : 'rounded-none'}`}
    >
      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">{icon}</div>
      {isSidebarOpen && <span className="ml-3 font-semibold text-sm whitespace-nowrap">{label}</span>}
    </button>
  );
};

const NavCategory: React.FC<{
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  isSidebarOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, icon, isOpen, isSidebarOpen, onToggle, children }) => {
    return (
        <div>
            <button
                onClick={onToggle}
                title={isSidebarOpen ? '' : title}
                className={`flex items-center justify-between w-full h-12 px-4 transition-colors duration-200 group ${isSidebarOpen ? 'rounded-lg' : ''} text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50`}
            >
                <div className="flex items-center">
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">{icon}</div>
                    {isSidebarOpen && <span className="ml-3 font-bold text-sm whitespace-nowrap">{title}</span>}
                </div>
                {isSidebarOpen && (isOpen ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />)}
            </button>
            {isSidebarOpen && isOpen && (
                <div className="pt-1 pb-2 pl-2 space-y-1">
                    {children}
                </div>
            )}
        </div>
    );
}

const Sidebar: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser, activeView, isSidebarOpen } = state;
    const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['Gestión Financiera', 'Coberturas', 'Reportes']));

    const onNavigate = (view: View) => dispatch({ type: 'SET_STATE', payload: { activeView: view } });

    const toggleCategory = (category: string) => {
        setOpenCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) newSet.delete(category);
            else newSet.add(category);
            return newSet;
        });
    };

    const navConfig = useMemo(() => {
        if (!currentUser) return [];
        const allItems = {
            'global-dashboard': { view: 'global-dashboard', label: 'Dashboard Global', icon: <ChartPieIcon /> },
            'debt': { view: 'debt', label: 'Deuda', icon: <BanknotesIcon /> },
            'investment': { view: 'investment', label: 'Inversiones', icon: <PresentationChartLineIcon /> },
            'grainCollection': { view: 'grainCollection', label: 'Cobranzas de Granos', icon: <CurrencyDollarIcon /> },
            'cashflow': { view: 'cashflow', label: 'Flujo Proyectado', icon: <ClipboardDocumentListIcon /> },
            'arbitrage': { view: 'arbitrage', label: 'Arbitrajes', icon: <ArrowsRightLeftIcon /> },
            'rofexAnalysis': { view: 'rofexAnalysis', label: 'Análisis ROFEX', icon: <PresentationChartBarIcon /> },
            'fwdPesificados': { view: 'fwdPesificados', label: 'FWD Pesificados', icon: <CurrencyDollarIcon /> },
            'debtReport': { view: 'debtReport', label: 'Reporte de Deuda', icon: <DocumentChartBarIcon /> },
            'investmentReport': { view: 'investmentReport', label: 'Reporte de Inversión', icon: <ChartBarSquareIcon /> },
            'settings': { view: 'settings', label: 'Configuración', icon: <Cog6ToothIcon /> },
        };

        const structure = [
            { type: 'item', id: 'global-dashboard' },
            { type: 'category', title: 'Gestión Financiera', icon: <DocumentChartBarIcon />, items: ['debt', 'investment'] },
            { type: 'category', title: 'Flujo de Caja', icon: <ClipboardDocumentListIcon />, items: ['grainCollection', 'cashflow'] },
            { type: 'category', title: 'Coberturas', icon: <ArrowsRightLeftIcon />, items: ['arbitrage', 'rofexAnalysis', 'fwdPesificados'] },
            { type: 'category', title: 'Reportes', icon: <PresentationChartBarIcon />, items: ['debtReport', 'investmentReport'] },
            { type: 'item', id: 'settings' },
        ];
        
        return structure.map(section => {
            if (section.type === 'item') {
                const item = allItems[section.id as keyof typeof allItems];
                return currentUser.permissions[item.view as View] ? { ...section, ...item } : null;
            } else if (section.type === 'category') {
                const visibleItems = section.items
                    .map(id => allItems[id as keyof typeof allItems])
                    .filter(item => currentUser.permissions[item.view as View]);
                return visibleItems.length > 0 ? { ...section, items: visibleItems } : null;
            }
            return null;
        }).filter(Boolean);
    }, [currentUser]);

    return (
        <aside className={`fixed top-0 left-0 h-full bg-white dark:bg-gray-800 border-r dark:border-gray-700 shadow-lg z-30 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between h-16 px-4 border-b dark:border-gray-700 flex-shrink-0">
                    {isSidebarOpen && <h1 className="text-lg font-bold text-primary dark:text-accent-dm">Gestor Financiero</h1>}
                </div>
                <nav className="flex-grow p-2 space-y-1 overflow-y-auto">
                    {navConfig.map((section: any) => {
                        if (section.type === 'item') {
                            return <NavItem key={section.view} view={section.view as View} label={section.label} icon={section.icon} isActive={activeView === section.view} isSidebarOpen={isSidebarOpen} onClick={onNavigate} />
                        }
                        if (section.type === 'category') {
                             return <NavCategory key={section.title} title={section.title} icon={section.icon} isOpen={openCategories.has(section.title)} isSidebarOpen={isSidebarOpen} onToggle={() => toggleCategory(section.title)} >
                                {section.items.map((item: any) => (
                                     <NavItem key={item.view} view={item.view as View} label={item.label} icon={item.icon} isActive={activeView === item.view} isSidebarOpen={isSidebarOpen} onClick={onNavigate} isSubItem />
                                ))}
                            </NavCategory>
                        }
                        return null;
                    })}
                </nav>
                
                {/* Indicador de Estado Híbrido */}
                <div className="p-4 border-t dark:border-gray-700 flex flex-col gap-2">
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isFirebaseEnabled ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                            <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                                {isFirebaseEnabled ? 'Cloud Sync Activo' : 'Modo Offline (Local)'}
                            </span>
                        </div>
                    ) : (
                        <div className={`w-2 h-2 mx-auto rounded-full ${isFirebaseEnabled ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
