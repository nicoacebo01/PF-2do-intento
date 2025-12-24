import {
  Company, Debt, Investment, Bank, Broker, DebtType, InvestmentType, AppCurrency,
  DailyExchangeRate, FutureExchangeRateSnapshot, AppSettings, ArbitrageOperation,
  BusinessUnit, Assignment, ArbitrageCustomField, MarketPriceSnapshot, CashAccount, CashFlowEntry,
  Currency,
  GrainCollection,
  CollectionAdjustment,
  AppState
} from './types';

export const DEFAULT_COMPANIES: Company[] = [
  { id: 'co-1', name: 'Empresa Principal' },
  { id: 'co-2', name: 'Empresa Secundaria' },
];

export const DEFAULT_BANKS: Bank[] = [
    { id: 'bank-pampa', name: 'BANCO DE LA PAMPA', creditLines: [] },
    { id: 'bank-hsbc', name: 'HSBC', creditLines: [] },
    { id: 'bank-industrial', name: 'INDUSTRIAL', creditLines: [] },
    { id: 'bank-galicia', name: 'GALICIA', creditLines: [] },
    { id: 'bank-supervielle', name: 'SUPERVIELLE', creditLines: [] },
    { id: 'bank-hipotecario', name: 'HIPOTECARIO', creditLines: [] },
    { id: 'bank-santander', name: 'SANTANDER', creditLines: [] },
    { id: 'bank-patagonia', name: 'PATAGONIA', creditLines: [] },
    { id: 'bank-itau', name: 'ITAU', creditLines: [] },
    { id: 'bank-citibank', name: 'CITIBANK', creditLines: [] },
    { id: 'bank-bapro', name: 'BAPRO', creditLines: [] },
    { id: 'bank-ciudad', name: 'CIUDAD', creditLines: [] },
    { id: 'bank-piano', name: 'PIANO', creditLines: [] },
    { id: 'bank-macro', name: 'MACRO', creditLines: [] },
    { id: 'bank-bbva', name: 'BBVA', creditLines: [] },
    { id: 'bank-icbc', name: 'ICBC', creditLines: [] },
    { id: 'bank-cmf', name: 'CMF', creditLines: [] },
    { id: 'bank-bst', name: 'BST', creditLines: [] },
    { id: 'bank-credicoop', name: 'CREDICOOP', creditLines: [] },
    { id: 'bank-nacion', name: 'NACIÓN', creditLines: [] },
    { id: 'bank-meridian', name: 'MERIDIAN', creditLines: [] },
    { id: 'bank-rabobank', name: 'RABOBANK', creditLines: [] },
    { id: 'bank-bersa', name: 'BERSA', creditLines: [] },
    { id: 'bank-bancor', name: 'BANCOR', creditLines: [] },
    { id: 'bank-mariva', name: 'MARIVA', creditLines: [] },
    { id: 'bank-saenz', name: 'SAENZ', creditLines: [] },
    { id: 'bank-columbia', name: 'COLUMBIA', creditLines: [] },
    { id: 'bank-comafi', name: 'COMAFI', creditLines: [] },
    { id: 'bank-mercado-capitales', name: 'MERCADO DE CAPITALES', creditLines: [] },
    { id: 'bank-bind', name: 'BIND', creditLines: [] },
];

export const DEFAULT_BROKERS: Broker[] = [
    { id: 'broker-fyo', name: 'FYO CAPITAL' },
    { id: 'broker-max', name: 'MAX CAPITAL' },
    { id: 'broker-allaria', name: 'ALLARIA' },
    { id: 'broker-lbo', name: 'LBO' },
    { id: 'broker-cocos', name: 'COCOS CAPITAL' },
    { id: 'broker-valcereal', name: 'VALCEREAL' },
    { id: 'broker-granar', name: 'GRANAR' },
    { id: 'broker-option', name: 'OPTION SECURITIES' },
    { id: 'broker-lycsa', name: 'LYCSA' },
];

export const DEFAULT_DEBT_TYPES: DebtType[] = [
    { id: 'dt-1', name: 'Préstamo', allowedCurrencies: [Currency.ARS, Currency.USD], category: 'bancaria' },
    { id: 'dt-2', name: 'Tarjeta Rural', allowedCurrencies: [Currency.ARS], category: 'bancaria' },
    { id: 'dt-3', name: 'Descuento de Cheques', allowedCurrencies: [Currency.ARS], category: 'bancaria' },
    { id: 'dt-4', name: 'Pagaré Bursátil', allowedCurrencies: [Currency.ARS, Currency.USD], category: 'mercado' },
];

export const DEFAULT_INVESTMENT_TYPES: InvestmentType[] = [
    { id: 'it-1', name: 'Bonos', allowedCurrencies: [Currency.ARS, Currency.USD] },
    { id: 'it-2', name: 'Acciones', allowedCurrencies: [Currency.ARS, Currency.USD] },
    { id: 'it-3', name: 'Caución', allowedCurrencies: [Currency.ARS] },
    { id: 'it-4', name: 'NDF Cliente', allowedCurrencies: [Currency.USD] },
];

export const DEFAULT_CURRENCIES: AppCurrency[] = [
    { id: Currency.ARS, name: 'Pesos Argentinos', subtypes: [] },
    { id: Currency.USD, name: 'Dólares Estadounidenses', subtypes: [
        { id: 'usd-ccl', name: 'CCL' },
        { id: 'usd-mep', name: 'MEP' },
        { id: 'usd-oficial', name: 'Oficial' },
    ]},
];

export const DEFAULT_BUSINESS_UNITS: BusinessUnit[] = [
    { id: 'bu-1', name: 'Cliente' },
    { id: 'bu-2', name: 'Trade' },
    { id: 'bu-3', name: 'Insumos' },
    { id: 'bu-4', name: 'Granos' },
    { id: 'bu-5', name: 'Tarjetas' },
    { id: 'bu-6', name: 'Posi Global' },
    { id: 'bu-7', name: 'Gastos Estructura' },
    { id: 'bu-8', name: 'Pampa Bio' },
    { id: 'bu-9', name: 'Préstamos' },
];
export const DEFAULT_ASSIGNMENTS: Assignment[] = [
    { id: 'as-1', name: 'Negocios financieros' },
    { id: 'as-2', name: 'Insumos' },
    { id: 'as-3', name: 'Granos' },
    { id: 'as-4', name: 'Prorrateo WK' },
    { id: 'as-5', name: 'Pampa Bio' },
];
export const DEFAULT_CUSTOM_FIELDS: ArbitrageCustomField[] = [];

// Sample data for a company
export const DEFAULT_DEBTS: Debt[] = [];
export const DEFAULT_INVESTMENTS: Investment[] = [];
export const DEFAULT_EXCHANGE_RATES: DailyExchangeRate[] = [];
export const DEFAULT_FUTURE_RATE_HISTORY: FutureExchangeRateSnapshot[] = [];
export const DEFAULT_MARKET_PRICE_HISTORY: MarketPriceSnapshot[] = [];
export const DEFAULT_ARBITRAGE_OPS: ArbitrageOperation[] = [];
export const DEFAULT_CASH_ACCOUNTS: CashAccount[] = [];
export const DEFAULT_CASH_FLOW_ENTRIES: CashFlowEntry[] = [];
export const DEFAULT_GRAIN_COLLECTIONS: GrainCollection[] = [];
export const DEFAULT_COLLECTION_ADJUSTMENTS: CollectionAdjustment[] = [];
export const DEFAULT_HOLIDAYS: string[] = [];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  annualRateBasis: 365,
  showFinancialBreakdownSection: true,
  showUsdAnalysisSection: true,
};

// FIX: Moved getInitialState here to allow its use in mock services without circular dependencies.
export const getInitialState = (): AppState => ({
    currentUser: null,
    sessionToken: null,
    users: [],
    companies: DEFAULT_COMPANIES,
    banks: DEFAULT_BANKS,
    brokers: DEFAULT_BROKERS,
    debtTypes: DEFAULT_DEBT_TYPES,
    investmentTypes: DEFAULT_INVESTMENT_TYPES,
    currencies: DEFAULT_CURRENCIES,
    businessUnits: DEFAULT_BUSINESS_UNITS,
    assignments: DEFAULT_ASSIGNMENTS,
    customFields: DEFAULT_CUSTOM_FIELDS,
    appSettings: DEFAULT_SETTINGS,
    debts: DEFAULT_DEBTS,
    investments: DEFAULT_INVESTMENTS,
    exchangeRates: DEFAULT_EXCHANGE_RATES,
    futureRateHistory: DEFAULT_FUTURE_RATE_HISTORY,
    marketPriceHistory: DEFAULT_MARKET_PRICE_HISTORY,
    arbitrageOperations: DEFAULT_ARBITRAGE_OPS,
    cashAccounts: DEFAULT_CASH_ACCOUNTS,
    cashFlowEntries: DEFAULT_CASH_FLOW_ENTRIES,
    grainCollections: DEFAULT_GRAIN_COLLECTIONS,
    collectionAdjustments: DEFAULT_COLLECTION_ADJUSTMENTS,
    holidays: DEFAULT_HOLIDAYS,
    activeView: 'global-dashboard',
    isSidebarOpen: true,
    isDebtFormOpen: false,
    debtToEdit: null,
    isConsolidatedSelectorOpen: false,
    viewMode: 'individual',
    selectedCompanyId: null,
    selectedConsolidatedCompanyIds: [],
    toasts: [],
});