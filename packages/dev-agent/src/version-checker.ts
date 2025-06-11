import fs from "fs";
import path from "path";

export interface VersionInfo {
  current: string;
  latest?: string;
  hasUpdate: boolean;
}

/**
 * Получает текущую версию из package.json
 */
export function getCurrentVersion(): string {
  try {
    // В production это будет dist/package.json
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version || '1.0.0';
  } catch (error) {
    // Fallback версия
    return '1.0.0';
  }
}

/**
   * Проверяет последнюю версию с сервера Vybcel
 * В будущем можно расширить для проверки npm registry
 */
export async function checkLatestVersion(wsUrl: string): Promise<string | null> {
  try {
    // Формируем HTTP URL из WebSocket URL
    const httpUrl = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    const versionUrl = `${httpUrl}/api/version`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(versionUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return data.latestAgentVersion || null;
    }
  } catch (error) {
    // Игнорируем ошибки - не критично для работы агента
    if (process.env.DEBUG) {
      console.debug('Failed to check latest version:', error);
    }
  }
  
  return null;
}

/**
 * Сравнивает две версии (семантическое версионирование)
 */
export function isNewerVersion(latest: string, current: string): boolean {
  try {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    
    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const latestPart = latestParts[i] || 0;
      const currentPart = currentParts[i] || 0;
      
      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Выполняет полную проверку версии и возвращает информацию
 */
export async function checkForUpdates(wsUrl: string): Promise<VersionInfo> {
  const current = getCurrentVersion();
  const latest = await checkLatestVersion(wsUrl);
  
  const hasUpdate = latest ? isNewerVersion(latest, current) : false;
  
  return {
    current,
    latest: latest || undefined,
    hasUpdate
  };
} 