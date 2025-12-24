
import React from 'react';
import HelpTooltip from './HelpTooltip';

interface FinancialRatiosWidgetProps {
    stats: any;
    baseStats: any;
    isStressed: boolean;
}

const RatioGauge: React.FC<{
    label: string;
    value: number;
    targetValue?: number;
    suffix?: string;
    helpText: string;
    isStressed?: boolean;
    invertColor?: boolean;
}> = ({ label, value, targetValue, suffix = "%", helpText, isStressed, invertColor = false }) => {
    
    const getColor = (v: number) => {
        if (invertColor) {
            if (v < 30) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
            if (v < 60) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
            return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
        }
        if (v > 80) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
        if (v > 50) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
    };

    const colorClass = getColor(value);

    return (
        <div className={`p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center transition-all ${isStressed ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
            <p className="text-[10px] font-black uppercase text-gray-500 mb-3 flex items-center gap-1">
                {label} <HelpTooltip text={helpText} />
            </p>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 border-current ${colorClass}`}>
                <span className="text-xl font-black">{Math.round(value)}{suffix}</span>
            </div>
            {isStressed && targetValue !== undefined && (
                <p className="mt-2 text-[9px] text-gray-400 font-bold uppercase">Base: {Math.round(targetValue)}{suffix}</p>
            )}
        </div>
    );
};

const FinancialRatiosWidget: React.FC<FinancialRatiosWidgetProps> = ({ stats, baseStats, isStressed }) => {
    // Cálculo de Liquidez a 30 días simplificado (Inversiones / Deuda)
    const liquidityRatio = (stats.totalInvestmentUSD / stats.totalDebtUSD) * 100;
    const baseLiquidityRatio = (baseStats.totalInvestmentUSD / baseStats.totalDebtUSD) * 100;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <RatioGauge 
                label="Cobertura Cambiaria" 
                value={stats.hedgeCoverage} 
                targetValue={baseStats.hedgeCoverage}
                helpText="Indica qué porcentaje de la deuda en pesos cuenta con una cobertura de ROFEX o NDF. Ideal: > 70%." 
                isStressed={isStressed}
            />
            <RatioGauge 
                label="Ratio de Liquidez" 
                value={liquidityRatio} 
                targetValue={baseLiquidityRatio}
                helpText="Relación entre activos líquidos y pasivos totales. Un valor por encima de 100% indica que la cartera cubre la deuda." 
                isStressed={isStressed}
            />
            <RatioGauge 
                label="Vida Media Deuda" 
                value={stats.avgMaturityDays} 
                targetValue={baseStats.avgMaturityDays}
                suffix="d"
                helpText="Días promedio ponderados hasta el vencimiento de la deuda. Ayuda a medir el riesgo de refinanciación." 
                isStressed={isStressed}
            />
            <RatioGauge 
                label="Riesgo de Devaluación" 
                value={isStressed ? Math.abs(stats.netPosition - baseStats.netPosition) / (baseStats.totalInvestmentUSD || 1) * 100 : 0} 
                invertColor
                helpText="Sensibilidad de la posición neta ante el escenario simulado. Mide cuánto capital se 'licúa' o pierde en términos relativos." 
                isStressed={isStressed}
            />
        </div>
    );
};

export default FinancialRatiosWidget;
