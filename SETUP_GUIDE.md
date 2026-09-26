# 🚀 Full-Stack Web Application - Production Setup & Integration Guide

This guide details everything you need to configure your database on **Supabase**, setup **OAuth Providers (Google, GitHub, Microsoft)**, link **custom domains on Vercel**, and transform this starter template into your own custom web application.

---

## 🔗 1. Quick Access External Portals

| Service | Setting / Section | Direct Link |
| :--- | :--- | :--- |
| 🗄️ **Supabase** | SQL Editor & Migrations | [supabase.com/dashboard/project/_/sql](https://supabase.com/dashboard/project/_/sql) |
| 🗄️ **Supabase** | Table Editor & RLS GUI | [supabase.com/dashboard/project/_/editor](https://supabase.com/dashboard/project/_/editor) |
| 🔐 **Supabase** | Auth Providers (Google, GitHub, Azure) | [supabase.com/dashboard/project/_/auth/providers](https://supabase.com/dashboard/project/_/auth/providers) |
| 🌐 **Supabase** | Site URL & Redirect URLs | [supabase.com/dashboard/project/_/auth/url-configuration](https://supabase.com/dashboard/project/_/auth/url-configuration) |
| ⚡ **Vercel** | Project Dashboard & Domains | [vercel.com/dashboard](https://vercel.com/dashboard) |
| ⚡ **Vercel** | Supabase Integration Marketplace | [vercel.com/integrations/supabase](https://vercel.com/integrations/supabase) |
| 🔑 **Google Cloud** | OAuth 2.0 Credentials | [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) |
| 🐙 **GitHub** | Developer OAuth Applications | [github.com/settings/developers](https://github.com/settings/developers) |
| 🏢 **Microsoft Entra** | Azure App Registrations | [portal.azure.com/#view/Microsoft_AAD_RegisteredApps](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) |

---

## 🗄️ 2. Supabase Database Configuration & Table Prefix Rule

> [!CAUTION]
> ### ⚠️ CRITICAL RULE: Always Enforce Unique Table Prefixes for Shared Databases
> If you share a Supabase instance across multiple projects, **ALWAYS instruct AI assistants, code generators, and migration scripts to prefix all table names** (e.g. `wapp_users`, `wapp_assets`, `wapp_transactions`).
> 
> ❌ **Never create generic tables** like `users`, `categories`, `items`, `documents` without prefixes, as this will cause collisions and overwrite data across applications.

### Quick Migration Snippet:
```sql
-- 1. Create a table with project prefix
CREATE TABLE IF NOT EXISTS myapp_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount NUMERIC(14,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Always enable Row Level Security (RLS)
ALTER TABLE myapp_items ENABLE ROW LEVEL SECURITY;

-- 3. Create Tenant Isolation RLS Policies
CREATE POLICY "Users can manage own items"
ON myapp_items FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## 🌐 3. Domain, Subdomain & Supabase Redirect URLs

Whenever you deploy a new domain or subdomain (e.g. `sample.minkoi.org` or `app.yourdomain.com`):

1. **Add Custom Domain on Vercel**:
   - Go to [Vercel Project Settings > Domains](https://vercel.com/dashboard).
   - Add your target domain/subdomain and create the corresponding CNAME record (`cname.vercel-dns.com`) at your DNS provider (Cloudflare, etc.).
2. **Update Supabase URL Configuration**:
   - Open [Supabase Auth URL Configuration](https://supabase.com/dashboard/project/_/auth/url-configuration).
   - **Site URL**: Enter your live production URL: `https://sample.minkoi.org`.
   - **Redirect URLs (Allowed wildcards)**:
     - `https://sample.minkoi.org/**`
     - `http://localhost:5173/**`
     - `https://*.vercel.app/**`
   > **Why?** If you omit Redirect URLs, OAuth logins will be rejected or fall back to localhost, preventing users from accessing the app.

---

## 🔑 4. OAuth Authentication Setup

### A. Google OAuth (Recommended)
1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials).
2. Create **OAuth client ID** (Application type: *Web application*).
3. Under **Authorized redirect URIs**, add your Supabase callback:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
4. Copy the **Client ID** and **Client Secret**.
5. Go to [Supabase > Auth > Providers > Google](https://supabase.com/dashboard/project/_/auth/providers), paste credentials, and toggle **Enable Sign in with Google**.

---

### B. GitHub OAuth (Optional)
1. Go to [GitHub Developer Settings > OAuth Apps](https://github.com/settings/developers).
2. Click **New OAuth App**.
3. Set **Homepage URL**: `https://sample.minkoi.org` (or your domain).
4. Set **Authorization callback URL**:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
5. Generate a **Client Secret** and copy the **Client ID** & **Client Secret**.
6. Paste into [Supabase > Auth > Providers > GitHub](https://supabase.com/dashboard/project/_/auth/providers) and toggle ON.

---

### C. Microsoft Account / Azure Entra ID (Optional)
1. Go to [Azure Portal > App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade).
2. Click **New registration** & select *"Accounts in any organizational directory and personal Microsoft accounts"*.
3. Set **Redirect URI (Web)** to:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
4. Under **Certificates & secrets**, create a **New client secret** and copy the value.
5. In [Supabase > Auth > Providers > Azure](https://supabase.com/dashboard/project/_/auth/providers), paste **Application (client) ID**, **Secret**, and set Tenant to `common`.

---

## ⚡ 5. Vercel Auto-Setup via Supabase Integration

You can automate environment variable synchronization:
1. Open the [Vercel Supabase Marketplace Integration](https://vercel.com/integrations/supabase).
2. Connect your Vercel Project with your Supabase Project.
3. Vercel will automatically configure:
   - `VITE_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `POSTGRES_URL_NON_POOLING`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## 🧹 6. New App Transformation & Cleanup Checklist

When transforming this starter template into your own custom product:
1. **Remove Unused Pages**:
   - Remove demo pages from `web/src/pages/` (such as `GoUsPortal.tsx`, `AssetList.tsx`, `MaintenanceList.tsx`, etc.).
2. **Update Routing & Navigation**:
   - Modify `web/src/App.tsx` and `web/src/components/layout/Sidebar.tsx` to reflect your new product modules.
3. **Hide / Remove Setup Guide**:
   - Once setup is complete, remove or hide `web/src/pages/SetupGuide.tsx` so end users only see your application.
4. **Update App Identity**:
   - Change `title` in `web/index.html`.
   - Update `name` in `package.json`.
   - Replace `web/public/logo.svg` and `web/public/favicon.svg` with your brand assets.
5. **Database Schema**:
   - Set up your custom tables in Supabase with your unique prefix (e.g. `myapp_*`).
