import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./types";

// Типы для конфигурации клиента
export interface SupabaseConfig {
  url: string;
  anonKey?: string;
  serviceRoleKey?: string;
}

// Создание клиента для фронтенда (с anon key)
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

// Создание клиента для сервера (с service role key)
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

// Глобальный клиент для сервера (инициализируется один раз)
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

// Утилита для проверки подключения
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
