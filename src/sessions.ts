// Intégration Session Target.
//
// Référence côté VS Code (microsoft/vscode@main, octobre 2026) :
//   - Claude n'est plus implémenté via l'API d'extension : c'est un harness IAgent
//     interne à l'Agent Host (src/vs/platform/agentHost/node/claude/). Inaccessible aux extensions.
//   - La référence encore valable pour une extension est Copilot CLI :
//     extensions/copilot/src/extension/chatSessions/vscode-node/copilotCLIChatSessions.ts
//     (createChatSessionItemController + getChatSessionInputState + participant + content provider).
//
// Référence côté agent : mistral-vibe 2.26.1, vibe/acp/agent.py et vibe/acp/session_updates.py.
import * as vscode from 'vscode';
import type * as acp from '@agentclientprotocol/sdk';
import { VibeAcpAgent } from './acpAgent';
import { answerElicitation } from './elicitation';
import { toPrompt, buildTranscript, delegationPrompt, turnsFromHistory, type Turn } from './prompt';
import type { TurnSource } from './continueIn';

export const SCHEME = 'mistral-vibe';
const uriFor = (sessionId: string) => vscode.Uri.from({ scheme: SCHEME, path: `/${sessionId}` });
const idOf = (uri: vscode.Uri) => uri.path.replace(/^\//, '');
const SHELL_LANG = process.platform === 'win32' ? 'powershell' : 'bash'; // mêmes valeurs que copilotCLITools.ts

interface SessionState {
  configOptions: acp.SessionConfigOption[];
  /** Session présente dans le processus vibe-acp courant (requis par fork_session : `_get_session`). */
  live: boolean;
  /** Tours user/assistant (texte) pour « Continuer dans… » (buildDelegationTranscript). */
  turns: Turn[];
  /** Fichiers modifiés (ToolCallContent diff) → ChatSessionItem.changes. */
  changes: Map<string, Map<string, { insertions: number; deletions: number }>>; // chemin → toolCallId → delta
}

/** Suivi d'un appel d'outil ACP pendant un tour. */
interface ToolTrack {
  part: vscode.ChatToolInvocationPart;
  kind: acp.ToolKind | undefined;
  command?: string;
  output: string;
  rejected?: boolean;
  sessionId: string;
}

export class VibeSessions implements vscode.Disposable, TurnSource {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly controller: vscode.ChatSessionItemController;
  private readonly state = new Map<string, SessionState>();
  /**
   * Session ACP pré-créée : Copilot CLI construit les groupes d'options d'une *nouvelle*
   * session avant qu'elle existe (getChatSessionInputState sans ressource). Chez Vibe, les
   * configOptions (mode/model/thinking) ne sont connues qu'après session/new ; on en garde
   * une d'avance. Vibe ne la persiste qu'au premier message (session/list l'ignore jusque-là).
   */
  private pending: Promise<acp.NewSessionResponse> | undefined;

  constructor(private readonly agent: VibeAcpAgent, private readonly log: vscode.LogOutputChannel) {
    this.controller = vscode.chat.createChatSessionItemController(SCHEME, t => this.refresh(t));
    this.disposables.push(this.controller);

    // Même logique que Copilot CLI : l'élément est créé tout de suite, titre = prompt.
    this.controller.newChatSessionItemHandler = async (ctx) => {
      const res = await this.takePending();
      this.setState(res.sessionId, res.configOptions ?? []);
      const resource = uriFor(res.sessionId);
      const item = this.controller.createChatSessionItem(resource, ctx.request.prompt || ctx.request.command || 'Mistral Vibe');
      item.iconPath = new vscode.ThemeIcon('sparkle');
      item.timing = { created: Date.now() };
      this.controller.items.add(item);
      return item;
    };

    // fork_session (vibe/acp/agent.py) : la session source doit être chargée dans le processus.
    if (this.agent.capabilities?.sessionCapabilities?.fork != null) {
      this.controller.forkHandler = async (resource) => {
        const sessionId = idOf(resource);
        await this.ensureLive(sessionId);
        const conn = await this.agent.connection();
        // Vibe accepte `messageId` (ForkSessionParams) mais l'id de requête VS Code n'est pas
        // un id de message Vibe : on duplique la session entière.
        let res: acp.ForkSessionResponse;
        try {
          res = await conn.unstable_forkSession({ sessionId, cwd: this.cwd(), mcpServers: [] });
        } catch (e) {
          // Constaté avec vibe-acp 2.26.1 : une session sans message n'est pas persistée → -32602.
          throw new Error(`Fork impossible (la session doit contenir au moins un échange) : ${(e as Error).message}`);
        }
        this.setState(res.sessionId, res.configOptions ?? []);
        const item = this.controller.createChatSessionItem(uriFor(res.sessionId), `Fork : ${this.controller.items.get(resource)?.label ?? sessionId}`);
        item.iconPath = new vscode.ThemeIcon('sparkle');
        item.timing = { created: Date.now() };
        this.controller.items.add(item);
        return item;
      };
    }

    // Groupes d'options, nouvelle session ou existante (cf. copilotCLIChatSessions.ts).
    this.controller.getChatSessionInputState = async (resource) => {
      let opts: acp.SessionConfigOption[];
      if (resource) {
        opts = this.state.get(idOf(resource))?.configOptions ?? [];
      } else {
        opts = (await this.peekPending().catch(() => undefined))?.configOptions ?? [];
      }
      return this.controller.createChatSessionInputState(toGroups(opts));
    };

    const participant = vscode.chat.createChatParticipant(SCHEME, (req, ctx, stream, token) => this.handle(req, ctx, stream, token));
    participant.iconPath = new vscode.ThemeIcon('sparkle');
    this.disposables.push(participant);
    this.disposables.push(vscode.chat.registerChatSessionContentProvider(SCHEME, {
      provideChatSessionContent: (resource, token) => this.content(resource, token),
    }, participant, { supportsInterruptions: true }));
  }

  private setState(sessionId: string, configOptions: acp.SessionConfigOption[] | null | undefined): SessionState {
    const prev = this.state.get(sessionId);
    const st: SessionState = { configOptions: configOptions ?? [], live: true, turns: prev?.turns ?? [], changes: prev?.changes ?? new Map() };
    this.state.set(sessionId, st);
    return st;
  }

  // ---- TurnSource (continueIn.ts) ----
  items(): Array<{ resource: vscode.Uri; label: string }> {
    const out: Array<{ resource: vscode.Uri; label: string }> = [];
    this.controller.items.forEach(i => { out.push({ resource: i.resource, label: i.label }); });
    return out;
  }

  async turns(resource: vscode.Uri): Promise<Turn[]> {
    const id = idOf(resource);
    if (!this.state.get(id)?.turns.length) await this.content(resource, new vscode.CancellationTokenSource().token);
    return this.state.get(id)?.turns ?? [];
  }

  // ---- Menu chat/chatSessions : renommer / supprimer (méthodes d'extension Vibe, agent.py::ext_method) ----
  async rename(item: vscode.ChatSessionItem | undefined): Promise<void> {
    if (!item) return;
    const title = await vscode.window.showInputBox({ title: 'Renommer la session Mistral Vibe', value: item.label });
    if (!title?.trim()) return;
    const conn = await this.agent.connection();
    await conn.extMethod('_session/set_title', { sessionId: idOf(item.resource), title: title.trim() });
    item.label = title.trim();
    this.controller.items.add(item);
  }

  async remove(item: vscode.ChatSessionItem | undefined): Promise<void> {
    if (!item) return;
    const ok = await vscode.window.showWarningMessage(`Supprimer la session « ${item.label} » ?`, { modal: true }, 'Supprimer');
    if (ok !== 'Supprimer') return;
    const conn = await this.agent.connection();
    await conn.extMethod('_session/delete', { sessionId: idOf(item.resource) });
    this.state.delete(idOf(item.resource));
    this.controller.items.delete(item.resource);
  }

  private updateItem(sessionId: string, f: (item: vscode.ChatSessionItem) => void): void {
    const item = this.controller.items.get(uriFor(sessionId));
    if (!item) return;
    f(item);
    this.controller.items.add(item);
  }

  private cwd(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  }

  private peekPending(): Promise<acp.NewSessionResponse> {
    this.pending ??= this.agent.newSession(this.cwd());
    this.pending.catch(() => { this.pending = undefined; });
    return this.pending;
  }

  private async takePending(): Promise<acp.NewSessionResponse> {
    const res = await this.peekPending();
    this.pending = undefined;
    void this.peekPending().catch(e => this.log.warn(`pré-création de session : ${(e as Error).message}`));
    return res;
  }

  private async ensureLive(sessionId: string): Promise<void> {
    if (this.state.get(sessionId)?.live) return;
    const conn = await this.agent.connection();
    const sub = this.agent.onUpdate(sessionId, () => { /* rejeu ignoré ici */ });
    try {
      const res = await conn.loadSession({ sessionId, cwd: this.cwd(), mcpServers: [] });
      this.setState(sessionId, res.configOptions ?? []);
    } finally { sub.dispose(); }
  }

  /** session/list (Vibe : title = titre LLM ou aperçu du 1er message, updatedAt ISO). */
  private async refresh(_t: vscode.CancellationToken): Promise<void> {
    try {
      const conn = await this.agent.connection();
      if (this.agent.capabilities?.sessionCapabilities?.list == null) return;
      const res = await conn.listSessions({ cwd: this.cwd() });
      this.controller.items.replace(res.sessions.map(s => {
        const item = this.controller.createChatSessionItem(uriFor(s.sessionId), s.title || s.sessionId);
        item.iconPath = new vscode.ThemeIcon('sparkle');
        if (s.updatedAt) item.timing = { created: Date.parse(s.updatedAt), lastRequestEnded: Date.parse(s.updatedAt) };
        return item;
      }));
    } catch (e) {
      this.log.error(`session/list : ${(e as Error).message}`);
    }
  }

  /**
   * Ouverture d'une session existante : session/load. Vibe rejoue l'historique
   * (replay_session_updates) : user/agent_message_chunk, agent_thought_chunk, tool_call, plan,
   * session_info_update. On reconstruit ChatRequestTurn2 / ChatResponseTurn2 comme chatHistoryBuilder.ts.
   */
  private async content(resource: vscode.Uri, _token: vscode.CancellationToken): Promise<vscode.ChatSession> {
    const sessionId = idOf(resource);
    const history: Array<vscode.ChatRequestTurn2 | vscode.ChatResponseTurn2> = [];
    if (this.state.get(sessionId)?.live || !this.agent.capabilities?.loadSession) return { history, requestHandler: undefined };

    let parts: vscode.ExtendedChatResponsePart[] = [];
    let userText = '';
    let agentText = '';
    let lastWasUser = false;
    const turns: Turn[] = [];
    const flush = () => {
      if (userText) history.push(new vscode.ChatRequestTurn2(userText, undefined, [], '', [], [], undefined, undefined, undefined));
      if (parts.length) history.push(new vscode.ChatResponseTurn2(parts, {}, SCHEME));
      if (userText || agentText) turns.push({ user: userText, assistant: agentText });
      userText = ''; agentText = ''; parts = [];
    };
    const sub = this.agent.onUpdate(sessionId, u => {
      switch (u.sessionUpdate) {
        case 'user_message_chunk':
          if (!lastWasUser) flush();
          if (u.content.type === 'text') userText += u.content.text;
          lastWasUser = true;
          return;
        case 'agent_message_chunk':
          if (u.content.type === 'text') { parts.push(new vscode.ChatResponseMarkdownPart(u.content.text)); agentText += u.content.text; }
          break;
        case 'agent_thought_chunk':
          if (u.content.type === 'text') parts.push(new vscode.ChatResponseThinkingProgressPart(u.content.text));
          break;
        case 'tool_call': {
          const t = startTool(u, sessionId);
          for (const c of u.content ?? []) if (c.type === 'content' && c.content.type === 'text') t.output += c.content.text;
          finishTool(t, u.status ?? 'completed', u.rawOutput, undefined);
          parts.push(t.part);
          break;
        }
        default:
          break;
      }
      lastWasUser = false;
    });
    try {
      const conn = await this.agent.connection();
      const res = await conn.loadSession({ sessionId, cwd: this.cwd(), mcpServers: [] });
      this.setState(sessionId, res.configOptions ?? []);
    } finally { sub.dispose(); flush(); }
    return { history, requestHandler: undefined };
  }

  /**
   * Applique les options choisies au moment de la requête, comme Copilot CLI
   * (getSelectedSessionOptions(chatSessionContext.inputState)). Vibe accepte la modification
   * en cours de session via set_config_option (mode, model = alias, thinking).
   */
  private async applyOptions(sessionId: string, input: vscode.ChatSessionInputState | undefined): Promise<void> {
    const st = this.state.get(sessionId);
    if (!st || !input) return;
    const conn = await this.agent.connection();
    for (const g of input.groups) {
      const opt = st.configOptions.find(o => o.id === g.id);
      if (!opt || opt.type !== 'select' || !g.selected || g.selected.id === opt.currentValue) continue;
      const res = await conn.setSessionConfigOption({ sessionId, configId: g.id, value: g.selected.id });
      st.configOptions = res.configOptions;
    }
  }

  /** Tour : session/prompt + diffusion des session/update dans le flux Chat. */
  private async handle(req: vscode.ChatRequest, ctx: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<vscode.ChatResult> {
    const sc = ctx.chatSessionContext;
    if (!sc) {
      stream.markdown('Ouvrez une nouvelle session **Mistral Vibe** depuis le sélecteur Session Target.');
      return {};
    }
    const sessionId = idOf(sc.chatSessionItem.resource);
    await this.ensureLive(sessionId);
    await this.applyOptions(sessionId, sc.inputState);
    const conn = await this.agent.connection();
    const tools = new Map<string, ToolTrack>();
    const st = this.state.get(sessionId)!;
    const turn: Turn = { user: req.prompt, assistant: '' };

    // Délégation entrante : la conversation d'origine arrive dans ChatContext.history (chemin
    // chatService.sendRequest(…, { agentIdSilent }) de chatContinueInAction.ts). Copilot CLI la résume ;
    // on l'injecte au premier tour sous la forme de chat.delegation.inlinePrompt.
    let prefix: string | undefined;
    if (!st.turns.length && ctx.history.length) {
      prefix = delegationPrompt('VS Code Chat', buildTranscript(turnsFromHistory(ctx.history)), req.prompt);
    }
    const caps = this.agent.capabilities?.promptCapabilities;
    const prompt = await toPrompt(req, { image: !!caps?.image, embeddedContext: !!caps?.embeddedContext }, prefix);
    this.updateItem(sessionId, i => { i.timing = { ...(i.timing ?? { created: Date.now() }), lastRequestStarted: Date.now() }; });

    const subs = [
      this.agent.onUpdate(sessionId, u => {
        if (u.sessionUpdate === 'agent_message_chunk' && u.content.type === 'text') turn.assistant += u.content.text;
        this.render(u, stream, tools, sessionId);
      }),
      this.agent.onPermission(sessionId, r => askPermission(r, req, stream, tools, token)),
      this.agent.onElicitation(sessionId, r => {
        // Vibe renseigne toolCallId (related_entry_id) : titre de l'appel ask_user_question.
        const tcId = (r as { toolCallId?: string | null }).toolCallId;
        const msg = tcId ? tools.get(tcId)?.part.invocationMessage : undefined;
        return answerElicitation(r, stream, typeof msg === 'string' ? msg : msg?.value);
      }),
      token.onCancellationRequested(() => { void conn.cancel({ sessionId }); this.agent.terminals.killSession(sessionId); }),
    ];
    try {
      const res = await conn.prompt({ sessionId, prompt });
      if (res.stopReason === 'refusal') stream.warning('Requête refusée par l\'agent.');
      if (res.stopReason === 'max_tokens' || res.stopReason === 'max_turn_requests') stream.warning(`Arrêt : ${res.stopReason}`);
      return { metadata: { stopReason: res.stopReason } };
    } catch (e) {
      return { errorDetails: { message: (e as Error).message } };
    } finally {
      subs.forEach(s => s.dispose());
      st.turns.push(turn);
      this.updateItem(sessionId, i => { i.timing = { ...(i.timing ?? { created: Date.now() }), lastRequestEnded: Date.now() }; });
    }
  }

  private render(u: acp.SessionNotification['update'], stream: vscode.ChatResponseStream, tools: Map<string, ToolTrack>, sessionId: string): void {
    switch (u.sessionUpdate) {
      case 'agent_message_chunk':
        if (u.content.type === 'text') stream.markdown(u.content.text);
        break;
      case 'agent_thought_chunk':
        if (u.content.type === 'text') stream.push(new vscode.ChatResponseThinkingProgressPart(u.content.text));
        break;
      case 'tool_call': {
        const t = startTool(u, sessionId);
        tools.set(u.toolCallId, t);
        this.appendContent(t, u.content, stream);
        if (u.status === 'completed' || u.status === 'failed') this.complete(t, u.status, u.rawOutput, sessionId);
        stream.push(t.part);
        break;
      }
      case 'tool_call_update': {
        const t = tools.get(u.toolCallId);
        if (!t) break;
        if (u.title) t.part.invocationMessage = u.title;
        if (u.kind) t.kind = u.kind;
        const cmd = commandOf(u.rawInput);
        if (cmd) { t.command = cmd; setShellData(t); }
        this.appendContent(t, u.content, stream);
        if (u.status === 'completed' || u.status === 'failed') {
          this.complete(t, u.status, u.rawOutput, sessionId);
          stream.push(t.part);
        }
        break;
      }
      case 'plan':
        stream.markdown('\n' + u.entries.map(e => `- [${e.status === 'completed' ? 'x' : ' '}] ${e.content}`).join('\n') + '\n');
        break;
      case 'config_option_update': {
        const st = this.state.get(sessionId);
        if (st) st.configOptions = u.configOptions;
        break;
      }
      case 'session_info_update': {
        const item = this.controller.items.get(uriFor(sessionId));
        if (item && u.title) { item.label = u.title; this.controller.items.add(item); }
        break;
      }
      case 'usage_update':
        // UsageUpdate { used, size } : occupation du contexte → badge de la session.
        if (u.size > 0) this.updateItem(sessionId, i => { i.badge = `${Math.round((u.used / u.size) * 100)} % du contexte`; });
        break;
      case 'available_commands_update':
        // Pas d'API de commandes slash dynamiques : les commandes intégrées sont déclarées dans package.json,
        // les skills restent utilisables en tapant « /nom ».
        this.log.debug(`commandes Vibe : ${u.availableCommands.map(c => '/' + c.name).join(' ')}`);
        break;
      default:
        break; // current_mode_update (non émis par Vibe ; les modes passent par configOptions)
    }
  }

  /** Vibe diffuse la sortie shell en deltas `content`/text dans tool_call_update (_effect_progress_updates). */
  private appendContent(t: ToolTrack, content: acp.ToolCallContent[] | null | undefined, stream: vscode.ChatResponseStream): void {
    for (const c of content ?? []) {
      if (c.type === 'content' && c.content.type === 'text') t.output += c.content.text;
      if (c.type === 'diff') {
        stream.reference(vscode.Uri.file(c.path));
        this.recordChange(t.sessionId, t.part.toolCallId, c);
      }
    }
  }

  /** ToolCallContent diff { path, oldText, newText } → ChatSessionItem.changes. */
  private recordChange(sessionId: string, toolCallId: string, d: { path: string; oldText?: string | null; newText: string }): void {
    const st = this.state.get(sessionId);
    if (!st) return;
    // Un même appel d'outil renvoie son diff dans tool_call puis tool_call_update : la dernière valeur remplace.
    const perTool = st.changes.get(d.path) ?? new Map();
    perTool.set(toolCallId, lineDelta(d.oldText ?? '', d.newText));
    st.changes.set(d.path, perTool);
    this.updateItem(sessionId, i => {
      i.changes = [...st.changes].map(([p, m]) => {
        let ins = 0, del = 0;
        for (const c of m.values()) { ins += c.insertions; del += c.deletions; }
        return new vscode.ChatSessionChangedFile(vscode.Uri.file(p), undefined, vscode.Uri.file(p), ins, del);
      });
    });
  }

  private complete(t: ToolTrack, status: acp.ToolCallStatus, rawOutput: unknown, sessionId: string): void {
    // Code de sortie : ShellEffectOutput n'en a pas. En legacy harness, on le prend du terminal client ACP
    // ayant exécuté la même commande ; en unified harness (shell interne à Vibe), il reste inconnu.
    const exitCode = t.command ? this.agent.terminals.lastExitCode(sessionId, t.command) : undefined;
    finishTool(t, status, rawOutput, exitCode);
  }

  dispose(): void {
    // session/close (sessionCapabilities.close annoncée par Vibe) pour la session pré-créée.
    const p = this.pending;
    if (p && this.agent.capabilities?.sessionCapabilities?.close != null) {
      void p.then(async r => (await this.agent.connection()).closeSession({ sessionId: r.sessionId })).catch(() => undefined);
    }
    this.disposables.forEach(d => d.dispose());
  }
}

/** Nombre de lignes ajoutées / supprimées (multiensemble de lignes, suffisant pour un compteur). */
export function lineDelta(oldText: string, newText: string): { insertions: number; deletions: number } {
  const count = new Map<string, number>();
  const lines = (t: string) => t ? t.replace(/\n$/, '').split('\n') : [];
  const a = lines(oldText);
  const b = lines(newText);
  for (const l of a) count.set(l, (count.get(l) ?? 0) + 1);
  let insertions = 0;
  for (const l of b) {
    const n = count.get(l) ?? 0;
    if (n > 0) count.set(l, n - 1); else insertions++;
  }
  let deletions = 0;
  for (const n of count.values()) deletions += n;
  return { insertions, deletions };
}

function commandOf(rawInput: unknown): string | undefined {
  const c = (rawInput as { command?: unknown } | null | undefined)?.command;
  return typeof c === 'string' ? c : undefined; // ShellEffectInput { command: str }
}

function startTool(u: Extract<acp.SessionNotification['update'], { sessionUpdate: 'tool_call' }>, sessionId: string): ToolTrack {
  const part = new vscode.ChatToolInvocationPart(u.kind ?? 'other', u.toolCallId);
  part.invocationMessage = u.title;
  const t: ToolTrack = { part, kind: u.kind ?? undefined, command: commandOf(u.rawInput), output: '', sessionId };
  setShellData(t);
  return t;
}

function setShellData(t: ToolTrack): void {
  if (t.kind !== 'execute' || !t.command) return;
  t.part.toolSpecificData = { commandLine: { original: t.command }, language: SHELL_LANG };
}

/** Clôture comme processToolExecutionComplete (copilotCLITools.ts) : isComplete, isError, isConfirmed. */
function finishTool(t: ToolTrack, status: acp.ToolCallStatus, rawOutput: unknown, exitCode: number | undefined): void {
  t.part.isComplete = true;
  t.part.isError = status === 'failed';
  t.part.isConfirmed = !t.rejected;
  t.part.pastTenseMessage = t.part.invocationMessage;
  if (t.kind === 'execute' && t.command) {
    // rawOutput shell constaté (Vibe 2.26.1, deux harness) : ShellEffectOutput { stdout, stderr, output, truncated },
    // sans code de sortie ; `returncode` n'existe que dans le message envoyé au modèle. On le lit s'il apparaît.
    const out = (rawOutput as { output?: string; stdout?: string; stderr?: string; returncode?: number } | null) ?? {};
    if (exitCode === undefined && typeof out.returncode === 'number') exitCode = out.returncode;
    const text = t.output || out.output || [out.stdout, out.stderr].filter(Boolean).join('\n');
    t.part.toolSpecificData = {
      commandLine: { original: t.command },
      language: SHELL_LANG,
      output: { text: text.replace(/\r?\n/g, '\r\n') }, // format attendu, cf. formatShellInvocationCompleted
      state: { exitCode },
    };
  }
}


/** configOptions ACP (type "select") → groupes du sélecteur VS Code. */
function toGroups(opts: acp.SessionConfigOption[]): vscode.ChatSessionProviderOptionGroup[] {
  return opts.flatMap(o => {
    if (o.type !== 'select') return [];
    const flat = o.options.flatMap(x => 'group' in x ? x.options : [x]);
    const items = flat.map(x => ({ id: x.value, name: x.name, description: x.description ?? undefined }));
    return [{ id: o.id, name: o.name, description: o.description ?? undefined, items, selected: items.find(i => i.id === o.currentValue) }];
  });
}

const CONFIRM_WITH_OPTIONS = 'vscode_get_confirmation_with_options'; // confirmationTool.ts (cœur VS Code)

/**
 * session/request_permission. Vibe n'envoie que `toolCall.toolCallId` (agent.py::_answer_callback) :
 * le titre et la commande viennent de notre suivi des tool_call.
 * UI : outil de confirmation interne de VS Code (comme permissionHelpers.ts de Copilot CLI),
 * variante « with options » pour garder toutes les options ACP ; repli sur questionCarousel.
 */
async function askPermission(
  req: acp.RequestPermissionRequest, chatReq: vscode.ChatRequest, stream: vscode.ChatResponseStream,
  tools: Map<string, ToolTrack>, token: vscode.CancellationToken,
): Promise<acp.RequestPermissionResponse> {
  const t = tools.get(req.toolCall.toolCallId);
  const title = req.toolCall.title ?? (typeof t?.part.invocationMessage === 'string' ? t.part.invocationMessage : t?.part.invocationMessage?.value) ?? 'Autoriser l\'action ?';
  const message = t?.command ? '```' + SHELL_LANG + '\n' + t.command + '\n```' : title;
  const byName = new Map(req.options.map(o => [o.name, o]));
  let chosen: acp.PermissionOption | undefined;
  let answered = false;

  if (vscode.lm.tools.some(x => x.name === CONFIRM_WITH_OPTIONS)) {
    try {
      const r = await vscode.lm.invokeTool(CONFIRM_WITH_OPTIONS, {
        input: { title: `Mistral Vibe : ${title}`, message, buttons: req.options.map(o => o.name) },
        toolInvocationToken: chatReq.toolInvocationToken,
      }, token);
      const first = r.content[0];
      const value = first instanceof vscode.LanguageModelTextPart ? first.value : undefined;
      // Bouton personnalisé → son libellé ; « Allow » standard → 'yes'.
      chosen = value === 'yes' ? req.options.find(o => o.kind === 'allow_once') : value ? byName.get(value) : undefined;
      answered = true;
      if (!chosen) chosen = req.options.find(o => o.kind === 'reject_once'); // « Skip » = refus
    } catch {
      chosen = undefined; // refus ou outil indisponible pour cette extension → repli
    }
  }
  if (!answered) {
    const q = new vscode.ChatQuestion('permission', vscode.ChatQuestionType.SingleSelect, title, {
      message,
      options: req.options.map(o => ({ id: o.optionId, label: o.name, value: o.optionId })),
      defaultValue: req.options.find(o => o.kind === 'reject_once')?.optionId,
    });
    const answer = await stream.questionCarousel([q], false);
    // Format VS Code (chatQuestionCarouselPart.ts) : { selectedValue, freeformValue }.
    const a = answer?.['permission'] as { selectedValue?: string } | string | undefined;
    const id = typeof a === 'string' ? a : a?.selectedValue;
    chosen = req.options.find(o => o.optionId === id);
  }
  if (!chosen) return { outcome: { outcome: 'cancelled' } };
  if (t && chosen.kind.startsWith('reject')) t.rejected = true;
  return { outcome: { outcome: 'selected', optionId: chosen.optionId } };
}
