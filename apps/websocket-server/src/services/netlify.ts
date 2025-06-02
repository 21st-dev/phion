import fetch from 'node-fetch';
import FormData from 'form-data';
import AdmZip from 'adm-zip';
import { downloadTextFile } from '@shipvibes/storage';
import { getSupabaseServerClient, FileHistoryQueries, ProjectQueries } from '@shipvibes/database';

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
  state: 'new' | 'building' | 'ready' | 'error';
  error_message?: string;
}

export class NetlifyService {
  private accessToken: string;
  private baseUrl = 'https://api.netlify.com/api/v1';

  constructor() {
    this.accessToken = process.env.NETLIFY_ACCESS_TOKEN!;
    
    if (!this.accessToken) {
      throw new Error('NETLIFY_ACCESS_TOKEN environment variable is required');
    }
  }

  /**
   * Получить последние версии всех файлов проекта из базы данных
   */
  private async getLatestProjectFiles(projectId: string): Promise<Record<string, string>> {
    try {
      const supabase = getSupabaseServerClient();
      const historyQueries = new FileHistoryQueries(supabase);
      
      // Получаем всю историю файлов для проекта
      const allHistory = await historyQueries.getProjectFileHistory(projectId, 1000);
      
      if (allHistory.length === 0) {
        console.warn(`No file history found for project ${projectId}`);
        return {};
      }
      
      // Группируем по file_path и берем последнюю версию каждого файла
      const latestFiles = new Map<string, typeof allHistory[0]>();
      
      for (const fileRecord of allHistory) {
        const existing = latestFiles.get(fileRecord.file_path);
        if (!existing || new Date(fileRecord.created_at) > new Date(existing.created_at)) {
          latestFiles.set(fileRecord.file_path, fileRecord);
        }
      }
      
      // Скачиваем содержимое каждого файла
      const files: Record<string, string> = {};
      
      for (const [filePath, fileRecord] of latestFiles) {
        try {
          const content = await downloadTextFile(fileRecord.r2_object_key);
          files[filePath] = content;
        } catch (error) {
          console.warn(`Failed to download file ${filePath}:`, error);
          // Пропускаем файлы, которые не удалось скачать
        }
      }
      
      return files;
    } catch (error) {
      console.error(`Error getting latest project files: ${error}`);
      return {};
    }
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
   * Создать ZIP архив из файлов проекта
   */
  private async createProjectZipBuffer(projectId: string): Promise<Buffer> {
    try {
      // Получаем файлы проекта из базы данных
      const projectFiles = await this.getLatestProjectFiles(projectId);
      
      if (Object.keys(projectFiles).length === 0) {
        throw new Error(`No files found for project ${projectId}`);
      }
      
      // Создаем ZIP архив с помощью AdmZip
      const zip = new AdmZip();
      
      // Добавляем файлы в архив
      for (const [filePath, content] of Object.entries(projectFiles)) {
        // Убираем ведущий слеш если есть
        const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
        
        if (typeof content === 'string') {
          zip.addFile(normalizedPath, Buffer.from(content, 'utf8'));
        } else if (Buffer.isBuffer(content)) {
          zip.addFile(normalizedPath, content);
        }
      }

      // Возвращаем ZIP как Buffer
      return zip.toBuffer();
    } catch (error) {
      console.error('❌ Error creating project ZIP:', error);
      throw error;
    }
  }

  /**
   * Проверить и обновить статус деплоя в базе данных
   */
  async checkAndUpdateDeployStatus(projectId: string): Promise<void> {
    try {
      const supabase = getSupabaseServerClient();
      const projectQueries = new ProjectQueries(supabase);
      
      // Получаем проект из базы данных
      const project = await projectQueries.getProjectById(projectId);
      if (!project || !project.netlify_site_id || !project.netlify_deploy_id) {
        console.warn(`❌ Cannot check deploy status for project ${projectId}: missing site_id or deploy_id`);
        return;
      }
      
      console.log(`🔍 Checking deploy status for project ${projectId}, deploy ${project.netlify_deploy_id}`);
      
      const deployStatus = await this.getDeployStatus(project.netlify_site_id, project.netlify_deploy_id);
      
      // Обновляем статус в базе данных
      let dbStatus: 'ready' | 'building' | 'failed';
      
      switch (deployStatus.state) {
        case 'ready':
          dbStatus = 'ready';
          console.log(`✅ Deploy completed for project ${projectId}`);
          break;
        case 'error':
          dbStatus = 'failed';
          console.log(`❌ Deploy failed for project ${projectId}: ${deployStatus.error_message || 'Unknown error'}`);
          break;
        case 'building':
        case 'new':
        default:
          dbStatus = 'building';
          console.log(`🔄 Deploy still in progress for project ${projectId}: ${deployStatus.state}`);
          break;
      }
      
      await projectQueries.updateProject(projectId, {
        deploy_status: dbStatus,
        netlify_url: deployStatus.deploy_url || deployStatus.url
      });
      
      console.log(`📊 Updated deploy status for project ${projectId}: ${dbStatus}`);
      
      // Если деплой еще не завершен, проверим еще раз через 10 секунд
      if (dbStatus === 'building') {
        setTimeout(() => {
          this.checkAndUpdateDeployStatus(projectId).catch(error => {
            console.error(`❌ Error checking deploy status for project ${projectId}:`, error);
          });
        }, 10000); // 10 секунд
      }
      
    } catch (error) {
      console.error(`❌ Error checking deploy status for project ${projectId}:`, error);
      
      // В случае ошибки проверки, отмечаем как failed
      try {
        const supabase = getSupabaseServerClient();
        const projectQueries = new ProjectQueries(supabase);
        await projectQueries.updateProject(projectId, {
          deploy_status: 'failed'
        });
      } catch (updateError) {
        console.error(`❌ Error updating failed status for project ${projectId}:`, updateError);
      }
    }
  }

  /**
   * Деплой проекта на Netlify с автоматической проверкой статуса
   */
  async deployProject(
    siteId: string, 
    projectId: string, 
    title: string = 'Update from Shipvibes'
  ): Promise<NetlifyDeployResponse> {
    try {
      console.log(`🚀 Starting deploy for site ${siteId}...`);
      
      // Создаем ZIP архив проекта
      const zipBuffer = await this.createProjectZipBuffer(projectId);
      console.log(`📦 Created ZIP archive (${zipBuffer.length} bytes)`);

      // Отправляем на Netlify
      const response = await fetch(`${this.baseUrl}/sites/${siteId}/deploys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/zip',
          'Content-Length': zipBuffer.length.toString(),
        },
        body: zipBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to deploy to Netlify: ${response.status} ${errorText}`);
      }

      const data = await response.json() as NetlifyDeployResponse;
      
      // Добавляем детальное логирование ответа от API
      console.log(`📋 Full Netlify API response:`, JSON.stringify(data, null, 2));
      console.log(`🆔 Deploy ID: ${data.id}`);
      console.log(`🌐 Deploy URL: ${data.deploy_url}`);
      console.log(`📊 State: ${data.state}`);
      
      console.log(`✅ Deploy initiated: ${data.deploy_url || data.url || 'No URL'}`);
      
      // Запускаем проверку статуса через 5 секунд
      setTimeout(() => {
        this.checkAndUpdateDeployStatus(projectId).catch(error => {
          console.error(`❌ Error starting deploy status check for project ${projectId}:`, error);
        });
      }, 5000);
      
      return data;
    } catch (error) {
      console.error('❌ Error deploying to Netlify:', error);
      throw error;
    }
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
} 