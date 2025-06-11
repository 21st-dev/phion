-- ========================================
-- МИГРАЦИЯ 008: Исправление github_owner
-- ========================================
-- Изменяем дефолтное значение и существующие записи с shipvibes на vybcel

-- 1. Обновляем существующие записи
UPDATE projects 
SET github_owner = 'vybcel' 
WHERE github_owner = 'shipvibes' OR github_owner IS NULL;

-- 2. Изменяем дефолтное значение для новых записей
ALTER TABLE projects 
ALTER COLUMN github_owner SET DEFAULT 'vybcel';

-- 3. Обновляем комментарии
COMMENT ON COLUMN projects.github_owner IS 'Владелец GitHub репозитория (организация vybcel)';
COMMENT ON COLUMN projects.github_repo_url IS 'URL GitHub репозитория (https://github.com/vybcel/vybcel-project-{id})';
COMMENT ON COLUMN projects.github_repo_name IS 'Имя GitHub репозитория (vybcel-project-{id})'; 