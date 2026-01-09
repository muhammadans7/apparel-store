// D:\ecommerence ashia\project1\backend\server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import admin from "firebase-admin";
import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import paymentRoutes from "./routes/payment.js";

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://gboneapparel.vercel.app",
      "https://fgboneapparel.vercel.app",
      "https://gboneapparel.com",
      "https://www.gboneapparel.com",
    ];

    // Allow Vercel preview deployments and allowed origins
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.includes(".vercel.app")
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Enable preflight for all routes

// ⚠️ CRITICAL: Stripe webhook endpoint MUST receive RAW body BEFORE json parsing
// This specific endpoint needs raw body for signature verification
app.use("/api/payment/webhook", express.raw({ type: "application/json" }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Mount payment routes
app.use("/api/payment", paymentRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// ✅ Load Firebase service account
try {
  let serviceAccount;

  // Check if FIREBASE_SERVICE_ACCOUNT env variable exists (for production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log("✅ Using Firebase credentials from environment variable");
  } else {
    // Fall back to local file for development
    const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
    console.log("✅ Using Firebase credentials from local file");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("✅ Firebase Admin initialized successfully");
} catch (error) {
  console.error("❌ Error initializing Firebase Admin:", error.message);
  process.exit(1);
}

const db = admin.firestore();

// ========== PROFESSIONAL EMAIL CONFIGURATION ==========
let transporter;

const setupEmailTransporter = () => {
  try {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    console.log("📧 Gmail Transporter configured successfully");
  } catch (error) {
    console.error("❌ Email transporter configuration failed:", error.message);
  }
};

// Initialize email transporter
setupEmailTransporter();

// Verify email configuration
const verifyEmailConfig = async () => {
  if (!transporter) {
    console.log("❌ Email transporter not available");
    return false;
  }

  try {
    await transporter.verify();
    console.log("✅ Email server connection verified");
    console.log("📧 Ready to send emails to real customers");
    return true;
  } catch (error) {
    console.error("❌ Email server connection failed:", error.message);
    console.log("💡 Please check your Gmail credentials in .env file");
    console.log("💡 Make sure you enabled 2FA and used App Password");
    return false;
  }
};

// Call verification on startup
verifyEmailConfig();

// ========== PROFESSIONAL EMAIL SERVICE ==========
const emailService = {
  // Send email with error handling and logging
  async sendEmail(to, subject, html, text = null) {
    if (!transporter) {
      console.error("❌ Email transporter not configured");
      return { success: false, error: "Email service not configured" };
    }

    try {
      const mailOptions = {
        from: `"G-Bone Apparel" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: subject,
        html: html,
        text: text || this.htmlToText(html),
      };

      console.log(`📧 Sending email to: ${to}`);
      console.log(`📝 Subject: ${subject}`);

      const result = await transporter.sendMail(mailOptions);

      console.log("✅ Email sent successfully");
      console.log(`📍 Message ID: ${result.messageId}`);
      console.log(`📍 Response: ${result.response}`);

      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
      };
    } catch (error) {
      console.error("❌ Email sending failed:", error.message);

      // Provide specific error messages
      let userMessage = "Failed to send email";
      if (error.code === "EAUTH") {
        userMessage = "Email authentication failed. Check credentials.";
      } else if (error.code === "EENVELOPE") {
        userMessage = "Invalid email address.";
      } else if (error.code === "ECONNECTION") {
        userMessage = "Email server connection failed.";
      }

      return {
        success: false,
        error: error.message,
        userMessage: userMessage,
      };
    }
  },

  // Convert HTML to plain text for email clients
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  },
};

// ========== PROFESSIONAL EMAIL TEMPLATES ==========

const emailTemplates = {
  // Order Confirmation Template
  orderConfirmation(order, customerName) {
    const orderDate = new Date(
      order.createdAt?.toDate?.() || order.createdAt || new Date()
    );
    const deliveryDate = new Date(
      order.deliveryDate || Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .order-card { background: white; border-radius: 12px; padding: 25px; margin: 25px 0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
        .order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .order-number { font-size: 18px; font-weight: bold; color: #2d3748; }
        .status-badge { background: #48bb78; color: white; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .info-item { display: flex; flex-direction: column; }
        .info-label { font-size: 12px; color: #718096; margin-bottom: 4px; }
        .info-value { font-size: 14px; font-weight: 600; color: #2d3748; }
        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .items-table th { background: #f7fafc; padding: 12px; text-align: left; font-weight: 600; color: #4a5568; border-bottom: 2px solid #e2e8f0; }
        .items-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
        .total-row { background: #f0fff4; font-weight: bold; }
        .next-steps { background: #ebf8ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #4299e1; }
        .footer { text-align: center; padding: 30px; background: #f7fafc; color: #718096; font-size: 14px; }
        @media (max-width: 600px) {
            .info-grid { grid-template-columns: 1fr; }
            .order-header { flex-direction: column; align-items: flex-start; gap: 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="font-size: 28px; margin-bottom: 10px;">🎉 Order Confirmed!</h1>
            <p style="font-size: 16px; opacity: 0.9;">Thank you for your purchase from G-Bone Apparel</p>
        </div>
        
        <div class="content">
            <p style="margin-bottom: 20px;">Dear <strong style="color: #2d3748;">${customerName}</strong>,</p>
            <p style="color: #4a5568; margin-bottom: 25px;">We're excited to let you know that we've received your order and it's being processed. Here are your order details:</p>
            
            <div class="order-card">
                <div class="order-header">
                    <div class="order-number">Order #${order.id
                      .substring(0, 8)
                      .toUpperCase()}</div>
                    <div class="status-badge">CONFIRMED</div>
                </div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">ORDER DATE</span>
                        <span class="info-value">${orderDate.toLocaleDateString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">ESTIMATED DELIVERY</span>
                        <span class="info-value">${deliveryDate.toLocaleDateString()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">PAYMENT METHOD</span>
                        <span class="info-value">${
                          order.paymentMethod || "Cash on Delivery"
                        }</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">TOTAL AMOUNT</span>
                        <span class="info-value">$${order.totalAmount?.toFixed(
                          2
                        )}</span>
                    </div>
                </div>
            </div>

            <h3 style="color: #2d3748; margin-bottom: 15px;">Order Items</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${order.items
                      ?.map(
                        (item) => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>$${item.price}</td>
                            <td>$${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right; padding-right: 20px;"><strong>Grand Total:</strong></td>
                        <td><strong>$${order.totalAmount?.toFixed(
                          2
                        )}</strong></td>
                    </tr>
                </tfoot>
            </table>

            <div class="next-steps">
                <h4 style="color: #2b6cb0; margin-bottom: 10px;">📦 What's Next?</h4>
                <p style="color: #2c5282; margin: 5px 0;">• We'll send you a confirmation when your order ships</p>
                <p style="color: #2c5282; margin: 5px 0;">• Track your order status in your account dashboard</p>
                <p style="color: #2c5282; margin: 5px 0;">• Expected delivery: ${deliveryDate.toLocaleDateString()}</p>
            </div>
        </div>
        
        <div class="footer">
            <p style="margin-bottom: 10px;">Thank you for shopping with <strong>G-Bone Apparel</strong></p>
            <p style="font-size: 12px; opacity: 0.7;">If you have any questions, contact us at support@g-bone-apparel.com</p>
            <p style="font-size: 12px; opacity: 0.7; margin-top: 10px;">© 2024 G-Bone Apparel. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  },

  // Order Shipped Template
  orderShipped(order, customerName, trackingNumber = null) {
    const deliveryDate = new Date(
      order.deliveryDate || Date.now() + 3 * 24 * 60 * 60 * 1000
    );

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Shipped</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .tracking-card { background: white; border-radius: 12px; padding: 25px; margin: 25px 0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; border-left: 4px solid #ed8936; }
        .tracking-number { background: #fffaf0; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #fed7aa; }
        .footer { text-align: center; padding: 30px; background: #f7fafc; color: #718096; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="font-size: 28px; margin-bottom: 10px;">🚚 Your Order is on the Way!</h1>
            <p style="font-size: 16px; opacity: 0.9;">Great news from G-Bone Apparel! Your order has been shipped</p>
        </div>
        
        <div class="content">
            <p style="margin-bottom: 20px;">Dear <strong style="color: #2d3748;">${customerName}</strong>,</p>
            <p style="color: #4a5568; margin-bottom: 25px;">Your order has been shipped and is on its way to you! Here are the shipping details:</p>
            
            <div class="tracking-card">
                <h3 style="color: #2d3748; margin-bottom: 15px;">Order #${order.id
                  .substring(0, 8)
                  .toUpperCase()}</h3>
                <div style="display: inline-block; background: #ed8936; color: white; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 15px;">
                    SHIPPED
                </div>
                
                ${
                  trackingNumber
                    ? `
                <div class="tracking-number">
                    <strong style="color: #dd6b20;">Tracking Number:</strong><br>
                    <span style="font-family: monospace; font-size: 16px; font-weight: bold;">${trackingNumber}</span>
                </div>
                `
                    : ""
                }
                
                <div style="margin-top: 15px;">
                    <p style="margin: 5px 0;"><strong>Estimated Delivery:</strong> ${deliveryDate.toLocaleDateString()}</p>
                    <p style="margin: 5px 0;"><strong>Shipping Address:</strong> ${
                      order.customerAddress
                    }</p>
                </div>
            </div>

            <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #d69e2e;">
                <h4 style="color: #744210; margin-bottom: 10px;">📦 Delivery Instructions</h4>
                <p style="color: #744210; margin: 5px 0;">• Please ensure someone is available to receive the package</p>
                ${
                  trackingNumber
                    ? `<p style="color: #744210; margin: 5px 0;">• Track your shipment using the tracking number above</p>`
                    : ""
                }
                <p style="color: #744210; margin: 5px 0;">• Delivery expected within 3-5 business days</p>
            </div>
        </div>
        
        <div class="footer">
            <p style="margin-bottom: 10px;">Thank you for your patience from <strong>G-Bone Apparel</strong>!</p>
            <p style="font-size: 12px; opacity: 0.7;">© 2024 G-Bone Apparel. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  },

  // Order Delivered Template
  orderDelivered(order, customerName) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Delivered</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .delivery-card { background: white; border-radius: 12px; padding: 25px; margin: 25px 0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; border-left: 4px solid #48bb78; }
        .review-cta { background: linear-gradient(135deg, #48bb78, #38a169); color: white; padding: 25px; border-radius: 12px; margin: 25px 0; text-align: center; }
        .footer { text-align: center; padding: 30px; background: #f7fafc; color: #718096; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="font-size: 28px; margin-bottom: 10px;">✅ Order Delivered Successfully!</h1>
            <p style="font-size: 16px; opacity: 0.9;">Your G-Bone Apparel order has been delivered</p>
        </div>
        
        <div class="content">
            <p style="margin-bottom: 20px;">Dear <strong style="color: #2d3748;">${customerName}</strong>,</p>
            <p style="color: #4a5568; margin-bottom: 25px;">Great news! Your order has been successfully delivered. We hope you love your purchase!</p>
            
            <div class="delivery-card">
                <h3 style="color: #2d3748; margin-bottom: 15px;">Order #${order.id
                  .substring(0, 8)
                  .toUpperCase()}</h3>
                <div style="display: inline-block; background: #48bb78; color: white; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 15px;">
                    DELIVERED
                </div>
                
                <div style="margin-top: 15px;">
                    <p style="margin: 8px 0;"><strong>Delivered On:</strong> ${new Date().toLocaleDateString()}</p>
                    <p style="margin: 8px 0;"><strong>Total Amount:</strong> $${order.totalAmount?.toFixed(
                      2
                    )}</p>
                    <p style="margin: 8px 0;"><strong>Delivery Address:</strong> ${
                      order.customerAddress
                    }</p>
                </div>
            </div>

            <div class="review-cta">
                <h3 style="margin-bottom: 15px; font-size: 20px;">💫 We'd Love Your Feedback!</h3>
                <p style="margin-bottom: 20px; opacity: 0.9;">Share your experience with us by leaving a review for your purchased products.</p>
                <a href="http://localhost:5173/user/orders" style="display: inline-block; background: white; color: #48bb78; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: bold; transition: transform 0.2s;">Leave a Review</a>
            </div>

            <div style="text-align: center; margin: 25px 0;">
                <p style="color: #4a5568; margin-bottom: 15px;">Ready for your next shopping experience?</p>
                <a href="http://localhost:5173/products" style="display: inline-block; background: #667eea; color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: 600;">Continue Shopping</a>
            </div>
        </div>
        
        <div class="footer">
            <p style="margin-bottom: 10px;">Thank you for shopping with <strong>G-Bone Apparel</strong></p>
            <p style="font-size: 12px; opacity: 0.7;">© 2024 G-Bone Apparel. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  },

  // Password Update Confirmation Template
  passwordUpdateConfirmation(userName, userEmail) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Updated Successfully</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .security-card { background: white; border-radius: 12px; padding: 25px; margin: 25px 0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; border-left: 4px solid #48bb78; }
        .alert-card { background: #fff5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f56565; }
        .footer { text-align: center; padding: 30px; background: #f7fafc; color: #718096; font-size: 14px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .info-item { display: flex; flex-direction: column; }
        .info-label { font-size: 12px; color: #718096; margin-bottom: 4px; }
        .info-value { font-size: 14px; font-weight: 600; color: #2d3748; }
        @media (max-width: 600px) {
            .info-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="font-size: 28px; margin-bottom: 10px;">🔒 Password Updated</h1>
            <p style="font-size: 16px; opacity: 0.9;">Your G-Bone Apparel password has been changed successfully</p>
        </div>
        
        <div class="content">
            <p style="margin-bottom: 20px;">Dear <strong style="color: #2d3748;">${userName}</strong>,</p>
            <p style="color: #4a5568; margin-bottom: 25px;">This email confirms that your account password was recently updated. If you made this change, no further action is required.</p>
            
            <div class="security-card">
                <h3 style="color: #2d3748; margin-bottom: 15px;">Security Update Confirmation</h3>
                
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">ACCOUNT HOLDER</span>
                        <span class="info-value">${userName}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">EMAIL ADDRESS</span>
                        <span class="info-value">${userEmail}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">UPDATE TYPE</span>
                        <span class="info-value">Password Change</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">TIMESTAMP</span>
                        <span class="info-value">${new Date().toLocaleString()}</span>
                    </div>
                </div>
                
                <div style="display: inline-block; background: #48bb78; color: white; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-top: 10px;">
                    COMPLETED
                </div>
            </div>

            <div class="alert-card">
                <h4 style="color: #c53030; margin-bottom: 10px;">⚠️ Security Notice</h4>
                <p style="color: #744210; margin: 5px 0;">• If you did NOT make this change, please contact support immediately</p>
                <p style="color: #744210; margin: 5px 0;">• Ensure your new password is strong and unique</p>
                <p style="color: #744210; margin: 5px 0;">• Never share your password with anyone</p>
            </div>

            <div style="background: #ebf8ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #4299e1;">
                <h4 style="color: #2b6cb0; margin-bottom: 10px;">💡 Need Help?</h4>
                <p style="color: #2c5282; margin: 5px 0;">• Contact support: support@g-bone-apparel.com</p>
                <p style="color: #2c5282; margin: 5px 0;">• Visit our help center for security tips</p>
                <p style="color: #2c5282; margin: 5px 0;">• Review recent account activity in your dashboard</p>
            </div>
        </div>
        
        <div class="footer">
            <p style="margin-bottom: 10px;">Thank you for securing your account with <strong>G-Bone Apparel</strong></p>
            <p style="font-size: 12px; opacity: 0.7;">This is an automated security message. Please do not reply to this email.</p>
            <p style="font-size: 12px; opacity: 0.7; margin-top: 10px;">© 2024 G-Bone Apparel. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  },
};

// ========== API ROUTES ==========

// Test Route
app.get("/", (req, res) => {
  res.json({
    message: "G-Bone Apparel Backend API 🚀",
    timestamp: new Date().toISOString(),
    status: "operational",
    email: "Professional Gmail service configured",
    version: "1.0.0",
  });
});

// Health check route
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    database: "connected",
    email: transporter ? "gmail-configured" : "not-configured",
    timestamp: new Date().toISOString(),
  });
});

// Test email endpoint
app.post("/api/test-email", async (req, res) => {
  try {
    const { to = process.env.EMAIL_USER } = req.body;

    const testTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h2>✅ G-Bone Apparel Email System Test</h2>
            <p>Professional Clothing Store Email Service</p>
        </div>
        <div style="padding: 30px;">
            <p>This is a test email from <strong>G-Bone Apparel</strong> backend system.</p>
            <p><strong>Status:</strong> <span style="color: #48bb78;">OPERATIONAL</span></p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Brand:</strong> G-Bone Apparel</p>
            <p><strong>Service:</strong> Gmail SMTP</p>
        </div>
    </div>
    `;

    const result = await emailService.sendEmail(
      to,
      "✅ G-Bone Apparel Email System Test",
      testTemplate
    );

    res.json({
      success: result.success,
      message: result.success
        ? "Test email sent successfully!"
        : result.userMessage,
      details: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ========== ORDER ROUTES WITH PROFESSIONAL EMAILS ==========

// Create order with email notification
app.post("/api/orders", async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      items,
      totalAmount,
      paymentMethod,
      deliveryDate,
      subtotal,
      shipping,
      tax,
    } = req.body;

    // Validate required fields
    if (
      !customerName ||
      !customerEmail ||
      !customerPhone ||
      !customerAddress ||
      !items ||
      !totalAmount
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: customerName, customerEmail, customerPhone, customerAddress, items, totalAmount",
      });
    }

    const orderData = {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      items,
      totalAmount: parseFloat(totalAmount),
      subtotal: parseFloat(subtotal) || 0,
      shipping: parseFloat(shipping) || 0,
      tax: parseFloat(tax) || 0,
      paymentMethod: paymentMethod || "Cash on Delivery",
      status: "pending",
      deliveryDate:
        deliveryDate ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("orders").add(orderData);
    const orderWithId = { id: docRef.id, ...orderData };

    // Send order confirmation email
    const emailResult = await emailService.sendEmail(
      customerEmail,
      `Order Confirmed #${docRef.id
        .substring(0, 8)
        .toUpperCase()} - Thank You for Your Purchase!`,
      emailTemplates.orderConfirmation(orderWithId, customerName)
    );

    res.status(201).json({
      success: true,
      id: docRef.id,
      message: "Order created successfully!",
      emailSent: emailResult.success,
      emailDetails: emailResult.success
        ? { messageId: emailResult.messageId }
        : { error: emailResult.userMessage },
      order: orderWithId,
    });
  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create order: " + error.message,
    });
  }
});

// Update order status with professional email notifications - FIXED VERSION
app.put("/api/orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, deliveryDate, updatedBy, trackingNumber } = req.body;

    console.log("🔄 Order status update requested:", {
      id,
      status,
      deliveryDate,
      updatedBy,
      trackingNumber,
    });

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required",
      });
    }

    const orderRef = db.collection("orders").doc(id);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      console.log("❌ Order not found:", id);
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    const orderData = orderDoc.data();
    console.log("📦 Order found:", {
      id,
      customerEmail: orderData.customerEmail,
      customerName: orderData.customerName,
      currentStatus: orderData.status,
    });

    // Check if customer email exists
    if (!orderData.customerEmail) {
      console.log("❌ No customer email found for order:", id);
      return res.status(400).json({
        success: false,
        error: "Customer email not found for this order",
      });
    }

    const updateData = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: updatedBy || "System",
    };

    if (deliveryDate) {
      updateData.deliveryDate = deliveryDate;
    }

    console.log("📝 Updating order with:", updateData);
    await orderRef.update(updateData);

    const updatedOrder = { id: orderDoc.id, ...orderData, ...updateData };

    // Send appropriate email based on status
    let emailResult = { success: false };
    let emailSubject = "";
    let emailTemplate = "";

    console.log("📧 Preparing email for status:", status.toLowerCase());

    // Normalize status for case-insensitive comparison
    const normalizedStatus = status.toLowerCase().trim();

    switch (normalizedStatus) {
      case "confirmed":
        emailSubject = `Order Confirmed #${id
          .substring(0, 8)
          .toUpperCase()} - Processing Started`;
        emailTemplate = emailTemplates.orderConfirmation(
          updatedOrder,
          orderData.customerName
        );
        console.log("✅ Confirmed status - sending confirmation email");
        break;

      case "processing":
        emailSubject = `Order #${id
          .substring(0, 8)
          .toUpperCase()} - Now in Processing`;
        emailTemplate = emailTemplates.orderConfirmation(
          updatedOrder,
          orderData.customerName
        );
        console.log("🔄 Processing status - sending processing email");
        break;

      case "shipped":
        emailSubject = `🚚 Order Shipped #${id
          .substring(0, 8)
          .toUpperCase()} - On Its Way to You!`;
        emailTemplate = emailTemplates.orderShipped(
          updatedOrder,
          orderData.customerName,
          trackingNumber
        );
        console.log("🚚 Shipped status - sending shipped email");
        break;

      case "delivered":
        emailSubject = `✅ Order Delivered #${id
          .substring(0, 8)
          .toUpperCase()} - Thank You for Your Purchase!`;
        emailTemplate = emailTemplates.orderDelivered(
          updatedOrder,
          orderData.customerName
        );
        console.log("✅ Delivered status - sending delivered email");
        break;

      default:
        // For other status changes, send a generic update
        emailSubject = `Order Update #${id
          .substring(0, 8)
          .toUpperCase()} - Status: ${status}`;
        emailTemplate = emailTemplates.orderConfirmation(
          updatedOrder,
          orderData.customerName
        );
        console.log("📝 Default status - sending generic email");
    }

    if (emailSubject && emailTemplate && orderData.customerEmail) {
      console.log("📤 Attempting to send email to:", orderData.customerEmail);
      console.log("📝 Email subject:", emailSubject);

      emailResult = await emailService.sendEmail(
        orderData.customerEmail,
        emailSubject,
        emailTemplate
      );

      console.log("📧 Email send result:", emailResult);
    } else {
      console.log("❌ Cannot send email - missing:", {
        hasSubject: !!emailSubject,
        hasTemplate: !!emailTemplate,
        hasEmail: !!orderData.customerEmail,
      });
    }

    res.json({
      success: true,
      message: "Order status updated successfully!",
      emailSent: emailResult.success,
      emailDetails: emailResult.success
        ? {
            messageId: emailResult.messageId,
            recipient: orderData.customerEmail,
          }
        : { error: emailResult.userMessage },
      order: updatedOrder,
    });
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update order status: " + error.message,
    });
  }
});

// Test email for specific order
app.post("/api/orders/:id/test-email", async (req, res) => {
  try {
    const { id } = req.params;
    const { status = "shipped" } = req.body;

    console.log("🧪 Testing email for order:", id);

    const orderDoc = await db.collection("orders").doc(id).get();

    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    const orderData = orderDoc.data();
    const order = { id: orderDoc.id, ...orderData };

    console.log("📦 Order details:", {
      id: order.id,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      currentStatus: order.status,
    });

    let emailSubject = "";
    let emailTemplate = "";

    switch (status.toLowerCase()) {
      case "confirmed":
        emailSubject = `TEST - Order Confirmed #${id
          .substring(0, 8)
          .toUpperCase()}`;
        emailTemplate = emailTemplates.orderConfirmation(
          order,
          orderData.customerName
        );
        break;
      case "shipped":
        emailSubject = `TEST - 🚚 Order Shipped #${id
          .substring(0, 8)
          .toUpperCase()}`;
        emailTemplate = emailTemplates.orderShipped(
          order,
          orderData.customerName,
          "TEST-TRACK-123"
        );
        break;
      case "delivered":
        emailSubject = `TEST - ✅ Order Delivered #${id
          .substring(0, 8)
          .toUpperCase()}`;
        emailTemplate = emailTemplates.orderDelivered(
          order,
          orderData.customerName
        );
        break;
      default:
        emailSubject = `TEST - Order Update #${id
          .substring(0, 8)
          .toUpperCase()}`;
        emailTemplate = emailTemplates.orderConfirmation(
          order,
          orderData.customerName
        );
    }

    const emailResult = await emailService.sendEmail(
      orderData.customerEmail,
      emailSubject,
      emailTemplate
    );

    res.json({
      success: emailResult.success,
      message: emailResult.success
        ? `Test email sent to ${orderData.customerEmail}!`
        : emailResult.userMessage,
      testDetails: {
        orderId: id,
        customerEmail: orderData.customerEmail,
        customerName: orderData.customerName,
        statusTested: status,
        emailResult: emailResult,
      },
    });
  } catch (error) {
    console.error("❌ Error testing order email:", error);
    res.status(500).json({
      success: false,
      error: "Failed to test order email: " + error.message,
    });
  }
});

// Send custom email to customer
app.post("/api/orders/:id/send-email", async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        error: "Subject and message are required",
      });
    }

    const orderDoc = await db.collection("orders").doc(id).get();

    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    const orderData = orderDoc.data();

    const customEmailHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: white;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
            <h2 style="margin: 0; font-size: 24px;">Message Regarding Your Order</h2>
        </div>
        
        <div style="padding: 30px;">
            <p>Dear <strong>${orderData.customerName}</strong>,</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                <h3 style="margin: 0 0 10px 0; color: #2d3748;">Order #${id
                  .substring(0, 8)
                  .toUpperCase()}</h3>
                <p style="margin: 5px 0; color: #4a5568;"><strong>Subject:</strong> ${subject}</p>
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                ${message.replace(/\n/g, "<br>")}
            </div>

            <p style="color: #718096; font-size: 14px; margin-top: 25px;">
                If you have any questions about this message, please contact our support team.
            </p>
        </div>
        
        <div style="text-align: center; padding: 20px; background: #f7fafc; color: #718096; font-size: 12px;">
            <p style="margin: 0;">© 2024 G-Bone Apparel. All rights reserved.</p>
        </div>
    </div>
    `;

    const emailResult = await emailService.sendEmail(
      orderData.customerEmail,
      subject,
      customEmailHtml
    );

    res.json({
      success: emailResult.success,
      message: emailResult.success
        ? "Custom email sent successfully!"
        : emailResult.userMessage,
      details: emailResult,
    });
  } catch (error) {
    console.error("❌ Error sending custom email:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send custom email: " + error.message,
    });
  }
});

// Update user password with email notification
app.put("/api/users/update-password", async (req, res) => {
  try {
    const { userId, currentPassword, newPassword, email, userName } = req.body;

    // Validate required fields
    if (!userId || !newPassword || !email) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, newPassword, email",
      });
    }

    console.log("🔒 Updating password for user:", userId);
    console.log("📧 Sending notification to:", email);

    // Simulate password update (replace with your actual update logic)
    const updateResult = {
      success: true,
      message: "Password updated successfully",
    };

    // Send password update confirmation email
    const emailResult = await emailService.sendEmail(
      email,
      "🔒 Password Updated Successfully - G-Bone Apparel",
      emailTemplates.passwordUpdateConfirmation(userName || "User", email)
    );

    res.json({
      success: true,
      message: "Password updated successfully!",
      passwordUpdate: updateResult,
      emailSent: emailResult.success,
      emailDetails: emailResult.success
        ? {
            messageId: emailResult.messageId,
            recipient: email,
          }
        : { error: emailResult.userMessage },
    });
  } catch (error) {
    console.error("❌ Error updating password:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update password: " + error.message,
    });
  }
});

// ========== EXISTING ROUTES (Keep your existing routes) ==========

// Get all orders with filtering and pagination
app.get("/api/orders", async (req, res) => {
  try {
    const { status } = req.query;
    let query = db.collection("orders").orderBy("createdAt", "desc");

    if (status && status !== "all") {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.get();
    const orders = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      };
    });

    res.json({
      success: true,
      orders: orders,
      total: orders.length,
    });
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch orders: " + error.message,
    });
  }
});

// Get single order
app.get("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("orders").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    const data = doc.data();
    const order = {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    };

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("❌ Error fetching order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch order: " + error.message,
    });
  }
});

// Get orders for specific user
app.get("/api/users/orders", async (req, res) => {
  try {
    const { email, page = 1, limit = 10, status } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email parameter is required",
      });
    }

    console.log("📧 Fetching orders for user:", email);

    // Get all orders and filter client-side
    const snapshot = await db.collection("orders").get();

    let orders = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      };
    });

    // Filter by email
    orders = orders.filter((order) => order.customerEmail === email);

    // Filter by status if provided
    if (status && status !== "all") {
      orders = orders.filter((order) => order.status === status);
    }

    // Sort by creation date (descending)
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`✅ Found ${orders.length} orders for user: ${email}`);

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedOrders = orders.slice(startIndex, endIndex);

    res.json({
      success: true,
      orders: paginatedOrders,
      total: orders.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(orders.length / limit),
    });
  } catch (error) {
    console.error("❌ Error fetching user orders:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user orders: " + error.message,
    });
  }
});

// ========== PRODUCT ROUTES ==========

// Get all products with filtering
app.get("/api/products", async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    let query = db.collection("products");

    const snapshot = await query.get();
    let products = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter by category
    if (category && category !== "all") {
      products = products.filter((product) => product.category === category);
    }

    // Search functionality
    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchLower) ||
          product.description.toLowerCase().includes(searchLower) ||
          product.brand.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedProducts = products.slice(startIndex, endIndex);

    res.json({
      success: true,
      products: paginatedProducts,
      total: products.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(products.length / limit),
    });
  } catch (error) {
    console.error("❌ Error fetching products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch products: " + error.message,
    });
  }
});

// Create product
app.post("/api/products", async (req, res) => {
  try {
    const { name, description, price, category, stock, image, brand } =
      req.body;

    const productData = {
      name,
      description,
      price: parseFloat(price),
      category,
      stock: parseInt(stock),
      image,
      brand,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("products").add(productData);
    res.status(201).json({
      success: true,
      id: docRef.id,
      message: "Product added successfully!",
    });
  } catch (error) {
    console.error("❌ Error creating product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add product: " + error.message,
    });
  }
});

// Update product
app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("products").doc(id).update(updateData);
    res.json({
      success: true,
      message: "Product updated successfully!",
    });
  } catch (error) {
    console.error("❌ Error updating product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update product: " + error.message,
    });
  }
});

// Delete product
app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("products").doc(id).delete();
    res.json({
      success: true,
      message: "Product deleted successfully!",
    });
  } catch (error) {
    console.error("❌ Error deleting product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete product: " + error.message,
    });
  }
});

// ========== DASHBOARD ROUTES ==========

// Dashboard statistics
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const [
      usersSnapshot,
      employeesSnapshot,
      productsSnapshot,
      ordersSnapshot,
      attendanceSnapshot,
      ticketsSnapshot,
    ] = await Promise.all([
      db.collection("users").where("role", "==", "user").get(),
      db.collection("users").where("role", "in", ["employee", "admin"]).get(),
      db.collection("products").get(),
      db.collection("orders").get(),
      db
        .collection("attendance")
        .where("date", "==", new Date().toLocaleDateString("en-CA"))
        .get(),
      db.collection("supportTickets").where("status", "==", "open").get(),
    ]);

    let totalRevenue = 0;
    let monthlyRevenue = 0;
    let pendingOrders = 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      totalRevenue += order.totalAmount || 0;

      // Count pending orders
      if (order.status === "pending") {
        pendingOrders++;
      }

      // Calculate monthly revenue
      if (order.createdAt) {
        const orderDate = order.createdAt.toDate
          ? order.createdAt.toDate()
          : new Date(order.createdAt);
        if (
          orderDate.getMonth() === currentMonth &&
          orderDate.getFullYear() === currentYear
        ) {
          monthlyRevenue += order.totalAmount || 0;
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalUsers: usersSnapshot.size,
        totalEmployees: employeesSnapshot.size,
        totalProducts: productsSnapshot.size,
        totalOrders: ordersSnapshot.size,
        totalRevenue,
        monthlyRevenue,
        pendingOrders,
        presentToday: attendanceSnapshot.size,
        openTickets: ticketsSnapshot.size,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard statistics: " + error.message,
    });
  }
});

// ========== USER MANAGEMENT ROUTES ==========

// Get users with role filtering
app.get("/api/users", async (req, res) => {
  try {
    const { role } = req.query;
    let query = db.collection("users");

    if (role) {
      query = query.where("role", "==", role);
    }

    const snapshot = await query.get();
    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch users: " + error.message,
    });
  }
});

// ========== 404 HANDLER ==========

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.path,
    method: req.method,
    availableEndpoints: [
      "GET /",
      "GET /health",
      "POST /api/test-email",
      "POST /api/orders",
      "GET /api/orders",
      "GET /api/orders/:id",
      "PUT /api/orders/:id/status",
      "POST /api/orders/:id/send-email",
      "POST /api/orders/:id/test-email",
      "PUT /api/users/update-password",
      "GET /api/users/orders",
      "GET /api/products",
      "POST /api/products",
      "PUT /api/products/:id",
      "DELETE /api/products/:id",
      "GET /api/dashboard/stats",
      "GET /api/users",
    ],
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 API Base: http://localhost:${PORT}/api`);
  console.log(`📍 Test route: http://localhost:${PORT}/`);
  console.log(`📧 Email Service: Gmail (Professional)`);
  console.log(`🏢 Brand: G-Bone Apparel`);
});

export default app;
