#!/usr/bin/env tsx

/**
 * Диагностический скрипт для проверки GitHub App настроек
 * Использование: pnpm tsx scripts/diagnose-github-app.ts
 */

import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

// Загружаем переменные окружения
dotenv.config({ path: '.env.local' });
dotenv.config(); // Загружаем также .env как fallback

interface GitHubAppInfo {
  id: number;
  name: string;
  owner: {
    login: string;
    type: string;
  };
  permissions: Record<string, string>;
  events: string[];
  installations_count: number;
}

interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    type: string;
  };
  permissions: Record<string, string>;
  repository_selection: string;
}

interface GitHubInstallationToken {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
  }>;
}

class GitHubAppDiagnostic {
  private readonly appId: string;
  private readonly installationId: string;
  private readonly privateKey: string;
  private readonly baseUrl = 'https://api.github.com';

  constructor() {
    this.appId = process.env.GITHUB_APP_ID || '';
    this.installationId = process.env.GITHUB_APP_INSTALLATION_ID || '';
    this.privateKey = process.env.GITHUB_APP_PRIVATE_KEY || '';

    console.log('🔍 GitHub App Diagnostic Tool');
    console.log('============================\n');
  }

  /**
   * Проверяет наличие всех необходимых переменных окружения
   */
  checkEnvironmentVariables(): boolean {
    console.log('1️⃣ Проверка переменных окружения:');
    
    let allPresent = true;
    
    if (!this.appId) {
      console.log('❌ GITHUB_APP_ID не установлен');
      allPresent = false;
    } else {
      console.log(`✅ GITHUB_APP_ID: ${this.appId}`);
    }
    
    if (!this.installationId) {
      console.log('❌ GITHUB_APP_INSTALLATION_ID не установлен');
      allPresent = false;
    } else {
      console.log(`✅ GITHUB_APP_INSTALLATION_ID: ${this.installationId}`);
    }
    
    if (!this.privateKey) {
      console.log('❌ GITHUB_APP_PRIVATE_KEY не установлен');
      allPresent = false;
    } else {
      console.log(`✅ GITHUB_APP_PRIVATE_KEY: присутствует (${this.privateKey.length} символов)`);
    }
    
    console.log('');
    return allPresent;
  }

  /**
   * Генерирует JWT токен для GitHub App
   */
  generateJWT(): string {
    try {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iat: now - 60,
        exp: now + (10 * 60),
        iss: this.appId,
      };

      return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
    } catch (error) {
      throw new Error(`Failed to generate JWT: ${error}`);
    }
  }

  /**
   * Проверяет информацию о GitHub App
   */
  async checkAppInfo(): Promise<GitHubAppInfo | null> {
    console.log('2️⃣ Проверка информации о GitHub App:');
    
    try {
      const jwtToken = this.generateJWT();
      console.log('✅ JWT токен сгенерирован успешно');

      const response = await fetch(`${this.baseUrl}/app`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Shipvibes-Diagnostic/1.0',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.log(`❌ Ошибка получения информации о App: ${response.status} ${error}`);
        return null;
      }

      const appInfo = await response.json() as GitHubAppInfo;
      
      console.log(`✅ App Name: ${appInfo.name}`);
      console.log(`✅ App ID: ${appInfo.id}`);
      console.log(`✅ Owner: ${appInfo.owner.login} (${appInfo.owner.type})`);
      console.log(`✅ Installations: ${appInfo.installations_count}`);
      console.log('✅ Permissions:');
      Object.entries(appInfo.permissions).forEach(([perm, level]) => {
        console.log(`   - ${perm}: ${level}`);
      });
      console.log('');
      
      return appInfo;
    } catch (error) {
      console.log(`❌ Ошибка проверки App: ${error}`);
      return null;
    }
  }

  /**
   * Проверяет установку GitHub App
   */
  async checkInstallation(): Promise<GitHubInstallation | null> {
    console.log('3️⃣ Проверка установки GitHub App:');
    
    try {
      const jwtToken = this.generateJWT();

      const response = await fetch(`${this.baseUrl}/app/installations/${this.installationId}`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Shipvibes-Diagnostic/1.0',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.log(`❌ Ошибка получения информации об установке: ${response.status} ${error}`);
        return null;
      }

      const installation = await response.json() as GitHubInstallation;
      
      console.log(`✅ Installation ID: ${installation.id}`);
      console.log(`✅ Account: ${installation.account.login} (${installation.account.type})`);
      console.log(`✅ Repository Selection: ${installation.repository_selection}`);
      console.log('✅ Permissions:');
      Object.entries(installation.permissions).forEach(([perm, level]) => {
        console.log(`   - ${perm}: ${level}`);
      });
      console.log('');
      
      return installation;
    } catch (error) {
      console.log(`❌ Ошибка проверки установки: ${error}`);
      return null;
    }
  }

  /**
   * Проверяет получение installation токена
   */
  async checkInstallationToken(): Promise<GitHubInstallationToken | null> {
    console.log('4️⃣ Проверка получения installation токена:');
    
    try {
      const jwtToken = this.generateJWT();

      const response = await fetch(`${this.baseUrl}/app/installations/${this.installationId}/access_tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Shipvibes-Diagnostic/1.0',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.log(`❌ Ошибка получения installation токена: ${response.status} ${error}`);
        return null;
      }

      const tokenData = await response.json() as GitHubInstallationToken;
      
      console.log('✅ Installation токен получен успешно');
      console.log(`✅ Expires at: ${tokenData.expires_at}`);
      console.log('✅ Permissions:');
      Object.entries(tokenData.permissions).forEach(([perm, level]) => {
        console.log(`   - ${perm}: ${level}`);
      });
      
      if (tokenData.repositories) {
        console.log(`✅ Доступные репозитории: ${tokenData.repositories.length}`);
        tokenData.repositories.forEach(repo => {
          console.log(`   - ${repo.full_name}`);
        });
      }
      console.log('');
      
      return tokenData;
    } catch (error) {
      console.log(`❌ Ошибка получения installation токена: ${error}`);
      return null;
    }
  }

  /**
   * Проверяет возможность создания репозитория
   */
  async testRepositoryCreation(token: string): Promise<boolean> {
    console.log('5️⃣ Тест создания репозитория:');
    
    try {
      const testRepoName = `test-repo-${Date.now()}`;
      
      // Сначала проверим, можем ли мы получить информацию об организации
      console.log('🔍 Проверяем доступ к организации shipvibes...');
      const orgResponse = await fetch(`${this.baseUrl}/orgs/shipvibes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Shipvibes-Diagnostic/1.0',
        },
      });

      if (!orgResponse.ok) {
        const orgError = await orgResponse.text();
        console.log(`❌ Нет доступа к организации: ${orgResponse.status} ${orgError}`);
      } else {
        const orgData = await orgResponse.json() as any;
        console.log(`✅ Доступ к организации: ${orgData.login} (ID: ${orgData.id})`);
      }

      // Проверим существующие репозитории
      console.log('🔍 Проверяем существующие репозитории в организации...');
      const reposResponse = await fetch(`${this.baseUrl}/orgs/shipvibes/repos?per_page=5`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Shipvibes-Diagnostic/1.0',
        },
      });

      if (reposResponse.ok) {
        const repos = await reposResponse.json() as any[];
        console.log(`✅ Найдено репозиториев: ${repos.length}`);
        repos.forEach(repo => {
          console.log(`   - ${repo.name} (${repo.private ? 'private' : 'public'})`);
        });
      } else {
        console.log(`❌ Не удалось получить список репозиториев: ${reposResponse.status}`);
      }
      
      // Попробуем создать тестовый репозиторий с детальным логированием
      console.log('🔍 Попытка создания тестового репозитория...');
      console.log(`📋 Request body:`, {
        name: testRepoName,
        description: 'Test repository for Shipvibes diagnostic',
        private: true,
        auto_init: false,
      });

      const response = await fetch(`${this.baseUrl}/orgs/shipvibes/repos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Shipvibes-Diagnostic/1.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: testRepoName,
          description: 'Test repository for Shipvibes diagnostic',
          private: true,
          auto_init: false,
        }),
      });

      console.log(`📊 Response status: ${response.status}`);
      console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const repo = await response.json() as any;
        console.log(`✅ Тестовый репозиторий создан: ${repo.html_url}`);
        
        // Попробуем удалить его
        const deleteResponse = await fetch(`${this.baseUrl}/repos/shipvibes/${testRepoName}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Shipvibes-Diagnostic/1.0',
          },
        });

        if (deleteResponse.ok) {
          console.log('✅ Тестовый репозиторий удален');
        } else {
          console.log('⚠️ Тестовый репозиторий не удален (но создание работает)');
        }
        
        return true;
      } else {
        const errorText = await response.text();
        console.log(`❌ Ошибка создания репозитория: ${response.status}`);
        console.log(`📄 Error response body:`, errorText);
        
        // Попробуем парсить ошибку как JSON
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) {
            console.log(`💬 Error message: ${errorJson.message}`);
          }
          if (errorJson.errors) {
            console.log(`🔍 Detailed errors:`, errorJson.errors);
          }
        } catch (e) {
          console.log(`📄 Raw error text: ${errorText}`);
        }
        
        return false;
      }
    } catch (error) {
      console.log(`❌ Ошибка теста создания репозитория: ${error}`);
      return false;
    }
  }

  /**
   * Запускает полную диагностику
   */
  async runDiagnostic(): Promise<void> {
    try {
      // 1. Проверка переменных окружения
      if (!this.checkEnvironmentVariables()) {
        console.log('💥 Не все переменные окружения настроены. Завершение.');
        return;
      }

      // 2. Проверка информации о GitHub App
      const appInfo = await this.checkAppInfo();
      if (!appInfo) {
        console.log('💥 Не удалось получить информацию о GitHub App. Завершение.');
        return;
      }

      // 3. Проверка установки
      const installation = await this.checkInstallation();
      if (!installation) {
        console.log('💥 Не удалось получить информацию об установке. Завершение.');
        return;
      }

      // 4. Проверка installation токена
      const tokenData = await this.checkInstallationToken();
      if (!tokenData) {
        console.log('💥 Не удалось получить installation токен. Завершение.');
        return;
      }

      // 5. Тест создания репозитория
      const canCreateRepo = await this.testRepositoryCreation(tokenData.token);
      
      console.log('🎯 РЕЗУЛЬТАТ ДИАГНОСТИКИ:');
      console.log('========================');
      if (canCreateRepo) {
        console.log('✅ GitHub App настроен правильно и может создавать репозитории');
      } else {
        console.log('❌ GitHub App не может создавать репозитории');
        console.log('\n🔧 ВОЗМОЖНЫЕ РЕШЕНИЯ:');
        console.log('1. Проверьте права GitHub App в настройках организации shipvibes');
        console.log('2. Убедитесь, что App установлен с правами "Contents: Write" и "Administration: Write"');
        console.log('3. Проверьте, что Installation ID правильный');
        console.log('4. App URL: https://github.com/organizations/shipvibes/settings/apps/shipvibes-bot');
      }
      
    } catch (error) {
      console.log(`💥 Критическая ошибка диагностики: ${error}`);
    }
  }
}

// Запуск диагностики
async function main() {
  const diagnostic = new GitHubAppDiagnostic();
  await diagnostic.runDiagnostic();
}

main().catch(console.error); 