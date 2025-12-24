export type View = 'global-dashboard' | 'debt' | 'debtReport' | 'investment' | 'investmentReport' | 'cashflow' | 'arbitrage' | 'fwdPesificados' | 'rofexAnalysis' | 'settings' | 'grainCollection' | 'netPosition' | 'my-profile';

export enum Currency {
  ARS = 'ARS',
  USD = 'USD',
}

export type Role = 'admin' | 'operator' | 'viewer';

export type Permissions = {
  [key in View]?: Role;
};

export interface User {
  id: string;
  username: string;
  email?: string;
  password_plaintext: string; // WARNING: For demo purposes only.
  // FIX: Add role to User type. This property was missing but used in several components.
  role: Role;
  permissions: Permissions;
  companyIds: string[];
}

export interface Company {
  id: string;
  name: string;
}

export interface Cost {
    value: number;
    type?: 'percentage' | 'amount';
    timing: 'V' | 'A'; // Vencido o Adelantado
}

export interface Debt {
  id: string;
  companyId: string;
  type: string;
  bankId?: string;
  brokerId?: string;
  amount: number;
  currency: Currency;
  currencySubtypeId?: string;
  rate: number; // TNA
  originationDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  commission: Cost | number; // number for legacy
  stamps: Cost | number; // number for legacy
  marketRights?: Cost;
  exchangeRateAtOrigination: number;
  calculationMode?: 'presentValue' | 'futureValue';
  netAmountReceived?: number;
  linkedArbitrageOpIds?: string[];
  // New fields for cancellation and overdue management
  status?: 'active' | 'cancelled'; // 'active' includes current and overdue
  actualCancellationDate?: string; // YYYY-MM-DD
  punitiveInterestRate?: number; // TNA for punitive interest
  paidInterestAmount?: number; // User-confirmed interest paid on cancellation
  cancellationPenalty?: number; // User-entered penalty for early cancellation
}

export interface DebtType {
    id: string;
    name: string;
    allowedCurrencies: Currency[];
    category: 'bancaria' | 'mercado';
}

export interface CreditLine {
    id: string;
    companyId: string;
    debtType: string;
    currency: Currency;
    currencySubtypeId?: string;
    amount: number;
}

export interface Bank {
  id: string;
  name: string;
  creditLines: CreditLine[];
  creditLinesDueDate?: string;
}

export interface Broker {
    id: string;
    name: string;
}

export interface AppCurrency {
    id: Currency;
    name: string;
    subtypes: { id: string; name: string }[];
}

export interface DailyExchangeRate {
  date: string; // YYYY-MM-DD
  rate: number;
  companyId?: string; // This might not be needed if rates are global
}

export interface FutureExchangeRate {
    id: string;
    date: string;
    rate: number;
}

export interface FutureExchangeRateSnapshot {
    snapshotDate: string;
    rates: FutureExchangeRate[];
}

export interface AppSettings {
    theme: 'light' | 'dark';
    annualRateBasis: 360 | 365;
    showFinancialBreakdownSection: boolean;
    showUsdAnalysisSection: boolean;
}

export interface Notification {
    id: string;
    message: string;
    dueDate: string;
    isRead: boolean;
    relatedId: string;
    type: 'debt-maturity';
}

// Arbitrage related types
export type ArbitragePosition = 'Comprada' | 'Vendida';
export type ArbitrageInstrument = 'ROFEX' | 'NDF' | 'NDF Cliente';

export interface ArbitrageOperation {
    id: string;
    companyId: string;
    instrument: ArbitrageInstrument;
    position: ArbitragePosition;
    usdAmount: number;
    startDate: string;
    arbitrageDate: string;
    arbitrageRate: number;
    cancellationDate?: string;
    cancellationRate?: number;
    businessUnitId?: string;
    assignmentId?: string;
    detail?: string;
    bankId?: string;
    brokerId?: string;
    customData?: Record<string, string | number>;
    linkedDebtId?: string;
    linkedTransactionId?: string;
    pnl_ars?: number;
    pnl_usd?: number;
    rofexRate?: number | null;
    calculatedCustomData?: Record<string, string|number>;
    // FWD Pesificados fields
    internalArbitrageRate?: number;
    client?: string;
    branch?: string; // Sucursal
    salesperson?: string; // Comercial
}

export type ArbitrageDetails = Omit<ArbitrageOperation, 'companyId' | 'pnl_ars' | 'pnl_usd' | 'rofexRate' | 'calculatedCustomData'>;

export interface BusinessUnit {
    id: string;
    name: string;
    admiteSpread?: boolean;
}

export interface Assignment {
    id: string;
    name: string;
}

export interface ArbitrageCustomField {
    id: string;
    name: string;
    type: 'text' | 'number' | 'date';
    fieldType: 'manual' | 'calculated';
    formula?: string;
    isRequired?: boolean;
}

// Investment related types
export interface InvestmentType {
    id: string;
    name: string;
    allowedCurrencies: Currency[];
}

export interface Transaction {
    id: string;
    brokerId?: string;
    bankId?: string;
    type: 'Compra' | 'Venta';
    date: string;
    quantity: number;
    price: number;
    exchangeRate: number;
    notes?: string;
    isFixedRate?: boolean;
    tea?: number;
    dueDate?: string;
    linkedArbitrageOpIds?: string[];
}

export interface Investment {
    id: string;
    companyId: string;
    instrumentName: string;
    investmentTypeId: string;
    currency: Currency;
    currencySubtypeId?: string;
    transactions: Transaction[];
}

export interface MarketPriceSnapshot {
    date: string;
    prices: Record<string, number>; // instrumentName (lowercase) -> price
}

export interface BrokerDetail {
    brokerId?: string;
    brokerName?: string;
    bankId?: string;
    bankName?: string;
    transactions: Transaction[];
    totalQuantity: number;
    totalCostNative: number;
    totalProceedsNative: number;
    totalCostUSD: number;
    totalProceedsUSD: number;
    avgBuyPriceNative: number;
    avgBuyPriceUSD: number;
    realizedPL_Native: number;
    realizedPL_USD: number;
}

export interface GroupedHolding {
    instrumentId: string;
    instrumentName: string;
    investmentTypeId: string;
    investmentTypeName: string;
    currency: Currency;
    currencySubtypeId?: string;
    brokerDetails: BrokerDetail[];
    isFixedRate: boolean;
    maturityDate?: string;
    marketPrice: number;
    totalQuantity: number;
    marketValue: number;
    marketValueUSD: number;
    remainingCostBasisUSD: number;
    totalPL_Native: number;
    totalPL_USD: number;
    arbitragePL_Native: number;
    arbitragePL_USD: number;
    totalYieldPercent_Native: number;
    totalYieldPercent_USD: number;
    tea_Native: number;
    tea_USD: number;
    tea_total_USD: number;
    companyId: string;
    isActive: boolean;
}

export interface InvestmentGroup {
    groupName: string;
    holdings: GroupedHolding[];
    totalMarketValueUSD: number;
}

// Cash Flow types
export interface CashAccount {
    id: string;
    name: string;
    currency: Currency;
    initialBalance: number;
    initialBalanceDate: string;
}

export interface CashFlowEntry {
    id: string;
    accountId: string;
    date: string;
    amount: number;
    description: string;
    type: 'manual' | 'debt-disbursement' | 'debt-repayment' | 'investment-purchase' | 'investment-sale';
    linkedId?: string;
}

export interface ProjectedCashFlow {
    date: string;
    balance: number;
    inflows: number;
    outflows: number;
}

// Grain Collection types
export interface GrainCollection {
  id: string;
  companyId: string;
  operationCode: string;
  buyerName: string;
  cuit: string;
  issueDate: string;
  dueDate: string;
  actualCollectionDate?: string;
  grossAmount: number;
  movementType: 'Débito' | 'Crédito';
  tentativeDeductionPercentage: number;
  finalNetAmount?: number;
  status: 'matched' | 'unmatched' | 'collected';
  bankAccountId?: string; // Can hold a bank ID or static strings like 'cheque', 'compensacion'
}

export interface CollectionAdjustment {
  id: string;
  companyId: string;
  date: string; // YYYY-MM-DD
  buyerName: string;
  amount: number;
  type: 'Cheque' | 'Compensa' | 'Pase a Alyc' | 'Ajuste';
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface AppState {
    currentUser: User | null;
    sessionToken: string | null;
    users: User[];
    companies: Company[];
    banks: Bank[];
    brokers: Broker[];
    debtTypes: DebtType[];
    investmentTypes: InvestmentType[];
    currencies: AppCurrency[];
    businessUnits: BusinessUnit[];
    assignments: Assignment[];
    customFields: ArbitrageCustomField[];
    appSettings: AppSettings;
    debts: Debt[];
    investments: Investment[];
    exchangeRates: DailyExchangeRate[];
    futureRateHistory: FutureExchangeRateSnapshot[];
    marketPriceHistory: MarketPriceSnapshot[];
    arbitrageOperations: ArbitrageOperation[];
    cashAccounts: CashAccount[];
    cashFlowEntries: CashFlowEntry[];
    grainCollections: GrainCollection[];
    collectionAdjustments: CollectionAdjustment[];
    holidays: string[];
    activeView: View;
    isSidebarOpen: boolean;
    isDebtFormOpen: boolean;
    debtToEdit: Debt | null;
    isConsolidatedSelectorOpen: boolean;
    viewMode: 'individual' | 'consolidated';
    selectedCompanyId: string | null;
    selectedConsolidatedCompanyIds: string[];
    toasts: Toast[];
}