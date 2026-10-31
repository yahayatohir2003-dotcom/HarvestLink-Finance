# HarvestLink Finance — Security & Document Audit Report

## 1. Executive Summary

HarvestLink Finance coordinates agricultural supply-chain transactions under a strict zero-trust, multi-tenant security architecture. This report documents the security controls, document permissions matrix, private storage protections, and credential isolation verified during Step 10.

---

## 2. Document Access & Storage Security

### A. Private Bucket Isolation
- All transactional trade documents (warehouse receipts, inspection certificates, waybills, commercial invoices) reside within the dedicated Supabase Storage bucket:
  - **Bucket Name**: `transaction-documents`
  - **Public Access**: `public = false` (Direct unauthenticated HTTP access is strictly forbidden by storage policy).

### B. Temporary Signed URL Protocol
- Document viewing and downloading is mediated exclusively through the server action `getDocumentSignedUrlAction`.
- The server verifies session validity, user role, and organization ownership before calling `admin.storage.createSignedUrl`.
- **TTL**: URLs expire after a short validity window (1 hour), eliminating persistent or link-sharing attack vectors.

### C. Counterparty Permissions Matrix

| User Role | Upload Document | View Attached Documents | Review / Verify Document | Delete Pending Document | Delete Verified Document |
|---|:---:|:---:|:---:|:---:|:---:|
| **Issuing Buyer** | ✅ (Order Counterparty) | ✅ (Their Orders Only) | ❌ (Unauthorized) | ✅ (If Original Uploader) | ❌ (Locked) |
| **Assigned Supplier** | ✅ (Order Counterparty) | ✅ (Their Orders Only) | ❌ (Unauthorized) | ✅ (If Original Uploader) | ❌ (Locked) |
| **Institutional Financier** | ❌ (Read/Review Only) | ✅ (Underwriting Portfolio) | ✅ (Approve / Reject) | ❌ (Unauthorized) | ❌ (Locked) |
| **Platform Administrator** | ✅ (System Authority) | ✅ (Platform Wide) | ✅ (Approve / Reject) | ✅ (Any Document) | ✅ (Audit Override) |
| **External / Unauthenticated** | ❌ (Blocked) | ❌ (Blocked) | ❌ (Blocked) | ❌ (Blocked) | ❌ (Blocked) |

### D. Verification & Deletion Safeguards
- **Verified Document Lock**: Once a document is verified by a Financing Reviewer or Administrator, the original uploader cannot delete or tamper with it. Only an Administrator with explicit audit logging can remove a verified document.
- **Rollback Guarantee**: If the database record insertion into `documents` fails during an upload attempt, the orphaned storage file in `transaction-documents` is automatically cleaned up and rolled back.

---

## 3. Secret Isolation & Credential Auditing

### A. Client-Side Code Auditing
- Scanned all 74 client components and route files in `app/` and `components/`.
- **Result**: Zero references to `SUPABASE_SERVICE_ROLE_KEY` or `createAdminClient` in client-side code (`"use client"`).
- All administrative operations (e.g., cross-organization joins, audit logging, signed URL generation) execute exclusively within server actions (`"use server"`) or server-side page components.

### B. Client Bundle Inspection
- Inspected Next.js production client bundles in `.next/static/chunks/`.
- Verified that no service-role secrets or sensitive database passwords appear in bundled client JavaScript.

### C. Git & Environment File Safeguards
- [`.gitignore`](file:///c:/Users/Abu%20Juwairiyyah/OneDrive/Desktop/HarvestLink-Finance/.gitignore) strictly ignores:
  - `.env*.local`
  - `.env`
  - `*.pem`
- Verified that local environment files containing real secrets are never committed or deployed to version control.
