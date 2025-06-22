import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { TooltipProvider } from "@/components/ui/tooltip"

function App() {
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [showMainApp, setShowMainApp] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [])
  
  const onboardingSteps = [
    {
      emoji: "🚀",
      title: "Welcome to Cursor + Phion",
      subtitle: "Let's get you coding in 60 seconds",
      content: "You're about to experience the future of coding. We'll show you exactly how to build anything with AI assistance and deploy it instantly."
    },
    {
      emoji: "💾",
      title: "Save & Discard",
      subtitle: "Your work, instantly live",
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">
            Look at the top toolbar - you'll see Save and Discard buttons there.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 text-sm">💾</span>
              </div>
              <div>
                <div className="font-medium text-sm">Save</div>
                <div className="text-xs text-muted-foreground">Publish your changes live</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-red-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 text-sm">↩</span>
              </div>
              <div>
                <div className="font-medium text-sm">Discard</div>
                <div className="text-xs text-muted-foreground">Go back to last saved version</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      emoji: "🌐",
      title: "Your App Goes Live",
      subtitle: "Share with the world",
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">
            After you save, your app automatically becomes available on the internet with a real URL you can share!
          </p>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">🔗</span>
              </div>
              <div>
                <div className="font-medium text-sm">Preview Button</div>
                <div className="text-xs text-muted-foreground">Look for the arrow button in the top toolbar</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              This button lights up when your app is ready to share. Click it to view your creation live on the web!
            </div>
          </div>
        </div>
      )
    },
    {
      emoji: "💬",
      title: "Open AI Chat",
      subtitle: "Your coding partner",
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">
            Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⌘I</kbd> to open your AI assistant. It's like having a senior developer sitting next to you.
          </p>
          <div className="bg-muted/30 rounded-xl p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">⌘ + I</div>
              <div className="text-sm font-medium">Opens AI Chat</div>
            </div>
          </div>
        </div>
      )
    },
    {
      emoji: "🧠",
      title: "Ask Mode",
      subtitle: "Plan before you build",
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">
            Use Ask mode to brainstorm, plan features, and get architectural advice. Perfect for the "what" and "how" questions.
          </p>
          <div className="space-y-3">
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
              <div className="font-medium text-sm mb-1">💭 Great for:</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>• "How should I structure this app?"</div>
                <div>• "What's the best way to add auth?"</div>
                <div>• "Plan a shopping cart feature"</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      emoji: "⚡",
      title: "Agent Mode",
      subtitle: "AI writes the code",
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">
            Agent mode actually writes and edits your code. It can read your entire project and make complex changes across multiple files.
          </p>
          <div className="space-y-3">
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
              <div className="font-medium text-sm mb-1">⚡ Perfect for:</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>• "Build that shopping cart now"</div>
                <div>• "Add dark mode to the app"</div>
                <div>• "Fix this bug in the login"</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      emoji: "🔄",
      title: "Switch Modes",
      subtitle: "The secret sauce",
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">
            Here's the magic: use the same chat for both modes. Plan in Ask, then switch to Agent to build.
          </p>
          <div className="bg-muted/30 rounded-xl p-4 space-y-4">
            <div className="text-center">
              <div className="text-2xl mb-2">⌘ + .</div>
              <div className="text-sm font-medium">Switch Modes</div>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              Press this in any chat to toggle between Ask ↔ Agent
            </div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <div className="text-xs font-medium text-amber-700 dark:text-amber-300">Pro tip:</div>
            <div className="text-xs text-muted-foreground mt-1">
              Plan your feature in Ask mode, then say "build it" and switch to Agent
            </div>
          </div>
        </div>
      )
    }
  ]

  if (showMainApp) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
          <div className="fixed top-6 right-6 z-40">
            <ThemeToggle />
          </div>
          
          <div className="fixed top-6 left-6 z-40">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setShowMainApp(false)
                setOnboardingStep(0)
              }}
            >
              Show Onboarding
            </Button>
          </div>

          <div className="max-w-2xl mx-auto text-center space-y-16">
            <div className="space-y-6">
              <h1 className="text-4xl font-extralight text-foreground">Phion</h1>
              <p className="text-xl font-light text-muted-foreground max-w-lg mx-auto">
                Just craft in Cursor. We handle everything else.
              </p>
            </div>
            <div className="text-lg text-muted-foreground">
              Ready to start coding! 🚀
            </div>
          </div>
        </div>
      </TooltipProvider>
    )
  }
  
  if (!isVisible) {
    return null
  }

  return (
    <TooltipProvider>
      {/* Toolbar - НЕ анимировать */}
      <div className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur text-white p-3 flex justify-between items-center z-50 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">My Project</span>
          <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs">2 unsaved</span>
        </div>
        <div className="flex items-center gap-2 relative">
          <AnimatePresence>
            {onboardingStep === 1 && (
              <motion.div 
                className="absolute -bottom-8 left-[calc(65%)] text-primary text-2xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                ⬆️
              </motion.div>
            )}
            {onboardingStep === 2 && (
              <motion.div 
                className="absolute -bottom-8 right-0 text-primary text-2xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                ⬆️
              </motion.div>
            )}
          </AnimatePresence>
          <button className="px-3 py-1.5 bg-white/10 border border-white/20 rounded text-xs text-red-400">
            Discard
          </button>
          <button className="px-3 py-1.5 bg-blue-600 rounded text-xs text-white">
            Save
          </button>
          <button className="p-1.5 bg-white/10 border border-white/20 rounded">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
              <path d="m21 3-9 9" />
              <path d="M15 3h6v6" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Onboarding content */}
      <motion.div 
        className="min-h-screen bg-background flex flex-col items-center justify-center p-8 pt-20"
        initial={{ opacity: 0, filter: "blur(20px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.8 }}
      >
        <div className="fixed top-20 right-6 z-40">
          <ThemeToggle />
        </div>
        
        <div className="w-full max-w-2xl mx-auto h-full flex flex-col">
          {/* Step indicator */}
          <div className="flex justify-center gap-2 mb-12">
            {onboardingSteps.map((_, index) => (
              <motion.div
                key={index}
                className={`h-1 rounded-full ${
                  index === onboardingStep 
                    ? 'bg-primary' 
                    : index < onboardingStep
                    ? 'bg-primary/60'
                    : 'bg-muted'
                }`}
                animate={{ width: index === onboardingStep ? 48 : 8 }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
          
          {/* Content container - FIXED HEIGHT */}
          <div className="flex-1 flex flex-col justify-center min-h-[500px] max-h-[500px]">
            <AnimatePresence mode="wait">
              <motion.div 
                key={onboardingStep}
                className="text-center space-y-8 flex flex-col justify-center h-full"
                initial={{ opacity: 0, filter: "blur(10px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(10px)" }}
                transition={{ duration: 0.4 }}
              >
                <div className="text-8xl">
                  {onboardingSteps[onboardingStep].emoji}
                </div>
                
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold tracking-tight">
                    {onboardingSteps[onboardingStep].title}
                  </h1>
                  <p className="text-xl text-muted-foreground font-medium">
                    {onboardingSteps[onboardingStep].subtitle}
                  </p>
                </div>
                
                <div className="max-w-lg mx-auto">
                  {typeof onboardingSteps[onboardingStep].content === 'string' 
                    ? <p className="text-lg text-muted-foreground leading-relaxed">{onboardingSteps[onboardingStep].content}</p>
                    : <div className="text-left">{onboardingSteps[onboardingStep].content}</div>
                  }
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          
          {/* Navigation - ALWAYS SAME POSITION */}
          <div className="flex justify-between items-center py-8">
            <div className="flex items-center gap-4 min-w-[120px]">
              <AnimatePresence>
                {onboardingStep > 0 && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Button 
                      variant="ghost" 
                      onClick={() => setOnboardingStep(prev => prev - 1)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ← Back
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
              <Button 
                variant="ghost" 
                onClick={() => setShowMainApp(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                Skip
              </Button>
            </div>
            
            <div>
              {onboardingStep < onboardingSteps.length - 1 ? (
                <Button 
                  onClick={() => setOnboardingStep(prev => prev + 1)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3"
                  size="lg"
                >
                  Continue
                </Button>
              ) : (
                <Button 
                  onClick={() => setShowMainApp(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3"
                  size="lg"
                >
                  Start Coding →
                </Button>
              )}
            </div>
          </div>
          
          {/* Step counter - ALWAYS SAME POSITION */}
          <div className="text-center pb-8">
            <div className="text-sm text-muted-foreground/60">
              {onboardingStep + 1} of {onboardingSteps.length}
            </div>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  )
}

export default App
