// Hôte VS Code simulé pour les tests d'intégration : implémente le sous-ensemble de l'API
// `vscode` (stable + proposée) réellement utilisé par src/. Il enregistre ce que le pont
// affiche (markdown, outils, questions) pour que les tests puissent l'inspecter.
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------- configuration pilotable par les tests ----------
export const host = {
  workspaceDir: process.cwd(),
  config: {} as Record<string, unknown>,
  /** Réponse automatique aux questionCarousel (permissions et élicitation). */
  answerCarousel: (_qs: ChatQuestion[]): Record<string, unknown> | undefined => undefined,
  carousels: [] as ChatQuestion[][],
  controllers: [] as ChatSessionItemController[],
  participants: new Map<string, { handler: Function }>(),
  contentProviders: new Map<string, { provideChatSessionContent: Function }>(),
  terminals: [] as Array<{ name: string; written: string }>,
  quickPick: (items: any[]): any => items[0],
  inputBox: (o: { value?: string }): string | undefined => o.value,
  executed: [] as Array<{ id: string; args: unknown[] }>,
};

// ---------- primitives ----------
export class EventEmitter<T> {
  private l = new Set<(v: T) => void>();
  event = (f: (v: T) => void) => { this.l.add(f); return { dispose: () => this.l.delete(f) }; };
  fire(v: T) { for (const f of [...this.l]) f(v); }
  dispose() { this.l.clear(); }
}
export class Disposable { constructor(private f: () => void) {} dispose() { this.f(); } }
export class ThemeIcon { constructor(public id: string) {} }
export class MarkdownString { constructor(public value = '') {} }
export class Position { constructor(public line: number, public character: number) {} }
export class Range {
  start: Position; end: Position;
  constructor(a: number, b: number, c: number, d: number) { this.start = new Position(a, b); this.end = new Position(c, d); }
  get isEmpty() { return this.start.line === this.end.line && this.start.character === this.end.character; }
}
export class Location { constructor(public uri: Uri, public range: unknown) {} }

export class Uri {
  private constructor(public scheme: string, public path: string) {}
  static file(p: string) { return new Uri('file', path.resolve(p)); }
  static from(c: { scheme: string; path: string }) { return new Uri(c.scheme, c.path); }
  get fsPath() { return this.path; }
  toString() { return `${this.scheme}://${this.path}`; }
}

export class CancellationTokenSource {
  private em = new EventEmitter<void>();
  isCancellationRequested = false;
  token = { isCancellationRequested: false, onCancellationRequested: this.em.event };
  cancel() { this.isCancellationRequested = this.token.isCancellationRequested = true; this.em.fire(); }
  dispose() {}
}

export class WorkspaceEdit {
  edits: Array<{ uri: Uri; text: string }> = [];
  replace(uri: Uri, _r: Range, text: string) { this.edits.push({ uri, text }); }
}

export const env = { shell: process.env.SHELL || '/bin/bash' };

export const workspace = {
  get workspaceFolders() { return [{ uri: Uri.file(host.workspaceDir) }]; },
  textDocuments: [] as unknown[],
  getConfiguration: (section: string) => ({
    get: <T>(k: string, d?: T): T => (`${section}.${k}` in host.config ? host.config[`${section}.${k}`] : d) as T,
  }),
  fs: {
    readFile: async (u: Uri) => new Uint8Array(fs.readFileSync(u.fsPath)),
    writeFile: async (u: Uri, data: Uint8Array) => { fs.mkdirSync(path.dirname(u.fsPath), { recursive: true }); fs.writeFileSync(u.fsPath, data); },
  },
  openTextDocument: async (u: Uri) => {
    const lines = fs.readFileSync(u.fsPath, 'utf8').split('\n');
    return { getText: (r: Range) => lines.slice(r.start.line, r.end.line + 1).join('\n') };
  },
  asRelativePath: (u: Uri) => path.relative(host.workspaceDir, u.fsPath),
  applyEdit: async (e: WorkspaceEdit) => { for (const x of e.edits) fs.writeFileSync(x.uri.fsPath, x.text); return true; },
};

const log = (level: string) => (...a: unknown[]) => { if (process.env.IT_VERBOSE) console.error(`[${level}]`, ...a); };
export const window = {
  createOutputChannel: () => ({ info: log('info'), warn: log('warn'), error: log('error'), debug: log('debug'), show() {}, dispose() {} }),
  createTerminal: (o: { name: string; pty?: { onDidWrite: (f: (s: string) => void) => void; open: () => void } }) => {
    const t = { name: o.name, written: '' };
    host.terminals.push(t);
    o.pty?.onDidWrite(s => { t.written += s; });
    o.pty?.open();
    return { show() {}, dispose() {} };
  },
  onDidCloseTerminal: () => ({ dispose() {} }),
  showQuickPick: async (items: any[]) => host.quickPick(items),
  showInputBox: async (o: { value?: string }) => host.inputBox(o),
  showWarningMessage: async (_m: string, _o: unknown, ...btns: string[]) => btns[0],
  activeTextEditor: undefined as unknown,
  showInformationMessage: async () => undefined,
  showErrorMessage: async () => undefined,
};
export const commands = {
  registerCommand: () => ({ dispose() {} }),
  executeCommand: async (id: string, ...args: unknown[]) => { host.executed.push({ id, args }); return undefined; },
};

// ---------- Chat : parties de réponse ----------
export class ChatResponseMarkdownPart { value: MarkdownString; constructor(v: string | MarkdownString) { this.value = typeof v === 'string' ? new MarkdownString(v) : v; } }
export class ChatResponseThinkingProgressPart { constructor(public value: string) {} }
export class ChatToolInvocationPart {
  isError?: boolean; invocationMessage?: string | MarkdownString; pastTenseMessage?: string | MarkdownString;
  isConfirmed?: boolean; isComplete?: boolean; toolSpecificData?: any;
  constructor(public toolName: string, public toolCallId: string) {}
}
export class ChatRequestTurn { constructor(public prompt: string) {} }
export class ChatResponseTurn { constructor(public response: unknown[]) {} }
export class ChatSessionChangedFile { constructor(public uri: Uri, public originalUri: Uri | undefined, public modifiedUri: Uri | undefined, public insertions: number, public deletions: number) {} }
export class ChatRequestTurn2 { constructor(public prompt: string, ...rest: unknown[]) { void rest; } }
export class ChatResponseTurn2 { constructor(public response: unknown[], public result: unknown, public participant: string) {} }
export enum ChatQuestionType { Text = 1, SingleSelect = 2, MultiSelect = 3 }
export class ChatQuestion {
  message?: string | MarkdownString; options?: Array<{ id: string; label: string; value: unknown }>;
  defaultValue?: string | string[]; allowFreeformInput?: boolean;
  constructor(public id: string, public type: ChatQuestionType, public title: string, o: object = {}) { Object.assign(this, o); }
}
export class LanguageModelTextPart { constructor(public value: string) {} }
export const lm = { tools: [] as Array<{ name: string }>, invokeTool: async () => { throw new Error('non disponible'); } };

/** Flux de réponse enregistreur (ChatResponseStream). */
export class RecordingStream {
  parts: unknown[] = [];
  get markdown() { return (s: string) => { this.parts.push(new ChatResponseMarkdownPart(s)); }; }
  push(p: unknown) { this.parts.push(p); }
  warning(s: string) { this.parts.push({ warning: s }); }
  reference(u: Uri) { this.parts.push({ reference: u.fsPath }); }
  progress(s: string) { this.parts.push({ progress: s }); }
  async questionCarousel(qs: ChatQuestion[]) { host.carousels.push(qs); return host.answerCarousel(qs); }
  text() { return this.parts.filter(p => p instanceof ChatResponseMarkdownPart).map(p => (p as ChatResponseMarkdownPart).value.value).join(''); }
  tools() {
    const byId = new Map<string, ChatToolInvocationPart>();
    for (const p of this.parts) if (p instanceof ChatToolInvocationPart) byId.set(p.toolCallId, p);
    return [...byId.values()];
  }
}

// ---------- Chat : sessions (API proposée chatSessionsProvider) ----------
export interface ChatSessionItem { resource: Uri; label: string; iconPath?: unknown; timing?: any; badge?: string; changes?: ChatSessionChangedFile[] }
class ItemCollection {
  private m = new Map<string, ChatSessionItem>();
  add(i: ChatSessionItem) { this.m.set(i.resource.toString(), i); }
  get(u: Uri) { return this.m.get(u.toString()); }
  replace(items: ChatSessionItem[]) { this.m.clear(); items.forEach(i => this.add(i)); }
  all() { return [...this.m.values()]; }
  forEach(f: (i: ChatSessionItem) => void) { this.m.forEach(i => f(i)); }
  delete(u: Uri) { this.m.delete(u.toString()); }
}
export class ChatSessionItemController {
  items = new ItemCollection();
  newChatSessionItemHandler?: (ctx: { request: { prompt: string; command?: string } }, t: unknown) => Promise<ChatSessionItem>;
  forkHandler?: (resource: Uri, req: unknown, t: unknown) => Promise<ChatSessionItem>;
  getChatSessionInputState?: (resource: Uri | undefined, ctx: unknown, t: unknown) => Promise<{ groups: any[] }>;
  constructor(public id: string, public refreshHandler: (t: unknown) => Promise<void>) {}
  createChatSessionItem(resource: Uri, label: string): ChatSessionItem { return { resource, label }; }
  createChatSessionInputState(groups: any[]) { return { groups, onDidChange: () => ({ dispose() {} }), onDidDispose: () => ({ dispose() {} }), sessionResource: undefined }; }
  dispose() {}
}
export const chat = {
  createChatSessionItemController: (id: string, refresh: (t: unknown) => Promise<void>) => {
    const c = new ChatSessionItemController(id, refresh);
    host.controllers.push(c);
    return c;
  },
  createChatParticipant: (id: string, handler: Function) => {
    const p = { id, handler, iconPath: undefined as unknown, dispose() {} };
    host.participants.set(id, p);
    return p;
  },
  registerChatSessionContentProvider: (scheme: string, provider: { provideChatSessionContent: Function }) => {
    host.contentProviders.set(scheme, provider);
    return { dispose() {} };
  },
};
