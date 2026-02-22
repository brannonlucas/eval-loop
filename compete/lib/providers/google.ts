import { GoogleGenerativeAI } from '@google/generative-ai'

let client: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (!client) client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')
  return client
}

export async function generate(model: string, prompt: string): Promise<string> {
  const genModel = getClient().getGenerativeModel({ model })
  const result = await genModel.generateContent(prompt)
  return result.response.text()
}
