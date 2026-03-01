import { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useLanguage } from "@/lib/LanguageContext";
import { Card } from "@/components/Card";
import { formatCurrency, parseAmount } from "@/lib/formatCurrency";
import {
  marketsStorage,
  marketSalesStorage,
  MarketEvent,
  MarketSale,
} from "@/lib/storage";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { confirmAction } from "@/lib/confirmAction";

export default function MarketDetailScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [market, setMarket] = useState<MarketEvent | null>(null);
  const [sales, setSales] = useState<MarketSale[]>([]);
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [saleDesc, setSaleDesc] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [saleQty, setSaleQty] = useState("1");

  const loadData = useCallback(async () => {
    const allMarkets = await marketsStorage.getAll();
    const found = allMarkets.find((m) => m.id === id);
    setMarket(found || null);
    if (id) {
      const mSales = await marketSalesStorage.getByMarket(id);
      setSales(mSales);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const toggleMarketStatus = async () => {
    if (!market) return;
    const newStatus = market.status === "closed" ? "open" : "closed";
    await marketsStorage.update(market.id, { status: newStatus });
    setMarket({ ...market, status: newStatus });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const copyMarket = async () => {
    if (!market) return;
    confirmAction(
      "Markt duplizieren?",
      "Möchtest du eine Kopie dieses Marktes anlegen? Dabei werden Name und Schnellwahl-Artikel übernommen. Verkäufe, Standort und Gebühren werden auf 0 gesetzt.",
      "Abbrechen",
      "Kopieren",
      async () => {
        const newMarket = await marketsStorage.add({
          name: `${market.name} (Kopie)`,
          date: new Date().toISOString(),
          location: "",
          standFee: 0,
          travelCost: 0,
          notes: "",
          status: "open",
          quickItems: market.quickItems ? [...market.quickItems] : [],
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Replace current screen with the new market to avoid huge nav stacks or pushing over existing context
        router.replace({ pathname: "/market/[id]", params: { id: newMarket.id } });
      }
    );
  };

  const addSale = async () => {
    if (!saleDesc.trim() || !saleAmount.trim()) return;
    await marketSalesStorage.add({
      marketId: id!,
      description: saleDesc.trim(),
      amount: parseAmount(saleAmount),
      quantity: parseInt(saleQty, 10) || 1,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaleDesc("");
    setSaleAmount("");
    setSaleQty("1");
    setShowQuickSale(false);
    loadData();
  };

  const addQuickItemSale = async (name: string, price: number) => {
    await marketSalesStorage.add({
      marketId: id!,
      description: name,
      amount: price,
      quantity: 1,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadData();
  };

  const removeLastQuickItemSale = async (name: string, price: number) => {
    // Find the most recent sale with matching description and price
    const saleToRemove = sales.find(s => s.description === name && s.amount === price);
    if (saleToRemove) {
      await marketSalesStorage.delete(saleToRemove.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      loadData();
    }
  };

  const deleteSale = (saleId: string) => {
    if (market?.status === "closed") return;
    confirmAction(
      t.markets.deleteSale,
      t.markets.removeSale,
      t.markets.deleteCancel,
      t.markets.deleteAction,
      () => {
        marketSalesStorage.delete(saleId).then(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          loadData();
        });
      },
    );
  };

  const deleteMarket = () => {
    confirmAction(
      t.markets.deleteMarket,
      t.markets.deleteMarketConfirm,
      t.markets.deleteCancel,
      t.markets.deleteAction,
      () => {
        marketsStorage.delete(id!).then(() => {
          const deletePromises = sales.map((sale) => marketSalesStorage.delete(sale.id));
          Promise.all(deletePromises).then(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          });
        });
      },
    );
  };

  if (!market) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t.common.loading}</Text>
        </View>
      </View>
    );
  }

  const isClosed = market.status === "closed";
  const totalSales = sales.reduce((sum, s) => sum + s.amount * s.quantity, 0);
  const totalCosts = market.standFee + market.travelCost;
  const profit = totalSales - totalCosts;

  // Group sales by description and price
  const groupedSales = sales.reduce((acc, sale) => {
    const key = `${sale.description}-${sale.amount}`;
    if (!acc[key]) {
      acc[key] = {
        description: sale.description,
        amount: sale.amount,
        quantity: 0,
        ids: [],
      };
    }
    acc[key].quantity += sale.quantity;
    acc[key].ids.push(sale.id);
    return acc;
  }, {} as Record<string, { description: string; amount: number; quantity: number; ids: string[] }>);

  const sortedGroups = Object.values(groupedSales).sort((a, b) => a.description.localeCompare(b.description));

  const deleteGroup = (group: typeof sortedGroups[0]) => {
    if (market?.status === "closed") return;
    confirmAction(
      t.markets.deleteSale,
      `Alle ${group.quantity} Einträge für "${group.description}" löschen?`,
      t.markets.deleteCancel,
      t.markets.deleteAction,
      async () => {
        const promises = group.ids.map(id => marketSalesStorage.delete(id));
        await Promise.all(promises);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        loadData();
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(400).delay(0)}>
          <Card>
            <View style={styles.headerRow}>
              <View style={[styles.marketIcon, { backgroundColor: theme.gold + "15" }]}>
                <Ionicons name="storefront" size={24} color={theme.gold} />
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.marketName, { color: theme.text }]}>{market.name}</Text>
                <Text style={[styles.marketMeta, { color: theme.textSecondary }]}>
                  {new Date(market.date).toLocaleDateString()}
                  {market.location ? ` \u2022 ${market.location}` : ""}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                  <StatusBadge status={isClosed ? "closed" : "open"} label={isClosed ? "Geschlossen" : "Geöffnet"} color={isClosed ? theme.textSecondary : theme.success} />
                </View>
              </View>
              <View style={{ gap: 8, flexDirection: "row", alignItems: "center" }}>
                <Pressable onPress={() => router.push(`/market/edit/${id}`)} style={{ padding: 8 }}>
                  <Ionicons name="create-outline" size={22} color={theme.textSecondary} />
                </Pressable>
                <Pressable onPress={copyMarket} style={{ padding: 8 }}>
                  <Ionicons name="copy-outline" size={22} color={theme.textSecondary} />
                </Pressable>
                <Pressable onPress={toggleMarketStatus} style={{ padding: 8 }}>
                  <Ionicons name={isClosed ? "lock-closed" : "lock-open-outline"} size={22} color={theme.textSecondary} />
                </Pressable>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.markets.sales}</Text>
            <Text style={[styles.statValue, { color: theme.success }]}>
              {formatCurrency(totalSales)}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.markets.costs}</Text>
            <Text style={[styles.statValue, { color: theme.error }]}>
              {formatCurrency(totalCosts)}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.markets.profit}</Text>
            <Text style={[styles.statValue, { color: profit >= 0 ? theme.gold : theme.error }]}>
              {formatCurrency(profit)}
            </Text>
          </Card>
        </Animated.View>

        {(market.standFee > 0 || market.travelCost > 0) && (
          <Animated.View entering={FadeInDown.duration(400).delay(150)}>
            <Card>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.markets.costBreakdown}</Text>
              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: theme.textSecondary }]}>{t.markets.standFee}</Text>
                <Text style={[styles.costValue, { color: theme.text }]}>
                  {formatCurrency(market.standFee)}
                </Text>
              </View>
              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: theme.textSecondary }]}>{t.markets.travel}</Text>
                <Text style={[styles.costValue, { color: theme.text }]}>
                  {formatCurrency(market.travelCost)}
                </Text>
              </View>
            </Card>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Card>
            <View style={styles.salesHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t.markets.sales}
              </Text>
              {!isClosed && (
                <Pressable
                  testID="toggle-quick-sale"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowQuickSale(!showQuickSale);
                  }}
                  hitSlop={12}
                  style={({ pressed }) => [
                    styles.quickSaleToggle,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name={showQuickSale ? "close-circle" : "add-circle"}
                    size={28}
                    color={theme.gold}
                  />
                </Pressable>
              )}
            </View>

            {!isClosed && market.quickItems && market.quickItems.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 13, marginBottom: 8 }]}>Schnellwahl</Text>
                <View style={{ gap: 10 }}>
                  {market.quickItems.map((item, idx) => {
                    // Calculate count for this item
                    const count = sales.filter(s => s.description === item.name && s.amount === item.price).length;

                    return (
                      <View key={idx} style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: theme.inputBg,
                        borderColor: theme.border,
                        borderWidth: 1,
                        borderRadius: 12,
                        padding: 12
                      }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{item.name}</Text>
                          <Text style={{ fontSize: 13, color: theme.textSecondary }}>{formatCurrency(item.price)}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Pressable
                            onPress={() => removeLastQuickItemSale(item.name, item.price)}
                            disabled={count === 0}
                            style={({ pressed }) => ({
                              width: 32, height: 32, borderRadius: 16,
                              backgroundColor: theme.background,
                              alignItems: 'center', justifyContent: 'center',
                              borderWidth: 1, borderColor: theme.border,
                              opacity: pressed ? 0.7 : (count === 0 ? 0.3 : 1)
                            })}
                          >
                            <Ionicons name="remove" size={20} color={theme.text} />
                          </Pressable>

                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.text, minWidth: 20, textAlign: 'center' }}>{count}</Text>

                          <Pressable
                            onPress={() => addQuickItemSale(item.name, item.price)}
                            style={({ pressed }) => ({
                              width: 32, height: 32, borderRadius: 16,
                              backgroundColor: theme.gold,
                              alignItems: 'center', justifyContent: 'center',
                              opacity: pressed ? 0.8 : 1
                            })}
                          >
                            <Ionicons name="add" size={20} color="#0D0D0D" />
                          </Pressable>
                        </View>
                      </View>
                    )
                  })}
                </View>
              </View>
            )}

            {showQuickSale && !isClosed && (
              <View style={[styles.quickSaleForm, { borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={saleDesc}
                  onChangeText={setSaleDesc}
                  placeholder={t.markets.itemDescription}
                  placeholderTextColor={theme.textSecondary}
                />
                <View style={styles.quickSaleRow}>
                  <TextInput
                    style={[styles.input, styles.qtyInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                    value={saleQty}
                    onChangeText={setSaleQty}
                    placeholder={t.orders.qty}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={[styles.input, styles.priceInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                    value={saleAmount}
                    onChangeText={setSaleAmount}
                    placeholder={t.orders.price}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                  />
                  <Pressable
                    onPress={addSale}
                    style={({ pressed }) => [
                      styles.quickSaleBtn,
                      { backgroundColor: theme.gold },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons name="checkmark" size={22} color="#0D0D0D" />
                  </Pressable>
                </View>
              </View>
            )}

            {sortedGroups.length === 0 ? (
              <View style={styles.emptySales}>
                <Text style={[styles.emptySalesText, { color: theme.textSecondary }]}>
                  {t.markets.noSales}
                </Text>
              </View>
            ) : (
              sortedGroups.map((group, idx) => (
                <Pressable
                  key={idx}
                  onLongPress={() => !isClosed && deleteGroup(group)}
                  style={({ pressed }) => [
                    styles.saleRow,
                    { borderBottomColor: theme.border },
                    pressed && !isClosed && { opacity: 0.7 },
                  ]}
                >
                  <View style={styles.saleInfo}>
                    <Text style={[styles.saleDesc, { color: theme.text }]}>
                      {group.description}
                    </Text>
                    <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>
                      {group.quantity} x {formatCurrency(group.amount)}
                    </Text>
                  </View>
                  <Text style={[styles.saleTotal, { color: theme.success }]}>
                    {formatCurrency(group.amount * group.quantity)}
                  </Text>
                </Pressable>
              ))
            )}
          </Card>
        </Animated.View>

        <Pressable
          onPress={deleteMarket}
          style={({ pressed }) => [
            styles.deleteBtn,
            { borderColor: theme.error },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="trash-outline" size={18} color={theme.error} />
          <Text style={[styles.deleteBtnText, { color: theme.error }]}>{t.markets.deleteMarket}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatusBadge({ status, label, color }: { status: string; label: string; color: string }) {
  return (
    <View style={{
      backgroundColor: color + '20',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: color
    }}>
      <Text style={{ color: color, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  marketIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerInfo: { flex: 1, gap: 4 },
  marketName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  marketMeta: { fontSize: 14, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 16 },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4 },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 8 },
  costRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  costLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  costValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  salesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  quickSaleToggle: { padding: 4 },
  quickSaleForm: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10, marginBottom: 8 },
  input: { borderRadius: 10, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1 },
  quickSaleRow: { flexDirection: "row", gap: 8 },
  qtyInput: { width: 60 },
  priceInput: { flex: 1 },
  quickSaleBtn: { width: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  emptySales: { paddingVertical: 20, alignItems: "center" },
  emptySalesText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  saleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  saleInfo: { flex: 1, gap: 2 },
  saleDesc: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  saleMeta: { fontSize: 13, fontFamily: "Inter_400Regular" },
  saleTotal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14, borderWidth: 1, marginTop: 8 },
  deleteBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
