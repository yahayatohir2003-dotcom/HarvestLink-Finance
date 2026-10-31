# HarvestLink Finance — Competition Demonstration Playbook
## Access Youth Tech Forge 2026 (3-Minute Live Pitch Sequence)

---

## 1. Demonstration Overview & Accounts

The live demonstration guides judges through a real-world agricultural trade transaction coordinated between four distinct portal workspaces:

| Role | Organization | Primary Action in Demo |
|---|---|---|
| **Buyer** | Grand Cereals Plc | Issues purchase order for 25 MT Yellow Maize; confirms warehouse delivery. |
| **Supplier** | Kano Grain Aggregators Ltd | Accepts PO; uploads waybill to private vault; submits 70% PO financing request. |
| **Financier** | First Agric Capital Partners | Inspects trade dossier; reviews warehouse receipt; approves credit terms. |
| **Admin** | HarvestLink Governance Desk | Inspects unbroken audit trail registry in real time. |

---

## 2. Timed 3-Minute Live Demonstration Sequence

### Minute 0:00 – 0:45: The Problem & The Purchase Order
- **Presenter**: *"In Nigeria, grain aggregators have confirmed purchase orders from major processors like Grand Cereals, but banks won't lend to them without collateral because the transaction evidence is scattered. HarvestLink organizes this trade lifecycle into an immutable digital record."*
- **Action**:
  1. Open [Landing Page](file:///c:/Users/Abu%20Juwairiyyah/OneDrive/Desktop/HarvestLink-Finance/app/page.tsx) — highlight architecture badges (`100% RLS`, `Private Vault`, `Non-Custodial`).
  2. Navigate to **Buyer Portal**: Show the active contract for **25 Metric Tons of Yellow Maize (₦8,750,000)** (`HL-PO-2026-DEMO-01`).
  3. Point out that the buyer issued the specification and delivery target directly in the system.

### Minute 0:45 – 1:30: Supplier Acceptance & Financing Request
- **Presenter**: *"The aggregator accepts the order on their smartphone browser and attaches the warehouse inspection receipt to the encrypted vault. With verified counterparty commitment, they can immediately request financing."*
- **Action**:
  1. Switch to **Supplier Portal**: Show accepted PO.
  2. Inspect **Attached Documents**: Click "Inspect Waybill" to show the temporary signed URL securely retrieving the document from the private bucket.
  3. Show the submitted **Financing Request** for ₦6,125,000 (70% LTV).

### Minute 1:30 – 2:15: Institutional Underwriting & Fulfilment Telemetry
- **Presenter**: *"Rather than waiting weeks for manual credit committees, the institutional lender evaluates the complete transaction dossier in one place."*
- **Action**:
  1. Switch to **Financier Portal**: Open Underwriting Queue -> `HL-PO-2026-DEMO-01`.
  2. Review the verified trade documents and approve the credit facility.
  3. Show **Fulfilment Tracking**: 3 milestones recorded (Grain Cleaning, Bagging, Transit Dispatch).

### Minute 2:15 – 3:00: Delivery Confirmation, Settlement & Audit Trail
- **Presenter**: *"When the truck arrives at the mill, the buyer confirms physical receipt. The supplier issues the commercial invoice, the buyer logs the bank transfer reference, and the financier reconciles the settlement."*
- **Action**:
  1. Open **Delivery Confirmation**: Highlight counterparty acceptance.
  2. Open **Commercial Invoice** (`HL-INV-2026-DEMO-01`): Show verified status as `paid`.
  3. Open **Admin Portal -> Audit Trail Registry**: Click "Audit Trail Registry" to display the chronological, actor-tagged audit log proving every step occurred securely and transparently.

---

## 3. Smartphone Showcase (Mobile Responsiveness)

During or immediately following the demo, toggle Chrome DevTools to a **375px / 390px mobile viewport** (or show on a real smartphone):
- Display the dedicated mobile card layout on **Purchase Orders**, **Invoices**, and **Financing** lists.
- Demonstrate that aggregators and logistics officers in the field can upload waybills and log milestones directly from mobile browsers without needing a desktop or native app.

---

## 4. Contingency & Fallback Strategy

If live presentation internet connectivity fails or experiences high latency during the competition:

1. **Localhost Standby**:
   - Keep the local development server running on `http://localhost:3000` with seeded demonstration data (`npm run start` or `npm run dev`).
2. **Offline Pre-Recorded Video / Walkthrough**:
   - Maintain a 1080p MP4 recording of the full 3-minute sequence saved locally on the presenter laptop desktop.
3. **Pre-Seeded Showcase Record**:
   - The seed script `node --env-file=.env.local scripts/seed_competition_demo.mjs` ensures that all records (`HL-PO-2026-DEMO-01`, documents, financing, invoices) are permanently available and ready for instant display.

---

## 5. Live Troubleshooting Checklist

| Issue | Quick Fix |
|---|---|
| User session expired during demo | Click "Demo Fast-Login" or use pre-saved credentials in browser autofill. |
| Network drop | Switch browser tab immediately to `http://localhost:3000`. |
| Missing test data | Run `node --env-file=.env.local scripts/seed_competition_demo.mjs` in terminal (takes < 5 seconds). |
| Dialog won't close on touch | Click the dedicated "Cancel" button or tap backdrop. |
