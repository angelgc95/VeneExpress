# VeneExpress

VeneExpress is an independently owned logistics and shipping platform, personally built and maintained for day-to-day shipment operations. It covers customer records, shipment intake, box handling, invoicing, payments, and public tracking from a locally controlled codebase and Supabase backend.

## Overview

This repository is the working source of truth for VeneExpress.

- Public users can track shipments and estimate pricing.
- Staff can create shipments, manage boxes, scan incoming items, and work through shipment status changes.
- Administrators can manage approvals, roles, company settings, pricing rules, and other operational data.

The project no longer depends on Lovable-managed infrastructure. Its current frontend, backend, and migration artifacts are maintained directly from this repository and an owned Supabase project.

## Core Capabilities

- Customer management
- Shipment creation with sender and receiver addresses
- Sea and air service workflows
- Box intake with dimensions, barcode-based scan support, and shipment association
- Shipment status tracking with public tracking codes
- Invoice generation, invoice line items, and payment recording
- Admin approvals and role-based access for staff, admin, and read-only users
- Public contact, pricing estimator, and tracking entry points

## Current Architecture

- Frontend: Vite, React, TypeScript, React Router, TanStack Query, Tailwind CSS, and shadcn/ui
- Backend: owned Supabase project used for Postgres, auth, RPCs, and row-level security
- Browser client: `src/integrations/supabase/client.ts`
- Database history and policies: `supabase/migrations/`
- Edge Functions: `supabase/functions/generate-invoice/` and `supabase/functions/generate-label/`
- Migration artifacts: `migration-ready/` and `migration-exports/`

The frontend can be hosted independently on a standard static host. Operational backend behavior lives in Supabase rather than in a hosted Lovable environment.

## Project Evolution

VeneExpress started with Lovable as an early accelerator for the first prototype. That initial phase was useful for getting the first working logistics workflow online quickly, but it was not the long-term operating model.

The codebase was later migrated into local ownership and control. Lovable-specific managed-project residue was removed from the application, and this repository became the maintained source of truth.

The backend was then moved from Lovable Cloud to an owned Supabase project. Supabase migrations were applied successfully, Supabase Edge Functions were deployed successfully, and the migrated transactional flows were validated on the new backend.

Today, VeneExpress is independently maintained from this local repository and owned infrastructure. Auth/user recreation and production hosting cutover are intentionally being handled as separate controlled steps rather than folded into the backend migration itself.

## Current Status

- The repo reflects the independently maintained version of VeneExpress under local ownership and control.
- The owned Supabase backend is in place and validated for existing operational flows.
- Existing shipment and invoice views work on the migrated backend.
- A new validation shipment was created successfully as shipment number `17`.
- Auth/user recreation remains a separate manual step.
- Production hosting and custom-domain cutover remain separate later steps.

## Local Development

### Requirements

- Node.js 18+
- npm

### Environment

Create a local `.env` file with:

```sh
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

### Run Locally

```sh
npm install
npm run dev
```

### Available Scripts

```sh
npm run dev
npm run build
npm run preview
npm run lint
npm run test
npm run test:watch
```

## Supabase / Backend Notes

- Schema changes, RLS policies, RPC definitions, and backend corrections are tracked under `supabase/migrations/`.
- The app relies on Supabase for operational data access rather than a Lovable-managed backend.
- Invoice and label generation are handled through deployed Supabase Edge Functions.
- Migration CSVs used during backend takeover are kept in `migration-ready/` and `migration-exports/` for operational reference.

If this project is pointed at a different Supabase instance in the future, the migrations and Edge Functions need to be applied there before labels, invoices, and shipment workflows will behave consistently.

## Data Migration Status

The owned Supabase backend has already received the core transactional dataset for:

- `customers`
- `addresses`
- `shipments`
- `boxes`
- `invoices`
- `invoice_line_items`
- `payments`

Post-migration counter corrections completed successfully:

- `shipment_counter` synced to `16`
- `invoice_counter` synced to `27`

Local validation already completed on the migrated backend:

- Existing shipment view works
- Existing invoice view works
- New test shipment created successfully as shipment number `17`

## Auth Note

Auth and user recreation are being handled manually as a separate controlled step. This repository should not be read as claiming that user migration was automated or fully completed as part of the transactional data migration.

## Deployment Note

Production hosting and custom-domain cutover are separate later steps. Until that cutover is intentionally completed, treat this repository and the owned Supabase project as the current technical source of truth, but do not assume final production routing from the repo alone.
