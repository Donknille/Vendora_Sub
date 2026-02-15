import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalAuth } from "../lib/auth-local";
import { useLanguage } from "../lib/LanguageContext";
import { useTheme } from "../lib/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LockScreen() {
    const { authenticate, isBiometricSupported, isLoading } = useLocalAuth();
    const theme = useTheme();

    const { t } = useLanguage();

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <Text style={{ color: theme.text }}>{t.common.loading}</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.content}>
                <Ionicons name="lock-closed-outline" size={80} color={theme.gold} />
                <Text style={[styles.title, { color: theme.text }]}>{t.auth.locked}</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    {t.auth.subtitle}
                </Text>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.gold }]}
                    onPress={authenticate}
                >
                    <Ionicons name="finger-print-outline" size={24} color={theme.background} style={styles.icon} />
                    <Text style={[styles.buttonText, { color: theme.background }]}>{t.auth.unlock}</Text>
                </TouchableOpacity>

                {!isBiometricSupported && (
                    <Text style={[styles.error, { color: theme.statusCancelled }]}>
                        {t.auth.notSupported}
                    </Text>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        alignItems: "center",
        padding: 24,
        width: "100%",
        maxWidth: 400,
    },
    title: {
        fontSize: 28,
        fontFamily: "Inter_700Bold",
        marginTop: 24,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        fontFamily: "Inter_400Regular",
        textAlign: "center",
        marginBottom: 48,
    },
    button: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: "100%",
    },
    icon: {
        marginRight: 8,
    },
    buttonText: {
        color: "#FFF",
        fontSize: 18,
        fontFamily: "Inter_600SemiBold",
    },
    error: {
        marginTop: 20,
        textAlign: 'center'
    }
});
