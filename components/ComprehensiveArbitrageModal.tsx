import React, { useState } from 'react';
import type { ArbitrageDetails, Broker, Bank, BusinessUnit, Assignment, ArbitrageCustomField } from '../types';
import { XIcon } from './Icons';
import FormattedNumberInput from './FormattedNumberInput';

interface ComprehensiveArbitrageModalProps {
    initialData: ArbitrageDetails | null;
    onSave: (data: ArbitrageDetails) => void;
    onClose: () => void;
    brokers: Broker[];
    banks: Bank[];
    businessUnits: BusinessUnit[];
    assignments: Assignment[];
    customFields: ArbitrageCustomField[];
}

const ComprehensiveArbitrageModal: React.FC<ComprehensiveArbitrageModalProps> = ({
    initialData, onSave, onClose, brokers, banks, businessUnits, assignments, customFields
}) => {
    
    const [formData, setFormData] = useState<ArbitrageDetails>(() => {
        const defaults: Partial<ArbitrageDetails> = {
            id: initialData?.id || crypto.randomUUID(), 
            position: 'Vendida', instrument: 'ROFEX', usdAmount: 0,
            startDate: '', arbitrageDate: '', arbitrageRate: 0, customData: {},
        };
        const combined = { ...defaults, ...initialData } as ArbitrageDetails;
        if(initialData?.usdAmount === 0) combined.usdAmount = 0;
        if(initialData?.arbitrageRate === 0) combined.arbitrageRate = 0;
        return combined;
    });

    const handleChange = (name: string, value: any) => {
        setFormData(prev => {
            const newState = { ...prev, [name]: value };
            if (name === 'instrument') {
                if (value === 'ROFEX' || value === 'NDF Cliente') {
                    newState.bankId = undefined;
                } else { // NDF
                    newState.brokerId = undefined;
                }
            }
            return newState;
        });
    };
    
    const handleCustomDataChange = (fieldId: string, value: string | number | '') => {
        setFormData(prev => ({ ...prev, customData: { ...prev.customData, [fieldId]: value } }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if ((formData.instrument === 'ROFEX' || formData.instrument === 'NDF Cliente') && !formData.brokerId) { alert("Por favor, seleccione un Broker."); return; }
        if (formData.instrument === 'NDF' && !formData.bankId) { alert("Por favor, seleccione un Banco para NDF."); return; }

        for (const field of customFields) {
            if (field.fieldType === 'manual' && field.isRequired && !formData.customData?.[field.id]) {
                alert(`El campo "${field.name}" es obligatorio.`); return;
            }
        }
        onSave(formData);
    };

    const commonSelectClass = "mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md bg-white text-gray-900";
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60]">
            <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-gray-800">{initialData ? 'Editar' : 'Agregar'} Cobertura</h2><button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button></div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-900">Instrumento</label><select name="instrument" value={formData.instrument} onChange={e => handleChange('instrument', e.target.value)} className={commonSelectClass}><option>ROFEX</option><option>NDF</option><option>NDF Cliente</option></select></div>
                        <div><label className="block text-sm font-medium text-gray-900">Posición</label><select name="position" value={formData.position} onChange={e => handleChange('position', e.target.value)} className={commonSelectClass}><option>Vendida</option><option>Comprada</option></select></div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-900">Operador</label>
                            {formData.instrument === 'ROFEX' || formData.instrument === 'NDF Cliente' ? (
                                <select name="brokerId" value={formData.brokerId || ''} onChange={e => handleChange('brokerId', e.target.value)} className={commonSelectClass} required><option value="">Seleccione Broker</option>{brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                            ) : (
                                <select name="bankId" value={formData.bankId || ''} onChange={e => handleChange('bankId', e.target.value)} className={commonSelectClass} required><option value="">Seleccione Banco</option>{banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                            )}
                        </div>
                        <div><label className="block text-sm font-medium text-gray-900">Monto (USD)</label><FormattedNumberInput value={formData.usdAmount} onChange={v => handleChange('usdAmount', v)} className="mt-1" placeholder="100000" required /></div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-900">Fecha de Inicio</label><input type="date" name="startDate" value={formData.startDate} onChange={e => handleChange('startDate', e.target.value)} className={commonSelectClass.replace('pr-10','pr-3')} required /></div>
                        <div><label className="block text-sm font-medium text-gray-900">Fecha de Vto.</label><input type="date" name="arbitrageDate" value={formData.arbitrageDate} onChange={e => handleChange('arbitrageDate', e.target.value)} className={commonSelectClass.replace('pr-10','pr-3')} required /></div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-900">TC de Arbitraje</label><FormattedNumberInput value={formData.arbitrageRate} onChange={v => handleChange('arbitrageRate', v)} className="mt-1" placeholder="1250,50" required /></div>
                    
                    <div className="border-t pt-4"><h3 className="text-lg font-semibold text-gray-700">Cancelación (Opcional)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            <div><label className="block text-sm font-medium text-gray-900">Fecha de Cancelación</label><input type="date" name="cancellationDate" value={formData.cancellationDate || ''} onChange={e => handleChange('cancellationDate', e.target.value)} max={formData.arbitrageDate} className={commonSelectClass.replace('pr-10','pr-3')}/></div>
                            <div><label className="block text-sm font-medium text-gray-900">TC de Cancelación</label><FormattedNumberInput value={formData.cancellationRate || ''} onChange={v => handleChange('cancellationRate', v)} className="mt-1"/></div>
                        </div>
                    </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-900">Unidad de Negocio</label><select name="businessUnitId" value={formData.businessUnitId || ''} onChange={e => handleChange('businessUnitId', e.target.value)} className={commonSelectClass}><option value="">Ninguna</option>{businessUnits.map(bu => <option key={bu.id} value={bu.id}>{bu.name}</option>)}</select></div>
                        <div><label className="block text-sm font-medium text-gray-900">Asignación</label><select name="assignmentId" value={formData.assignmentId || ''} onChange={e => handleChange('assignmentId', e.target.value)} className={commonSelectClass}><option value="">Ninguna</option>{assignments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-900">Detalle</label><textarea name="detail" value={formData.detail || ''} onChange={e => handleChange('detail', e.target.value)} rows={2} className={`${commonSelectClass} resize-none`}></textarea></div>
                     {customFields.length > 0 && (
                        <div className="border-t pt-4"><h3 className="text-lg font-semibold text-gray-700">Datos Personalizados</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                {customFields.filter(f => f.fieldType === 'manual').map(field => (
                                    <div key={field.id}>
                                        <label className="block text-sm font-medium text-gray-900">{field.name}{field.isRequired && <span className="text-red-500">*</span>}</label>
                                        {field.type === 'number' ? (
                                            <FormattedNumberInput
                                                value={formData.customData?.[field.id] as number || ''}
                                                onChange={v => handleCustomDataChange(field.id, v)}
                                                className="mt-1"
                                                required={field.isRequired}
                                            />
                                        ) : (
                                            <input 
                                                type={field.type} 
                                                value={formData.customData?.[field.id] as string || ''} 
                                                onChange={e => handleCustomDataChange(field.id, e.target.value)} 
                                                className={commonSelectClass.replace('pr-10','pr-3')} 
                                                required={field.isRequired} 
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button><button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg">Guardar</button></div>
                </form>
            </div>
        </div>
    );
};

export default ComprehensiveArbitrageModal;