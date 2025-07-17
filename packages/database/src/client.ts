import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { Database } from "./types";

// Types for client configuration
export interface SupabaseConfig {
  url: string;
  anonKey?: string;
  serviceRoleKey?: string;
}

// Create client for frontend (with anon key)
export function createSupabaseClient(
  config: SupabaseConfig
): SupabaseClient<Database> {
  if (!config.anonKey) {
    throw new Error("Anon key is required for client-side Supabase client");
  }

  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}

// Create client for server (with service role key)
export function createSupabaseServerClient(
  config: SupabaseConfig
): SupabaseClient<Database> {
  if (!config.serviceRoleKey) {
    throw new Error(
      "Service role key is required for server-side Supabase client"
    );
  }

  return createClient<Database>(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ========== NEW CLIENTS FOR USER AUTHENTICATION ==========

// Create browser client with authentication support
export function createAuthBrowserClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables are required"
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}

// Interface for cookie store (Next.js)
interface CookieStore {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options?: any }[]): void;
}

// Create server client with authentication and cookies support
export function createAuthServerClient(cookieStore: CookieStore): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables are required"
    );
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookieStore.setAll(cookiesToSet);
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

// Global server client (initialized once)
let serverClient: SupabaseClient<Database> | null = null;

export function getSupabaseServerClient(): SupabaseClient<Database> {
  if (!serverClient) {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
      );
    }

    serverClient = createSupabaseServerClient({ url, serviceRoleKey });
  }

  return serverClient;
}

// Utility for connection testing
export async function testConnection(
  client: SupabaseClient<Database>
): Promise<boolean> {
  try {
    const { error } = await client.from("projects").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}
