# GEMINI.md

## Project Overview
**HANA2 (Hana Campus Budget)** is a Purpose-driven Deposit Token Budget Platform MVP. It is designed as a collaborative campus financial service (co-developed with Hana Bank) to manage budgets for organizations like student clubs and councils.

### Core Pillars
1.  **Policy Engine:** All transaction authorizations are governed by a centralized policy engine (`lib/policyEngine.ts`).
2.  **Ledger-First:** `LedgerEntry` is the single source of truth for all balance changes (issue, spend, refund, recall).
3.  **Auditability:** Critical events are anchored to a blockchain layer (`AnchorRecord`) for tamper-proof auditing.
4.  **Operational AI:** AI serves as a support tool for risk assessment and categorization, not a primary decision-maker.

### Tech Stack
-   **Framework:** Next.js 16 (App Router) - *Note: This version has breaking changes; refer to `node_modules/next/dist/docs/`.*
-   **Database:** Prisma ORM with `better-sqlite3`.
-   **Styling:** Tailwind CSS 4, Shadcn UI.
-   **State Management:** Zustand.
-   **AI:** Google Generative AI (`@google/genai`).

---

## Building and Running

### Prerequisites
-   Node.js (latest LTS recommended)
-   `npm` or `yarn`

### Setup & Development
```bash
# Install dependencies
npm install

# Initialize/Generate Prisma client
npm run postinstall # or npx prisma generate

# Seed the database (Important for demo flows)
npm run seed

# Start development server
npm run dev
```

### Key Commands
-   **`npm run dev`**: Runs `prisma generate` and starts the Next.js dev server.
-   **`npm run build`**: Generates Prisma client and builds the production application.
-   **`npx prisma studio`**: Opens a GUI to view and manage the SQLite database (`dev.db`).
-   **`npm run lint`**: Runs ESLint.

---

## Development Conventions

### 1. The Policy Engine Priority
Always defer to `lib/policyEngine.ts` for transaction logic. The four primary states are:
-   `APPROVED`: Immediate authorization.
-   `NOTIFIED`: Approved but flags a notification to admins.
-   `PENDING`: Requires manual admin review.
-   `DECLINED`: Immediate rejection based on policy.

### 2. Data Integrity
-   **Never** update `Budget.currentBalance` without creating a corresponding `LedgerEntry`.
-   Use `lib/db.ts` for database instances and ensure transactions are used where atomicity is required.

### 3. User Flows & Roles
-   **Club User (`/club`)**: Budget application, policy viewing, execution requests, settlement reporting.
-   **Admin (`/admin`)**: Request review, budget issuance, pending transaction review, audit log management.
-   **POS (`/pos`)**: A demo simulator for merchant-side transactions.

### 4. UI/UX Standards (Refer to `DESIGN.md`)
-   **Color Palette**: Primary `#00857A` (Hana Green).
-   **Layout**: Desktop-first, dark sidebar (`#0F3B34`), light content canvas.
-   **Tone**: Professional, trustworthy, and disciplined. Avoid excessive "playful" elements.

### 5. AI Integration Guidelines
AI should only be used for:
-   Suggesting categories or risk scores.
-   Generating summaries or reasonings for humans to review.
-   Summarizing operational patterns.
AI **must not** have final approval authority.

---

## Critical Files
-   `prisma/schema.prisma`: The source of truth for the data model.
-   `lib/policyEngine.ts`: Core business logic for budget execution.
-   `docs/skills/hana-budget/SKILL.md`: Detailed AI behavioral guidelines for this specific project.
-   `DESIGN.md`: Visual and interaction design specifications.
-   `hana_budget_upgrade_tasks.md`: Current roadmap and pending tasks.

---

## Instruction Precedence
The instructions in **`docs/skills/hana-budget/SKILL.md`** take absolute precedence for any AI-driven code generation or modifications in this repository. Always read it before starting a new task.
