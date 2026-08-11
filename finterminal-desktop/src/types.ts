export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  time: number
}

export interface HealthInfo {
  service: string
  tools: number
  charts: string[]
}
