import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"

interface OnboardingProps {
  onComplete: () => void
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [onboardingStep, setOnboardingStep] = useState(0)
  
  // Check if real Phion toolbar is present
  const [hasRealToolbar, setHasRealToolbar] = useState(false)
  
  useEffect(() => {
    // Check for Phion toolbar in DOM
    const checkToolbar = () => {
      const phionContainer = document.getElementById('phion-root-container')
      const phionConfig = (window as any).PHION_CONFIG
      setHasRealToolbar(!!phionContainer || !!phionConfig)
    }
    
    // Check immediately and after delay
    checkToolbar()
    const timer = setTimeout(checkToolbar, 2000)
    
    // Add keyboard handler to show toolbar when user presses Cmd+/ during onboarding
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/' && hasRealToolbar) {
        // Toolbar will be toggled by the toolbar's own handler
        // We don't need to do anything special here
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasRealToolbar])

  const onboardingSteps = [
    {
      emoji: "🚀",
      title: "Welcome to Cursor + Phion",
      subtitle: "Let's get you coding in 60 seconds",
      content: "You're about to experience the future of coding. We'll show you exactly how to build anything with AI assistance and deploy it instantly."
    },
    {
      emoji: "🎚️",
      title: "Toggle Toolbar",
      subtitle: "Hidden by default, show when needed",
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground leading-relaxed">
            The toolbar is hidden by default to give you maximum screen space. Press the shortcut below to show it whenever you need it!
          </p>
          <div className="bg-muted/30 rounded-xl p-4">
            <div className="text-center">
              <div className="text-2xl mb-2">⌘ + /</div>
              <div className="text-sm font-medium">Show/Hide Toolbar</div>
            </div>
            <div className="text-xs text-muted-foreground text-center mt-2">
              Works on Mac (⌘) and Windows/Linux (Ctrl)
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <div className="text-xs font-medium text-blue-700 dark:text-blue-300">Try it now!</div>
            <div className="text-xs text-muted-foreground mt-1">
              Press ⌘+/ to see the toolbar appear with a smooth animation
            </div>
          </div>
        </div>
      )
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
                <div className="text-xs text-muted-foreground">Look for the preview button in the top toolbar</div>
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

  return (
    <>
      {/* Arrows pointing to real toolbar - only show when toolbar is visible */}
      {hasRealToolbar && (
        <AnimatePresence>
          {onboardingStep === 2 && (
            <motion.div 
              className="fixed top-16 right-24 z-[999999] text-primary text-3xl pointer-events-none"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              ⬆️
            </motion.div>
          )}
          {onboardingStep === 3 && (
            <motion.div 
              className="fixed top-16 right-4 z-[999999] text-primary text-3xl pointer-events-none"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              ⬆️
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Onboarding content */}
      <motion.div 
        className="min-h-screen bg-background flex flex-col items-center justify-center p-8"
        initial={{ opacity: 0, filter: "blur(20px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.8 }}
      >        
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
                onClick={onComplete}
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
                  onClick={onComplete}
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
    </>
  )
}