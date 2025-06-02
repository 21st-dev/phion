-- Начальная миграция для Shipvibes MVP
-- Создание основных таблиц без авторизации

-- Включаем расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Таблица проектов (без user_id для MVP)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  template_type TEXT NOT NULL DEFAULT 'vite-react',
  netlify_site_id TEXT,
  netlify_url TEXT,
  deploy_status TEXT DEFAULT 'pending' CHECK (deploy_status IN ('pending', 'building', 'ready', 'failed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица истории файлов
CREATE TABLE IF NOT EXISTS file_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  r2_object_key TEXT NOT NULL, -- Путь к файлу в R2
  content_hash TEXT, -- SHA-256 хеш содержимого для дедупликации
  diff_text TEXT, -- Предвычисленный diff
  file_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_deploy_status ON projects(deploy_status);

CREATE INDEX IF NOT EXISTS idx_file_history_project_id ON file_history(project_id);
CREATE INDEX IF NOT EXISTS idx_file_history_created_at ON file_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_history_file_path ON file_history(project_id, file_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_history_content_hash ON file_history(content_hash) WHERE content_hash IS NOT NULL;

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического обновления updated_at в таблице projects
CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 