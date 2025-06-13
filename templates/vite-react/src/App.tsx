import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";

function App() {
  const [count, setCount] = useState(0);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        {/* Theme Toggle */}
        <div className="fixed top-6 right-6 z-50">
          <ThemeToggle />
        </div>

        <div className="max-w-2xl mx-auto text-center space-y-16">
          {/* Header */}
          <div className="space-y-6">
            <div className="w-16 h-16 bg-foreground rounded-full mx-auto flex items-center justify-center">
              <span className="text-background text-2xl font-light">V</span>
            </div>
            <h1 className="text-4xl font-extralight text-foreground">
              Code OS
            </h1>
            <p className="text-xl font-light text-muted-foreground max-w-lg mx-auto">
              Just craft in Cursor. We handle everything else.
            </p>
          </div>

          {/* AI Instructions */}
          <div className="space-y-8">
            <div className="bg-muted/50 rounded-lg p-8 space-y-6">
              <h2 className="text-2xl font-light text-foreground">
                Start coding with AI
              </h2>

              <div className="space-y-4 text-left">
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-foreground text-background rounded-full flex items-center justify-center text-sm font-light mt-1">
                    ⌘
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Press Cmd+I</p>
                    <p className="text-muted-foreground font-light">
                      Open AI chat to start
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-foreground text-background rounded-full flex items-center justify-center text-sm font-light mt-1">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      Ask + OpenAI O3
                    </p>
                    <p className="text-muted-foreground font-light">
                      Plan features like "Build a contact form"
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-foreground text-background rounded-full flex items-center justify-center text-sm font-light mt-1">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      Agent + Claude
                    </p>
                    <p className="text-muted-foreground font-light">
                      Switch mode and say "Build it now"
                    </p>
                  </div>
                </div>

                <div className="bg-card border border-border p-4 rounded">
                  <p className="text-sm font-medium text-foreground">
                    Switch modes: Press Cmd+. in chat
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use the same chat tab for planning → coding
                  </p>
                </div>
              </div>
            </div>

            {/* Simple Demo */}
            <div className="space-y-4">
              <p className="text-lg font-light text-muted-foreground">
                Try this example:
              </p>
              <Button
                onClick={() => setCount(count + 1)}
                variant="outline"
                className="text-lg px-8 py-3 font-light"
              >
                Clicked {count} times
              </Button>
              <p className="text-sm font-light text-muted-foreground">
                Ask AI to "change the main page" and watch updates appear live
              </p>
            </div>

            {/* Documentation Link */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Want to learn more?
              </h3>
              <p className="text-muted-foreground font-light mb-4">
                Explore all AI modes and advanced features in the official guide
              </p>
              <a
                href="https://docs.cursor.com/chat/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-primary hover:text-primary/80 font-medium"
              >
                Read the Cursor Documentation →
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-16">
            <p className="text-sm font-light text-muted-foreground">
              Powered by Vybcel
            </p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default App;
