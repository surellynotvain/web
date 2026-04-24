# deploying to vercel

this doc walks you from an empty vercel account to a live vainie.pl on vercel.
everything stays free unless you go viral.

prerequisites:
- the repo at `surellynotvain/web` is pushed and up to date
- you have a google/github account to sign into vercel with

---

## the 3-minute version

1. go to https://vercel.com/signup and sign in with github
2. click **"add new…" → "project"**, pick `surellynotvain/web`
3. in the import screen, add all the env vars from your local `.env.local`
   (copy-paste; vercel encrypts them)
4. hit **"deploy"**
5. wait ~2 min. done. you get a url like `web-surellynotvain.vercel.app`

if that works, you're live. the rest of this doc is about turning it from
"works" to "actually usable" — the database, image uploads, and custom domain.

---

## step 1 — create the vercel project

- https://vercel.com/new → "import git repository"
- pick `surellynotvain/web`
- vercel auto-detects next.js. leave the defaults.
- **don't deploy yet.** click "environment variables" first.

## step 2 — configure the database (turso)

your local site uses a sqlite file. vercel's serverless functions can't
reliably read/write to a filesystem, so we use turso (sqlite-compatible,
cloud-hosted, free tier is generous).

### 2a. create a turso database

- go to https://turso.tech/ and sign in with github
- dashboard → **create database** → call it `vainie`
- pick a region close to you (eu-central for poland: `fra` or `ams`)
- it'll show you two things you need:

```
Database URL:
  libsql://vainie-surellynotvain.turso.io

Auth token (click "generate"):
  eyJhbGci... (long jwt)
```

### 2b. add them to vercel env vars

in the vercel import screen (or project → settings → environment variables
later), add:

| key | value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://vainie-surellynotvain.turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJhbGci...` |

the site's db/index.ts auto-detects these and switches from local file to
turso. no code changes.

### 2c. seed the first admin

this is the one manual step. locally, on your machine:

```bash
# export the turso creds so the admin-create script writes to turso, not local
export TURSO_DATABASE_URL='libsql://vainie-surellynotvain.turso.io'
export TURSO_AUTH_TOKEN='eyJhbGci...'

npm run admin:create -- \
  --username surellynotvain \
  --password 'some-strong-password-you-will-remember' \
  --email hi@vainie.pl
```

the script prints `[admin:create] using turso: libsql://...@vainie-...` to
confirm it's writing to turso. once done, that user can log in on the live
site at /login.

## step 3 — configure image uploads (vercel blob)

images uploaded in the /admin post editor need somewhere to live. without
this, `/api/upload` will write to `/public/uploads` which vercel's
filesystem discards between requests.

### 3a. create a blob store

- vercel dashboard → your project → **storage** tab → **create**
  → pick **blob**
- name it `uploads`, choose region (same as db is fine)
- vercel auto-adds a `BLOB_READ_WRITE_TOKEN` env var to your project.
  you don't have to do anything.

the site detects that env var and switches uploads.ts from local fs to
blob storage. no code changes.

## step 4 — all the other env vars

copy these from your local `.env.local` into vercel's env vars panel:

| key | notes |
|---|---|
| `SESSION_SECRET` | **generate a fresh 48-byte base64** for production. do NOT reuse the dev one. `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `TIDAL_CLIENT_ID` | from developer.tidal.com |
| `TIDAL_CLIENT_SECRET` | from developer.tidal.com |
| `OPENROUTER_API` | from openrouter.ai/keys |
| `OPENROUTER_DEFAULT_MODEL` | e.g. `cognitivecomputations/dolphin-mistral-24b-venice-edition:free` |
| `OPENROUTER_SECONDARY_MODEL` | e.g. `qwen/qwen3-coder:free` |
| `OPENROUTER_BACKUP_MODEL` | e.g. `google/gemma-3-27b-it:free` |
| `OPENROUTER_FALLBACK_MODELS` | e.g. `openrouter/auto,openrouter/free` |
| `GITHUB_TOKEN` | github PAT for contributions calendar |
| `GITHUB_USERNAME` | `surellynotvain` |
| `GOOGLE_CLIENT_ID` | from cloud.google.com |
| `GOOGLE_CLIENT_SECRET` | from cloud.google.com |
| `OAUTH_REDIRECT_BASE` | **set to your vercel url or custom domain** — `https://vainie.pl` |
| `GITHUB_CLIENT_ID` | optional, only if you set up github oauth |
| `GITHUB_CLIENT_SECRET` | optional |
| `MICROSOFT_CLIENT_ID` | optional |
| `MICROSOFT_CLIENT_SECRET` | optional |

do NOT add:
- `PROJECTS_DIR` — it points at your home HDD, useless on vercel
- `DATA_DIR` — not needed when TURSO_DATABASE_URL is set

## step 5 — hit deploy

click **deploy**. wait ~2 minutes. you'll get a url like
`web-surellynotvain.vercel.app`.

open it. check:
- [ ] home page loads, shows about/stack/vibes
- [ ] `/blog` and `/projects` load (projects will be empty — that's expected)
- [ ] `/quiz/linux-distro` works
- [ ] `/credits`, `/privacy`, `/#about` anchors work
- [ ] `/login` lets you log in with the admin you seeded in step 2c
- [ ] as admin, `/admin/new` lets you write a post and upload an image
- [ ] the uploaded image actually shows (comes from blob storage)
- [ ] the AI assistant in the post editor returns text

if anything breaks, vercel's dashboard → your project → deployments →
latest → "function logs" tab shows the runtime error.

## step 6 — custom domain (vainie.pl)

### 6a. add the domain in vercel

- vercel project → **settings** → **domains**
- add `vainie.pl` and `www.vainie.pl`
- vercel shows you two DNS records to add. usually:
  - `A @ 76.76.21.21`
  - `CNAME www cname.vercel-dns.com`

### 6b. update DNS at domena.pl (your registrar)

log into domena.pl panel → DNS settings for vainie.pl → add those records,
delete any old ones pointing at your home server.

propagation is 5 min - 24 hrs. vercel auto-issues ssl via let's encrypt
once it sees the DNS.

### 6c. update OAuth redirect URIs

back in google cloud console (and github/microsoft if you set them up):

add these authorized redirect URIs:
- `https://vainie.pl/api/auth/oauth/google/callback`
- `https://www.vainie.pl/api/auth/oauth/google/callback`

and set the vercel env var `OAUTH_REDIRECT_BASE=https://vainie.pl`.
redeploy (deployments → ... → redeploy) so the new env var takes effect.

## step 7 — future deploys

every `git push origin main` auto-deploys. that's it.

if you want preview deploys for branches:
- `git checkout -b my-feature && git push -u origin my-feature`
- vercel builds it, gives you a preview url
- merge the branch to main → auto-deploys to production

## troubleshooting

### "middleware/edge function too large"
the site's middleware (CSP headers) is ~34 kb. vercel's limit is 1 MB on
hobby tier. you're fine.

### "could not find module 'better-sqlite3'"
you're on an old commit before the libsql migration. pull main:
```bash
git pull origin main
```

### "turso auth failed"
check `TURSO_AUTH_TOKEN` is correct. it's a long jwt — make sure you
didn't accidentally truncate it when pasting.

### "no projects on the projects page"
expected. the projects loader reads `/mnt/PLIKI/Dokumenty HDD/PROJECTS` on
your home server; vercel can't see that path. options:
- accept that `/projects` is empty on vercel
- fill `src/lib/projects.ts` with a static list of projects you care about
  (it's currently an intentionally-empty array)
- write a sync cron on your home server that pushes project JSON to a new
  `/api/admin/projects` endpoint (future work)

### "github contributions calendar unavailable"
means `GITHUB_TOKEN` or `GITHUB_USERNAME` isn't set. re-check env vars.

### "AI writing assistant never responds"
open the vercel function logs for `/api/ai/write`. common issues:
- `OPENROUTER_API` not set
- all models in your chain returning 429 → add more fallbacks
- function timed out at 60s → set `maxDuration: 90` in `vercel.json`
  (requires pro tier past 60s; hobby is capped at 60)

## cost

with hobby tier (free):
- 100 GB bandwidth/month
- 100 hrs of function compute/month
- 1 GB of blob storage
- unlimited static

turso free tier:
- 500 databases
- 9 GB of storage
- 1 billion row reads/month

openrouter free models:
- cost you nothing per token
- capped by openrouter-side rate limits; that's what the fallback chain is for

you will hit $0 on a personal-scale site.
