// This is a new file: components/settings/UserSettings.tsx
import React, { useState, useEffect } from 'react';
import type { User, Role, Company, View, Permissions } from '../../types';
import { PencilIcon, TrashIcon } from '../Icons';

interface UserSettingsProps {
  users: User[];
  companies: Company[];
  onUpdateUsers: (users: User[]) => void;
}

const moduleLabels: Record<View, string> = {
    'global-dashboard': 'Dashboard Global',
    'debt': 'Deuda',
    'debtReport': 'Reporte de Deuda',
    'investment': 'Inversiones',
    'investmentReport': 'Reporte de Inversión',
    'cashflow': 'Flujo de Caja',
    'netPosition': 'Posición Neta',
    'arbitrage': 'Arbitrajes',
    'fwdPesificados': 'FWD Pesificados',
    'rofexAnalysis': 'Análisis ROFEX',
    'settings': 'Configuración',
    'grainCollection': 'Cobranzas',
    'my-profile': 'Mi Perfil'
};
const allModules = Object.keys(moduleLabels).filter(k => k !== 'my-profile') as View[];

const allModulesAdmin: Permissions = {
    'global-dashboard': 'admin', 'debt': 'admin', 'debtReport': 'admin', 'investment': 'admin', 'investmentReport': 'admin', 'cashflow': 'admin',
    'netPosition': 'admin', 'arbitrage': 'admin', 'fwdPesificados': 'admin', 'rofexAnalysis': 'admin',
    'settings': 'admin', 'grainCollection': 'admin'
};
const allModulesOperator: Permissions = {
    'global-dashboard': 'operator', 'debt': 'operator', 'debtReport': 'operator', 'investment': 'operator', 'investmentReport': 'operator', 'cashflow': 'operator',
    'netPosition': 'operator', 'arbitrage': 'operator', 'fwdPesificados': 'operator', 'rofexAnalysis': 'operator',
    'settings': 'operator', 'grainCollection': 'operator'
};
const allModulesViewer: Permissions = {
    'global-dashboard': 'viewer', 'debt': 'viewer', 'debtReport': 'viewer', 'investment': 'viewer', 'investmentReport': 'viewer', 'cashflow': 'viewer',
    'netPosition': 'viewer', 'arbitrage': 'viewer', 'fwdPesificados': 'viewer', 'rofexAnalysis': 'viewer',
    'settings': 'viewer', 'grainCollection': 'viewer'
};

const deriveRole = (permissions: Permissions): Role => {
    const permissionValues = Object.values(permissions);
    if (permissionValues.includes('admin')) return 'admin';
    if (permissionValues.includes('operator')) return 'operator';
    return 'viewer';
};

const UserSettings: React.FC<UserSettingsProps> = ({ users, companies, onUpdateUsers }) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<{
    username: string; password_plaintext: string; email?: string; companyIds: string[]; permissions: Permissions;
  }>({
    username: '', password_plaintext: '', email: '', companyIds: [], permissions: {}
  });
  const isNew = !editingUser;

  useEffect(() => {
    if (editingUser) {
      setFormData({
        username: editingUser.username,
        password_plaintext: editingUser.password_plaintext,
        email: editingUser.email || '',
        companyIds: editingUser.companyIds,
        permissions: editingUser.permissions,
      });
    } else {
      setFormData({ username: '', password_plaintext: '', email: '', companyIds: [], permissions: {} });
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

  const handlePermissionChange = (module: View, role?: Role) => {
      setFormData(prev => {
          const newPermissions = { ...prev.permissions };
          if (role) {
              newPermissions[module] = role;
          } else {
              delete newPermissions[module];
          }
          return { ...prev, permissions: newPermissions };
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password_plaintext.trim()) {
        alert("Usuario y contraseña son obligatorios.");
        return;
    }
    
    let updatedUsers;
    const role = deriveRole(formData.permissions);
    if (isNew) {
      const newUser: User = { ...formData, role, id: crypto.randomUUID() };
      updatedUsers = [...users, newUser];
    } else {
      updatedUsers = users.map(u => u.id === editingUser?.id ? { ...editingUser, ...formData, role } : u);
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4 bg-gray-100 dark:bg-gray-800/50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200">{isNew ? 'Agregar Nuevo Usuario' : 'Editar Usuario'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-gray-800 dark:text-gray-200">Usuario</label><input type="text" value={formData.username} onChange={e => setFormData(p => ({...p, username: e.target.value}))} className={`mt-1 w-full ${commonInputClass}`} required /></div>
                <div><label className="text-gray-800 dark:text-gray-200">Contraseña</label><input type="password" value={formData.password_plaintext} onChange={e => setFormData(p => ({...p, password_plaintext: e.target.value}))} className={`mt-1 w-full ${commonInputClass}`} required /></div>
                <div className="md:col-span-2"><label className="text-gray-800 dark:text-gray-200">Email</label><input type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} className={`mt-1 w-full ${commonInputClass}`} /></div>
            </div>
            <div>
                <label className="text-gray-800 dark:text-gray-200">Empresas Permitidas</label>
                <div className="mt-2 grid grid-cols-2 gap-2 border p-2 rounded-md bg-white dark:bg-gray-700 max-h-32 overflow-y-auto text-gray-800 dark:text-gray-200">
                    {companies.map(c => (
                        <div key={c.id}><input type="checkbox" id={`co-${c.id}`} checked={formData.companyIds.includes(c.id)} onChange={() => handleCompanyToggle(c.id)} /><label htmlFor={`co-${c.id}`} className="ml-2">{c.name}</label></div>
                    ))}
                </div>
            </div>
             <div>
                <label className="text-gray-800 dark:text-gray-200">Permisos por Módulo</label>
                 <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 border p-3 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                    {allModules.map(module => (
                        <div key={module} className="flex items-center justify-between">
                            <label htmlFor={`perm-${module}`} className="text-sm">{moduleLabels[module]}</label>
                            <select id={`perm-${module}`} value={formData.permissions[module] || ''} onChange={e => handlePermissionChange(module, e.target.value as Role | undefined)} className={`text-xs p-1 rounded-md ${commonInputClass}`}>
                                <option value="">Sin Acceso</option>
                                <option value="viewer">Consulta</option>
                                <option value="operator">Operador</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    ))}
                 </div>
            </div>
            <div className="flex justify-end gap-3"><button type="submit" className="bg-primary text-white py-2 px-4 rounded-lg">{isNew ? 'Agregar' : 'Guardar'}</button></div>
        </form>
        <div className="lg:col-span-1 space-y-2">
            {users.map(u => (<div key={u.id} className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border dark:border-gray-700">
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{u.username} <span className="text-xs font-normal bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 rounded-full px-2 py-0.5 ml-2 capitalize">{u.role}</span></p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{u.email || 'Sin email'}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{u.companyIds.map(id => companies.find(c => c.id === id)?.name).join(', ')}</p>
              </div>
              <div className="flex gap-2 mt-2 pt-2 border-t dark:border-gray-700"><button onClick={() => setEditingUser(u)} className="text-blue-500"><PencilIcon/></button><button onClick={() => handleDelete(u.id)} className="text-red-500"><TrashIcon/></button></div>
            </div>))}
        </div>
      </div>
    </div>
  );
};
export default UserSettings;