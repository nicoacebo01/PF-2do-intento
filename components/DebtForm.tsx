import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { Debt, Bank, DebtType, DailyExchangeRate, AppCurrency, Broker, ArbitrageDetails, BusinessUnit, Assignment, ArbitrageCustomField, ArbitrageOperation, Cost } from '../types';
import { Currency } from '../types';
import { XIcon, PlusCircleIcon, PencilIcon, TrashIcon } from './Icons';
import ComprehensiveArbitrageModal from './ComprehensiveArbitrageModal';
import FormattedNumberInput from './FormattedNumberInput';
import { useAppContext } from '../App';
import * as api from '../services/api';
import HelpTooltip from './HelpTooltip';

type DebtFormData = Omit<Debt, 'id' | 'companyId' | 'linkedArbitrageOpIds'> & { arbitrages?: ArbitrageDetails[] };

const DebtForm: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { debtToEdit, banks, brokers, debtTypes, exchangeRates, currencies, arbitrageOperations, businessUnits, assignments, customFields, appSettings, selectedCompanyId } = state;
  const [isLoading, setIsLoading] = useState(false);
  
  const onClose = () => dispatch({ type: 'CLOSE_DEBT_FORM' });
  
  const isEditing = !!debtToEdit;

  // Mode state
  const [calculationMode, setCalculationMode] = useState<'presentValue' | 'futureValue'>('presentValue');
  
  // Debt State
  const [type, setType] = useState<string>('');
  const [bankId, setBankId] = useState<string>('');
  const [brokerId, setBrokerId] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>(''); // Present value OR Future value depending on mode
  const [netAmountReceived, setNetAmountReceived] = useState<number | ''>(''); // For futureValue mode
  const [currency, setCurrency] = useState<Currency>(Currency.ARS);
  const [currencySubtypeId, setCurrencySubtypeId] = useState<string>('');
  const [exchangeRateAtOrigination, setExchangeRateAtOrigination] = useState<number | ''>('');
  const [originationDate, setOriginationDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [commission, setCommission] = useState<{ value: number | ''; timing: 'V' | 'A' }>({ value: '', timing: 'A' });
  const [stamps, setStamps] = useState<{ value: number | ''; timing: 'V' | 'A' }>({ value: '', timing: 'A' });
  const [marketRights, setMarketRights] = useState<{ value: number | ''; timing: 'V' | 'A' }>({ value: '', timing: 'A' });
  const [punitiveInterestRate, setPunitiveInterestRate] = useState<number | ''>('');
  
  // Arbitrage State
  const [arbitrages, setArbitrages] = useState<ArbitrageDetails[]>([]);
  const [isArbitrageModalOpen, setIsArbitrageModalOpen] = useState(false);
  const [editingArbitrage, setEditingArbitrage] = useState<ArbitrageDetails | null>(null);

  // Rate State
  const [rate, setRate] = useState<number | ''>('');
  const [rateInputType, setRateInputType] = useState<'tna' | 'direct'>('tna');
  const [directRate, setDirectRate] = useState<number | ''>('');

  const commonSelectClass = "mt-1 block w-full pl-3 pr-10 py-1.5 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 disabled:bg-gray-100 disabled:text-gray-800 dark:disabled:bg-gray-600 dark:disabled:text-gray-400";
  const commonRadioClass = "h-4 w-4 text-primary focus:ring-primary border-gray-300 bg-white dark:bg-gray-900 dark:border-gray-600 dark:checked:bg-primary";
  const labelClass = "block text-xs font-medium text-gray-700 dark:text-gray-300";
  
  const showRateWarning = useMemo(() => {
    if (debtToEdit) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    if (originationDate !== todayStr) return false;
    if (currency !== Currency.ARS) return false;
    const rateForTodayExists = exchangeRates.some(r => r.date === todayStr);
    return !rateForTodayExists;
  }, [debtToEdit, originationDate, currency, exchangeRates]);

  useEffect(() => {
    if (debtToEdit) {
        setCalculationMode(debtToEdit.calculationMode || 'presentValue');
        setType(debtToEdit.type);
        setBankId(debtToEdit.bankId || '');
        setBrokerId(debtToEdit.brokerId || '');
        setAmount(debtToEdit.amount);
        setNetAmountReceived(debtToEdit.netAmountReceived || '');
        setCurrency(debtToEdit.currency);
        setCurrencySubtypeId(debtToEdit.currencySubtypeId || '');
        setExchangeRateAtOrigination(debtToEdit.exchangeRateAtOrigination);
        setOriginationDate(debtToEdit.originationDate);
        setDueDate(debtToEdit.dueDate);
        
        const normalizeCost = (cost: Cost | number | undefined): { value: number | ''; timing: 'V' | 'A' } => {
            if (typeof cost === 'number') {
                if (cost > 1000) {
                    console.warn(`Corrupt legacy cost data detected in form (large number: ${cost}). Ignoring value.`, { debtToEdit, costValue: cost });
                    return { value: '', timing: 'V' };
                }
                const calculatedValue = (debtToEdit.amount * cost) / 100;
                return { value: calculatedValue, timing: 'V' };
            }
            if (cost) {
                if (typeof cost === 'object' && cost !== null && 'id' in cost && 'companyId' in cost) {
                    console.warn("Corrupt cost data detected in form (looks like a Debt object). Ignoring value.", { debtToEdit, costObject: cost });
                    return { value: '', timing: (cost as any).timing || 'A' };
                }
                const value = (cost as any).value ?? (cost as any).amount;
                if ((cost as any).type === 'percentage') {
                    const calculatedValue = (debtToEdit.amount * (value || 0)) / 100;
                    return { value: calculatedValue, timing: cost.timing || 'A' };
                }
                return { value: value ?? '', timing: cost.timing || 'A' };
            }
            return { value: '', timing: 'A' };
        };

        setCommission(normalizeCost(debtToEdit.commission));
        setStamps(normalizeCost(debtToEdit.stamps));
        setMarketRights(normalizeCost(debtToEdit.marketRights));

        setPunitiveInterestRate(debtToEdit.punitiveInterestRate || '');
        setRate(debtToEdit.rate);
        const linkedOps = (debtToEdit.linkedArbitrageOpIds || []).map(id => arbitrageOperations.find(op => op.id === id)).filter((op): op is ArbitrageOperation => !!op).map(op => ({ ...op, id: op.id }));
        setArbitrages(linkedOps);
    } else {
        if (debtTypes.length > 0) setType(debtTypes[0].name);
        setOriginationDate(new Date().toISOString().split('T')[0]);
    }
  }, [debtToEdit, debtTypes, arbitrageOperations]);

  useEffect(() => {
    if (!debtToEdit && currency === Currency.ARS && originationDate && exchangeRates) {
      const rateForDate = exchangeRates.find(r => r.date === originationDate);
      if (rateForDate) setExchangeRateAtOrigination(rateForDate.rate);
    }
  }, [originationDate, currency, debtToEdit, exchangeRates]);

  const selectedDebtType = useMemo(() => debtTypes.find(dt => dt.name === type), [type, debtTypes]);
  const selectedCurrencyDetails = useMemo(() => currencies.find(c => c.id === currency), [currency, currencies]);

  useEffect(() => {
    if (selectedDebtType && !selectedDebtType.allowedCurrencies.includes(currency)) {
      setCurrency(selectedDebtType.allowedCurrencies[0] || Currency.ARS);
    }
    setBankId(banks.length > 0 && selectedDebtType?.category === 'bancaria' ? banks[0].id : '');
    setBrokerId(brokers.length > 0 && selectedDebtType?.category === 'mercado' ? brokers[0].id : '');
  }, [type, currency, selectedDebtType, banks, brokers]);

  useEffect(() => {
    if (selectedCurrencyDetails?.subtypes.length > 0) {
      if (!selectedCurrencyDetails.subtypes.find(st => st.id === currencySubtypeId)) {
        setCurrencySubtypeId(selectedCurrencyDetails.subtypes[0].id);
      }
    } else {
      setCurrencySubtypeId('');
    }
  }, [currency, selectedCurrencyDetails, currencySubtypeId]);

  const termInDays = useMemo(() => {
    if (!originationDate || !dueDate) return 0;
    const start = new Date(originationDate); const end = new Date(dueDate);
    if (end <= start) return 0;
    const startUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const endUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    return (endUTC - startUTC) / (1000 * 3600 * 24);
  }, [originationDate, dueDate]);
  
  useEffect(() => {
    if (calculationMode === 'futureValue') {
        if (amount && netAmountReceived && termInDays > 0) {
            const futureValue = Number(amount);
            const presentValue = Number(netAmountReceived);
            if (presentValue > 0 && futureValue > presentValue) {
                const annualRateBasis = appSettings.annualRateBasis || 365;
                const interest = futureValue - presentValue;
                const rateForPeriod = interest / presentValue;
                const tna = (rateForPeriod / termInDays) * annualRateBasis * 100;
                setRate(tna);
                return;
            }
        }
        setRate('');
    }
  }, [calculationMode, amount, netAmountReceived, termInDays, appSettings?.annualRateBasis]);

  useEffect(() => {
    if (rateInputType === 'direct' && directRate !== '' && termInDays > 0) {
        const tna = (Number(directRate) / termInDays) * 365 * 100;
        setRate(tna);
    }
  }, [directRate, termInDays, rateInputType]);

  useEffect(() => {
    if (rateInputType === 'tna' && rate !== '' && termInDays > 0) {
        const direct = (Number(rate) / 100 / 365) * termInDays;
        setDirectRate(direct);
    }
  }, [rate, termInDays, rateInputType]);

  const handleSaveArbitrage = (data: ArbitrageDetails) => {
    if (editingArbitrage) {
        setArbitrages(prev => prev.map(a => a.id === editingArbitrage.id ? data : a));
    } else {
        setArbitrages(prev => [...prev, { ...data, id: `temp-${crypto.randomUUID()}` }]);
    }
    setIsArbitrageModalOpen(false);
    setEditingArbitrage(null);
  };

  const handleDeleteArbitrage = (id: string) => {
    setArbitrages(prev => prev.filter(a => a.id !== id));
  };
  
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount === '' || rate === '' || !type || (!bankId && !brokerId) || !originationDate || !dueDate || (currency === Currency.ARS && exchangeRateAtOrigination === '')) {
        alert('Por favor, complete todos los campos obligatorios.');
        return;
    }
    if (calculationMode === 'futureValue' && netAmountReceived === '') {
        alert('Por favor, ingrese el Bruto Recibido para el modo de valor futuro.');
        return;
    }
    setIsLoading(true);

    const debtData: DebtFormData = {
        type, bankId: bankId || undefined, brokerId: brokerId || undefined,
        amount: Number(amount),
        netAmountReceived: calculationMode === 'futureValue' ? Number(netAmountReceived) : undefined,
        currency, currencySubtypeId: currencySubtypeId || undefined, rate: Number(rate),
        punitiveInterestRate: Number(punitiveInterestRate || 0),
        commission: { value: Number(commission.value || 0), timing: commission.timing },
        stamps: { value: Number(stamps.value || 0), timing: stamps.timing },
        marketRights: { value: Number(marketRights.value || 0), timing: marketRights.timing },
        originationDate, dueDate, exchangeRateAtOrigination: Number(exchangeRateAtOrigination),
        calculationMode, arbitrages, status: 'active',
    };

    try {
      // FIX: The api.saveDebt function expects a `companyId` in its first argument due to its type,
      // even though it gets it from the third argument. We'll add it here and cast to satisfy TypeScript,
      // as `debtData` also contains an `arbitrages` property not declared in the destination type.
      const { savedDebt, updatedArbitrageOps } = await api.saveDebt({ ...debtData, companyId: selectedCompanyId! } as any, debtToEdit?.id, selectedCompanyId);
      dispatch({ type: 'SAVE_DEBT_SUCCESS', payload: { savedDebt, updatedArbitrageOps } });
      onClose();
    } catch (error) {
        console.error("Failed to save debt:", error);
        alert("Error al guardar la deuda.");
    } finally {
        setIsLoading(false);
    }
  }, [ debtToEdit, type, bankId, brokerId, amount, netAmountReceived, currency, currencySubtypeId, rate, commission, stamps, marketRights, originationDate, dueDate, exchangeRateAtOrigination, calculationMode, punitiveInterestRate, arbitrages, selectedCompanyId, dispatch, onClose ]);

  const renderCostInput = (
      state: { value: number | ''; timing: 'V' | 'A' },
      setState: React.Dispatch<React.SetStateAction<any>>,
      label: string
  ) => (
      <div className="grid grid-cols-3 gap-2 items-end">
          <div className="col-span-2">
              <label className={labelClass}>{label}</label>
              <FormattedNumberInput value={state.value} onChange={v => setState((s: any) => ({...s, value: v}))} className="mt-1" />
          </div>
          <div>
              <label className={`${labelClass} flex items-center gap-1`}>
                Timing
                <HelpTooltip text={"Adelantado: El costo se deduce del monto que recibes al inicio de la operación. Esto aumenta el costo financiero real (CFT).\nVencido: El costo se suma al monto que pagas al final de la operación."} />
              </label>
              <select value={state.timing} onChange={e => setState((s: any) => ({...s, timing: e.target.value as 'V' | 'A'}))} className={commonSelectClass}>
                  <option value="A">Adelantado</option>
                  <option value="V">Vencido</option>
              </select>
          </div>
      </div>
  );

  return (
    <>
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl m-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{isEditing ? 'Editar' : 'Registrar'} Deuda</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"><XIcon /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <fieldset className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                        <legend className="text-xs font-medium text-gray-900 dark:text-gray-200 flex items-center gap-2">
                            Modo de Cálculo
                            <HelpTooltip text={"Valor Presente: Úsalo para préstamos típicos. Ingresas el capital que recibes (`Monto Capital`) y el sistema calcula los intereses y el monto final a pagar.\nValor Futuro: Úsalo para instrumentos de descuento (ej. Descuento de Cheques, Pagarés). Ingresas el valor final del documento (`Valor Futuro`) y el sistema calcula el neto que recibes al descontar los intereses y gastos."}/>
                        </legend>
                        <div className="mt-2 flex items-center gap-6">
                            <div className="flex items-center gap-2"><input type="radio" id="mode-pv" value="presentValue" checked={calculationMode === 'presentValue'} onChange={() => setCalculationMode('presentValue')} className={commonRadioClass}/><label htmlFor="mode-pv" className="text-gray-900 dark:text-gray-200 text-sm">Valor Presente</label></div>
                            <div className="flex items-center gap-2"><input type="radio" id="mode-fv" value="futureValue" checked={calculationMode === 'futureValue'} onChange={() => setCalculationMode('futureValue')} className={commonRadioClass}/><label htmlFor="mode-fv" className="text-gray-900 dark:text-gray-200 text-sm">Valor Futuro (Descuento)</label></div>
                        </div>
                    </fieldset>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div><label className={labelClass}>Tipo de Deuda</label><select value={type} onChange={e => setType(e.target.value)} className={commonSelectClass} required><option value="" disabled>Seleccione</option>{debtTypes.map(dt => <option key={dt.id} value={dt.name}>{dt.name}</option>)}</select></div>
                        {selectedDebtType?.category === 'bancaria' ? (
                            <div><label className={labelClass}>Banco</label><select value={bankId} onChange={e => setBankId(e.target.value)} className={commonSelectClass} required><option value="" disabled>Seleccione</option>{banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                        ) : (
                            <div><label className={labelClass}>Broker</label><select value={brokerId} onChange={e => setBrokerId(e.target.value)} className={commonSelectClass} required><option value="" disabled>Seleccione</option>{brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div><label className={labelClass}>{calculationMode === 'presentValue' ? 'Capital' : 'Valor Futuro'}</label><FormattedNumberInput value={amount} onChange={setAmount} className="mt-1" required /></div>
                        {calculationMode === 'futureValue' && <div><label className={labelClass}>Bruto Recibido</label><FormattedNumberInput value={netAmountReceived} onChange={setNetAmountReceived} className="mt-1" required /></div>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div><label className={labelClass}>Moneda</label><select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={commonSelectClass}>{(selectedDebtType?.allowedCurrencies || Object.values(Currency)).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        {selectedCurrencyDetails?.subtypes.length > 0 && <div><label className={labelClass}>Subtipo</label><select value={currencySubtypeId} onChange={e => setCurrencySubtypeId(e.target.value)} className={commonSelectClass} required><option value="" disabled>Seleccione</option>{selectedCurrencyDetails.subtypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}</select></div>}
                        {currency === Currency.ARS && <div><label className={labelClass}>TC al Origen</label><FormattedNumberInput value={exchangeRateAtOrigination} onChange={setExchangeRateAtOrigination} className="mt-1" required /></div>}
                    </div>

                    {showRateWarning && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3 my-2 rounded-r-lg" role="alert">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                <strong>Atención:</strong> No se ha cargado el tipo de cambio para hoy. Por favor, ingrese el valor manualmente. Los cálculos en USD pueden ser imprecisos hasta que se actualice la cotización del día.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div><label className={labelClass}>Fecha Otorgamiento</label><input type="date" value={originationDate} onChange={e => setOriginationDate(e.target.value)} className={commonSelectClass.replace('pr-10','pr-3')} required/></div>
                        <div><label className={labelClass}>Fecha Vencimiento</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} min={originationDate} className={commonSelectClass.replace('pr-10','pr-3')} required/></div>
                    </div>
                    
                    <div className="border-t pt-3 space-y-3">
                      {renderCostInput(commission, setCommission, 'Comisión')}
                      {renderCostInput(stamps, setStamps, 'Sellos')}
                      {renderCostInput(marketRights, setMarketRights, 'Der. Mercado')}
                    </div>

                    <div className="border-t pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>TNA (%)</label>
                        <FormattedNumberInput value={rate} onChange={setRate} className="mt-1" required disabled={calculationMode === 'futureValue'} />
                      </div>
                      <div>
                        <label className={`${labelClass} flex items-center gap-2`}>
                            TNA Moratoria (Post-Vencimiento) (%)
                            <HelpTooltip text={"Es la Tasa Nominal Anual que se aplicará sobre el capital si la deuda no se cancela en su fecha de vencimiento. Si se deja en cero, se asumirá que no hay interés punitorio."}/>
                        </label>
                        <FormattedNumberInput value={punitiveInterestRate} onChange={setPunitiveInterestRate} className="mt-1" placeholder="Opcional" />
                      </div>
                    </div>

                    {currency === Currency.ARS && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg space-y-2">
                           <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Coberturas de Tipo de Cambio</h3>
                           {arbitrages.map(arb => (
                               <div key={arb.id} className="bg-white dark:bg-gray-700 p-2 rounded-md shadow-sm border dark:border-gray-600 flex justify-between items-center">
                                   <div><p className="text-sm font-medium text-gray-800 dark:text-gray-100">TC: <span className="font-bold text-primary dark:text-accent-dm">${arb.arbitrageRate.toLocaleString('es-AR')}</span> - Vto: <span className="font-bold">{new Date(arb.arbitrageDate).toLocaleDateString('es-AR', {timeZone: 'UTC'})}</span></p><p className="text-xs text-gray-500 dark:text-gray-400">Monto: USD {arb.usdAmount.toLocaleString('es-AR')} - {arb.instrument}</p></div>
                                   <div><button type="button" onClick={() => { setEditingArbitrage(arb); setIsArbitrageModalOpen(true); }} className="text-blue-600 p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full"><PencilIcon/></button><button type="button" onClick={() => handleDeleteArbitrage(arb.id)} className="text-red-600 p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><TrashIcon/></button></div>
                               </div>
                           ))}
                           <button type="button" onClick={() => { setEditingArbitrage(null); setIsArbitrageModalOpen(true); }} className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 text-primary dark:text-accent-dm font-bold py-2 px-4 rounded-lg border-2 border-dashed border-primary dark:border-accent-dm transition-colors disabled:bg-gray-200" disabled={!originationDate || !dueDate} title={(!originationDate || !dueDate) ? "Complete las fechas" : "Agregar cobertura"}><PlusCircleIcon/> Agregar Cobertura</button>
                      </div>
                    )}
                    
                    <div className="flex justify-end gap-4 pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200">Cancelar</button>
                        <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg" disabled={isLoading}>
                            {isLoading ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Guardar')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
        {isArbitrageModalOpen && (
            <ComprehensiveArbitrageModal
                initialData={editingArbitrage}
                onSave={handleSaveArbitrage}
                onClose={() => setIsArbitrageModalOpen(false)}
                brokers={brokers}
                banks={banks}
                businessUnits={businessUnits}
                assignments={assignments}
                customFields={customFields}
            />
        )}
    </>
  );
};

export default DebtForm;