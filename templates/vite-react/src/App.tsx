import { useState } from "react";
import { Button } from "@/components/ui/button";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl mx-auto text-center space-y-16">
        {/* Header */}
        <div className="space-y-6">
          <div className="w-16 h-16 bg-black rounded-full mx-auto flex items-center justify-center">
            <span className="text-white text-2xl font-light">V</span>
          </div>
          <h1 className="text-4xl font-extralight text-gray-900">
            Vybcel - Vibecode OS
          </h1>
          <p className="text-xl font-light text-gray-600 max-w-lg mx-auto">
            Just craft in Cursor. We handle everything else.
          </p>
        </div>

        {/* AI Instructions */}
        <div className="space-y-8">
          <div className="bg-gray-50 rounded-lg p-8 space-y-6">
            <h2 className="text-2xl font-light text-gray-900">
              Start coding with AI
            </h2>

            <div className="space-y-4 text-left">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-light mt-1">
                  ⌘
                </div>
                <div>
                  <p className="font-medium text-gray-900">Press Cmd+I</p>
                  <p className="text-gray-600 font-light">
                    Open AI chat to start
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-light mt-1">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900">Ask + OpenAI O3</p>
                  <p className="text-gray-600 font-light">
                    Plan features like "Build a contact form"
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-light mt-1">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900">Agent + Claude</p>
                  <p className="text-gray-600 font-light">
                    Switch mode and say "Build it now"
                  </p>
                </div>
                <div className="bg-white p-4 rounded border-l-4 border-gray-400">
                  <p className="text-sm font-medium text-gray-700">
                    Switch modes: Press Cmd+. in chat
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Use the same chat tab for planning → coding
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Simple Demo */}
          <div className="space-y-4">
            <p className="text-lg font-light text-gray-600">
              Try editing this:
            </p>
            <Button
              onClick={() => setCount(count + 1)}
              variant="outline"
              className="text-lg px-8 py-3 font-light"
            >
              Clicked {count} times
            </Button>
            <p className="text-sm font-light text-gray-500">
              Edit src/App.tsx and watch changes appear instantly
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-16">
          <p className="text-sm font-light text-gray-400">Powered by Vybcel</p>
        </div>
      </div>
    </div>
  );
}

export default App;
