export class DeployStatusQueries {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async createDeployStatus(projectId, commitId, status = 'pending') {
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
        if (error)
            throw error;
        return data;
    }
    async updateDeployStatus(id, updates) {
        const { data, error } = await this.supabase
            .from('deploy_status')
            .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async addLogToDeployStatus(id, logMessage) {
        // Получаем текущие логи
        const { data: currentData, error: fetchError } = await this.supabase
            .from('deploy_status')
            .select('logs')
            .eq('id', id)
            .single();
        if (fetchError)
            throw fetchError;
        const currentLogs = currentData.logs || [];
        const updatedLogs = [...currentLogs, `${new Date().toISOString()}: ${logMessage}`];
        const { error } = await this.supabase
            .from('deploy_status')
            .update({
            logs: updatedLogs,
            updated_at: new Date().toISOString()
        })
            .eq('id', id);
        if (error)
            throw error;
    }
    async getProjectDeployStatuses(projectId, limit = 10) {
        const { data, error } = await this.supabase
            .from('deploy_status')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error)
            throw error;
        return data || [];
    }
    async getDeployStatusByCommitId(commitId) {
        const { data, error } = await this.supabase
            .from('deploy_status')
            .select('*')
            .eq('commit_id', commitId)
            .single();
        if (error && error.code !== 'PGRST116')
            throw error;
        return data;
    }
    async getLatestDeployStatus(projectId) {
        const { data, error } = await this.supabase
            .from('deploy_status')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116')
            throw error;
        return data;
    }
}
