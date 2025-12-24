
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface VarianceAnalysisChartProps {
    data: any[];
}

const VarianceAnalysisChart: React.FC<VarianceAnalysisChartProps> = ({ data }) => {
    return (
        <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <YAxis tickFormatter={(val) => `${(val/1000000).toFixed(1)}M`} tick={{ fontSize: 10 }} />
                    <Tooltip 
                        formatter={(value: number) => [`$${value.toLocaleString('es-AR', {maximumFractionDigits: 0})}`, '']}
                        contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
                    />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    
                    {/* Ingresos */}
                    <Bar dataKey="projIn" name="Ingresos Proy." fill="#93c5fd" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="realIn" name="Ingresos Real" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                    
                    {/* Egresos */}
                    <Bar dataKey="projOut" name="Egresos Proy." fill="#fca5a5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="realOut" name="Egresos Real" fill="#b91c1c" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default VarianceAnalysisChart;
