"use client";

import { Button } from "@/components/geist/button";
import { Material } from "@/components/geist/material";
import { Snippet } from "@/components/geist/snippet";

interface SetupStepProps {
  onDeploy: () => void;
}

export function SetupStep({ onDeploy }: SetupStepProps) {
  return (
    <Material type="base" className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 font-sans">
        Open in Cursor
      </h3>
      <p className="text-muted-foreground mb-6 font-sans">
        Open your project folder and start the development server to begin
        coding with AI.
      </p>

      <div className="space-y-6">
        {/* Step 1: Extract ZIP */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            1. Extract the downloaded ZIP file
          </div>
          <div className="bg-accents-1 rounded-md p-4 border border-border">
            <div className="font-sans text-xs text-muted-foreground">
              Double-click the ZIP file in your Downloads folder to extract it
            </div>
          </div>
        </div>

        {/* Step 2: Open Cursor */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            2. Open Cursor app
          </div>
          <div className="bg-accents-1 rounded-md p-4 border border-border space-y-3">
            <Button
              size="small"
              onClick={() => {
                try {
                  window.open("cursor://", "_self");
                } catch (error) {
                  console.log("Could not open Cursor automatically");
                }
              }}
              prefix={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
                </svg>
              }
            >
              Open Cursor
            </Button>
            <div className="font-sans text-xs text-muted-foreground">
              Or manually launch Cursor from your Applications folder or dock
            </div>
          </div>
        </div>

        {/* Step 3: Open folder dialog */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            3. Open the project folder
          </div>
          <div className="bg-accents-1 rounded-md p-4 border border-border">
            <div className="font-sans text-xs text-muted-foreground">
              Press{" "}
              <kbd className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs font-mono">
                Cmd + O
              </kbd>{" "}
              or go to File → Open Folder
            </div>
          </div>
        </div>

        {/* Step 4: Select project folder */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            4. Select your extracted project folder
          </div>
          <div className="bg-accents-1 rounded-md p-4 border border-border">
            <div className="font-sans text-xs text-muted-foreground">
              Navigate to and select the extracted project folder, then click
              "Open"
            </div>
          </div>
        </div>

        {/* Step 5: Open terminal */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            5. Open terminal in Cursor
          </div>
          <div className="bg-accents-1 rounded-md p-4 border border-border">
            <div className="font-sans text-xs text-muted-foreground">
              Press{" "}
              <kbd className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs font-mono">
                Cmd + J
              </kbd>{" "}
              or go to Terminal → New Terminal
            </div>
          </div>
        </div>

        {/* Step 6: Run command */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2 font-sans">
            6. Start the project
          </div>
          <Snippet text="pnpm start" />
          <div className="mt-2 text-xs text-muted-foreground font-sans">
            Paste this command in the terminal and press Enter. This will
            install dependencies and start both the dev server and sync.
          </div>
        </div>

        <div className="pt-4">
          <Button size="large" onClick={onDeploy} fullWidth>
            I'm Ready to Go Live
          </Button>
        </div>
      </div>
    </Material>
  );
}
