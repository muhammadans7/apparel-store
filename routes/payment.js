import express from "express";
import paymentService from "../services/paymentService.js";
import admin from "firebase-admin";

const router = express.Router();

const getDb = () => admin.firestore();

// Test endpoint
router.get("/test", (req, res) => {
  console.log("Test endpoint hit!");
  res.json({
    status: "ok",
    message: "Payment routes are working!",
    timestamp: new Date().toISOString(),
  });
});

router.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, currency, userId, orderItems, shippingDetails } = req.body;

    if (!amount || !userId) {
      return res.status(400).json({ error: "Amount and userId are required" });
    }

    const metadata = {
      userId,
      orderItems: JSON.stringify(orderItems),
      customerEmail: shippingDetails?.customerEmail || "",
    };

    const paymentIntent = await paymentService.createPaymentIntent(
      amount,
      currency,
      metadata
    );

    const paymentRecordId = await paymentService.savePaymentRecord({
      userId,
      stripePaymentIntentId: paymentIntent.id,
      amount,
      currency: currency || "usd",
      status: "pending",
      orderItems,
      shippingDetails,
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentRecordId,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/webhook", async (req, res) => {
  const signature = req.headers["stripe-signature"];

  try {
    const event = await paymentService.verifyWebhookSignature(
      req.body,
      signature
    );

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        await paymentService.updatePaymentStatus(paymentIntent.id, "succeeded");
        console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        await paymentService.updatePaymentStatus(paymentIntent.id, "failed");
        console.log(`❌ Payment failed: ${paymentIntent.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(400).json({ error: error.message });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const payments = await paymentService.getPaymentsByUser(userId);
    res.json(payments);
  } catch (error) {
    console.error("Error fetching user payments:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/all", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const payments = await paymentService.getAllPayments(limit);
    res.json(payments);
  } catch (error) {
    console.error("Error fetching all payments:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
