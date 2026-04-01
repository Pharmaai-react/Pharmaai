# 💊 PharmaAI — Smart Pharmacy Inventory System

A modern, AI-powered pharmacy management application built with React + Vite.

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 🏠 Dashboard | Live KPIs, stock charts, expiry countdowns |
| 📦 Inventory | Full CRUD, barcode scan, expiry sorting, FEFO batch picker |
| 💊 Drug Interactions | 20+ pair database, severity-based results |
| 🤖 AI Predictions | Demand forecasting charts per medication |
| 💰 Sell (POS) | Cart, barcode scan, payment, receipt modal |
| 🚚 Suppliers | Supplier directory + reorder modal |
| 📊 Reports | Download live CSV/JSON reports from real inventory |
| 🔔 Notifications | Real-time alerts (low stock, expiry, sales, interactions) |
| ⚙️ Settings | Dark/light mode, profile, notification prefs |

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## 🔑 Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Administrator | `admin` | `admin123` |
| Pharmacist | `doctor` | `pharma2024` |
| Staff | `staff` | `staff123` |

> You can also **create a new account** from the login page.

---

## 🌐 Deployment

### Vercel (recommended — one command)

```bash
npx vercel --prod
```

A `vercel.json` is already configured with:
- SPA routing (catch-all rewrite to `index.html`)
- Security headers (X-Frame-Options, CSP, XSS protection)
- Immutable cache for hashed assets

### Netlify

```bash
npx netlify deploy --prod --dir=dist
```

A `netlify.toml` is already configured with the same settings.

### Manual (any static host — AWS S3, GH Pages, Cloudflare Pages)

```bash
npm run build          # outputs to ./dist
```

Upload the contents of `./dist` to your host. Make sure to:
- Configure a **SPA fallback** to serve `index.html` for all routes
- Set `Cache-Control: no-cache` for `index.html`
- Set `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`

---

## 🔒 Security Notes

- Passwords are hashed with **SHA-256 (Web Crypto API)** before being stored in `localStorage`
- This is a **frontend-only** app — suitable for single-device / demo use
- For a production multi-user deployment, add a backend server + database  
  (recommended: Supabase, Firebase, or a custom Node/Express API)

---

## 🛠️ Tech Stack

- **React 19** + **Vite 8**
- **Chart.js** for analytics charts
- **ZXing** (CDN) for barcode/QR scanning
- **Web Crypto API** for password hashing
- **BroadcastChannel API** for multi-tab pharmacy network alerts
- Vanilla CSS with CSS custom properties (full dark mode support)

---

## 📁 Project Structure

```
src/
├── components/         # All page components
│   ├── Dashboard.jsx
│   ├── InventoryPage.jsx
│   ├── SellPage.jsx
│   ├── ReportsPage.jsx
│   ├── SettingsPage.jsx
│   ├── NotificationsPage.jsx
│   └── ...
├── inventoryStore.js   # localStorage inventory CRUD
├── userStore.js        # Auth (SHA-256 hashed passwords)
├── useAppNotifications.js  # Real-time notification hook
├── pharmacyNetwork.js  # Cross-tab expiry alerting
└── index.css           # Design system + dark mode
```

---

## 📄 License

MIT — free to use, modify, and deploy.
