<div align="center">
  <h1>🚀 HobbyFi Copilot</h1>
  <p>An intelligent AI-powered copilot and portal for managing the HobbyFi ecosystem.</p>

  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white" />
</div>

<br />

## 🌟 Overview

HobbyFi Copilot is a comprehensive monorepo containing the intelligence and interface for the HobbyFi platform. It uses AI tools (via Mastra) to provide analytics, handle bookings, manage memberships, and assist users seamlessly through a natural language interface.

## 🏗️ Project Structure

This project is built as a monorepo using `pnpm` workspaces.

- **`apps/portal`**: The Next.js frontend web application serving the Copilot Chat UI and analytics dashboards.
- **`apps/mastra`**: The AI agent backend containing the Tool Registry, Audit Services, and workflow logic for fetching live data and making changes.
- **`packages/db`**: A shared database package using Prisma ORM to provide type-safe database access across all apps.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- [pnpm](https://pnpm.io/) (v10)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/po0mpomm/HobbyFi_Copilot.git
   cd HobbyFi_Copilot
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   Copy `.env.example` to `.env` in the root directory and fill in the required keys (like Database connection string and AI API keys):
   ```bash
   cp .env.example .env
   ```

4. **Initialize the database:**
   Sync the database schema:
   ```bash
   pnpm db:push
   ```
   *(Optional)* Seed the database with initial data:
   ```bash
   pnpm seed
   ```

### Running the App

Start all applications simultaneously in development mode:

```bash
pnpm dev
```

- **Portal** is accessible at `http://localhost:3000` (by default)

## 🛠️ Available Scripts

From the root of the project, you can run:

- `pnpm dev` - Starts the development servers for all apps in parallel.
- `pnpm db:push` - Pushes Prisma schema changes to the database.
- `pnpm db:studio` - Opens Prisma Studio to browse and manage your database graphically.
- `pnpm seed` - Runs the database seeding script.

## 🤖 Copilot Features

The Copilot is equipped with various tools to manage your platform:
- **Analytics:** Fetch MRR snapshots, revenue metrics, and payout summaries.
- **Operations:** Read occupancy, coach schedules, and vendor statuses.
- **Management:** Find users, manage trial extensions, handle no-shows, and membership updates.

---
<div align="center">
  <i>Built with ❤️ for the HobbyFi community.</i>
</div>
