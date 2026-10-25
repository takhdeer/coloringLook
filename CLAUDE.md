# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ColoringLook: a group colouring game. A group gets a picture. The server pixelates it into a grid with a small palette, and each palette colour is assigned to one group member. Players match photo colours to the palette (the "photo uploader" flow) to fill in their cells. Stack: React 19 + Vite frontend (`src/`), Express 5 API (`server/`), with Supabase for auth and storage and its Postgres reached directly via `pg`.

## Commands

The package manager is Bun (`bun.lock`; the `dev` script calls `bun run`), though a `package-lock.json` also exists.

- `bun run dev`: starts the Vite client and the API server (`nodemon server/index.js`, port 3001) together
- `bun run client` / `bun run server`: start either one on its own
- `bun run build`: production build with Vite
- `bun run lint`: ESLint. **It currently fails to load** because `eslint.config.js` uses ESM `import` while `package.json` has `"type": "commonjs"`. The config also applies browser globals to every `.js` file, including the CommonJS server code.

There is no test suite. Useful manual checks: `GET /api/health`, and `GET /db-test` to check the Postgres connection.

## Environment

There are two separate `.env` files, and both are gitignored:
- **Root `.env`** is read by Vite: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `FRONTEND_URL`
- **`server/.env`** is loaded explicitly by `server/index.js`: `DATABASE_URL` (Supabase Postgres, SSL with cert verification off), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optionally `PORT`

## Structure

```
server/
  index.js            # Express app, mounts every /api route
  db.js               # shared pg Pool
  lib/                # supabase.js, pixelate.js (image → grid), groupGame.js (group grids, colour owners)
  routes/             # login.js, register.js, pixelate.js
    groups/           # createGroup, deleteGroup, joinGroup, getUserGroup, leaderboard
    auth/             # old login/register copies: NOT mounted
src/
  main.jsx, App.jsx   # entry + react-router routes
  lib/supabase.mjs    # client Supabase client
  components/         # ViewGroups, createGroup, joinGroup (each with a .css file)
  pages/              # Landing, Login, Signup, Dashboard, Play, PlayPicture, PlayPictureGrid, PlayMembersColumn (each with a .css file)
public/               # static assets
```

## Architecture

**Server (CommonJS).** `server/index.js` mounts one router per endpoint under `/api/<name>`. Routes in `server/routes/groups/` run raw SQL through the shared `pg` pool (`server/db.js`) against `public.groups`, `public.group_members` (with `score` and `colors text[]` of hex codes), `public.users`, `public.images` (with `path` into the Supabase Storage bucket `images`, plus `palette`) and `public.group_image`.
- Auth goes through Supabase Auth on the server (`supabase.auth.signUp` / `signInWithPassword`). Register also inserts a row into `public.users` with the same id as the auth user. The login response returns tokens, and the client passes them to `supabase.auth.setSession`. After that, the frontend gets the current user id from `supabase.auth.getUser()`.
- `server/routes/login.js` and `register.js` are the mounted versions. The near-duplicates in `server/routes/auth/` are **not mounted** and are out of date (for example, the auth register still stores the password).

**The game logic** lives in `server/lib/`:
- `pixelate.js`: uses sharp to rasterise an image (SVGs at 300 dpi) and downscale it to `cols` × rows. It then picks colours with k-means and, if `minDistance` is set, merges colours closer than that CIELAB ΔE. It returns `{cols, rows, palette, grid}`, where `grid[y][x]` is a palette index, or `null` for a transparent cell. `matchPaletteColor` matches a colour to the nearest palette entry by ΔE.
- `groupGame.js`: the group-level layer. Every group uses the fixed settings `GRID_COLS=96`, `GRID_COLORS=8`, `GRID_MIN_COLOR_DISTANCE=25`, so all members see the same cells. Grids are cached in memory by image id (the cache resets when the server restarts), and the palette is written back to `public.images.palette`. `getColorOwners` lazily hands out unowned palette colours to the members with the fewest colours, ties going to whoever joined first, and saves the result to `group_members.colors`. Because of this, a read endpoint can also write to the database. Functions throw `GameError(status, message)`, and `sendError` in the route turns that into an HTTP response.
- `server/routes/pixelate.js` exposes `GET /group/:groupId` (grid plus owners, which is what the Play page uses), `GET /group/:groupId/match?color=%23rrggbb`, `GET /:imageId` (ad-hoc options), and `POST /` (an SVG or base64 image in the body; the JSON body limit is 5mb).

**Client (ESM, plain JSX, no TypeScript).** Routes are in `src/App.jsx` (react-router). The pages are in `src/pages/`, and each `.jsx` file has a `.css` file next to it. `Play.jsx` is assembled from `PlayPictureGrid` and `PlayMembersColumn`, keyed by the `:groupId` URL param. In dev, Vite proxies `/api` to `localhost:3001`. Newer code uses relative `/api/...` URLs, while older components (login, signup, and the group components) hardcode `http://localhost:3001`.
