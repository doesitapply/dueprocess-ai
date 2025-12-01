# DueProcess AI: Evidence to Action

**Where Legal Proceedings Go to Get Resurrected**

DueProcess AI is an AI-powered legal warfare platform designed to empower pro se litigants, civil rights activists, and legal researchers in their fight against institutional corruption. The system deploys fifteen specialized AI agents across six tactical sectors to analyze evidence, identify patterns of misconduct, pierce immunity defenses, and generate court-ready legal documents with full citations and step-by-step reasoning.

---

## Table of Contents

1. [Overview](#overview)
2. [Core Philosophy](#core-philosophy)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Installation](#installation)
6. [Configuration](#configuration)
7. [Usage](#usage)
8. [Deployment](#deployment)
9. [Documentation](#documentation)
10. [Contributing](#contributing)
11. [License](#license)

---

## Overview

### The Problem

Modern civil rights litigation faces three fundamental barriers. First, qualified immunity shields government officials from accountability by requiring plaintiffs to identify "clearly established" precedent with near-identical facts—a standard that effectively immunizes novel forms of misconduct. Second, federal courts routinely abstain from hearing constitutional claims through doctrines like Younger abstention, forcing litigants into state courts that may be hostile or complicit. Third, pro se litigants lack access to expensive legal research tools and the expertise to navigate complex procedural requirements, creating a justice gap that disproportionately affects marginalized communities.

### The Solution

DueProcess AI addresses these barriers through three core innovations. The platform's fifteen specialized AI agents analyze uploaded documents to identify immunity exceptions, abstention bypasses, and constitutional violations with full case law citations. The swarm processing system enables parallel execution of multiple agents simultaneously, generating comprehensive multi-agent reports that would require dozens of hours of manual legal research. The pattern recognition engine identifies systemic corruption across cases, transforming isolated incidents into evidence of deliberate indifference that pierces qualified immunity and establishes municipal liability under Monell v. Department of Social Services.

### Key Features

The platform organizes its capabilities into six tactical sectors. **Tactical Ops** deploys three agents specialized in immunity piercing, abstention destruction, and discovery warfare. **Intel Center** provides deep legal research through agents that mine case law precedents, scan federal and state statutes, and identify judicial ethics violations. **Legal Arsenal** offers constitutional analysis with agents covering First, Fourth, Fifth, Sixth, and Fourteenth Amendment violations, Brady prosecutorial misconduct, and Section 1983 civil rights claims. **Evidence Lab** performs forensic analysis through pattern recognition across cases, timeline construction with causal chains, and contradiction detection in official statements. **Offensive Ops** generates court-ready documents including TRO and preliminary injunction motions, federal complaints meeting Twombly/Iqbal plausibility standards, and viral content for public pressure campaigns. **Corpus Center** serves as the central evidence repository, providing document upload, search, tagging, and organization capabilities that feed all other sectors.

---

## Core Philosophy

### Dark Satirical Messaging

DueProcess AI employs aggressive empowerment messaging designed to resonate with whistleblowers, activists, and pro se litigants fighting institutional corruption. The platform's taglines reflect this philosophy: "Immunity protects you from lawsuits. Not from patterns." "They wrote the rules. We memorized them." "One case is an accident. A hundred is a system." This messaging strategy acknowledges the power imbalance inherent in civil rights litigation while providing users with tactical tools to level the playing field.

### Evidence-Based Warfare

Every agent output includes full case law citations in Bluebook format, statutory references with section numbers, and step-by-step reasoning that explains legal conclusions. This approach transforms AI analysis from black-box predictions into transparent legal arguments that users can verify, modify, and present in court. The system prioritizes free legal resources including Justia, CourtListener, and Cornell Legal Information Institute to ensure accessibility for users without Westlaw or LexisNexis subscriptions.

### Pattern Recognition as Strategy

The platform's most powerful capability lies in its ability to identify patterns of misconduct across multiple cases, actors, and time periods. This approach directly addresses the qualified immunity doctrine's "clearly established law" requirement by demonstrating that officials engaged in systematic violations rather than isolated mistakes. Pattern evidence also establishes municipal liability under Monell by showing that constitutional violations resulted from official policy, custom, or deliberate indifference to known risks.

---

## Technology Stack

### Frontend Architecture

The client application is built with React 19, leveraging the latest concurrent rendering features for responsive UI updates during long-running agent processing. TypeScript provides compile-time type safety across the entire codebase, catching errors before deployment and enabling intelligent code completion. Tailwind CSS 4 implements a utility-first styling approach with OKLCH color space for perceptually uniform color palettes across the dark-themed interface. The shadcn/ui component library provides accessible, customizable UI primitives built on Radix UI primitives. Wouter handles client-side routing with a minimal footprint, while tRPC React Query manages server state with automatic caching, optimistic updates, and background refetching.

### Backend Architecture

The server runs on Node.js 22 with Express 4 handling HTTP requests and middleware. tRPC 11 provides end-to-end type-safe APIs without code generation, ensuring that frontend and backend types stay synchronized automatically. Drizzle ORM manages database queries with a TypeScript-first approach that generates types from schema definitions. MySQL 8 or TiDB Cloud serves as the relational database, with TiDB offering distributed SQL capabilities for horizontal scaling. Manus OAuth implements industry-standard OAuth 2.0 authentication with JWT session management. Stripe integration handles subscription billing and payment processing for premium tiers.

### AI Integration

The platform integrates with Manus Forge API for LLM inference, providing OpenAI-compatible chat completion endpoints with streaming support. Agent prompts utilize structured outputs with JSON schema validation to ensure consistent response formats. The system supports parallel agent execution through Promise.all patterns, enabling swarm processing that runs multiple agents simultaneously against the same document. All LLM interactions include explicit citation requirements and step-by-step reasoning instructions to maintain output quality and verifiability.

---

## Architecture

### System Components

The application follows a three-tier architecture with clear separation of concerns. The presentation layer consists of React components organized by feature, with shared UI components in the components directory and page-level components in the pages directory. The business logic layer implements tRPC routers that define API endpoints, validate inputs using Zod schemas, and orchestrate database queries and LLM calls. The data layer uses Drizzle ORM to interact with MySQL, with schema definitions in TypeScript that generate both database migrations and TypeScript types.

### Data Flow

User interactions trigger tRPC mutations that execute on the server. File uploads flow through a dedicated upload router that validates file types, stores files in S3 using the storage module, and saves metadata to the documents table. Agent processing requests retrieve document content from S3, construct prompts using agent configurations from agentConfig.ts, invoke the LLM through the llm module, and store outputs in the agent_outputs table. Swarm processing creates a swarm_sessions record, executes multiple agents in parallel, stores individual outputs in swarm_outputs, and updates the session status upon completion.

### Database Schema

The users table stores authentication data with openId from Manus OAuth, role for access control, and timestamps for account activity tracking. The documents table maintains file metadata including userId foreign key, fileUrl and fileKey for S3 references, mimeType and fileSize for validation, and createdAt timestamp. The agent_outputs table links documentId and userId to agentId and sector, storing the markdown output and creation timestamp. The swarm_sessions table tracks multi-agent processing with documentId, userId, sector, status enum, and completion timestamps. The swarm_outputs table connects swarmSessionId to agentId with individual agent outputs and timestamps.

---

## Installation

### Prerequisites

The development environment requires Node.js version 22 or higher for ES modules and modern JavaScript features. Package management uses pnpm version 9 or higher for efficient dependency resolution and disk space usage. Database options include MySQL 8 for local development or TiDB Cloud for production deployments. Authentication and AI services require a Manus account with OAuth credentials and Forge API keys.

### Local Development Setup

Clone the repository and navigate to the project directory. Install dependencies using pnpm install, which reads the pnpm-lock.yaml file to ensure consistent versions across environments. Copy the .env.example file to .env and populate it with your credentials for database connection, Manus OAuth, Forge API, and optionally Stripe. Push the database schema using pnpm db:push, which applies migrations from the drizzle directory to your database. Start the development server with pnpm dev, which runs both the Vite frontend dev server and the Express backend with hot reload enabled. The application will be available at http://localhost:3000 with automatic browser refresh on code changes.

### Environment Variables

The DATABASE_URL variable should contain a MySQL connection string in the format mysql://user:password@host:port/database. For TiDB Cloud, use the connection string provided in your cluster dashboard with SSL enabled. The VITE_APP_ID, OAUTH_SERVER_URL, and VITE_OAUTH_PORTAL_URL variables configure Manus OAuth integration, with values obtained from your Manus application dashboard. The JWT_SECRET should be a random string of at least 32 characters for session cookie signing. The BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY variables enable LLM integration through Manus Forge, with separate frontend and backend keys for security. Stripe variables including STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and VITE_STRIPE_PUBLISHABLE_KEY are optional and only required if enabling payment features.

---

## Configuration

### Agent Configuration

The agentConfig.ts file defines all fifteen agents with their system prompts, capabilities, and dark humor taglines. Each agent configuration includes an id for database references, a name for display, a division assignment (research, analysis, tactical, evidence, or offensive), a description of primary functions, a systemPrompt with detailed instructions including citation requirements and reasoning steps, a capabilities array listing specific skills, and a darkHumorTagline for UI display. Modifying agent prompts requires editing the systemPrompt field and restarting the server to reload configurations.

### Database Migrations

Drizzle ORM manages schema changes through migration files in the drizzle directory. To add new tables or columns, edit drizzle/schema.ts with the desired changes using Drizzle's schema definition syntax. Generate migration files using pnpm db:generate, which creates SQL files in the drizzle directory. Apply migrations to the database using pnpm db:push, which executes pending migrations in order. For production deployments, use pnpm db:migrate to apply migrations with transaction safety and rollback support.

### Stripe Integration

Payment processing requires creating products and prices in the Stripe dashboard. Copy the price IDs into server/products.ts in the STRIPE_PRODUCTS array, ensuring each product includes id, name, description, priceId, and price fields. Configure webhook endpoints in the Stripe dashboard pointing to your deployment URL plus /api/stripe/webhook. The webhook handler in server/stripeWebhook.ts processes subscription lifecycle events including checkout.session.completed, customer.subscription.created, customer.subscription.updated, and customer.subscription.deleted. Test webhooks locally using the Stripe CLI with stripe listen --forward-to localhost:3000/api/stripe/webhook.

---

## Usage

### Document Upload

Navigate to the Corpus Center sector from the dashboard. The upload interface supports drag-and-drop or click-to-browse file selection. Supported formats include PDF for court documents and legal filings, DOCX for Word documents, TXT for plain text, MP3/WAV/M4A/WebM for audio recordings, and MP4/WebM for video files. The system validates file types and enforces a 100MB size limit per file. Upon upload, files are stored in S3 with metadata saved to the database including filename, MIME type, file size, and upload timestamp. Uploaded documents appear in the Corpus Center library with search and filter capabilities.

### Individual Agent Processing

Select a tactical sector based on your analysis needs. Tactical Ops focuses on immunity piercing and abstention bypass strategies. Intel Center provides deep legal research across case law, statutes, and ethics codes. Legal Arsenal analyzes constitutional violations and civil rights claims. Evidence Lab performs pattern recognition and timeline construction. Offensive Ops generates motions and complaints. Within the sector, click an agent card to open the processing interface. Select a document from the dropdown menu populated from Corpus Center. Click the agent-specific action button such as "Engage Tactical Analysis" or "Deploy Research Protocol". The system retrieves document content, constructs the agent prompt with citation requirements, invokes the LLM, and displays the output with markdown formatting including tables, citations, and step-by-step reasoning.

### Swarm Processing

Swarm processing executes all agents within a sector simultaneously against a single document. From any sector page, select a document from the swarm processing dropdown at the top of the page. Click the "Deploy [Sector] Swarm" button to initiate parallel processing. The interface displays real-time progress indicators for each agent in the swarm. Upon completion, the system shows a unified report with tabbed navigation between agent outputs. Swarm sessions are saved to the database with links to individual agent outputs, enabling users to review past analyses and compare results across documents.

### Export and Sharing

Agent outputs display in markdown format with copy-to-clipboard functionality. Users can copy individual agent outputs or entire swarm reports for pasting into legal documents. Future releases will support PDF export with formatting preservation, DOCX export for editing in Microsoft Word, and shareable links with access controls for collaboration.

---

## Deployment

### Manus Platform Deployment

The Manus platform provides the simplest deployment path with integrated hosting, authentication, and AI services. From the Manus interface, create a checkpoint using the webdev_save_checkpoint command or through the UI. Open the Management UI panel on the right side of the interface. Click the "Publish" button in the header to deploy the application. The platform automatically provisions a subdomain at your-app.manus.space with HTTPS enabled. Custom domains can be configured in Settings → Domains by adding DNS records as instructed. The platform handles environment variable management, database connections, and scaling automatically.

### Vercel Deployment

Vercel offers serverless deployment with automatic scaling and global CDN distribution. Install the Vercel CLI using npm install -g vercel. Run vercel in the project directory to create a new project and deploy to a preview URL. Configure environment variables in the Vercel dashboard under Settings → Environment Variables, adding all variables from your .env file. Set the DATABASE_URL to point to your production database with SSL enabled. Update OAuth callback URLs in the Manus dashboard to include your Vercel deployment URL. Run vercel --prod to deploy to production with your custom domain.

### Railway Deployment

Railway provides container-based deployment with integrated databases and automatic HTTPS. Install the Railway CLI using npm install -g @railway/cli. Run railway login to authenticate with your Railway account. Execute railway init to create a new project and link it to your repository. Add environment variables using railway variables set KEY=value for each required variable. Railway can provision a MySQL database automatically through the dashboard, which sets DATABASE_URL automatically. Deploy using railway up, which builds a Docker container and deploys it with automatic scaling.

### Self-Hosted Docker Deployment

For self-hosted deployments, create a Dockerfile in the project root. Use the Node.js 22 Alpine image as the base for minimal container size. Copy package files and run pnpm install with --frozen-lockfile to ensure reproducible builds. Copy the application code and run pnpm build to generate production assets. Expose port 3000 and set the start command to pnpm start. Build the image using docker build -t dueprocess-ai. Run the container with docker run -p 3000:3000 --env-file .env dueprocess-ai, mounting the .env file for configuration. For production deployments, use Docker Compose to orchestrate the application container, MySQL database, and optional Redis cache.

---

## Documentation

### Complete Documentation Suite

The docs directory contains comprehensive documentation covering all aspects of the platform. The USER_GUIDE.md provides step-by-step instructions for uploading documents, running agents, and interpreting outputs with screenshots and workflow diagrams. The TECHNICAL_SPECIFICATION.md details the system architecture, API endpoints, database schema, and integration points for developers. The WHITEPAPER.md presents the theoretical foundation for AI-powered legal warfare, including immunity-piercing strategies, abstention bypass techniques, and pattern recognition methodologies with case law citations.

### Agent Registry

The AGENT_REGISTRY.md document catalogs all fifteen agents with detailed descriptions of their capabilities, system prompts, and use cases. Each agent entry includes the division assignment, primary functions, immunity-piercing strategies, abstention bypass approaches, citation requirements, and example outputs. This registry serves as a reference for users selecting agents and for developers adding new agent capabilities.

### API Reference

The API_REFERENCE.md provides complete documentation of all tRPC endpoints with request/response schemas, authentication requirements, and example code. Endpoints are organized by router including auth for authentication, documents for file management, agents for processing, swarms for parallel execution, and upload for file uploads. Each endpoint includes TypeScript type definitions, Zod validation schemas, and curl examples for testing.

---

## Contributing

### Development Workflow

Contributors should fork the repository and create feature branches from main. Branch names should follow the convention feature/description for new features, fix/description for bug fixes, and docs/description for documentation updates. Make changes with clear, focused commits following conventional commit format such as feat: add timeline visualization or fix: resolve swarm processing race condition. Run the test suite using pnpm test to ensure no regressions. Execute type checking with pnpm typecheck to catch TypeScript errors. Run the linter with pnpm lint to enforce code style. Push the branch and create a pull request with a description of changes, motivation, and testing performed.

### Code Standards

All new code must use TypeScript with explicit type annotations for function parameters and return values. Follow existing naming conventions with camelCase for variables and functions, PascalCase for components and types, and SCREAMING_SNAKE_CASE for constants. Add JSDoc comments for public APIs including parameter descriptions, return value documentation, and usage examples. Write tests for new features using Vitest, covering both happy paths and error cases. Update documentation when adding features or changing behavior.

### Adding New Agents

To add a new agent, first define the agent configuration in server/agentConfig.ts including id, name, division, description, systemPrompt with citation requirements, capabilities array, and darkHumorTagline. Add the agent to the appropriate division in the AGENTS array. Update the sector-to-division mapping in getAgentsBySector if creating a new division. Create UI components for the agent card in the relevant sector page. Add the agent to swarm processing by including it in the sector's agent list. Write tests for the agent's prompt construction and output parsing. Update AGENT_REGISTRY.md with the new agent's documentation.

---

## License

DueProcess AI is released under the MIT License, permitting commercial and non-commercial use, modification, and distribution with attribution. The license text is available in the LICENSE file in the repository root. Contributors retain copyright to their contributions while granting the project maintainers a perpetual license to use, modify, and distribute the code.

---

## Acknowledgments

DueProcess AI builds upon the work of civil rights organizations, legal aid societies, and pro se litigants who have fought for justice despite systemic barriers. The platform's immunity-piercing strategies draw from decades of civil rights litigation documented in cases like Harlow v. Fitzgerald, Hope v. Pelzer, and Monell v. Department of Social Services. The abstention bypass techniques synthesize approaches from federal courts scholarship and practitioner guides. The pattern recognition methodology reflects insights from data journalism, investigative reporting, and academic research on police misconduct and prosecutorial abuse.

The technical implementation leverages open-source projects including React, TypeScript, Tailwind CSS, tRPC, Drizzle ORM, and many others maintained by volunteer developers worldwide. The Manus platform provides the infrastructure for authentication, AI services, and deployment that makes this project possible. Special thanks to the legal tech community for sharing tools, techniques, and knowledge that advance access to justice.

---

## Contact and Support

For bug reports and feature requests, open an issue on the GitHub repository with a clear description, steps to reproduce, and expected versus actual behavior. For security vulnerabilities, email security@dueprocess.ai with details and allow 90 days for patching before public disclosure. For general questions and discussions, join the community forum or Discord server linked in the repository. For commercial support and custom deployments, contact enterprise@dueprocess.ai.

---

**Built by whistleblowers, for whistleblowers. Know your rights. Fight corruption.**
