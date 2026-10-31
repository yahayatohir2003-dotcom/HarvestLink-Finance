# HarvestLink Finance — Production Deployment Guide

## 1. Overview & Architecture

HarvestLink Finance is built using Next.js App Router (version 14.2), TypeScript, Tailwind CSS, and Supabase (PostgreSQL with Row-Level Security, Auth, and private Storage).

The application is architected for zero-configuration deployment to **Vercel** with Supabase as the backend database and authentication provider.

---

## 2. Pre-Deployment Verification Checklist

Before deploying to production, verify the following locally:

- [x] `npm run build` exits with code `0` and compiles all 21 App Router routes.
- [x] `npm run type-check` returns 0 TypeScript compilation errors.
- [x] Zero references to `SUPABASE_SERVICE_ROLE_KEY` in client components or client bundles.
- [x] `.env.local` is present in `.gitignore` and not tracked by Git.
- [x] All 20 security tests pass: `node --env-file=.env.local scripts/test_security_review.mjs`.
- [x] All 14 end-to-end journey tests pass: `node --env-file=.env.local scripts/test_end_to_end_journey.mjs`.

---

## 3. Required Environment Variables Checklist

Configure these environment variables in your Vercel Project Settings (**Settings -> Environment Variables**):

| Variable Name | Environment | Required | Description |
|---|:---:|:---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Dev | **Yes** | Your Supabase Project URL (`https://<project-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Dev | **Yes** | Supabase Anonymous public API key (safe for browser/client). |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview, Dev | **Yes** | **Server-only** service role secret key (bypasses RLS for trusted server actions). |
| `NEXT_PUBLIC_APP_URL` | Production | **Yes** | Fully qualified production domain (e.g. `https://harvestlink-finance.vercel.app`). |
| `NEXT_PUBLIC_STORAGE_BUCKET` | Production, Preview, Dev | **Yes** | Private document bucket name (`transaction-documents`). |

> [!CAUTION]
> Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`. Exposing this secret key to the browser completely voids PostgreSQL Row Level Security.

---

## 4. Step-by-Step Vercel Deployment Instructions

### Method A: Git Integration (Recommended)
1. Push your audited, verified codebase to your GitHub/GitLab repository:
   ```bash
   git add .
   git commit -m "feat: complete MVP Step 10 finalisation and competition readiness"
   git push origin main
   ```
2. Log in to the [Vercel Dashboard](https://vercel.com).
3. Click **"Add New..."** -> **"Project"** and import the `HarvestLink-Finance` repository.
4. Framework Preset will auto-detect **Next.js**.
5. In the **Environment Variables** section, paste the 5 variables from the checklist above.
6. Click **Deploy**. Vercel will run `next build`, generate static pages, and deploy edge middleware.

### Method B: Vercel CLI (Direct Terminal Deployment)
If you have the Vercel CLI installed:
```bash
# 1. Login to Vercel
vercel login

# 2. Link your local project directory
vercel link

# 3. Pull development environment variables (optional)
vercel env pull

# 4. Deploy to Production
vercel --prod
```

---

## 5. Post-Deployment Verification & Health Checks

Once deployed, run the automated health check script against your live URL:
```bash
node scripts/verify_deployment_health.mjs --url=https://your-app.vercel.app
```

Verify the following manual flows on the live URL:
1. **Landing Page**: Loads with HTTP 200; features anchor `/#features` navigates smoothly.
2. **Registration**: Register as a Supplier, Buyer, or Financier/Reviewer (`?role=reviewer`).
3. **Login**: Session cookie is set and redirects to dedicated role dashboard.
4. **Smartphone Compatibility**: Inspect at 320px–430px viewports; verify mobile cards, hamburger navigation, and touch buttons.
5. **Private Vault**: Upload a document to an order; verify signed URL expiration and private access.
