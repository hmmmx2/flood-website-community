# flood-website-community

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38bdf8?logo=tailwind-css)
![PWA](https://img.shields.io/badge/PWA-Web_Push-orange?logo=pwa)
![License](https://img.shields.io/badge/license-MIT-green)

**Public community portal for FloodWatch — where Sarawak residents stay informed and connected during flood events.**

## Overview

`flood-website-community` is a Next.js 14 progressive web application (PWA) designed for the general public. Residents can register, browse community posts, join groups, read safety information and blog articles, and subscribe to real-time flood alert push notifications. The portal communicates exclusively with `flood-service-community` (port 4001) through server-side API proxy routes, keeping backend credentials out of the browser.

Web Push notifications (VAPID) allow users to receive flood alerts even when the browser tab is closed, making this a critical last-mile communication tool for at-risk communities.

## Features

- **Community feed** — browse, create, like, and comment on community posts from fellow residents
- **Groups** — join and participate in location-based or topic-based community groups
- **Blog** — read official articles and updates from flood management authorities
- **Safety information** — dedicated safety guide screen with emergency procedures and evacuation tips
- **Push notifications (PWA/VAPID)** — subscribe to browser push notifications for real-time flood alerts
- **Sensor data view** — check the latest readings from nearby sensor nodes
- **Favourites** — bookmark sensor nodes of interest for quick access
- **User authentication** — full JWT-based registration, login, forgot password, and reset password flows
- **Responsive design** — mobile-first layout with a collapsible navigation bar
- **Server-side caching** — Upstash Redis used in API routes to reduce backend load

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14 (App Router) | React framework & API proxy |
| TypeScript | 5 | Static typing |
| Tailwind CSS | 3 | Utility-first styling |
| Web Push API (VAPID) | — | Browser push notifications |
| Upstash Redis | — | Server-side response caching |
| Node.js | ≥ 18 | Runtime |

## Architecture

```
flood-website-community  (:3002)
        │  Next.js API routes (server-side proxy)
        │  + Upstash Redis caching layer
        │
        └──────────────────────► flood-service-community  (:4001)
                                    Spring Boot 3 / PostgreSQL / Redis
```

The CRM dashboard (`flood-website-crm`) can redirect administrators to this portal, and the community portal's login page links back to the CRM for operations staff.

## Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x (or pnpm / yarn)
- `flood-service-community` running on port 4001
- An [Upstash Redis](https://upstash.com) database (free tier is sufficient for development)
- VAPID key pair for push notifications (see below)

### Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Copy the public key into `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and provide the private key to `flood-service-community` as `VAPID_PRIVATE_KEY`.

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-org/floodwatch.git
cd floodwatch/flood-website-community
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in the required values (see [Environment Variables](#environment-variables) below).

### 3. Start the development server

```bash
npm run dev
```

The app is available at [http://localhost:3002](http://localhost:3002).

> **Tip:** By default Next.js uses port 3000. To run on 3002 alongside the CRM, start with:
> ```bash
> npm run dev -- -p 3002
> ```
> Or add `"dev": "next dev -p 3002"` to `package.json` scripts.

### 4. Production build

```bash
npm run build
npm start
```

## Environment Variables

Copy `.env.example` to `.env.local` and set the following:

| Variable | Description | Example |
|---|---|---|
| `JAVA_API_URL` | Server-side URL for `flood-service-community` (used by API routes) | `http://localhost:4001` |
| `NEXT_PUBLIC_JAVA_API_URL` | Browser-side URL for direct auth calls | `http://localhost:4001` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint for server-side caching | `https://us1-xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | `AXxx...` |
| `NEXT_PUBLIC_CRM_URL` | URL of the CRM dashboard (for admin redirects) | `http://localhost:3000` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key for Web Push subscriptions | `BKxx...` |

> **Note:** Never commit `.env.local` to version control. The VAPID private key should only live in `flood-service-community`.

## API Endpoints (Next.js proxy routes)

These Next.js API routes proxy requests to `flood-service-community`.

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new community user | Public |
| `POST` | `/api/auth/login` | Authenticate user, receive JWT | Public |
| `POST` | `/api/auth/forgot-password` | Request password-reset code via email | Public |
| `POST` | `/api/auth/verify-reset-code` | Verify the reset code | Public |
| `POST` | `/api/auth/reset-password` | Set new password with valid code | Public |
| `GET` | `/api/auth/profile` | Fetch current user profile | JWT |
| `PUT` | `/api/auth/profile` | Update user profile | JWT |
| `POST` | `/api/auth/refresh` | Refresh JWT access token | JWT (refresh token) |
| `POST` | `/api/auth/change-password` | Change authenticated user's password | JWT |
| `GET` | `/api/posts` | List community posts (paginated) | Public |
| `POST` | `/api/posts` | Create a new community post | JWT |
| `GET/PUT/DELETE` | `/api/posts/[id]` | Get, update, or delete a post | JWT (owner/admin) |
| `GET` | `/api/groups` | List community groups | Public |
| `POST` | `/api/groups` | Create a new group | JWT |
| `GET/PUT/DELETE` | `/api/groups/[slug]` | Get, update, or delete a group | JWT (owner/admin) |
| `GET` | `/api/blogs` | List published blog articles | Public |
| `GET` | `/api/blogs/featured` | List featured blog articles | Public |
| `GET` | `/api/blogs/[id]` | Get a single blog article | Public |
| `GET` | `/api/sensors` | List sensor nodes with latest readings | Public |
| `GET/POST` | `/api/favourites` | List or add favourite sensor nodes | JWT |
| `DELETE` | `/api/favourites/[nodeId]` | Remove a favourite node | JWT |
| `POST` | `/api/push/subscribe` | Register a push notification subscription | JWT |
| `GET` | `/api/health` | Service health check | Public |

## Project Structure

```
flood-website-community/
├── app/
│   ├── api/                    # Next.js API route handlers (server-side proxy)
│   │   ├── auth/               # Register, login, profile, refresh, reset password
│   │   ├── posts/              # Community posts
│   │   ├── groups/             # Community groups
│   │   ├── blogs/              # Blog articles
│   │   ├── sensors/            # Sensor node data
│   │   ├── favourites/         # Favourited nodes
│   │   ├── push/               # Push subscription endpoint
│   │   └── health/             # Health check
│   ├── blog/                   # Blog list and detail pages
│   │   └── [id]/               # Single blog post
│   ├── g/[slug]/               # Group detail page
│   ├── post/                   # Community post pages
│   ├── sensors/                # Sensor data page
│   ├── settings/               # User settings page
│   ├── login/                  # Login page
│   ├── register/               # Registration page
│   ├── forgot-password/        # Forgot-password page
│   ├── reset-password/         # Password-reset page
│   ├── auth/callback/          # Auth callback handler
│   ├── layout.tsx              # Root layout (auth context, navbar)
│   ├── page.tsx                # Home / community feed
│   └── globals.css             # Global styles
├── components/                 # Reusable UI components (Navbar, PostCard, etc.)
├── lib/                        # API client, auth helpers, push subscription utils
├── public/                     # Static assets & PWA icons
├── .env.example                # Environment variable template
├── .env.local                  # Local secrets (git-ignored)
├── next.config.ts              # Next.js configuration
├── tailwind.config.*           # Tailwind CSS configuration
├── Dockerfile                  # Production container
└── package.json
```

## Docker

The service is included in the project-wide `deploy/docker-compose.yml`. To run it in isolation:

```bash
# Build the image
docker build -t floodwatch-community .

# Run with environment variables
docker run -p 3002:3002 \
  -e JAVA_API_URL=http://host.docker.internal:4001 \
  -e NEXT_PUBLIC_JAVA_API_URL=http://localhost:4001 \
  -e UPSTASH_REDIS_REST_URL=https://your-db.upstash.io \
  -e UPSTASH_REDIS_REST_TOKEN=your_token \
  -e NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key \
  floodwatch-community
```

To run the full stack (recommended):

```bash
cd ../deploy
cp .env.example .env
# Edit .env with real values
docker compose up -d
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create optimised production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Contributing

1. Fork the repository and create a feature branch: `git checkout -b feat/your-feature`
2. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/)
3. Push and open a Pull Request against `main`
4. Ensure all lint checks pass before requesting review

## License

This project is licensed under the [MIT License](../LICENSE).

---

Part of the **FloodWatch** flood monitoring system for Sarawak, Malaysia.
