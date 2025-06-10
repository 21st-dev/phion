import { promisify } from 'util';
import { exec } from 'child_process';
import fetch from 'node-fetch';
import { getSupabaseServerClient, ProjectQueries } from '@shipvibes/database';
import { projectLogger } from '@shipvibes/shared/dist/project-logger-server';

const execAsync = promisify(exec);

interface NetlifyCreateSiteResponse {
  id: string;
  url: string;
  admin_url: string;
  name: string;
  ssl_url?: string;
}

interface NetlifyDeployResponse {
  id: string;
  url: string;
  deploy_url: string;
  state: 'new' | 'building' | 'ready' | 'error' | 'enqueued';
  error_message?: string;
}

export class NetlifyService {
  private accessToken: string;
  private baseUrl = 'https://api.netlify.com/api/v1';
  private io?: any; // Socket.io instance для real-time обновлений

  constructor(io?: any) {
    this.accessToken = process.env.NETLIFY_ACCESS_TOKEN!;
    this.io = io;
    
    if (!this.accessToken) {
      throw new Error('NETLIFY_ACCESS_TOKEN environment variable is required');
    }
  }

  /**
   * В новой архитектуре GitHub + Netlify не нужно проверять файлы
   * Netlify автоматически получает код из GitHub репозитория
   */
  async hasProjectFiles(projectId: string): Promise<boolean> {
    console.log(`📋 GitHub архитектура: проект ${projectId} деплоится автоматически из GitHub`);
    return true; // Всегда true, так как Netlify работает с GitHub
  }

  /**
   * Создать новый сайт на Netlify
   */
  async createSite(projectId: string, projectName: string): Promise<NetlifyCreateSiteResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/sites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `shipvibes-${projectId.slice(0, 8)}`,
          created_via: 'shipvibes-dev',
          session_id: projectId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create Netlify site: ${response.status} ${errorText}`);
      }

      const data = await response.json() as NetlifyCreateSiteResponse;
      console.log(`✅ Created Netlify site: ${data.url}`);
      
      return data;
    } catch (error) {
      console.error('❌ Error creating Netlify site:', error);
      throw error;
    }
  }

  /**
   * Проверить и обновить статус деплоя в базе данных
   */
  async checkAndUpdateDeployStatus(projectId: string): Promise<void> {
    try {
      // Получаем текущий проект
      const supabase = getSupabaseServerClient();
      const projectQueries = new ProjectQueries(supabase);
      const project = await projectQueries.getProjectById(projectId);
      
      if (!project || !project.netlify_site_id) {
        console.log(`⚠️ Cannot check status: project ${projectId} not found or missing netlify_site_id`);
        return;
      }
      
      // Если нет deploy_id, получаем последний деплой для сайта
      let deployInfo: NetlifyDeployResponse;
      
      if (project.netlify_deploy_id) {
        // Используем конкретный deploy_id если есть
        deployInfo = await this.getDeployStatus(project.netlify_site_id, project.netlify_deploy_id);
      } else {
        // Получаем последний деплой для сайта
        deployInfo = await this.getLatestDeploy(project.netlify_site_id);
      }
      
      console.log(`📊 Netlify deploy status for ${projectId}: ${deployInfo.state}`);
      
      // Проверяем, изменился ли статус
      if (
        (deployInfo.state === 'ready' && project.deploy_status !== 'ready') ||
        (deployInfo.state === 'error' && project.deploy_status !== 'failed')
      ) {
        // Обновляем статус в базе данных
        const newStatus = deployInfo.state === 'ready' ? 'ready' : 'failed';
        
        const updateData: any = {
          deploy_status: newStatus,
          netlify_deploy_id: deployInfo.id
        };

        // Получаем правильный URL сайта
        if (newStatus === 'ready') {
          try {
            const siteInfo = await this.getSite(project.netlify_site_id);
            const finalUrl = siteInfo.ssl_url || siteInfo.url;
            updateData.netlify_url = finalUrl;
            console.log(`🌐 Final site URL: ${finalUrl}`);
          } catch (siteError) {
            console.error(`⚠️ Could not get site info for URL: ${siteError}`);
            // Fallback to deploy URL if available
            if (deployInfo.deploy_url) {
              updateData.netlify_url = deployInfo.deploy_url;
            }
          }
        }

        await projectQueries.updateProject(projectId, updateData);

        // Логируем изменение статуса деплоя
        const oldStatus = project.deploy_status || 'building';
        await projectLogger.logDeployStatusChange(
          projectId,
          oldStatus,
          newStatus,
          updateData.netlify_url,
          'netlify_polling'
        );
        
        // Отправляем уведомление через WebSocket
        if (this.io) {
          this.io.to(projectId).emit('deploy_status_update', {
            projectId,
            status: newStatus,
            url: updateData.netlify_url,
            timestamp: new Date().toISOString()
          });
          
          console.log(`📡 Emitted deploy status update: ${newStatus} - ${updateData.netlify_url || 'no URL'}`);
        }
      }
      
      // Если статус все еще building, запланируем еще одну проверку
      if (deployInfo.state === 'building' || deployInfo.state === 'enqueued' || deployInfo.state === 'new') {
        setTimeout(() => {
          this.checkAndUpdateDeployStatus(projectId).catch(err => {
            console.error(`❌ Error checking deploy status: ${err.message}`);
          });
        }, 10000); // Проверяем каждые 10 секунд
      }
      
    } catch (error) {
      console.error(`❌ Error checking deploy status:`, error);
      // Продолжим пытаться, пока не получим ответ
      setTimeout(() => {
        this.checkAndUpdateDeployStatus(projectId).catch(() => {
          // Игнорируем ошибки внутри обработчика таймаута
        });
      }, 15000); // Увеличенный интервал при ошибке
    }
  }

  /**
   * Получить последний деплой для сайта
   */
  async getLatestDeploy(siteId: string): Promise<NetlifyDeployResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/${siteId}/deploys?per_page=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get latest deploy: ${response.status} ${errorText}`);
      }

      const deploys = await response.json() as NetlifyDeployResponse[];
      
      if (!deploys || deploys.length === 0) {
        throw new Error(`No deploys found for site ${siteId}`);
      }

      return deploys[0];
    } catch (error) {
      console.error('❌ Error getting latest deploy:', error);
      throw error;
    }
  }

  /**
   * В новой GitHub архитектуре Netlify автоматически деплоит из GitHub
   * Эта функция только отмечает статус и возвращает мок ответ
   */
  async deployProject(
    siteId: string, 
    projectId: string, 
    commitId: string,
    title: string = 'Update from Shipvibes'
  ): Promise<NetlifyDeployResponse> {
    console.log(`🚀 GitHub архитектура: Netlify автоматически деплоит commit ${commitId} для сайта ${siteId}`);
    
    // Возвращаем мок ответ, так как реальный деплой происходит автоматически
    const mockResponse: NetlifyDeployResponse = {
      id: `auto-deploy-${Date.now()}`,
      url: `https://${siteId}.netlify.app`,
      deploy_url: `https://${siteId}.netlify.app`,
      state: 'building'
    };
    
    console.log(`✅ Netlify автодеплой инициирован: ${mockResponse.deploy_url}`);
    
    // Запускаем проверку статуса через 10 секунд (дольше, так как GitHub webhook может быть медленным)
    setTimeout(() => {
      this.checkAndUpdateDeployStatus(projectId).catch(error => {
        console.error(`❌ Error starting deploy status check for project ${projectId}:`, error);
      });
    }, 10000);
    
    return mockResponse;
  }

  /**
   * Получить статус деплоя
   */
  async getDeployStatus(siteId: string, deployId: string): Promise<NetlifyDeployResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/${siteId}/deploys/${deployId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get deploy status: ${response.status} ${errorText}`);
      }

      return await response.json() as NetlifyDeployResponse;
    } catch (error) {
      console.error('❌ Error getting deploy status:', error);
      throw error;
    }
  }

  /**
   * Получить информацию о сайте
   */
  async getSite(siteId: string): Promise<NetlifyCreateSiteResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/${siteId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get site info: ${response.status} ${errorText}`);
      }

      return await response.json() as NetlifyCreateSiteResponse;
    } catch (error) {
      console.error('❌ Error getting site info:', error);
      throw error;
    }
  }

  /**
   * Удалить сайт
   */
  async deleteSite(siteId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/${siteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete site: ${response.status} ${errorText}`);
      }

      console.log(`✅ Deleted Netlify site: ${siteId}`);
    } catch (error) {
      console.error('❌ Error deleting site:', error);
      throw error;
    }
  }

  /**
   * Проверить статус всех активных деплоев
   */
  async checkAllActiveDeployments(): Promise<void> {
    try {
      const supabase = getSupabaseServerClient();
      const projectQueries = new ProjectQueries(supabase);
      
      // Получаем все проекты со статусом "building"
      const buildingProjects = await projectQueries.getProjectsByDeployStatus('building');
      
      console.log(`🔍 Found ${buildingProjects.length} projects with building status`);
      
      // Проверяем статус каждого проекта
      for (const project of buildingProjects) {
        if (project.netlify_deploy_id) {
          console.log(`🔄 Checking status for project ${project.id}`);
          await this.checkAndUpdateDeployStatus(project.id);
          
          // Небольшая задержка между запросами, чтобы не перегружать API
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('❌ Error checking all active deployments:', error);
    }
  }
  
  /**
   * Отправить обновление статуса деплоя через WebSocket
   */
  private emitDeployStatus(projectId: string, deployStatusId: string, status: string, message: string) {
    if (this.io) {
      this.io.emit('deploy_status_update', {
        projectId,
        deployStatusId,
        status,
        message,
        timestamp: new Date().toISOString()
      });
      console.log(`📡 Emitted deploy status update: ${status} - ${message}`);
    }
  }
} 