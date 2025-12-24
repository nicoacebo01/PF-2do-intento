
/**
 * AIQueryAssistantModal.tsx: Integración real con Gemini AI para análisis financiero inteligente.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { XIcon, SparklesIcon } from './Icons';

interface AIQueryAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  financialData: any;
}

const parseMarkdown = (text: string) => {
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>');
      
    if (html.includes('<li>')) {
      html = `<ul>${html}</ul>`.replace(/<\/li>\n<ul>/g, '</li><li>').replace(/<\/ul>\n<li>/g, '</ul><li>');
    }
    html = html.replace(/\n/g, '<br />');
    return html;
};

const AIQueryAssistantModal: React.FC<AIQueryAssistantModalProps> = ({ isOpen, onClose, financialData }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleQuery = useCallback(async (userQuery: string) => {
    if (!userQuery.trim()) return;

    setIsLoading(true);
    setError('');
    setResponse('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const todayStr = new Date().toISOString().split('T')[0];
      
      const dataContext = {
          hoy: todayStr,
          tc_spot_ccl: financialData.exchangeRates?.slice(-1)[0]?.rate || 'Desconocido',
          curva_futuros: financialData.futureRateHistory?.slice(-1)[0]?.rates?.slice(0, 6),
          analisis_brechas: financialData.debts?.map((d: any) => ({
              vto: d.dueDate,
              monto: d.amount,
              moneda: d.currency,
              tasa: d.rate,
              clase: 'EGRESO_DEUDA',
              tiene_cobertura: (d.linkedArbitrageOpIds || []).length > 0
          })).concat(financialData.investments?.map((i: any) => ({
              vto: i.transactions?.find((t:any) => t.dueDate)?.dueDate,
              monto: i.transactions?.reduce((s:number, t:any)=>s+(t.quantity*t.price),0),
              moneda: i.currency,
              clase: 'INGRESO_INVERSION'
          }))),
          grain_inflows: financialData.grainCollections?.map((c: any) => ({
              vto: c.dueDate,
              monto_neto: c.grossAmount * (1 - c.tentativeDeductionPercentage/100),
              comprador: c.buyerName
          }))
      };

      const systemInstruction = `
        Eres "Gemini Strategic Treasury Advisor", el cerebro financiero de una gran empresa agrícola.
        Analizas liquidez (Cash Flow), riesgos de mercado (FX/Rates) y eficiencia de coberturas.
        
        Tus tareas prioritarias:
        1. ESTRATEGIA DE COBERTURA: Evalúa la "Cobertura de Moneda". Si es baja (<60%), advierte sobre la exposición al TC y recomienda ROFEX o ECHEQS.
        2. SENSIBILIDAD A TASAS: Analiza si la cartera de deuda tiene tasas muy altas y sugiere refinanciamiento si la curva de futuros lo justifica.
        3. DIAGNÓSTICO DE RATIOS: Mira la "Vida Media" de la deuda. Si es muy corta, advierte sobre el riesgo de iliquidez.
        
        FORMATO DE RESPUESTA:
        - Usa Tablas para comparaciones numéricas.
        - Usa Negritas para riesgos críticos.
        - Sé ejecutivo, directo y profesional. Habla de "Posición Neta" y "Descalce de Plazos".
      `;

      const prompt = `
        CONSULTA: "${userQuery}"
        
        CONTEXTO FINANCIERO REAL:
        ${JSON.stringify(dataContext, null, 2)}
      `;

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.1,
            topP: 0.9
        }
      });

      setResponse(result.text || "No pude generar el análisis estratégico.");
    } catch (err: any) {
      console.error("Error Gemini:", err);
      setError("Error al conectar con el cerebro estratégico.");
    } finally {
      setIsLoading(false);
    }
  }, [financialData]);
  
  const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleQuery(query);
  };
  
  const handleExampleClick = (exampleQuery: string) => {
      setQuery(exampleQuery);
      handleQuery(exampleQuery);
  };

  if (!isOpen) return null;
  
  const exampleQueries = [
      "¿Cuál es mi porcentaje real de cobertura ante una devaluación?",
      "Analiza el impacto de una suba de tasas en mis próximos vencimientos.",
      "¿Cómo están mis ratios de liquidez para el próximo trimestre?",
      "Resumen ejecutivo de riesgos de mi tesorería hoy."
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4 text-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl m-4 max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
        
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-3 text-primary dark:text-accent-dm font-bold text-xl">
                <div className="p-2 bg-primary/20 rounded-lg">
                    <SparklesIcon className="w-6 h-6" />
                </div>
                <span>Estrategia Gemini AI</span>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <XIcon className="w-6 h-6 text-gray-500" />
            </button>
        </div>

        <div className="p-6 flex-grow overflow-y-auto custom-scrollbar">
            {isLoading ? (
                 <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <div className="relative mb-6">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <SparklesIcon className="w-6 h-6 text-primary animate-pulse" />
                        </div>
                    </div>
                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100">Analizando Diagnóstico Estratégico...</h4>
                    <p className="text-gray-500 animate-pulse mt-2">Calculando ratios y eficiencia de coberturas</p>
                </div>
            ) : error ? (
                 <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl border border-red-100 dark:border-red-800 flex items-center gap-3">
                    <XIcon className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            ) : response ? (
                <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-relaxed text-base" 
                     dangerouslySetInnerHTML={{ __html: parseMarkdown(response) }} />
            ) : (
                <div className="space-y-8 py-4">
                    <div className="text-center max-w-md mx-auto">
                        <div className="inline-block p-4 bg-primary/10 rounded-full mb-4">
                            <SparklesIcon className="w-10 h-10 text-primary" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Consultoría Estratégica</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">Analizo tu salud financiera, detecto descalces de plazos y sugiero estrategias de cobertura.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {exampleQueries.map((ex, i) => (
                             <button 
                                key={i} 
                                onClick={() => handleExampleClick(ex)} 
                                className="bg-gray-50 dark:bg-gray-700/50 hover:bg-primary/10 dark:hover:bg-primary/20 text-gray-700 dark:text-gray-200 font-medium p-4 rounded-2xl text-left transition-all border border-gray-100 dark:border-gray-600 hover:border-primary/40 group flex gap-3"
                             >
                                <span className="text-primary group-hover:scale-125 transition-transform font-bold">»</span>
                                {ex}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <form onSubmit={handleFormSubmit} className="flex items-end gap-3">
                <div className="flex-grow">
                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ej: ¿Mi cobertura es suficiente ante una devaluación del 30%?"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-2xl shadow-sm py-3 px-5 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none h-[60px] transition-all"
                        disabled={isLoading}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleQuery(query);
                            }
                        }}
                    />
                </div>
                <button 
                    type="submit" 
                    className="bg-primary hover:bg-secondary text-white font-bold h-[60px] px-8 rounded-2xl transition-all shadow-lg shadow-primary/20 disabled:bg-gray-400 flex items-center gap-2 group" 
                    disabled={isLoading || !query.trim()}
                >
                    <span>Analizar</span>
                    <SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};

export default AIQueryAssistantModal;
