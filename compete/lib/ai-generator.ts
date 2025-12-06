import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFile } from 'fs/promises'
import { join } from 'path'

export type ModelId = 'sonnet' | 'opus' | 'gpt4' | 'gemini'

interface GenerateOptions {
  model: ModelId
  challenge: string
  feedback?: string
}

const anthropic = new Anthropic()
const openai = new OpenAI()
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')

export async function generateSolution(options: GenerateOptions): Promise<string> {
  const { model, challenge, feedback = '' } = options

  // Load the challenge prompt
  const promptPath = join(process.cwd(), 'compete/challenges', challenge, 'prompt.md')
  let promptTemplate = await readFile(promptPath, 'utf-8')

  // Inject feedback if any
  if (feedback) {
    promptTemplate = promptTemplate.replace('{{feedback}}', feedback)
  } else {
    promptTemplate = promptTemplate.replace('{{feedback}}', 'None - this is your first attempt.')
  }

  const generators: Record<ModelId, () => Promise<string>> = {
    sonnet: async () => {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: promptTemplate }],
      })
      const content = response.content[0]
      return extractCode(content.type === 'text' ? content.text : '')
    },

    opus: async () => {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 4096,
        messages: [{ role: 'user', content: promptTemplate }],
      })
      const content = response.content[0]
      return extractCode(content.type === 'text' ? content.text : '')
    },

    gpt4: async () => {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: promptTemplate }],
        max_tokens: 4096,
      })
      return extractCode(response.choices[0].message.content || '')
    },

    gemini: async () => {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })
      const result = await model.generateContent(promptTemplate)
      return extractCode(result.response.text())
    },
  }

  const generator = generators[model]
  if (!generator) {
    throw new Error(`Unknown model: ${model}`)
  }

  return generator()
}

function extractCode(response: string): string {
  // Strip any preamble text before code blocks
  // LLMs often add "Here's the implementation..." before the code

  // Try to extract code from markdown code blocks
  // Match tsx/ts/typescript/javascript code blocks (case-insensitive)
  const codeBlockRegex = /```(?:tsx|typescript|ts|jsx|javascript|js)?\s*\n([\s\S]*?)```/i
  const match = response.match(codeBlockRegex)

  if (match) {
    const code = match[1].trim()
    // Verify we got actual code, not just more markdown
    if (code.length > 0 && !code.startsWith('```')) {
      return code
    }
  }

  // Try a more aggressive approach: find first code block regardless of language
  const anyCodeBlock = response.match(/```\w*\s*\n([\s\S]*?)```/)
  if (anyCodeBlock) {
    const code = anyCodeBlock[1].trim()
    if (code.length > 0) {
      return code
    }
  }

  // If no code blocks found, check if response starts with valid code indicators
  const trimmed = response.trim()
  const codeIndicators = [
    /^(import|export|const|let|var|function|class|interface|type|async|\/\/|\/\*)/,
  ]

  for (const indicator of codeIndicators) {
    if (indicator.test(trimmed)) {
      // Looks like raw code, return as-is
      return trimmed
    }
  }

  // Last resort: if there's prose followed by code-like content, try to extract just the code
  const lines = trimmed.split('\n')
  let codeStartIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (/^(import|export|const|let|var|function|class|interface|type|\/\/|\/\*)/.test(line)) {
      codeStartIndex = i
      break
    }
  }

  if (codeStartIndex > 0) {
    // Found code after some prose - return just the code portion
    return lines.slice(codeStartIndex).join('\n').trim()
  }

  // Fallback: return trimmed response
  return trimmed
}
