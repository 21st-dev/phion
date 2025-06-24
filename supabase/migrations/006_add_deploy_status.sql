-- Добавляем таблицу для отслеживания статусов деплоя
CREATE TABLE IF NOT EXISTS deploy_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  commit_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'building', 'deploying', 'success', 'failed')),
  step TEXT, -- текущий шаг: 'restoring_files', 'installing_deps', 'building', 'creating_zip', 'deploying'
  logs TEXT[], -- массив логов
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_deploy_status_project_id ON deploy_status(project_id);
CREATE INDEX IF NOT EXISTS idx_deploy_status_commit_id ON deploy_status(commit_id);
CREATE INDEX IF NOT EXISTS idx_deploy_status_created_at ON deploy_status(created_at DESC); 