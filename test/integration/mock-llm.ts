// Serveur /v1/chat/completions (SSE, format OpenAI) scripté, sur le modèle de
// tests/e2e/mock_server.py de mistral-vibe. Vibe le consomme via un provider `backend = "generic"`.
// Le scénario est choisi d'après un marqueur dans le dernier message utilisateur :
//   [texte]          → réponse texte simple
//   [bash:<cmd>]     → appel d'outil bash, puis réponse reprenant le résultat de l'outil
//   [write:<chemin>] → appel d'outil write_file (3 lignes ; « path » en unified, « file_path » en legacy)
//   [echo]           → renvoie le dernier message utilisateur reçu (vérifie ce que Vibe transmet au modèle)
//   [question]       → appel d'outil ask_user_question (2 questions), puis réponse reprenant les réponses
// Arguments au format du schéma déclaré par Vibe 2.26.1 (camelCase : multiSelect, footerNote).
import http from 'node:http';
import type { AddressInfo } from 'node:net';

type Msg = { role: string; content?: unknown; tool_calls?: unknown[] };
export interface LlmRequest { messages: Msg[]; tools?: Array<{ function: { name: string } }> }

export const textOf = (c: unknown): string =>
  typeof c === 'string' ? c : Array.isArray(c) ? c.map(p => (p as { text?: string }).text ?? '').join('') : '';

export class MockLlm {
  readonly requests: LlmRequest[] = [];
  private server = http.createServer((req, res) => this.handle(req, res));
  private callSeq = 0;

  async start(): Promise<string> {
    await new Promise<void>(r => this.server.listen(0, '127.0.0.1', r));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/v1`;
  }
  stop() { this.server.closeAllConnections(); this.server.close(); }

  /** Dernier message utilisateur reçu, brut (texte et parties). */
  lastUserMessage(): Msg | undefined {
    const r = this.requests.filter(x => x.tools?.length).at(-1);
    return r ? [...r.messages].reverse().find(m => m.role === 'user') : undefined;
  }

  /** Messages `tool` (résultats d'outils) reçus par le modèle, dans l'ordre. */
  toolResults(): string[] {
    return this.requests.flatMap(r => r.messages.filter(m => m.role === 'tool').map(m => textOf(m.content)));
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse) {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      if (!req.url?.endsWith('/chat/completions')) { res.writeHead(404).end(); return; }
      const payload = JSON.parse(body) as LlmRequest;
      this.requests.push(payload);
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      const send = (delta: object, finish: string | null = null) =>
        res.write(`data: ${JSON.stringify({ id: 'mock', object: 'chat.completion.chunk', created: 1, model: 'mock-model', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
      const text = (s: string) => { for (const piece of s.match(/.{1,12}/gs) ?? []) send({ role: 'assistant', content: piece }); send({}, 'stop'); };
      const tool = (name: string, args: object) => {
        const id = `call_${++this.callSeq}`;
        send({ role: 'assistant', tool_calls: [{ index: 0, id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
        send({}, 'tool_calls');
      };

      const msgs = payload.messages;
      const lastUser = textOf([...msgs].reverse().find(m => m.role === 'user')?.content);
      const last = msgs[msgs.length - 1];
      const afterTool = last?.role === 'tool';

      // Requêtes utilitaires de Vibe (ex. génération de titre) : pas d'outils → texte court.
      if (!payload.tools?.length) text('Titre de test');
      else if (afterTool) text(`Résultat reçu : ${textOf(last.content).slice(0, 400)}`);
      else if (/\[bash:(.+?)\]/s.test(lastUser)) tool('bash', { command: lastUser.match(/\[bash:(.+?)\]/s)![1] });
      else if (/\[write:(.+?)\]/.test(lastUser)) tool('write_file', { [JSON.stringify((payload.tools as any[] | undefined)?.find((t: any) => t.function?.name === 'write_file')?.function?.parameters ?? {}).includes('"file_path"') ? 'file_path' : 'path']: lastUser.match(/\[write:(.+?)\]/)![1], content: 'ligne 1\nligne 2\nligne 3\n' });
      else if (lastUser.includes('[echo]')) text(`ECHO<<${lastUser.slice(-3000)}>>`);
      else if (lastUser.includes('[question]')) {
        tool('ask_user_question', {
          questions: [
            { question: 'Quel framework de test ?', header: 'Tests', options: [{ label: 'pytest' }, { label: 'unittest' }] },
            { question: 'Quelles plateformes ?', header: 'OS', multiSelect: true, options: [{ label: 'linux' }, { label: 'macos' }, { label: 'windows' }] },
          ],
          footerNote: 'Note de test',
        });
      } else text('Bonjour depuis le modèle simulé.');
      res.write(`data: ${JSON.stringify({ id: 'mock', object: 'chat.completion.chunk', created: 1, model: 'mock-model', choices: [], usage: { prompt_tokens: 1200, completion_tokens: 30, total_tokens: 1230 } })}\n\n`);
      res.end('data: [DONE]\n\n');
    });
  }
}
