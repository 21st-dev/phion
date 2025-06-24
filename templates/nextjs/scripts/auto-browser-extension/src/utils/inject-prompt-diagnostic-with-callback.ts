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
  let document: vscode.TextDocument

  // If no editor is active, or if we need to ensure focus, find and open a suitable file
  if (!editor) {
    try {
      // Define common entry point patterns in order of preference
      const entryPointPatterns = [
        "**/App.tsx",
        "**/main.tsx",
        "**/app/page.tsx",
        "**/src/App.tsx",
        "**/src/main.tsx",
        "**/index.tsx",
        "**/src/index.tsx",
        "**/App.jsx",
        "**/main.jsx",
        "**/src/App.jsx",
        "**/src/main.jsx",
        "**/index.jsx",
        "**/src/index.jsx",
        "**/index.ts",
        "**/src/index.ts",
        "**/index.js",
        "**/src/index.js",
      ]

      let fileToOpen: vscode.Uri | null = null

      // Try to find entry points in order of preference
      for (const pattern of entryPointPatterns) {
        const files = await vscode.workspace.findFiles(pattern, "**/node_modules/**")
        if (files.length > 0) {
          fileToOpen = files[0]
          break
        }
      }

      // If no entry points found, fall back to any file
      if (!fileToOpen) {
        const allFiles = await vscode.workspace.findFiles("**/*", "**/node_modules/**")
        if (allFiles.length === 0) {
          vscode.window.showErrorMessage("No files found in workspace to open.")
          return
        }
        fileToOpen = allFiles[0]
      }

      // Open the selected file and ensure it's focused
      document = await vscode.workspace.openTextDocument(fileToOpen)
      editor = await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.Active,
        preserveFocus: false, // Ensure the editor gets focus
        preview: false, // Don't open in preview mode
      })
    } catch (error) {
      vscode.window.showErrorMessage("Failed to open existing file for prompt injection.")
      return
    }
  } else {
    // Editor exists, but ensure it's focused and visible
    document = editor.document
    try {
      // Re-show the document to ensure it's focused and visible
      editor = await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.Active,
        preserveFocus: false, // Ensure the editor gets focus
        preview: false, // Don't open in preview mode
      })
    } catch (error) {
      // If showing the document fails, continue with the existing editor
      console.warn("Failed to refocus editor, continuing with existing editor:", error)
    }
  }

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

    // 4. Reveal the range to ensure it's visible
    editor.revealRange(selectionOrCurrentLine, vscode.TextEditorRevealType.InCenter)

    // Wait a bit more to ensure everything is properly set
    await new Promise((resolve) => setTimeout(resolve, 100))

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
