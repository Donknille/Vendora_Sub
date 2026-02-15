import { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useLanguage } from "@/lib/LanguageContext";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/formatCurrency";
import { ordersStorage, Order, profileStorage } from "@/lib/storage";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { confirmAction } from "@/lib/confirmAction";
import { generateInvoiceHtml } from "@/lib/invoiceTemplate";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const STATUSES: Array<Order["status"]> = ["open", "paid", "shipped", "delivered", "cancelled"];

export default function OrderDetailScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const loadOrder = useCallback(async () => {
    const orders = await ordersStorage.getAll();
    const found = orders.find((o) => o.id === id);
    setOrder(found || null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder]),
  );

  const changeStatus = async (newStatus: Order["status"]) => {
    if (newStatus === order?.status) return;
    try {
      await ordersStorage.update(id!, { status: newStatus });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      loadOrder();
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const createInvoice = async () => {
    if (!order) return;
    setGeneratingPdf(true);
    try {
      const profile = await profileStorage.get();
      const html = generateInvoiceHtml(order, profile, t);

      if (Platform.OS === "web") {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: t.orders.shareInvoice,
            UTI: "com.adobe.pdf",
          });
        }
      }
    } catch (e) {
      console.error("Invoice generation error:", e);
      Alert.alert(t.orders.invoiceError);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const deleteOrder = () => {
    confirmAction(
      t.orders.deleteOrder,
      t.orders.cannotUndo,
      t.orders.deleteCancel,
      t.orders.deleteAction,
      () => {
        ordersStorage.delete(id!).then(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        });
      },
    );
  };

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t.common.loading}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400).delay(0)}>
          <Card>
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.invoiceNum, { color: theme.gold }]}>
                  {t.orders.invoice} #{order.invoiceNumber}
                </Text>
                <Text style={[styles.customerName, { color: theme.text }]}>
                  {order.customerName}
                </Text>
              </View>
              <StatusBadge status={order.status} />
            </View>

            {order.customerEmail ? (
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  {order.customerEmail}
                </Text>
              </View>
            ) : null}

            {order.customerAddress ? (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  {order.customerAddress}
                </Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                {new Date(order.orderDate || order.createdAt).toLocaleDateString("de-DE")}
              </Text>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.orders.items}</Text>
            {order.items.map((item, i) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  i < order.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                ]}
              >
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.itemQty, { color: theme.textSecondary }]}>
                    {item.quantity} x {formatCurrency(item.price)}
                  </Text>
                </View>
                <Text style={[styles.itemTotal, { color: theme.text }]}>
                  {formatCurrency(item.price * item.quantity)}
                </Text>
              </View>
            ))}
            <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>{t.orders.total}</Text>
              <Text style={[styles.totalValue, { color: theme.gold }]}>
                {formatCurrency(order.total)}
              </Text>
            </View>
          </Card>
        </Animated.View>

        {order.notes ? (
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <Card>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.orders.notes}</Text>
              <Text style={[styles.notesText, { color: theme.textSecondary }]}>{order.notes}</Text>
            </Card>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.orders.updateStatus}</Text>
            <View style={styles.statusGrid}>
              {STATUSES.map((status) => (
                <Pressable
                  key={status}
                  onPress={() => changeStatus(status)}
                  style={({ pressed }) => [
                    styles.statusBtn,
                    {
                      backgroundColor:
                        order.status === status ? theme.gold + "20" : theme.inputBg,
                      borderColor: order.status === status ? theme.gold : theme.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <StatusBadge status={status} />
                </Pressable>
              ))}
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(350)}>
          <Pressable
            testID="create-invoice-btn"
            onPress={createInvoice}
            disabled={generatingPdf}
            style={({ pressed }) => [
              styles.invoiceBtn,
              { backgroundColor: theme.gold },
              pressed && { opacity: 0.8 },
              generatingPdf && { opacity: 0.6 },
            ]}
          >
            {generatingPdf ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="document-text-outline" size={20} color="#fff" />
            )}
            <Text style={styles.invoiceBtnText}>{t.orders.createInvoice}</Text>
          </Pressable>
        </Animated.View>

        <Pressable
          onPress={deleteOrder}
          style={({ pressed }) => [
            styles.deleteBtn,
            { borderColor: theme.error },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="trash-outline" size={18} color={theme.error} />
          <Text style={[styles.deleteBtnText, { color: theme.error }]}>{t.orders.deleteOrder}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  invoiceNum: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  customerName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  infoText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemQty: { fontSize: 13, fontFamily: "Inter_400Regular" },
  itemTotal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  totalValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  notesText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusBtn: { paddingHorizontal: 4, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  invoiceBtn: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 10, padding: 16, borderRadius: 14, marginTop: 8 },
  invoiceBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14, borderWidth: 1, marginTop: 8 },
  deleteBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
