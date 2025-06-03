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
    try {
      const websocketServerUrl = process.env.WEBSOCKET_SERVER_URL || 'http://localhost:3001';
      const deployResponse = await fetch(`${websocketServerUrl}/api/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          action: 'deploy'
        })
      });

      if (!deployResponse.ok) {
        console.error('Failed to trigger deploy via WebSocket server');
        // Возвращаемся к старому статусу если деплой не удался
        await projectQueries.updateProject(projectId, {
          deploy_status: 'failed'
        });
        
        return NextResponse.json({
          success: false,
          error: 'Failed to trigger deploy'
        }, { status: 500 });
      }

      console.log('Deploy triggered successfully via WebSocket server');
    } catch (error) {
      console.error('Error communicating with WebSocket server:', error);
      // Установим статус failed если что-то пошло не так
      await projectQueries.updateProject(projectId, {
        deploy_status: 'failed'
      });
      
      return NextResponse.json({
        success: false,
        error: 'Failed to communicate with deploy service'
      }, { status: 500 });
    }
    
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