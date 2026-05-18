import Anthropic from '@anthropic-ai/sdk';
import type { AskParams } from './index';

export async function askAnthropic(p: AskParams & { system: string }): Promise<string> {
  const client = new Anthropic({ apiKey: p.apiKey });
  const messages: Anthropic.MessageParam[] = [
    ...(p.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: p.prompt }
  ];
  const res = await client.messages.create({
    model: p.model,
    max_tokens: 1024,
    system: p.system,
    messages
  });
  const block = res.content.find((c) => c.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}
