import { readFile } from 'fs/promises'
import { join } from 'path'

// --- Model config (loaded from models.json) ---

interface ModelConfig {
  provider: string
  model: string
  envVar: string
  keyUrl?: string
  maxTokens?: number
}

type ModelsConfig = Record<string, ModelConfig>

let _models: ModelsConfig | null = null

async function loadModels(): Promise<ModelsConfig> {
  if (_models) return _models
  const raw = await readFile(join(import.meta.dir, '../models.json'), 'utf-8')
  _models = JSON.parse(raw) as ModelsConfig
  return _models
}

/** Get the list of configured model IDs */
export async function getModelIds(): Promise<string[]> {
  return Object.keys(await loadModels())
}

/** Get config for a specific model */
export async function getModelConfig(modelId: string): Promise<ModelConfig | undefined> {
  return (await loadModels())[modelId]
}

// --- Type export (string-based, no longer a union) ---

export type ModelId = string

// --- API key validation ---

interface GenerateOptions {
  model: ModelId
  challenge: string
  feedback?: string
  customPrompt?: string
}

export async function validateApiKey(model: ModelId): Promise<void> {
  const config = await getModelConfig(model)
  if (!config) return

  const key = process.env[config.envVar]
  if (!key || key.trim() === '') {
    throw new Error(
      `Missing API key for ${model} model.\n\n` +
      `Required: ${config.envVar}\n` +
      `Provider: ${config.provider}\n` +
      (config.keyUrl ? `Get your key at: ${config.keyUrl}\n\n` : '\n') +
      `Add it to your .env file:\n` +
      `  ${config.envVar}=your-key-here`
    )
  }
}

export async function validateApiKeys(models: ModelId[]): Promise<string[]> {
  const errors: string[] = []
  const checked = new Set<string>()
  const allModels = await loadModels()

  for (const model of models) {
    const config = allModels[model]
    if (!config || checked.has(config.envVar)) continue
    checked.add(config.envVar)

    const key = process.env[config.envVar]
    if (!key || key.trim() === '') {
      errors.push(`${config.envVar} (required for ${model}${config.keyUrl ? `, get at ${config.keyUrl}` : ''})`)
    }
  }

  return errors
}

// --- Provider dispatch ---

type ProviderFn = (model: string, prompt: string, maxTokens?: number) => Promise<string>

const providerCache = new Map<string, ProviderFn>()

async function getProvider(providerName: string): Promise<ProviderFn> {
  const cached = providerCache.get(providerName)
  if (cached) return cached

  // Dynamic import of provider adapter
  const mod = await import(`./providers/${providerName}.ts`)
  const fn = mod.generate as ProviderFn
  providerCache.set(providerName, fn)
  return fn
}

// --- Code extraction ---

const CODE_KEYWORDS = /^(import|export|const|let|var|function|class|type|interface|async|\/\/|\/\*)/

function extractCode(response: string): string {
  const trimmed = response.trim()
  if (!trimmed) return ''

  // Priority 1: Fenced code block
  const fenceMatch = trimmed.match(/```(?:\w*)\n([\s\S]+?)```/)
  if (fenceMatch) {
    const code = fenceMatch[1].trim()
    if (code) return code
  }

  // Priority 2: Entire response is code
  if (CODE_KEYWORDS.test(trimmed)) return trimmed

  // Priority 3: Prose followed by code — find first code line
  const lines = response.split('\n')
  const codeStart = lines.findIndex(l => CODE_KEYWORDS.test(l.trim()))
  if (codeStart >= 0) return lines.slice(codeStart).join('\n').trim()

  // Fallback
  return trimmed
}

// --- Main generation function ---

export async function generateSolution(options: GenerateOptions): Promise<string> {
  const { model, challenge, feedback = '', customPrompt } = options

  await validateApiKey(model)

  const config = await getModelConfig(model)
  if (!config) throw new Error(`Unknown model: ${model}. Run with --help to see available models.`)

  // Build prompt
  let prompt: string
  if (customPrompt) {
    prompt = customPrompt
  } else {
    const promptPath = join(process.cwd(), 'compete/challenges', challenge, 'prompt.md')
    prompt = await readFile(promptPath, 'utf-8')
    prompt = prompt.replace('{{feedback}}', feedback || 'None - this is your first attempt.')
  }

  // Dispatch to provider
  const provider = await getProvider(config.provider)
  const rawResponse = await provider(config.model, prompt, config.maxTokens)
  return extractCode(rawResponse)
}
