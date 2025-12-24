
/**
 * firebaseConfig.ts: Centraliza la inicialización de Firebase.
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getPerformance } from "firebase/performance";
import { getRemoteConfig } from "firebase/remote-config";

// Configuración de Firebase utilizando variables de entorno.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || "",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || ""
};

// Validación estricta para evitar errores 400 del servicio de Instalaciones
// Si las claves contienen los placeholders por defecto de la consola de Firebase, se considera inválido.
export const isFirebaseEnabled = Boolean(
  firebaseConfig.apiKey && 
  !firebaseConfig.apiKey.includes("TU_API_KEY") &&
  !firebaseConfig.apiKey.startsWith("AIzaSy...") && // Clave de ejemplo habitual
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== "tu-proyecto"
);

// Inicialización controlada
const app = (getApps().length === 0 && isFirebaseEnabled) 
  ? initializeApp(firebaseConfig) 
  : (getApps().length > 0 ? getApp() : null);

// Exportación segura de servicios
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const functions = app ? getFunctions(app) : null;
export const storage = app ? getStorage(app) : null;
export const remoteConfig = (app && isFirebaseEnabled) ? getRemoteConfig(app) : null;

let analytics: any = null;
let performance: any = null;

if (app && isFirebaseEnabled && typeof window !== "undefined") {
  isSupported().then(yes => {
    if (yes) {
        try {
            analytics = getAnalytics(app);
        } catch (e) {}
    }
  });
  try {
      performance = getPerformance(app);
  } catch (e) {}
}

export { analytics, performance };

if (!isFirebaseEnabled) {
  console.info("ℹ️ Firebase no configurado o claves inválidas. La aplicación funcionará en 'Modo Demostración' usando almacenamiento local.");
}
