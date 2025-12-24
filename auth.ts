// This is a new file: auth.ts
import type { User, Permissions } from './types';

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


// WARNING: This is a mock user database for a frontend-only application.
// In a real-world scenario, NEVER store plaintext passwords.
// Passwords should be securely hashed and salted on a backend server.
export const DEFAULT_USERS: User[] = [
  {
    id: 'user-admin',
    username: 'ADMINLycsa',
    email: 'admin@example.com',
    password_plaintext: 'Dolar01@@',
    // FIX: Add role to default admin user.
    role: 'admin',
    permissions: allModulesAdmin,
    companyIds: ['co-1', 'co-2'], // Admins can see all companies by default
  },
  {
    id: 'user-operator',
    username: 'OPELycsa',
    email: 'operator@example.com',
    password_plaintext: 'Dolar01@@',
    // FIX: Add role to default operator user.
    role: 'operator',
    permissions: allModulesOperator,
    companyIds: ['co-1'],
  },
  {
    id: 'user-viewer',
    username: 'CONLycsa',
    email: 'viewer@example.com',
    password_plaintext: 'Dolar01@@',
    // FIX: Add role to default viewer user.
    role: 'viewer',
    permissions: allModulesViewer,
    companyIds: ['co-1', 'co-2'],
  }
];