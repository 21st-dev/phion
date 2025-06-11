import fs from 'fs';
import path from 'path';
// Helper to detect if running on server
const isServer = () => typeof process !== 'undefined' && process.versions && process.versions.node;
// Класс для логирования событий проекта
export class ProjectLoggerClass {
    static instance;
    logsDir = '';
    constructor() {
        // Only initialize on server
        if (isServer()) {
            this.logsDir = path.join(process.cwd(), 'logs', 'projects');
            this.ensureLogsDir();
        }
    }
    static getInstance() {
        if (!ProjectLoggerClass.instance) {
            ProjectLoggerClass.instance = new ProjectLoggerClass();
        }
        return ProjectLoggerClass.instance;
    }
    ensureLogsDir() {
        if (!isServer())
            return;
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }
    getLogFilePath(projectId) {
        return path.join(this.logsDir, `${projectId}.json`);
    }
    readLogs(projectId) {
        if (!isServer())
            return [];
        try {
            const filePath = this.getLogFilePath(projectId);
            if (!fs.existsSync(filePath)) {
                return [];
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content) || [];
        }
        catch (error) {
            console.error(`Error reading logs for project ${projectId}:`, error);
            return [];
        }
    }
    writeLogs(projectId, logs) {
        if (!isServer())
            return;
        try {
            // Keep only last 1000 entries
            const trimmedLogs = logs.slice(-1000);
            const filePath = this.getLogFilePath(projectId);
            fs.writeFileSync(filePath, JSON.stringify(trimmedLogs, null, 2));
        }
        catch (error) {
            console.error(`Error writing logs for project ${projectId}:`, error);
        }
    }
    // Основной метод логирования
    async log(entry) {
        if (!isServer()) {
            console.warn('ProjectLogger.log called on client side');
            return;
        }
        const logEntry = {
            ...entry,
            timestamp: new Date().toISOString(),
        };
        try {
            const logs = this.readLogs(entry.project_id);
            logs.push(logEntry);
            this.writeLogs(entry.project_id, logs);
            // Также выводим в консоль для отладки
            console.log(`📝 [ProjectLogger] ${entry.event_type}:`, logEntry);
        }
        catch (error) {
            console.error(`❌ Error logging event ${entry.event_type} for project ${entry.project_id}:`, error);
        }
    }
    // Получить логи проекта
    getLogs(projectId, eventType) {
        if (!isServer())
            return [];
        const logs = this.readLogs(projectId);
        if (eventType) {
            return logs.filter(log => log.event_type === eventType);
        }
        return logs;
    }
    // Получить последние N записей
    getRecentLogs(projectId, limit = 50) {
        const logs = this.getLogs(projectId);
        return logs.slice(-limit);
    }
    // Получить логи по типу события
    getLogsByType(projectId, eventType) {
        const logs = this.getLogs(projectId);
        return logs.filter(log => log.event_type === eventType);
    }
    // Получить статистику по проекту
    getProjectStats(projectId) {
        const logs = this.getLogs(projectId);
        const eventsByType = {};
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
    async logProjectCreated(projectId, projectData, triggeredBy = 'user_action') {
        await this.log({
            project_id: projectId,
            event_type: 'project_created',
            details: { projectData },
            trigger: triggeredBy,
            database_state: { after: { project: projectData } }
        });
    }
    async logFileChange(projectId, filePath, action, triggeredBy = 'file_watcher') {
        await this.log({
            project_id: projectId,
            event_type: 'file_changed',
            details: { filePath, action },
            trigger: triggeredBy
        });
    }
    async logCommitCreated(projectId, commitId, commitMessage, filesCount, triggeredBy = 'save_action') {
        await this.log({
            project_id: projectId,
            event_type: 'commit_created',
            details: { commitId, commitMessage, filesCount },
            trigger: triggeredBy
        });
    }
    async logDeployStatusChange(projectId, oldStatus, newStatus, deployUrl, triggeredBy = 'deploy_service') {
        await this.log({
            project_id: projectId,
            event_type: newStatus === 'building' ? 'deploy_building' :
                newStatus === 'ready' ? 'deploy_completed' :
                    newStatus === 'failed' ? 'deploy_failed' : 'deploy_started',
            details: { oldStatus, newStatus, deployUrl },
            trigger: triggeredBy
        });
    }
    async logAgentConnection(projectId, connected, clientId, triggeredBy = 'websocket_connection') {
        await this.log({
            project_id: projectId,
            event_type: connected ? 'agent_connected' : 'agent_disconnected',
            details: { connected, clientId },
            trigger: triggeredBy
        });
    }
    clearLogs(projectId) {
        if (!isServer())
            return;
        try {
            const filePath = this.getLogFilePath(projectId);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        catch (error) {
            console.error(`Error clearing logs for project ${projectId}:`, error);
        }
    }
}
// Экспортируем синглтон логгера
export const projectLogger = ProjectLoggerClass.getInstance();
