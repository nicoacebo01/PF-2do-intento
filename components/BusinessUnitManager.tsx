import React, { useState, useEffect } from 'react';
import type { BusinessUnit } from '../types';
import { PencilIcon, TrashIcon, XIcon } from './Icons';

interface BusinessUnitManagerProps {
  units: BusinessUnit[];
  onAdd: (name: string) => void;
  onUpdate: (unit: BusinessUnit) => void;
  onDelete: (id: string) => void;
}

const BusinessUnitManager: React.FC<BusinessUnitManagerProps> = ({ units, onAdd, onUpdate, onDelete }) => {
  const [editingUnit, setEditingUnit] = useState<BusinessUnit | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (editingUnit) {
      setName(editingUnit.name);
    } else {
      setName('');
    }
  }, [editingUnit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingUnit) {
      onUpdate({ ...editingUnit, name: name.trim() });
    } else {
      onAdd(name.trim());
    }
    setEditingUnit(null);
  };

  const cancelEdit = () => {
    setEditingUnit(null);
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4 border-b dark:border-gray-600 pb-2">Gestionar Unidades de Negocio</h3>
      
      {/* Form Section */}
      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg mb-6">
        <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200">{editingUnit ? 'Editar Unidad de Negocio' : 'Agregar Nueva Unidad'}</h4>
        <div>
          <label htmlFor="unit-name" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Nombre</label>
          <input
            id="unit-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
            required
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3">
          {editingUnit && (
            <button type="button" onClick={cancelEdit} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 font-bold py-2 px-4 rounded-lg">
              Cancelar
            </button>
          )}
          <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg">
            {editingUnit ? 'Guardar Cambios' : 'Agregar Unidad'}
          </button>
        </div>
      </form>
      
      {/* List Section */}
      <div>
        <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">Unidades Existentes</h4>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
          {units.length > 0 ? units.map(unit => (
            <div key={unit.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border dark:border-gray-700">
              <span className="font-semibold text-gray-700 dark:text-gray-200">{unit.name}</span>
              <div className="flex items-center gap-4">
                <button onClick={() => setEditingUnit(unit)} className="text-blue-500 hover:text-blue-700" title="Editar"><PencilIcon/></button>
                <button onClick={() => onDelete(unit.id)} className="text-red-500 hover:text-red-700" title="Eliminar"><TrashIcon/></button>
              </div>
            </div>
          )) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">No hay unidades de negocio registradas.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BusinessUnitManager;