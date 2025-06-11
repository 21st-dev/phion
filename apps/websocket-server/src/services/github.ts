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
  private readonly organization = 'vybcel';

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
          'User-Agent': 'Vybcel-Bot/1.0',
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
        'User-Agent': 'Vybcel-Bot/1.0',
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
    const repoName = `vybcel-project-${projectId}`;
    
    try {
      const requestBody: CreateRepositoryRequest = {
        name: repoName,
        description: description || `Vybcel project ${projectId}`,
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
      let fileSha = sha;
      
      // Если SHA не предоставлен, пытаемся получить существующий файл
      if (!fileSha) {
        try {
          const existingFile = await this.getFileContent(repoName, filePath);
          fileSha = existingFile.sha;
          console.log('🔍 Found existing file, using SHA for update:', fileSha);
        } catch (error) {
          // Файл не существует, создаем новый (SHA не нужен)
          console.log('📄 File does not exist, creating new file');
        }
      }
      
      const base64Content = Buffer.from(content, 'utf8').toString('base64');
      
      const requestBody: CreateFileRequest | UpdateFileRequest = {
        message,
        content: base64Content,
        branch: 'main',
        committer: {
          name: 'Vybcel Bot',
          email: 'bot@vybcel.com'
        },
        author: {
          name: 'Vybcel Bot',
          email: 'bot@vybcel.com'
        },
        ...(fileSha ? { sha: fileSha } : {})
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
        action: fileSha ? 'updated' : 'created',
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
   * Получает содержимое файла из репозитория
   */
  async getFileContent(repoName: string, filePath: string, ref = 'main'): Promise<GitHubFileContent> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/contents/${filePath}?ref=${ref}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`File not found: ${filePath}`);
        }
        const error = await response.text();
        throw new Error(`Failed to get file content: ${response.status} ${error}`);
      }

      const fileContent = await response.json() as GitHubFileContent;
      
      // Декодируем содержимое из base64
      if (fileContent.encoding === 'base64') {
        fileContent.content = Buffer.from(fileContent.content, 'base64').toString('utf8');
      }

      return fileContent;
    } catch (error) {
      console.error('❌ Failed to get file content from GitHub', { repoName, filePath, error });
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
  ): Promise<GitHubCommit> {
    try {
      const requestBody = {
        message,
        sha,
        branch: 'main',
        committer: {
          name: 'Vybcel Bot',
          email: 'bot@vybcel.com'
        },
        author: {
          name: 'Vybcel Bot',
          email: 'bot@vybcel.com'
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

      return result.commit;
    } catch (error) {
      console.error('❌ Failed to delete file from GitHub', { repoName, filePath, error });
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
   * Получает список коммитов в репозитории
   */
  async getCommits(repoName: string, branch = 'main', limit = 30): Promise<GitHubCommit[]> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${this.organization}/${repoName}/commits?sha=${branch}&per_page=${limit}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get commits: ${response.status} ${error}`);
      }

      const commits = await response.json() as GitHubCommit[];
      
      console.log('📊 Retrieved commits from GitHub', {
        repoName,
        branch,
        commitsCount: commits.length
      });

      return commits;
    } catch (error) {
      console.error('❌ Failed to get commits from GitHub', { repoName, branch, error });
      throw error;
    }
  }

  /**
   * Создает временный токен для git операций (для локального агента)
   */
  async createTemporaryToken(): Promise<string> {
    // Возвращаем installation token, который действует 60 минут
    // Этого достаточно для локальных git операций
    return this.getInstallationToken();
  }

  /**
   * Проверяет доступность GitHub API и статус GitHub App
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; details: any }> {
    try {
      const token = await this.getInstallationToken();
      
      // Проверяем доступ к организации
      const response = await this.makeAuthenticatedRequest(`/orgs/${this.organization}`);
      
      if (!response.ok) {
        const error = await response.text();
        return {
          status: 'error',
          details: { message: `Organization access failed: ${response.status} ${error}` }
        };
      }

      const orgData = await response.json() as any;
      
      return {
        status: 'ok',
        details: {
          organization: orgData.login,
          appId: this.appId,
          installationId: this.installationId,
          tokenExpiresAt: this.tokenCache?.expiresAt
        }
      };
    } catch (error) {
      console.error('❌ GitHub health check failed', { error });
      return {
        status: 'error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// Экспортируем singleton instance
export const githubAppService = new GitHubAppService(); 