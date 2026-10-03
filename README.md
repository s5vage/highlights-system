# Highlights System (v2.0)

Personal knowledge system — dashboard shell with a browser-style tab system.
Click a module tile on the Home screen to open it in its own tab, just like
opening tabs in a browser.

## Current state (v2.0, step 1)

This is the **foundation only**:
- Dashboard home with module tiles
- Tab system (open, switch, close tabs)
- Supabase client wired up and ready
- Placeholder screens for each module — real functionality gets built into
  each one, one at a time, in later steps

Modules included (all placeholders for now, except the shell itself):
- Highlights
- Notes
- Canvas
- Graph
- Settings
- Trash

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy the env template and fill in your real Supabase values:
   ```
   cp .env.local.example .env.local
   ```
   Then edit `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   ```

3. Run the dev server:
   ```
   npm run dev
   ```
   Open http://localhost:3000

## Deploying

This project is meant to be connected to GitHub, with GitHub connected to
Vercel for automatic deploys on every push — not drag-and-drop uploads.
See the setup walkthrough for exact steps.

When connecting to Vercel, add the same two environment variables from
`.env.local` in the Vercel project's Settings → Environment Variables,
since `.env.local` itself is never committed to git.

## Project structure

```
src/
  app/
    page.tsx          -> dashboard shell (tabs + home), the entry point
    layout.tsx
    globals.css
  components/
    DashboardHome.tsx -> the grid of module tiles
    TabBar.tsx         -> the browser-style tab bar
  modules/
    PlaceholderModule.tsx -> shown for modules not yet built
    (real modules get added here one at a time)
  lib/
    supabase.ts        -> Supabase client (reads from env vars)
    modules.ts          -> registry of all dashboard modules/tiles
    types.ts            -> shared TypeScript types
```

## Build roadmap

1. ✅ Dashboard shell + tab system (this step)
2. Auth + Row Level Security on Supabase
3. Real-time sync
4. Highlights module (wire in the existing 97 highlights)
5. Notes module (Tiptap rich text)
6. Organization layer (folders, pinned, command palette)
7. Linking + graph view
8. Canvas module (tldraw)
9. Reliability + export (version history, offline, PDF export)
10. AI features (summarize, auto-tag, ask-your-notes)

iPad-only features (Pencil drawing, handwriting OCR, Scribble) get added
once the iPad is available to test against.
