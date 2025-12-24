
import React, { useState, useCallback } from 'react';
import type { Company } from '../types';
import { XIcon, BuildingOffice2Icon } from './Icons';

interface CompanyModalProps {
  companies: Company[];
  onAddCompany: (name: string) => void;
  onClose: () => void;
}

const CompanyModal: React.FC<CompanyModalProps> = ({ companies, onAddCompany, onClose }) => {
  const [newCompanyName, setNewCompanyName] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (newCompanyName.trim()) {
      onAddCompany(newCompanyName.trim());
      setNewCompanyName('');
      if (companies.length === 0) { // Close modal after adding the first company
        onClose();
      }
    }
  }, [newCompanyName, onAddCompany, onClose, companies.length]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md m-4 animate-fade-in-down">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Gestionar Empresas</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <XIcon />
          </button>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Empresas Existentes</h3>
          {companies.length > 0 ? (
            <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {companies.map(company => (
                <li key={company.id} className="flex items-center gap-3 bg-gray-100 p-2 rounded-md">
                  <BuildingOffice2Icon />
                  <span className="text-gray-800">{company.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">Aún no hay empresas registradas.</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-700">Agregar Nueva Empresa</h3>
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">Nombre de la Empresa</label>
              <input
                type="text"
                id="companyName"
                value={newCompanyName}
                onChange={e => setNewCompanyName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900"
                placeholder="Ej: Mi Empresa S.A."
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg"
              >
                Guardar Empresa
              </button>
            </div>
        </form>
      </div>
       <style>{`
        @keyframes fade-in-down { 0% { opacity: 0; transform: translateY(-20px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default CompanyModal;