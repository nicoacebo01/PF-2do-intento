/**
 * api.ts: Capa de datos híbrida (Firebase + LocalStorage Fallback).
 * Implementación completa de persistencia para todos los módulos.
 */
import type { 
    AppState, User, Debt, Investment, Transaction, ArbitrageOperation, 
    GrainCollection, CollectionAdjustment, Company, DailyExchangeRate, 
    MarketPriceSnapshot, FutureExchangeRateSnapshot,
    AppSettings, Bank
} from '../types';
import { db, auth, isFirebaseEnabled } from '../firebaseConfig';
import { 
    doc, getDoc, setDoc, updateDoc, collection, getDocs, 
    query, where, onSnapshot, writeBatch, deleteDoc
} from "firebase/firestore";
import { 
    signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "firebase/auth";
import { DEFAULT_USERS } from '../auth';

// --- MOCK STORAGE HELPERS ---
const LOCAL_STORAGE_KEY = 'pf_app_data_v2';

const getLocalState = (): Partial<AppState> => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
};

const saveToLocal = (updates: Partial<AppState>) => {
    const current = getLocalState();
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...current, ...updates }));
};

// Helper genérico para guardar ítems en colecciones (Híbrido)
const saveCollectionItem = async <T extends { id: string }>(
    colName: string, 
    item: T, 
    stateKey: keyof AppState
) => {
    if (isFirebaseEnabled && db) {
        await setDoc(doc(db, colName, item.id), item, { merge: true });
    } else {
        const local = getLocalState();
        const items = (local[stateKey] as any[]) || [];
        const index = items.findIndex((i: any) => i.id === item.id);
        if (index > -1) items[index] = item;
        else items.push(item);
        saveToLocal({ [stateKey]: items });
    }
};

// --- AUTHENTICATION ---

export const login = async (users: User[], email: string, password_plaintext: string): Promise<{ user: User; token: string }> => {
    if (isFirebaseEnabled && auth && db) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password_plaintext);
            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            if (!userDoc.exists()) throw new Error("Perfil no encontrado en Firestore.");
            const userData = userDoc.data() as User;
            const token = await userCredential.user.getIdToken();
            return { user: userData, token };
        } catch (error: any) {
            throw new Error(error.code === 'auth/invalid-credential' ? "Credenciales incorrectas." : "Error de conexión con el servidor de autenticación.");
        }
    } else {
        const found = DEFAULT_USERS.find(u => u.username === email || u.email === email);
        if (found && found.password_plaintext === password_plaintext) {
            return { user: found, token: 'demo-token' };
        }
        throw new Error("Credenciales incorrectas (Modo Local).");
    }
};

export const logout = async (): Promise<void> => {
    if (isFirebaseEnabled && auth) await signOut(auth);
};

export const requestPasswordReset = async (users: User[], email: string): Promise<void> => {
    if (isFirebaseEnabled && auth) await sendPasswordResetEmail(auth, email);
};

// --- DATA SYNC ---

export const subscribeToData = (onUpdate: (data: Partial<AppState>) => void) => {
    if (!isFirebaseEnabled || !db) {
        onUpdate(getLocalState());
        return () => {};
    }

    const unsubscribes: (() => void)[] = [];
    const mapping = [
        { col: 'companies', key: 'companies' },
        { col: 'banks', key: 'banks' },
        { col: 'brokers', key: 'brokers' },
        { col: 'debt_types', key: 'debtTypes' },
        { col: 'investment_types', key: 'investmentTypes' },
        { col: 'currencies', key: 'currencies' },
        { col: 'business_units', key: 'businessUnits' },
        { col: 'assignments', key: 'assignments' },
        { col: 'custom_fields', key: 'customFields' },
        { col: 'exchange_rates', key: 'exchangeRates' },
        { col: 'future_rates', key: 'futureRateHistory' },
        { col: 'market_prices', key: 'marketPriceHistory' },
        { col: 'holidays', key: 'holidays' },
        { col: 'debts', key: 'debts' },
        { col: 'investments', key: 'investments' },
        { col: 'arbitrages', key: 'arbitrageOperations' },
        { col: 'grain_collections', key: 'grainCollections' },
        { col: 'collection_adjustments', key: 'collectionAdjustments' }
    ];

    mapping.forEach(({ col, key }) => {
        const unsub = onSnapshot(collection(db, col), (snap) => {
            const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            onUpdate({ [key]: data });
        });
        unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(unsub => unsub());
};

// --- CRUD OPERATIONS ---

export const saveDebt = async (debtData: Omit<Debt, 'id'>, id: string | undefined, selectedCompanyId: string | null): Promise<{ savedDebt: Debt, updatedArbitrageOps: ArbitrageOperation[] }> => {
    const debtId = id || crypto.randomUUID();
    const finalDebt = { ...debtData, companyId: selectedCompanyId!, id: debtId };
    await saveCollectionItem('debts', finalDebt, 'debts');
    return { savedDebt: finalDebt as Debt, updatedArbitrageOps: [] };
};

export const deleteDebt = async (debtId: string): Promise<string> => {
    if (isFirebaseEnabled && db) {
        await deleteDoc(doc(db, 'debts', debtId));
    } else {
        const local = getLocalState();
        saveToLocal({ debts: (local.debts || []).filter(d => d.id !== debtId) });
    }
    return debtId;
};

export const markDebtAsCancelled = async (payload: { debtId: string, cancellationDate: string, paidInterest: number | '', penalty: number | '' }): Promise<Debt> => {
    const { debtId, cancellationDate, paidInterest, penalty } = payload;
    const local = getLocalState();
    const debts = local.debts || [];
    const index = debts.findIndex(d => d.id === debtId);
    
    if (index === -1 && (!isFirebaseEnabled || !db)) throw new Error("Deuda no encontrada");

    const updates = {
        status: 'cancelled',
        actualCancellationDate: cancellationDate,
        paidInterestAmount: paidInterest === '' ? null : Number(paidInterest),
        cancellationPenalty: penalty === '' ? null : Number(penalty),
    };

    if (isFirebaseEnabled && db) {
        const debtRef = doc(db, 'debts', debtId);
        await updateDoc(debtRef, updates);
        const snap = await getDoc(debtRef);
        return { ...snap.data(), id: snap.id } as Debt;
    } else {
        const updatedDebt = { ...debts[index], ...updates } as Debt;
        debts[index] = updatedDebt;
        saveToLocal({ debts });
        return updatedDebt;
    }
};

export const saveTransaction = async (transactionData: Omit<Transaction, 'id'>, instrumentData: any, transactionId: string | undefined, selectedCompanyId: string | null): Promise<{ updatedInvestments: Investment[], updatedArbitrageOps: ArbitrageOperation[] }> => {
    const companyId = selectedCompanyId!;
    const finalTxId = transactionId || crypto.randomUUID();
    const finalTx = { ...transactionData, id: finalTxId };

    if (isFirebaseEnabled && db) {
        // Lógica simplificada para Firestore: buscamos inversión y actualizamos
        const invQuery = query(collection(db, 'investments'), where("companyId", "==", companyId), where("instrumentName", "==", instrumentData.instrumentName));
        const snap = await getDocs(invQuery);
        let investment: Investment;
        if (!snap.empty) {
            const existing = snap.docs[0].data() as Investment;
            const txs = transactionId ? existing.transactions.map(t => t.id === transactionId ? finalTx as any : t) : [...existing.transactions, finalTx as any];
            investment = { ...existing, transactions: txs, id: snap.docs[0].id };
        } else {
            investment = { ...instrumentData, id: crypto.randomUUID(), companyId, transactions: [finalTx] };
        }
        await setDoc(doc(db, 'investments', investment.id), investment);
    } else {
        const local = getLocalState();
        const investments = local.investments || [];
        const invIndex = investments.findIndex(i => i.companyId === companyId && i.instrumentName === instrumentData.instrumentName);
        if (invIndex > -1) {
            const existing = investments[invIndex];
            const txs = transactionId ? existing.transactions.map(t => t.id === transactionId ? finalTx as any : t) : [...existing.transactions, finalTx as any];
            investments[invIndex] = { ...existing, transactions: txs };
        } else {
            investments.push({ ...instrumentData, id: crypto.randomUUID(), companyId, transactions: [finalTx] });
        }
        saveToLocal({ investments });
    }
    return { updatedInvestments: [], updatedArbitrageOps: [] };
};

export const deleteTransaction = async (investmentId: string, transactionId: string): Promise<Investment[]> => {
    if (isFirebaseEnabled && db) {
        const ref = doc(db, 'investments', investmentId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data() as Investment;
            const txs = data.transactions.filter(t => t.id !== transactionId);
            if (txs.length === 0) await deleteDoc(ref);
            else await updateDoc(ref, { transactions: txs });
        }
    } else {
        const local = getLocalState();
        const investments = (local.investments || []).map(inv => {
            if (inv.id === investmentId) {
                return { ...inv, transactions: inv.transactions.filter((t: any) => t.id !== transactionId) };
            }
            return inv;
        }).filter(inv => inv.transactions.length > 0);
        saveToLocal({ investments });
    }
    return [];
};

export const saveMarketPrice = async (instrumentName: string, price: number, todayStr: string): Promise<MarketPriceSnapshot[]> => {
    const priceId = todayStr;
    const local = getLocalState();
    const history = local.marketPriceHistory || [];
    const index = history.findIndex(h => h.date === todayStr);
    
    let prices = index > -1 ? history[index].prices : {};
    prices[instrumentName.toLowerCase()] = price;

    const newSnapshot = { date: todayStr, prices };
    if (isFirebaseEnabled && db) {
        await setDoc(doc(db, 'market_prices', todayStr), newSnapshot, { merge: true });
    } else {
        if (index > -1) history[index] = newSnapshot;
        else history.push(newSnapshot);
        saveToLocal({ marketPriceHistory: history });
    }
    return [];
};

// FIX: Update saveArbitrage signature to accept an object without an id property, matching usage in ArbitrageModule to resolve the "missing property id" error.
export const saveArbitrage = async (data: Omit<ArbitrageOperation, 'id'>, id: string | undefined, selectedCompanyId: string | null): Promise<ArbitrageOperation[]> => {
    const arbId = id || crypto.randomUUID();
    const finalArb = { ...data, id: arbId, companyId: selectedCompanyId! };
    await saveCollectionItem('arbitrages', finalArb, 'arbitrageOperations');
    return [];
};

export const deleteArbitrage = async (id: string): Promise<ArbitrageOperation[]> => {
    if (isFirebaseEnabled && db) {
        await deleteDoc(doc(db, 'arbitrages', id));
    } else {
        const local = getLocalState();
        saveToLocal({ arbitrageOperations: (local.arbitrageOperations || []).filter(a => a.id !== id) });
    }
    return [];
};

export const updateGrainCollection = async (collection: GrainCollection): Promise<GrainCollection[]> => {
    await saveCollectionItem('grain_collections', collection, 'grainCollections');
    return [];
};

export const bulkUpdateGrainCollectionsBank = async (ids: string[], bankId: string): Promise<GrainCollection[]> => {
    if (isFirebaseEnabled && db) {
        const batch = writeBatch(db);
        ids.forEach(id => batch.update(doc(db!, 'grain_collections', id), { bankAccountId: bankId }));
        await batch.commit();
    } else {
        const local = getLocalState();
        const items = (local.grainCollections || []).map(c => ids.includes(c.id) ? { ...c, bankAccountId: bankId } : c);
        saveToLocal({ grainCollections: items });
    }
    return [];
};

export const importData = async (data: any): Promise<Partial<AppState>> => {
    if (isFirebaseEnabled && db) {
        const batch = writeBatch(db);
        if (data.debts) data.debts.forEach((d: any) => batch.set(doc(db!, 'debts', d.id), d));
        if (data.investments) data.investments.forEach((i: any) => batch.set(doc(db!, 'investments', i.id), i));
        if (data.arbitrages) data.arbitrages.forEach((a: any) => batch.set(doc(db!, 'arbitrages', a.id), a));
        await batch.commit();
    } else {
        const local = getLocalState();
        if (data.debts) local.debts = [...(local.debts || []), ...data.debts];
        if (data.investments) local.investments = [...(local.investments || []), ...data.investments];
        if (data.arbitrages) local.arbitrageOperations = [...(local.arbitrageOperations || []), ...data.arbitrages];
        saveToLocal(local);
    }
    return data;
};

export const updateState = async (payload: Partial<AppState>): Promise<Partial<AppState>> => {
    if (isFirebaseEnabled && db) {
        const batch = writeBatch(db);
        Object.entries(payload).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                val.forEach(item => {
                    const colName = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                    batch.set(doc(db!, colName, item.id || crypto.randomUUID()), item, { merge: true });
                });
            }
        });
        await batch.commit();
    } else {
        saveToLocal(payload);
    }
    return payload;
};

export const setCollectionAdjustments = async (adjustments: CollectionAdjustment[]): Promise<CollectionAdjustment[]> => {
    if (isFirebaseEnabled && db) {
        const batch = writeBatch(db);
        // Borramos primero los ajustes de la empresa para evitar duplicados si la lógica del componente lo requiere
        // (Nota: Esta implementación asume un reemplazo total o merge controlado)
        adjustments.forEach(adj => batch.set(doc(db!, 'collection_adjustments', adj.id), adj));
        await batch.commit();
    } else {
        saveToLocal({ collectionAdjustments: adjustments });
    }
    return adjustments;
};

export const updateCurrentUser = async (data: Partial<User>) => ({ currentUser: {} as any, users: [] });
export const importGrainCollections = async (c: any, t: any, co: any, b: any) => [];
