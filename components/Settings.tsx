import React, { useState, useMemo, useEffect } from 'react';

// Types
import type { User, Company, Debt, Investment, AppCurrency, ArbitrageOperation } from '../types';

// Settings Sub-components
import MasterDataSettings from './settings/MasterDataSettings';
import MarketDataSettings from './settings/MarketDataSettings';
import UserSettings from './settings/UserSettings';
import DataImportExportSettings from './settings/DataImportExportSettings';
import AppSettingsPanel from './settings/AppSettings';
import { useAppContext } from '../App';
import ValidationSummaryModal from './ValidationSummaryModal'; // Ensure modal is available
import * as api from '../services/api';

const Settings: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser, companies, banks, brokers, debtTypes, investmentTypes, exchangeRates, futureRateHistory, appSettings, businessUnits, assignments, customFields, investments, marketPriceHistory, users, selectedCompanyId, holidays, currencies } = state;

    // Actions that will be passed to children
    const onUpdateCompanies = (payload: Company[]) => dispatch({ type: 'SET_STATE', payload: { companies: payload } });
    const onUpdateBanks = (payload: any) => dispatch({ type: 'SET_STATE', payload: { banks: payload } });
    const onUpdateBrokers = (payload: any) => dispatch({ type: 'SET_STATE', payload: { brokers: payload } });
    const onUpdateDebtTypes = (payload: any) => dispatch({ type: 'SET_STATE', payload: { debtTypes: payload } });
    const onUpdateInvestmentTypes = (payload: any) => dispatch({ type: 'SET_STATE', payload: { investmentTypes: payload } });
    const onUpdateCurrencies = (payload: AppCurrency[]) => dispatch({ type: 'SET_STATE', payload: { currencies: payload } });
    const onAddSpotRate = (rate: any) => dispatch({ type: 'SET_STATE', payload: { exchangeRates: [...exchangeRates.filter(r => r.date !== rate.date), rate] } });
    const onDeleteSpotRate = (date: string) => dispatch({ type: 'SET_STATE', payload: { exchangeRates: exchangeRates.filter(r => r.date !== date) } });
    const onSaveDailyRates = (spotRate: any, futureRates: any) => {
        dispatch({ type: 'SET_STATE', payload: { exchangeRates: [...exchangeRates.filter(r => r.date !== spotRate.date), spotRate] } });
        dispatch({ type: 'SET_STATE', payload: { futureRateHistory: [...futureRateHistory.filter(s => s.snapshotDate !== spotRate.date), { snapshotDate: spotRate.date, rates: futureRates.map((r: any) => ({...r, id: crypto.randomUUID()})) }] } });
    };
    const onUpdateFutureRateHistorySnapshot = (snapshotDate: string, updatedRates: any) => {
        dispatch({ type: 'SET_STATE', payload: { futureRateHistory: futureRateHistory.map(s => s.snapshotDate === snapshotDate ? { ...s, rates: updatedRates } : s) } });
    };
    const onUpdateSettings = (settings: any) => dispatch({ type: 'SET_STATE', payload: { appSettings: settings } });
    const onUpdateBusinessUnits = (units: any) => dispatch({ type: 'SET_STATE', payload: { businessUnits: units } });
    const onUpdateAssignments = (assignments: any) => dispatch({ type: 'SET_STATE', payload: { assignments: assignments } });
    const onUpdateCustomFields = (fields: any) => dispatch({ type: 'SET_STATE', payload: { customFields: fields } });
    const onSavePrices = (snapshot: any) => dispatch({ type: 'SET_STATE', payload: { marketPriceHistory: [...marketPriceHistory.filter(s => s.date !== snapshot.date), snapshot] } });
    const onDeleteMarketPriceSnapshot = (date: string) => dispatch({ type: 'SET_STATE', payload: { marketPriceHistory: marketPriceHistory.filter(s => s.date !== date) } });
    const onUpdateUsers = (users: User[]) => dispatch({ type: 'SET_STATE', payload: { users } });
    const onUpdateHolidays = (holidays: string[]) => dispatch({ type: 'SET_HOLIDAYS', payload: holidays });
    const onDataImport = async (data: { debts?: Debt[], investments?: Investment[], arbitrages?: ArbitrageOperation[] }) => {
        try {
            const importedData = await api.importData(data);
            dispatch({ type: 'DATA_IMPORT_SUCCESS', payload: importedData });
        } catch (err) {
            console.error("Failed to import data:", err);
            dispatch({ type: 'ADD_TOAST', payload: { id: crypto.randomUUID(), message: 'Error al importar los datos.', type: 'error' }});
        }
    };
    const onBulkImportSpotRates = (rates: any) => dispatch({ type: 'SET_STATE', payload: { exchangeRates: [...exchangeRates, ...rates] } });
    const onBulkImportFutureRates = (snapshots: any) => dispatch({ type: 'SET_STATE', payload: { futureRateHistory: [...futureRateHistory, ...snapshots] } });

    const propsForChildren = {
        currentUser, companies, onUpdateCompanies, banks, onUpdateBanks, brokers, onUpdateBrokers,
        debtTypes, onUpdateDebtTypes, investmentTypes, onUpdateInvestmentTypes, spotRates: exchangeRates,
        onAddSpotRate, onDeleteSpotRate, onSaveDailyRates, futureRateHistory, onUpdateFutureRateHistorySnapshot,
        appSettings, onUpdateSettings, businessUnits, onUpdateBusinessUnits, assignments, onUpdateAssignments,
        customFields, onUpdateCustomFields, investments, marketPriceHistory, onSavePrices, onDeleteMarketPriceSnapshot,
        users, onUpdateUsers, companyData: { debts: state.debts, investments },
        selectedCompany: companies.find(c => c.id === selectedCompanyId) || null,
        onDataImport, onBulkImportSpotRates, onBulkImportFutureRates,
        holidays, onUpdateHolidays,
        currencies, onUpdateCurrencies
    };

    const allTabs = useMemo(() => [
        { id: 'masterData', label: 'Datos Maestros', roles: ['admin'] },
        { id: 'marketData', label: 'Datos de Mercado', roles: ['admin', 'operator'] },
        { id: 'users', label: 'Usuarios', roles: ['admin'] },
        { id: 'importExport', label: 'Importar/Exportar', roles: ['admin', 'operator'] },
        { id: 'appSettings', label: 'Parametrización', roles: ['admin'] },
    ], []);

    const visibleTabs = useMemo(() => {
        if (!currentUser) return [];
        return allTabs.filter(tab => tab.roles.includes(currentUser.role));
    }, [currentUser, allTabs]);
    
    const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id || '');

    useEffect(() => {
        if (visibleTabs.length > 0 && !visibleTabs.some(t => t.id === activeTab)) {
            setActiveTab(visibleTabs[0].id);
        }
    }, [visibleTabs, activeTab]);

    const renderContent = () => {
        switch(activeTab) {
            case 'masterData': return <MasterDataSettings {...propsForChildren} />;
            case 'marketData': return <MarketDataSettings {...propsForChildren} />;
            case 'users': return <UserSettings {...propsForChildren} />;
            case 'importExport': return <DataImportExportSettings {...propsForChildren} />;
            case 'appSettings': return <AppSettingsPanel settings={appSettings} onUpdateSettings={onUpdateSettings} />;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">Configuración y Gestión</h1>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
                <div className="border-b dark:border-gray-700 flex flex-wrap">
                    {visibleTabs.map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id)} 
                            className={`py-3 px-6 text-sm font-semibold transition-colors ${activeTab === tab.id 
                                ? 'border-b-2 border-primary text-primary dark:text-accent-dm' 
                                : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="p-4">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Settings;
