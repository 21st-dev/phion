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
        Relationships: []
      }
    }
    Views: {
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



// Type aliases for convenience
export type ProjectRow = Tables<"projects">
export type ProjectInsert = TablesInsert<"projects">
export type ProjectUpdate = TablesUpdate<"projects">

export type FileHistoryRow = Tables<"file_history">
export type FileHistoryInsert = TablesInsert<"file_history">
export type FileHistoryUpdate = TablesUpdate<"file_history">

export type PendingChangesRow = Tables<"pending_changes">
export type PendingChangesInsert = TablesInsert<"pending_changes">
export type PendingChangesUpdate = TablesUpdate<"pending_changes">

export type DeployStatusRow = Tables<"deploy_status">
export type DeployStatusInsert = TablesInsert<"deploy_status">
export type DeployStatusUpdate = TablesUpdate<"deploy_status">

export type CommitHistoryRow = Tables<"commit_history">
export type CommitHistoryInsert = TablesInsert<"commit_history">
export type CommitHistoryUpdate = TablesUpdate<"commit_history">