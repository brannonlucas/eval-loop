import { spawn } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'

export interface TestResult {
  passed: boolean
  errors: string[]
  duration: number
  rawOutput?: string // Full stdout+stderr when captureFullOutput is enabled
}

export interface BenchResult {
  name: string
  hz: number
  mean: number
  p75: number
  p99: number
}

export interface TestRunOptions {
  /** Run tests from this workspace directory instead of default */
  workspacePath?: string
  /** Full path to the test file (overrides challenge-based lookup) */
  testFilePath?: string
  /** Capture full stdout/stderr in result (for debug mode) */
  captureFullOutput?: boolean
}

function findTestFile(challenge: string): string {
  const basePath = join('compete/challenges', challenge)
  // Try .tsx first (React components), then .ts (functions)
  const tsxPath = join(basePath, 'spec.test.tsx')
  if (existsSync(tsxPath)) return tsxPath
  return join(basePath, 'spec.test.ts')
}

function findBenchFile(challenge: string): string {
  const basePath = join('compete/challenges', challenge)
  const benchPath = join(basePath, 'spec.bench.ts')
  return benchPath
}

export async function runTests(
  challenge: string,
  options: TestRunOptions = {}
): Promise<TestResult> {
  return new Promise((resolve) => {
    const { workspacePath, testFilePath, captureFullOutput } = options

    // Determine test file path
    const specPath = testFilePath || findTestFile(challenge)

    // Determine working directory
    const cwd = workspacePath || process.cwd()

    const startTime = Date.now()

    const proc = spawn('npx', ['vitest', 'run', specPath, '--reporter=json'], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      const duration = Date.now() - startTime
      const fullOutput = stdout + stderr
      const rawOutput = captureFullOutput ? fullOutput : undefined

      if (code === 0) {
        resolve({ passed: true, errors: [], duration, rawOutput })
      } else {
        // Parse errors from output
        const errors = parseTestErrors(fullOutput)
        resolve({ passed: false, errors, duration, rawOutput })
      }
    })

    proc.on('error', (err) => {
      resolve({
        passed: false,
        errors: [`Failed to run tests: ${err.message}`],
        duration: Date.now() - startTime,
        rawOutput: captureFullOutput ? `Error: ${err.message}` : undefined,
      })
    })
  })
}

export async function runBenchmarks(challenge: string): Promise<BenchResult[]> {
  return new Promise((resolve) => {
    const specPath = findBenchFile(challenge)

    const proc = spawn('npx', ['vitest', 'bench', specPath, '--reporter=json'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.on('close', () => {
      try {
        const results = parseBenchResults(stdout)
        resolve(results)
      } catch {
        resolve([])
      }
    })

    proc.on('error', () => {
      resolve([])
    })
  })
}

function parseTestErrors(output: string): string[] {
  const errors: string[] = []

  // Look for FAIL lines and assertion errors
  const lines = output.split('\n')
  let capturing = false

  for (const line of lines) {
    if (line.includes('FAIL') || line.includes('AssertionError') || line.includes('Error:')) {
      capturing = true
    }
    if (capturing) {
      errors.push(line)
      if (line.trim() === '' && errors.length > 1) {
        capturing = false
      }
    }
  }

  // If no structured errors found, return raw output
  if (errors.length === 0 && output.includes('fail')) {
    return [output.slice(0, 2000)] // Truncate to avoid huge feedback
  }

  return errors.slice(0, 20) // Limit error lines
}

function parseBenchResults(output: string): BenchResult[] {
  try {
    // Try to parse JSON output
    const json = JSON.parse(output)
    if (json.testResults) {
      return json.testResults.flatMap((file: { benchmarks?: BenchResult[] }) =>
        file.benchmarks || []
      )
    }
  } catch {
    // Fallback: parse text output
    const results: BenchResult[] = []
    const lines = output.split('\n')

    for (const line of lines) {
      // Match lines like: "sort 10k items  1,234 ops/sec"
      const match = line.match(/(.+?)\s+([\d,]+)\s+ops\/sec/)
      if (match) {
        results.push({
          name: match[1].trim(),
          hz: parseFloat(match[2].replace(/,/g, '')),
          mean: 0,
          p75: 0,
          p99: 0,
        })
      }
    }

    return results
  }

  return []
}
