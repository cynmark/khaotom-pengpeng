// Plain browser JavaScript: no npm, framework, or build step.
// The pinned SDK loads only when getClient() is explicitly called.
// Nothing here reads/writes tables, signs in, or changes the existing menu.
(() => {
  'use strict';

  let clientPromise;
  let adminClientPromise;

  function readConfig() {
    const config = window.PENG_PENG_SUPABASE_CONFIG;
    const projectUrl = config?.projectUrl?.trim();
    const publishableKey = config?.publishableKey?.trim();

    if (!projectUrl || !publishableKey) {
      throw new Error('Add the Project URL and Publishable Key to supabase-config.js first.');
    }

    let url;
    try {
      url = new URL(projectUrl);
    } catch {
      throw new Error('Supabase Project URL must be a valid HTTPS origin.');
    }
    if (url.protocol !== 'https:' || url.username || url.password ||
        url.search || url.hash || url.pathname !== '/') {
      throw new Error('Supabase Project URL must be an HTTPS origin without credentials, paths, or query parameters.');
    }
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
      throw new Error('Use only a Supabase Publishable Key starting with sb_publishable_.');
    }
    return { projectUrl: url.origin, publishableKey };
  }

  async function getClient() {
    if (!clientPromise) {
      const { projectUrl, publishableKey } = readConfig();
      clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm')
        .then(({ createClient }) => createClient(projectUrl, publishableKey, {
          db: { schema: 'public' },
          // Public-site foundation only. Admin authentication is a later step.
          // Do not restore an admin session or consume auth callbacks here.
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }))
        .catch(() => {
          clientPromise = undefined;
          throw new Error('Could not initialize Supabase. Check the public configuration and CDN connection, then retry.');
        });
    }
    return clientPromise;
  }

  // Later integration: const client = await window.PengPengSupabase.getClient();
  // Callers must catch errors; they must not replace the menu on failure.
  // Separate admin session; public pages retain their non-persistent client.
  async function getAdminClient() {
    if (!adminClientPromise) {
      const { projectUrl, publishableKey } = readConfig();
      adminClientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm')
        .then(({ createClient }) => createClient(projectUrl, publishableKey, {
          db: { schema: 'public' },
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storageKey: `peng-peng-admin-${new URL(projectUrl).hostname}`
          }
        }))
        .catch(() => {
          adminClientPromise = undefined;
          throw new Error('Could not initialize the admin connection. Please try again.');
        });
    }
    return adminClientPromise;
  }

  window.PengPengSupabase = Object.freeze({ getClient, getAdminClient });
})();
