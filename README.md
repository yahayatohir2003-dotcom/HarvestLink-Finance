# HarvestLink Finance

**A Transaction-Centred Agricultural Supply-Chain Finance Coordination Platform**

HarvestLink Finance is a web-based platform designed to improve coordination, transparency, and documentation between agricultural suppliers, buyers, and financiers.

The platform helps participants manage purchase orders, submit financing requests, review supporting documents, track fulfilment milestones, confirm deliveries, manage invoices, and monitor settlement progress.

HarvestLink Finance is a coordination platform. It does not provide loans, hold funds, guarantee financing, replace banks, or process real financial transactions.

## 1. Problem Statement

Agricultural supply-chain transactions often involve several parties working with disconnected records, manual documentation, and limited visibility into transaction progress.

HarvestLink Finance addresses these challenges by providing a centralized digital environment where authorized participants can coordinate transaction activities and monitor progress.

## 2. Key Features

- **Purchase Order Management:** Create, manage, and track purchase orders.
- **Financing Requests:** Submit financing requests linked to purchase orders.
- **Document Management:** Upload and manage supporting transaction documents.
- **Financing Review:** Enable authorized financiers and reviewers to assess financing requests.
- **Fulfilment Tracking:** Monitor transaction milestones and delivery progress.
- **Delivery Confirmation:** Record and confirm delivery activities.
- **Invoice Management:** Create and manage transaction invoices.
- **Settlement Tracking:** Monitor settlement records and reconciliation progress.
- **Audit Logs:** Maintain records of important platform activities.
- **Role-Based Access:** Restrict access according to user roles.

## 3. User Roles

| Role | Responsibility |
|---|---|
| Supplier | Manages purchase orders, documents, and fulfilment activities. |
| Buyer | Manages purchase orders, delivery confirmations, and invoices. |
| Financier | Reviews financing requests and related transaction information. |
| Administrator | Oversees platform activities and administrative operations. |

## 4. Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 14 | Application framework |
| React 18 | User interface |
| TypeScript | Application development |
| Tailwind CSS | Styling |
| Supabase | Backend services and database |
| PostgreSQL | Relational database |
| Supabase Auth | Authentication |
| Supabase Storage | Document storage |

## 5. System Architecture

HarvestLink Finance uses a web application architecture powered by Next.js and Supabase.

- Frontend: Next.js, React, TypeScript, and Tailwind CSS.
- Backend services: Supabase.
- Database: PostgreSQL.
- Authentication: Supabase Auth.
- File storage: Private Supabase Storage bucket.

The platform uses role-based access controls and database-level Row Level Security (RLS) to protect authorized data access.

## 6. Getting Started

### Prerequisites

- Node.js and npm
- Git
- A Supabase account
- A Supabase project

### Clone the Repository

```bash
git clone https://github.com/yahayatohir2003-dotcom/HarvestLink-Finance.git
```

```bash
cd HarvestLink-Finance
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env.local` file in the project root and add the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_STORAGE_BUCKET=transaction-documents
```

Replace the blank values with the appropriate credentials from your Supabase project.

**Security Notice:** Never commit `.env.local` or expose your Supabase service role key in frontend code or public repositories.

### Run the Development Server

```bash
npm run dev
```

Open your browser and visit:

```text
http://localhost:3000
```

## 7. Database and Storage

The platform uses Supabase PostgreSQL for structured transaction data.

Its data model includes:

- Organizations
- Profiles
- Purchase Orders
- Order Items
- Documents
- Financing Requests
- Financing Reviews
- Fulfilment Milestones
- Delivery Confirmations
- Invoices
- Settlements
- Audit Logs

The `transaction-documents` storage bucket is intended for private transaction documents.

Supported document formats include PDF, JPEG, and PNG, with a maximum file size of 10 MB.

## 8. Security Considerations

HarvestLink Finance incorporates security measures including:

- Role-based access control.
- Supabase Row Level Security.
- Protected document storage.
- Authentication and authorization checks.
- Audit logging.
- Server-side handling of privileged operations.

Security configurations should be reviewed and tested before production deployment.

## 9. Project Scope and Limitations

HarvestLink Finance coordinates agricultural supply-chain financing activities. It does not:

- Act as a financial institution or lender.
- Hold customer funds.
- Guarantee financing approval.
- Replace banks or their authorization processes.
- Execute or process actual bank transfers.

Financing decisions and actual financial transactions remain the responsibility of the relevant financial institutions and authorized parties.

Any demonstration organizations or transaction records should be treated as sample data, not evidence of real commercial partnerships.

## 10. Project Status

The project has been committed to GitHub and its source code is available in this private repository.

Cloud deployment, production readiness, and further security and concurrency validation remain separate stages of the project.

## 11. Repository

**GitHub:** https://github.com/yahayatohir2003-dotcom/HarvestLink-Finance

---

**HarvestLink Finance**  
*Connecting Agricultural Transactions Through Digital Coordination.*
