import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client « passe-partout » utilisant la clé service_role : il ignore les
// règles de sécurité ligne par ligne. Réservé au serveur (notifications,
// cron) — cette clé ne doit JAMAIS être exposée côté navigateur.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
