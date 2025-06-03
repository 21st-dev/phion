import { SupabaseClient } from '@supabase/supabase-js';

export interface DeployStatus {
  id: string;
  project_id: string;
  commit_id: string;
  status: 'pending' | 'building' | 'deploying' | 'success' | 'failed';
  step?: string;
  logs: string[];
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export class DeployStatusQueries {
  constructor(private supabase: SupabaseClient) {}

  async createDeployStatus(
    projectId: string,
    commitId: string,
    status: DeployStatus['status'] = 'pending'
  ): Promise<DeployStatus> {
    const { data, error } = await this.supabase
      .from('deploy_status')
      .insert({
        project_id: projectId,
        commit_id: commitId,
        status,
        logs: []
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateDeployStatus(
    id: string,
    updates: {
      status?: DeployStatus['status'];
      step?: string;
      logs?: string[];
      error_message?: string;
    }
  ): Promise<DeployStatus> {
    const { data, error } = await this.supabase
      .from('deploy_status')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addLogToDeployStatus(id: string, logMessage: string): Promise<void> {
    // Получаем текущие логи
    const { data: currentData, error: fetchError } = await this.supabase
      .from('deploy_status')
      .select('logs')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const currentLogs = currentData.logs || [];
    const updatedLogs = [...currentLogs, `${new Date().toISOString()}: ${logMessage}`];

    const { error } = await this.supabase
      .from('deploy_status')
      .update({
        logs: updatedLogs,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  async getProjectDeployStatuses(projectId: string, limit = 10): Promise<DeployStatus[]> {
    const { data, error } = await this.supabase
      .from('deploy_status')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getDeployStatusByCommitId(commitId: string): Promise<DeployStatus | null> {
    const { data, error } = await this.supabase
      .from('deploy_status')
      .select('*')
      .eq('commit_id', commitId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getLatestDeployStatus(projectId: string): Promise<DeployStatus | null> {
    const { data, error } = await this.supabase
      .from('deploy_status')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
} 