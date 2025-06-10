// Реэкспорт ProjectLogger для использования на сервере
// Этот файл импортируется только на сервере

export { projectLogger } from './utils/project-logger';
export type { ProjectLogEntry, ProjectEventType } from './utils/project-logger'; 