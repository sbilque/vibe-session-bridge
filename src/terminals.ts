// Terminal client ACP : terminal/create, terminal/output, terminal/wait_for_exit,
// terminal/kill, terminal/release (schéma @agentclientprotocol/sdk 1.8.0).
//
// Usage réel par Vibe (vibe/app_server/_tool_io.py::run_shell) :
//   create(command=<ligne shell complète>, args=None, cwd, output_byte_limit)
//   → wait_for_exit (avec timeout côté agent, kill en cas de dépassement)
//   → output → release (toujours, dans un finally)
// La commande est donc une ligne shell : sans `args`, on l'exécute via le shell
// par défaut de l'utilisateur (vscode.env.shell), comme le fait Zed.
import { spawn, ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import type * as acp from '@agentclientprotocol/sdk';

interface ManagedTerminal {
  id: string;
  sessionId: string;
  commandLine: string;
  proc: ChildProcess;
  chunks: Buffer[];
  bytes: number;
  limit: number | undefined;
  truncated: boolean;
  exit: acp.TerminalExitStatus | undefined;
  exited: Promise<acp.TerminalExitStatus>;
  startedAt: number;
  endedAt?: number;
  released?: boolean;
  pty?: vscode.EventEmitter<string>;
  ui?: vscode.Terminal;
}

export class AcpTerminalManager implements vscode.Disposable {
  private readonly terms = new Map<string, ManagedTerminal>();

  constructor(private readonly log: vscode.LogOutputChannel) {}

  create(req: acp.CreateTerminalRequest): acp.CreateTerminalResponse {
    const id = `term_${randomUUID()}`;
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const v of req.env ?? []) env[v.name] = v.value;
    const cwd = req.cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    const hasArgs = (req.args?.length ?? 0) > 0;
    const commandLine = hasArgs ? [req.command, ...req.args!].join(' ') : req.command;

    // Avec args : exécution directe (sémantique ACP). Sans args : ligne shell.
    const proc = hasArgs
      ? spawn(req.command, req.args!, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' })
      : spawn(req.command, { cwd, env, shell: vscode.env.shell || true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });

    const t: ManagedTerminal = {
      id, sessionId: req.sessionId, commandLine, proc,
      chunks: [], bytes: 0, limit: req.outputByteLimit ?? undefined, truncated: false,
      exit: undefined, exited: undefined as never, startedAt: Date.now(),
    };
    t.exited = new Promise(resolve => {
      proc.on('error', (e) => {
        this.append(t, Buffer.from(`${e.message}\n`));
        t.exit ??= { exitCode: 127, signal: null };
        t.endedAt = Date.now();
        resolve(t.exit);
      });
      proc.on('close', (code, signal) => {
        t.exit ??= { exitCode: code, signal: signal ?? null };
        t.endedAt = Date.now();
        t.pty?.fire(`\r\n\x1b[2m${vscode.l10n.t('[done: {0}]', signal ?? vscode.l10n.t('code {0}', code ?? 0))}\x1b[0m\r\n`);
        resolve(t.exit);
      });
    });
    proc.stdout!.on('data', (b: Buffer) => this.append(t, b));
    proc.stderr!.on('data', (b: Buffer) => this.append(t, b));
    this.terms.set(id, t);
    this.log.info(`terminal/create ${id} cwd=${cwd} : ${commandLine}`);

    if (vscode.workspace.getConfiguration('vibeBridge').get<string>('terminal.reveal', 'onCreate') === 'onCreate') {
      this.reveal(id, true);
    }
    return { terminalId: id };
  }

  /** Sortie conservée en tenant compte de outputByteLimit : on tronque par le début, sur une frontière de caractère. */
  private append(t: ManagedTerminal, b: Buffer): void {
    t.pty?.fire(b.toString('utf8').replace(/\r?\n/g, '\r\n'));
    t.chunks.push(b);
    t.bytes += b.length;
    if (t.limit == null || t.bytes <= t.limit) return;
    let all = Buffer.concat(t.chunks);
    let start = all.length - t.limit;
    while (start < all.length && (all[start] & 0xc0) === 0x80) start++; // pas de coupure au milieu d'un caractère UTF-8
    all = all.subarray(start);
    t.chunks = [all];
    t.bytes = all.length;
    t.truncated = true;
  }

  private get(sessionId: string, terminalId: string): ManagedTerminal {
    const t = this.terms.get(terminalId);
    if (!t || t.released || t.sessionId !== sessionId) {
      throw Object.assign(new Error(`Terminal inconnu : ${terminalId}`), { code: -32602 });
    }
    return t;
  }

  output({ sessionId, terminalId }: acp.TerminalOutputRequest): acp.TerminalOutputResponse {
    const t = this.get(sessionId, terminalId);
    return { output: Buffer.concat(t.chunks).toString('utf8'), truncated: t.truncated, exitStatus: t.exit ?? null };
  }

  async waitForExit({ sessionId, terminalId }: acp.WaitForTerminalExitRequest): Promise<acp.WaitForTerminalExitResponse> {
    const s = await this.get(sessionId, terminalId).exited;
    return { exitCode: s.exitCode ?? null, signal: s.signal ?? null };
  }

  /** terminal/kill : arrête le processus, le terminal reste valide (output/wait restent possibles). */
  kill({ sessionId, terminalId }: acp.KillTerminalRequest): acp.KillTerminalResponse {
    this.killProc(this.get(sessionId, terminalId));
    return {};
  }

  /** terminal/release : arrête si besoin et libère ; l'identifiant devient invalide. */
  release({ sessionId, terminalId }: acp.ReleaseTerminalRequest): acp.ReleaseTerminalResponse {
    const t = this.get(sessionId, terminalId);
    this.killProc(t);
    // Identifiant invalide pour l'agent, mais sortie conservée pour l'affichage dans le Chat
    // (Vibe libère le terminal avant d'envoyer le tool_call_update final).
    t.released = true;
    this.prune();
    return {};
  }

  private prune(max = 50): void {
    const released = [...this.terms.values()].filter(t => t.released);
    for (const t of released.slice(0, Math.max(0, released.length - max))) this.terms.delete(t.id);
  }

  private killProc(t: ManagedTerminal): void {
    if (t.exit || t.proc.pid == null) return;
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(t.proc.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        process.kill(-t.proc.pid, 'SIGTERM'); // groupe de processus (detached) : tue aussi les enfants du shell
        setTimeout(() => { if (!t.exit) try { process.kill(-t.proc.pid!, 'SIGKILL'); } catch { /* déjà terminé */ } }, 2000);
      }
    } catch (e) {
      this.log.warn(`kill ${t.id} : ${(e as Error).message}`);
    }
  }

  /** Code de sortie du dernier terminal de la session ayant exécuté exactement `commandLine`. */
  lastExitCode(sessionId: string, commandLine: string): number | undefined {
    const match = [...this.terms.values()].filter(t => t.sessionId === sessionId && t.commandLine === commandLine && t.exit);
    return match.at(-1)?.exit?.exitCode ?? undefined;
  }

  /** Infos pour l'affichage dans le Chat (ChatTerminalToolInvocationData). */
  describe(terminalId: string): { commandLine: string; output: string; exitCode?: number; duration?: number } | undefined {
    const t = this.terms.get(terminalId);
    if (!t) return undefined;
    return {
      commandLine: t.commandLine,
      output: Buffer.concat(t.chunks).toString('utf8'),
      exitCode: t.exit?.exitCode ?? undefined,
      duration: t.endedAt ? t.endedAt - t.startedAt : undefined,
    };
  }

  /** Miroir lecture seule dans le panneau Terminal (Pseudoterminal) ; Ctrl+C envoie terminal/kill localement. */
  reveal(terminalId: string, preserveFocus = false): void {
    const t = this.terms.get(terminalId);
    if (!t) return;
    if (!t.ui) {
      const write = new vscode.EventEmitter<string>();
      const pty: vscode.Pseudoterminal = {
        onDidWrite: write.event,
        open: () => {
          write.fire(`\x1b[1m$ ${t.commandLine}\x1b[0m\r\n`);
          write.fire(Buffer.concat(t.chunks).toString('utf8').replace(/\r?\n/g, '\r\n'));
          if (t.exit) write.fire(`\r\n\x1b[2m${vscode.l10n.t('[done: {0}]', t.exit.signal ?? vscode.l10n.t('code {0}', t.exit.exitCode ?? 0))}\x1b[0m\r\n`);
          t.pty = write; // flux direct seulement après le rejeu : pas de doublon
        },
        close: () => { t.pty = undefined; t.ui = undefined; },
        handleInput: (data) => { if (data === '\x03') this.killProc(t); },
      };
      t.ui = vscode.window.createTerminal({ name: `Vibe: ${t.commandLine.slice(0, 40)}`, pty, iconPath: new vscode.ThemeIcon('sparkle') });
    }
    t.ui.show(preserveFocus);
  }

  /** Annulation d'un tour (session/cancel) : arrête les processus de la session. */
  killSession(sessionId: string): void {
    for (const t of this.terms.values()) if (t.sessionId === sessionId) this.killProc(t);
  }

  dispose(): void {
    for (const t of this.terms.values()) { this.killProc(t); t.ui?.dispose(); }
    this.terms.clear();
  }
}
