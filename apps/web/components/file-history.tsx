"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCommit } from "lucide-react";
import { DiffViewer } from "./diff-viewer";

interface FileHistoryItem {
  id: string;
  project_id: string;
  file_path: string;
  r2_object_key: string;
  content_hash: string;
  diff_text: string | null;
  file_size: number;
  created_at: string;
}

interface FileHistoryProps {
  history: FileHistoryItem[];
}

export function FileHistory({ history }: FileHistoryProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <GitCommit className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No file changes yet</h3>
            <p className="text-sm text-muted-foreground">
              Start editing your project files to see the change history here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">File History</h2>
        <Badge variant="secondary">
          {history.length} change{history.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="space-y-4">
        {history.map((item) => (
          <DiffViewer
            key={item.id}
            filePath={item.file_path}
            diffText={item.diff_text}
            fileSize={item.file_size}
            timestamp={item.created_at}
          />
        ))}
      </div>
    </div>
  );
}
