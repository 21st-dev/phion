"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface ToolbarVersion {
  version: string;
  build: number;
  channel: "stable" | "beta" | "dev";
  url: string;
  checksum: string;
  releaseNotes?: string;
  timestamp: number;
}

interface VersionsByChannel {
  stable: ToolbarVersion[];
  beta: ToolbarVersion[];
  dev: ToolbarVersion[];
}

export default function ToolbarAdminPage() {
  const [versions, setVersions] = useState<VersionsByChannel>({
    stable: [],
    beta: [],
    dev: [],
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    version: "",
    channel: "stable" as "stable" | "beta" | "dev",
    releaseNotes: "",
    file: null as File | null,
  });

  // Push update form state
  const [pushForm, setPushForm] = useState({
    version: "",
    channel: "stable" as "stable" | "beta" | "dev",
    forceUpdate: false,
    releaseNotes: "",
    projectId: "",
  });

  // Load existing versions
  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    try {
      const response = await fetch("/api/toolbar/check");
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || { stable: [], beta: [], dev: [] });
      }
    } catch (error) {
      console.error("Failed to load versions:", error);
      toast.error("Failed to load toolbar versions");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!uploadForm.file || !uploadForm.version) {
      toast.error("Please select a file and enter a version");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("version", uploadForm.version);
      formData.append("channel", uploadForm.channel);
      formData.append("releaseNotes", uploadForm.releaseNotes);

      const response = await fetch("/api/toolbar/upload", {
        method: "PUT",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(
          `Toolbar v${result.version.version} uploaded successfully`
        );
        setUploadForm({
          version: "",
          channel: "stable",
          releaseNotes: "",
          file: null,
        });
        loadVersions();
      } else {
        const error = await response.json();
        toast.error(`Upload failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleBroadcastUpdate = async () => {
    if (!pushForm.version) {
      toast.error("Please enter a version to broadcast");
      return;
    }

    setBroadcasting(true);

    try {
      const endpoint = pushForm.projectId
        ? `${
            process.env.WEBSOCKET_SERVER_URL || "http://localhost:8080"
          }/api/toolbar/push-update`
        : `${
            process.env.WEBSOCKET_SERVER_URL || "http://localhost:8080"
          }/api/toolbar/broadcast-update`;

      const body = {
        version: pushForm.version,
        channel: pushForm.channel,
        forceUpdate: pushForm.forceUpdate,
        releaseNotes: pushForm.releaseNotes,
        ...(pushForm.projectId && { projectId: pushForm.projectId }),
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        setPushForm({
          version: "",
          channel: "stable",
          forceUpdate: false,
          releaseNotes: "",
          projectId: "",
        });
      } else {
        const error = await response.json();
        toast.error(`Broadcast failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Broadcast error:", error);
      toast.error("Broadcast failed - make sure WebSocket server is running");
    } finally {
      setBroadcasting(false);
    }
  };

  const handleForceReload = async (projectId?: string) => {
    try {
      const endpoint = `${
        process.env.WEBSOCKET_SERVER_URL || "http://localhost:8080"
      }/api/toolbar/force-reload`;
      const body = projectId ? { projectId } : {};

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
      } else {
        const error = await response.json();
        toast.error(`Reload failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Reload error:", error);
      toast.error("Reload failed");
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case "stable":
        return "bg-green-100 text-green-800";
      case "beta":
        return "bg-yellow-100 text-yellow-800";
      case "dev":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading toolbar versions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Toolbar Management</h1>
        <Button variant="outline" onClick={loadVersions} disabled={loading}>
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload New Version</TabsTrigger>
          <TabsTrigger value="push">Push Updates</TabsTrigger>
          <TabsTrigger value="versions">Current Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload New Toolbar Version</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="version">Version</Label>
                    <Input
                      id="version"
                      placeholder="e.g., 0.2.1"
                      value={uploadForm.version}
                      onChange={(e) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          version: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="channel">Channel</Label>
                    <Select
                      value={uploadForm.channel}
                      onValueChange={(value: "stable" | "beta" | "dev") =>
                        setUploadForm((prev) => ({ ...prev, channel: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stable">Stable</SelectItem>
                        <SelectItem value="beta">Beta</SelectItem>
                        <SelectItem value="dev">Dev</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="file">Toolbar File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".js"
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        file: e.target.files?.[0] || null,
                      }))
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="releaseNotes">Release Notes</Label>
                  <Textarea
                    id="releaseNotes"
                    placeholder="What's new in this version?"
                    value={uploadForm.releaseNotes}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        releaseNotes: e.target.value,
                      }))
                    }
                    rows={3}
                  />
                </div>

                <Button type="submit" disabled={uploading} className="w-full">
                  {uploading ? "Uploading..." : "Upload Version"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="push" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Push Updates to Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pushVersion">Version</Label>
                  <Input
                    id="pushVersion"
                    placeholder="e.g., 0.2.1"
                    value={pushForm.version}
                    onChange={(e) =>
                      setPushForm((prev) => ({
                        ...prev,
                        version: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="pushChannel">Channel</Label>
                  <Select
                    value={pushForm.channel}
                    onValueChange={(value: "stable" | "beta" | "dev") =>
                      setPushForm((prev) => ({ ...prev, channel: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stable">Stable</SelectItem>
                      <SelectItem value="beta">Beta</SelectItem>
                      <SelectItem value="dev">Dev</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="pushProjectId">Project ID (optional)</Label>
                <Input
                  id="pushProjectId"
                  placeholder="Leave empty to broadcast to all projects"
                  value={pushForm.projectId}
                  onChange={(e) =>
                    setPushForm((prev) => ({
                      ...prev,
                      projectId: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="pushReleaseNotes">Release Notes</Label>
                <Textarea
                  id="pushReleaseNotes"
                  placeholder="What's new in this version?"
                  value={pushForm.releaseNotes}
                  onChange={(e) =>
                    setPushForm((prev) => ({
                      ...prev,
                      releaseNotes: e.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="forceUpdate"
                  checked={pushForm.forceUpdate}
                  onCheckedChange={(checked: boolean) =>
                    setPushForm((prev) => ({ ...prev, forceUpdate: checked }))
                  }
                />
                <Label htmlFor="forceUpdate">
                  Force Update (users must update)
                </Label>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={handleBroadcastUpdate}
                  disabled={broadcasting || !pushForm.version}
                  className="w-full"
                >
                  {broadcasting
                    ? "Broadcasting..."
                    : pushForm.projectId
                    ? "Push to Project"
                    : "Broadcast to All"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    handleForceReload(pushForm.projectId || undefined)
                  }
                  className="w-full"
                >
                  Force Reload Toolbar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="space-y-6">
          {(["stable", "beta", "dev"] as const).map((channel) => (
            <Card key={channel}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {channel.charAt(0).toUpperCase() + channel.slice(1)} Channel
                  <Badge className={getChannelColor(channel)}>
                    {versions[channel]?.length || 0} versions
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {versions[channel]?.length ? (
                  <div className="space-y-3">
                    {versions[channel].slice(0, 10).map((version, index) => (
                      <div
                        key={version.version}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              v{version.version}
                            </span>
                            <Badge variant="outline">
                              build {version.build}
                            </Badge>
                            {index === 0 && (
                              <Badge variant="default">Latest</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {formatDate(version.timestamp)}
                          </div>
                          {version.releaseNotes && (
                            <div className="text-sm text-gray-700 mt-1">
                              {version.releaseNotes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(version.url, "_blank")}
                          >
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setPushForm((prev) => ({
                                ...prev,
                                version: version.version,
                                channel: version.channel,
                              }))
                            }
                          >
                            Push
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No versions available in {channel} channel
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
