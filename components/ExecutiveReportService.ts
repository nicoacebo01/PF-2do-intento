
/**
 * ExecutiveReportService.ts: Generador de reportes en PDF de alta fidelidad para Directorio.
 */
declare const jspdf: any;

export const generateExecutiveReport = async (data: any) => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const { stats, stressedStats, isStressed, today, companyName } = data;

    const PRIMARY_COLOR = [4, 120, 87]; // Emerald 700
    const ACCENT_COLOR = [30, 64, 175]; // Blue 800

    // --- Header ---
    doc.setFillColor(...PRIMARY_COLOR);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE EJECUTIVO DE TESORERÍA', 15, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`EMPRESA: ${companyName.toUpperCase()}`, 15, 28);
    doc.text(`FECHA DE EMISIÓN: ${today.toLocaleDateString('es-AR')}`, 15, 34);

    if (isStressed) {
        doc.setFillColor(252, 211, 77); // Yellow 300
        doc.rect(140, 15, 55, 10, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.text('ESCENARIO DE STRESS ACTIVO', 143, 21);
    }

    // --- KPIs Grid ---
    let y = 55;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('I. Resumen de Posición Consolidada', 15, y);
    
    y += 10;
    const drawKpi = (label: string, value: string, x: number, y: number) => {
        doc.setDrawColor(230, 230, 230);
        doc.rect(x, y, 45, 25);
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(label.toUpperCase(), x + 5, y + 8);
        doc.setFontSize(11);
        doc.setTextColor(...ACCENT_COLOR);
        doc.setFont('helvetica', 'bold');
        doc.text(value, x + 5, y + 18);
    };

    const s = isStressed ? stressedStats : stats;
    drawKpi('Posición Neta', `USD ${s.netPosition.toLocaleString('es-AR', {maximumFractionDigits:0})}`, 15, y);
    drawKpi('Deuda Stock', `USD ${s.totalDebtUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}`, 65, y);
    drawKpi('Inversiones', `USD ${s.totalInvestmentUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}`, 115, y);
    drawKpi('Crédito Disp.', `USD ${s.availableCredit.toLocaleString('es-AR', {maximumFractionDigits:0})}`, 165, y);

    // --- Ratios ---
    y += 40;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('II. Indicadores de Riesgo y Salud', 15, y);
    
    y += 10;
    const liquidity = (s.totalInvestmentUSD / s.totalDebtUSD) * 100;
    doc.autoTable({
        startY: y,
        head: [['Indicador', 'Valor Actual', 'Nivel de Riesgo']],
        body: [
            ['Cobertura Cambiaria', `${s.hedgeCoverage.toFixed(1)}%`, s.hedgeCoverage > 70 ? 'BAJO' : 'ALTO'],
            ['Ratio de Liquidez', `${liquidity.toFixed(1)}%`, liquidity > 100 ? 'SALUDABLE' : 'CRÍTICO'],
            ['Vida Media Deuda', `${s.avgMaturityDays.toFixed(0)} días`, s.avgMaturityDays > 90 ? 'ADECUADO' : 'CORTO PLAZO'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [80, 80, 80] },
        styles: { fontSize: 9 }
    });

    // --- Strategy Interpretation (Gemini Simulation) ---
    y = doc.autoTable.previous.finalY + 15;
    doc.setFontSize(14);
    doc.text('III. Diagnóstico de Estrategia', 15, y);
    
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(50, 50, 50);
    
    const diagnosis = isStressed 
        ? "El escenario de stress simulado muestra una sensibilidad moderada. Se recomienda reforzar coberturas ROFEX para los vencimientos de los próximos 60 días si el TC CCL supera el spread proyectado."
        : "La cartera se encuentra equilibrada. Existe oportunidad de refinanciamiento de ECHEQs bancarios por líneas de largo plazo con tasas subsidiadas detectadas en el mercado.";
    
    const splitText = doc.splitTextToSize(diagnosis, 180);
    doc.text(splitText, 15, y);

    // --- Footer ---
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount} - Generado por Sistema PF Enterprise`, 105, 290, null, null, 'center');
    }

    doc.save(`REPORTE_EJECUTIVO_${companyName.toUpperCase()}_${today.toISOString().split('T')[0]}.pdf`);
};
