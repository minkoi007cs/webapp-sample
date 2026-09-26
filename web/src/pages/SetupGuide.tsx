import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Database,
  Globe,
  KeyRound,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  ArrowRight,
  Code2,
  Sparkles,
} from 'lucide-react';
import { Card, Badge, message, Tabs } from 'antd';

export function SetupGuide() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    message.success('Copied to clipboard');
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-accent/20 p-6 lg:p-8 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <Sparkles size={13} />
              <span>Full-Stack Web App Starter Template</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
              Production Setup & Integration Guide
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Step-by-step instructions to configure your Supabase backend, OAuth providers (Google, GitHub, Microsoft), custom domains on Vercel, and guidelines to transform this starter into your own custom web application.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all shadow-xs"
            >
              <span>Explore Sample Dashboard</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Access External Portals Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-border/80 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5">
              <Database size={15} /> Supabase
            </span>
            <ExternalLink size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 line-clamp-1">Database, Auth & SQL</p>
        </a>

        <a
          href="https://vercel.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-border/80 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Zap size={15} /> Vercel
            </span>
            <ExternalLink size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 line-clamp-1">Domains & Deployments</p>
        </a>

        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-border/80 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-500 flex items-center gap-1.5">
              <KeyRound size={15} /> Google Cloud
            </span>
            <ExternalLink size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 line-clamp-1">OAuth 2.0 Client IDs</p>
        </a>

        <a
          href="https://github.com/settings/developers"
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-border/80 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Code2 size={15} /> GitHub OAuth
            </span>
            <ExternalLink size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 line-clamp-1">Developer Applications</p>
        </a>

        <a
          href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-border/80 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-500 flex items-center gap-1.5">
              <ShieldCheck size={15} /> Microsoft Entra
            </span>
            <ExternalLink size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 line-clamp-1">Azure App Registration</p>
        </a>
      </div>

      {/* Main Tabs Container */}
      <Tabs
        defaultActiveKey="supabase-data"
        type="card"
        className="custom-setup-tabs"
        items={[
          {
            key: 'supabase-data',
            label: (
              <span className="flex items-center gap-2 text-xs font-semibold">
                <Database size={14} className="text-emerald-500" />
                <span>1. Database & Table Prefix Rule</span>
              </span>
            ),
            children: (
              <div className="space-y-6 pt-2">
                {/* Rule Warning */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 lg:p-5 flex items-start gap-3">
                  <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold text-foreground">
                      CRITICAL: Enforce Unique Table Prefixes for Shared Databases
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      If you use a shared Supabase PostgreSQL instance across multiple applications, <strong>always instruct the AI agent or UI generator to create all project tables with a distinct project prefix</strong> (e.g., <code className="px-1.5 py-0.5 rounded bg-background border text-primary font-mono">wapp_users</code>, <code className="px-1.5 py-0.5 rounded bg-background border text-primary font-mono">wapp_assets</code>, <code className="px-1.5 py-0.5 rounded bg-background border text-primary font-mono">wapp_expenses</code>).
                      Never create generic table names like <code className="px-1 rounded bg-background border font-mono">users</code> or <code className="px-1 rounded bg-background border font-mono">items</code> without a prefix to prevent accidental collision or schema overrides.
                    </p>
                  </div>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="rounded-xl border border-border shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">1</div>
                        <h4 className="text-sm font-semibold text-foreground">Supabase SQL Editor</h4>
                      </div>
                      <a
                        href="https://supabase.com/dashboard/project/_/sql"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Open SQL Editor <ExternalLink size={12} />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      Run initial database migrations or create custom tables directly with SQL queries. Always include Row Level Security (RLS) policies.
                    </p>
                    <div className="relative rounded-lg bg-zinc-950 p-3 text-zinc-100 font-mono text-[11px] overflow-x-auto border border-zinc-800">
                      <button
                        onClick={() => handleCopy(`-- Example table creation with project prefix
CREATE TABLE IF NOT EXISTS myapp_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE myapp_items ENABLE ROW LEVEL SECURITY;

-- Create Tenant Isolation Policy
CREATE POLICY "Users can manage own items"
ON myapp_items FOR ALL
USING (auth.uid() = user_id);`, 'sql-sample')}
                        className="absolute top-2 right-2 p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                        title="Copy SQL"
                      >
                        {copiedText === 'sql-sample' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                      <pre>{`CREATE TABLE myapp_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
                    </div>
                  </Card>

                  <Card className="rounded-xl border border-border shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">2</div>
                        <h4 className="text-sm font-semibold text-foreground">Table Editor & GUI</h4>
                      </div>
                      <a
                        href="https://supabase.com/dashboard/project/_/editor"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Open Table Editor <ExternalLink size={12} />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      Use the visual Table Editor to insert mock records, inspect relationship foreign keys, or modify column constraints visually.
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                      <li>Add column definitions with strict types (<code className="text-primary font-mono">UUID</code>, <code className="text-primary font-mono">TIMESTAMPTZ</code>, <code className="text-primary font-mono">JSONB</code>).</li>
                      <li>Check foreign key relationships link to <code className="text-primary font-mono">auth.users(id)</code>.</li>
                      <li>Review Realtime publication toggles if instant websocket updates are needed.</li>
                    </ul>
                  </Card>
                </div>
              </div>
            ),
          },
          {
            key: 'domain-redirect',
            label: (
              <span className="flex items-center gap-2 text-xs font-semibold">
                <Globe size={14} className="text-blue-500" />
                <span>2. Domain, Subdomain & Redirect URLs</span>
              </span>
            ),
            children: (
              <div className="space-y-6 pt-2">
                <Card className="rounded-xl border border-border shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Why Updating Supabase Redirect URLs is Essential</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Whenever you connect a custom domain (e.g. <code className="text-primary font-mono">sample.minkoi.org</code>) or deploy a new Vercel subdomain, you <strong>MUST</strong> update the Redirect URLs in Supabase. Otherwise, OAuth logins will fail or redirect to localhost.
                      </p>
                    </div>
                    <a
                      href="https://supabase.com/dashboard/project/_/auth/url-configuration"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                    >
                      Supabase URL Config <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <div className="p-4 rounded-lg bg-secondary/40 border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">A. Site URL (Default Production URL)</span>
                        <Badge count="Required" style={{ backgroundColor: '#10b981' }} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Set this to your primary live production domain:
                      </p>
                      <div className="flex items-center justify-between p-2 rounded bg-background border font-mono text-xs">
                        <span>https://sample.minkoi.org</span>
                        <button
                          onClick={() => handleCopy('https://sample.minkoi.org', 'site-url')}
                          className="p-1 hover:text-primary transition-colors"
                        >
                          {copiedText === 'site-url' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-secondary/40 border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">B. Allowed Redirect URLs (Wildcards)</span>
                        <Badge count="Required" style={{ backgroundColor: '#3b82f6' }} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Add wildcard paths so authentication can redirect to callbacks and local dev:
                      </p>
                      <div className="space-y-1.5 font-mono text-[11px]">
                        <div className="flex items-center justify-between p-1.5 rounded bg-background border">
                          <span>https://sample.minkoi.org/**</span>
                          <button onClick={() => handleCopy('https://sample.minkoi.org/**', 'r-prod')} className="p-1">
                            {copiedText === 'r-prod' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded bg-background border">
                          <span>http://localhost:5173/**</span>
                          <button onClick={() => handleCopy('http://localhost:5173/**', 'r-dev')} className="p-1">
                            {copiedText === 'r-dev' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded bg-background border">
                          <span>https://*.vercel.app/**</span>
                          <button onClick={() => handleCopy('https://*.vercel.app/**', 'r-vercel')} className="p-1">
                            {copiedText === 'r-vercel' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Vercel Custom Domain Step */}
                <Card className="rounded-xl border border-border shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-foreground">Vercel Custom Domain Configuration</h4>
                    <a
                      href="https://vercel.com/dashboard"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Vercel Domains Settings <ExternalLink size={12} />
                    </a>
                  </div>
                  <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside mt-2">
                    <li>Open your project on Vercel &rarr; <strong>Settings</strong> &rarr; <strong>Domains</strong>.</li>
                    <li>Enter your target subdomain (e.g. <code className="text-primary font-mono">sample.minkoi.org</code>) and click <strong>Add</strong>.</li>
                    <li>Add the provided <strong>CNAME</strong> record (<code className="text-primary font-mono">cname.vercel-dns.com</code>) at your DNS provider (Cloudflare, Namecheap, etc.).</li>
                    <li>Wait for the automatic SSL certificate generation to show a green checkmark.</li>
                  </ol>
                </Card>
              </div>
            ),
          },
          {
            key: 'oauth-providers',
            label: (
              <span className="flex items-center gap-2 text-xs font-semibold">
                <KeyRound size={14} className="text-amber-500" />
                <span>3. OAuth Setup (Google, GitHub, Microsoft)</span>
              </span>
            ),
            children: (
              <div className="space-y-6 pt-2">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Google OAuth */}
                  <Card className="rounded-xl border border-border shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">G</div>
                          <h4 className="text-sm font-semibold text-foreground">Google OAuth</h4>
                        </div>
                        <Badge count="Recommended" style={{ backgroundColor: '#2563eb' }} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Enable zero-friction Google 1-tap & pop-up authentication.
                      </p>
                      <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                        <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-primary underline">Google Cloud Console</a>.</li>
                        <li>Create <strong>OAuth 2.0 Client ID</strong> (Web app).</li>
                        <li>Set Authorized redirect URI to your Supabase callback:
                          <div className="p-1.5 mt-1 rounded bg-background border font-mono text-[10px] break-all text-foreground">
                            https://&lt;project-ref&gt;.supabase.co/auth/v1/callback
                          </div>
                        </li>
                        <li>Copy <strong>Client ID</strong> & <strong>Client Secret</strong>.</li>
                        <li>Paste into <a href="https://supabase.com/dashboard/project/_/auth/providers" target="_blank" rel="noreferrer" className="text-primary underline">Supabase Google Provider</a> and toggle ON.</li>
                      </ol>
                    </div>
                  </Card>

                  {/* GitHub OAuth */}
                  <Card className="rounded-xl border border-border shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-zinc-500/10 text-foreground flex items-center justify-center font-bold text-xs">GH</div>
                          <h4 className="text-sm font-semibold text-foreground">GitHub OAuth</h4>
                        </div>
                        <Badge count="Optional" style={{ backgroundColor: '#71717a' }} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Enable developer login via personal GitHub accounts.
                      </p>
                      <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                        <li>Open <a href="https://github.com/settings/developers" target="_blank" rel="noreferrer" className="text-primary underline">GitHub OAuth Apps</a>.</li>
                        <li>Click <strong>New OAuth App</strong>.</li>
                        <li>Homepage URL: <code className="text-primary font-mono">https://yourdomain.com</code>.</li>
                        <li>Authorization callback URL:
                          <div className="p-1.5 mt-1 rounded bg-background border font-mono text-[10px] break-all text-foreground">
                            https://&lt;project-ref&gt;.supabase.co/auth/v1/callback
                          </div>
                        </li>
                        <li>Generate a Client Secret and paste both values into Supabase GitHub Provider.</li>
                      </ol>
                    </div>
                  </Card>

                  {/* Microsoft Azure OAuth */}
                  <Card className="rounded-xl border border-border shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-xs">MS</div>
                          <h4 className="text-sm font-semibold text-foreground">Microsoft Entra</h4>
                        </div>
                        <Badge count="Optional" style={{ backgroundColor: '#71717a' }} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Support Outlook, Office 365, and corporate Entra IDs.
                      </p>
                      <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                        <li>Visit <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noreferrer" className="text-primary underline">Azure App Registrations</a>.</li>
                        <li>Register App & choose "Personal & Work Accounts".</li>
                        <li>Set Redirect URI (Web) to Supabase callback:
                          <div className="p-1.5 mt-1 rounded bg-background border font-mono text-[10px] break-all text-foreground">
                            https://&lt;project-ref&gt;.supabase.co/auth/v1/callback
                          </div>
                        </li>
                        <li>Generate Secret in <strong>Certificates & secrets</strong>.</li>
                        <li>Paste Application ID & Secret in Supabase Azure Provider.</li>
                      </ol>
                    </div>
                  </Card>
                </div>
              </div>
            ),
          },
          {
            key: 'vercel-automation',
            label: (
              <span className="flex items-center gap-2 text-xs font-semibold">
                <Zap size={14} className="text-purple-500" />
                <span>4. Vercel Auto Setup & Env Sync</span>
              </span>
            ),
            children: (
              <div className="space-y-6 pt-2">
                <Card className="rounded-xl border border-border shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-foreground">1-Click Vercel & Supabase Integration</h4>
                    <a
                      href="https://vercel.com/integrations/supabase"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Vercel Supabase Marketplace <ExternalLink size={12} />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    Instead of copying API keys manually, you can link your Vercel project directly to Supabase via the official Vercel Integration. This automatically injects environment variables for all preview and production deployments.
                  </p>

                  <div className="rounded-lg bg-secondary/50 p-4 border border-border space-y-2">
                    <span className="text-xs font-semibold text-foreground">Standard Environment Variables Injected:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                      <div className="p-2 rounded bg-background border">VITE_SUPABASE_URL</div>
                      <div className="p-2 rounded bg-background border">VITE_SUPABASE_ANON_KEY</div>
                      <div className="p-2 rounded bg-background border">POSTGRES_URL_NON_POOLING</div>
                      <div className="p-2 rounded bg-background border">SUPABASE_SERVICE_ROLE_KEY</div>
                    </div>
                  </div>
                </Card>
              </div>
            ),
          },
          {
            key: 'cleanup-checklist',
            label: (
              <span className="flex items-center gap-2 text-xs font-semibold">
                <Trash2 size={14} className="text-rose-500" />
                <span>5. New App Transformation & Cleanup</span>
              </span>
            ),
            children: (
              <div className="space-y-6 pt-2">
                <Card className="rounded-xl border border-border shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} className="text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">Checklist to Turn This Template into Your New Custom App</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    When you are ready to build your own bespoke feature set, follow these simple cleanup steps:
                  </p>

                  <div className="space-y-3">
                    {[
                      {
                        title: '1. Remove Sample Pages and Modules',
                        desc: 'Delete sample modules like GoUsPortal.tsx, AssetList.tsx, MaintenanceList.tsx, ExpenseList.tsx, Documents.tsx from web/src/pages/ if they are not needed for your use case.',
                      },
                      {
                        title: '2. Clean up Sidebar and Router',
                        desc: 'Edit web/src/components/layout/Sidebar.tsx and web/src/App.tsx to register your new routes and remove unused navigation items.',
                      },
                      {
                        title: '3. Update App Identity & Branding',
                        desc: 'Update title and description in index.html, package.json, replace public/logo.svg and public/favicon.svg with your own brand assets.',
                      },
                      {
                        title: '4. Update or Remove this Guide',
                        desc: 'Once your custom application is ready for production users, hide this SetupGuide page from default navigation or remove web/src/pages/SetupGuide.tsx.',
                      },
                      {
                        title: '5. Connect your Fresh Database Prefix',
                        desc: 'Define your new entities in NestJS/FastAPI or Supabase SQL Editor with your custom prefix (e.g. appname_*) and start building!',
                      },
                    ].map((step, idx) => (
                      <div key={idx} className="p-3.5 rounded-lg bg-secondary/30 border border-border flex items-start gap-3">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-xs font-semibold text-foreground">{step.title}</h5>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
