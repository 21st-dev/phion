import * as vscode from "vscode"

export class VScodeContext {
  private static instance: VScodeContext
  private static initializationPromise: Promise<void> | null = null
  private context: vscode.ExtensionContext | null = null

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  public static async getInstance(): Promise<VScodeContext> {
    try {
      if (!VScodeContext.instance) {
        VScodeContext.instance = new VScodeContext()
      }

      // If initialization has started, wait for it to complete
      if (VScodeContext.initializationPromise) {
        await VScodeContext.initializationPromise
      }

      return VScodeContext.instance
    } catch (error) {
      console.error("Error getting VScodeContext instance:", error)
      // Return instance even if initialization failed
      return VScodeContext.instance || new VScodeContext()
    }
  }

  public static initialize(context: vscode.ExtensionContext): Promise<void> {
    if (!VScodeContext.initializationPromise) {
      VScodeContext.initializationPromise = (async () => {
        try {
          if (!VScodeContext.instance) {
            VScodeContext.instance = new VScodeContext()
          }
          VScodeContext.instance.context = context
        } catch (error) {
          console.error("Error initializing VScodeContext:", error)
        }
      })()
    }
    return VScodeContext.initializationPromise
  }

  public getContext(): vscode.ExtensionContext | null {
    return this.context
  }

  public isInitialized(): boolean {
    return this.context !== null
  }

  public getExtensionMode(): vscode.ExtensionMode | undefined {
    return this.context?.extensionMode
  }

  public isDevelopmentMode(): boolean {
    return this.context?.extensionMode === vscode.ExtensionMode.Development
  }
}
