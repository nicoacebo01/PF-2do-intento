
import React, { useState, useMemo } from 'react';
import type { Debt, Bank, DebtType } from '../types';
import { Currency } from '../types';
import { XIcon, BoltIcon, InformationCircleIcon } from './Icons';
import FormattedNumberInput from './FormattedNumberInput';
import { calculateFinancialsForDate, daysBetween } from '../utils/financials';
import { formatPercentageForDisplay } from '../utils/formatting';

interface DebtOptimizerModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeDebts: Debt[];
    banks: Bank[];
    debtTypes: DebtType[];
    appSettings: any;
}

const DebtOptimizerModal: React.FC<DebtOptimizerModalProps> = ({ isOpen, onClose, activeDebts, banks, debtTypes, appSettings }) => {
    const [selectedDebtIds, setSelectedDebtIds] = useState<Set<string>>(new Set());
    
    // Replacement Debt Parameters
    const [newTna, setNewTna] = useState<number | ''>(40);
    const [newTerm, setNewTerm] = useState<number | ''>(180);
    const [newCommission, setNewCommission] = useState<number | ''>(1);

    const selectedDebts = useMemo(() => activeDebts.filter(d => selectedDebtIds.has(d.id)), [activeDebts, selectedDebtIds]);

    const optimizationResults = useMemo(() => {
        if (selectedDebts.length === 0 || !newTna || !newTerm) return null;

        let totalOriginalCostARS = 0;
        let totalOriginalPrincipalARS = 0;
        let totalOriginalPrincipalUSD = 0;

        selectedDebts.forEach(d => {
            const financials = calculateFinancialsForDate(d, new Date(d.dueDate + 'T00:00:00Z'), appSettings);
            // Cost is Total to Repay - Net Disbursed
            const costNative = financials.totalToRepay - financials.netDisbursed;
            const principalNative = d.amount;
            
            // For simplicity, convert all to ARS at origination rate if it's a mix
            const factor = d.currency === Currency.USD ? d.exchangeRateAtOrigination : 1;
            totalOriginalCostARS += costNative * factor;
            totalOriginalPrincipalARS += principalNative * factor;
            totalOriginalPrincipalUSD += d.currency === Currency.USD ? d.amount : d.amount / d.exchangeRateAtOrigination;
        });

        // Proposed Debt Calculation
        const tnaDec = Number(newTna) / 100;
        const commDec = Number(newCommission || 0) / 100;
        const days = Number(newTerm);
        
        // Simulating a standard ARS loan (presentValue mode)
        const interest = totalOriginalPrincipalARS * (tnaDec / appSettings.annualRateBasis) * days;
        const commission = totalOriginalPrincipalARS * commDec;
        const totalNewCostARS = interest + commission;
        const savingsARS = totalOriginalCostARS - totalNewCostARS;

        return {
            originalCostARS: totalOriginalCostARS,
            newCostARS: totalNewCostARS,
            savingsARS,
            savingsUSD: savingsARS / selectedDebts[0].exchangeRateAtOrigination, // using first debt's rate as proxy
            effectiveCftNew: ((totalNewCostARS / (totalOriginalPrincipalARS - commission)) / days) * appSettings.annualRateBasis * 100
        };
    }, [selectedDebts, newTna, newTerm, newCommission, appSettings]);

    const toggleDebt = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const setSelectedIds = setSelectedDebtIds;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-scale-in">
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 bg-gradient-to-r from-indigo-500/10 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <BoltIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Simulador de Refinanciación</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <XIcon className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                <div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
                    {/* Left: Debt Selection */}
                    <div className="w-full lg:w-1/2 p-6 overflow-y-auto border-r dark:border-gray-700">
                        <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-4">Paso 1: Selecciona Deuda a Cancelar</h3>
                        <div className="space-y-3">
                            {activeDebts.length > 0 ? activeDebts.map(d => (
                                <label key={d.id} className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${selectedDebtIds.has(d.id) ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/20' : 'bg-white dark:bg-gray-800 dark:border-gray-700 hover:border-gray-300'}`}>
                                    <input type="checkbox" checked={selectedDebtIds.has(d.id)} onChange={() => toggleDebt(d.id)} className="w-5 h-5 rounded border-gray-300 text-indigo-600" />
                                    <div className="flex-grow text-sm">
                                        <p className="font-bold text-gray-800 dark:text-gray-100">{d.type}</p>
                                        <p className="text-xs text-gray-500">{d.amount.toLocaleString('es-AR')} {d.currency} @ {d.rate}% TNA</p>
                                        <p className="text-[10px] text-gray-400 mt-1">Vto: {new Date(d.dueDate + 'T00:00:00Z').toLocaleDateString('es-AR')}</p>
                                    </div>
                                </label>
                            )) : <p className="text-gray-500">No hay deudas activas para refinanciar.</p>}
                        </div>
                    </div>

                    {/* Right: New Credit & Results */}
                    <div className="w-full lg:w-1/2 p-6 bg-gray-50 dark:bg-gray-900/30 overflow-y-auto">
                        <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-4">Paso 2: Condiciones del Nuevo Crédito</h3>
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">TNA Objetivo (%)</label>
                                <FormattedNumberInput value={newTna} onChange={setNewTna} />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Plazo (días)</label>
                                <FormattedNumberInput value={newTerm} onChange={setNewTerm} />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Comisión (%)</label>
                                <FormattedNumberInput value={newCommission} onChange={setNewCommission} />
                            </div>
                        </div>

                        <div className="border-t dark:border-gray-700 pt-6">
                            <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-6">Resultado de la Estrategia</h3>
                            {optimizationResults ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Ahorro Estimado (USD)</p>
                                            <p className={`text-2xl font-black ${optimizationResults.savingsARS > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                USD {optimizationResults.savingsUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Nuevo CFT (%)</p>
                                            <p className="text-2xl font-black text-indigo-600">
                                                {formatPercentageForDisplay(optimizationResults.effectiveCftNew)}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-indigo-600 text-white p-5 rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm opacity-80">Costo Original:</span>
                                            <span className="font-bold">{optimizationResults.originalCostARS.toLocaleString('es-AR', {style:'currency', currency:'ARS'})}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-white/20 pb-2 mb-2">
                                            <span className="text-sm opacity-80">Costo Nuevo:</span>
                                            <span className="font-bold">{optimizationResults.newCostARS.toLocaleString('es-AR', {style:'currency', currency:'ARS'})}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-bold">GANANCIA NETA:</span>
                                            <span className="text-2xl font-black">{optimizationResults.savingsARS.toLocaleString('es-AR', {style:'currency', currency:'ARS'})}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 text-xs text-gray-500 bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                                        <InformationCircleIcon className="w-4 h-4 flex-shrink-0" />
                                        <p>Esta simulación asume la cancelación total del capital de las deudas seleccionadas y su reemplazo por un único instrumento de pago al vencimiento (Bullet).</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                                    <BoltIcon className="w-12 h-12 mb-4 opacity-20" />
                                    <p>Selecciona deudas y define condiciones para calcular la rentabilidad del swap.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="p-6 border-t dark:border-gray-700 flex justify-end">
                    <button onClick={onClose} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 px-6 py-3 rounded-xl font-bold transition-all">Cerrar Simulador</button>
                </div>
            </div>
        </div>
    );
};

export default DebtOptimizerModal;
