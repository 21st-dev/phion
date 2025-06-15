"use client"

import { Button } from "@/components/geist/button"
import { Material } from "@/components/geist/material"
import { ProjectSetupLayout } from "./setup-layout"
import { ExternalLink } from "lucide-react"

interface CongratulationsViewProps {
  projectUrl: string
}

export function CongratulationsView({ projectUrl }: CongratulationsViewProps) {
  return (
    <ProjectSetupLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Live Preview */}
        <div className="lg:col-span-2">
          <Material type="base" className="p-0 overflow-hidden">
            {/* Header with URL */}
            <div className="bg-muted border-b border-border px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="font-mono">{projectUrl}</span>
                </div>
                <a
                  href={projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="text-xs">Open</span>
                </a>
              </div>
            </div>

            {/* Live iframe */}
            <div className="aspect-video bg-background">
              <iframe
                src={projectUrl}
                className="w-full h-full border-0"
                title="Live Preview"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-top-navigation-by-user-activation"
              />
            </div>
          </Material>
        </div>

        {/* Right Column - Next Steps */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">🎉 Your site is live!</h2>

            <div className="p-4 bg-muted border border-border rounded-lg mb-6">
              <div className="text-sm text-muted-foreground mb-2">
                Your project is now available at:
              </div>
              <a
                href={projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-blue-600 hover:text-blue-700 break-all"
              >
                {projectUrl}
              </a>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="w-5 h-5 mt-0.5">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-muted-foreground"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-foreground">Live Updates</div>
                  <div className="text-sm text-muted-foreground">
                    See changes instantly as you code locally
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="w-5 h-5 mt-0.5">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="text-muted-foreground"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-foreground flex items-center gap-2">
                    Custom Domain
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="text-muted-foreground"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M5.50001 1.93933L6.03034 2.46966L10.8536 7.29288C11.2441 7.68341 11.2441 8.31657 10.8536 8.7071L6.03034 13.5303L5.50001 14.0607L4.43935 13L4.96968 12.4697L9.43935 7.99999L4.96968 3.53032L4.43935 2.99999L5.50001 1.93933Z"
                      />
                    </svg>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Connect your own domain to this project
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="w-5 h-5 mt-0.5">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="text-muted-foreground"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-foreground flex items-center gap-2">
                    Analytics
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="text-muted-foreground"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M5.50001 1.93933L6.03034 2.46966L10.8536 7.29288C11.2441 7.68341 11.2441 8.31657 10.8536 8.7071L6.03034 13.5303L5.50001 14.0607L4.43935 13L4.96968 12.4697L9.43935 7.99999L4.96968 3.53032L4.43935 2.99999L5.50001 1.93933Z"
                      />
                    </svg>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Track how users experience your site
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <Button size="large" fullWidth onClick={() => window.open(projectUrl, "_blank")}>
              Open Live Site
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </ProjectSetupLayout>
  )
}
