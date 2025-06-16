export interface FormData {
  email: string
  name: string
  codingExperience: string
  frustrations: {
    selectedOptions: string[]
    customText: string
  }
  toolsUsed: string
  toolDislike: string
  dreamProject: string
  acceptsCall: boolean
}

export type WaitlistStep =
  | "coding-experience"
  | "frustrations"
  | "tools-experience"
  | "dream-project"
  | "call-preference"
  | "success"
