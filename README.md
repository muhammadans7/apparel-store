# G-Bone Apparel Backend

## Deployment Instructions

### Environment Variables Required:

```
EMAIL_USER=your_email
EMAIL_PASS=your_app_password
PORT=5000
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NODE_ENV=production
```

### Deploy to Render:

1. Create Web Service
2. Set Root Directory: `project1/project1/backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Add all environment variables
6. Deploy!

### Firebase Setup:

- Upload `serviceAccountKey.json` directly to Render (Manual Upload)
- Or use environment variable for credentials

### Webhook URL:

Update Stripe webhook to point to: `https://your-render-url.onrender.com/api/payment/webhook`
