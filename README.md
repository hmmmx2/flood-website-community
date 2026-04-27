# Flood Community Portal

Next.js public-facing community website for the Flood Monitoring System. Allows users to register, browse flood alerts and updates, read blogs, and manage push notification preferences.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS v4**
- **TypeScript**

## Prerequisites

- Node.js 20+
- pnpm 9+

## Setup

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd flood-community
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Fill in JAVA_API_URL, NEXT_PUBLIC_JAVA_API_URL, NEXT_PUBLIC_VAPID_PUBLIC_KEY
   ```

4. **Run the dev server**
   ```bash
   pnpm dev
   ```

   The site starts on **http://localhost:3002**

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server on port 3002 |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |

## Project Structure

```
app/
  layout.tsx          # Root layout with navbar
  page.tsx            # Home page (community feed)
  login/              # Login page
  blog/               # Blog listing and detail pages
  post/               # Post detail page
  settings/           # User settings (notifications)
  api/                # Next.js API routes (proxy to Java backend)
    auth/             # Auth proxy routes
    push/             # Web push subscription routes
components/
  PostCard.tsx        # Community post card
  CreatePostModal.tsx # Create new post modal
  Footer.tsx          # Footer
lib/
  auth.ts             # Session management
  javaApi.ts          # Java backend API client
  pushNotifications.ts # Web push / VAPID utilities
  types.ts            # TypeScript types
public/
  sw.js               # Service Worker for push notifications
```

## Environment Variables

See `.env.example` for all required variables.
