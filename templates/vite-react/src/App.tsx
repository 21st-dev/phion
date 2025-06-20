import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Onboarding } from "@/components/Onboarding"
import { Copy, CheckCircle } from "lucide-react"

function App() {
  const [showMainApp, setShowMainApp] = useState(() => {
    return localStorage.getItem('phion-onboarding-completed') === 'true'
  })
  const [copiedPrompt, setCopiedPrompt] = useState("")

  const handleOnboardingComplete = () => {
    localStorage.setItem('phion-onboarding-completed', 'true')
    setShowMainApp(true)
  }

  const copyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompt(prompt)
      setTimeout(() => setCopiedPrompt(""), 2000)
    } catch (err) {
      console.error('Failed to copy prompt:', err)
    }
  }

  const promptExamples = [
    {
      title: "iOS Calculator",
      prompt: "Create a calculator app with iOS-style design. Include number buttons, operations (+, -, *, /), clear button, and equals. Use clean typography and subtle shadows."
    },
    {
      title: "Todo App", 
      prompt: "Build a simple todo app with add, delete, and mark complete functionality. Use modern UI with animations and local storage to persist data."
    },
    {
      title: "Weather Widget",
      prompt: "Create a weather widget that shows current temperature, weather icon, and 5-day forecast. Use a clean card-based design with gradients."
    }
  ]

  if (showMainApp) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
          <div className="fixed top-6 right-6 z-40">
            <ThemeToggle />
          </div>
          
          {/* Reset onboarding button for dev */}
          <div className="fixed bottom-6 left-6 z-40">
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

          <div className="max-w-4xl mx-auto text-center space-y-12">
            {/* Header */}
            <div className="space-y-6">
              <h1 className="text-5xl font-extralight text-foreground">Ready to Build</h1>
              <p className="text-xl font-light text-muted-foreground max-w-2xl mx-auto">
                Не знаешь с чего начать? Попробуй один из этих примеров
              </p>
            </div>

            {/* Prompt Examples */}
            <div className="grid gap-6 md:grid-cols-3">
              {promptExamples.map((example, index) => (
                <div key={index} className="bg-card border border-border rounded-xl p-6 text-left space-y-4">
                  <h3 className="text-lg font-medium text-foreground">{example.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {example.prompt}
                  </p>
                  <Button
                    onClick={() => copyPrompt(example.prompt)}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {copiedPrompt === example.prompt ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Скопировано!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Скопировать промпт
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>

            {/* Quick Start Instructions */}
            <div className="bg-muted/30 rounded-xl p-8 space-y-6">
              <h2 className="text-2xl font-light text-foreground">Быстрый старт</h2>
              <div className="grid gap-6 md:grid-cols-2 text-left">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium mt-1">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Открой AI чат</p>
                      <p className="text-sm text-muted-foreground">Нажми ⌘I для запуска</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium mt-1">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Вставь промпт</p>
                      <p className="text-sm text-muted-foreground">Скопируй любой пример выше</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium mt-1">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Переключись в Agent</p>
                      <p className="text-sm text-muted-foreground">Нажми ⌘. в чате</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium mt-1">
                      4
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Смотри магию</p>
                      <p className="text-sm text-muted-foreground">AI напишет код за тебя</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-8">
              <p className="text-sm font-light text-muted-foreground">Powered by Phion ⚡</p>
            </div>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  return <Onboarding onComplete={handleOnboardingComplete} />
}

export default App