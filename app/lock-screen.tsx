import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator } from "react-native";
import { useAuth } from "../lib/auth";
import { useLanguage } from "../lib/LanguageContext";
import { useTheme } from "../lib/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LockScreen() {
    const { isLoading: isAuthLoading } = useAuth();
    const theme = useTheme();
    const { t } = useLanguage();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isLoginMode, setIsLoginMode] = useState(true);

    if (isAuthLoading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.gold} />
            </View>
        );
    }

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Please enter both email and password.");
            return;
        }

        setIsLoading(true);
        try {
            if (isLoginMode) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                Alert.alert("Success", "Account created successfully.");
            }
        } catch (error: any) {
            Alert.alert("Error", error.message || "An error occurred during authentication.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.content}>
                <Ionicons name="cloud-outline" size={80} color={theme.gold} />
                <Text style={[styles.title, { color: theme.text }]}>Vendora Cloud</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    {isLoginMode ? "Sign in to sync your data" : "Create an account to start"}
                </Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                        placeholder="Email"
                        placeholderTextColor={theme.textSecondary}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />
                    <TextInput
                        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                        placeholder="Password"
                        placeholderTextColor={theme.textSecondary}
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.gold, opacity: isLoading ? 0.7 : 1 }]}
                    onPress={handleAuth}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={theme.background} />
                    ) : (
                        <Text style={[styles.buttonText, { color: theme.background }]}>
                            {isLoginMode ? "Sign In" : "Sign Up"}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)} style={styles.switchModeButton}>
                    <Text style={[styles.switchModeText, { color: theme.gold }]}>
                        {isLoginMode ? "Need an account? Sign Up" : "Already have an account? Sign In"}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", alignItems: "center" },
    content: { alignItems: "center", padding: 24, width: "100%", maxWidth: 400 },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 24, marginBottom: 8 },
    subtitle: { fontSize: 16, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 32 },
    inputContainer: { width: "100%", marginBottom: 24 },
    input: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12, fontSize: 16, fontFamily: "Inter_400Regular" },
    button: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 12, width: "100%" },
    switchModeButton: { marginTop: 20 },
    switchModeText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
    buttonText: { fontSize: 18, fontFamily: "Inter_600SemiBold" }
});
