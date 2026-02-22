import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export async function generate(model: string, prompt: string, maxTokens = 4096): Promise<string> {
  const response = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = response.content[0]
  if (!block || block.type !== 'text') return ''
  return block.text
}
