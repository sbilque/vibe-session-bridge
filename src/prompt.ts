// Conversion d'une requête Chat VS Code en ContentBlock[] ACP, et transcription de délégation.
//
// ACP : ContentBlock text / resource_link (toujours supportés), resource (si promptCapabilities.embeddedContext),
//       image (si promptCapabilities.image). Vibe 2.26.1 annonce image: true, embeddedContext: true.
// Vibe : une commande est exécutée quand le texte commence par "/nom" (vibe/acp/commands/controller.py::execute).
// VS Code : format de transcription repris de buildDelegationTranscript / createDelegationTranscriptAttachment
//           (src/vs/workbench/contrib/chat/browser/actions/chatContinueInAction.ts).
import * as vscode from 'vscode';
import type * as acp from '@agentclientprotocol/sdk';

export const MAX_TRANSCRIPT = 20_000; // MAX_DELEGATION_TRANSCRIPT_LENGTH

export interface Turn { user: string; assistant: string }

/** `User: …\nAssistant: …`, 20 000 derniers caractères, comme buildDelegationTranscript. */
export function buildTranscript(turns: readonly Turn[], max = MAX_TRANSCRIPT): string {
  let t = turns.map(x => x.assistant ? `User: ${x.user}\nAssistant: ${x.assistant}` : `User: ${x.user}`).join('\n\n');
  if (t.length > max) t = t.substring(t.length - max);
  return t;
}

/** Préambule identique à chat.delegation.transcriptContent / chat.delegation.inlinePrompt. */
export function delegationPrompt(sourceName: string, transcript: string, userPrompt: string): string {
  return transcript
    ? `The following is the conversation history from a previous ${sourceName} session. Continue working on it.\n\n${transcript}\n\nUser: ${userPrompt}`
    : userPrompt;
}

/** ChatContext.history (tours d'une autre conversation) → Turn[]. */
export function turnsFromHistory(history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>): Turn[] {
  const turns: Turn[] = [];
  for (const h of history) {
    if (h instanceof vscode.ChatRequestTurn) turns.push({ user: h.prompt, assistant: '' });
    else if (h instanceof vscode.ChatResponseTurn && turns.length) {
      turns[turns.length - 1].assistant += h.response
        .map(p => p instanceof vscode.ChatResponseMarkdownPart ? p.value.value : '')
        .join('');
    }
  }
  return turns;
}

interface PromptCaps { image: boolean; embeddedContext: boolean }

function isBinary(v: unknown): v is { mimeType: string; data(): Thenable<Uint8Array>; reference?: vscode.Uri } {
  return !!v && typeof (v as { mimeType?: unknown }).mimeType === 'string' && typeof (v as { data?: unknown }).data === 'function';
}

async function readRange(uri: vscode.Uri, range: vscode.Range): Promise<string> {
  const doc = await vscode.workspace.openTextDocument(uri);
  return doc.getText(range);
}

/** ChatRequest → ContentBlock[] en respectant les capacités annoncées par l'agent. */
export async function toPrompt(req: vscode.ChatRequest, caps: PromptCaps, prefix?: string): Promise<acp.ContentBlock[]> {
  const text = (req.command ? `/${req.command} ` : '') + (prefix ?? req.prompt);
  const blocks: acp.ContentBlock[] = [{ type: 'text', text }];

  for (const ref of req.references) {
    const v = ref.value;
    if (v instanceof vscode.Uri) {
      if (v.scheme === 'file') blocks.push({ type: 'resource_link', uri: v.toString(), name: v.path.split('/').pop() ?? v.path });
    } else if (v instanceof vscode.Location) {
      const name = v.uri.path.split('/').pop() ?? v.uri.path;
      if (caps.embeddedContext && !v.range.isEmpty) {
        // Sélection : extrait intégré (l'agent n'a pas à relire tout le fichier).
        const uri = `${v.uri.toString()}#L${v.range.start.line + 1}-L${v.range.end.line + 1}`;
        blocks.push({ type: 'resource', resource: { uri, text: await readRange(v.uri, v.range) } });
      } else {
        blocks.push({ type: 'resource_link', uri: v.uri.toString(), name });
      }
    } else if (typeof v === 'string') {
      // Texte collé, ou transcription « Previous conversation » d'une délégation entrante.
      if (caps.embeddedContext) {
        blocks.push({ type: 'resource', resource: { uri: `vscode-chat-reference:${encodeURIComponent(ref.id)}`, mimeType: 'text/markdown', text: v } });
      } else {
        blocks[0] = { type: 'text', text: `${v}\n\n${text}` };
      }
    } else if (isBinary(v) && v.mimeType.startsWith('image/') && caps.image) {
      const data = Buffer.from(await v.data()).toString('base64');
      blocks.push({ type: 'image', mimeType: v.mimeType, data, uri: v.reference?.toString() ?? null });
    }
  }
  return blocks;
}
