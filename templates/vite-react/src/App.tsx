import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, Code, Zap, Globe } from "lucide-react";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Rocket className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Vybcel Project</h1>
            </div>
            <Badge variant="secondary">Live Preview</Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Welcome to Your Project
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start editing this file in your local editor and see changes
              published instantly to the web.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Local Development
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Edit files in your favorite editor like Cursor with full AI
                  assistance and autocomplete.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Auto Sync
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Changes are automatically synced to the cloud and published
                  without any manual steps.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  See your changes live on the web instantly. Share your
                  progress with others in real-time.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Demo */}
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Interactive Demo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground">
                  Click the button to increment
                </p>
              </div>
              <Button
                onClick={() => setCount(count + 1)}
                className="w-full"
                size="lg"
              >
                Count is {count}
              </Button>
            </CardContent>
          </Card>

          {/* Getting Started */}
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl font-semibold">Getting Started</h2>
            <div className="grid gap-4 text-left">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <div>
                      <h3 className="font-semibold">Edit this file</h3>
                      <p className="text-sm text-muted-foreground">
                        Open <code>src/App.tsx</code> in your editor and make
                        changes
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <div>
                      <h3 className="font-semibold">Save your changes</h3>
                      <p className="text-sm text-muted-foreground">
                        Changes are automatically synced and published
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <div>
                      <h3 className="font-semibold">See it live</h3>
                      <p className="text-sm text-muted-foreground">
                        Your changes appear here and on your live site
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>Built with ❤️ using React, TypeScript, Vite, and Tailwind CSS</p>
            <p className="mt-2">
              Powered by{" "}
              <a
                href="https://vybcel.com"
                className="text-primary hover:underline"
              >
                Vybcel
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
