# Run & Test Guide: Multi-Branch Dental Clinic System

Instructions for local development, test execution, database resets, and troubleshooting across Windows and macOS environments.

---

## 1. Environment & Prerequisites

- **Node.js**: v18.0.0+ (Tested on Node 20 / 22)
- **PHP**: ^8.3 with extensions `pdo_pgsql`, `pgsql`, `mbstring`, `openssl`, `bcmath`, `curl`, `dom`, `fileinfo`
- **Composer**: 2.x
- **PostgreSQL**: 16.x (Local install or Docker container)

---

## 2. Environment Variables Overview (Names Only)

### Frontend (`.env` or `.env.local` at repository root):
```env
VITE_API_URL=http://localhost:8000
VITE_REVERB_APP_KEY=
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

### Backend (`backend/.env`):
```env
APP_NAME=
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=dental_clinic_demo
DB_USERNAME=postgres
DB_PASSWORD=

SESSION_DRIVER=database
SESSION_DOMAIN=localhost
BROADCAST_CONNECTION=reverb
QUEUE_CONNECTION=database
CACHE_STORE=database

MAIL_MAILER=log
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=

PAYMONGO_PUBLIC_KEY=
PAYMONGO_SECRET_KEY=
PAYMONGO_WEBHOOK_SECRET=

REVERB_APP_ID=
REVERB_APP_KEY=
REVERB_APP_SECRET=
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SERVER_HOST=127.0.0.1
REVERB_SERVER_PORT=8080
```

### Backend Testing (`backend/.env.testing`):
```env
APP_KEY=
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=
SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173
```

---

## 3. Running the System Locally

### Step 1: Start PostgreSQL (Docker option)
```bash
docker run --name dental-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
docker exec -it dental-postgres createdb -U postgres dental_clinic_demo
docker exec -it dental-postgres createdb -U postgres dental_clinic_test
```

### Step 2: Database Migration & Seeding
```bash
cd backend
php artisan migrate
php artisan db:seed
php artisan db:seed --class=DemoClinicSeeder
cd ..
```

### Step 3: Launch Local Services (Separate Terminals)
- **Frontend**:
  ```bash
  npm run dev
  ```
  *(Opens on `http://localhost:5173`)*
- **API Server**:
  ```bash
  cd backend && php artisan serve --port=8000
  ```
- **Queue Worker**:
  ```bash
  cd backend && php artisan queue:work --queue=mail,default
  ```
- **Task Scheduler**:
  ```bash
  cd backend && php artisan schedule:work
  ```
- **Reverb WebSocket Server**:
  ```bash
  cd backend && php artisan reverb:start --port=8080
  ```

---

## 4. Resetting the Demo Database

To wipe and rebuild a clean demo clinic state with all branches, demo appointments, treatments, and seed data:
```bash
cd backend
php artisan migrate:fresh --force
php artisan db:seed --force
php artisan db:seed --class=DemoClinicSeeder --force
```
*(On Linux/macOS bash shells, run `./scripts/demo-reset.sh --yes`)*

---

## 5. Verification & Test Execution

### Frontend Test Suite (884 tests)
```bash
npm test
```

### Frontend Smoke Render Suite (16 passes)
```bash
npm run test:smoke
```

### Frontend Production Build Validation
```bash
npm run build
```

### Backend Feature Test Suite (813 tests)
```bash
cd backend
php artisan test
```

### Pre-Defense Automated Health Check
```bash
./scripts/predefense-check.sh
```

---

## 6. Troubleshooting Common Issues

| Issue / Error | Root Cause | Solution |
| --- | --- | --- |
| `createdb : The term 'createdb' is not recognized` | Windows PowerShell lacks PostgreSQL client tools in PATH. | Run `createdb` inside Docker container via `docker exec -it dental-postgres createdb -U postgres <db>` or install Postgres CLI. |
| `failed to connect to the docker API at npipe://...` | Docker Desktop daemon is not running. | Launch Docker Desktop from Windows Start Menu and wait for "Engine running" status. |
| `419 CSRF token mismatch` | Sanctum CSRF cookie missing or domain mismatch. | Ensure frontend issues `GET /sanctum/csrf-cookie` before POST, and verify `SANCTUM_STATEFUL_DOMAINS` includes frontend host. |
| `ConcurrentQueueNumberTest` flaky failure | Test executes during the exact 23:59 Manila minute boundary. | Re-run test suite; test automatically passes. |
| Cross-domain cookie blocked on Vercel/Railway | Third-party cookie blocked between `vercel.app` and `railway.app`. | Use Vercel proxy rewrite in `vercel.json` (Option B) or connect custom domain (Option A). |
