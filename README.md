# vainie.pl

personal website. nextjs 15 + sqlite + minimal white/navy design.
runs on port **6967**.

## features

- **blog** with markdown posts, image uploads, anonymous comments, likes
- **auth** — password accounts + github + microsoft oauth
- **dynamic projects** — auto-indexed from `/mnt/PLIKI/Dokumenty HDD/PROJECTS/<status>/<proj>/vainie.json`
- **static fallback** for archive projects (`src/lib/projects.ts`)
- **tidal playlist** — scrollable track list + embed player on /about
- **offline-safe** — tidal failures don't break the page
- dark + light themes, light is default

## getting started

```bash
npm install

# generate session secret + fill .env.local
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
# paste that into SESSION_SECRET=... in .env.local

# create the first admin (you)
npm run admin:create -- --username vain --password 'your-strong-password'

# dev
npm run dev
# → http://localhost:6967
```

## env vars

| var | purpose |
|---|---|
| `SESSION_SECRET` | **required**. 48+ random bytes, base64. used for session signing + CSRF derivation. |
| `TIDAL_CLIENT_ID` / `TIDAL_CLIENT_SECRET` | optional. tidal api creds for /about playlist. graceful fallback if missing. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional. enables github oauth on login/signup. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | optional. enables microsoft oauth. |
| `OAUTH_REDIRECT_BASE` | public url base for oauth callbacks, e.g. `https://vainie.pl`. defaults to `http://localhost:6967`. |
| `PROJECTS_DIR` | path to projects root. default `/mnt/PLIKI/Dokumenty HDD/PROJECTS`. |
| `DATA_DIR` | where `vainie.db` and future data live. default `./data`. |

## admin

make yourself admin (idempotent — promotes + resets password if user exists):

```bash
npm run admin:create -- --username vain --password 'newpass' --email you@example.com
```

log in at `/login` → go to `/admin` → write posts.

## projects — dynamic loader

drop a `vainie.json` in any folder under one of:

```
/mnt/PLIKI/Dokumenty HDD/PROJECTS/
├── Finished/        → status: done
├── In progress/     → status: wip
├── Left out/        → status: paused
└── Planned/         → status: planned
```

example `vainie.json`:

```json
{
  "name": "Cinderbore",
  "tagline": "action-rpg combat engine.",
  "description": "long-form description here, markdown-lite.",
  "tech": ["Unity", "C#", "raylib"],
  "cover": "cover.png"
}
```

the `cover` is a filename **relative to the project directory**; any image
inside the same folder. it's served via `/api/project-cover?slug=<slug>`
with a path-traversal guard.

### GUI editor (much easier than typing json)

```bash
npm run project:editor
```

opens a small tkinter window where you can pick a project, fill the form,
pick a cover image, and save. no external python deps needed.

## oauth setup (optional)

### github
1. https://github.com/settings/developers → new OAuth app
2. homepage: `https://vainie.pl`
3. authorization callback url: `https://vainie.pl/api/auth/oauth/github/callback`
4. copy the client id + client secret into `.env.local`

### microsoft
1. https://portal.azure.com → app registrations → new registration
2. platform: web
3. redirect URI: `https://vainie.pl/api/auth/oauth/microsoft/callback`
4. certificates & secrets → new client secret
5. copy app id + secret into `.env.local`

then set `OAUTH_REDIRECT_BASE=https://vainie.pl` and restart.

## blog

- `/blog` — public list
- `/blog/<slug>` — public post with comments + like button
- `/admin` — your dashboard (admin only)
- `/admin/new` — create post
- `/admin/post/<id>` — edit / republish / delete

post content is markdown. images are uploaded via `+ insert image`
(drag-drop also works) and stored under `/public/uploads`.

## security

- argon2id password hashing
- httponly secure sameSite=lax session cookies, 30-day rolling expiry
- in-memory rate limits: login 8/min, signup 5/hour, comments 6/10min, likes 60/min, upload 30/10min
- csrf synchronizer tokens on all state-changing api routes
- html sanitization via DOMPurify after markdown rendering
- image uploads validated by magic bytes (not just mime header), 8 MB limit
- CSP + `X-Frame-Options: DENY` + referrer policy set via middleware
- path traversal checks on `/api/project-cover`
- sqlite WAL mode for better concurrency

if you expose this to the internet, run behind nginx/caddy with HTTPS and
keep `OAUTH_REDIRECT_BASE` in sync with your public URL.

## project structure

```
src/
  app/
    layout.tsx
    globals.css
    page.tsx                 # home
    about/page.tsx           # tidal playlist lives here
    projects/
      page.tsx               # list (dynamic + static)
      [slug]/page.tsx
    blog/
      page.tsx
      [slug]/page.tsx
    admin/
      page.tsx               # dashboard
      new/page.tsx
      post/[id]/page.tsx
    login/page.tsx
    signup/page.tsx
    api/
      auth/{login,logout,signup}
      auth/oauth/[provider]/{route,callback/route}
      me                     # current session info
      posts, posts/[id]
      comments, likes
      upload                 # admin-only
      project-cover          # serves covers from HDD with traversal guard
  components/
    nav.tsx, footer.tsx, theme-toggle.tsx, theme-provider.tsx
    auth-status.tsx          # user menu in the nav
    post-editor.tsx          # markdown editor + uploads
    post-interactions.tsx    # likes + comments on public post
    tidal-playlist.tsx, tidal-embed.tsx, track-list.tsx
  lib/
    auth.ts                  # sessions, csrf, password, cookies
    blog.ts                  # posts/comments/likes queries
    crypto.ts
    db/{index,schema}.ts     # sqlite + drizzle
    oauth.ts                 # github / microsoft
    projects.ts              # static list
    projects-dynamic.ts      # reads HDD vainie.json files
    projects-all.ts          # merged accessor
    rate-limit.ts
    tidal.ts                 # tidal api client
    uploads.ts               # image upload validator
  middleware.ts              # CSP + security headers
data/
  vainie.db                  # sqlite (gitignored)
public/
  uploads/                   # user-uploaded images (gitignored)
scripts/
  create-admin.cjs
  project_editor.py          # GUI for vainie.json
deploy/
  nginx-vainie.pl.conf
  vainie-web.service
  install.sh
```

## deployment

see [DEPLOYMENT.md](./DEPLOYMENT.md). quick version:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo ./deploy/install.sh
sudo certbot --nginx -d vainie.pl -d www.vainie.pl
```

## backing up

everything important lives in:

```
data/vainie.db           # users, sessions, posts, comments, likes
public/uploads/          # user-uploaded images
.env.local               # secrets
```

tar this up on a cron for backups. sqlite is safe to copy while the server
runs (WAL mode), but for the absolute safest backup use the sqlite backup
command:

```bash
sqlite3 data/vainie.db ".backup '/path/to/backup/vainie-$(date +%F).db'"
```
