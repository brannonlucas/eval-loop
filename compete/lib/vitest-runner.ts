import { spawn } from 'child_process'
import { join } from 'path'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import os from 'os'

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

    proc.on('close', () => {
      const duration = Date.now() - startTime
      const fullOutput = stdout + stderr
      const rawOutput = captureFullOutput ? fullOutput : undefined

      try {
        // Parse JSON output from vitest reporter
        const json = JSON.parse(stdout)
        const passed = json.success === true
        const errors = extractErrorsFromJson(json)
        resolve({ passed, errors, duration, rawOutput })
      } catch {
        // Fallback if JSON parsing fails
        resolve({
          passed: false,
          errors: [fullOutput.slice(0, 2000)],
          duration,
          rawOutput,
        })
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

// Extract error messages from vitest JSON reporter output
function extractErrorsFromJson(json: {
  testResults?: Array<{
    assertionResults?: Array<{
      status: string
      failureMessages?: string[]
    }>
  }>
}): string[] {
  const errors: string[] = []

  for (const file of json.testResults || []) {
    for (const test of file.assertionResults || []) {
      if (test.status === 'failed' && test.failureMessages) {
        errors.push(...test.failureMessages)
      }
    }
  }

  return errors.slice(0, 20) // Limit error count
}

export async function runBenchmarks(challenge: string): Promise<BenchResult[]> {
  return new Promise((resolve) => {
    const specPath = findBenchFile(challenge)
    const outputFile = join(os.tmpdir(), `bench-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)

    // Use --outputJson flag to get structured JSON output directly
    const proc = spawn('npx', ['vitest', 'bench', specPath, '--run', `--outputJson=${outputFile}`], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    proc.on('close', () => {
      try {
        const json = JSON.parse(readFileSync(outputFile, 'utf-8'))
        const results: BenchResult[] = []

        for (const file of json.files || []) {
          for (const group of file.groups || []) {
            for (const bench of group.benchmarks || []) {
              results.push({
                name: bench.name,
                hz: bench.hz,
                mean: bench.mean,
                p75: bench.p75,
                p99: bench.p99,
              })
            }
          }
        }

        unlinkSync(outputFile)
        resolve(results)
      } catch {
        if (existsSync(outputFile)) unlinkSync(outputFile)
        resolve([])
      }
    })

    proc.on('error', () => {
      if (existsSync(outputFile)) unlinkSync(outputFile)
      resolve([])
    })
  })
}


