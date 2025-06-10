import fetch from 'node-fetch';

interface NetlifyCreateSiteRequest {
  name: string;
  repo?: {
    provider: "github";
    repo: string;
    private: boolean;
    branch: string;
    installation_id: number;
  };
}

interface NetlifyCreateSiteResponse {
  id: string;
  url: string;
  admin_url: string;
  name: string;
  ssl_url?: string;
  build_settings?: {
    repo_url?: string;
    repo_branch?: string;
    deploy_key_id?: string;
  };
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
   * Создает новый Netlify сайт с привязкой к GitHub репозиторию
   */
  async createSiteWithGitHub(
    projectId: string,
    projectName: string,
    githubRepoName: string,
    githubOwner: string
  ): Promise<NetlifyCreateSiteResponse> {
    try {
      // GitHub App Installation ID для организации shipvibes
      const installationId = parseInt(process.env.GITHUB_APP_INSTALLATION_ID!);
      
      const requestBody: NetlifyCreateSiteRequest = {
        name: `shipvibes-${projectId.slice(0, 8)}`,
        repo: {
          provider: "github",
          repo: `${githubOwner}/${githubRepoName}`,
          private: true,
          branch: "main",
          installation_id: installationId
        }
      };

      console.log('🌐 Creating Netlify site with GitHub integration:', {
        projectId,
        repoName: githubRepoName,
        installationId
      });

      const response = await fetch(`${this.baseUrl}/sites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create Netlify site: ${response.status} ${errorText}`);
      }

      const data = await response.json() as NetlifyCreateSiteResponse;
      
      console.log('✅ Created Netlify site with GitHub integration:', {
        siteId: data.id,
        url: data.ssl_url || data.url,
        deployKeyId: data.build_settings?.deploy_key_id
      });
      
      return data;
    } catch (error) {
      console.error('❌ Error creating Netlify site with GitHub:', error);
      throw error;
    }
  }

  /**
   * Получает информацию о сайте
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
        const error = await response.text();
        throw new Error(`Failed to get site info: ${response.status} ${error}`);
      }

      return await response.json() as NetlifyCreateSiteResponse;
    } catch (error) {
      console.error('❌ Error getting site info:', error);
      throw error;
    }
  }

  /**
   * Удаляет сайт
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
        const error = await response.text();
        throw new Error(`Failed to delete site: ${response.status} ${error}`);
      }

      console.log(`✅ Deleted Netlify site: ${siteId}`);
    } catch (error) {
      console.error('❌ Error deleting site:', error);
      throw error;
    }
  }
}

// Экспортируем singleton instance
export const netlifyService = new NetlifyService(); 