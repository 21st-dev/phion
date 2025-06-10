import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../types";

export interface PendingChange {
  id: string;
  project_id: string | null;
  file_path: string;
  content: string;
  action: 'modified' | 'added' | 'deleted';
  content_hash: string | null;
  file_size: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreatePendingChange {
  project_id: string;
  file_path: string;
  content: string;
  action: 'modified' | 'added' | 'deleted';
  content_hash?: string;
  file_size: number;
}

export class PendingChangesQueries {
  constructor(private client: SupabaseClient<Database>) {}

  async getPendingChanges(projectId: string): Promise<PendingChange[]> {
    const { data, error } = await this.client
      .from('pending_changes')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data as unknown as PendingChange[]) || [];
  }

  async getPendingChange(projectId: string, filePath: string): Promise<PendingChange | null> {
    const { data, error } = await this.client
      .from('pending_changes')
      .select('*')
      .eq('project_id', projectId)
      .eq('file_path', filePath)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return (data as unknown as PendingChange) || null;
  }

  async upsertPendingChange(changeData: CreatePendingChange): Promise<PendingChange> {
    const { data, error } = await this.client
      .from('pending_changes')
      .upsert(changeData, {
        onConflict: 'project_id,file_path',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as PendingChange;
  }

  async getAllPendingChanges(projectId: string): Promise<PendingChange[]> {
    const { data, error } = await this.client
      .from('pending_changes')
      .select('*')
      .eq('project_id', projectId)
      .order('file_path', { ascending: true });

    if (error) throw error;
    return (data as unknown as PendingChange[]) || [];
  }

  async clearAllPendingChanges(projectId: string): Promise<void> {
    const { error } = await this.client
      .from('pending_changes')
      .delete()
      .eq('project_id', projectId);

    if (error) throw error;
  }

  async deletePendingChange(projectId: string, filePath: string): Promise<void> {
    const { error } = await this.client
      .from('pending_changes')
      .delete()
      .eq('project_id', projectId)
      .eq('file_path', filePath);

    if (error) throw error;
  }

  async countPendingChanges(projectId: string): Promise<number> {
    const { count, error } = await this.client
      .from('pending_changes')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (error) throw error;
    return count || 0;
  }
} 