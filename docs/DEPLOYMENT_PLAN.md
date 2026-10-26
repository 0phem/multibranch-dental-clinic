# Deployment Plan: Multi-Branch Dental Clinic System

> **Target Deadline:** Host and verify the system on **Vercel + Railway + Supabase** before **Thursday 2026-10-22 morning**.  
> **Defense Date:** Saturday 2026-10-24 (hosted production demo).  
> **Baseline Commit:** Stable committed state on branch `feat/auth-messaging-paymongo`.

---

## 1. System Architecture

```
                       ┌─────────────────────────┐
                       │      Browser / Client    │
                       └────────────┬────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               │ (HTTPS REST / Cookies)                  │ (WSS)
               ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │    Vercel (Frontend)  │                 │    Railway (Reverb)   │
   │  React 19 + Vite 7    │                 │  Port 8080 (WSS)      │
   └───────────┬───────────┘                 └───────────────────────┘
               │ (Proxy / Direct API)                    ▲
               ▼                                         │ (Redis / Event)
   ┌───────────────────────┐                             │
   │   Railway (API)       │─────────────────────────────┘
   │  Laravel 13 (PHP 8.3) │
   └───────────┬───────────┘
               │
      ┌────────┴───────────────┬───────────────────────┐
      ▼                        ▼                       ▼
┌───────────────────┐    ┌───────────────────┐   ┌───────────────────┐
│ Railway (Worker)  │    │Railway (Scheduler)│   │Supabase (Postgres)│
│ Queue Work        │    │Schedule Work      │   │Session Pooler:5432│
└───────────────────┘    └───────────────────┘   └───────────────────┘
```

The system is deployed across 3 tier providers:
1. **Frontend**: **Vercel** hosting the React 19 + Vite 7 Single Page Application.
2. **Backend**: **Railway** (Singapore region) running 4 dedicated services from the same repository branch (`feat/auth-messaging-paymongo`):
   - `api`: Laravel 13 web server handling HTTP requests and PayMongo webhooks.
   - `worker`: Background queue worker (`php artisan queue:work --queue=mail,default`).
   - `scheduler`: Background task scheduler (`php artisan schedule:work`).
   - `reverb`: WebSocket server (`php artisan reverb:start`) providing real-time messaging.
3. **Database & Storage**: **Supabase** (Singapore region):
   - PostgreSQL 16 database for `dental_clinic_demo` (never touch real clinic data).
   - Session Pooler (port 5432, IPv4) for prepared statements compatibility.
   - Supabase S3-compatible Storage for document and invoice attachments.

---

## 2. Accounts the User Must Create or Approve

Please review and create/sign in to the following accounts before deploying:

| Provider | Purpose | Plan / Expected Cost | Action Needed by User |
| --- | --- | --- | --- |
| **GitHub** | Code repository source for Vercel & Railway | Free | Authorize Vercel and Railway apps to access repository. |
| **Supabase** | Managed PostgreSQL database & file storage (Singapore) | Free Tier ($0/mo for this week; project remains active) | Create a new project named `dental-clinic-demo` in Singapore (`ap-southeast-1`). Save the DB password. |
| **Railway** | Runs Laravel Web API, Queue Worker, Scheduler, and Reverb | Trial ($5 free credit) or Hobby plan ($5/mo) | Create Railway account, link GitHub repository. |
| **Vercel** | Static hosting & CDN for the React/Vite frontend | Hobby Plan (Free) | Link GitHub repository and deploy frontend root. |
| **PayMongo** | Payment gateway (Test Mode for GCash / Cards) | Free (Test Mode) | Retrieve test public key, secret key, and webhook signing secret. |
| **Custom Domain** *(Optional)* | Seamless cookie auth (`app.<domain>` + `api.<domain>`) | ~$5–$10/year (Namecheap/Porkbun) or use Vercel proxy rewrite (free) | If purchased, configure DNS CNAME/A records. If not purchased, use Option B (Vercel rewrite). |
| **Transactional Email** *(Optional / Fallback)* | SMTP/HTTP mailer if Railway blocks outbound port 587 | Free tier (Resend / Brevo: 100–300 free emails/day) | Create free Resend/Brevo account if Gmail SMTP port 587 is blocked on Railway. |

> [!CAUTION]
> **Privacy & Secrets Rule:** Never post API keys, database passwords, or secrets into chat or git. You will enter them directly into the respective provider web dashboards.

---

## 3. Database Configuration (Supabase)

1. **Create Project**:
   - Provider: [Supabase](https://supabase.com).
   - Organization: Your personal account.
   - Project Name: `dental-clinic-demo`.
   - Database Password: Create a strong password (keep this safe).
   - Region: **Singapore (`ap-southeast-1`)** for minimal latency to the Philippines.
2. **Connection Parameters**:
   - Go to **Project Settings → Database → Connection string**.
   - Use **Session Pooler (IPv4, Port 5432)**, NOT Transaction Pooler (Port 6543), because Laravel Eloquent uses PDO prepared statements.
   - Parameters to copy into Railway env vars:
     - `DB_CONNECTION=pgsql`
     - `DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com` (example host)
     - `DB_PORT=5432`
     - `DB_DATABASE=postgres`
     - `DB_USERNAME=postgres.<project-ref>`
     - `DB_PASSWORD=<your-supabase-db-password>`
3. **Storage Bucket**:
   - Create a private bucket named `documents` for patient uploaded files and generated PDFs.

---

## 4. Backend Services on Railway

Create a new Railway project from your GitHub repository `multibranch-dental-clinic` on branch `feat/auth-messaging-paymongo`.

Configure **4 Services** in Railway using `backend` as the Root Directory:

### Service 1: `api` (Web Server)
- **Root Directory**: `backend`
- **Build Command**: `composer install --no-dev --optimize-autoloader`
- **Start Command**: `php artisan serve --host=0.0.0.0 --port=$PORT` (or Nginx/PHP-FPM Nixpack build)
- **Pre-deploy / Release Command**:
  ```bash
  php artisan migrate --force && php artisan db:seed --force && php artisan db:seed --class=DemoClinicSeeder --force
  ```
- **Public Domain**: Enable Railway public domain (e.g. `dental-api-production.up.railway.app`).

### Service 2: `worker` (Queue Worker)
- **Root Directory**: `backend`
- **Start Command**: `php artisan queue:work --queue=mail,default --sleep=3 --tries=4 --timeout=600`
- **Public Domain**: None (Internal service only).

### Service 3: `scheduler` (Cron Task Runner)
- **Root Directory**: `backend`
- **Start Command**: `php artisan schedule:work`
- **Public Domain**: None (Internal service only).

### Service 4: `reverb` (WebSocket Server)
- **Root Directory**: `backend`
- **Start Command**: `php artisan reverb:start --host=0.0.0.0 --port=8080`
- **Public Domain**: Enable Railway public domain with Port 8080 (e.g. `dental-reverb-production.up.railway.app`).

### Shared Environment Variables (Apply to all 4 Railway services):
```env
APP_NAME="Dr. Dana E. Roxas Dental Clinic API"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://<api-domain>.up.railway.app
APP_KEY=<generated-base64-key-identical-across-all-4-services>

DB_CONNECTION=pgsql
DB_HOST=<supabase-pooler-host>
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres.<project-ref>
DB_PASSWORD=<supabase-password>

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_DOMAIN=<configured-domain-or-null>
SESSION_SECURE_COOKIE=true

QUEUE_CONNECTION=database
CACHE_STORE=database

BROADCAST_CONNECTION=reverb
REVERB_APP_ID=dental-reverb-app
REVERB_APP_KEY=<random-generated-alphanumeric>
REVERB_APP_SECRET=<random-generated-alphanumeric>
REVERB_HOST=<reverb-domain>.up.railway.app
REVERB_PORT=443
REVERB_SCHEME=https
REVERB_SERVER_HOST=0.0.0.0
REVERB_SERVER_PORT=8080

FRONTEND_URL=https://<frontend-domain>.vercel.app
SANCTUM_STATEFUL_DOMAINS=<frontend-domain>.vercel.app

MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SCHEME=smtp
MAIL_USERNAME=<gmail-address>
MAIL_PASSWORD=<google-app-password>
MAIL_FROM_ADDRESS=<gmail-address>
MAIL_FROM_NAME="Dr. Dana E. Roxas Dental Clinic"

PAYMONGO_PUBLIC_KEY=pk_test_...
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_WEBHOOK_SECRET=whsk_...
PAYMONGO_MODE=test
```

---

## 5. Cookie Auth & CORS Strategies

Sanctum uses first-party HTTP-only session cookies. Browsers block cross-domain cookies between unrelated origins (e.g. `vercel.app` and `railway.app`). Choose one of two proven solutions:

### Option A: Custom Domain (Recommended for cleanliness)
- Purchase or attach a domain (e.g. `roxasdental.com`).
- DNS settings:
  - `app.roxasdental.com` → Vercel CNAME `cname.vercel-dns.com`
  - `api.roxasdental.com` → Railway CNAME for `api`
  - `ws.roxasdental.com` → Railway CNAME for `reverb`
- Settings:
  - `SESSION_DOMAIN=.roxasdental.com`
  - `SANCTUM_STATEFUL_DOMAINS=app.roxasdental.com`
  - `FRONTEND_URL=https://app.roxasdental.com`

### Option B: Free Vercel Reverse Proxy (No custom domain required)
- Frontend and Backend communicate under the **same origin** (`<app>.vercel.app`).
- Add a root `vercel.json` rewrite:
  ```json
  {
    "rewrites": [
      {
        "source": "/api/:path*",
        "destination": "https://<api-domain>.up.railway.app/api/:path*"
      },
      {
        "source": "/sanctum/:path*",
        "destination": "https://<api-domain>.up.railway.app/sanctum/:path*"
      },
      {
        "source": "/broadcasting/:path*",
        "destination": "https://<api-domain>.up.railway.app/broadcasting/:path*"
      }
    ]
  }
  ```
- All cookies become first-party same-origin cookies without CORS issues.
- Reverb WSS connects directly to `wss://<reverb-domain>.up.railway.app`.

---

## 6. Frontend Configuration (Vercel)

1. **Import Project**:
   - Root directory: `./`
   - Framework preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
2. **Environment Variables on Vercel**:
   - `VITE_API_URL`: `/api` (if using Option B rewrite) or `https://api.<domain>` (Option A)
   - `VITE_REVERB_APP_KEY`: Same key as backend `REVERB_APP_KEY`
   - `VITE_REVERB_HOST`: `<reverb-domain>.up.railway.app` or `ws.<domain>`
   - `VITE_REVERB_PORT`: `443`
   - `VITE_REVERB_SCHEME`: `https`

---

## 7. PayMongo Webhook Configuration

1. In the PayMongo Dashboard (Test Mode):
2. Navigate to **Developers → Webhooks**.
3. Add a webhook URL pointing to:  
   `https://<api-domain>/api/webhooks/paymongo`
4. Select the event:
   - `checkout_session.payment.paid`
5. Copy the generated **Webhook Signing Secret** (`whsk_...`) into Railway's `PAYMONGO_WEBHOOK_SECRET` variable.

---

## 8. Verification Checklist (Before Thursday 2026-10-22)

All checks must pass on the hosted URL:
- [ ] 1. **Public Site**: Landing page loads on mobile and desktop over HTTPS; all 3 real branches, addresses, and hours appear correctly.
- [ ] 2. **Authentication**: Patient sign-up sends email OTP to a real inbox; verification works; redirect to sign-in with prefilled email; page reload retains session.
- [ ] 3. **Appointment Booking**: Complete booking flow end-to-end; confirmation email arrives; appointment appears in staff calendar.
- [ ] 4. **Real-time Messaging**: Patient ↔ Front Desk message delivered live via Reverb WebSockets; fallback polling works if WSS is disconnected.
- [ ] 5. **Automations & Reminders**: Trigger reminder via demo clock on demo database; queue worker processes email outbox.
- [ ] 6. **Payments**: Generate invoice → PayMongo test checkout (GCash/Test Card) → webhook verifies payment → receipt email and PDF download generate properly.
- [ ] 7. **Staff / Dentist / Owner Portals**: All 4 roles sign in; schedules, leave requests, handovers, and counter QR open without errors.
- [ ] 8. **Security & Privacy**: No secrets in frontend bundle; HTTPS enforced; error stack traces hidden from end users.
- [ ] 9. **Performance**: Page loads snappy on 4G mobile and desktop.
- [ ] 10. **Demo Reset**: Single-command/button reset working to refresh demo data before Saturday defense.
