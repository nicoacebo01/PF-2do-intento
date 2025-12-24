import React from 'react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Line, ComposedChart } from 'recharts';
import type { AppSettings } from '../types';

interface ChartDataPoint {
  month: string;
  debt: number;
  investment: number;
  net: number;
  cumulativeNet: number;
}

interface MaturitiesWaterfallChartProps {
  data: ChartDataPoint[];
  appSettings: AppSettings;
}

const CustomTooltip: React.FC<any> = ({ active, payload, label, isDarkMode }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const format = (value: number) => `USD ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    
    const isCurrentPosition = label === 'Posición Neta Actual';
    
    return (
      <div className={`p-4 border rounded-lg shadow-lg text-sm ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200'}`}>
        <p className="font-bold mb-2">{label}</p>
        {!isCurrentPosition && (
          <>
            <p className="text-red-600 dark:text-red-500">Deuda a Vencer: {format(data.debt)}</p>
            <p className="text-green-600 dark:text-green-400">Inversión a Vencer: {format(data.investment)}</p>
            <p className="font-semibold mt-2 border-t pt-2 dark:border-gray-600">Flujo Neto del Mes: {format(data.net)}</p>
          </>
        )}
        <p className="font-bold text-blue-700 dark:text-blue-400 mt-2">
          {isCurrentPosition ? 'Posición Actual: ' : 'Posición Proyectada Cierre: '}
          {format(data.cumulativeNet)}
        </p>
      </div>
    );
  }
  return null;
};


const MaturitiesWaterfallChart: React.FC<MaturitiesWaterfallChartProps> = ({ data, appSettings }) => {

  const formatUSD = (value: number) => `USD ${(value / 1000000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}MM`;

  if (!data || data.length < 2) { // Need at least current position and one month
    return <div className="flex items-center justify-center h-80 text-gray-500 dark:text-gray-400">No hay vencimientos futuros para mostrar.</div>;
  }
  
  const isDarkMode = appSettings.theme === 'dark';
  const axisColor = isDarkMode ? '#9ca3af' : '#6b7280';

  return (
    <div style={{ width: '100%', height: 400 }}>
      <ResponsiveContainer>
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
          <XAxis 
             dataKey="month" 
             tickFormatter={(tick) => {
                 if (tick === 'Posición Neta Actual') return tick;
                 const [year, month] = tick.split('-');
                 return new Date(Number(year), Number(month) - 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
             }}
             tick={{ fill: axisColor }}
             angle={-30}
             textAnchor="end"
          />
          <YAxis tickFormatter={formatUSD} tick={{ fill: axisColor }}/>
          <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
          <Legend wrapperStyle={{ color: axisColor }} verticalAlign="top" />
          <ReferenceLine y={0} stroke={isDarkMode ? '#a0a0a0' : '#000'} />
          <Bar dataKey="investment" fill="#22c55e" name="Entradas (Inversiones)" />
          <Bar dataKey="debt" fill="#ef4444" name="Salidas (Deudas)" />
          <Line type="monotone" dataKey="cumulativeNet" stroke="#1d4ed8" strokeWidth={3} name="Posición Neta Proyectada" dot={{r: 5}} activeDot={{r: 7}} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MaturitiesWaterfallChart;