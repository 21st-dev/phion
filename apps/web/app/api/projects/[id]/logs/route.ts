import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { projectLogger } from '@shipvibes/shared/project-logger-server';

// Маршрут API для получения логов проекта
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Получаем логи из директории web
    const webLogs = projectLogger.getLogs(projectId);
    
    // Пытаемся получить логи из директории websocket-server
    let wsLogs = [];
    try {
      const wsLogsPath = path.join(process.cwd(), '..', 'websocket-server', 'logs', 'projects', `${projectId}.json`);
      if (fs.existsSync(wsLogsPath)) {
        const wsLogsContent = fs.readFileSync(wsLogsPath, 'utf-8');
        wsLogs = JSON.parse(wsLogsContent);
      }
    } catch (error) {
      console.error('Error reading websocket logs:', error);
    }
    
    // Объединяем логи и сортируем по timestamp
    const allLogs = [...webLogs, ...wsLogs].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    // Возвращаем только запрошенное количество логов
    const limitedLogs = limit ? allLogs.slice(0, limit) : allLogs;
    
    return NextResponse.json(limitedLogs);
  } catch (error) {
    console.error('Error getting project logs:', error);
    return NextResponse.json(
      { error: 'Failed to get project logs' },
      { status: 500 }
    );
  }
} 