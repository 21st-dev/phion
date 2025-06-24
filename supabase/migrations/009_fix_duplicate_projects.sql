-- ========================================
-- МИГРАЦИЯ 009: Исправление дублирующихся проектов
-- ========================================
-- Находим и удаляем дублирующиеся записи проектов, оставляя самые новые

-- 1. Находим дублирующиеся проекты (если они есть)
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Проверяем количество дубликатов
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT id, COUNT(*) as cnt
        FROM projects
        GROUP BY id
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate project groups. Starting cleanup...', duplicate_count;
        
        -- Удаляем старые дубликаты, оставляем самые новые записи
        DELETE FROM projects
        WHERE ctid NOT IN (
            SELECT DISTINCT ON (id) ctid
            FROM projects
            ORDER BY id, created_at DESC
        );
        
        RAISE NOTICE 'Cleanup completed. Removed old duplicate records.';
    ELSE
        RAISE NOTICE 'No duplicate projects found. Database is clean.';
    END IF;
END $$;

-- 2. Добавляем уникальное ограничение на ID (если его еще нет)
-- Это предотвратит создание дубликатов в будущем
DO $$
BEGIN
    -- Проверяем, существует ли уже ограничение уникальности на id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'projects_id_unique' 
        AND conrelid = 'projects'::regclass
    ) THEN
        -- Добавляем ограничение уникальности
        ALTER TABLE projects ADD CONSTRAINT projects_id_unique UNIQUE (id);
        RAISE NOTICE 'Added unique constraint on projects.id';
    ELSE
        RAISE NOTICE 'Unique constraint on projects.id already exists';
    END IF;
END $$;

-- 3. Создаем индексы для улучшения производительности (если их нет)
CREATE INDEX IF NOT EXISTS idx_projects_user_id_created_at ON projects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_github_repo_unique ON projects(github_repo_name) WHERE github_repo_name IS NOT NULL;

-- 4. Добавляем комментарии
COMMENT ON CONSTRAINT projects_id_unique ON projects IS 'Ensures each project ID is unique in the database';
COMMENT ON INDEX idx_projects_user_id_created_at IS 'Optimizes user project listings ordered by creation date';
COMMENT ON INDEX idx_projects_github_repo_unique IS 'Optimizes GitHub repository name lookups and prevents repo name conflicts';

-- 5. Проводим финальную проверку
DO $$
DECLARE
    total_projects INTEGER;
    unique_projects INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_projects FROM projects;
    SELECT COUNT(DISTINCT id) INTO unique_projects FROM projects;
    
    IF total_projects = unique_projects THEN
        RAISE NOTICE 'Migration completed successfully. % unique projects in database.', total_projects;
    ELSE
        RAISE WARNING 'Migration issue detected: % total projects but % unique IDs', total_projects, unique_projects;
    END IF;
END $$; 