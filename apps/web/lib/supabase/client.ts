"use client"

import { createBrowserClient } from "@supabase/ssr"
import { useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types"

// Create a singleton Supabase client for client-side usage
let supabaseClient: SupabaseClient<Database> | null = null

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return supabaseClient
}

// Custom hook to use Supabase client
export function useSupabase() {
  const [client] = useState(() => getSupabaseClient())
  return client
}

// Export the client for direct usage
export const supabase = getSupabaseClient()
