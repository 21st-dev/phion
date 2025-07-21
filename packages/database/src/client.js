import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
// Create client for frontend (with anon key)
export function createSupabaseClient(config) {
    if (!config.anonKey) {
        throw new Error("Anon key is required for client-side Supabase client");
    }
    return createClient(config.url, config.anonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
        },
    });
}
// Create client for server (with service role key)
export function createSupabaseServerClient(config) {
    if (!config.serviceRoleKey) {
        throw new Error("Service role key is required for server-side Supabase client");
    }
    return createClient(config.url, config.serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
// ========== NEW CLIENTS FOR USER AUTHENTICATION ==========
// Create browser client with authentication support
export function createAuthBrowserClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables are required");
    }
    return createBrowserClient(url, anonKey);
}
// Create server client with authentication and cookies support
export function createAuthServerClient(cookieStore) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables are required");
    }
    return createServerClient(url, anonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookieStore.setAll(cookiesToSet);
                }
                catch {
                    // The `setAll` method was called from a Server Component.
                    // This can be ignored if you have middleware refreshing
                    // user sessions.
                }
            },
        },
    });
}
// Global server client (initialized once)
let serverClient = null;
export function getSupabaseServerClient() {
    if (!serverClient) {
        const url = process.env.SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceRoleKey) {
            throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required");
        }
        serverClient = createSupabaseServerClient({ url, serviceRoleKey });
    }
    return serverClient;
}
// Utility for connection testing
export async function testConnection(client) {
    try {
        const { error } = await client.from("projects").select("id").limit(1);
        return !error;
    }
    catch {
        return false;
    }
}
