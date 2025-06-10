import fs from 'fs';
import path from 'path';

// Типы событий
export type ProjectEventType = 
  | 'project_created'
  | 'project_updated' 
  | 'template_extracted'
  | 'file_changed'
  | 'file_deleted'
  | 'commit_created'
  | 'deploy_started'
  | 'deploy_building'
  | 'deploy_completed'
  | 'deploy_failed'
  | 'agent_connected'
  | 'agent_disconnected'
  | 'pending_change_added'
  | 'pending_changes_cleared'
  | 'netlify_site_created'
  | 'project_deleted'
  | 'error';

// Интерфейс для лог-записи
export interface ProjectLogEntry {
  timestamp: string;
  project_id: string;
  event_type: ProjectEventType;
  details: Record<string, any>;
  trigger?: string;
  user_id?: string;
  database_state?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
}

// Helper to detect if running on server
const isServer = () => typeof process !== 'undefined' && process.versions && process.versions.node;

// Класс для логирования событий проекта
export class ProjectLoggerClass {
  private static instance: ProjectLoggerClass;
  private logsDir: string = '';

  private constructor() {
    // Only initialize on server
    if (isServer()) {
      this.logsDir = path.join(process.cwd(), 'logs', 'projects');
      this.ensureLogsDir();
    }
  }

  public static getInstance(): ProjectLoggerClass {
    if (!ProjectLoggerClass.instance) {
      ProjectLoggerClass.instance = new ProjectLoggerClass();
    }
    return ProjectLoggerClass.instance;
  }

  private ensureLogsDir(): void {
    if (!isServer()) return;
    
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private getLogFilePath(projectId: string): string {
    return path.join(this.logsDir, `${projectId}.json`);
  }

  private readLogs(projectId: string): ProjectLogEntry[] {
    if (!isServer()) return [];
    
    try {
      const filePath = this.getLogFilePath(projectId);
      if (!fs.existsSync(filePath)) {
        return [];
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) || [];
    } catch (error) {
      console.error(`Error reading logs for project ${projectId}:`, error);
      return [];
    }
  }

  private writeLogs(projectId: string, logs: ProjectLogEntry[]): void {
    if (!isServer()) return;
    
    try {
      // Keep only last 1000 entries
      const trimmedLogs = logs.slice(-1000);
      
      const filePath = this.getLogFilePath(projectId);
      fs.writeFileSync(filePath, JSON.stringify(trimmedLogs, null, 2));
    } catch (error) {
      console.error(`Error writing logs for project ${projectId}:`, error);
    }
  }

  // Основной метод логирования
  public async log(entry: Omit<ProjectLogEntry, 'timestamp'>): Promise<void> {
    if (!isServer()) {
      console.warn('ProjectLogger.log called on client side');
      return;
    }
    
    const logEntry: ProjectLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    try {
      const logs = this.readLogs(entry.project_id);
      logs.push(logEntry);
      this.writeLogs(entry.project_id, logs);

      // Также выводим в консоль для отладки
      console.log(`📝 [ProjectLogger] ${entry.event_type}:`, logEntry);
    } catch (error) {
      console.error(`❌ Error logging event ${entry.event_type} for project ${entry.project_id}:`, error);
    }
  }

  // Получить логи проекта
  public getLogs(projectId: string, eventType?: string): ProjectLogEntry[] {
    if (!isServer()) return [];
    
    const logs = this.readLogs(projectId);
    
    if (eventType) {
      return logs.filter(log => log.event_type === eventType);
    }
    
    return logs;
  }

  // Получить последние N записей
  public getRecentLogs(projectId: string, limit: number = 50): ProjectLogEntry[] {
    const logs = this.getLogs(projectId);
    return logs.slice(-limit);
  }

  // Получить логи по типу события
  public getLogsByType(projectId: string, eventType: ProjectEventType): ProjectLogEntry[] {
    const logs = this.getLogs(projectId);
    return logs.filter(log => log.event_type === eventType);
  }

  // Получить статистику по проекту
  public getProjectStats(projectId: string): {
    totalEvents: number;
    eventsByType: Record<ProjectEventType, number>;
    firstEvent?: string;
    lastEvent?: string;
  } {
    const logs = this.getLogs(projectId);
    
    const eventsByType: Record<ProjectEventType, number> = {} as any;
    logs.forEach(log => {
      eventsByType[log.event_type] = (eventsByType[log.event_type] || 0) + 1;
    });

    return {
      totalEvents: logs.length,
      eventsByType,
      firstEvent: logs[0]?.timestamp,
      lastEvent: logs[logs.length - 1]?.timestamp,
    };
  }

  // Вспомогательные методы для частых событий

  public async logProjectCreated(
    projectId: string, 
    projectData: any,
    triggeredBy: string = 'user_action'
  ): Promise<void> {
    await this.log({
      project_id: projectId,
      event_type: 'project_created',
      details: { projectData },
      trigger: triggeredBy,
      database_state: { after: { project: projectData } }
    });
  }

  public async logFileChange(
    projectId: string,
    filePath: string,
    action: 'added' | 'modified' | 'deleted',
    triggeredBy: string = 'file_watcher'
  ): Promise<void> {
    await this.log({
      project_id: projectId,
      event_type: 'file_changed',
      details: { filePath, action },
      trigger: triggeredBy
    });
  }

  public async logCommitCreated(
    projectId: string,
    commitId: string,
    commitMessage: string,
    filesCount: number,
    triggeredBy: string = 'save_action'
  ): Promise<void> {
    await this.log({
      project_id: projectId,
      event_type: 'commit_created',
      details: { commitId, commitMessage, filesCount },
      trigger: triggeredBy
    });
  }

  public async logDeployStatusChange(
    projectId: string,
    oldStatus: string,
    newStatus: string,
    deployUrl?: string,
    triggeredBy: string = 'deploy_service'
  ): Promise<void> {
    await this.log({
      project_id: projectId,
      event_type: newStatus === 'building' ? 'deploy_building' : 
                 newStatus === 'ready' ? 'deploy_completed' :
                 newStatus === 'failed' ? 'deploy_failed' : 'deploy_started',
      details: { oldStatus, newStatus, deployUrl },
      trigger: triggeredBy
    });
  }

  public async logAgentConnection(
    projectId: string,
    connected: boolean,
    clientId: string,
    triggeredBy: string = 'websocket_connection'
  ): Promise<void> {
    await this.log({
      project_id: projectId,
      event_type: connected ? 'agent_connected' : 'agent_disconnected',
      details: { connected, clientId },
      trigger: triggeredBy
    });
  }

  public clearLogs(projectId: string): void {
    if (!isServer()) return;
    
    try {
      const filePath = this.getLogFilePath(projectId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error clearing logs for project ${projectId}:`, error);
    }
  }
}

// Экспортируем синглтон логгера
export const projectLogger = ProjectLoggerClass.getInstance(); 