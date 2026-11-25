# Bulk Messenger: Contact Import System & Backend Architecture

This repository contains the interactive prototype and production backend implementation for **Bulk Messenger** ("Send Smart • Reach More"), built to match the app's signature purple gradient Material 3 Android UI and complete sending pipeline.

---

## 🌟 Key Features Implemented

### 1. Import Contacts from Excel
* **Mobile File Picker**: Drag-free tap zone optimized for mobile touch targets (.xlsx, .xls, .csv).
* **Sample Excel Template**: Real client-side generated sample download with standardized columns (`Name`, `Mobile Number`, `Email ID`, `Group / Tag`).
* **Selected File Preview**: File metadata card with file name (`Diwali_Customer_Leads_2024.xlsx`), file size, sheet selector, and total records.
* **Column Mapping Interface**:
  - Name column selector (auto-matched to `Full Name`)
  - Mobile Number column selector (auto-matched to `Mobile Number`)
  - Email (optional) column selector (auto-matched to `Email ID`)
* **Real-time Record Analysis & Badging**:
  - Total records detected: `1,248`
  - Valid contacts count: `1,180` (Green checkmark badge)
  - Duplicate contacts count: `45` (Amber alert badge)
  - Invalid phone numbers count: `23` (Red warning badge, e.g., missing digits, non-numeric strings)
* **Duplicate Handling Selector**:
  - 🟢 **Skip duplicates** (Recommended - only import unique new contacts)
  - 🟡 **Update existing contacts** (Merge details and update names/emails)
  - 🔵 **Import all** (Keep all rows even if duplicate numbers exist)
* **Data Preview Table**: Tabbed preview with filter pills (`All`, `Valid`, `Duplicates`, `Errors`).
* **Animated Progress UI**: Real-time circular progress indicator, records/sec metric, and sequential status checkmarks.
* **Import Success Screen**: Celebration banner with breakdown metrics and dual action buttons.
* **Error Report UI**: Row-by-row validation error list (e.g., Row 4: 6-digit incomplete number) with CSV export.

---

### 2. Import Mobile Saved Contacts
* **Privacy-First Permission Screen**: Native Material 3 permission screen requesting contacts access with clear privacy assurances and local storage commitment. Permission is only requested when the user explicitly triggers phone import.
* **Search Phone Contacts**: Real-time client-side search by name or phone number across 842 contacts.
* **Multi-Select Checkboxes**: Touch-friendly custom checkboxes for bulk selection.
* **Select All / Deselect All**: Instant bulk toggle for all visible filtered contacts.
* **Selection Counter**: Dynamic pill badge reflecting currently selected count.
* **Preview Selected Contacts**: Bottom sheet drawer showing selected contacts with instant individual removal.
* **Duplicate Detection UI**: Detects contacts already present in the app and highlights them with an amber `Already in App` pill.
* **Floating Import Bar**: Pinned bottom action bar showing selected count and one-tap import.

---

### 3. Contact Management Screen (Updated)
* **Top Import Action Bar**: Gradient cards for instant access to **Import Excel** (.xlsx/.xls) and **Phone Contacts** (from device).
* **Contact Groups & Categories**:
  - `All (1,250)`
  - `📊 Excel Imports (350)` *(New)*
  - `📱 Phone Imports (120)` *(New)*
  - `Friends (320)`
  - `Customers (480)`
* **Multi-Contact Action Bar**: Dynamic floating purple gradient bar appears when contacts are selected with a 1-tap **Create Campaign** CTA.

---

### 4. Campaign Recipient Selection (In Create Campaign)
* **Multi-Source Selection Cards**:
  - 📊 **Excel Imported Contacts** (1,180 contacts)
  - 📱 **Mobile Saved Contacts** (42 contacts)
  - 👥 **Contact Groups** (Customers, Friends)
  - 👤 **Individual Contacts**
* **Dynamic Deduplication Engine**: Automatically calculates overlapping recipients across chosen sources and resolves unique phone numbers.
* **Recipient Breakdown & Preview Modal**: Inspects the final deduplicated recipient list before launching the campaign.

---

## 🛠️ Production Backend Architecture

The backend is built with **Node.js, Express, MongoDB (Mongoose), Multer, XLSX, Twilio, and Node-Cron**.

### Backend Directory Layout
```
├── src/
│   ├── server.js     # Express application setup, security (Helmet/CORS), MongoDB connection
│   ├── models.js     # Mongoose Schemas (Contact, Campaign, MessageLog, Template, Settings)
│   ├── routes.js     # API endpoints, Excel import parser, dashboard, campaign lifecycle
│   ├── runner.js     # Campaign execution engine, rate limiter, batch processing, scheduler
│   ├── provider.js   # Messaging abstraction (Twilio SMS/WhatsApp & Mock provider)
│   └── utils.js      # E.164 phone normalizer, template variable interpolator ({name}, {phone})
├── uploads/          # Campaign media attachments & uploads
├── package.json      # Dependencies and scripts (node src/server.js)
├── .env.example      # Configuration template
└── .env              # Environment secrets and credentials
```

### API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check endpoint |
| `GET` | `/api/dashboard` | Contact & campaign counts, delivery rate %, today's sent count |
| `GET` | `/api/contacts` | Paginated contacts list with `search` & `group` filter |
| `GET` | `/api/contacts/groups` | Contact count aggregated by groups |
| `POST` | `/api/contacts` | Add a single contact manually (`{ name, phone, group }`) |
| `POST` | `/api/contacts/import` | Multipart Excel (`.xlsx`, `.xls`, `.csv`) import with auto-deduplication |
| `GET` | `/api/contacts/import/template` | Download standardized sample Excel file |
| `GET` | `/api/templates` | Browse saved templates with category filter |
| `POST` | `/api/templates` | Create a new reusable message template |
| `POST` | `/api/campaigns` | Create campaign with targeting (`allContacts`, `groups`, `contactIds`, attachment) |
| `GET` | `/api/campaigns/:id` | Review screen with recipient count and rendered preview |
| `POST` | `/api/campaigns/:id/start` | Launch campaign immediately (`now`) or schedule (`later`) |
| `POST` | `/api/campaigns/:id/pause` | Pause active campaign |
| `POST` | `/api/campaigns/:id/resume` | Resume paused campaign |
| `POST` | `/api/campaigns/:id/stop` | Terminate campaign |
| `GET` | `/api/campaigns/:id/progress` | Live sending progress %, sent, pending, failed counts, estimated ETA |
| `POST` | `/api/campaigns/:id/retry-failed`| Re-queue failed numbers for re-dispatch |
| `GET` | `/api/settings` | Retrieve app settings (theme, default message, notifications) |
| `PUT` | `/api/settings` | Update settings |
| `POST` | `/webhooks/twilio/status` | Twilio delivery report callback webhook |

---

## 🚀 Running the App

### 1. Frontend Preview
The interactive frontend prototype runs locally on:
```bash
http://localhost:3000
```
Or open [index.html](file:///d:/Nithra%20App%20works/index.html) directly in any web browser.

### 2. Run via Android Studio / Physical Device
The complete native Android Studio Gradle project is ready in the [`android/`](file:///d:/Nithra%20App%20works/android) directory:
1. Open **Android Studio** $\rightarrow$ **Open** $\rightarrow$ select `d:\Nithra App works\android`.
2. Connect your Android device or start an Android Virtual Device (AVD).
3. Click the green **Run ▶** button (or `Shift + F10`) to build and run `com.nithra.bulkmessenger`.

You can also build and install from the command line:
```powershell
cd android
.\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n com.nithra.bulkmessenger/.MainActivity
```

### 3. Backend Server
1. Ensure MongoDB is running locally (`mongodb://127.0.0.1:27017/bulk_messenger`) or set `MONGO_URI` in `.env`.
2. Start the server:
```bash
# In the project root or /backend:
npm install
npm start
```
The API server will listen on `http://localhost:5000` (or `PORT` specified in `.env`).
