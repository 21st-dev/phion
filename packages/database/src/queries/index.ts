// Export all query classes
export * from "./projects";
export * from "./file-history";
export * from "./pending-changes";
export * from "./deploy-status";
export * from "./commit-history";

import { getSupabaseServerClient } from "../client";

/**
 */
export async function getProjectCommits(projectId?: string, limit: number = 50): Promise<any[]> {
  const supabase = getSupabaseServerClient();
  
  let query = supabase
    .from('file_history')
    .select('commit_id, commit_message, created_at, project_id')
    .not('commit_id', 'is', null) // Exclude records with null commit_id
    .order('created_at', { ascending: false })
    .limit(limit);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching commits:', error);
    throw error;
  }

  // Group by commit_id and take unique commits
  const commitsMap = new Map();
  for (const item of data || []) {
    if (!commitsMap.has(item.commit_id)) {
      commitsMap.set(item.commit_id, {
        commit_id: item.commit_id,
        commit_message: item.commit_message,
        created_at: item.created_at,
        project_id: item.project_id
      });
    }
  }

  return Array.from(commitsMap.values());
}

/**
 */
export async function getCommitFiles(commitId: string): Promise<any[]> {
  const supabase = getSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('file_history')
    .select('*')
    .eq('commit_id', commitId)
    .order('file_path', { ascending: true });

  if (error) {
    console.error('Error fetching commit files:', error);
    throw error;
  }

  return data || [];
}
