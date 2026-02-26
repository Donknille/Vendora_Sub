import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { secureApiFetch } from "./integrity"; // Optional anti-tampering header addition
import { Order, MarketEvent, Expense, OrderItem } from "./storage"; // Reusing schemas from existing storage for now

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

export const useCloudApi = () => {
    const { session } = useAuth();
    const token = session?.access_token;
    const userId = session?.user?.id;

    const authHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "x-user-id": userId || "",
    };

    return {
        // --- Orders ---
        fetchOrders: async (): Promise<Order[]> => {
            const res = await secureApiFetch(`${API_BASE_URL}/orders`, { headers: authHeaders });
            if (!res.ok) throw new Error("Failed to fetch orders");
            return res.json();
        },
        createOrder: async (order: Partial<Order>) => {
            const res = await secureApiFetch(`${API_BASE_URL}/orders`, { method: "POST", headers: authHeaders, body: JSON.stringify(order) });
            if (!res.ok) throw new Error("Failed to create order");
            return res.json();
        },
        updateOrder: async (id: string, order: Partial<Order>) => {
            const res = await secureApiFetch(`${API_BASE_URL}/orders/${id}`, { method: "PUT", headers: authHeaders, body: JSON.stringify(order) });
            if (!res.ok) throw new Error("Failed to update order");
            return res.json();
        },
        deleteOrder: async (id: string) => {
            const res = await secureApiFetch(`${API_BASE_URL}/orders/${id}`, { method: "DELETE", headers: authHeaders });
            if (!res.ok) throw new Error("Failed to delete order");
            return res.json();
        },

        // --- Order Items ---
        fetchOrderItems: async (): Promise<OrderItem[]> => {
            const res = await secureApiFetch(`${API_BASE_URL}/order_items`, { headers: authHeaders });
            if (!res.ok) throw new Error("Failed to fetch order items");
            return res.json();
        },
        createOrderItem: async (item: Partial<OrderItem>) => {
            const res = await secureApiFetch(`${API_BASE_URL}/order_items`, { method: "POST", headers: authHeaders, body: JSON.stringify(item) });
            if (!res.ok) throw new Error("Failed to create order item");
            return res.json();
        },
        deleteOrderItem: async (id: string) => {
            const res = await secureApiFetch(`${API_BASE_URL}/order_items/${id}`, { method: "DELETE", headers: authHeaders });
            if (!res.ok) throw new Error("Failed to delete order item");
            return res.json();
        },

        // --- Markets ---
        fetchMarkets: async (): Promise<MarketEvent[]> => {
            const res = await secureApiFetch(`${API_BASE_URL}/markets`, { headers: authHeaders });
            if (!res.ok) throw new Error("Failed to fetch markets");
            return res.json();
        },
        createMarket: async (market: Partial<MarketEvent>) => {
            const res = await secureApiFetch(`${API_BASE_URL}/markets`, { method: "POST", headers: authHeaders, body: JSON.stringify(market) });
            if (!res.ok) throw new Error("Failed to create market");
            return res.json();
        },

        // --- Market Sales ---
        fetchMarketSales: async (): Promise<any[]> => {
            const res = await secureApiFetch(`${API_BASE_URL}/market_sales`, { headers: authHeaders });
            if (!res.ok) throw new Error("Failed to fetch market sales");
            return res.json();
        },
        createMarketSale: async (sale: any) => {
            const res = await secureApiFetch(`${API_BASE_URL}/market_sales`, { method: "POST", headers: authHeaders, body: JSON.stringify(sale) });
            if (!res.ok) throw new Error("Failed to create market sale");
            return res.json();
        },

        // --- Expenses ---
        fetchExpenses: async (): Promise<Expense[]> => {
            const res = await secureApiFetch(`${API_BASE_URL}/expenses`, { headers: authHeaders });
            if (!res.ok) throw new Error("Failed to fetch expenses");
            return res.json();
        },
        createExpense: async (expense: Partial<Expense>) => {
            const res = await secureApiFetch(`${API_BASE_URL}/expenses`, { method: "POST", headers: authHeaders, body: JSON.stringify(expense) });
            if (!res.ok) throw new Error("Failed to create expense");
            return res.json();
        },
    };
};

export function useOrdersQuery() {
    const api = useCloudApi();
    const { isAuthenticated } = useAuth();
    return useQuery({ queryKey: ["orders"], queryFn: api.fetchOrders, enabled: isAuthenticated });
}

export function useCreateOrderMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createOrder,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
    });
}

export function useMarketsQuery() {
    const api = useCloudApi();
    const { isAuthenticated } = useAuth();
    return useQuery({ queryKey: ["markets"], queryFn: api.fetchMarkets, enabled: isAuthenticated });
}

export function useCreateMarketMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createMarket,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["markets"] }),
    });
}

export function useExpensesQuery() {
    const api = useCloudApi();
    const { isAuthenticated } = useAuth();
    return useQuery({ queryKey: ["expenses"], queryFn: api.fetchExpenses, enabled: isAuthenticated });
}

export function useCreateExpenseMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createExpense,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    });
}

export function useOrderItemsQuery() {
    const api = useCloudApi();
    const { isAuthenticated } = useAuth();
    return useQuery({ queryKey: ["order_items"], queryFn: api.fetchOrderItems, enabled: isAuthenticated });
}

export function useMarketSalesQuery() {
    const api = useCloudApi();
    const { isAuthenticated } = useAuth();
    return useQuery({ queryKey: ["market_sales"], queryFn: api.fetchMarketSales, enabled: isAuthenticated });
}
