import React, { useState, useEffect } from 'react';
import type { Company, Bank, Broker, DebtType, InvestmentType, BusinessUnit, Assignment, ArbitrageCustomField, AppCurrency } from '../../types';
import { Currency } from '../../types';
import { PencilIcon, TrashIcon } from '../Icons';
import { exportMultiSheetExcel } from '../../utils/export';

const SimpleManager: React.FC<{
  title: string;
  items: { id: string, name: string }[];
  onAdd: (name: string) => void;
  onUpdate: (item: { id: string, name: string }) => void;
  onDelete: (id: string) => void;
}> = ({ title, items, onAdd, onUpdate, onDelete }) => {
    const [name, setName] = useState('');
    const [editingItem, setEditingItem] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        if (editingItem) {
            setName(editingItem.name);
        } else {
            setName('');
        }
    }, [editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (editingItem) {
            onUpdate({ ...editingItem, name });
        } else {
            onAdd(name);
        }
        setName('');
        setEditingItem(null);
    };

    return (
        <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg border dark:border-gray-700">
            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">{title}</h4>
            <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={editingItem ? "Editar nombre..." : "Nuevo nombre..."} className="flex-grow border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" required />
                <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg text-sm">{editingItem ? 'Guardar' : 'Agregar'}</button>
                {editingItem && <button type="button" onClick={() => { setEditingItem(null); setName(''); }} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-lg text-sm">Cancelar</button>}
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm border dark:border-gray-700">
                        <span className="text-gray-900 dark:text-gray-200">{item.name}</span>
                        <div className="flex gap-2">
                            <button onClick={() => { setEditingItem(item); }} className="text-blue-500"><PencilIcon /></button>
                            <button onClick={() => onDelete(item.id)} className="text-red-500"><TrashIcon /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const BusinessUnitManager: React.FC<{
  units: BusinessUnit[];
  onUpdate: (units: BusinessUnit[]) => void;
}> = ({ units, onUpdate }) => {
    const [name, setName] = useState('');
    const [admiteSpread, setAdmiteSpread] = useState(false);
    const [editingItem, setEditingItem] = useState<BusinessUnit | null>(null);

    useEffect(() => {
        if (editingItem) {
            setName(editingItem.name);
            setAdmiteSpread(!!editingItem.admiteSpread);
        } else {
            setName('');
            setAdmiteSpread(false);
        }
    }, [editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (editingItem) {
            onUpdate(units.map(u => u.id === editingItem.id ? { ...editingItem, name, admiteSpread } : u));
        } else {
            onUpdate([...units, { id: crypto.randomUUID(), name, admiteSpread }]);
        }
        setName('');
        setAdmiteSpread(false);
        setEditingItem(null);
    };

    const handleDelete = (id: string) => {
      onUpdate(units.filter(u => u.id !== id));
    }

    return (
        <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg border dark:border-gray-700">
            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">Unidades de Negocio</h4>
            <form onSubmit={handleSubmit} className="space-y-3 mb-3">
                <div className="flex gap-2">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={editingItem ? "Editar nombre..." : "Nuevo nombre..."} className="flex-grow border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" required />
                    <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg text-sm">{editingItem ? 'Guardar' : 'Agregar'}</button>
                    {editingItem && <button type="button" onClick={() => setEditingItem(null)} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-lg text-sm">Cancelar</button>}
                </div>
                <div className="flex items-center">
                    <input type="checkbox" id="admiteSpread" checked={admiteSpread} onChange={e => setAdmiteSpread(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="admiteSpread" className="ml-2 text-sm text-gray-700 dark:text-gray-200">Admite Spread</label>
                </div>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {units.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm border dark:border-gray-700">
                        <div>
                          <span className="text-gray-900 dark:text-gray-200">{item.name}</span>
                          {item.admiteSpread && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Admite Spread</span>}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingItem(item)} className="text-blue-500"><PencilIcon /></button>
                            <button onClick={() => handleDelete(item.id)} className="text-red-500"><TrashIcon /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const CustomFieldManager: React.FC<any> = (props) => {
    const [editingField, setEditingField] = useState<ArbitrageCustomField | null>(null);
    const [fieldName, setFieldName] = useState('');
    const [fieldType, setFieldType] = useState<'text' | 'number' | 'date'>('text');

    useEffect(() => {
        if (editingField) {
            setFieldName(editingField.name);
            setFieldType(editingField.type);
        } else {
            setFieldName('');
            setFieldType('text');
        }
    }, [editingField]);

    const handleFieldSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newField: ArbitrageCustomField = {id: editingField?.id || crypto.randomUUID(), name: fieldName, type: fieldType, fieldType: 'manual'};
        const updated = editingField ? props.customFields.map((f: ArbitrageCustomField) => f.id === newField.id ? newField : f) : [...props.customFields, newField];
        props.onUpdateCustomFields(updated);
        setEditingField(null);
    };
    
    const commonInputClass = "border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600";
    
    return (
        <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg border dark:border-gray-700 lg:col-span-2">
             <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">Campos Personalizados (Arbitrajes)</h4>
             <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Actualmente no se soportan campos calculados desde esta interfaz.</p>
             <form onSubmit={handleFieldSubmit} className="flex gap-2 mb-3">
                <input type="text" value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="Nombre del campo" className={`flex-grow ${commonInputClass}`} required />
                <select value={fieldType} onChange={e => setFieldType(e.target.value as any)} className={commonInputClass}><option value="text">Texto</option><option value="number">Número</option><option value="date">Fecha</option></select>
                <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg text-sm">{editingField ? 'Guardar' : 'Agregar'}</button>
                {editingField && <button type="button" onClick={() => setEditingField(null)} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-lg text-sm">Cancelar</button>}
             </form>
             <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {props.customFields.map((field: ArbitrageCustomField) => <div key={field.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm border dark:border-gray-700"><span className="text-gray-900 dark:text-gray-200">{field.name} ({field.type})</span><div className="flex gap-2"><button onClick={() => setEditingField(field)} className="text-blue-500"><PencilIcon /></button><button onClick={() => props.onUpdateCustomFields(props.customFields.filter((f: ArbitrageCustomField) => f.id !== field.id))} className="text-red-500"><TrashIcon /></button></div></div>)}
             </div>
        </div>
    )
}

const CurrencySettings: React.FC<{
  currencies: AppCurrency[];
  onUpdateCurrencies: (currencies: AppCurrency[]) => void;
}> = ({ currencies, onUpdateCurrencies }) => {
    const [subtypeName, setSubtypeName] = useState('');
    const [editingSubtype, setEditingSubtype] = useState<{ id: string, name: string } | null>(null);

    const usdCurrency = currencies.find(c => c.id === 'USD');

    useEffect(() => {
        if (editingSubtype) {
            setSubtypeName(editingSubtype.name);
        } else {
            setSubtypeName('');
        }
    }, [editingSubtype]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!subtypeName.trim() || !usdCurrency) return;

        const updatedSubtypes = editingSubtype
            ? usdCurrency.subtypes.map(st => st.id === editingSubtype.id ? { ...st, name: subtypeName.trim() } : st)
            : [...usdCurrency.subtypes, { id: `usd-${crypto.randomUUID()}`, name: subtypeName.trim() }];
        
        const updatedCurrencies = currencies.map(c => c.id === 'USD' ? { ...c, subtypes: updatedSubtypes } : c);
        onUpdateCurrencies(updatedCurrencies);

        setSubtypeName('');
        setEditingSubtype(null);
    };

    const handleDelete = (id: string) => {
        if (!usdCurrency) return;
        const updatedSubtypes = usdCurrency.subtypes.filter(st => st.id !== id);
        const updatedCurrencies = currencies.map(c => c.id === 'USD' ? { ...c, subtypes: updatedSubtypes } : c);
        onUpdateCurrencies(updatedCurrencies);
    };

    return (
        <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg border dark:border-gray-700">
            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">Subtipos de Moneda (USD)</h4>
            <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
                <input type="text" value={subtypeName} onChange={e => setSubtypeName(e.target.value)} placeholder={editingSubtype ? "Editar subtipo..." : "Nuevo subtipo..."} className="flex-grow border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" required />
                <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg text-sm">{editingSubtype ? 'Guardar' : 'Agregar'}</button>
                {editingSubtype && <button type="button" onClick={() => setEditingSubtype(null)} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-lg text-sm">Cancelar</button>}
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {usdCurrency?.subtypes.map(st => (
                    <div key={st.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm border dark:border-gray-700">
                        <span className="text-gray-900 dark:text-gray-200">{st.name}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingSubtype(st)} className="text-blue-500"><PencilIcon /></button>
                            <button onClick={() => handleDelete(st.id)} className="text-red-500"><TrashIcon /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MasterDataSettings: React.FC<any> = (props) => {
    const handleExportMasterData = () => {
        const sheets = [
            { sheetName: 'Empresas', data: props.companies, columns: [{header: 'ID', accessor: (d: any) => d.id}, {header: 'Nombre', accessor: (d: any) => d.name}] },
            { sheetName: 'Bancos', data: props.banks, columns: [{header: 'ID', accessor: (d: any) => d.id}, {header: 'Nombre', accessor: (d: any) => d.name}] },
            { sheetName: 'Brokers', data: props.brokers, columns: [{header: 'ID', accessor: (d: any) => d.id}, {header: 'Nombre', accessor: (d: any) => d.name}] },
            { sheetName: 'Tipos de Deuda', data: props.debtTypes, columns: [{header: 'ID', accessor: (d: any) => d.id}, {header: 'Nombre', accessor: (d: any) => d.name}, {header: 'Categoria', accessor: (d: any) => d.category}, {header: 'Monedas', accessor: (d: any) => d.allowedCurrencies.join(', ')}] },
            { sheetName: 'Tipos de Inversion', data: props.investmentTypes, columns: [{header: 'ID', accessor: (d: any) => d.id}, {header: 'Nombre', accessor: (d: any) => d.name}, {header: 'Monedas', accessor: (d: any) => d.allowedCurrencies.join(', ')}] },
            { sheetName: 'Unidades de Negocio', data: props.businessUnits, columns: [{header: 'ID', accessor: (d: any) => d.id}, {header: 'Nombre', accessor: (d: any) => d.name}, {header: 'Admite Spread', accessor: (d: any) => d.admiteSpread ? 'Sí' : 'No'}] },
            { sheetName: 'Asignaciones', data: props.assignments, columns: [{header: 'ID', accessor: (d: any) => d.id}, {header: 'Nombre', accessor: (d: any) => d.name}] },
            { sheetName: 'Campos Personalizados', data: props.customFields, columns: [{header: 'ID', accessor: (d: any) => d.id}, {header: 'Nombre', accessor: (d: any) => d.name}, {header: 'Tipo', accessor: (d: any) => d.type}, {header: 'Tipo de Campo', accessor: (d: any) => d.fieldType}] },
        ];
        exportMultiSheetExcel({
            fileName: 'datos_maestros',
            sheets: sheets
        });
    };

    return (
        <div>
            <div className="flex justify-end mb-6">
                <button
                    onClick={handleExportMasterData}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md text-sm"
                >
                    Exportar Datos Maestros a Excel
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <SimpleManager
                    title="Empresas"
                    items={props.companies}
                    onAdd={(name: string) => props.onUpdateCompanies([...props.companies, { id: crypto.randomUUID(), name }])}
                    onUpdate={(item: Company) => props.onUpdateCompanies(props.companies.map((i: Company) => i.id === item.id ? { ...i, name: item.name } : i))}
                    onDelete={(id: string) => props.onUpdateCompanies(props.companies.filter((i: Company) => i.id !== id))}
                />
                <SimpleManager
                    title="Bancos"
                    items={props.banks}
                    onAdd={(name: string) => props.onUpdateBanks([...props.banks, {id: crypto.randomUUID(), name, creditLines: []}])}
                    onUpdate={(item: Bank) => props.onUpdateBanks(props.banks.map((i: Bank) => i.id === item.id ? {...i, name: item.name} : i))}
                    onDelete={(id: string) => props.onUpdateBanks(props.banks.filter((i: Bank) => i.id !== id))}
                />
                <SimpleManager
                    title="Brokers"
                    items={props.brokers}
                    onAdd={(name: string) => props.onUpdateBrokers([...props.brokers, {id: crypto.randomUUID(), name}])}
                    onUpdate={(item: Broker) => props.onUpdateBrokers(props.brokers.map((i: Broker) => i.id === item.id ? {...i, name: item.name} : i))}
                    onDelete={(id: string) => props.onUpdateBrokers(props.brokers.filter((i: Broker) => i.id !== id))}
                />
                <SimpleManager
                    title="Tipos de Deuda"
                    items={props.debtTypes}
                    onAdd={(name: string) => props.onUpdateDebtTypes([...props.debtTypes, {id: crypto.randomUUID(), name, allowedCurrencies: [Currency.ARS, Currency.USD], category: 'bancaria'}])}
                    onUpdate={(item: DebtType) => props.onUpdateDebtTypes(props.debtTypes.map((i: DebtType) => i.id === item.id ? {...i, name: item.name} : i))}
                    onDelete={(id: string) => props.onUpdateDebtTypes(props.debtTypes.filter((i: DebtType) => i.id !== id))}
                />
                <SimpleManager
                    title="Tipos de Inversión"
                    items={props.investmentTypes}
                    onAdd={(name: string) => props.onUpdateInvestmentTypes([...props.investmentTypes, {id: crypto.randomUUID(), name, allowedCurrencies: [Currency.ARS, Currency.USD]}])}
                    onUpdate={(item: InvestmentType) => props.onUpdateInvestmentTypes(props.investmentTypes.map((i: InvestmentType) => i.id === item.id ? {...i, name: item.name} : i))}
                    onDelete={(id: string) => props.onUpdateInvestmentTypes(props.investmentTypes.filter((i: InvestmentType) => i.id !== id))}
                />
                <CurrencySettings currencies={props.currencies} onUpdateCurrencies={props.onUpdateCurrencies} />
                <BusinessUnitManager units={props.businessUnits} onUpdate={props.onUpdateBusinessUnits} />
                <SimpleManager title="Asignaciones" items={props.assignments} onAdd={(name) => props.onUpdateAssignments([...props.assignments, {id: crypto.randomUUID(), name}])} onUpdate={(item) => props.onUpdateAssignments(props.assignments.map((i: Assignment) => i.id === item.id ? {...i, name: item.name} : i))} onDelete={(id) => props.onUpdateAssignments(props.assignments.filter((i: Assignment) => i.id !== id))} />
                <CustomFieldManager {...props} />
            </div>
        </div>
    );
};
export default MasterDataSettings;