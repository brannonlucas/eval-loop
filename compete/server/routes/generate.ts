/**
 * Generate Route Handler
 *
 * POST /api/generate - Generate code with a single AI model (no testing)
 */

import type { GenerateRequest, GenerateResponse } from '../types'
import { generateSolution, type ModelId } from '../../lib/ai-generator'

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  })
}

const VALID_MODELS: ModelId[] = ['sonnet', 'opus', 'gpt4', 'gemini']

export async function handleGenerate(body: unknown): Promise<Response> {
  const req = body as GenerateRequest

  if (!req.model) {
    return json({ error: 'model is required' }, 400)
  }

  if (!VALID_MODELS.includes(req.model)) {
    return json({ error: `Invalid model. Valid options: ${VALID_MODELS.join(', ')}` }, 400)
  }

  if (!req.challenge && !req.prompt) {
    return json({ error: 'challenge or prompt is required' }, 400)
  }

  try {
    const startTime = Date.now()

    const code = await generateSolution({
      model: req.model,
      challenge: req.challenge || 'custom',
      feedback: req.feedback,
      // If custom prompt provided, it will be used by ai-generator
      // (would need to extend ai-generator to support custom prompts)
    })

    const response: GenerateResponse = {
      code,
      model: req.model,
      duration: Date.now() - startTime,
    }

    return json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 500)
  }
}
