# BELUV Sales Dashboard

A sales dashboard for Berto's outbound workflow, now being upgraded from a local-only tool into a real web app with login + cloud sync.

## Current status

The project started as a static HTML/CSS/JS dashboard stored in `localStorage`.

It now has the first web-app pieces added:

- auth/sync UI shell in `index.html`
- Supabase client hook via `config.js`
- cloud auth/data layer in `cloud.js`
- first database schema in `supabase-schema.sql`
- dashboard logic being moved from local-only storage toward cloud persistence in `app.js`

## Files

- `index.html` — dashboard UI
- `styles.css` — dashboard styling
- `app.js` — dashboard logic and storage/auth wiring
- `cloud.js` — Supabase auth + lead storage adapter
- `config.js` — runtime config for Supabase URL + anon key
- `supabase-schema.sql` — starter database schema + RLS policies

## Local use

If you just want the old local-only mode, open `index.html` in a browser or run a static server from this folder.

Example:

```bash
python3 -m http.server 8033 --directory .
```

Then open:

- <http://127.0.0.1:8033>

## Cloud setup plan

### 1) Create a Supabase project

In Supabase:

- create a new project
- copy the **Project URL**
- copy the **Anon/Public key**

### 2) Run the schema

Open the SQL editor in Supabase and run:

- `supabase-schema.sql`

That creates:

- `public.leads`
- row-level security policies so each signed-in user only sees their own leads

### 3) Fill in `config.js`

Set:

```js
window.BELUV_CONFIG = {
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
};
```

### 4) Test auth + syncing

Expected flow:

- create account
- sign in
- add/edit/delete leads
- verify they save to Supabase
- open the site on another device and confirm the same data appears

## Hosting plan

### Recommended stack

- **Frontend:** Vercel
- **Database/Auth:** Supabase

### Basic deploy flow

1. Put this app in a Git repo
2. Import the repo into Vercel
3. Deploy as a static site
4. Make sure `config.js` points at the right Supabase project
5. Test on phone + laptop

## What still needs work

- finish and debug the cloud integration in `app.js`
- verify local-to-cloud migration behavior
- test sign-in/sign-out edge cases
- verify import/export still behaves well in cloud mode
- publish the first public test link

## Goal

Turn the dashboard from:

- browser-only local tool

into:

- login-based website
- synced across devices
- deployable and easy to maintain


deploy refresh
