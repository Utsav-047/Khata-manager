# Khata Management System - Financial Accounting Rules & Invariants

This document formalizes the mathematical and financial rules implemented in the Central Ledger Service.

---

## 1. Monetary Storage Architecture

To prevent floating-point representation artifacts (such as `0.1 + 0.2 = 0.30000000000000004` or `266.50 * 100 = 26649.999999999996`):

- **Integer Paise Representation**: All monetary values (`openingBalance`, `unitPrice`, `lineTotal`, `subtotal`, `discount`, `additionalCharges`, `totalAmount`, `payment.amount`, `allocatedAmount`, and running balances) are processed and persisted as **integer paise** (`1 Rupee = 100 Paise`).
- Currency boundary converters (`toPaise()` and `toRupees()`) are used exclusively at API boundaries.
- Fractional quantities (e.g., 2.5 kg of micronutrient) are multiplied by integer unit price in paise and rounded to nearest integer paise:
  $$\text{lineTotalPaise} = \text{round}(\text{quantity} \times \text{unitPricePaise})$$

---

## 2. Customer Outstanding Balance (Baaki) Formula

$$\text{Customer Baaki} = \text{Opening Balance} + \sum \text{Active Invoices} - \sum \text{Active Payments} - \text{Approved Credits}$$

### Invariant:
Payment allocations to invoices **must NEVER be subtracted again** from the customer balance. An allocation is an internal breakdown linking an existing payment to an invoice. Double subtraction is mathematically prevented by calculating customer balance purely from total payments.

---

## 3. Invoice Remaining Balance Formula

$$\text{Invoice Remaining Balance} = \text{Invoice Total Amount} - \sum \text{Active Allocations to this Invoice}$$

- An invoice is **Fully Paid** when its remaining balance is $0$.
- An invoice is **Partially Paid** when active allocations $> 0$ and remaining balance $> 0$.
- An invoice is **Unpaid** when active allocations $= 0$.

---

## 4. The Two Payment Modes

### Mode 1: Simple Payment (Unallocated Credit)
- Customer pays amount $P$.
- A payment record is created with $amount = P$, and $allocations = []$.
- The customer's net Baaki reduces immediately by $P$.
- The customer ledger reflects the credit immediately.
- The amount remains unallocated until staff optionally allocates it to past or future invoices.

### Mode 2: Invoice-wise Allocation
- Customer pays amount $P$ and specifies allocations across invoices $I_1, I_2, \dots, I_k$:
  $$\sum_{j=1}^{k} \text{allocatedAmount}_j \le P$$
- For every invoice $I_j$:
  $$\text{allocatedAmount}_j \le \text{InvoiceRemainingBalance}(I_j)$$
- Crucially, only **one** payment of $P$ is recorded.
- Invoice $I_j$ remaining balance is reduced by $\text{allocatedAmount}_j$.
- Any unallocated remainder $P - \sum \text{allocatedAmount}_j$ remains as customer credit.
- Total customer Baaki reduces by $P$, exactly once.

---

## 5. Critical Acceptance Verification Example

- **Invoice A** = ₹5,365 (10 bags Urea @ ₹266.50 = ₹2,665 + 2 bags DAP @ ₹1,350 = ₹2,700)
- **Invoice B** = ₹2,000
- **Total Initial Baaki** = ₹7,365
- **Payment Recorded** = ₹3,000
  - Allocation to Invoice A = ₹2,000
  - Allocation to Invoice B = ₹1,000

### Resulting Account State:
- **Invoice A Balance**: ₹5,365 − ₹2,000 = **₹3,365**
- **Invoice B Balance**: ₹2,000 − ₹1,000 = **₹1,000**
- **Customer Net Baaki**: ₹7,365 − ₹3,000 = **₹4,365**
- **Total Payment Recorded**: ₹3,000 (No duplicate counting)
- **Automated Vitest Test**: Passed (`src/tests/accounting.test.js`)

---

## 6. Financial Reversal Rules

1. **Invoice Reversal**:
   - Status changes to `REVERSED`.
   - Reason is recorded along with timestamp and user ID.
   - Any active payment allocations referencing this reversed invoice are released back to unallocated customer credit.
   - The invoice debit is removed from the customer's ledger running balance.
2. **Payment Reversal**:
   - Status changes to `REVERSED`.
   - All allocations linked to this payment are marked `REVERSED`.
   - Invoices regain their unpaid balances.
   - The payment credit is removed from the customer's ledger running balance.
   - Immutable audit log entry is preserved.
