
import React from 'react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, ReferenceLine } from 'recharts';
import type { AppSettings } from '../types';

interface LiquidityGapChartProps {
  data: any[];
  appSettings: AppSettings;
}

const CustomTooltip = ({ active, payload, label, isDarkMode }: any) => {
  if (active && payload && payload.length) {
    const format = (v: number) => `USD ${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
    const inflow = payload.find((p: any) => p.dataKey === 'inflow')?.value || 0;
    const outflow = payload.find((p: any) => p.dataKey === 'outflow')?.value || 0;
    const net = payload.find((p: any) => p.dataKey === 'net')?.value || 0;

    return (
      <div className={`p-3 rounded-lg shadow-xl border text-xs ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <p className="font-black mb-2 border-b pb-1 uppercase">{label}</p>
        <p className="text-green-600 dark:text-green-400 font-bold">Ingresos: {format(inflow)}</p>
        <p className="text-red-600 dark:text-red-400 font-bold">Egresos: {format(outflow)}</p>
        <div className="mt-2 pt-1 border-t flex justify-between gap-4">
            <span className="font-bold">GAP NETO:</span>
            <span className={`font-black ${net >= 0 ? 'text-primary' : 'text-red-600'}`}>{format(net)}</span>
        </div>
      </div>
    );
  }
  return null;
};

const LiquidityGapChart: React.FC<LiquidityGapChartProps> = ({ data, appSettings }) => {
  const isDarkMode = appSettings.theme === 'dark';
  const axisColor = isDarkMode ? '#9ca3af' : '#6b7280';

  return (
    <div style={{ width: '100%', height: 350 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#374151' : '#f3f4f6'} />
          <XAxis 
            dataKey="month" 
            tickFormatter={(val) => {
                const [y, m] = val.split('-');
                return new Date(Number(y), Number(m)-1).toLocaleDateString('es-AR', { month: 'short' }).toUpperCase();
            }}
            tick={{ fill: axisColor, fontSize: 10, fontWeight: 'bold' }}
          />
          <YAxis 
            tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} 
            tick={{ fill: axisColor, fontSize: 10 }}
          />
          <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
          <ReferenceLine y={0} stroke={isDarkMode ? '#4b5563' : '#d1d5db'} />
          
          <Bar dataKey="inflow" name="Ingresos (Invs + Granos)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
          <Bar dataKey="outflow" name="Egresos (Deuda)" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={30} />
          <Line type="monotone" dataKey="net" name="Brecha Neta" stroke={isDarkMode ? '#34d399' : '#059669'} strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LiquidityGapChart;
