export type PromptRequest = {
  sessionId?: string
  prompt: string
  model?: string
  files?: string[]
  mode?: "agent" | "ask" | "manual"
  images?: string[]
}
