-- Миграция для поддержки несохранённых изменений (простой workflow)
-- Разделяем tracking (pending changes) и commit (file_history)

-- Таблица для хранения несохранённых изменений
CREATE TABLE IF NOT EXISTS pending_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL, -- Актуальное содержимое файла
  action TEXT NOT NULL CHECK (action IN ('modified', 'added', 'deleted')),
  content_hash TEXT,
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Уникальность: один pending change на файл в проекте
  UNIQUE(project_id, file_path)
);

-- Индексы для быстрого доступа
CREATE INDEX IF NOT EXISTS idx_pending_changes_project_id ON pending_changes(project_id);
CREATE INDEX IF NOT EXISTS idx_pending_changes_action ON pending_changes(action);
CREATE INDEX IF NOT EXISTS idx_pending_changes_updated_at ON pending_changes(updated_at DESC);

-- Включаем RLS для pending_changes
ALTER TABLE pending_changes ENABLE ROW LEVEL SECURITY;

-- Политики безопасности: доступ только к своим проектам
CREATE POLICY "Users can view pending changes of own projects" ON pending_changes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = pending_changes.project_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage pending changes" ON pending_changes
    FOR ALL USING (true) WITH CHECK (true); -- WebSocket сервер использует service key

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_pending_changes_updated_at 
    BEFORE UPDATE ON pending_changes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Добавляем поле commit_id в file_history для группировки изменений в коммиты
ALTER TABLE file_history ADD COLUMN IF NOT EXISTS commit_id UUID;
ALTER TABLE file_history ADD COLUMN IF NOT EXISTS commit_message TEXT;

-- Индекс для группировки по коммитам
CREATE INDEX IF NOT EXISTS idx_file_history_commit_id ON file_history(commit_id) WHERE commit_id IS NOT NULL; 