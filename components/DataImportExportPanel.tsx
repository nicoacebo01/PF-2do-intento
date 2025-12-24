// This is a new file: components/DataImportExportPanel.tsx
import React, { useCallback, useRef, useState } from 'react';
import type { Debt, Investment, Company, Bank, Broker, InvestmentType, ArbitrageOperation, BusinessUnit, Assignment, AppCurrency, ArbitrageCustomField } from '../types';
import { Currency } from '../types';
import ValidationSummaryModal from './ValidationSummaryModal'; // Import the new modal
import type { ValidationResult } from './ValidationSummaryModal'; // Import the type
import { exportMultiSheetExcel } from '../utils/export';
import type { ExportColumn } from '../utils/export';


// Assume XLSX is available globally from index.html
declare const XLSX: any;

// --- Helper Functions for Robust Parsing ---

const excelDateToJSDate = (excelDate: number): string => {
    if (excelDate < 1) return '';
    // Excel's epoch starts on 1900-01-01, but it incorrectly thinks 1900 is a leap year.
    // The number 25569 is the days between 1970-01-01 (Unix epoch) and 1900-01-01.
    const jsDate = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    if (isNaN(jsDate.getTime())) return '';
    return jsDate.toISOString().split('T')[0];
};

const parseDateValue = (value: any): string => {
    if (!value) return '';
    // Handle excel serial date number first for raw:true
    if (typeof value === 'number') {
        return excelDateToJSDate(value);
    }
    if (value instanceof Date) {
        const adjustedDate = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
        if (!isNaN(adjustedDate.getTime())) {
            return adjustedDate.toISOString().split('T')[0];
        }
    }
    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        const parts = value.match(/(\d+)/g);
        if (parts && parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const yearStr = parts[2];
            const year = yearStr.length === 2 ? parseInt(`20${yearStr}`) : parseInt(yearStr);
            const d = new Date(Date.UTC(year, month - 1, day));
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        }
    }
    return '';
};


const parseNumericValue = (value: any): number | null => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const cleanedString = value.replace(/[a-zA-Z\s$%]/g, ''); // Allow % sign
        const parsableValue = cleanedString.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(parsableValue);
        return isNaN(num) ? null : num;
    }
    return null;
};

const parseTransactionType = (value: any): 'Compra' | 'Venta' | null => {
    const str = String(value || '').toLowerCase().trim();
    if (str.startsWith('compra')) return 'Compra';
    if (str.startsWith('venta')) return 'Venta';
    return null;
}

const parseCurrency = (value: any): Currency | null => {
    const str = String(value || '').toUpperCase().trim();
    if (str === 'ARS') return Currency.ARS;
    if (str === 'USD') return Currency.USD;
    return null;
}

const parseArbitrageInstrument = (value: any): 'ROFEX' | 'NDF' | 'NDF Cliente' | null => {
    const str = String(value || '').toUpperCase().trim();
    if (str === 'ROFEX') return 'ROFEX';
    if (str === 'NDF') return 'NDF';
    if (str === 'NDF CLIENTE') return 'NDF Cliente';
    return null;
};

const parseArbitragePosition = (value: any): 'Comprada' | 'Vendida' | null => {
    const str = String(value || '').toLowerCase().trim();
    if (str.startsWith('comprada')) return 'Comprada';
    if (str.startsWith('vendida')) return 'Vendida';
    return null;
};

// Define props interface to resolve type error.
interface DataImportExportPanelProps {
    companyData: {
        debts: Debt[];
        investments: Investment[];
    };
    selectedCompany: Company | null;
    onDataImport: (data: { debts?: Debt[]; investments?: Investment[]; arbitrages?: ArbitrageOperation[] }) => Promise<void>;
    banks: Bank[];
    brokers: Broker[];
    companies: Company[];
    currencies: AppCurrency[];
    investmentTypes: InvestmentType[];
    businessUnits: BusinessUnit[];
    assignments: Assignment[];
    customFields: ArbitrageCustomField[];
}

const generateColumnsFromData = <T extends object>(data: T[]): ExportColumn<T>[] => {
    if (data.length === 0) return [];
    
    const keySet = new Set<string>();
    data.forEach(item => {
        if (item) {
            Object.keys(item).forEach(key => keySet.add(key));
        }
    });

    return Array.from(keySet).map(key => ({
        header: key,
        accessor: (row: T) => {
            const value = row ? (row as any)[key] : undefined;
            if (value === null || value === undefined) return '';
            if (Array.isArray(value)) return value.join(', ');
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
        }
    }));
};


const DataImportExportPanel: React.FC<DataImportExportPanelProps> = ({ companyData, selectedCompany, onDataImport, banks, brokers, companies, currencies, investmentTypes, businessUnits, assignments, customFields }) => {
    const inputFileRef = useRef<HTMLInputElement>(null);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

    const handleDownloadTemplate = () => {
        const debtHeaders = [
            "empresa", "banco_broker", "tipo_deuda", "monto", "moneda", "subtipo_moneda (MEP/CCL)",
            "tna", "tasa_moratoria", "fecha_otorgamiento_YYYY-MM-DD", "fecha_vencimiento_YYYY-MM-DD",
            "tc_origen", "modo_calculo (presentValue/futureValue)", "neto_recibido (para futureValue)",
            "comision", "timing_comision (A/V)", "sellos", "timing_sellos (A/V)", "derechos_mercado", "timing_derechos_mercado (A/V)",
            "fecha_real_cancelacion_YYYY-MM-DD", "interes_pagado_cancelacion", "penalidad_cancelacion"
        ];
        
        const investmentHeaders = [
            "empresa", "broker_banco", "tipo_inversion", "instrumento", "moneda",
            "fecha_transaccion_YYYY-MM-DD", "tipo_transaccion (Compra/Venta)", "cantidad", "precio", "tc_dia"
        ];
        
        const arbitrageBaseHeaders = [
            "empresa", "instrumento (ROFEX/NDF/NDF Cliente)", "operador (banco/broker)",
            "posicion (Comprada/Vendida)", "monto_usd", "fecha_inicio_YYYY-MM-DD",
            "fecha_vencimiento_YYYY-MM-DD", "tc_arbitraje", "unidad_negocio (opcional)",
            "asignacion (opcional)", "detalle (opcional)",
            "tc_arbitraje_interno", "cliente", "sucursal", "comercial",
            "fecha_cancelacion_YYYY-MM-DD", "tc_cancelacion"
        ];
        
        const customFieldHeaders = customFields
            .filter(f => f.fieldType === 'manual')
            .map(f => f.name);
        
        const arbitrageHeaders = [...arbitrageBaseHeaders, ...customFieldHeaders];
        
        const wsDebts = XLSX.utils.aoa_to_sheet([debtHeaders]);
        const wsInvestments = XLSX.utils.aoa_to_sheet([investmentHeaders]);
        const wsArbitrages = XLSX.utils.aoa_to_sheet([arbitrageHeaders]);
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsDebts, "Deudas");
        XLSX.utils.book_append_sheet(wb, wsInvestments, "Inversiones");
        XLSX.utils.book_append_sheet(wb, wsArbitrages, "Arbitrajes");
        
        XLSX.writeFile(wb, "plantilla_importacion_completa.xlsx");
    };

    const handleConfirmImport = useCallback(async (validData: { debts: Debt[], investments: Investment[], arbitrages: ArbitrageOperation[] }) => {
        await onDataImport(validData);
        setValidationResult(null);
        alert(`Importación confirmada: Se agregaron ${validData.debts.length} deudas, ${validData.investments.length} carteras de inversión y ${validData.arbitrages.length} operaciones de arbitraje.`);
    }, [onDataImport]);
    
    const handleExport = () => {
        if (!selectedCompany) {
            alert("Por favor, seleccione una empresa primero.");
            return;
        }

        const debtsToExport = companyData.debts;
        const investmentsToExport = companyData.investments.flatMap(inv => {
            const { transactions, ...invData } = inv;
            // The transaction id will overwrite the investment id, which is fine for this export.
            return transactions.map(t => ({...invData, ...t}));
        });
        
        const debtColumns = generateColumnsFromData(debtsToExport);
        const investmentColumns = generateColumnsFromData(investmentsToExport);

        exportMultiSheetExcel({
            fileName: `exportacion_${selectedCompany.name.replace(/\s/g, '_')}`,
            sheets: [
                {
                    sheetName: 'Deudas',
                    data: debtsToExport,
                    columns: debtColumns,
                },
                {
                    sheetName: 'Inversiones',
                    data: investmentsToExport,
                    columns: investmentColumns,
                }
            ]
        });
    };
    
    // Creates a map from header names to column indices for robust parsing
    const createHeaderMap = (headerRow: any[]): Record<string, number> => {
        const map: Record<string, number> = {};
        headerRow.forEach((cell, index) => {
            if (typeof cell === 'string') {
                map[cell.toLowerCase().trim()] = index;
            }
        });
        return map;
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const validationErrors: { row: number; sheet: string; message: string }[] = [];
            const validDebts: Debt[] = [];
            let validInvestments: Investment[] = [];
            const validArbitrages: ArbitrageOperation[] = [];
            
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', raw: true });
                
                // --- Process Debts ---
                if (workbook.SheetNames.includes("Deudas")) {
                    const debtSheet = workbook.Sheets["Deudas"];
                    const debtData = XLSX.utils.sheet_to_json(debtSheet, { header: 1, raw: true, defval: null });
                    const debtHeaderMap = createHeaderMap(debtData[0] as any[]);

                    (debtData as any[][]).slice(1).forEach((row, index) => {
                        const rowNum = index + 2;
                        if (row.every(cell => cell === null || String(cell).trim() === '')) return;

                        const companyName = String(row[debtHeaderMap['empresa']] || '').trim();
                        if (!companyName) { validationErrors.push({ row: rowNum, sheet: 'Deudas', message: 'Falta nombre de la empresa.' }); return; }
                        const company = companies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
                        if (!company) { validationErrors.push({ row: rowNum, sheet: 'Deudas', message: `Empresa '${companyName}' no encontrada.` }); return; }

                        const type = String(row[debtHeaderMap['tipo_deuda']] || '').trim();
                        if (!type) { validationErrors.push({ row: rowNum, sheet: 'Deudas', message: 'Falta tipo de deuda.' }); return; }

                        const amount = parseNumericValue(row[debtHeaderMap['monto']]);
                        if (amount === null || amount <= 0) { validationErrors.push({ row: rowNum, sheet: 'Deudas', message: 'Monto inválido o faltante.' }); return; }
                        
                        const currency = parseCurrency(row[debtHeaderMap['moneda']]);
                        if (!currency) { validationErrors.push({ row: rowNum, sheet: 'Deudas', message: `Moneda '${row[debtHeaderMap['moneda']]}' inválida.` }); return; }
                        
                        const subtypeName = String(row[debtHeaderMap['subtipo_moneda (mep/ccl)']] || '').toUpperCase().trim();
                        const currencyDetails = currencies.find(c => c.id === currency);
                        const subtype = currencyDetails?.subtypes.find(st => st.name.toUpperCase() === subtypeName);
                        const currencySubtypeId = subtype ? subtype.id : undefined;

                        const rateValue = parseNumericValue(row[debtHeaderMap['tna']]);
                        if (rateValue === null) { validationErrors.push({ row: rowNum, sheet: 'Deudas', message: 'TNA inválida o faltante.' }); return; }
                        const rate = rateValue < 1 ? rateValue * 100 : rateValue;
                        
                        const punitiveInterestRate = parseNumericValue(row[debtHeaderMap['tasa_moratoria']]);

                        const originationDate = parseDateValue(row[debtHeaderMap['fecha_otorgamiento_yyyy-mm-dd']]);
                        if (!originationDate) { validationErrors.push({ row: rowNum, sheet: 'Deudas', message: `Fecha de otorgamiento inválida.` }); return; }
                        
                        const dueDate = parseDateValue(row[debtHeaderMap['fecha_vencimiento_yyyy-mm-dd']]);
                        if (!dueDate) { validationErrors.push({ row: rowNum, sheet: 'Deudas', message: `Fecha de vencimiento inválida.` }); return; }
                        
                        let bankId: string | undefined, brokerId: string | undefined;
                        const counterpartyId = String(row[debtHeaderMap['banco_broker']] || '').trim().toUpperCase();
                        if (!counterpartyId) { validationErrors.push({ row: rowNum, sheet: 'Deudas', message: 'Falta banco/broker.' }); return; }
                        const foundBank = banks.find(b => b.name.toUpperCase() === counterpartyId);
                        const foundBroker = brokers.find(b => b.name.toUpperCase() === counterpartyId);
                        if (foundBank) bankId = foundBank.id; else if (foundBroker) brokerId = foundBroker.id;
                        else { validationErrors.push({ row: rowNum, sheet: 'Deudas', message: `Banco/Broker '${row[debtHeaderMap['banco_broker']]}' no encontrado.` }); return; }

                        const calculationMode = String(row[debtHeaderMap['modo_calculo (presentvalue/futurevalue)']] || 'presentValue').trim() === 'futureValue' ? 'futureValue' : 'presentValue';
                        const netAmountReceived = parseNumericValue(row[debtHeaderMap['neto_recibido (para futurevalue)']]);
                        
                        const getCostTiming = (val: any): 'V' | 'A' => (String(val || '').toUpperCase().trim() === 'V' ? 'V' : 'A');
                        
                        const commission = { value: parseNumericValue(row[debtHeaderMap['comision']]) ?? 0, timing: getCostTiming(row[debtHeaderMap['timing_comision (a/v)']]) };
                        const stamps = { value: parseNumericValue(row[debtHeaderMap['sellos']]) ?? 0, timing: getCostTiming(row[debtHeaderMap['timing_sellos (a/v)']]) };
                        const marketRights = { value: parseNumericValue(row[debtHeaderMap['derechos_mercado']]) ?? 0, timing: getCostTiming(row[debtHeaderMap['timing_derechos_mercado (a/v)']]) };
                        
                        const cancellationDate = parseDateValue(row[debtHeaderMap['fecha_real_cancelacion_yyyy-mm-dd']]);
                        const paidInterestAmount = parseNumericValue(row[debtHeaderMap['interes_pagado_cancelacion']]);
                        const cancellationPenalty = parseNumericValue(row[debtHeaderMap['penalidad_cancelacion']]);

                        validDebts.push({
                            id: crypto.randomUUID(), companyId: company.id, type, bankId, brokerId,
                            amount, currency, currencySubtypeId, rate, punitiveInterestRate: punitiveInterestRate ?? undefined,
                            originationDate, dueDate, exchangeRateAtOrigination: parseNumericValue(row[debtHeaderMap['tc_origen']]) ?? 0,
                            calculationMode, netAmountReceived: netAmountReceived ?? undefined,
                            commission, stamps, marketRights,
                            actualCancellationDate: cancellationDate || undefined, status: cancellationDate ? 'cancelled' : 'active',
                            paidInterestAmount: paidInterestAmount ?? undefined, cancellationPenalty: cancellationPenalty ?? undefined
                        });
                    });
                }


                // --- Process Investments ---
                if (workbook.SheetNames.includes("Inversiones")) {
                    const invSheet = workbook.Sheets["Inversiones"];
                    const invData = XLSX.utils.sheet_to_json(invSheet, { header: 1, raw: true, defval: null });
                    const investmentMap = new Map<string, Investment>();
                    const invHeaderMap = createHeaderMap(invData[0] as any[]);

                    (invData as any[][]).slice(1).forEach((row, index) => {
                        const rowNum = index + 2;
                        if (row.every(cell => cell === null || String(cell).trim() === '')) return;

                        const companyName = String(row[invHeaderMap['empresa']] || '').trim();
                        if (!companyName) { validationErrors.push({ row: rowNum, sheet: 'Inversiones', message: 'Falta nombre de la empresa.' }); return; }
                        const company = companies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
                        if (!company) { validationErrors.push({ row: rowNum, sheet: 'Inversiones', message: `Empresa '${companyName}' no encontrada.` }); return; }
                        
                        const invTypeName = String(row[invHeaderMap['tipo_inversion']] || '').trim();
                        if (!invTypeName) { validationErrors.push({ row: rowNum, sheet: 'Inversiones', message: 'Falta tipo de inversión.' }); return; }
                        const invType = investmentTypes.find(it => it.name.toLowerCase() === invTypeName.toLowerCase());
                        if (!invType) { validationErrors.push({ row: rowNum, sheet: 'Inversiones', message: `Tipo de Inversión '${invTypeName}' no encontrado.` }); return; }
                        
                        const instrumentName = String(row[invHeaderMap['instrumento']] || '').trim();
                        if (!instrumentName) { validationErrors.push({ row: rowNum, sheet: 'Inversiones', message: 'Falta nombre del instrumento.' }); return; }
                        
                        const currency = parseCurrency(row[invHeaderMap['moneda']]);
                        if (!currency) { validationErrors.push({ row: rowNum, sheet: 'Inversiones', message: `Moneda inválida.` }); return; }
                        
                        const date = parseDateValue(row[invHeaderMap['fecha_transaccion_yyyy-mm-dd']]);
                        if (!date) { validationErrors.push({ row: rowNum, sheet: 'Inversiones', message: `Fecha de transacción inválida.` }); return; }
                        
                        const transactionType = parseTransactionType(row[invHeaderMap['tipo_transaccion (compra/venta)']]);
                        if (!transactionType) { validationErrors.push({ row: rowNum, sheet: 'Inversiones', message: `Tipo de transacción inválido.` }); return; }
                        
                        const quantity = parseNumericValue(row[invHeaderMap['cantidad']]);
                        if (quantity === null || quantity <= 0) { validationErrors.push({ row: rowNum, sheet: 'Inversiones', message: `Cantidad inválida.` }); return; }

                        const price = parseNumericValue(row[invHeaderMap['precio']]);
                        if (price === null || price < 0) { validationErrors.push({ row: rowNum, sheet: 'Inversiones', message: `Precio inválido.` }); return; }
                        
                        let invBankId: string | undefined, invBrokerId: string | undefined;
                        const counterpartyId = String(row[invHeaderMap['broker_banco']] || '').trim().toUpperCase();
                        if (!counterpartyId) { validationErrors.push({ row: rowNum, sheet: 'Inversiones', message: 'Falta broker/banco.' }); return; }
                        const foundBank = banks.find(b => b.name.toUpperCase() === counterpartyId);
                        const foundBroker = brokers.find(b => b.name.toUpperCase() === counterpartyId);
                        if (foundBank) invBankId = foundBank.id; else if (foundBroker) invBrokerId = foundBroker.id;
                        else { validationErrors.push({ row: rowNum, sheet: 'Inversiones', message: `Broker/Banco '${row[invHeaderMap['broker_banco']]}' no encontrado.` }); return; }
                        
                        const key = `${company.id}-${instrumentName.toLowerCase()}-${currency}-${invType.id}`;
                        if (!investmentMap.has(key)) {
                            investmentMap.set(key, { id: crypto.randomUUID(), companyId: company.id, instrumentName, investmentTypeId: invType.id, currency, transactions: [] });
                        }
                        
                        investmentMap.get(key)!.transactions.push({ id: crypto.randomUUID(), brokerId: invBrokerId, bankId: invBankId, type: transactionType, date, quantity, price, exchangeRate: parseNumericValue(row[invHeaderMap['tc_dia']]) ?? 0 });
                    });
                    validInvestments = Array.from(investmentMap.values());
                }

                 // --- Process Arbitrages ---
                if (workbook.SheetNames.includes("Arbitrajes")) {
                    const arbSheet = workbook.Sheets["Arbitrajes"];
                    const arbData = XLSX.utils.sheet_to_json(arbSheet, { header: 1, raw: true, defval: null });
                    const arbHeaderMap = createHeaderMap(arbData[0] as any[]);
                    const customFieldMap = new Map(customFields.map(f => [f.name.toLowerCase(), f.id]));

                    (arbData as any[][]).slice(1).forEach((row, index) => {
                         const rowNum = index + 2;
                         if (row.every(cell => cell === null || String(cell).trim() === '')) return;

                         const companyName = String(row[arbHeaderMap['empresa']] || '').trim();
                         if (!companyName) { validationErrors.push({ row: rowNum, sheet: 'Arbitrajes', message: 'Falta nombre de la empresa.' }); return; }
                         const company = companies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
                         if (!company) { validationErrors.push({ row: rowNum, sheet: 'Arbitrajes', message: `Empresa '${companyName}' no encontrada.` }); return; }
                         
                         const instrument = parseArbitrageInstrument(row[arbHeaderMap['instrumento (rofex/ndf/ndf cliente)']]);
                         if (!instrument) { validationErrors.push({ row: rowNum, sheet: 'Arbitrajes', message: `Instrumento '${row[1]}' inválido.` }); return; }

                         const position = parseArbitragePosition(row[arbHeaderMap['posicion (comprada/vendida)']]);
                         if (!position) { validationErrors.push({ row: rowNum, sheet: 'Arbitrajes', message: `Posición inválida.` }); return; }
                         
                         const usdAmount = parseNumericValue(row[arbHeaderMap['monto_usd']]);
                         if (usdAmount === null || usdAmount <= 0) { validationErrors.push({ row: rowNum, sheet: 'Arbitrajes', message: 'Monto USD inválido.' }); return; }

                         const startDate = parseDateValue(row[arbHeaderMap['fecha_inicio_yyyy-mm-dd']]);
                         if (!startDate) { validationErrors.push({ row: rowNum, sheet: 'Arbitrajes', message: `Fecha de inicio inválida.` }); return; }
                         
                         const arbitrageDate = parseDateValue(row[arbHeaderMap['fecha_vencimiento_yyyy-mm-dd']]);
                         if (!arbitrageDate) { validationErrors.push({ row: rowNum, sheet: 'Arbitrajes', message: `Fecha de vencimiento inválida.` }); return; }
                         
                         const arbitrageRate = parseNumericValue(row[arbHeaderMap['tc_arbitraje']]);
                         if (arbitrageRate === null || arbitrageRate <= 0) { validationErrors.push({ row: rowNum, sheet: 'Arbitrajes', message: 'TC de arbitraje inválido.' }); return; }

                         let arbBankId: string | undefined, arbBrokerId: string | undefined;
                         const opId = String(row[arbHeaderMap['operador (banco/broker)']] || '').trim().toUpperCase();
                         if (!opId) { validationErrors.push({ row: rowNum, sheet: 'Arbitrajes', message: 'Falta operador (banco/broker).' }); return; }
                         const foundBank = banks.find(b => b.name.toUpperCase() === opId);
                         const foundBroker = brokers.find(b => b.name.toUpperCase() === opId);
                         if ((instrument === 'ROFEX' || instrument === 'NDF Cliente') && foundBroker) arbBrokerId = foundBroker.id;
                         else if (instrument === 'NDF' && foundBank) arbBankId = foundBank.id;
                         else { validationErrors.push({ row: rowNum, sheet: 'Arbitrajes', message: `Operador '${row[2]}' no encontrado o no corresponde.` }); return; }
                         
                         const buName = String(row[arbHeaderMap['unidad_negocio (opcional)']] || '').trim();
                         const businessUnitId = buName ? businessUnits.find(b => b.name.toLowerCase() === buName.toLowerCase())?.id : undefined;

                         const assignmentName = String(row[arbHeaderMap['asignacion (opcional)']] || '').trim();
                         const assignmentId = assignmentName ? assignments.find(a => a.name.toLowerCase() === assignmentName.toLowerCase())?.id : undefined;
                         
                         const cancellationDate = parseDateValue(row[arbHeaderMap['fecha_cancelacion_yyyy-mm-dd']]);
                         const cancellationRate = parseNumericValue(row[arbHeaderMap['tc_cancelacion']]);

                         const customData: Record<string, string | number> = {};
                         customFields.forEach(field => {
                            const fieldNameLower = field.name.toLowerCase();
                            if (arbHeaderMap[fieldNameLower] !== undefined) {
                                const value = row[arbHeaderMap[fieldNameLower]];
                                if (value !== null && value !== undefined) {
                                    customData[field.id] = field.type === 'number' ? parseNumericValue(value) ?? 0 : String(value);
                                }
                            }
                         });

                         validArbitrages.push({
                            id: crypto.randomUUID(), companyId: company.id, instrument, bankId: arbBankId, brokerId: arbBrokerId,
                            position, usdAmount, startDate, arbitrageDate, arbitrageRate,
                            businessUnitId, assignmentId, detail: String(row[arbHeaderMap['detalle (opcional)']] || ''),
                            internalArbitrageRate: parseNumericValue(row[arbHeaderMap['tc_arbitraje_interno']]) ?? undefined,
                            client: String(row[arbHeaderMap['cliente']] || undefined),
                            branch: String(row[arbHeaderMap['sucursal']] || undefined),
                            salesperson: String(row[arbHeaderMap['comercial']] || undefined),
                            cancellationDate: cancellationDate || undefined, cancellationRate: cancellationRate ?? undefined,
                            customData
                         });
                    });
                }

            } catch (error) {
                console.error("Error processing file:", error);
                alert(`Hubo un error al procesar el archivo: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                setValidationResult({ debts: validDebts, investments: validInvestments, arbitrages: validArbitrages, errors: validationErrors });
                if (inputFileRef.current) {
                    inputFileRef.current.value = '';
                }
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">Importar/Exportar Datos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Import Section */}
                <div className="bg-gray-100 dark:bg-gray-800/50 p-6 rounded-lg space-y-3">
                    <h4 className="font-medium text-gray-800 dark:text-gray-200">Importar desde Excel</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Suba un archivo Excel para agregar masivamente deudas, inversiones y/o arbitrajes. Descargue la plantilla para asegurar el formato correcto.
                    </p>
                    <div className="flex items-center gap-4">
                        <button onClick={handleDownloadTemplate} className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md">
                            Descargar Plantilla
                        </button>
                        <input
                            ref={inputFileRef}
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                </div>

                {/* Export Section */}
                <div className="bg-gray-100 dark:bg-gray-800/50 p-6 rounded-lg space-y-3">
                     <h4 className="font-medium text-gray-800 dark:text-gray-200">Exportar Datos</h4>
                     <p className="text-sm text-gray-600 dark:text-gray-400">
                         Exporte todas las deudas e inversiones de la empresa seleccionada actualmente a un archivo Excel.
                     </p>
                     <button
                        onClick={handleExport}
                        className="text-sm bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md"
                        disabled={!selectedCompany}
                     >
                        Exportar Datos de {selectedCompany ? selectedCompany.name : '(Ninguna empresa sel.)'}
                     </button>
                </div>
            </div>
             {validationResult && (
                <ValidationSummaryModal
                    isOpen={!!validationResult}
                    onClose={() => setValidationResult(null)}
                    onConfirm={handleConfirmImport}
                    result={validationResult}
                />
            )}
        </div>
    );
};

export default DataImportExportPanel;
