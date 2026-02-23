# Meta App & Tech Provider Setup Guide

Step-by-step instructions for setting up the Meta App, WhatsApp Business API integration, and becoming a Tech Provider.

---

## Part 1: Create a Meta Business Account

1. Go to [business.facebook.com](https://business.facebook.com).
2. Click **Create Account**.
3. Enter your business name, your name, and business email.
4. Fill in your business details (address, website, etc.).
5. Verify your email address.

---

## Part 2: Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com).
2. Click **My Apps** in the top-right corner.
3. Click **Create App**.
4. Select **Other** as the use case, then click **Next**.
5. Select **Business** as the app type, then click **Next**.
6. Enter an app name (e.g., "ThunderChat").
7. Enter your contact email.
8. Select your Meta Business Account from the dropdown.
9. Click **Create App**.

---

## Part 3: Add WhatsApp to Your App

1. In the App Dashboard, scroll down to **Add Products to Your App**.
2. Find **WhatsApp** and click **Set Up**.
3. Select your Meta Business Account when prompted.
4. You'll be taken to the **WhatsApp > Getting Started** panel.

At this point, Meta has automatically:
- Created a **WhatsApp Business Account (WABA)** for you.
- Assigned a **test phone number** you can use for development.
- Generated a **temporary access token** (valid ~24 hours).

---

## Part 4: Get Your Credentials

### Temporary Access Token (for testing)
1. In the App Dashboard, go to **WhatsApp > API Setup**.
2. Copy the **Temporary access token** shown.
3. Note the **Phone number ID** displayed below the token.

### Permanent Access Token (for production)
1. Go to [business.facebook.com](https://business.facebook.com).
2. Navigate to **Settings > System Users**.
3. Click **Add** to create a new System User.
4. Set the role to **Admin**.
5. Click **Add Assets** > **Apps** > select your ThunderChat app > toggle **Full Control**.
6. Click **Generate New Token**.
7. Select your app from the dropdown.
8. Check these permissions:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
9. Click **Generate Token**.
10. **Copy and save this token securely** — it won't be shown again.

### App Secret
1. In the App Dashboard, go to **Settings > Basic**.
2. Click **Show** next to the App Secret field.
3. Copy the App Secret.

---

## Part 5: Register a Phone Number

### Using the Test Number (easiest for development)
The test number provided by Meta works immediately. You can send messages to up to 5 verified recipient numbers.

### Adding Your Own Number
1. In the App Dashboard, go to **WhatsApp > API Setup**.
2. Click **Add phone number**.
3. Enter your business phone number details.
4. Choose verification method: **SMS** or **Voice call**.
5. Enter the OTP code you receive.
6. Your number is now registered.

**Note:** The phone number cannot already be registered with WhatsApp or WhatsApp Business App. You must delete WhatsApp from that number first.

---

## Part 6: Set Up Webhooks

1. In the App Dashboard, go to **WhatsApp > Configuration**.
2. Under **Webhook**, click **Edit**.
3. Enter:
   - **Callback URL:** `https://your-render-app.onrender.com/webhook`
   - **Verify token:** The value you set in `WEBHOOK_VERIFY_TOKEN` env var
4. Click **Verify and Save**.
5. Under **Webhook fields**, click **Manage** and subscribe to:
   - `messages` (required — for incoming messages and status updates)

**Important:** Your server must be running and accessible at the callback URL before you can verify the webhook.

---

## Part 7: Configure ThunderChat Environment Variables

Set these environment variables in your Render.com dashboard:

```
AUTH_USERNAME=your-chosen-username
AUTH_PASSWORD=your-chosen-password
JWT_SECRET=generate-a-random-string

WHATSAPP_ACCESS_TOKEN=your-system-user-access-token
PHONE_NUMBER_ID=your-phone-number-id
WEBHOOK_VERIFY_TOKEN=your-chosen-verify-token
APP_SECRET=your-meta-app-secret

META_API_VERSION=v21.0
PORT=3000
```

---

## Part 8: Set the App to Live Mode

1. In the App Dashboard, go to **Settings > Basic**.
2. Fill in all required fields:
   - **Privacy Policy URL** (required)
   - **Terms of Service URL** (optional but recommended)
   - **App Icon** (optional)
3. Toggle the **App Mode** switch from **In Development** to **Live**.

**Note:** While in Development mode, only users with a role on the app (admin, developer, tester) can interact with it. Live mode is required for webhooks to work with real users.

---

## Part 9: Business Verification (Recommended)

Business verification lifts messaging limits and is required for Tech Provider status.

1. Go to [business.facebook.com](https://business.facebook.com).
2. Navigate to **Settings > Security Center**.
3. Click **Start Verification**.
4. You'll need to provide:
   - Legal business name
   - Business address
   - Business phone number
   - Business website
   - Official documentation (business license, utility bill, etc.)
5. Verification typically takes 1-3 business days.

### Messaging Limits by Verification Status
| Status | Limit |
|--------|-------|
| Unverified | 250 business-initiated conversations/day |
| Verified (Tier 1) | 1,000 conversations/day |
| Verified (Tier 2) | 10,000 conversations/day |
| Verified (Tier 3) | 100,000 conversations/day |
| Verified (Tier 4) | Unlimited |

Tiers increase automatically based on message quality and volume.

---

## Part 10: Becoming a Tech Provider

A Tech Provider builds WhatsApp solutions for other businesses. Clients manage their own billing with Meta directly.

### Prerequisites
- A verified Meta Business Account
- A Meta App with WhatsApp integration
- Completed App Review

### Step 1: Complete App Review

1. In the App Dashboard, go to **App Review > Permissions and Features**.
2. Request these permissions:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
3. For each permission, provide:
   - A detailed description of how you'll use it
   - A screencast demonstrating the functionality
   - Step-by-step instructions for the reviewer
4. Submit for review. This typically takes 3-5 business days.

### Step 2: Set Up Facebook Login for Business

This enables Embedded Signup — allowing your clients to connect their WhatsApp Business Account through your app.

1. In the App Dashboard, go to **Add Products** > **Facebook Login for Business** > **Set Up**.
2. Configure the **Valid OAuth Redirect URIs** with your app's callback URL.
3. Set the **Deauthorize Callback URL** and **Data Deletion Request URL**.

### Step 3: Implement Embedded Signup

Embedded Signup lets your clients:
1. Create or select a Meta Business Account
2. Create or select a WhatsApp Business Account
3. Register a phone number

All within your app's interface using Meta's pre-built UI flow.

Documentation: [developers.facebook.com/docs/whatsapp/embedded-signup](https://developers.facebook.com/docs/whatsapp/embedded-signup)

### Step 4: Upgrading to Tech Partner

Once you meet these criteria, you're eligible for Tech Partner status (Meta Partner badge):

| Requirement | Threshold |
|-------------|-----------|
| Average daily conversations (last 7 days) | ≥ 2,500 |
| Active customers | ≥ 10 |
| Quality metric | ≥ 90% |

Tech Partner benefits include:
- Meta Business Partner badge
- Access to Partner Portal
- Dedicated partner support
- Incentive programs

---

## Troubleshooting

### "Webhook verification failed"
- Ensure your server is running and the callback URL is accessible.
- Check that `WEBHOOK_VERIFY_TOKEN` matches what you entered in the App Dashboard.
- Verify the URL uses HTTPS.

### "Message failed to send" (Error 131030)
- The recipient hasn't messaged your number first (24-hour window).
- You need to use a template message to initiate conversations.

### "Number not registered" (Error 470)
- The recipient phone number doesn't have WhatsApp.
- Use the full international format without `+` (e.g., `1234567890`).

### "Invalid access token"
- Temporary tokens expire after ~24 hours. Use a System User token for production.
- Ensure the token has `whatsapp_business_messaging` permission.
