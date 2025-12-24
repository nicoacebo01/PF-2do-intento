
/**
 * storage_example.ts: Ejemplo de uso de Cloud Storage for Firebase.
 */
import { storage } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export const uploadDebtVoucher = async (debtId: string, file: File) => {
    const storageRef = ref(storage, `debts/${debtId}/vouchers/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
};
