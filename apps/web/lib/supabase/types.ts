export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      commit_history: {
        Row: {
          commit_message: string
          committed_by: string | null
          created_at: string | null
          files_count: number | null
          github_commit_sha: string
          github_commit_url: string
          id: string
          project_id: string
        }
        Insert: {
          commit_message: string
          committed_by?: string | null
          created_at?: string | null
          files_count?: number | null
          github_commit_sha: string
          github_commit_url: string
          id?: string
          project_id: string
        }
        Update: {
          commit_message?: string
          committed_by?: string | null
          created_at?: string | null
          files_count?: number | null
          github_commit_sha?: string
          github_commit_url?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commit_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deploy_status: {
        Row: {
          commit_id: string
          created_at: string | null
          error_message: string | null
          id: string
          logs: string[] | null
          project_id: string
          status: string
          step: string | null
          updated_at: string | null
        }
        Insert: {
          commit_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          logs?: string[] | null
          project_id: string
          status: string
          step?: string | null
          updated_at?: string | null
        }
        Update: {
          commit_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          logs?: string[] | null
          project_id?: string
          status?: string
          step?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deploy_status_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      file_history: {
        Row: {
          commit_id: string | null
          commit_message: string | null
          content_hash: string | null
          created_at: string | null
          diff_text: string | null
          file_path: string
          file_size: number
          github_commit_sha: string | null
          github_commit_url: string | null
          id: string
          project_id: string | null
          r2_object_key: string
        }
        Insert: {
          commit_id?: string | null
          commit_message?: string | null
          content_hash?: string | null
          created_at?: string | null
          diff_text?: string | null
          file_path: string
          file_size?: number
          github_commit_sha?: string | null
          github_commit_url?: string | null
          id?: string
          project_id?: string | null
          r2_object_key: string
        }
        Update: {
          commit_id?: string | null
          commit_message?: string | null
          content_hash?: string | null
          created_at?: string | null
          diff_text?: string | null
          file_path?: string
          file_size?: number
          github_commit_sha?: string | null
          github_commit_url?: string | null
          id?: string
          project_id?: string | null
          r2_object_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_changes: {
        Row: {
          action: string
          content: string
          content_hash: string | null
          created_at: string | null
          file_path: string
          file_size: number | null
          id: string
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          action: string
          content: string
          content_hash?: string | null
          created_at?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          action?: string
          content?: string
          content_hash?: string | null
          created_at?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_changes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          deploy_status: string | null
          github_owner: string | null
          github_repo_name: string | null
          github_repo_url: string | null
          id: string
          name: string
          netlify_deploy_id: string | null
          netlify_site_id: string | null
          netlify_url: string | null
          project_status: string | null
          template_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          deploy_status?: string | null
          github_owner?: string | null
          github_repo_name?: string | null
          github_repo_url?: string | null
          id?: string
          name?: string
          netlify_deploy_id?: string | null
          netlify_site_id?: string | null
          netlify_url?: string | null
          project_status?: string | null
          template_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          deploy_status?: string | null
          github_owner?: string | null
          github_repo_name?: string | null
          github_repo_url?: string | null
          id?: string
          name?: string
          netlify_deploy_id?: string | null
          netlify_site_id?: string | null
          netlify_url?: string | null
          project_status?: string | null
          template_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
        }
        Insert: {
          created_at?: string
          id: string
          is_admin?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "auth"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          accepts_call: boolean | null
          ai_analysis_reasoning: string | null
          ai_analysis_score: number | null
          ai_analysis_summary: string | null
          ai_analyzed_at: string | null
          ai_deployment_issues: boolean | null
          ai_experience_level: string | null
          ai_needs_reanalysis: boolean | null
          ai_openness_score: number | null
          ai_uses_cursor: boolean | null
          ai_versioning_issues: boolean | null
          approved_at: string | null
          approved_by: string | null
          coding_experience: string
          created_at: string
          dream_project: string
          email: string
          frustrations: string
          id: string
          name: string
          status: string | null
          tool_dislike: string | null
          tools_used: string | null
          updated_at: string
        }
        Insert: {
          accepts_call?: boolean | null
          ai_analysis_reasoning?: string | null
          ai_analysis_score?: number | null
          ai_analysis_summary?: string | null
          ai_analyzed_at?: string | null
          ai_deployment_issues?: boolean | null
          ai_experience_level?: string | null
          ai_needs_reanalysis?: boolean | null
          ai_openness_score?: number | null
          ai_uses_cursor?: boolean | null
          ai_versioning_issues?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          coding_experience: string
          created_at?: string
          dream_project: string
          email: string
          frustrations: string
          id?: string
          name: string
          status?: string | null
          tool_dislike?: string | null
          tools_used?: string | null
          updated_at?: string
        }
        Update: {
          accepts_call?: boolean | null
          ai_analysis_reasoning?: string | null
          ai_analysis_score?: number | null
          ai_analysis_summary?: string | null
          ai_analyzed_at?: string | null
          ai_deployment_issues?: boolean | null
          ai_experience_level?: string | null
          ai_needs_reanalysis?: boolean | null
          ai_openness_score?: number | null
          ai_uses_cursor?: boolean | null
          ai_versioning_issues?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          coding_experience?: string
          created_at?: string
          dream_project?: string
          email?: string
          frustrations?: string
          id?: string
          name?: string
          status?: string | null
          tool_dislike?: string | null
          tools_used?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "auth"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      auth: {
        Row: {
          aud: string | null
          banned_until: string | null
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          email_change: string | null
          email_change_confirm_status: number | null
          email_change_sent_at: string | null
          email_change_token_current: string | null
          email_change_token_new: string | null
          email_confirmed_at: string | null
          encrypted_password: string | null
          id: string | null
          instance_id: string | null
          invited_at: string | null
          is_anonymous: boolean | null
          is_sso_user: boolean | null
          is_super_admin: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          phone_change: string | null
          phone_change_sent_at: string | null
          phone_change_token: string | null
          phone_confirmed_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          reauthentication_sent_at: string | null
          reauthentication_token: string | null
          recovery_sent_at: string | null
          recovery_token: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string | null
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean | null
          is_sso_user?: boolean | null
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string | null
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean | null
          is_sso_user?: boolean | null
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_status_analytics: {
        Row: {
          count: number | null
          percentage: number | null
          project_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      update_project_status: {
        Args: { project_id_param: string; new_status: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
