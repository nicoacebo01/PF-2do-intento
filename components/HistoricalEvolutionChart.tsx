import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import type { AppSettings } from '../types';

interface HistoricalDataPoint {
  date: string;
  "Deuda Total": number;
  "Inversiones Totales": number;
  "Posición Neta": number;
}

interface HistoricalEvolutionChartProps {
  data: HistoricalDataPoint[];
  appSettings: AppSettings;
}

const formatUSD = (value: number) => `USD ${(value / 1000000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}MM`;
const formatTooltipUSD = (value: number) => `USD ${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

const HistoricalEvolutionChart: React.FC<HistoricalEvolutionChartProps> = ({ data, appSettings }) => {
  const isDarkMode = appSettings.theme === 'dark';
  const axisColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const tooltipStyle = {
      backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      border: `1px solid ${isDarkMode ? '#4b5563' : '#ccc'}`,
      color: isDarkMode ? '#f3f4f6' : '#374151',
      borderRadius: '0.5rem'
  };

  if (!data || data.length < 2) {
    return <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500"><p>No hay suficientes datos históricos para mostrar el gráfico.</p></div>;
  }

  return (
    <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
            <ComposedChart
                data={data}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
                <XAxis 
                    dataKey="date" 
                    tickFormatter={(dateStr) => {
                        const date = new Date(dateStr + 'T00:00:00Z');
                        return date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
                    }}
                    tick={{ fill: axisColor }}
                />
                <YAxis tickFormatter={formatUSD} tick={{ fill: axisColor }} />
                <Tooltip 
                    formatter={(value: number, name: string) => [formatTooltipUSD(value), name]} 
                    labelFormatter={(label) => new Date(label + 'T00:00:00Z').toLocaleDateString('es-AR', {timeZone: 'UTC'})}
                    contentStyle={tooltipStyle}
                />
                <Legend wrapperStyle={{ color: axisColor }} />
                <Area type="monotone" dataKey="Inversiones Totales" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                <Area type="monotone" dataKey="Deuda Total" stackId="1" name="Deuda Total" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                <Line type="monotone" dataKey="Posición Neta" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            </ComposedChart>
        </ResponsiveContainer>
    </div>
  );
};

export default HistoricalEvolutionChart;