import { exec } from 'child_process'
import { promisify } from 'util'
import http from 'http'

const execAsync = promisify(exec)

export interface VSCodeConfig {
  autoOpen: boolean
  port: number
  url?: string
}

/**
 * Детектирует, запущен ли VS Code или Cursor
 */
export function detectVSCode(): boolean {
  // Проверяем переменные окружения VS Code и Cursor
  return !!(
    process.env.VSCODE_PID ||
    process.env.TERM_PROGRAM === 'vscode' ||
    process.env.VSCODE_INJECTION === '1' ||
    process.env.TERM_PROGRAM === 'cursor' ||
    process.env.CURSOR_PID ||
    process.env.CURSOR_TRACE_ID // Cursor специфичная переменная
  )
}

/**
 * Определяет, используется ли Cursor (а не VS Code)
 */
export function isCursor(): boolean {
  // Cursor устанавливает CURSOR_TRACE_ID и использует Cursor.app в путях
  return !!(
    process.env.CURSOR_TRACE_ID ||
    process.env.VSCODE_GIT_ASKPASS_NODE?.includes('Cursor.app')
  )
}

/**
 * Проверяет доступность команды code/cursor в PATH
 */
export async function isCodeCommandAvailable(): Promise<boolean> {
  const useCursor = isCursor()
  const command = useCursor ? 'cursor' : 'code'
  
  try {
    await execAsync(`${command} --version`)
    return true
  } catch {
    // Если основная команда не работает, пробуем альтернативную
    try {
      const altCommand = useCursor ? 'code' : 'cursor'
      await execAsync(`${altCommand} --version`)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Проверяет, доступен ли dev-сервер на указанном порту
 */
export function checkDevServerReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve(res.statusCode === 200)
    })
    
    req.on('error', () => {
      resolve(false)
    })
    
    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

/**
 * Находит активный порт Vite dev сервера
 */
export async function findVitePort(): Promise<number | null> {
  // Проверяем стандартные порты Vite в обратном порядке (новые порты первыми)
  const commonPorts = [5177, 5176, 5175, 5174, 5173, 3001, 3000]
  
  for (const port of commonPorts) {
    if (await checkDevServerReady(port)) {
      return port
    }
  }
  
  return null
}

/**
 * Ожидает готовности dev-сервера с таймаутом
 */
export async function waitForDevServer(port: number, timeout = 30000): Promise<boolean> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    if (await checkDevServerReady(port)) {
      return true
    }
    
    // Ждем 500ms перед следующей проверкой
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  return false
}

/**
 * Открывает URL в VS Code/Cursor Simple Browser
 */
export async function openInVSCodeSimpleBrowser(url: string): Promise<boolean> {
  const useCursor = isCursor()
  const command = useCursor ? 'cursor' : 'code'
  
  try {
    // Метод 1: Для Cursor пробуем команду vscode.open
    if (useCursor) {
      await execAsync(`${command} --command "vscode.open" --command-args "${url}"`)
      return true
    } else {
      // Для VS Code используем simpleBrowser.show
      await execAsync(`${command} --command "simpleBrowser.show" --command-args "${url}"`)
      return true
    }
  } catch (error) {
    console.warn(`[${useCursor ? 'Cursor' : 'VS Code'}] Method 1 failed:`, (error as Error).message)
    
    try {
      // Метод 2: Пробуем simpleBrowser.show для обоих
      await execAsync(`${command} --command "simpleBrowser.show" --command-args "${url}"`)
      return true
    } catch (fallbackError) {
      console.warn(`[${useCursor ? 'Cursor' : 'VS Code'}] Method 2 failed:`, (fallbackError as Error).message)
      
      try {
        // Метод 3: Fallback через vscode:// URI
        const encodedUrl = encodeURIComponent(url)
        await execAsync(`${command} --open-url "vscode://ms-vscode.vscode-simple-browser/show?url=${encodedUrl}"`)
        return true
      } catch (uriError) {
        console.warn(`[${useCursor ? 'Cursor' : 'VS Code'}] Method 3 failed:`, (uriError as Error).message)
        
        try {
          // Метод 4: Простое открытие URL
          await execAsync(`${command} --open-url "${url}"`)
          return true
        } catch (finalError) {
          console.warn(`[${useCursor ? 'Cursor' : 'VS Code'}] All methods failed:`, (finalError as Error).message)
          return false
        }
      }
    }
  }
}

/**
 * Открывает URL в системном браузере как fallback
 */
export async function openInSystemBrowser(url: string): Promise<boolean> {
  try {
    const platform = process.platform
    let command: string
    
    switch (platform) {
      case 'darwin':
        command = `open "${url}"`
        break
      case 'win32':
        command = `start "" "${url}"`
        break
      default:
        command = `xdg-open "${url}"`
        break
    }
    
    await execAsync(command)
    return true
  } catch (error) {
    console.warn('[System Browser] Failed to open:', (error as Error).message)
    return false
  }
}

/**
 * Основная функция для открытия превью
 */
export async function openPreview(config: VSCodeConfig, debug = false): Promise<void> {
  if (!config.autoOpen) {
    if (debug) {
      console.log('🔧 Auto-open disabled in config')
    }
    return
  }

  // Автоматически находим активный порт Vite
  let port = config.port
  let url = config.url
  
  if (!url) {
    const foundPort = await findVitePort()
    if (foundPort) {
      port = foundPort
      url = `http://localhost:${port}`
      if (debug) {
        console.log(`🔍 Found Vite dev server on port ${port}`)
      }
    } else {
      url = `http://localhost:${port}`
      if (debug) {
        console.log(`⚠️ No active dev server found, using default port ${port}`)
      }
    }
  }
  
  if (debug) {
    console.log(`🌐 Opening preview at ${url}...`)
  }

  // Проверяем готовность сервера
  const isReady = await checkDevServerReady(port)
  if (!isReady) {
    console.warn(`⚠️ Dev server not ready at ${url}`)
    return
  }

  if (debug) {
    console.log('✅ Dev server is ready')
  }

  // Проверяем VS Code/Cursor
  const isVSCode = detectVSCode()
  const hasCodeCommand = await isCodeCommandAvailable()
  const useCursor = isCursor()

  if (debug) {
    console.log(`🔍 ${useCursor ? 'Cursor' : 'VS Code'} detected: ${isVSCode}`)
    console.log(`🔍 Code command available: ${hasCodeCommand}`)
    console.log(`🔍 Environment check:`)
    console.log(`   - CURSOR_TRACE_ID: ${process.env.CURSOR_TRACE_ID ? 'present' : 'missing'}`)
    console.log(`   - VSCODE_GIT_ASKPASS_NODE: ${process.env.VSCODE_GIT_ASKPASS_NODE?.includes('Cursor.app') ? 'Cursor.app' : 'other'}`)
  }

  // Показываем URL пользователю
  console.log('')
  console.log('🌐 ═══════════════════════════════════════════════════════════')
  console.log('🚀 Your development server is ready!')
  console.log(`🔗 Local preview: ${url}`)
  if (useCursor) {
    console.log('💡 To open in Cursor Simple Browser:')
    console.log('   1. Press Cmd+Shift+P')
    console.log('   2. Type "Simple Browser: Show"')
    console.log(`   3. Enter: ${url}`)
  }
  console.log('🌐 ═══════════════════════════════════════════════════════════')
  console.log('')

  // Сначала пробуем Simple Browser если обнаружен VS Code/Cursor
  if (isVSCode && hasCodeCommand) {
    if (debug) {
      console.log(`🚀 Trying ${useCursor ? 'Cursor' : 'VS Code'} Simple Browser...`)
    }
    
    const success = await openInVSCodeSimpleBrowser(url)
    if (success) {
      if (debug) {
        console.log(`✅ Successfully opened in ${useCursor ? 'Cursor' : 'VS Code'} Simple Browser`)
      }
      return
    }
  }

  // Fallback к системному браузеру если Simple Browser не сработал
  if (debug) {
    console.log(`🌐 Opening ${url} in system browser as fallback...`)
  }
  
  const systemSuccess = await openInSystemBrowser(url)
  if (systemSuccess) {
    console.log('✅ Preview opened in system browser')
    return
  }

  console.log('💡 Please manually open the URL above in your browser')
} 