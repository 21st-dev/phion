-- Добавляем поле для хранения ID текущего деплоя в Netlify
ALTER TABLE projects ADD COLUMN IF NOT EXISTS netlify_deploy_id TEXT;

-- Индекс для быстрого поиска по deploy_id
CREATE INDEX IF NOT EXISTS idx_projects_netlify_deploy_id ON projects(netlify_deploy_id) WHERE netlify_deploy_id IS NOT NULL; 