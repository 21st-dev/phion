/**
 * Система логирования проекта
 * Отслеживает все активности проекта: создание, изменения файлов, коммиты, деплои
 */

import type { Database } from "@/lib/supabase/types";

type Project = Database['public']['Tables']['projects']['Row'];

export interface ProjectLogEntry {
  id: string;
  timestamp: number;
  type: 'project_created' | 'file_changed' | 'file_deleted' | 'commit_created' | 'deploy_started' | 'deploy_completed' | 'deploy_failed' | 'agent_connected' | 'agent_disconnected' | 'manual_save' | 'template_extracted' | 'project_status_changed';
  projectId: string;
  
  // Основные данные события
  message: string;
  source: 'ui' | 'websocket' | 'api' | 'system';
  
  // Детали события
  details?: {
    // Для файловых изменений
    filePath?: string;
    fileSize?: number;
    action?: 'added' | 'modified' | 'deleted';
    
    // Для коммитов
    commitId?: string;
    commitMessage?: string;
    filesCount?: number;
    
    // Для деплоев
    deployId?: string;
    deployUrl?: string;
    status?: 'pending' | 'building' | 'ready' | 'failed';
    error?: string;
    
    // Дополнительные данные
    agentId?: string;
    trigger?: string;
    metadata?: Record<string, any>;
  };
  
  // Снапшот состояния проекта на момент события
  projectSnapshot?: {
    name: string;
    deploy_status: string;
    netlify_url: string | null;
    netlify_site_id: string | null;
    updated_at: string;
  };
}

class ProjectLogger {
  private getStorageKey(projectId: string): string {
    return `shipvibes_project_logs_${projectId}`;
  }

  /**
   * Добавить запись в лог
   */
  log(entry: Omit<ProjectLogEntry, 'id' | 'timestamp'>): void {
    try {
      const fullEntry: ProjectLogEntry = {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      const storageKey = this.getStorageKey(entry.projectId);
      const existingLogs = this.getLogs(entry.projectId);
      
      // Добавляем новую запись в начало (новые сверху)
      const updatedLogs = [fullEntry, ...existingLogs];
      
      // Ограничиваем количество записей (последние 1000)
      const limitedLogs = updatedLogs.slice(0, 1000);
      
      localStorage.setItem(storageKey, JSON.stringify(limitedLogs));
      
      // Выводим в консоль для разработки
      console.log(`📋 [${entry.type}] ${entry.message}`, {
        source: entry.source,
        details: entry.details,
        timestamp: new Date(fullEntry.timestamp).toISOString(),
      });
    } catch (error) {
      console.error('Failed to log project activity:', error);
    }
  }

  /**
   * Получить все логи проекта
   */
  getLogs(projectId: string): ProjectLogEntry[] {
    try {
      const storageKey = this.getStorageKey(projectId);
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get project logs:', error);
      return [];
    }
  }

  /**
   * Получить логи по типу события
   */
  getLogsByType(projectId: string, type: ProjectLogEntry['type']): ProjectLogEntry[] {
    return this.getLogs(projectId).filter(log => log.type === type);
  }

  /**
   * Получить логи за определенный период
   */
  getLogsByTimeRange(projectId: string, startTime: number, endTime: number): ProjectLogEntry[] {
    return this.getLogs(projectId).filter(
      log => log.timestamp >= startTime && log.timestamp <= endTime
    );
  }

  /**
   * Очистить все логи проекта
   */
  clearLogs(projectId: string): void {
    try {
      const storageKey = this.getStorageKey(projectId);
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear project logs:', error);
    }
  }

  /**
   * Экспортировать логи в JSON
   */
  exportLogs(projectId: string): string {
    const logs = this.getLogs(projectId);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Импортировать логи из JSON
   */
  importLogs(projectId: string, logsJson: string): void {
    try {
      const logs = JSON.parse(logsJson) as ProjectLogEntry[];
      const storageKey = this.getStorageKey(projectId);
      localStorage.setItem(storageKey, JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to import project logs:', error);
    }
  }

  /**
   * Получить статистику по логам
   */
  getLogStats(projectId: string): {
    total: number;
    byType: Record<string, number>;
    timeRange: { start: number; end: number } | null;
    lastActivity: number | null;
  } {
    const logs = this.getLogs(projectId);
    
    const byType: Record<string, number> = {};
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    logs.forEach(log => {
      byType[log.type] = (byType[log.type] || 0) + 1;
      minTime = Math.min(minTime, log.timestamp);
      maxTime = Math.max(maxTime, log.timestamp);
    });
    
    return {
      total: logs.length,
      byType,
      timeRange: logs.length > 0 ? { start: minTime, end: maxTime } : null,
      lastActivity: logs.length > 0 ? logs[0].timestamp : null,
    };
  }

  // Convenience methods для частых типов логов
  
  logProjectCreated(projectId: string, projectData: Project) {
    this.log({
      type: 'project_created',
      projectId,
      message: `Project "${projectData.name}" created`,
      source: 'ui',
      projectSnapshot: {
        name: projectData.name,
        deploy_status: 'pending',
        netlify_url: projectData.netlify_url,
        netlify_site_id: projectData.netlify_site_id,
        updated_at: projectData.updated_at,
      },
    });
  }

  logFileChanged(projectId: string, filePath: string, action: 'added' | 'modified' | 'deleted', fileSize: number = 0) {
    this.log({
      type: action === 'deleted' ? 'file_deleted' : 'file_changed',
      projectId,
      message: `File ${action}: ${filePath}`,
      source: 'websocket',
      details: {
        filePath,
        action,
        fileSize,
      },
    });
  }

  logCommitCreated(projectId: string, commitId: string, commitMessage: string, filesCount: number) {
    this.log({
      type: 'commit_created',
      projectId,
      message: commitMessage || 'Untitled commit',
      source: 'system',
      details: {
        commitId,
        commitMessage,
        filesCount,
      },
    });
  }

  logDeployStarted(projectId: string, deployId: string, trigger: string = 'manual') {
    this.log({
      type: 'deploy_started',
      projectId,
      message: `Deploy started (${trigger})`,
      source: 'system',
      details: {
        deployId,
        trigger,
        status: 'building',
      },
    });
  }

  logDeployCompleted(projectId: string, deployId: string, deployUrl: string) {
    this.log({
      type: 'deploy_completed',
      projectId,
      message: 'Deploy completed successfully',
      source: 'system',
      details: {
        deployId,
        deployUrl,
        status: 'ready',
      },
    });
  }

  logDeployFailed(projectId: string, deployId: string, error: string) {
    this.log({
      type: 'deploy_failed',
      projectId,
      message: `Deploy failed: ${error}`,
      source: 'system',
      details: {
        deployId,
        error,
        status: 'failed',
      },
    });
  }

  logAgentConnected(projectId: string, agentId: string) {
    this.log({
      type: 'agent_connected',
      projectId,
      message: 'Local development agent connected',
      source: 'websocket',
      details: {
        agentId,
      },
    });
  }

  logAgentDisconnected(projectId: string, agentId: string) {
    this.log({
      type: 'agent_disconnected',
      projectId,
      message: 'Local development agent disconnected',
      source: 'websocket',
      details: {
        agentId,
      },
    });
  }

  logManualSave(projectId: string, filesCount: number) {
    this.log({
      type: 'manual_save',
      projectId,
      message: `Manual save triggered for ${filesCount} files`,
      source: 'ui',
      details: {
        filesCount,
        trigger: 'manual',
      },
    });
  }

  logProjectStatusChanged(projectId: string, oldStatus: string, newStatus: string, projectSnapshot: Project) {
    this.log({
      type: 'project_status_changed',
      projectId,
      message: `Project status changed: ${oldStatus} → ${newStatus}`,
      source: 'system',
      details: {
        metadata: {
          oldStatus,
          newStatus,
        },
      },
      projectSnapshot: {
        name: projectSnapshot.name,
        deploy_status: newStatus,
        netlify_url: projectSnapshot.netlify_url,
        netlify_site_id: projectSnapshot.netlify_site_id,
        updated_at: projectSnapshot.updated_at,
      },
    });
  }
}

// Singleton instance
export const projectLogger = new ProjectLogger(); 