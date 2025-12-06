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
  // Try to extract code from markdown code blocks
  // Match tsx/ts/typescript/javascript code blocks
  const tsxMatch = response.match(/```(?:tsx|typescript|ts|jsx|javascript|js)\n([\s\S]*?)```/)
  if (tsxMatch) return tsxMatch[1].trim()

  const genericMatch = response.match(/```\n([\s\S]*?)```/)
  if (genericMatch) return genericMatch[1].trim()

  // If no code blocks, assume the whole response is code
  return response.trim()
}
