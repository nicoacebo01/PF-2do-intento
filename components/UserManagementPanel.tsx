// This is a new file: components/UserManagementPanel.tsx
import React, { useState, useEffect } from 'react';
// FIX: Import View and Permissions types to define permission presets.
import type { User, Role, Company, View, Permissions } from '../types';
import { PencilIcon, TrashIcon } from './Icons';

interface UserManagementPanelProps {
  users: User[];
  companies: Company[];
  onUpdateUsers: (users: User[]) => void;
}

// FIX: Define permission presets to correctly construct user objects when saving.
// FIX: Add missing 'debtReport' and 'fwdPesificados' views to permission presets.
const allModulesAdmin: Permissions = {
    'global-dashboard': 'admin', 'debt': 'admin', 'debtReport': 'admin', 'investment': 'admin', 'cashflow': 'admin',
    'netPosition': 'admin', 'arbitrage': 'admin', 'fwdPesificados': 'admin', 'rofexAnalysis': 'admin',
    'settings': 'admin', 'grainCollection': 'admin'
};
const allModulesOperator: Permissions = {
    'global-dashboard': 'operator', 'debt': 'operator', 'debtReport': 'operator', 'investment': 'operator', 'cashflow': 'operator',
    'netPosition': 'operator', 'arbitrage': 'operator', 'fwdPesificados': 'operator', 'rofexAnalysis': 'operator',
    'settings': 'operator', 'grainCollection': 'operator'
};
const allModulesViewer: Permissions = {
    'global-dashboard': 'viewer', 'debt': 'viewer', 'debtReport': 'viewer', 'investment': 'viewer', 'cashflow': 'viewer',
    'netPosition': 'viewer', 'arbitrage': 'viewer', 'fwdPesificados': 'viewer', 'rofexAnalysis': 'viewer',
    'settings': 'viewer', 'grainCollection': 'viewer'
};

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ users, companies, onUpdateUsers }) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  // FIX: Update formData state type to correctly reflect its shape (excluding permissions).
  const [formData, setFormData] = useState<Omit<User, 'id' | 'permissions'>>({
    username: '', password_plaintext: '', role: 'viewer', companyIds: []
  });
  const isNew = !editingUser;

  useEffect(() => {
    if (editingUser) {
      setFormData({
        username: editingUser.username,
        password_plaintext: editingUser.password_plaintext,
        role: editingUser.role,
        companyIds: editingUser.companyIds,
      });
    } else {
      setFormData({ username: '', password_plaintext: '', role: 'viewer', companyIds: [] });
    }
  }, [editingUser]);
  
  const handleCompanyToggle = (companyId: string) => {
      setFormData(prev => ({
          ...prev,
          companyIds: prev.companyIds.includes(companyId) 
            ? prev.companyIds.filter(id => id !== companyId)
            : [...prev.companyIds, companyId]
      }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password_plaintext.trim()) {
        alert("Usuario y contraseña son obligatorios.");
        return;
    }

    // FIX: Set permissions based on the selected role to ensure data consistency.
    const permissions: Permissions = formData.role === 'admin' ? allModulesAdmin
                                   : formData.role === 'operator' ? allModulesOperator
                                   : allModulesViewer;

    let updatedUsers;
    if (isNew) {
      // FIX: Add permissions to the new user object.
      const newUser: User = { ...formData, id: crypto.randomUUID(), permissions };
      updatedUsers = [...users, newUser];
    } else {
      // FIX: Add permissions to the updated user object.
      updatedUsers = users.map(u => u.id === editingUser?.id ? { ...editingUser, ...formData, permissions } : u);
    }
    onUpdateUsers(updatedUsers);
    setEditingUser(null);
  };

  const handleDelete = (id: string) => {
      if(id === 'user-admin') {
          alert('No se puede eliminar el usuario administrador por defecto.');
          return;
      }
      if (window.confirm('¿Está seguro de que desea eliminar este usuario?')) {
        onUpdateUsers(users.filter(u => u.id !== id));
      }
  };
  
  const commonInputClass = "border border-gray-300 rounded-md py-2 px-3 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600";

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4 border-b pb-2">Gestionar Usuarios</h3>
      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg mb-6">
        <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200">{isNew ? 'Agregar Nuevo Usuario' : 'Editar Usuario'}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-gray-800 dark:text-gray-200">Usuario</label><input type="text" value={formData.username} onChange={e => setFormData(p => ({...p, username: e.target.value}))} className={`mt-1 w-full ${commonInputClass}`} required /></div>
            <div><label className="text-gray-800 dark:text-gray-200">Contraseña</label><input type="password" value={formData.password_plaintext} onChange={e => setFormData(p => ({...p, password_plaintext: e.target.value}))} className={`mt-1 w-full ${commonInputClass}`} required /></div>
            <div><label className="text-gray-800 dark:text-gray-200">Rol</label><select value={formData.role} onChange={e => setFormData(p => ({...p, role: e.target.value as Role}))} className={`mt-1 w-full ${commonInputClass}`}><option value="viewer">Consulta</option><option value="operator">Operador</option><option value="admin">Administrador</option></select></div>
        </div>
        <div>
            <label className="text-gray-800 dark:text-gray-200">Empresas Permitidas</label>
            <div className="mt-2 grid grid-cols-2 gap-2 border p-2 rounded-md bg-white dark:bg-gray-700 max-h-32 overflow-y-auto text-gray-800 dark:text-gray-200">
                {companies.map(c => (
                    <div key={c.id}><input type="checkbox" id={`co-${c.id}`} checked={formData.companyIds.includes(c.id)} onChange={() => handleCompanyToggle(c.id)} /><label htmlFor={`co-${c.id}`} className="ml-2">{c.name}</label></div>
                ))}
            </div>
        </div>
        <div className="flex justify-end gap-3"><button type="submit" className="bg-primary text-white py-2 px-4 rounded-lg">{isNew ? 'Agregar' : 'Guardar'}</button></div>
      </form>
      <div className="space-y-2">
          {users.map(u => (<div key={u.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border dark:border-gray-700">
              <div><p className="font-semibold text-gray-900 dark:text-gray-100">{u.username} <span className="text-xs font-normal bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 rounded-full px-2 py-0.5 ml-2 capitalize">{u.role}</span></p><p className="text-xs text-gray-600 dark:text-gray-400">{u.companyIds.map(id => companies.find(c => c.id === id)?.name).join(', ')}</p></div>
              <div className="flex gap-2"><button onClick={() => setEditingUser(u)} className="text-blue-500"><PencilIcon/></button><button onClick={() => handleDelete(u.id)} className="text-red-500"><TrashIcon/></button></div>
            </div>))}
      </div>
    </div>
  );
};
export default UserManagementPanel;