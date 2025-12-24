
/**
 * remoteConfig_example.ts: Ejemplo de uso de Firebase Remote Config.
 */
import { remoteConfig } from '../firebaseConfig';
import { fetchAndActivate, getString } from "firebase/remote-config";

export const getWelcomeMessage = async () => {
    try {
        await fetchAndActivate(remoteConfig);
        return getString(remoteConfig, "welcome_message_dashboard");
    } catch (err) {
        return "Bienvenido al Sistema Financiero";
    }
};
