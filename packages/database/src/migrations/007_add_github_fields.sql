-- 📋 Миграция: Добавление GitHub полей для перехода с R2 на GitHub App архитектуру
-- Дата: 2024
-- Описание: Добавляем поля для хранения ссылок на GitHub репозитории и коммиты

-- ========================================
-- 1. ОБНОВЛЕНИЕ ТАБЛИЦЫ PROJECTS
-- ========================================

-- Добавляем поля для GitHub репозитория
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS github_repo_url TEXT,
ADD COLUMN IF NOT EXISTS github_repo_name TEXT,
ADD COLUMN IF NOT EXISTS github_owner TEXT DEFAULT 'shipvibes';

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_projects_github_repo_name ON projects(github_repo_name);
CREATE INDEX IF NOT EXISTS idx_projects_github_owner ON projects(github_owner);

-- ========================================
-- 2. ОБНОВЛЕНИЕ ТАБЛИЦЫ FILE_HISTORY  
-- ========================================

-- Добавляем поля для GitHub коммитов (временно nullable для совместимости)
ALTER TABLE file_history
ADD COLUMN IF NOT EXISTS github_commit_sha TEXT,
ADD COLUMN IF NOT EXISTS github_commit_url TEXT;

-- Создаем индексы для GitHub данных
CREATE INDEX IF NOT EXISTS idx_file_history_github_commit_sha ON file_history(github_commit_sha);
CREATE INDEX IF NOT EXISTS idx_file_history_project_github ON file_history(project_id, github_commit_sha);

-- ========================================
-- 3. СОЗДАНИЕ ТАБЛИЦЫ COMMIT_HISTORY
-- ========================================

-- Создаем новую таблицу для хранения истории коммитов GitHub
CREATE TABLE IF NOT EXISTS commit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  github_commit_sha TEXT NOT NULL,
  github_commit_url TEXT NOT NULL,
  commit_message TEXT NOT NULL,
  files_count INTEGER DEFAULT 0,
  committed_by TEXT DEFAULT 'Shipvibes Bot',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для commit_history
CREATE INDEX IF NOT EXISTS idx_commit_history_project_id ON commit_history(project_id);
CREATE INDEX IF NOT EXISTS idx_commit_history_github_sha ON commit_history(github_commit_sha);
CREATE INDEX IF NOT EXISTS idx_commit_history_created_at ON commit_history(project_id, created_at DESC);

-- Уникальность коммита в рамках проекта
CREATE UNIQUE INDEX IF NOT EXISTS idx_commit_history_project_sha 
ON commit_history(project_id, github_commit_sha);

-- ========================================
-- 4. КОММЕНТАРИИ ДЛЯ ДОКУМЕНТАЦИИ
-- ========================================

COMMENT ON COLUMN projects.github_repo_url IS 'URL GitHub репозитория (https://github.com/shipvibes/shipvibes-project-{id})';
COMMENT ON COLUMN projects.github_repo_name IS 'Имя GitHub репозитория (shipvibes-project-{id})';
COMMENT ON COLUMN projects.github_owner IS 'Владелец GitHub репозитория (организация shipvibes)';

COMMENT ON COLUMN file_history.github_commit_sha IS 'SHA коммита в GitHub где сохранен файл';
COMMENT ON COLUMN file_history.github_commit_url IS 'URL коммита в GitHub';

COMMENT ON TABLE commit_history IS 'История коммитов проекта в GitHub репозитории';
COMMENT ON COLUMN commit_history.github_commit_sha IS 'SHA коммита в GitHub';
COMMENT ON COLUMN commit_history.github_commit_url IS 'URL коммита в GitHub';
COMMENT ON COLUMN commit_history.commit_message IS 'Сообщение коммита';
COMMENT ON COLUMN commit_history.files_count IS 'Количество файлов в коммите';

-- ========================================
-- 5. ЗАМЕТКИ ДЛЯ БУДУЩИХ МИГРАЦИЙ
-- ========================================

-- TODO: После полного перехода на GitHub убрать поля:
-- - file_history.r2_object_key (в миграции 008)
-- 
-- TODO: Добавить NOT NULL constraints после миграции данных:
-- - ALTER TABLE file_history ALTER COLUMN github_commit_sha SET NOT NULL;
-- - ALTER TABLE file_history ALTER COLUMN github_commit_url SET NOT NULL; 