

/**
 * App.tsx: El componente raíz híbrido (Firebase / Demo Mode).
 */
import React, { createContext, useContext, useReducer, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import type { View, AppState, User, Permissions, Toast, Debt } from './types';
import { getInitialState } from './data';
import { auth, db, isFirebaseEnabled } from './firebaseConfig';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import * as api from './services/api';
import { DEFAULT_USERS } from './auth';

// Componentes principales
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginScreen from './components/LoginScreen';
import DebtForm from './components/DebtForm';
import CompanyModal from './components/CompanyModal';
import ConsolidatedCompanySelectorModal from './components/ConsolidatedCompanySelectorModal';

const GlobalDashboard = lazy(() => import('./components/GlobalDashboard'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const DebtReportModule = lazy(() => import('./components/DebtReportModule'));
const InvestmentModule = lazy(() => import('./components/InvestmentModule'));
const InvestmentReportModule = lazy(() => import('./components/InvestmentReportModule'));
const ArbitrageModule = lazy(() => import('./components/ArbitrageModule').then(m => ({ default: m.ArbitrageModule })));
const FwdPesificadosModule = lazy(() => import('./components/FwdPesificadosModule'));
const RofexAnalysisModule = lazy(() => import('./components/RofexAnalysisModule'));
const Settings = lazy(() => import('./components/Settings'));
const GrainCollectionModule = lazy(() => import('./components/GrainCollectionModule'));
const CashFlowModule = lazy(() => import('./components/CashFlowModule'));
const MyProfile = lazy(() => import('./components/MyProfile'));

const appReducer = (state: AppState, action: any): AppState => {
    switch (action.type) {
        case 'SET_AUTH_USER':
            return { ...state, currentUser: action.payload.user, sessionToken: action.payload.token };
        case 'UPDATE_STATE_SUCCESS':
        case 'SET_STATE':
            return { ...state, ...action.payload };
        case 'LOGOUT':
            return getInitialState();
        case 'OPEN_DEBT_FORM':
            return { ...state, isDebtFormOpen: true, debtToEdit: action.payload };
        case 'CLOSE_DEBT_FORM':
            return { ...state, isDebtFormOpen: false, debtToEdit: null };
        case 'ADD_TOAST':
            return { ...state, toasts: [...state.toasts, action.payload] };
        case 'REMOVE_TOAST':
            return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
        case 'SAVE_DEBT_SUCCESS':
        // FIX: Handle success for arbitrage operations in the reducer to show toast notifications.
        case 'SAVE_ARBITRAGE_SUCCESS':
        case 'DELETE_DEBT_SUCCESS':
        case 'DELETE_ARBITRAGE_SUCCESS':
        case 'MARK_DEBT_AS_CANCELLED_SUCCESS':
            return { ...state, toasts: [...state.toasts, { id: crypto.randomUUID(), message: 'Operación exitosa', type: 'success' }] };
        default:
            return state;
    }
};

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<any> }>({
    state: getInitialState(),
    dispatch: () => null,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, getInitialState());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Lógica de Inicialización Híbrida
        if (!isFirebaseEnabled || !auth) {
            // MODO DEMO: No hay Firebase, intentamos cargar usuario de sesión anterior o nada
            const savedUser = localStorage.getItem('demo_user');
            if (savedUser) {
                dispatch({ type: 'SET_AUTH_USER', payload: { user: JSON.parse(savedUser), token: 'demo-token' } });
            }
            setIsLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser && db) {
                try {
                    const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data() as User;
                        const token = await firebaseUser.getIdToken();
                        dispatch({ type: 'SET_AUTH_USER', payload: { user: userData, token } });
                    }
                } catch (err) {
                    console.error("Error al obtener perfil:", err);
                }
            } else {
                dispatch({ type: 'LOGOUT' });
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Sincronización de datos (Firebase o Local)
        const unsubscribe = api.subscribeToData((updates) => {
            dispatch({ type: 'UPDATE_STATE_SUCCESS', payload: updates });
        });
        return () => unsubscribe();
    }, [state.currentUser]);

    if (isLoading) {
        return <div className="h-screen w-screen bg-neutral dark:bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
        </div>;
    }

    return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);

const ToastContainer: React.FC = () => {
    const { state, dispatch } = useAppContext();
    useEffect(() => {
        if (state.toasts.length > 0) {
            const timer = setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: state.toasts[0].id }), 5000);
            return () => clearTimeout(timer);
        }
    }, [state.toasts, dispatch]);
    return (
        <div className="fixed top-4 right-4 z-[100] space-y-2">
            {state.toasts.map(t => (
                <div key={t.id} className="bg-green-600 text-white text-sm px-4 py-3 rounded-md shadow-lg flex items-center gap-3">
                    <span>{t.message}</span>
                    <button onClick={() => dispatch({ type: 'REMOVE_TOAST', payload: t.id })}>&times;</button>
                </div>
            ))}
        </div>
    );
};

const App: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser, companies, activeView, isSidebarOpen, isDebtFormOpen, isConsolidatedSelectorOpen, appSettings } = state;

    useEffect(() => {
        if (appSettings.theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [appSettings.theme]);

    const handleLogin = (payload: { user: User, token: string }) => {
        if (!isFirebaseEnabled) localStorage.setItem('demo_user', JSON.stringify(payload.user));
        dispatch({ type: 'SET_AUTH_USER', payload });
    };

    if (!currentUser) {
        return <LoginScreen users={DEFAULT_USERS} onLogin={handleLogin} />;
    }

    const accessibleCompanies = useMemo(() => {
        if (currentUser.role === 'admin') return companies;
        return companies.filter(c => currentUser.companyIds.includes(c.id));
    }, [currentUser, companies]);

    const renderView = () => {
        switch (activeView) {
            case 'global-dashboard': return <GlobalDashboard />;
            case 'debt': return <Dashboard />;
            case 'debtReport': return <DebtReportModule />;
            case 'investment': return <InvestmentModule />;
            case 'investmentReport': return <InvestmentReportModule />;
            case 'arbitrage': return <ArbitrageModule />;
            case 'fwdPesificados': return <FwdPesificadosModule />;
            case 'rofexAnalysis': return <RofexAnalysisModule exchangeRates={state.exchangeRates} futureRateHistory={state.futureRateHistory} appSettings={state.appSettings} />;
            case 'settings': return <Settings />;
            case 'grainCollection': return <GrainCollectionModule />;
            case 'cashflow': return <CashFlowModule />;
            case 'my-profile': return <MyProfile />;
            default: return <Dashboard />;
        }
    };

    return (
        <div className="flex h-screen bg-neutral dark:bg-gray-900 text-gray-800 dark:text-gray-200">
            {!isFirebaseEnabled && (
                <div className="fixed bottom-4 left-20 bg-yellow-500 text-black text-[10px] px-2 py-1 rounded-full z-[100] font-bold shadow-lg">
                    MODO LOCAL
                </div>
            )}
            <ToastContainer />
            <Sidebar />
            <div className={`flex flex-col flex-grow transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'}`}>
                <Header accessibleCompanies={accessibleCompanies} notifications={[]} unreadCount={0} />
                <main className="flex-grow p-4 md:p-6 overflow-y-auto">
                    <Suspense fallback={<div className="p-8">Cargando módulo...</div>}>
                        {renderView()}
                    </Suspense>
                </main>
            </div>
            {isDebtFormOpen && <DebtForm />}
            {isConsolidatedSelectorOpen && <ConsolidatedCompanySelectorModal isOpen={isConsolidatedSelectorOpen} allCompanies={accessibleCompanies} />}
        </div>
    );
};

export default App;
