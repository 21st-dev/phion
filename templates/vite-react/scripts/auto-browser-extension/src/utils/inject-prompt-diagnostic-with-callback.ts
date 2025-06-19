import * as vscode from "vscode"
import { DIAGNOSTIC_COLLECTION_NAME } from "../constants"

// Global diagnostic collection - will be initialized in extension activation
let globalDiagnosticCollection: vscode.DiagnosticCollection | null = null

/**
 * Initialize the global diagnostic collection (called from extension activation)
 */
export function initializeDiagnosticCollection(): vscode.DiagnosticCollection {
  if (!globalDiagnosticCollection) {
    globalDiagnosticCollection = vscode.languages.createDiagnosticCollection(
      DIAGNOSTIC_COLLECTION_NAME,
    )
  }
  return globalDiagnosticCollection
}

/**
 * Get the global diagnostic collection
 */
export function getDiagnosticCollection(): vscode.DiagnosticCollection {
  if (!globalDiagnosticCollection) {
    throw new Error(
      "Diagnostic collection not initialized. Call initializeDiagnosticCollection first.",
    )
  }
  return globalDiagnosticCollection
}

/**
 * Injects a diagnostic with a prompt into the active editor and executes a callback.
 * If no editor is active, it attempts to open the first file in the workspace.
 * The diagnostic is displayed as an error, and the cursor is moved to the diagnostic's range.
 * After the callback is executed, the diagnostic is cleared.
 *
 * @param params - The parameters for the function.
 * @param params.prompt - The prompt message to display in the diagnostic.
 * @param params.callback - The callback function to execute after injecting the diagnostic.
 * @returns A promise that resolves when the operation is complete.
 */
export async function injectPromptDiagnosticWithCallback(params: {
  prompt: string
  callback: () => Promise<any>
}): Promise<void> {
  let editor = vscode.window.activeTextEditor
  if (!editor) {
    try {
      // Get all workspace files
      const files = await vscode.workspace.findFiles("**/*", "**/node_modules/**")

      if (files.length === 0) {
        vscode.window.showErrorMessage("No files found in workspace to open.")
        return
      }

      // Open the first file found
      const document = await vscode.workspace.openTextDocument(files[0])
      editor = await vscode.window.showTextDocument(document)
    } catch (error) {
      vscode.window.showErrorMessage("Failed to open existing file for prompt injection.")
      return
    }
    // Sleep 150ms to ensure editor is ready
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  const document = editor.document // Get document early
  const diagnosticCollection = getDiagnosticCollection()

  try {
    // Use the current selection or just the current line
    const selectionOrCurrentLine = editor.selection.isEmpty
      ? document.lineAt(editor.selection.active.line).range // Use current line if no selection
      : editor.selection // Use actual selection if available

    // 1. Create the fake diagnostic object
    const fakeDiagnostic = new vscode.Diagnostic(
      selectionOrCurrentLine,
      params.prompt,
      vscode.DiagnosticSeverity.Error,
    )
    fakeDiagnostic.source = DIAGNOSTIC_COLLECTION_NAME

    // 2. Set the diagnostic using the global collection
    diagnosticCollection.set(document.uri, [fakeDiagnostic])

    // 3. Ensure cursor is within the diagnostic range (e.g., start)
    editor.selection = new vscode.Selection(
      selectionOrCurrentLine.start,
      selectionOrCurrentLine.start,
    )

    await new Promise((resolve) => setTimeout(resolve, 10))

    // 5. Execute the callback command
    await params.callback()
    vscode.window.showInformationMessage(`Triggered agent for prompt.`) // Simplified message
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to inject prompt: ${error}`)
  } finally {
    // Clear the specific diagnostic for this URI from the collection
    if (document) {
      diagnosticCollection.delete(document.uri)
    }
  }
}
