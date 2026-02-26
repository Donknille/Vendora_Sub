import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

/**
 * Validates the integrity of the application environment before allowing
 * sensitive API requests (such as fetching Premium data or processing payments).
 * 
 * In a real-world scenario, you would integrate:
 * - react-native-google-play-integrity for Android
 * - react-native-app-attest (or Expo equivalent) for iOS
 */
export async function getAppIntegrityToken(): Promise<string> {
    try {
        // Placeholder for Play Integrity / App Attest logic
        // This generates a unique secure token that the backend verifies
        // against Google/Apple servers to ensure the app is NOT modded/cracked.

        if (Platform.OS === "android") {
            // const token = await PlayIntegrity.requestIntegrityToken(nonce);
            return await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                "android_play_integrity_mock_token"
            );
        } else if (Platform.OS === "ios") {
            // const token = await AppAttest.requestAttestation(challenge);
            return await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                "ios_app_attest_mock_token"
            );
        }

        return "web_integrity_token";
    } catch (e) {
        console.error("Integrity check failed:", e);
        throw new Error("App Integrity Compromised.");
    }
}

/**
 * Example usage in an API wrapper
 */
export async function secureApiFetch(url: string, options: RequestInit = {}) {
    const integrityToken = await getAppIntegrityToken();

    const headers = {
        ...options.headers,
        "x-app-integrity-token": integrityToken,
    };

    return fetch(url, { ...options, headers });
}
