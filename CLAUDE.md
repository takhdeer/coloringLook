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

- `bun run test`: unit tests (`bun test` over `server/`; `server/lib/scoring.test.js`, `colorFill.test.js` and `dealColors.test.js`; no database or `.env` needed)

Useful manual checks: `GET /api/health`, and `GET /db-test` to check the Postgres connection.

## Environment

There are two separate `.env` files, and both are gitignored:
- **Root `.env`** is read by Vite: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `FRONTEND_URL`
- **`server/.env`** is loaded explicitly by `server/index.js`: `DATABASE_URL` (Supabase Postgres, SSL with cert verification off), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optionally `PORT`

## Structure

```
server/
  index.js            # Express app, mounts every /api route
  db.js               # shared pg Pool
  lib/                # supabase.js, pixelate.js (image → grid), groupGame.js (group grids, colour owners),
                      # gameLogic.js (user_colors, group progress, game state), colorFill.js (which cells are
                      # filled in), scoring.js (distance → gain, progress percent),
                      # dealColors.js (who gets the unowned colours; whether a new player would get one)
  routes/             # login.js, register.js, pixelate.js, photoColor.js, score.js, spawn.js, userColors.js
    groups/           # createGroup, deleteGroup, leaveGroup, joinGroup, getUserGroup, leaderboard
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
- `pixelate.js`: uses sharp to rasterise an image (SVGs at 300 dpi) and downscale it to `cols` × rows. It then picks colours with k-means and, if `minDistance` is set, merges colours closer than that CIELAB ΔE. With `square: true` the grid is `cols` × `cols`. It returns `{cols, rows, palette, grid}`, where `grid[y][x]` is a palette index, or `null` for a transparent cell. `matchPaletteColor` matches a colour to the nearest palette entry by ΔE.
- `groupGame.js`: the group-level layer. Every group uses the fixed settings `GRID_COLS=128` (a square 128 × 128 canvas: `pixelate` with `square: true` fits the picture inside it, centred, with a transparent margin), `GRID_COLORS=8`, `GRID_MIN_COLOR_DISTANCE=25`, so all members see the same cells. Grids are cached in memory by image id (the cache resets when the server restarts), and the palette is written back to `public.images.palette`. `getColorOwners` lazily hands out unowned palette colours to the members with the fewest colours, ties going to whoever joined first, and saves the result to `group_members.colors`. Because of this, a read endpoint can also write to the database. `isGroupFull` runs the same dealing rule (`dealColors.js`) for one extra player, and `POST /api/joinGroup` uses it to refuse (409) anyone who would be dealt no colour. It does this under a lock on the group row. Functions throw `GameError(status, message)`, and `sendError` in the route turns that into an HTTP response.
- `server/routes/pixelate.js` exposes `GET /group/:groupId` (grid plus owners, which is what the Play page uses), `GET /group/:groupId/match?color=%23rrggbb`, `GET /:imageId` (ad-hoc options), and `POST /` (an SVG or base64 image in the body; the JSON body limit is 5mb).
- `server/routes/photoColor.js` is the photo uploader: `POST /api/photoColor?userId=&groupId=` takes the raw photo as the body (`Content-Type: image/*`, up to 15mb). `getPhotoColor` in `groupGame.js` pixelates it with the same group settings and takes `palette[0]` (palettes are ranked by area, biggest first) as the most prominent colour. `matchPlayerColor` then compares it only against the colours that player owns, using `matchPhotoColor` in `pixelate.js`: hue within 35° or the same colour family (red/orange/yellow/green/blue/purple/pink, `COLOR_FAMILIES`) for coloured colours, lightness for greys/whites/blacks, and never coloured against grey. Nothing is written to the database. The response has a `status`: `matched` (`color` is the player's colour it counts as), `no_match` (too different from all their colours) or `no_colours` (the player owns none yet, e.g. joined late). `matched` and `no_match` also return `comparisons` (closeness to each of the player's colours, from `comparePhotoColor`). The photo itself is never stored. `POST /api/photoColor/extract` (same body, no query) only returns `{ photoColor }`, so the confirm popup can show it before matching. On the client, `PlayPicture.jsx` calls `extract` when a photo is picked, sends the photo to the matching endpoint on confirm, shows the result popup, and appends the photo's EXIF GPS location (with its colour and group) to `localStorage['coloringlook.photoLocations']`. For a `matched` photo it then calls `/api/score`.
- `server/routes/score.js` adds the points: `POST /api/score` with JSON `{ userId, groupId, color, latitude?, longitude? }`, where the coordinates are the photo's. It measures the haversine distance from `users.spawnpoint`, which `spawn.js` stores as text `"<longitude>, <latitude>"`, **longitude first**. `scoreImage` in `scoring.js` turns the distance into a gain: a 2.5 base plus a distance-tier bonus, up to 30 past 70 km. The gain is rounded to whole points. In one transaction, the route then adds those points to that colour's `public.user_colors.score` (now `real`), sets `group_members.score` (the leaderboard) to the sum of the player's colour scores, and calls `updateGroupProgress` in `gameLogic.js`. That sets `public.groups.progress` to the share of the picture's cells that are filled in, under a lock on the group row. Any progress above 0 is stored as at least 1, and only a finished picture is 100. The route trusts the client's colour and coordinates; it doesn't check that a photo was actually matched. After a successful score, `Play.jsx` bumps a `refreshKey` so `PlayPictureGrid` and `ViewGroups` reload.
- `group_members.score` and `groups.progress` are stored copies derived from `user_colors`. To keep them right after hand edits in the database: `server/sql/sync_member_score.sql` adds a trigger on `user_colors` that keeps `group_members.score` equal to the sum of that player's colour scores. You have to run it in the Supabase SQL editor; check whether it has been. Separately, `applyGameState` recomputes `groups.progress` whenever a picture loads and it doesn't match the filled-in cells (through `refreshGroupProgress`, under the group lock), so a read endpoint can also write.
- `colorFill.js`: a colour's score (capped at 100) is the percent of its cells that are filled in. The cells fill in a shuffled order that's seeded by the image and colour, so it's the same on every request and a higher score only ever adds cells. `applyGameState` (in `gameLogic.js`) adds `filled[y][x]` and `greyPalette` to the grid response, and `PlayPictureGrid` draws unfilled cells in grey.

**Client (ESM, plain JSX, no TypeScript).** Routes are in `src/App.jsx` (react-router). The pages are in `src/pages/`, and each `.jsx` file has a `.css` file next to it. `Play.jsx` is assembled from `PlayPictureGrid` and `PlayMembersColumn`, keyed by the `:groupId` URL param. In dev, Vite proxies `/api` to `localhost:3001`. Newer code uses relative `/api/...` URLs, while older components (login, signup, and the group components) hardcode `http://localhost:3001`.
