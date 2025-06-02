import fetch from 'node-fetch';
import FormData from 'form-data';
import AdmZip from 'adm-zip';
import { downloadTextFile } from '@shipvibes/storage';
import { getSupabaseServerClient, FileHistoryQueries } from '@shipvibes/database';

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
   * Деплой проекта на Netlify
   */
  async deployProject(
    siteId: string, 
    projectId: string, 
    title: string = 'Auto-deploy from Shipvibes'
  ): Promise<NetlifyDeployResponse> {
    try {
      console.log(`🚀 Starting deploy for site ${siteId}...`);
      
      // Создаем ZIP архив проекта
      const zipBuffer = await this.createProjectZipBuffer(projectId);
      console.log(`📦 Created ZIP archive (${zipBuffer.length} bytes)`);

      // Создаем FormData для отправки
      const formData = new FormData();
      formData.append('title', title);
      formData.append('zip', zipBuffer, {
        filename: 'project.zip',
        contentType: 'application/zip',
      });

      // Отправляем на Netlify
      const response = await fetch(`${this.baseUrl}/sites/${siteId}/builds`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          ...formData.getHeaders(),
        },
        body: formData as any,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to deploy to Netlify: ${response.status} ${errorText}`);
      }

      const data = await response.json() as NetlifyDeployResponse;
      console.log(`✅ Deploy initiated: ${data.deploy_url}`);
      
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
} 