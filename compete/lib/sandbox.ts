import vm from 'node:vm'

interface SandboxResult {
  success: boolean
  result?: unknown
  error?: string
}

/**
 * Run code in a sandboxed VM context.
 * Uses Node's vm module to create an isolated execution environment.
 * Prevents file system access, network requests, and process spawning.
 * Includes timeout protection against infinite loops.
 */
export function runInSandbox(
  code: string,
  functionName: string,
  args: unknown[],
  timeoutMs = 5000
): SandboxResult {
  try {
    // Create a restricted context with only safe globals
    const context = vm.createContext({
      // Safe built-ins
      Array,
      Object,
      Math,
      Number,
      String,
      Boolean,
      Date,
      JSON,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Symbol,
      BigInt,
      Promise,
      Proxy,
      Reflect,
      Error,
      TypeError,
      RangeError,
      SyntaxError,
      // Utilities
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURI,
      encodeURIComponent,
      decodeURI,
      decodeURIComponent,
      // Silent console (for debugging without output)
      console: {
        log: () => {},
        warn: () => {},
        error: () => {},
        info: () => {},
        debug: () => {},
      },
      // Result placeholder
      __args__: args,
      __result__: undefined,
      __error__: undefined,
    })

    // Wrap code to capture the function and call it
    const wrapped = `
      try {
        ${code}
        __result__ = ${functionName}(...__args__);
      } catch (e) {
        __error__ = e.message || String(e);
      }
    `

    vm.runInContext(wrapped, context, {
      timeout: timeoutMs,
      displayErrors: true,
    })

    if (context.__error__) {
      return { success: false, error: context.__error__ as string }
    }

    return { success: true, result: context.__result__ }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

/**
 * Validate that code doesn't contain obvious dangerous patterns.
 * This is a simple check - the VM sandbox provides the real protection.
 */
export function validateCode(code: string): { valid: boolean; reason?: string } {
  const dangerousPatterns = [
    { pattern: /require\s*\(/, reason: 'require() is not allowed' },
    { pattern: /import\s+.*\s+from/, reason: 'import statements are not allowed' },
    { pattern: /process\./, reason: 'process access is not allowed' },
    { pattern: /child_process/, reason: 'child_process is not allowed' },
    { pattern: /fs\s*\./, reason: 'fs access is not allowed' },
    { pattern: /Function\s*\(/, reason: 'Function constructor is not allowed' },
    { pattern: /globalThis/, reason: 'globalThis access is not allowed' },
  ]

  for (const { pattern, reason } of dangerousPatterns) {
    if (pattern.test(code)) {
      return { valid: false, reason }
    }
  }

  return { valid: true }
}
