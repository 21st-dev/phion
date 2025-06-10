import { Fragment, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Rocket, Terminal, Edit, Globe, Play, Square } from "lucide-react";
import { Badge } from "../ui/badge";
import { Tabs } from "../geist/tabs";

interface LogsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Simple date formatting function
function formatDate(date: Date): string {
  return date.toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Хелпер для получения иконки по типу события
function getEventIcon(eventType: string) {
  switch (eventType) {
    case "project_created":
      return <Rocket className="h-4 w-4" />;
    case "commit_created":
      return <Edit className="h-4 w-4" />;
    case "deploy_started":
    case "deploy_building":
      return <Play className="h-4 w-4" />;
    case "deploy_completed":
      return <Globe className="h-4 w-4" />;
    case "deploy_failed":
      return <Square className="h-4 w-4" />;
    default:
      return <Terminal className="h-4 w-4" />;
  }
}

// Хелпер для форматирования описания события
function getEventDescription(event: any) {
  const { event_type, details } = event;

  switch (event_type) {
    case "project_created":
      return "Проект создан";
    case "commit_created":
      return `Коммит "${details.commitMessage}" (${details.filesCount} файлов)`;
    case "file_changed":
      return `Файл ${details.filePath} ${
        details.action === "added" ? "добавлен" : "изменен"
      }`;
    case "deploy_started":
      return "Деплой запущен";
    case "deploy_building":
      return "Сборка проекта...";
    case "deploy_completed":
      return "Деплой успешно завершен";
    case "deploy_failed":
      return "Ошибка деплоя";
    case "agent_connected":
      return "Агент подключен";
    case "agent_disconnected":
      return "Агент отключен";
    case "pending_changes_cleared":
      return `Очищено ${details.clearedChangesCount} изменений`;
    default:
      return event_type;
  }
}

// Хелпер для получения цвета бейджа по типу события
function getEventBadgeVariant(eventType: string) {
  switch (eventType) {
    case "project_created":
      return "default";
    case "commit_created":
      return "secondary";
    case "deploy_started":
    case "deploy_building":
      return "outline";
    case "deploy_completed":
      return "success";
    case "deploy_failed":
      return "destructive";
    default:
      return "outline";
  }
}

export function LogsDialog({ projectId, open, onOpenChange }: LogsDialogProps) {
  const [tab, setTab] = useState("all");

  // Загрузка логов проекта
  const { data: logs, isLoading } = useQuery({
    queryKey: ["project-logs", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/logs?limit=100`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  // Фильтрация логов по вкладке
  const filteredLogs = logs?.filter((log: any) => {
    if (tab === "all") return true;
    if (tab === "commits") return log.event_type === "commit_created";
    if (tab === "deploys") return log.event_type.includes("deploy");
    if (tab === "files") return log.event_type === "file_changed";
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Логи проекта</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col">
          <Tabs
            selected={tab}
            setSelected={setTab}
            tabs={[
              { title: "Все события", value: "all" },
              { title: "Коммиты", value: "commits" },
              { title: "Деплои", value: "deploys" },
              { title: "Файлы", value: "files" },
            ]}
          />

          <div className="flex-1 overflow-y-auto mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Загрузка логов...</p>
              </div>
            ) : filteredLogs?.length > 0 ? (
              <div className="space-y-1">
                {filteredLogs.map((event: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 hover:bg-accent/50 rounded-md"
                  >
                    <div className="mt-1 text-muted-foreground">
                      {getEventIcon(event.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {getEventDescription(event)}
                        </p>
                        <Badge
                          variant={
                            getEventBadgeVariant(event.event_type) as any
                          }
                        >
                          {event.event_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(new Date(event.timestamp))}
                        {event.trigger && <> • {event.trigger}</>}
                      </p>
                      {event.details &&
                        Object.keys(event.details).length > 0 && (
                          <div className="mt-1 text-xs bg-muted p-2 rounded">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">
                  Нет логов для отображения
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
