import Stripe from "stripe";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

class PaymentService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  getDb() {
    return admin.firestore();
  }

  async createPaymentIntent(amount, currency, metadata) {
    if (!amount || amount <= 0) {
      throw new Error("Invalid payment amount");
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency || "usd",
      metadata,
      // Only allow card payments (removes Crypto, Cash App, Amazon Pay)
      payment_method_types: ["card"],
    });

    return paymentIntent;
  }

  async savePaymentRecord(paymentData) {
    const db = this.getDb();
    const paymentRef = db.collection("payments").doc();
    await paymentRef.set({
      ...paymentData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return paymentRef.id;
  }

  async updatePaymentStatus(paymentIntentId, status, orderData = {}) {
    const db = this.getDb();
    const paymentQuery = await db
      .collection("payments")
      .where("stripePaymentIntentId", "==", paymentIntentId)
      .limit(1)
      .get();

    if (paymentQuery.empty) {
      throw new Error("Payment record not found");
    }

    const paymentDoc = paymentQuery.docs[0];
    await paymentDoc.ref.update({
      status,
      ...orderData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return paymentDoc.id;
  }

  async getPaymentsByUser(userId) {
    const db = this.getDb();
    const paymentsSnapshot = await db
      .collection("payments")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    return paymentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  async getAllPayments(limit = 50) {
    const db = this.getDb();
    const paymentsSnapshot = await db
      .collection("payments")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    return paymentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  async verifyWebhookSignature(payload, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error("Webhook secret not configured");
    }

    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  }
}

export default new PaymentService();
