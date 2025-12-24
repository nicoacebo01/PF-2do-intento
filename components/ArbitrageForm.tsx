import React, { useState, useEffect, useCallback } from 'react';
import type { ArbitrageOperation, BusinessUnit, ArbitrageCustomField, ArbitragePosition, ArbitrageInstrument, Bank, Broker, Assignment } from '../types';
import { XIcon } from './Icons';
import FormattedNumberInput from './FormattedNumberInput';

// Helper for formula evaluation
const evaluateFormula = (formula: string, rowData: Record<string, number | undefined>): number | null => {
    if (!formula) return null;
    try {
        const sanitizedFormula = formula.replace(/\{([^}]+)\}/g, (match, fieldName) => {
            const trimmedName = fieldName.trim();
            const value = rowData[trimmedName];
            if (typeof value === 'number' && isFinite(value)) {
                return String(value);
            }
            throw new Error(`Field '${trimmedName}' not found or not a valid number.`);
        });

        if (!/^[0-9+\-*/().\s]+$/.test(sanitizedFormula)) {
             throw new Error("Invalid characters in formula.");
        }

        return new Function(`return ${sanitizedFormula}`)();
    } catch (error) {
        return null; 
    }
};


interface ArbitrageFormProps {
    operationToEdit?: ArbitrageOperation | null;
    businessUnits: BusinessUnit[];
    assignments: Assignment[];
    customFields: ArbitrageCustomField[];
    banks: Bank[];
    brokers: Broker[];
    onSave: (data: Omit<ArbitrageOperation, 'id' | 'companyId'>, id?: string) => void;
    onClose: () => void;
}

const ArbitrageForm: React.FC<ArbitrageFormProps> = ({ operationToEdit, businessUnits, assignments, customFields, banks, brokers, onSave, onClose }) => {
    const isNew = !operationToEdit;
    const isLinked = !!operationToEdit?.linkedDebtId || !!operationToEdit?.linkedTransactionId;
    
    const [formData, setFormData] = useState<any>(() => {
        const initialData = operationToEdit ? (({ id, companyId, ...rest }) => rest)(operationToEdit) : {
            position: 'Comprada', instrument: 'ROFEX', usdAmount: '', startDate: '', arbitrageDate: '', arbitrageRate: '', customData: {},
        };
        if (!initialData.customData) initialData.customData = {};
        return initialData;
    });

    useEffect(() => {
        if (isLinked || isNew) return;
        
        const instrument = formData.instrument;
        if (instrument === 'ROFEX' || instrument === 'NDF Cliente') {
            if (formData.bankId) {
                setFormData((prev: any) => ({ ...prev, bankId: undefined }));
            }
        } else if (instrument === 'NDF') {
            if (formData.brokerId) {
                setFormData((prev: any) => ({ ...prev, brokerId: undefined }));
            }
        }
    }, [formData.instrument, formData.bankId, formData.brokerId, isLinked, isNew]);
    
    useEffect(() => {
        const calculatedFields = customFields.filter(f => f.fieldType === 'calculated');
        if (calculatedFields.length === 0) return;

        const manualCustomValues: Record<string, number> = {};
        customFields.forEach(field => {
            if (field.fieldType === 'manual' && field.type === 'number' && formData.customData?.[field.id]) {
                manualCustomValues[field.name] = Number(formData.customData[field.id]);
            }
        });

        const baseRowData: Record<string, number | undefined> = {
            'Monto USD': formData.usdAmount || undefined, 
            'TC Arbitraje': formData.arbitrageRate || undefined, 
            'TC Cancelación': formData.cancellationRate || undefined, 
            ...manualCustomValues
        };

        const newCustomData = { ...formData.customData };
        let hasChanged = true;
        let iterations = 0; 
        
        while (hasChanged && iterations < calculatedFields.length) {
            hasChanged = false;
            calculatedFields.forEach(field => {
                if (field.formula) {
                    const result = evaluateFormula(field.formula, baseRowData);
                    if (result !== null && newCustomData[field.id] !== result) {
                        newCustomData[field.id] = result;
                        baseRowData[field.name] = result; 
                        hasChanged = true;
                    }
                }
            });
            iterations++;
        }
        
        if (JSON.stringify(newCustomData) !== JSON.stringify(formData.customData)) {
            setFormData((prev: any) => ({ ...prev, customData: newCustomData }));
        }

    }, [formData.usdAmount, formData.arbitrageRate, formData.cancellationRate, formData.customData, customFields]);

    const handleChange = (name: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };
    
    const handleCustomDataChange = (fieldId: string, value: string | number | '') => {
        setFormData((prev: any) => ({ ...prev, customData: { ...prev.customData, [fieldId]: value } }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isLinked) return;
        for (const field of customFields) {
            if (field.fieldType === 'manual' && field.isRequired && !formData.customData?.[field.id]) {
                alert(`El campo "${field.name}" es obligatorio.`); return;
            }
        }
        if (formData.cancellationDate && new Date(formData.cancellationDate) > new Date(formData.arbitrageDate)) {
            alert('La fecha de cancelación no puede ser posterior a la fecha de vencimiento.');
            return;
        }
        
        const dataToSave = { ...formData };
        if (formData.instrument === 'ROFEX' || formData.instrument === 'NDF Cliente') {
            dataToSave.bankId = undefined;
        } else { // NDF
            dataToSave.brokerId = undefined;
        }

        onSave(dataToSave, operationToEdit?.id);
        onClose();
    };
    
    const commonSelectClass = "mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-800";

    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]">
            <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-gray-800">{operationToEdit ? 'Editar' : 'Nueva'} Operación de Arbitraje</h2><button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button></div>
                {isLinked && (
                    <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert">
                        <p className="font-bold">Operación Vinculada</p>
                        <p>Esta operación fue generada desde otro módulo y sus datos principales no pueden ser editados aquí.</p>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <h3 className="col-span-full text-lg font-semibold text-gray-700">Información General</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-900">Instrumento</label>
                            <select name="instrument" value={formData.instrument} onChange={e => handleChange('instrument', e.target.value)} className={commonSelectClass} disabled={isLinked}>
                                <option>ROFEX</option>
                                <option>NDF</option>
                                <option>NDF Cliente</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-900">Posición</label>
                            <select name="position" value={formData.position} onChange={e => handleChange('position', e.target.value)} className={commonSelectClass} disabled={isLinked}>
                                <option>Comprada</option>
                                <option>Vendida</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-900">Operador</label>
                            {formData.instrument === 'ROFEX' || formData.instrument === 'NDF Cliente' ? (
                                <select name="brokerId" value={formData.brokerId || ''} onChange={e => handleChange('brokerId', e.target.value)} className={commonSelectClass} required disabled={isLinked}>
                                    <option value="">Seleccione Broker</option>
                                    {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            ) : (
                                <select name="bankId" value={formData.bankId || ''} onChange={e => handleChange('bankId', e.target.value)} className={commonSelectClass} required disabled={isLinked}>
                                    <option value="">Seleccione Banco</option>
                                    {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            )}
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-sm font-medium text-gray-900">Monto (USD)</label><FormattedNumberInput value={formData.usdAmount} onChange={v => handleChange('usdAmount', v)} className="mt-1" placeholder="100000" required disabled={isLinked} /></div>
                        <div>
                          <label className="block text-sm font-medium text-gray-900">Asignación</label>
                          <select name="assignmentId" value={formData.assignmentId || ''} onChange={e => handleChange('assignmentId', e.target.value)} className={commonSelectClass} disabled={isLinked}>
                            <option value="">Ninguna</option>
                            {assignments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </div>
                         <div><label className="block text-sm font-medium text-gray-900">Unidad de Negocio</label><select name="businessUnitId" value={formData.businessUnitId || ''} onChange={e => handleChange('businessUnitId', e.target.value)} className={commonSelectClass} disabled={isLinked}><option value="">Ninguna</option>{businessUnits.map(bu => <option key={bu.id} value={bu.id}>{bu.name}</option>)}</select></div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-900">Detalle</label><textarea name="detail" value={formData.detail || ''} onChange={e => handleChange('detail', e.target.value)} rows={2} className={`${commonSelectClass} resize-none`} disabled={isLinked}></textarea></div>
                    <div className="border-t pt-4"><h3 className="col-span-full text-lg font-semibold text-gray-700">Fechas y Tasas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            <div><label className="block text-sm font-medium text-gray-900">Fecha de Inicio</label><input type="date" name="startDate" value={formData.startDate} onChange={e => handleChange('startDate', e.target.value)} className={commonSelectClass.replace('pr-10','pr-3')} required disabled={isLinked} /></div>
                            <div><label className="block text-sm font-medium text-gray-900">Fecha Vto.</label><input type="date" name="arbitrageDate" value={formData.arbitrageDate} onChange={e => handleChange('arbitrageDate', e.target.value)} className={commonSelectClass.replace('pr-10','pr-3')} required disabled={isLinked} /></div>
                            <div><label className="block text-sm font-medium text-gray-900">TC de Arbitraje</label><FormattedNumberInput value={formData.arbitrageRate} onChange={v => handleChange('arbitrageRate', v)} className="mt-1" placeholder="1250,50" required disabled={isLinked} /></div>
                        </div>
                    </div>
                    <div className="border-t pt-4"><h3 className="text-lg font-semibold text-gray-700">Cancelación (Opcional)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            <div><label className="block text-sm font-medium text-gray-900">Fecha</label><input type="date" name="cancellationDate" value={formData.cancellationDate || ''} onChange={e => handleChange('cancellationDate', e.target.value)} max={formData.arbitrageDate} className={commonSelectClass.replace('pr-10','pr-3')} disabled={isLinked}/></div>
                            <div><label className="block text-sm font-medium text-gray-900">TC</label><FormattedNumberInput value={formData.cancellationRate || ''} onChange={v => handleChange('cancellationRate', v)} className="mt-1" disabled={isLinked}/></div>
                        </div>
                    </div>
                    {customFields.length > 0 && (
                        <div className="border-t pt-4"><h3 className="text-lg font-semibold text-gray-700">Datos Personalizados</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                {customFields.map(field => (
                                    <div key={field.id}>
                                        <label className="block text-sm font-medium text-gray-900">{field.name}{field.isRequired && <span className="text-red-500">*</span>}</label>
                                         {field.type === 'number' ? (
                                            <FormattedNumberInput 
                                                value={formData.customData?.[field.id] || ''}
                                                onChange={v => handleCustomDataChange(field.id, v)}
                                                className="mt-1"
                                                disabled={isLinked || field.fieldType === 'calculated'}
                                                required={field.isRequired}
                                            />
                                        ) : (
                                            <input 
                                                type={field.type} 
                                                value={formData.customData?.[field.id] || ''} 
                                                onChange={e => handleCustomDataChange(field.id, e.target.value)} 
                                                className={commonSelectClass.replace('pr-10','pr-3')} 
                                                disabled={isLinked || field.fieldType === 'calculated'} 
                                                required={field.isRequired} 
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                     <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button><button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed" disabled={isLinked}>{operationToEdit ? 'Guardar Cambios' : 'Guardar'}</button></div>
                </form>
            </div>
        </div>
    );
};

export default ArbitrageForm;