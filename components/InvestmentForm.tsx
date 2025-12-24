import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Transaction, Investment, InvestmentType, Broker, Bank, AppCurrency, DailyExchangeRate, ArbitrageDetails, ArbitrageOperation, BusinessUnit, Assignment, ArbitrageCustomField } from '../types';
import { Currency } from '../types';
import { XIcon, PlusCircleIcon, PencilIcon, TrashIcon } from './Icons';
import ComprehensiveArbitrageModal from './ComprehensiveArbitrageModal';
import FormattedNumberInput from './FormattedNumberInput';
import { useAppContext } from '../App';

type TransactionFormData = Omit<Transaction, 'id' | 'linkedArbitrageOpIds'> & { arbitrages?: ArbitrageDetails[] };
type InvestmentShell = Omit<Investment, 'id' | 'companyId' | 'transactions'>;

interface InvestmentFormProps {
    onSave: (transactionFormData: TransactionFormData, investmentShell: InvestmentShell, transactionId?: string) => void;
    onClose: () => void;
    editingData?: { investmentId: string; transaction: Transaction } | null;
}

const InvestmentForm: React.FC<InvestmentFormProps> = (props) => {
    const { onSave, onClose, editingData } = props;
    const { state } = useAppContext();
    const { investments, investmentTypes, brokers, banks, currencies, exchangeRates, arbitrageOperations, businessUnits, assignments, customFields } = state;
    
    const investmentToEdit = useMemo(() => editingData ? investments.find(i => i.id === editingData.investmentId) : null, [editingData, investments]);
    const transactionToEdit = useMemo(() => editingData ? editingData.transaction : null, [editingData]);

    const isEditing = !!transactionToEdit;
    
    const [isNewInstrument, setIsNewInstrument] = useState(false);
    const [templateInvestmentId, setTemplateInvestmentId] = useState<string>('');

    // --- Form State ---
    const [instrumentName, setInstrumentName] = useState('');
    const [investmentTypeId, setInvestmentTypeId] = useState<string>('');
    const [currency, setCurrency] = useState<Currency>(Currency.ARS);
    const [currencySubtypeId, setCurrencySubtypeId] = useState<string>('');
    const [counterparty, setCounterparty] = useState(''); // e.g., 'broker-xyz' or 'bank-abc'

    // Transaction details
    const [type, setType] = useState<'Compra' | 'Venta'>('Compra');
    const [date, setDate] = useState('');
    const [quantity, setQuantity] = useState<number | ''>('');
    const [price, setPrice] = useState<number | ''>('');
    const [exchangeRate, setExchangeRate] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [isFixedRate, setIsFixedRate] = useState(false);
    const [tea, setTea] = useState<number | ''>('');
    const [maturityType, setMaturityType] = useState<'liquid' | 'fixed'>('liquid');
    const [dueDate, setDueDate] = useState('');

    // Arbitrage details
    const [arbitrages, setArbitrages] = useState<ArbitrageDetails[]>([]);
    const [isArbitrageModalOpen, setIsArbitrageModalOpen] = useState(false);
    const [editingArbitrage, setEditingArbitrage] = useState<ArbitrageDetails | null>(null);
    
    const uniqueInstruments = useMemo(() => {
        const unique = new Map<string, Investment>();
        investments.forEach(inv => {
            const key = `${inv.instrumentName.toLowerCase()}|${inv.currency}|${inv.investmentTypeId}`;
            if (!unique.has(key)) {
                unique.set(key, inv);
            }
        });
        return Array.from(unique.values());
    }, [investments]);
    
    // Effect to set initial state for new vs. edit
    useEffect(() => {
        if (isEditing && investmentToEdit && transactionToEdit) {
            setIsNewInstrument(true); 
            setInstrumentName(investmentToEdit.instrumentName);
            setInvestmentTypeId(investmentToEdit.investmentTypeId);
            setCurrency(investmentToEdit.currency);
            setCurrencySubtypeId(investmentToEdit.currencySubtypeId || '');
            
            if (transactionToEdit.brokerId) setCounterparty(`broker-${transactionToEdit.brokerId}`);
            else if (transactionToEdit.bankId) setCounterparty(`bank-${transactionToEdit.bankId}`);
            else setCounterparty('');
            
            setType(transactionToEdit.type);
            setDate(transactionToEdit.date);
            setQuantity(transactionToEdit.quantity);
            setPrice(transactionToEdit.price);
            setExchangeRate(transactionToEdit.exchangeRate);
            setNotes(transactionToEdit.notes || '');
            setIsFixedRate(transactionToEdit.isFixedRate || false);
            setTea(transactionToEdit.tea || '');
            setDueDate(transactionToEdit.dueDate || '');
            setMaturityType(transactionToEdit.dueDate ? 'fixed' : 'liquid');
            const linkedOps = (transactionToEdit.linkedArbitrageOpIds || []).map(id => arbitrageOperations.find(op => op.id === id)).filter((op): op is ArbitrageOperation => !!op);
            setArbitrages(linkedOps.map(op => ({...op, id: op.id})));

        } else {
            setDate(new Date().toISOString().split('T')[0]);
            setMaturityType('liquid');
            if (uniqueInstruments.length > 0) {
                setIsNewInstrument(false);
                setTemplateInvestmentId(uniqueInstruments[0].id);
            } else {
                setIsNewInstrument(true);
            }
        }
    }, [isEditing, investmentToEdit, transactionToEdit, uniqueInstruments, arbitrageOperations]);

    // Effect to populate form when a template is chosen or mode changes
    useEffect(() => {
        if (!isNewInstrument) {
            const template = investments.find(inv => inv.id === templateInvestmentId);
            if (template) {
                setInstrumentName(template.instrumentName);
                setInvestmentTypeId(template.investmentTypeId);
                setCurrency(template.currency);
                setCurrencySubtypeId(template.currencySubtypeId || '');
                setCounterparty(''); // Always reset counterparty when using a template
            }
        } else if (!isEditing) { // New Instrument Mode
            setInstrumentName('');
            setInvestmentTypeId(investmentTypes.length > 0 ? investmentTypes[0].id : '');
            setCurrency(Currency.ARS);
            // Set a default broker for new instruments
            if (brokers.length > 0) {
                setCounterparty(`broker-${brokers[0].id}`);
            } else if (banks.length > 0) {
                setCounterparty(`bank-${banks[0].id}`);
            } else {
                setCounterparty('');
            }
        }
    }, [isNewInstrument, templateInvestmentId, investments, isEditing, investmentTypes, brokers, banks]);

    useEffect(() => {
        const rateForDate = exchangeRates.find(r => r.date === date);
        if (rateForDate) setExchangeRate(rateForDate.rate);
    }, [date, exchangeRates]);
    
    useEffect(() => {
        if (isFixedRate) setMaturityType('fixed');
    }, [isFixedRate]);

    const selectedCurrencyDetails = useMemo(() => currencies.find(c => c.id === currency), [currency, currencies]);
    
    useEffect(() => {
        if (selectedCurrencyDetails?.subtypes.length > 0) {
          if (!selectedCurrencyDetails.subtypes.find(st => st.id === currencySubtypeId)) {
            setCurrencySubtypeId(selectedCurrencyDetails.subtypes[0].id);
          }
        } else {
          setCurrencySubtypeId('');
        }
    }, [currency, selectedCurrencyDetails, currencySubtypeId]);

    const handleSaveArbitrage = (data: ArbitrageDetails) => {
        if (editingArbitrage) {
            setArbitrages(prev => prev.map(a => a.id === editingArbitrage.id ? data : a));
        } else {
            setArbitrages(prev => [...prev, { ...data, id: `temp-${crypto.randomUUID()}` }]);
        }
        setIsArbitrageModalOpen(false);
        setEditingArbitrage(null);
    };

    const handleDeleteArbitrage = (id: string) => setArbitrages(prev => prev.filter(a => a.id !== id));

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();

        const firstHyphenIndex = counterparty.indexOf('-');
        const counterpartyType = firstHyphenIndex !== -1 ? counterparty.substring(0, firstHyphenIndex) : '';
        const counterpartyId = firstHyphenIndex !== -1 ? counterparty.substring(firstHyphenIndex + 1) : '';
        const brokerIdForTx = counterpartyType === 'broker' ? counterpartyId : undefined;
        const bankIdForTx = counterpartyType === 'bank' ? counterpartyId : undefined;

        const transactionFormData: TransactionFormData = {
            brokerId: brokerIdForTx,
            bankId: bankIdForTx,
            type, date, quantity: Number(quantity), price: Number(price),
            exchangeRate: Number(exchangeRate), notes, isFixedRate,
            tea: isFixedRate ? Number(tea) : undefined,
            dueDate: maturityType === 'fixed' && dueDate ? dueDate : undefined,
            arbitrages,
        };
        
        const investmentShell: InvestmentShell = { 
            instrumentName, 
            investmentTypeId, 
            currency,
            currencySubtypeId: currencySubtypeId || undefined,
        };

        onSave(transactionFormData, investmentShell, transactionToEdit?.id);

    }, [
        onSave, transactionToEdit, instrumentName, investmentTypeId, currency, currencySubtypeId, counterparty,
        type, date, quantity, price, exchangeRate, notes, isFixedRate, tea, dueDate, maturityType, arbitrages
    ]);

    const commonSelectClass = "mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 disabled:bg-gray-100 disabled:text-gray-800 dark:disabled:bg-gray-600 dark:disabled:text-gray-400";
    const commonInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 disabled:bg-gray-100 disabled:text-gray-800 dark:disabled:bg-gray-600 dark:disabled:text-gray-400";
    const commonCheckboxClass = "h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:bg-gray-900 dark:border-gray-600 dark:checked:bg-primary";

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-3xl m-4 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{isEditing ? 'Editar' : 'Registrar'} Transacción</h2><button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"><XIcon /></button></div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isEditing && (
                             <fieldset className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                                <legend className="text-sm font-medium text-gray-900 dark:text-gray-200">Instrumento</legend>
                                <div className="mt-2 flex items-center gap-6">
                                    <div className="flex items-center gap-2"><input type="radio" id="mode-existing" checked={!isNewInstrument} onChange={() => setIsNewInstrument(false)} disabled={uniqueInstruments.length === 0} className={commonCheckboxClass}/><label htmlFor="mode-existing" className="text-gray-900 dark:text-gray-200">Existente</label></div>
                                    <div className="flex items-center gap-2"><input type="radio" id="mode-new" checked={isNewInstrument} onChange={() => setIsNewInstrument(true)} className={commonCheckboxClass}/><label htmlFor="mode-new" className="text-gray-900 dark:text-gray-200">Nuevo</label></div>
                                </div>
                            </fieldset>
                        )}

                        {!isNewInstrument && !isEditing && (
                            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seleccionar Instrumento Base (Plantilla)</label><select value={templateInvestmentId} onChange={e => setTemplateInvestmentId(e.target.value)} className={commonSelectClass} required><option value="" disabled>Seleccione</option>{uniqueInstruments.map(inv => <option key={inv.id} value={inv.id}>{inv.instrumentName.toUpperCase()} ({inv.currency})</option>)}</select></div>
                        )}
                        
                        <div className="border dark:border-gray-700 p-4 rounded-lg space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre Instrumento</label><input type="text" value={instrumentName} onChange={e => setInstrumentName(e.target.value)} className={commonInputClass} placeholder="Ej: AL30" required disabled={!isNewInstrument || isEditing} /></div>
                                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Inversión</label><select value={investmentTypeId} onChange={e => setInvestmentTypeId(e.target.value)} className={commonSelectClass} required disabled={!isNewInstrument || isEditing}><option value="" disabled>Seleccione</option>{investmentTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}</select></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Moneda</label><select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={commonSelectClass} disabled={!isNewInstrument || isEditing}><option value="ARS">ARS</option><option value="USD">USD</option></select></div>
                                {selectedCurrencyDetails?.subtypes.length > 0 && <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subtipo</label><select value={currencySubtypeId} onChange={e => setCurrencySubtypeId(e.target.value)} className={commonSelectClass} required disabled={!isNewInstrument || isEditing}><option value="" disabled>Seleccione</option>{selectedCurrencyDetails.subtypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}</select></div>}
                                <div className={selectedCurrencyDetails?.subtypes.length > 0 ? '' : 'md:col-span-2'}><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contraparte</label><select value={counterparty} onChange={e => setCounterparty(e.target.value)} className={commonSelectClass} required disabled={isEditing}><option value="" disabled>Seleccione</option>{brokers.map(b => <option key={b.id} value={`broker-${b.id}`}>{b.name}</option>)}{banks.map(b => <option key={b.id} value={`bank-${b.id}`}>{b.name}</option>)}</select></div>
                            </div>
                        </div>
                        
                        <div className="border-t dark:border-gray-700 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Transacción</label>
                                <select value={type} onChange={e => setType(e.target.value as any)} className={commonSelectClass}>
                                    <option>Compra</option>
                                    <option>Venta</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={commonInputClass.replace('pr-10','pr-3')} required/>
                            </div>
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vencimiento</label>
                                    <div className="mt-2 flex items-center gap-6 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md">
                                        <div className="flex items-center gap-2">
                                            <input type="radio" id="maturity-fixed" name="maturityType" value="fixed" checked={maturityType === 'fixed'} onChange={() => setMaturityType('fixed')} className={commonCheckboxClass.replace('rounded', 'rounded-full')} disabled={isFixedRate} />
                                            <label htmlFor="maturity-fixed" className="text-sm text-gray-700 dark:text-gray-300">Fecha Fija</label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="radio" id="maturity-liquid" name="maturityType" value="liquid" checked={maturityType === 'liquid'} onChange={() => { setMaturityType('liquid'); setDueDate(''); }} className={commonCheckboxClass.replace('rounded', 'rounded-full')} disabled={isFixedRate} />
                                            <label htmlFor="maturity-liquid" className="text-sm text-gray-700 dark:text-gray-300">Líquida</label>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Vencimiento</label>
                                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={commonInputClass.replace('pr-10','pr-3')} min={date} disabled={maturityType === 'liquid'} required={maturityType === 'fixed'} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cantidad (Nominales)</label>
                                <FormattedNumberInput value={quantity} onChange={setQuantity} className="mt-1" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Precio</label>
                                <FormattedNumberInput value={price} onChange={setPrice} className="mt-1" required />
                            </div>
                            {currency === Currency.ARS && 
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">TC del Día</label>
                                    <FormattedNumberInput value={exchangeRate} onChange={setExchangeRate} className="mt-1" required />
                                </div>
                            }
                        </div>
                        
                        <div className="border-t dark:border-gray-700 pt-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="is-fixed-rate" checked={isFixedRate} onChange={e => setIsFixedRate(e.target.checked)} className={commonCheckboxClass} />
                                <label htmlFor="is-fixed-rate" className="text-sm font-medium text-gray-700 dark:text-gray-300">Es colocación a Tasa Fija (requiere vencimiento fijo)</label>
                            </div>
                            {isFixedRate && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">TEA (%)</label>
                                        <FormattedNumberInput value={tea} onChange={setTea} required />
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-3">
                           <h3 className="text-md font-semibold text-gray-700 dark:text-gray-200">Coberturas de Tipo de Cambio</h3>
                           {arbitrages.map(arb => ( <div key={arb.id} className="bg-white dark:bg-gray-700 p-3 rounded-md shadow-sm border dark:border-gray-600 flex justify-between items-center"><p className="text-sm font-medium text-gray-800 dark:text-gray-100">TC: <span className="font-bold text-primary dark:text-accent-dm">${arb.arbitrageRate.toLocaleString('es-AR')}</span> - Vto: <span className="font-bold">{new Date(arb.arbitrageDate).toLocaleDateString('es-AR')}</span></p><div><button type="button" onClick={() => { setEditingArbitrage(arb); setIsArbitrageModalOpen(true); }} className="text-blue-600 p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full"><PencilIcon/></button><button type="button" onClick={() => handleDeleteArbitrage(arb.id)} className="text-red-600 p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><TrashIcon/></button></div></div> ))}
                           <button type="button" onClick={() => { setEditingArbitrage(null); setIsArbitrageModalOpen(true); }} className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 text-primary dark:text-accent-dm font-bold py-2 px-4 rounded-lg border-2 border-dashed border-primary dark:border-accent-dm transition-colors"><PlusCircleIcon/> Agregar Cobertura</button>
                        </div>

                        <div className="flex justify-end gap-4 pt-4 border-t dark:border-gray-700"><button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200">Cancelar</button><button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg">{isEditing ? 'Guardar Cambios' : 'Guardar'}</button></div>
                    </form>
                </div>
            </div>
            {isArbitrageModalOpen && (
                <ComprehensiveArbitrageModal
                    initialData={editingArbitrage} onSave={handleSaveArbitrage} onClose={() => setIsArbitrageModalOpen(false)}
                    brokers={brokers} banks={banks} businessUnits={businessUnits} assignments={assignments} customFields={customFields}
                />
            )}
        </>
    );
};
export default InvestmentForm;