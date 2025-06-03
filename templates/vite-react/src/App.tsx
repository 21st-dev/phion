import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Rocket, Code, Globe } from "lucide-react";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center space-x-2 text-4xl font-bold text-gray-800">
            <Rocket className="h-10 w-10 text-blue-600" />
            <span>Shipvibes Project</span>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Your modern React application is ready for development with
            TypeScript, Tailwind CSS, and shadcn/ui components!
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Code className="h-5 w-5 text-blue-600" />
                <span>Modern Stack</span>
              </CardTitle>
              <CardDescription>
                Built with React, TypeScript, Vite, and Tailwind CSS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Enjoy the latest development tools and best practices for
                building modern web applications.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5 text-green-600" />
                <span>Live Sync</span>
              </CardTitle>
              <CardDescription>
                Real-time synchronization with Shipvibes platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Your changes are automatically synced to the cloud and deployed
                instantly.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Rocket className="h-5 w-5 text-purple-600" />
                <span>Ready to Ship</span>
              </CardTitle>
              <CardDescription>
                Configured with shadcn/ui components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Beautiful, accessible components that you can copy and paste
                into your apps.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Interactive Demo */}
        <Card className="text-center">
          <CardHeader>
            <CardTitle>Interactive Demo</CardTitle>
            <CardDescription>
              Click the button to test hot module replacement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => setCount((count) => count + 1)}
              size="lg"
              className="text-lg px-8 py-3"
            >
              Count is {count}
            </Button>
            <p className="text-sm text-muted-foreground">
              Edit{" "}
              <code className="bg-muted px-2 py-1 rounded text-xs">
                src/App.tsx
              </code>{" "}
              and save to test HMR
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Start editing your code and see changes in real-time!</p>
          <p className="mt-2">
            Learn more about{" "}
            <a
              href="https://ui.shadcn.com"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              shadcn/ui components
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
