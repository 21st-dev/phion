import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient, ProjectQueries } from '@shipvibes/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Получаем проект из базы данных
    const supabase = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabase);
    
    const project = await projectQueries.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Обновляем статус деплоя на "building"
    await projectQueries.updateProject(projectId, {
      deploy_status: 'building'
    });

    // Отправляем запрос на деплой через WebSocket сервер
    // В реальной реализации здесь будет HTTP запрос к WebSocket серверу
    // Пока что просто возвращаем успешный ответ
    
    return NextResponse.json({
      success: true,
      message: 'Deploy triggered successfully',
      project: {
        id: project.id,
        name: project.name,
        deploy_status: 'building',
        netlify_url: project.netlify_url
      }
    });

  } catch (error) {
    console.error('Error triggering deploy:', error);
    return NextResponse.json(
      { error: 'Failed to trigger deploy' },
      { status: 500 }
    );
  }
} 