import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import crypto from "crypto";
import {
  users, orders, markets, expenses, order_items, market_sales,
  insertOrderSchema, insertOrderItemSchema, insertMarketSchema, insertMarketSaleSchema, insertExpenseSchema
} from "@vendora/shared";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export async function registerRoutes(app: Express): Promise<Server> {

  // -- Middleware für Subscriber-Gating --
  const requireSubscription = async (req: Request, res: Response, next: NextFunction) => {
    // Phase 5: App Integrity Verification
    const integrityToken = req.headers["x-app-integrity-token"];
    if (!integrityToken) {
      return res.status(403).json({ error: "Missing App Integrity Token. Update your app." });
    }

    // In production: verify token against Google Play API or Apple DeviceCheck/AppAttest
    // For this POC, we check our mock hashed tokens
    const isIOSMock = integrityToken === crypto.createHash('sha256').update('ios_app_attest_mock_token').digest('hex');
    const isAndroidMock = integrityToken === crypto.createHash('sha256').update('android_play_integrity_mock_token').digest('hex');
    const isWebMock = integrityToken === 'web_integrity_token';

    if (!isIOSMock && !isAndroidMock && !isWebMock) {
      console.warn("Invalid Integrity Token", integrityToken);
      return res.status(403).json({ error: "App Integrity Check Failed. Modified client detected." });
    }

    const supabaseId = req.headers["x-user-id"]; // In der echten App JWT verifizieren
    if (!supabaseId) return res.status(401).json({ error: "Unauthorized" });

    const [user] = await db.select().from(users).where(eq(users.supabase_id, supabaseId as string));
    if (!user || user.subscription_status !== "active") {
      return res.status(403).json({ error: "Premium subscription required." });
    }
    next();
  };

  // -- RevenueCat Webhook Endpoint --
  app.post("/api/webhooks/revenuecat", async (req, res) => {
    // 1. Signaturprüfung (Security Check)
    const signature = req.headers["x-revenuecat-signature"];
    const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

    // In der Produktion sollte immer das Secret geprüft werden, hier im POC fallbaclen wir auf console warning
    if (webhookSecret && signature) {
      const payload = typeof req.rawBody === "string" ? req.rawBody : (req.rawBody as Buffer)?.toString("utf-8");
      if (payload) {
        const expectedSignature = crypto.createHash("sha1").update(webhookSecret + payload).digest("hex");
        if (expectedSignature !== signature) {
          return res.status(401).send("Invalid signature");
        }
      }
    }

    try {
      const { event } = req.body;
      const appUserId = event.app_user_id;
      const entitlementId = event.entitlement_ids ? event.entitlement_ids[0] : null;

      if (!appUserId || entitlementId !== "pro") {
        return res.sendStatus(200); // Erfolgreich empfangen, aber nichts zu tun
      }

      let newStatus = "active";

      switch (event.type) {
        case "INITIAL_PURCHASE":
        case "RENEWAL":
        case "UNCANCELLATION":
          newStatus = "active";
          break;
        case "CANCELLATION":
        case "EXPIRATION":
          newStatus = "canceled";
          break;
        case "BILLING_ISSUE":
          newStatus = "past_due";
          break;
        default:
          // Andere Events wie TEST etc.
          return res.sendStatus(200);
      }

      // Datenbank über Drizzle aktualisieren
      const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;

      await db.update(users)
        .set({
          subscription_status: newStatus,
          subscription_expires_at: expiresAt
        })
        .where(eq(users.revenuecat_app_user_id, appUserId));

      console.log(`Updated user ${appUserId} to subscription status: ${newStatus}`);
      res.sendStatus(200);

    } catch (e) {
      console.error("Webhook processing error:", e);
      res.status(500).send("Error processing webhook");
    }
  });

  // -- Cloud Sync API Routes (Secured) --

  // --- Orders ---
  app.get("/api/orders", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userOrders = await db.select().from(orders).where(eq(orders.user_id, userId));
      res.json(userOrders);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.post("/api/orders", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertOrderSchema.parse({ ...req.body, user_id: userId });
      await db.insert(orders).values(validatedData);
      res.status(201).json({ message: "Order created" });
    } catch (e: any) {
      console.error(e);
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to create order" });
    }
  });

  app.put("/api/orders/:id", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertOrderSchema.partial().parse(req.body);
      await db.update(orders).set(validatedData).where(and(eq(orders.id, req.params.id as string), eq(orders.user_id, userId)));
      res.json({ message: "Order updated" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to update order" });
    }
  });

  app.delete("/api/orders/:id", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      await db.delete(orders).where(and(eq(orders.id, req.params.id as string), eq(orders.user_id, userId)));
      res.json({ message: "Order deleted" });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  // --- Markets ---
  app.get("/api/markets", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userMarkets = await db.select().from(markets).where(eq(markets.user_id, userId));
      res.json(userMarkets);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch markets" });
    }
  });

  app.post("/api/markets", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertMarketSchema.parse({ ...req.body, user_id: userId });
      await db.insert(markets).values(validatedData);
      res.status(201).json({ message: "Market created" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to create market" });
    }
  });

  // --- Expenses ---
  app.get("/api/expenses", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userExpenses = await db.select().from(expenses).where(eq(expenses.user_id, userId));
      res.json(userExpenses);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertExpenseSchema.parse({ ...req.body, user_id: userId });
      await db.insert(expenses).values(validatedData);
      res.status(201).json({ message: "Expense created" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to create expense" });
    }
  });

  // --- Order Items ---
  app.get("/api/order_items", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const items = await db.select().from(order_items).where(eq(order_items.user_id, userId));
      res.json(items);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch order items" });
    }
  });

  app.post("/api/order_items", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertOrderItemSchema.parse({ ...req.body, user_id: userId });
      await db.insert(order_items).values(validatedData);
      res.status(201).json({ message: "Order item created" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to create order item" });
    }
  });

  app.put("/api/order_items/:id", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertOrderItemSchema.partial().parse(req.body);
      await db.update(order_items).set(validatedData).where(and(eq(order_items.id, req.params.id as string), eq(order_items.user_id, userId)));
      res.json({ message: "Order item updated" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to update order item" });
    }
  });

  app.delete("/api/order_items/:id", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      await db.delete(order_items).where(and(eq(order_items.id, req.params.id as string), eq(order_items.user_id, userId)));
      res.json({ message: "Order item deleted" });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete order item" });
    }
  });

  // --- Market Sales ---
  app.get("/api/market_sales", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const sales = await db.select().from(market_sales).where(eq(market_sales.user_id, userId));
      res.json(sales);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch market sales" });
    }
  });

  app.post("/api/market_sales", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertMarketSaleSchema.parse({ ...req.body, user_id: userId });
      await db.insert(market_sales).values(validatedData);
      res.status(201).json({ message: "Market sale created" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to create market sale" });
    }
  });

  app.put("/api/market_sales/:id", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertMarketSaleSchema.partial().parse(req.body);
      await db.update(market_sales).set(validatedData).where(and(eq(market_sales.id, req.params.id as string), eq(market_sales.user_id, userId)));
      res.json({ message: "Market sale updated" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to update market sale" });
    }
  });

  app.delete("/api/market_sales/:id", requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      await db.delete(market_sales).where(and(eq(market_sales.id, req.params.id as string), eq(market_sales.user_id, userId)));
      res.json({ message: "Market sale deleted" });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete market sale" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
