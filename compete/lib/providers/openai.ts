import OpenAI from 'openai'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) client = new OpenAI()
  return client
}

export async function generate(model: string, prompt: string, maxTokens = 4096): Promise<string> {
  const response = await getClient().chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
  })
  return response.choices[0]?.message.content || ''
}
