# Supabase Database Setup

To use Supabase with the iFound system, you need to create a project and set up the necessary tables. Follow these steps:

## 1. Get Your API Keys

1. Go to your [Supabase Dashboard](https://app.supabase.com/) and open your project.
2. Go to **Settings** > **API**.
3. Copy the **Project URL** and the **anon public key**.
4. Open `src/client/api.ts` (or `public/js/api.js` if you are modifying the compiled JS) in the project.
5. Update the configuration at the top:
   ```typescript
   const USE_SUPABASE = true;
   const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';
   ```
6. Rebuild the project if you changed `src/client/api.ts` by running `npm run build`.

## 2. Set Up the Database Tables

In your Supabase project, go to the **SQL Editor** and run the following commands to create the necessary tables for the app:

```sql
-- Create the items table
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    "studentId" TEXT,
    "ownerName" TEXT,
    strand TEXT,
    email TEXT,
    contact TEXT,
    "photoDataUrl" TEXT,
    category TEXT,
    status TEXT,
    "createdAt" BIGINT,
    "lostSince" TEXT,
    "foundPhotoDataUrl" TEXT,
    "claimedAt" TEXT,
    "returnedAt" TEXT,
    "archivedAt" TEXT
);

-- Create the found_reports table
CREATE TABLE found_reports (
    id TEXT PRIMARY KEY,
    "itemId" TEXT,
    "finderName" TEXT,
    location TEXT,
    "photoDataUrl" TEXT,
    status TEXT,
    "createdAt" BIGINT
);

-- Create the claims table
CREATE TABLE claims (
    id TEXT PRIMARY KEY,
    "itemId" TEXT,
    "claimantName" TEXT,
    "studentId" TEXT,
    email TEXT,
    status TEXT,
    "createdAt" BIGINT,
    "releasedAt" TEXT
);
```

## 3. Configure Row Level Security (RLS)

Since this app operates purely on the client side without user authentication for simplicity, you should disable Row Level Security (RLS) on these tables so that the app can freely read and write data.

Alternatively, run these SQL commands to create open policies:

```sql
-- Disable RLS for simple open access
ALTER TABLE items DISABLE ROW LEVEL SECURITY;
ALTER TABLE found_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE claims DISABLE ROW LEVEL SECURITY;
```

*(Note: For a fully secure production app, you should eventually implement Supabase Auth and configure RLS properly, but for this prototype/school project, open access matches the previous localStorage behavior).*
