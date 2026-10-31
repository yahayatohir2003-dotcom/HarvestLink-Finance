# HarvestLink Finance — Settlement Safety & Concurrency Architecture

## 1. Executive Summary & Protocol Boundary

HarvestLink Finance is a non-custodial agricultural trade-coordination platform.

### Protocol Invariants:
1. **Zero Fund Custody**: HarvestLink never accepts deposits, holds buyer/seller funds in escrow, executes direct bank debits, or operates a banking/payment gateway.
2. **Coordination Layer**: Financial settlements represent off-platform commercial bank transfers (e.g., NIBSS, NEFT, RTGS) recorded by transaction counterparties and verified by authorized financing reviewers or administrators.
3. **Audit Immutability**: Every settlement claim, simulation, review decision, and status transition is recorded with timestamped cryptographic actor identity in `audit_logs`.

---

## 2. Review of Existing Settlement Actions

The settlement workflow is implemented across two server-side actions in [`app/dashboard/invoices/actions.ts`](file:///c:/Users/Abu%20Juwairiyyah/OneDrive/Desktop/HarvestLink-Finance/app/dashboard/invoices/actions.ts):

### A. `recordSettlementCoordinationAction`
- **Authentication & Authorization**: Requires an active Supabase session. Restricted to counterparties associated with the purchase order (buyer organization, supplier organization) or platform administrators.
- **Simulated Record Guard**: When `is_simulated = true`, the record is explicitly tagged as a demonstration simulation. The parent commercial invoice balance is **never** credited, and invoice status remains unchanged (`issued`).
- **Pending Payment Claim Guard**: When a buyer submits an external payment notice (`status = 'pending'`), the invoice status strictly remains `'issued'`. The system never marks an invoice as paid based solely on an unverified user submission.
- **Compensating Rollback**: In direct reconciliation modes, if the sum of verified payments exceeds the invoice total, the record is immediately rolled back and the transaction fails with an over-settlement error.

### B. `reconcileSettlementAction`
- **Role Guard**: Strictly restricted to users with the verified database role `'financier'` or `'admin'`. Suppliers and buyers attempting to invoke this action are blocked with HTTP 403 / unauthorized response.
- **Simulation Rejection**: Reconciling a simulated record is explicitly blocked (`if (settlement.is_simulated) return error`). Simulated records cannot be converted into verified settlement claims.
- **Cumulative Balance Verification**: Queries all existing non-simulated `'paid'` settlements for the invoice. Verifies that `existingPaid + claimAmount <= invoiceAmount`.
- **Atomic Invoice Transition**: Upon verification, the settlement transitions to `'paid'`, and the invoice status transitions to `'partially_paid'` or `'paid'` (if cumulative total $\ge$ invoice total).
- **Audit Logging**: Inserts a structured audit event into `audit_logs` containing `reviewer_id`, `actor_id`, `decision`, `review_comments`, and financial details.

---

## 3. Concurrency Safety Analysis

### The Known Concurrency Limitation
Under the current application-level insert-then-check-and-compensate model:
1. Two simultaneous requests from different sessions attempting to settle the same invoice can read the existing balance at time $T_0$.
2. Both sessions compute that remaining capacity is available.
3. Both sessions proceed to insert their settlement records.
4. While the application compensates by querying after insert, under high race conditions without database row-level locking, there exists a brief window where cumulative settlements could temporarily exceed invoice balances.

### Automated Concurrency Test Verification
The regression test suite [`scripts/test_concurrency_race.mjs`](file:///c:/Users/Abu%20Juwairiyyah/OneDrive/Desktop/HarvestLink-Finance/scripts/test_concurrency_race.mjs) confirms that:
- Individual sequential requests accurately enforce balance caps.
- Over-settlement attempts greater than the remaining balance are rejected.
- Rollback mechanisms successfully clean up rejected records.

---

## 4. Recommended Database-Level Solution (Future Approved Migration)

To achieve strict ACID atomicity without relying on application-level multi-step checks, the following PostgreSQL row-level locking trigger is designed and tested for future deployment once database migration approval is granted:

```sql
-- ==============================================================================
-- PROPOSED FUTURE MIGRATION: ATOMIC SETTLEMENT BALANCE ENFORCEMENT
-- Note: Do NOT execute without explicit prior authorization from the user.
-- ==============================================================================

CREATE OR REPLACE FUNCTION enforce_settlement_balance_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_amount NUMERIC;
  v_current_paid NUMERIC;
BEGIN
  -- Only enforce on non-simulated settlements affecting verified balances
  IF NEW.is_simulated = TRUE OR NEW.status != 'paid' OR NEW.invoice_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Acquire an exclusive row-level lock on the target invoice
  -- Prevents concurrent transactions from interleaving balance calculations
  SELECT amount INTO v_invoice_amount
  FROM invoices
  WHERE id = NEW.invoice_id
  FOR UPDATE;

  IF v_invoice_amount IS NULL THEN
    RAISE EXCEPTION 'Invoice with ID % does not exist.', NEW.invoice_id;
  END IF;

  -- Calculate existing verified settlements for this invoice
  SELECT COALESCE(SUM(amount), 0) INTO v_current_paid
  FROM settlements
  WHERE invoice_id = NEW.invoice_id
    AND status = 'paid'
    AND is_simulated = FALSE
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Enforce strict mathematical ceiling
  IF (v_current_paid + NEW.amount) > v_invoice_amount THEN
    RAISE EXCEPTION 'Settlement of ₦% would exceed remaining invoice balance (₦% remaining of ₦% total).',
      NEW.amount,
      (v_invoice_amount - v_current_paid),
      v_invoice_amount;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger binding
DROP TRIGGER IF EXISTS trg_enforce_settlement_balance ON settlements;
CREATE TRIGGER trg_enforce_settlement_balance
BEFORE INSERT OR UPDATE ON settlements
FOR EACH ROW
EXECUTE FUNCTION enforce_settlement_balance_limit();
```

### Safety Features of the Proposed Trigger:
1. **`FOR UPDATE` Locking**: Serializes concurrent settlement attempts on the same invoice; the second transaction waits until the first commits or rolls back.
2. **Zero Schema Alteration**: Requires no new tables or columns. Operates entirely on the existing `settlements` and `invoices` schemas.
3. **Simulation Exemption**: Does not disrupt test simulations (`is_simulated = true`) or unverified payment notices (`status = 'pending'`).
