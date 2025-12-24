
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
      // 1. Inicializar cliente Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // 2. Preparar el contexto estructurado para la IA
      const todayStr = new Date().toISOString().split('T')[0];
      
      const dataContext = {
          hoy: todayStr,
          tc_spot_ccl: financialData.exchangeRates?.slice(-1)[0]?.rate || 'Desconocido',
          curva_futuros: financialData.futureRateHistory?.slice(-1)[0]?.rates?.map((r: any) => ({
              vencimiento: r.date,
              tasa: r.rate
          })).slice(0, 6), // Enviamos los próximos 6 meses
          resumen_deudas: financialData.debts?.map((d: any) => ({
              tipo: d.type,
              monto: d.amount,
              moneda: d.currency,
              vencimiento: d.dueDate,
              tasa_tna: d.rate,
              cft_simulada: d.currency === 'ARS' ? "Requiere análisis vs futuros" : `${d.rate}%`
          })),
          resumen_inversiones: financialData.investments?.map((i: any) => ({
              instrumento: i.instrumentName,
              moneda: i.currency,
              valor_mercado: i.transactions?.reduce((s: number, t: any) => s + (t.quantity * t.price), 0)
          }))
      };

      // 3. Prompt Engineering: Definición de experto
      const systemInstruction = `
        Eres "Gemini Finance", un asesor financiero senior experto en el mercado corporativo y agroindustrial argentino.
        Tu misión es analizar la salud financiera del usuario basándote exclusivamente en los datos JSON provistos.
        
        REGLAS DE RESPUESTA:
        1. TERMINOLOGÍA: Habla en términos de CFT (Costo Financiero Total), Exposición Cambiaria, Tasa Implícita de Futuros y Liquidez.
        2. ANÁLISIS ARS vs USD: Si el usuario pregunta por deudas en pesos, compáralas contra la curva de futuros provista. Calcula mentalmente si la TNA de la deuda es mayor o menor a la tasa de devaluación esperada (TNA Implícita ROFEX).
        3. ADVERTENCIAS: Advierte si hay mucha concentración de vencimientos en un solo mes o si las tasas de interés superan el 80% TNA en ARS.
        4. FORMATO: Usa Markdown para listas, negritas y tablas. Sé profesional y directo.
        5. LÍMITE: Si no tienes datos suficientes para una respuesta exacta, indica qué dato falta (ej. "faltan cotizaciones de futuros para el mes X").
      `;

      const prompt = `
        CONSULTA DEL USUARIO: "${userQuery}"
        
        CONTEXTO DE DATOS REALES:
        ${JSON.stringify(dataContext, null, 2)}
      `;

      // 4. Llamada al modelo
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.2, // Mantenerlo preciso y poco creativo
            topP: 0.8
        }
      });

      const textResponse = result.text;
      if (!textResponse) throw new Error("La IA no devolvió texto.");
      
      setResponse(textResponse);
    } catch (err: any) {
      console.error("Error Gemini API:", err);
      setError("Error de conexión con la inteligencia financiera. Por favor, reintente en unos instantes.");
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
      "¿Qué me conviene más: tomar deuda en ARS al 70% o en USD al 5% con el ROFEX actual?",
      "Analiza mi exposición al riesgo de devaluación según mi posición neta.",
      "¿Cuál es el costo financiero promedio de mi cartera de deuda?",
      "Haz un resumen de los vencimientos más críticos del próximo trimestre."
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4 text-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl m-4 max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-3 text-primary dark:text-accent-dm font-bold text-xl">
                <div className="p-2 bg-primary/20 rounded-lg">
                    <SparklesIcon className="w-6 h-6" />
                </div>
                <span>Estrategia Inteligente</span>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <XIcon className="w-6 h-6 text-gray-500" />
            </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-grow overflow-y-auto custom-scrollbar">
            {isLoading ? (
                 <div className="flex flex-col items-center justify-center h-full py-12">
                    <div className="relative">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <SparklesIcon className="w-6 h-6 text-primary animate-pulse" />
                        </div>
                    </div>
                    <p className="mt-6 text-gray-600 dark:text-gray-400 font-bold animate-pulse">Gemini está procesando tu escenario financiero...</p>
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
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">¿Qué analizamos hoy?</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">Tengo acceso a tus deudas, inversiones y la curva de futuros para darte asesoramiento profesional.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {exampleQueries.map((ex, i) => (
                             <button 
                                key={i} 
                                onClick={() => handleExampleClick(ex)} 
                                className="bg-gray-50 dark:bg-gray-700/50 hover:bg-primary/10 dark:hover:bg-primary/20 text-gray-700 dark:text-gray-200 font-medium p-4 rounded-2xl text-left transition-all border border-gray-100 dark:border-gray-600 hover:border-primary/40 group flex gap-3"
                             >
                                <span className="text-primary group-hover:scale-125 transition-transform">•</span>
                                {ex}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Footer/Input */}
        <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <form onSubmit={handleFormSubmit} className="flex items-end gap-3">
                <div className="flex-grow">
                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ej: ¿Mi CFT en pesos es mayor a la devaluación esperada?"
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
            {response && !isLoading && (
                <button 
                    onClick={() => { setResponse(''); setQuery(''); }} 
                    className="mt-3 text-xs text-primary dark:text-accent-dm font-bold hover:underline"
                >
                    NUEVA CONSULTA
                </button>
            )}
        </div>
      </div>
      <style>{`
        @keyframes scale-in { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scale-in 0.2s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
      `}</style>
    </div>
  );
};

export default AIQueryAssistantModal;
