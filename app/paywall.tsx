import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSubscription } from "../lib/subscription";
import { useTheme } from "../lib/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function PaywallScreen() {
    const { currentOffering, purchasePackage, restorePurchases, isSubscribed } = useSubscription();
    const theme = useTheme();
    const router = useRouter();
    const [isPurchasing, setIsPurchasing] = useState(false);

    if (isSubscribed) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.center}>
                    <Ionicons name="checkmark-circle-outline" size={80} color={theme.gold} />
                    <Text style={[styles.title, { color: theme.text, marginTop: 24 }]}>You are a Pro!</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                        Thank you for your subscription.
                    </Text>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.gold, marginTop: 24 }]}
                        onPress={() => router.replace("/")}
                    >
                        <Text style={[styles.buttonText, { color: theme.background }]}>Go to Dashboard</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const handlePurchase = async (pkg: any) => {
        setIsPurchasing(true);
        const success = await purchasePackage(pkg);
        setIsPurchasing(false);
        if (success) {
            Alert.alert("Success", "Welcome to Vendora Pro!");
            router.replace("/");
        }
    };

    const handleRestore = async () => {
        const success = await restorePurchases();
        if (success) {
            Alert.alert("Restored", "Your purchases have been restored.");
            router.replace("/");
        } else {
            Alert.alert("Notice", "No active subscriptions found to restore.");
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Ionicons name="star-outline" size={60} color={theme.gold} style={{ alignSelf: "center", marginTop: 20 }} />
                <Text style={[styles.title, { color: theme.text, textAlign: "center", marginTop: 16 }]}>
                    Unlock Vendora Pro
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary, textAlign: "center", marginBottom: 32 }]}>
                    Get full cloud sync, unlimited markets, and advanced reports.
                </Text>

                <View style={styles.features}>
                    <FeatureItem theme={theme} text="Unlimited Orders & Invoices" />
                    <FeatureItem theme={theme} text="Real-time Cloud Synchronization" />
                    <FeatureItem theme={theme} text="Export Financial PDF Reports" />
                    <FeatureItem theme={theme} text="Priority Support" />
                </View>

                {currentOffering?.availablePackages.map((pkg) => (
                    <TouchableOpacity
                        key={pkg.identifier}
                        style={[styles.packageCard, { borderColor: theme.gold, backgroundColor: theme.card }]}
                        onPress={() => handlePurchase(pkg)}
                        disabled={isPurchasing}
                    >
                        <View>
                            <Text style={[styles.packageTitle, { color: theme.text }]}>
                                {pkg.product.title}
                            </Text>
                            <Text style={[styles.packageDesc, { color: theme.textSecondary }]}>
                                {pkg.product.description}
                            </Text>
                        </View>
                        <Text style={[styles.packagePrice, { color: theme.gold }]}>
                            {pkg.product.priceString}
                        </Text>
                    </TouchableOpacity>
                ))}

                {isPurchasing && <ActivityIndicator style={{ marginTop: 20 }} size="large" color={theme.gold} />}

                <View style={{ flex: 1 }} />

                <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
                    <Text style={[styles.restoreText, { color: theme.textSecondary }]}>Restore Purchases</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

function FeatureItem({ theme, text }: { theme: any; text: string }) {
    return (
        <View style={styles.featureItem}>
            <Ionicons name="checkmark" size={20} color={theme.gold} />
            <Text style={[styles.featureText, { color: theme.text }]}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 24, flexGrow: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    title: { fontSize: 28, fontFamily: "Inter_700Bold" },
    subtitle: { fontSize: 16, fontFamily: "Inter_400Regular", marginTop: 8 },
    features: { marginBottom: 32 },
    featureItem: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    featureText: { fontSize: 16, fontFamily: "Inter_400Regular", marginLeft: 12 },
    packageCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 2, borderRadius: 16, padding: 20, marginBottom: 16 },
    packageTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
    packageDesc: { fontSize: 14, fontFamily: "Inter_400Regular", maxWidth: 200 },
    packagePrice: { fontSize: 20, fontFamily: "Inter_700Bold" },
    button: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12 },
    buttonText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
    restoreBtn: { alignSelf: "center", padding: 16, marginTop: 20 },
    restoreText: { fontSize: 16, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" },
});
