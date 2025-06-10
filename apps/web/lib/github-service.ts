import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import type { Response as NodeFetchResponse } from 'node-fetch';

// Интерфейсы для GitHub API
interface GitHubInstallationToken {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
}

interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  content: string;
  encoding: string;
}

interface GitHubCommit {
  sha: string;
  node_id: string;
  url: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
  };
}

interface CreateFileRequest {
  message: string;
  content: string; // Base64 encoded
  branch?: string;
  committer?: {
    name: string;
    email: string;
  };
  author?: {
    name: string;
    email: string;
  };
}

interface UpdateFileRequest extends CreateFileRequest {
  sha: string; // Required for updates
}

interface CreateRepositoryRequest {
  name: string;
  description?: string;
  private: boolean;
  auto_init?: boolean;
  gitignore_template?: string;
  license_template?: string;
}

export class GitHubAppService {
  private readonly appId: string;
  private readonly installationId: string;
  private readonly privateKey: string;
  private readonly baseUrl = 'https://api.github.com';
  private readonly organization = 'shipvibes';

  // Кэш для installation токенов
  private tokenCache: {
    token: string;
    expiresAt: Date;
  } | null = null;

  constructor() {
    this.appId = process.env.GITHUB_APP_ID!;
    this.installationId = process.env.GITHUB_APP_INSTALLATION_ID!;
    this.privateKey = process.env.GITHUB_APP_PRIVATE_KEY!;

    if (!this.appId || !this.installationId || !this.privateKey) {
      throw new Error('GitHub App configuration is missing. Please check environment variables.');
    }

    console.log('✅ GitHubAppService initialized', {
      appId: this.appId,
      installationId: this.installationId,
      organization: this.organization
    });
  }

  /**
   * Генерирует JWT токен для GitHub App
   */
  private generateJWT(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // Issued 60 seconds ago
      exp: now + 600, // Expires in 10 minutes
      iss: this.appId, // Issuer: GitHub App ID
    };

    return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
  }

  /**
   * Получает installation token для GitHub App
   * Токен кэшируется и автоматически обновляется при истечении
   */
  async getInstallationToken(): Promise<string> {
    // Проверяем кэш
    if (this.tokenCache && this.tokenCache.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
      console.log('🔄 Using cached installation token');
      return this.tokenCache.token;
    }

    try {
      const jwtToken = this.generateJWT();
      
      const response = await fetch(`${this.baseUrl}/app/installations/${this.installationId}/access_tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Shipvibes-Bot/1.0',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get installation token: ${response.status} ${error}`);
      }

      const data = await response.json() as GitHubInstallationToken;
      
      // Кэшируем токен (он действует 60 минут, кэшируем на 55 минут)
      this.tokenCache = {
        token: data.token,
        expiresAt: new Date(Date.now() + 55 * 60 * 1000)
      };

      console.log('🔑 Generated new installation token', {
        expiresAt: data.expires_at,
        permissions: Object.keys(data.permissions)
      });

      return data.token;
    } catch (error) {
      console.error('❌ Failed to generate installation token', error);
      throw error;
    }
  }

  /**
   * Выполняет авторизованный запрос к GitHub API
   */
  private async makeAuthenticatedRequest(
    endpoint: string,
    options: any = {}
  ): Promise<NodeFetchResponse> {
    const token = await this.getInstallationToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Shipvibes-Bot/1.0',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    return response;
  }

  /**
   * Создает новый приватный репозиторий в организации shipvibes
   */
  async createRepository(projectId: string, description?: string): Promise<GitHubRepository> {
    const repoName = `shipvibes-project-${projectId}`;
    
    try {
      const requestBody: CreateRepositoryRequest = {
        name: repoName,
        description: description || `Shipvibes project ${projectId}`,
        private: true,
        auto_init: false, // Мы сами создадим initial commit
      };

      const response = await this.makeAuthenticatedRequest(`/orgs/${this.organization}/repos`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create repository: ${response.status} ${error}`);
      }

      const repository = await response.json() as GitHubRepository;
      
      console.log('🎉 Created GitHub repository', {
        projectId,
        repoName: repository.name,
        repoUrl: repository.html_url,
        isPrivate: repository.private
      });

      return repository;
    } catch (error) {
      console.error('❌ Failed to create GitHub repository', { projectId, error });
      throw error;
    }
  }

  /**
   * Создает или обновляет файл в репозитории
   */
  async createOrUpdateFile(
    repoName: string,
    filePath: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<{ sha: string; commit: GitHubCommit }> {
    try {
      const base64Content = Buffer.from(content, 'utf8').toString('base64');
      
      const requestBody: CreateFileRequest | UpdateFileRequest = {
        message,
        content: base64Content,
        branch: 'main',
        committer: {
          name: 'Shipvibes Bot',
          email: 'bot@shipvibes.dev'
        },
        author: {
          name: 'Shipvibes Bot',
          email: 'bot@shipvibes.dev'
        },
        ...(sha ? { sha } : {})
      };

      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/contents/${filePath}`,
        {
          method: 'PUT',
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create/update file: ${response.status} ${error}`);
      }

      const result = await response.json() as any;
      
      console.log('📝 Created/updated file in GitHub', {
        repoName,
        filePath,
        sha: result.content.sha,
        commitSha: result.commit.sha
      });

      return {
        sha: result.content.sha,
        commit: result.commit
      };
    } catch (error) {
      console.error('❌ Failed to create/update file in GitHub', { repoName, filePath, error });
      throw error;
    }
  }

  /**
   * Скачивает ZIP архив репозитория
   */
  async downloadRepositoryZip(repoName: string, ref = 'main'): Promise<Buffer> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/zipball/${ref}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to download repository ZIP: ${response.status} ${error}`);
      }

      const buffer = await response.buffer();
      
      console.log('🔄 Downloaded repository ZIP', {
        repoName,
        ref,
        sizeBytes: buffer.length
      });

      return buffer;
    } catch (error) {
      console.error('❌ Failed to download repository ZIP', { repoName, ref, error });
      throw error;
    }
  }

  /**
   * Удаляет репозиторий из организации
   * ВНИМАНИЕ: Это необратимая операция!
   */
  async deleteRepository(repoName: string): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.text();
        
        // Если репозиторий уже не существует, считаем это успехом
        if (response.status === 404) {
          console.log('⚠️ Repository already deleted or not found', { repoName });
          return;
        }
        
        throw new Error(`Failed to delete repository: ${response.status} ${error}`);
      }

      console.log('🗑️ Deleted GitHub repository', { 
        repoName,
        fullName: `${this.organization}/${repoName}`
      });
    } catch (error) {
      console.error('❌ Failed to delete GitHub repository', { repoName, error });
      throw error;
    }
  }

  /**
   * Получает содержимое файла из репозитория
   */
  async getFileContent(repoName: string, filePath: string, ref = 'main'): Promise<GitHubFileContent> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/contents/${filePath}?ref=${ref}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get file content: ${response.status} ${error}`);
      }

      const fileContent = await response.json() as GitHubFileContent;
      
      console.log('📖 Retrieved file content from GitHub', {
        repoName,
        filePath,
        ref,
        encoding: fileContent.encoding,
        size: fileContent.size
      });

      return fileContent;
    } catch (error) {
      console.error('❌ Failed to get file content from GitHub', { repoName, filePath, ref, error });
      throw error;
    }
  }

  /**
   * Удаляет файл из репозитория
   */
  async deleteFile(
    repoName: string,
    filePath: string,
    message: string,
    sha: string
  ): Promise<{ commit: GitHubCommit }> {
    try {
      const requestBody = {
        message,
        sha,
        branch: 'main',
        committer: {
          name: 'Shipvibes Bot',
          email: 'bot@shipvibes.dev'
        },
        author: {
          name: 'Shipvibes Bot',
          email: 'bot@shipvibes.dev'
        }
      };

      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/contents/${filePath}`,
        {
          method: 'DELETE',
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete file: ${response.status} ${error}`);
      }

      const result = await response.json() as any;
      
      console.log('🗑️ Deleted file from GitHub', {
        repoName,
        filePath,
        commitSha: result.commit.sha
      });

      return {
        commit: result.commit
      };
    } catch (error) {
      console.error('❌ Failed to delete file from GitHub', { repoName, filePath, error });
      throw error;
    }
  }

  /**
   * Получает историю коммитов репозитория
   */
  async getCommits(repoName: string, ref = 'main', perPage = 50): Promise<GitHubCommit[]> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/commits?sha=${ref}&per_page=${perPage}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get commits: ${response.status} ${error}`);
      }

      const commits = await response.json() as GitHubCommit[];
      
      console.log('📋 Retrieved commits from GitHub', {
        repoName,
        ref,
        count: commits.length
      });

      return commits;
    } catch (error) {
      console.error('❌ Failed to get commits from GitHub', { repoName, ref, error });
      throw error;
    }
  }

  /**
   * Создает временный токен доступа для git операций
   * Используется для git pull в локальном агенте
   */
  async createTemporaryToken(): Promise<{ token: string; expiresAt: string }> {
    try {
      const installationToken = await this.getInstallationToken();
      
      // Installation token сам по себе временный (60 минут)
      // Возвращаем его как временный токен для git операций
      const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString();
      
      console.log('🔑 Created temporary git token', { expiresAt });
      
      return {
        token: installationToken,
        expiresAt
      };
    } catch (error) {
      console.error('❌ Failed to create temporary git token', error);
      throw error;
    }
  }

  /**
   * Проверяет статус и доступность GitHub App
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    appId: string;
    installationId: string;
    organization: string;
    tokenValid: boolean;
    error?: string;
  }> {
    try {
      const token = await this.getInstallationToken();
      
      // Проверяем доступ к организации
      const response = await this.makeAuthenticatedRequest(`/orgs/${this.organization}`);
      
      const result = {
        status: response.ok ? 'healthy' as const : 'unhealthy' as const,
        appId: this.appId,
        installationId: this.installationId,
        organization: this.organization,
        tokenValid: !!token,
        ...(response.ok ? {} : { error: `Org access failed: ${response.status}` })
      };

      console.log('🏥 GitHub App health check', result);
      return result;
    } catch (error) {
      const result = {
        status: 'unhealthy' as const,
        appId: this.appId,
        installationId: this.installationId,
        organization: this.organization,
        tokenValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      console.error('❌ GitHub App health check failed', result);
      return result;
    }
  }
}

// Экспортируем singleton instance
export const githubAppService = new GitHubAppService(); 