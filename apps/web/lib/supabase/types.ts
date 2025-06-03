export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          user_id: string
          netlify_site_id: string | null
          netlify_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          user_id: string
          netlify_site_id?: string | null
          netlify_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          user_id?: string
          netlify_site_id?: string | null
          netlify_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      project_versions: {
        Row: {
          id: string
          project_id: string
          version_number: number
          commit_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          version_number: number
          commit_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          version_number?: number
          commit_message?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types
export type User = {
  id: string
  email?: string
  user_metadata?: {
    name?: string
    avatar_url?: string
    full_name?: string
  }
}

export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']

export type ProjectVersion = Database['public']['Tables']['project_versions']['Row']
export type ProjectVersionInsert = Database['public']['Tables']['project_versions']['Insert'] 