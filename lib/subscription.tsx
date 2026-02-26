import React, { createContext, useContext, useEffect, useState } from "react";
import Purchases, { CustomerInfo, PurchasesOffering } from "react-native-purchases";
import { Platform } from "react-native";
import { useAuth } from "./auth";

interface SubscriptionContextType {
    isSubscribed: boolean;
    customerInfo: CustomerInfo | null;
    currentOffering: PurchasesOffering | null;
    isLoading: boolean;
    purchasePackage: (pkg: any) => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({} as SubscriptionContextType);

// API Keys should typically be in .env, using placeholder strings for the example architecture
const APIKeys = {
    apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || "public_apple_api_key",
    google: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || "public_google_api_key",
};

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
    const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const isSubscribed = customerInfo?.entitlements.active["pro"] !== undefined;

    useEffect(() => {
        setupRevenueCat();
    }, []);

    useEffect(() => {
        if (isAuthenticated && user) {
            Purchases.logIn(user.id).then(({ customerInfo }) => {
                setCustomerInfo(customerInfo);
            });
        } else {
            Purchases.logOut();
            setCustomerInfo(null);
        }
    }, [isAuthenticated, user]);

    const setupRevenueCat = async () => {
        setIsLoading(true);
        try {
            if (Platform.OS === "android") {
                Purchases.configure({ apiKey: APIKeys.google });
            } else if (Platform.OS === "ios") {
                Purchases.configure({ apiKey: APIKeys.apple });
            }

            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null) {
                setCurrentOffering(offerings.current);
            }

            const info = await Purchases.getCustomerInfo();
            setCustomerInfo(info);
        } catch (error) {
            console.error("RevenueCat setup error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const purchasePackage = async (pack: any) => {
        try {
            const { customerInfo } = await Purchases.purchasePackage(pack);
            setCustomerInfo(customerInfo);
            return customerInfo.entitlements.active["pro"] !== undefined;
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error("Purchase error", e);
            }
            return false;
        }
    };

    const restorePurchases = async () => {
        try {
            const customerInfo = await Purchases.restorePurchases();
            setCustomerInfo(customerInfo);
            return customerInfo.entitlements.active["pro"] !== undefined;
        } catch (e) {
            console.error("Restore error", e);
            return false;
        }
    };

    return (
        <SubscriptionContext.Provider
            value={{
                isSubscribed,
                customerInfo,
                currentOffering,
                isLoading,
                purchasePackage,
                restorePurchases,
            }}
        >
            {children}
        </SubscriptionContext.Provider>
    );
}

export const useSubscription = () => useContext(SubscriptionContext);
