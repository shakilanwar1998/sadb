import OpenAI from 'openai';
import type { AskParams } from './index';

export async function askOpenAi(p: AskParams & { system: string }): Promise<string> {
  const client = new OpenAI({ apiKey: p.apiKey });
  const res = await client.chat.completions.create({
    model: p.model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: p.system },
      ...(p.history ?? []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user', content: p.prompt }
    ]
  });
  return res.choices[0]?.message?.content ?? '';
}
