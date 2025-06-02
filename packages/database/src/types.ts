// Типы базы данных Supabase
// Эти типы должны соответствовать схеме базы данных

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          template_type: string;
          netlify_site_id: string | null;
          netlify_url: string | null;
          deploy_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name?: string;
          template_type?: string;
          netlify_site_id?: string | null;
          netlify_url?: string | null;
          deploy_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          template_type?: string;
          netlify_site_id?: string | null;
          netlify_url?: string | null;
          deploy_status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      file_history: {
        Row: {
          id: string;
          project_id: string;
          file_path: string;
          r2_object_key: string;
          content_hash: string | null;
          diff_text: string | null;
          file_size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          file_path: string;
          r2_object_key: string;
          content_hash?: string | null;
          diff_text?: string | null;
          file_size: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          file_path?: string;
          r2_object_key?: string;
          content_hash?: string | null;
          diff_text?: string | null;
          file_size?: number;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Удобные типы для работы с таблицами
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

export type FileHistoryRow =
  Database["public"]["Tables"]["file_history"]["Row"];
export type FileHistoryInsert =
  Database["public"]["Tables"]["file_history"]["Insert"];
export type FileHistoryUpdate =
  Database["public"]["Tables"]["file_history"]["Update"];
