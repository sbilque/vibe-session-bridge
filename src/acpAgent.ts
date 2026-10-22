// Connexion ACP (JSON-RPC ndjson sur stdio) vers `vibe-acp`.
// Méthodes et types : @agentclientprotocol/sdk 1.8.0 (PROTOCOL_VERSION = 1).
// Côté Vibe : vibe/acp/agent.py (agent-client-protocol==0.11.0, Python).
import { spawn, ChildProcess } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import * as vscode from 'vscode';
import * as acp from '@agentclientprotocol/sdk';
import { AcpTerminalManager } from './terminals';

export type UpdateListener = (update: acp.SessionNotification['update']) => void;
export type ElicitationHandler = (req: acp.CreateElicitationRequest) => Promise<acp.CreateElicitationResponse>;
export type PermissionHandler = (req: acp.RequestPermissionRequest) => Promise<acp.RequestPermissionResponse>;

/** Code d'erreur ACP `auth_required`. */
const AUTH_REQUIRED = -32000;

export class VibeAcpAgent implements vscode.Disposable {
  private proc: ChildProcess | undefined;
  private conn: acp.ClientSideConnection | undefined;
  private init: acp.InitializeResponse | undefined;
  private starting: Promise<void> | undefined;
  private readonly listeners = new Map<string, UpdateListener>();
  private readonly permissionHandlers = new Map<string, PermissionHandler>();
  private readonly elicitationHandlers = new Map<string, ElicitationHandler>();

  readonly terminals: AcpTerminalManager;

  constructor(private readonly log: vscode.LogOutputChannel) {
    this.terminals = new AcpTerminalManager(log);
  }

  get capabilities() { return this.init?.agentCapabilities; }
  get authMethods() { return this.init?.authMethods ?? []; }

  /** Abonne un écouteur aux notifications `session/update` d'une session. */
  onUpdate(sessionId: string, l: UpdateListener): vscode.Disposable {
    this.listeners.set(sessionId, l);
    return { dispose: () => { if (this.listeners.get(sessionId) === l) this.listeners.delete(sessionId); } };
  }

  onPermission(sessionId: string, h: PermissionHandler): vscode.Disposable {
    this.permissionHandlers.set(sessionId, h);
    return { dispose: () => { if (this.permissionHandlers.get(sessionId) === h) this.permissionHandlers.delete(sessionId); } };
  }

  onElicitation(sessionId: string, h: ElicitationHandler): vscode.Disposable {
    this.elicitationHandlers.set(sessionId, h);
    return { dispose: () => { if (this.elicitationHandlers.get(sessionId) === h) this.elicitationHandlers.delete(sessionId); } };
  }

  async connection(): Promise<acp.ClientSideConnection> {
    if (!this.conn) {
      this.starting ??= this.start().finally(() => { this.starting = undefined; });
      await this.starting;
    }
    return this.conn!;
  }

  private async start(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('vibeBridge');
    const command = cfg.get<string>('command', 'vibe-acp');
    const args = cfg.get<string[]>('args', []);
    const env = { ...process.env, ...cfg.get<Record<string, string>>('env', {}) };

    this.log.info(`spawn ${command} ${args.join(' ')}`);
    const proc = spawn(command, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc = proc;
    // stdout est réservé au JSON-RPC ; Vibe journalise sur stderr.
    proc.stderr!.on('data', (b: Buffer) => this.log.debug(b.toString().trimEnd()));
    proc.on('exit', (code, sig) => {
      this.log.warn(vscode.l10n.t('vibe-acp exited (code={0}, signal={1})', code ?? 0, sig ?? ''));
      this.conn = undefined; this.init = undefined; this.proc = undefined;
    });
    proc.on('error', (e) => this.log.error(`Impossible de lancer ${command}: ${e.message}`));

    const stream = acp.ndJsonStream(
      Writable.toWeb(proc.stdin!) as WritableStream<Uint8Array>,
      Readable.toWeb(proc.stdout!) as unknown as ReadableStream<Uint8Array>,
    );
    this.conn = new acp.ClientSideConnection(() => this.client(), stream);

    this.init = await this.conn.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientInfo: { name: 'vibe-session-bridge', title: 'VS Code Session Target bridge', version: '0.1.0' },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        // Active les outils bash/git_bash/windows_shell de Vibe via le terminal client
        // (vibe/acp/agent.py::_client_descriptor → client_tools "terminal").
        terminal: vscode.workspace.getConfiguration('vibeBridge').get<boolean>('terminal.enabled', true),
        // Lu par vibe/acp/agent.py::_supports_user_input : active l'outil ask_user_question
        // (questions envoyées via elicitation/create, mode "form"). Mode "url" non annoncé.
        ...(vscode.workspace.getConfiguration('vibeBridge').get<boolean>('elicitation.enabled', true)
          ? { elicitation: { form: {} } } : {}),
        // Lu par vibe/acp/agent.py::initialize : active la méthode d'auth "vibe-setup"
        // (TerminalAuthMethod) en plus de "browser-auth".
        _meta: { 'terminal-auth': true },
      },
    });
    this.log.info(vscode.l10n.t('ACP initialized: agent={0}@{1}, protocol={2}, auth={3}',
      this.init.agentInfo?.name ?? '', this.init.agentInfo?.version ?? '',
      this.init.protocolVersion, this.authMethods.map(m => m.id).join(',')));
  }

  /** Implémentation côté client des requêtes envoyées par l'agent. */
  private client(): acp.Client {
    return {
      sessionUpdate: async (n) => { this.listeners.get(n.sessionId)?.(n.update); },

      requestPermission: async (req) => {
        const h = this.permissionHandlers.get(req.sessionId);
        return h ? h(req) : { outcome: { outcome: 'cancelled' } };
      },

      // fs/read_text_file : renvoie le contenu du buffer ouvert (y compris non sauvegardé).
      readTextFile: async ({ path, line, limit }) => {
        const uri = vscode.Uri.file(path);
        const open = vscode.workspace.textDocuments.find(d => d.uri.fsPath === uri.fsPath);
        const text = open ? open.getText() : new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        if (line == null && limit == null) return { content: text };
        const lines = text.split('\n');
        const start = Math.max(0, (line ?? 1) - 1);
        return { content: lines.slice(start, limit != null ? start + limit : undefined).join('\n') };
      },

      // fs/write_text_file : passe par WorkspaceEdit pour garder undo/redo et l'éditeur synchronisé.
      writeTextFile: async ({ path, content }) => {
        const uri = vscode.Uri.file(path);
        const edit = new vscode.WorkspaceEdit();
        const open = vscode.workspace.textDocuments.find(d => d.uri.fsPath === uri.fsPath);
        if (open) {
          edit.replace(uri, new vscode.Range(0, 0, open.lineCount, 0), content);
          await vscode.workspace.applyEdit(edit);
          await open.save();
        } else {
          await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
        }
        return {};
      },

      // elicitation/create : portée session (sessionId) ; la portée requête n'est pas utilisée par Vibe.
      createElicitation: async (req) => {
        const sessionId = (req as { sessionId?: string }).sessionId;
        const h = sessionId ? this.elicitationHandlers.get(sessionId) : undefined;
        return h ? h(req) : { action: 'cancel' };
      },

      createTerminal: async (req) => this.terminals.create(req),
      terminalOutput: async (req) => this.terminals.output(req),
      waitForTerminalExit: async (req) => this.terminals.waitForExit(req),
      killTerminal: async (req) => this.terminals.kill(req),
      releaseTerminal: async (req) => this.terminals.release(req),
    };
  }

  /** Crée une session ; gère `auth_required` en proposant les méthodes annoncées par Vibe. */
  async newSession(cwd: string): Promise<acp.NewSessionResponse> {
    const conn = await this.connection();
    try {
      return await conn.newSession({ cwd, mcpServers: [] });
    } catch (e) {
      if ((e as { code?: number }).code !== AUTH_REQUIRED) throw e;
      await this.signIn();
      return conn.newSession({ cwd, mcpServers: [] });
    }
  }

  /**
   * Authentification.
   * - "browser-auth" : connexion au compte Mistral (abonnement), gérée par Vibe (vibe/acp/auth.py).
   * - "vibe-setup"   : méthode terminal ; on exécute la commande fournie dans `_meta["terminal-auth"]`.
   */
  /** Extension Vibe `auth/status` (agent.py::ext_method) : { authenticated, authState, signOutAvailable }. */
  async authStatus(): Promise<{ authenticated?: boolean; authState?: string; signOutAvailable?: boolean } | undefined> {
    try { return await (await this.connection()).extMethod('_auth/status', {}) as never; } catch { return undefined; }
  }

  /** Extension Vibe `auth/signOut` (ACP `logout` n'est pas implémenté par Vibe). */
  async signOut(): Promise<void> {
    const st = await this.authStatus();
    if (st && st.signOutAvailable === false) {
      void vscode.window.showInformationMessage(vscode.l10n.t('Mistral Vibe: sign-out is not available (API key configured in ~/.vibe/.env or the environment).'));
      return;
    }
    await (await this.connection()).extMethod('_auth/signOut', {});
    await this.restart();
    void vscode.window.showInformationMessage(vscode.l10n.t('Mistral Vibe: signed out.'));
  }

  async signIn(): Promise<void> {
    const conn = await this.connection();
    const status = await this.authStatus();
    const methods = this.authMethods;
    if (status?.authenticated) {
      const switchAccount = vscode.l10n.t('Switch account');
      const again = await vscode.window.showInformationMessage(vscode.l10n.t('Mistral Vibe: already signed in ({0}).', status.authState ?? 'ok'), switchAccount);
      if (again !== switchAccount) return;
    }
    if (!methods.length) { void vscode.window.showInformationMessage(vscode.l10n.t('Mistral Vibe: no sign-in method offered by the agent.')); return; }
    const pick = methods.length === 1 ? methods[0] : (await vscode.window.showQuickPick(
      methods.map(m => ({ label: m.name, detail: m.description ?? undefined, m })),
      { title: vscode.l10n.t('Mistral Vibe sign-in') }))?.m;
    if (!pick) throw new Error(vscode.l10n.t('Sign-in cancelled'));

    const term = (pick as { _meta?: Record<string, any> })._meta?.['terminal-auth'];
    if (term?.command) {
      const t = vscode.window.createTerminal({ name: term.label ?? vscode.l10n.t('Mistral Vibe setup'), shellPath: term.command, shellArgs: term.args ?? [] });
      t.show();
      await new Promise<void>(res => {
        const d = vscode.window.onDidCloseTerminal(x => { if (x === t) { d.dispose(); res(); } });
      });
      await this.restart(); // relit ~/.vibe/.env
      return;
    }
    await conn.authenticate({ methodId: pick.id });
  }

  /** Arrêt propre : EOF sur stdin (fin du flux ACP), SIGTERM, puis SIGKILL si vibe-acp ne sort pas. */
  private stop(): void {
    const p = this.proc;
    if (!p || p.exitCode !== null) return;
    p.stdin?.end();
    p.kill('SIGTERM');
    const t = setTimeout(() => { if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL'); }, 2000);
    t.unref();
    p.once('exit', () => clearTimeout(t));
    p.stdout?.destroy(); p.stderr?.destroy();
  }

  async restart(): Promise<void> {
    this.terminals.dispose();
    this.stop();
    this.conn = undefined; this.init = undefined;
    await this.connection();
  }

  dispose(): void { this.terminals.dispose(); this.stop(); }
}
