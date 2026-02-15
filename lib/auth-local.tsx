import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { settingsStorage } from "./storage";

interface LocalAuthContextType {
    isAuthenticated: boolean;
    isBiometricSupported: boolean;
    authenticate: () => Promise<boolean>;
    logout: () => void;
    isLoading: boolean;
}

const LocalAuthContext = createContext<LocalAuthContextType>({} as LocalAuthContextType);

// Key for storing simple "is enabled" flag if we wanted to enforce it,
// but we use settingsStorage for the preference. 
// SecureStore isn't strictly needed for "local only" if we just trust the UI state,
// but let's keep it simple.

export function LocalAuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isBiometricSupported, setIsBiometricSupported] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Ref to track app background state
    const appState = React.useRef(AppState.currentState);

    useEffect(() => {
        checkDeviceHardware();

        // Attempt initial authentication if enabled
        checkAuthPreference();

        // Lock app when it goes to background
        const subscription = AppState.addEventListener("change", nextAppState => {
            if (
                appState.current.match(/active/) &&
                nextAppState.match(/inactive|background/)
            ) {
                setIsAuthenticated(false);
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const checkDeviceHardware = async () => {
        try {
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            setIsBiometricSupported(compatible && enrolled);
        } catch (e) {
            console.log("Biometrics not supported on this platform", e);
            setIsBiometricSupported(false);
        }
    };

    const checkAuthPreference = async () => {
        try {
            const settings = await settingsStorage.get();
            // Default to true for security if not set? Or false? 
            // User asked for "Protection", so let's default to requiring it if hardware supports it using a "first launch" logic?
            // No, better to default to TRUE for this "Task" since the user EXPLICITLY asked for it.
            // But we need to distinguish "first run" vs "disabled".
            // For now, let's assume if it supports it, we require it.

            if (settings.biometricsEnabled === undefined) {
                // Automatically enable if hardware supports it
                const supported = await LocalAuthentication.hasHardwareAsync();
                if (supported) {
                    await settingsStorage.save({ ...settings, biometricsEnabled: true });
                }
            }

            const currentSettings = await settingsStorage.get();
            if (!currentSettings.biometricsEnabled) {
                setIsAuthenticated(true); // Skip auth if disabled
            }
        } catch (e) {
            console.error("Auth helper error", e);
        } finally {
            setIsLoading(false);
        }
    };

    const authenticate = async (): Promise<boolean> => {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: "Unlock Vendora",
                fallbackLabel: "Use Passcode",
            });

            if (result.success) {
                setIsAuthenticated(true);
                return true;
            }
            return false;
        } catch (error) {
            console.error("Auth error:", error);
            return false;
        }
    };

    const logout = () => {
        setIsAuthenticated(false);
    };

    return (
        <LocalAuthContext.Provider
            value={{
                isAuthenticated,
                isBiometricSupported,
                authenticate,
                logout,
                isLoading,
            }}
        >
            {children}
        </LocalAuthContext.Provider>
    );
}

export const useLocalAuth = () => useContext(LocalAuthContext);
