import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AskParams } from './index';

export async function askGemini(p: AskParams & { system: string }): Promise<string> {
  const client = new GoogleGenerativeAI(p.apiKey);
  const model = client.getGenerativeModel({
    model: p.model,
    systemInstruction: p.system
  });
  const history = (p.history ?? []).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const chat = model.startChat({
    history,
    generationConfig: { responseMimeType: 'application/json' }
  });
  const res = await chat.sendMessage(p.prompt);
  return res.response.text() ?? '';
}
