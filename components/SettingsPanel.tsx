

import React from 'react';
import type { AppSettings } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onUpdateSettings }) => {
    
  const handleSettingChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onUpdateSettings({ ...settings, [key]: value });
  };
  
  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-6 border-b dark:border-gray-700 pb-3">Parametrización General</h3>
      <div className="space-y-8">
        {/* Annual Rate Basis Setting */}
        <fieldset>
          <legend className="text-lg font-medium text-gray-800 dark:text-gray-200">Base de Cálculo Anual para Tasas</legend>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">Define si los cálculos de tasas anualizadas (TEA) usan 360 o 365 días como base.</p>
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <input
                id="basis-365"
                type="radio"
                value={365}
                checked={settings.annualRateBasis === 365}
                onChange={() => handleSettingChange('annualRateBasis', 365)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:bg-gray-900 dark:border-gray-600 dark:checked:bg-primary"
              />
              <label htmlFor="basis-365" className="ml-2 block text-sm font-medium text-gray-800 dark:text-gray-300">
                365 días (Año Calendario)
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="basis-360"
                type="radio"
                value={360}
                checked={settings.annualRateBasis === 360}
                onChange={() => handleSettingChange('annualRateBasis', 360)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:bg-gray-900 dark:border-gray-600 dark:checked:bg-primary"
              />
              <label htmlFor="basis-360" className="ml-2 block text-sm font-medium text-gray-800 dark:text-gray-300">
                360 días (Año Comercial)
              </label>
            </div>
          </div>
        </fieldset>

        {/* Visibility Settings */}
        <fieldset>
          <legend className="text-lg font-medium text-gray-800 dark:text-gray-200">Visibilidad de Secciones</legend>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">Controla la visibilidad de secciones de análisis complejas en la aplicación.</p>
          <div className="space-y-3">
            <div className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id="show-financial-breakdown"
                  type="checkbox"
                  checked={settings.showFinancialBreakdownSection}
                  onChange={(e) => handleSettingChange('showFinancialBreakdownSection', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:bg-gray-900 dark:border-gray-600 dark:checked:bg-primary"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label htmlFor="show-financial-breakdown" className="font-medium text-gray-900 dark:text-gray-200">
                  Mostrar Desglose Financiero
                </label>
                <p className="text-gray-500 dark:text-gray-400">Muestra el detalle de desembolso y cancelación en la ventana de detalle de una deuda.</p>
              </div>
            </div>
            <div className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id="show-usd-analysis"
                  type="checkbox"
                  checked={settings.showUsdAnalysisSection}
                  onChange={(e) => handleSettingChange('showUsdAnalysisSection', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:bg-gray-900 dark:border-gray-600 dark:checked:bg-primary"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label htmlFor="show-usd-analysis" className="font-medium text-gray-900 dark:text-gray-200">
                  Mostrar Análisis en Dólares
                </label>
                <p className="text-gray-500 dark:text-gray-400">Muestra la sección de análisis de costo en USD para deudas en ARS en la ventana de detalle.</p>
              </div>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
};

export default SettingsPanel;
