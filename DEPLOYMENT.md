# HobbyFi Copilot Deployment Guide

This document outlines the architecture, requirements, and steps to deploy the HobbyFi Copilot application in a production environment.

## 1. Architecture Overview

The system consists of three main components (Turborepo Monorepo):
1. **Database (`packages/db`)**: PostgreSQL database using Prisma ORM. Provides isolated data access patterns (`copilotVendorDb`) to enforce KYC/PII guardrails at the database layer.
2. **Mastra Agent Server (`apps/mastra`)**: A Node.js Express server running the Mastra framework. It hosts the LLM integration (Gemini 2.0 Flash), orchestrates tools, handles chat memory, and exposes the HTTP API.
3. **Vendor Portal (`apps/portal`)**: A Next.js 14 (App Router) web application serving as the UI.

## 2. Prerequisites

- **Node.js**: v20 or higher
- **Package Manager**: pnpm (`npm install -g pnpm`)
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+ (for Mastra memory/sessions, though optional if using local filesystem dev adapters)
- **API Keys**: Google Gemini API key (`GOOGLE_GENERATIVE_AI_API_KEY`)

## 3. Environment Variables

Create a `.env` file at the root (or configure your CI/CD secrets) with the following:

```env
DATABASE_URL="postgresql://user:password@host:5432/hobbyfi_copilot?schema=public"
REDIS_URL="redis://host:6379"
GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-api-key"
PORTAL_SESSION_SECRET="production-secure-secret-string"
MASTRA_URL="https://api.yourdomain.com/copilot" # Used by Portal to connect to Mastra
PORTAL_ORIGIN="https://portal.yourdomain.com" # Used by Mastra for CORS
```

## 4. Build Process

The project uses Turborepo for efficient building.

```bash
# 1. Install dependencies
pnpm install

# 2. Run Prisma migrations to prepare the database schema
cd packages/db
npx prisma migrate deploy
npx prisma generate

# 3. Build all apps (Portal and Mastra)
cd ../../
pnpm build
```

## 5. Deployment Options

### Option A: Dockerized (Recommended)

You can containerize both applications. (Dockerfile creation pending in next phase).
1. Build images for `apps/portal` and `apps/mastra`.
2. Deploy to a container orchestration service like Google Cloud Run, AWS ECS, or Kubernetes.
3. Use managed PostgreSQL (e.g., Cloud SQL, RDS) and managed Redis (e.g., Memorystore, ElastiCache).

### Option B: Vercel + Render/Railway

1. **Database**: Provision PostgreSQL on Supabase or Neon.
2. **Portal**: Deploy `apps/portal` directly to Vercel (Root Directory: `apps/portal`, Framework Preset: Next.js).
3. **Mastra**: Deploy `apps/mastra` to a Node.js hosting platform like Render, Railway, or Heroku, as Mastra runs as a long-lived Node.js process (Express server).

## 6. Security and Compliance

- **KYC Isolation**: The `copilotVendorDb` client explicitly drops PAN, Bank Account, and GST fields using Prisma's `omit` configuration. Ensure production code never imports the raw `prisma` client inside tool logic.
- **Audit Logging**: Every Write operation proposed by the AI is logged into the `copilot_audit_log` table with a `proposed` status. It requires an explicit user `/approve` request to be executed.
- **Prompt Guardrails**: Input/Output processors are active on the `/api/chat` route to detect prompt injections and scrub accidental PII leaks.

## 7. Scaling

- The **Mastra server** can be scaled horizontally. It is stateless regarding tools but relies on Redis (or Postgres) for conversation history memory.
- The **Portal** is a standard Next.js app and scales easily on Vercel/CDNs.
