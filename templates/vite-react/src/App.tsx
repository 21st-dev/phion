import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Onboarding } from "@/components/Onboarding"

function App() {
  const [showMainApp, setShowMainApp] = useState(() => {
    return localStorage.getItem('phion-onboarding-completed') === 'true'
  })

  const handleOnboardingComplete = () => {
    localStorage.setItem('phion-onboarding-completed', 'true')
    setShowMainApp(true)
  }

  if (showMainApp) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="fixed top-6 right-6">
            <ThemeToggle />
          </div>
          
          <div className="fixed bottom-6 left-6">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                localStorage.removeItem('phion-onboarding-completed')
                window.location.reload()
              }}
            >
              Reset Onboarding
            </Button>
          </div>

          <div className="max-w-md mx-auto text-center space-y-8">
            <div>
              <h1 className="text-3xl font-light mb-3">Ready to Build</h1>
              <p className="text-muted-foreground">
                Press ⌘I to open AI chat and try these prompts:
              </p>
            </div>

            <div className="space-y-3 text-left">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium">Create a calculator app with iOS-style design</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium">Build a simple todo app with animations</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium">Create a weather widget with 5-day forecast</p>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>Press ⌘. to switch between Ask and Agent modes</p>
            </div>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  return <Onboarding onComplete={handleOnboardingComplete} />
}

export default App