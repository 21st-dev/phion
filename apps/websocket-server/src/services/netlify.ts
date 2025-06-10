import { resolve as resolvePath, dirname, join } from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import os from 'os';
import { downloadTextFile } from '@shipvibes/storage';
import { getSupabaseServerClient, FileHistoryQueries, ProjectQueries, DeployStatusQueries } from '@shipvibes/database';
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
   * Восстановить недостающие файлы из шаблона
   */
  private async restoreTemplateFiles(tempDir: string, existingFiles: Record<string, string>): Promise<void> {
    try {
      // Путь к шаблону vite-react
      const templatePath = resolvePath(process.cwd(), '../../templates/vite-react');
      
      console.log(`📁 Looking for template at: ${templatePath}`);
      
      // Проверяем существование шаблона
      try {
        await fs.access(templatePath);
      } catch {
        // Попробуем другой путь если не нашли
        const alternativePath = resolvePath(process.cwd(), 'templates/vite-react');
        await fs.access(alternativePath);
        console.log(`📁 Using alternative template path: ${alternativePath}`);
      }
      
      // Копируем все файлы из шаблона, которых нет в existingFiles
      async function copyTemplateFiles(srcDir: string, targetDir: string, relativePath: string = '') {
        const items = await fs.readdir(srcDir, { withFileTypes: true });
        
        for (const item of items) {
          // Пропускаем node_modules, .git и другие служебные папки
          if (item.name === 'node_modules' || item.name === '.git' || item.name === 'dist' || item.name === '.next') {
            continue;
          }
          
                     const srcPath = join(srcDir, item.name);
           const targetPath = join(targetDir, item.name);
           const relativeFilePath = relativePath ? join(relativePath, item.name) : item.name;
          
          if (item.isDirectory()) {
            await fs.mkdir(targetPath, { recursive: true });
            await copyTemplateFiles(srcPath, targetPath, relativeFilePath);
          } else {
            // Копируем файл только если его нет в existingFiles
            if (!existingFiles[relativeFilePath]) {
              const content = await fs.readFile(srcPath);
              await fs.writeFile(targetPath, content.toString());
              console.log(`📄 Restored template file: ${relativeFilePath}`);
            }
          }
        }
      }
      
      await copyTemplateFiles(templatePath, tempDir);
      
    } catch (error) {
      console.error(`❌ Error restoring template files:`, error);
      throw error;
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
        if (!existing || 
            (fileRecord.created_at && existing.created_at && new Date(fileRecord.created_at) > new Date(existing.created_at)) ||
            (fileRecord.created_at && !existing.created_at)) {
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
   * Проверить, есть ли файлы для деплоя в проекте
   */
  async hasProjectFiles(projectId: string): Promise<boolean> {
    try {
      const projectFiles = await this.getLatestProjectFiles(projectId);
      
      // Проверяем, есть ли реальные файлы проекта (не служебные)
      const realFiles = Object.keys(projectFiles).filter(filePath => 
        !filePath.startsWith('.shipvibes-') && 
        filePath !== '.gitkeep' &&
        filePath !== '.gitignore' &&
        filePath.trim() !== ''
      );
      
      console.log(`📋 Project ${projectId} has ${realFiles.length} deployable files:`, realFiles.slice(0, 5));
      
      return realFiles.length > 0;
    } catch (error) {
      console.error(`Error checking project files for ${projectId}:`, error);
      return false;
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
   * Создать ZIP архив из собранных файлов проекта (dist/)
   */
  private async createProjectZipBuffer(projectId: string): Promise<Buffer> {
    let tempDir: string | null = null;
    
    try {
      // Получаем файлы проекта из базы данных
      const projectFiles = await this.getLatestProjectFiles(projectId);
      
      if (Object.keys(projectFiles).length === 0) {
        throw new Error(`No files found for project ${projectId}`);
      }
      
      // Создаем временную директорию для проекта
             tempDir = await fs.mkdtemp(join(os.tmpdir(), `shipvibes-project-${projectId}-`));
      console.log(`📁 Created temp directory: ${tempDir}`);
      
      // Восстанавливаем файлы проекта во временной директории
      for (const [filePath, content] of Object.entries(projectFiles)) {
                 const fullPath = join(tempDir, filePath);
         const dir = dirname(fullPath);
        
        // Создаем директории если нужно
        await fs.mkdir(dir, { recursive: true });
        
        // Записываем файл
        if (typeof content === 'string') {
          await fs.writeFile(fullPath, content, 'utf8');
        } else if (Buffer.isBuffer(content)) {
          await fs.writeFile(fullPath, content);
        }
      }
      
      console.log(`📦 Project files restored to ${tempDir}`);
      
      // Логируем какие файлы были восстановлены для отладки
      console.log(`📋 Restored files:`, Object.keys(projectFiles));
      
      // Проверяем наличие package.json и восстанавливаем из шаблона если нужно
      if (!projectFiles['package.json']) {
        console.warn(`⚠️ package.json not found in project files, restoring from template...`);
        await this.restoreTemplateFiles(tempDir, projectFiles);
        console.log(`✅ Template files restored`);
      }
      
      // Устанавливаем зависимости
      console.log(`📦 Installing dependencies...`);
      try {
        await execAsync('pnpm install', { cwd: tempDir });
        console.log(`✅ Dependencies installed`);
      } catch (installError) {
        console.warn(`⚠️ Failed to install with pnpm, trying npm:`, installError);
        await execAsync('npm install', { cwd: tempDir });
        console.log(`✅ Dependencies installed with npm`);
      }
      
      // Собираем проект
      console.log(`🔨 Building project...`);
      try {
        await execAsync('pnpm build', { cwd: tempDir });
        console.log(`✅ Project built successfully`);
      } catch (buildError) {
        console.warn(`⚠️ Failed to build with pnpm, trying npm:`, buildError);
        await execAsync('npm run build', { cwd: tempDir });
        console.log(`✅ Project built successfully with npm`);
      }
      
      // Проверяем наличие папки dist
             const distPath = join(tempDir, 'dist');
      try {
        await fs.access(distPath);
        console.log(`📁 Found dist directory at ${distPath}`);
      } catch {
        throw new Error(`Build did not create dist/ directory. Check if build script is configured correctly.`);
      }
      
      // Создаем ZIP архив только из папки dist
      const zip = new AdmZip();
      
      async function addDirectoryToZip(dirPath: string, zipPath: string = '') {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const item of items) {
                     const fullPath = join(dirPath, item.name);
           const zipItemPath = zipPath ? join(zipPath, item.name) : item.name;
          
          if (item.isDirectory()) {
            await addDirectoryToZip(fullPath, zipItemPath);
          } else {
            const content = await fs.readFile(fullPath);
            zip.addFile(zipItemPath, content);
          }
        }
      }
      
      await addDirectoryToZip(distPath);
      console.log(`📦 Created ZIP archive from dist directory`);

      // Возвращаем ZIP как Buffer
      return zip.toBuffer();
    } catch (error) {
      console.error('❌ Error creating project ZIP:', error);
      throw error;
    } finally {
      // Очищаем временную директорию
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
          console.log(`🗑️ Cleaned up temp directory: ${tempDir}`);
        } catch (cleanupError) {
          console.warn(`⚠️ Failed to cleanup temp directory:`, cleanupError);
        }
      }
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
      
      if (!project || !project.netlify_site_id || !project.netlify_deploy_id) {
        console.log(`⚠️ Cannot check status: project ${projectId} not found or missing Netlify IDs`);
        return;
      }
      
      // Получаем статус деплоя из Netlify
      const deployInfo = await this.getDeployStatus(project.netlify_site_id, project.netlify_deploy_id);
      
      console.log(`📊 Netlify deploy status for ${projectId}: ${deployInfo.state}`);
      
      // Проверяем, изменился ли статус
      if (
        (deployInfo.state === 'ready' && project.deploy_status !== 'ready') ||
        (deployInfo.state === 'error' && project.deploy_status !== 'failed')
      ) {
        // Обновляем статус в базе данных
        const newStatus = deployInfo.state === 'ready' ? 'ready' : 'failed';
        
        await projectQueries.updateProject(projectId, {
          deploy_status: newStatus,
          netlify_url: deployInfo.deploy_url || project.netlify_url || undefined
        });

        // Логируем изменение статуса деплоя
        const oldStatus = project.deploy_status || 'building';
        await projectLogger.logDeployStatusChange(
          projectId,
          oldStatus,
          newStatus,
          deployInfo.deploy_url,
          'netlify_webhook'
        );
        
        // Отправляем уведомление через WebSocket
        if (this.io) {
          this.io.to(projectId).emit('deploy_status_update', {
            projectId,
            status: newStatus,
            url: deployInfo.deploy_url,
            timestamp: new Date().toISOString()
          });
          
          console.log(`📡 Emitted deploy status update: ${newStatus} - ${deployInfo.deploy_url || 'no URL'}`);
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
   * Деплой проекта на Netlify с автоматической проверкой статуса
   */
  async deployProject(
    siteId: string, 
    projectId: string, 
    commitId: string,
    title: string = 'Update from Shipvibes'
  ): Promise<NetlifyDeployResponse> {
    const supabase = getSupabaseServerClient();
    const deployStatusQueries = new DeployStatusQueries(supabase);
    
    // Создаем запись о статусе деплоя
    const deployStatus = await deployStatusQueries.createDeployStatus(projectId, commitId, 'pending');
    
    try {
      console.log(`🚀 Starting deploy for site ${siteId}...`);
      
      // Уведомляем клиентов о начале деплоя
      this.emitDeployStatus(projectId, deployStatus.id, 'pending', 'Starting deployment...');
      
      // Обновляем статус: создание архива
      await deployStatusQueries.updateDeployStatus(deployStatus.id, { 
        status: 'building', 
        step: 'creating_archive' 
      });
      this.emitDeployStatus(projectId, deployStatus.id, 'building', 'Creating deployment archive...');
      
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