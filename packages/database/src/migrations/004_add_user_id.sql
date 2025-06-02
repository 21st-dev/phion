-- Миграция для добавления user_id в проекты для поддержки авторизации
-- Связываем проекты с пользователями из Supabase Auth

-- Добавляем поле user_id, связанное с auth.users
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Создаем индекс для быстрого поиска проектов пользователя
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Включаем Row Level Security (RLS) для таблицы projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Политика: пользователи могут видеть только свои проекты
CREATE POLICY "Users can view own projects" ON projects
    FOR SELECT USING (auth.uid() = user_id);

-- Политика: пользователи могут создавать проекты для себя
CREATE POLICY "Users can insert own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Политика: пользователи могут обновлять только свои проекты
CREATE POLICY "Users can update own projects" ON projects
    FOR UPDATE USING (auth.uid() = user_id);

-- Политика: пользователи могут удалять только свои проекты
CREATE POLICY "Users can delete own projects" ON projects
    FOR DELETE USING (auth.uid() = user_id);

-- Включаем RLS для таблицы file_history (тоже должна быть привязана к пользователю через проект)
ALTER TABLE file_history ENABLE ROW LEVEL SECURITY;

-- Политика для file_history: доступ только к файлам своих проектов
CREATE POLICY "Users can view own project files" ON file_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = file_history.project_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Политика для вставки файлов в свои проекты
CREATE POLICY "Users can insert files to own projects" ON file_history
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = file_history.project_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Политика для обновления файлов в своих проектах
CREATE POLICY "Users can update files in own projects" ON file_history
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = file_history.project_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Политика для удаления файлов из своих проектов
CREATE POLICY "Users can delete files from own projects" ON file_history
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = file_history.project_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Примечание: существующие проекты без user_id потребуют ручной миграции
-- или могут быть назначены на специального "анонимного" пользователя 