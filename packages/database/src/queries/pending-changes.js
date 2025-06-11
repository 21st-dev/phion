export class PendingChangesQueries {
    client;
    constructor(client) {
        this.client = client;
    }
    async getPendingChanges(projectId) {
        const { data, error } = await this.client
            .from('pending_changes')
            .select('*')
            .eq('project_id', projectId)
            .order('updated_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
    async getPendingChange(projectId, filePath) {
        const { data, error } = await this.client
            .from('pending_changes')
            .select('*')
            .eq('project_id', projectId)
            .eq('file_path', filePath)
            .single();
        if (error && error.code !== 'PGRST116')
            throw error;
        return data || null;
    }
    async upsertPendingChange(changeData) {
        const { data, error } = await this.client
            .from('pending_changes')
            .upsert(changeData, {
            onConflict: 'project_id,file_path',
            ignoreDuplicates: false
        })
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async getAllPendingChanges(projectId) {
        const { data, error } = await this.client
            .from('pending_changes')
            .select('*')
            .eq('project_id', projectId)
            .order('file_path', { ascending: true });
        if (error)
            throw error;
        return data || [];
    }
    async clearAllPendingChanges(projectId) {
        const { error } = await this.client
            .from('pending_changes')
            .delete()
            .eq('project_id', projectId);
        if (error)
            throw error;
    }
    async deletePendingChange(projectId, filePath) {
        const { error } = await this.client
            .from('pending_changes')
            .delete()
            .eq('project_id', projectId)
            .eq('file_path', filePath);
        if (error)
            throw error;
    }
    async countPendingChanges(projectId) {
        const { count, error } = await this.client
            .from('pending_changes')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId);
        if (error)
            throw error;
        return count || 0;
    }
}
