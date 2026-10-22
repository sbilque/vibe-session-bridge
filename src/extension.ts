import * as vscode from 'vscode';
import { VibeAcpAgent } from './acpAgent';
import { VibeSessions } from './sessions';
import { continueIn, continueInVibe } from './continueIn';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const log = vscode.window.createOutputChannel('Mistral Vibe ACP', { log: true });
  const agent = new VibeAcpAgent(log);
  context.subscriptions.push(log, agent);

  try {
    await agent.connection(); // initialize : nécessaire pour connaître les capacités (list/fork/load)
  } catch (e) {
    log.error(vscode.l10n.t('Failed to start vibe-acp: {0}', (e as Error).message));
    void vscode.window.showErrorMessage(vscode.l10n.t('Mistral Vibe: vibe-acp not found. Install mistral-vibe or set vibeBridge.command.'));
  }
  const sessions = new VibeSessions(agent, log);
  context.subscriptions.push(
    sessions,
    vscode.commands.registerCommand('vibeBridge.continueIn', (item?: vscode.ChatSessionItem) => continueIn(sessions, item)),
    vscode.commands.registerCommand('vibeBridge.continueInVibe', () => continueInVibe()),
    vscode.commands.registerCommand('vibeBridge.sessions.rename', (item?: vscode.ChatSessionItem) => sessions.rename(item)),
    vscode.commands.registerCommand('vibeBridge.sessions.delete', (item?: vscode.ChatSessionItem) => sessions.remove(item)),
    vscode.commands.registerCommand('vibeBridge.signOut', () => agent.signOut()),
    vscode.commands.registerCommand('vibeBridge.signIn', () => agent.signIn()),
    vscode.commands.registerCommand('vibeBridge.restart', () => agent.restart()),
    vscode.commands.registerCommand('vibeBridge.showLog', () => log.show()),
  );
}

export function deactivate(): void {}
