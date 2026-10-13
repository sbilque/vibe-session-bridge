// Équivalent « Continue In » pour Mistral Vibe.
//
// Le menu natif « Continue Chat in… » de VS Code ne propose que copilotcli, copilot-cloud-agent et les types
// Agent Host (getAgentCanContinueIn / isAgentHostTarget, agentSessions.ts) : un type tiers n'y figure jamais.
// On reproduit donc son comportement avec les commandes publiques qu'il utilise lui-même
// (chatContinueInAction.ts) :
//   - cibles Agent Host  : workbench.action.chat.delegateToAgentHostSession { type, displayName, prompt }
//   - autres cibles      : workbench.action.chat.openNewSessionEditor.<type> { prompt }
//   - chat local         : workbench.action.chat.open { query }
// La transcription est inlinée dans le prompt (format chat.delegation.inlinePrompt), comme VS Code le fait
// pour les cibles qui ne lisent pas les pièces jointes « paste ».
import * as vscode from 'vscode';
import { buildTranscript, delegationPrompt, type Turn } from './prompt';
import { SCHEME } from './sessions';

interface Target { label: string; description: string; run: (prompt: string) => Thenable<unknown> }

const DELEGATE_AGENT_HOST = 'workbench.action.chat.delegateToAgentHostSession';
const NEW_SESSION_EDITOR = 'workbench.action.chat.openNewSessionEditor';

// Identifiants de SessionType (src/vs/workbench/contrib/chat/common/chatSessionsService.ts).
const TARGETS: Target[] = [
  { label: 'Chat local (Copilot)', description: 'nouvelle conversation, prompt pré-rempli', run: p => vscode.commands.executeCommand('workbench.action.chat.open', { query: p, isPartialQuery: true }) },
  { label: 'Copilot CLI', description: 'copilotcli', run: p => vscode.commands.executeCommand(`${NEW_SESSION_EDITOR}.copilotcli`, { prompt: p }) },
  { label: 'Copilot Cloud', description: 'copilot-cloud-agent', run: p => vscode.commands.executeCommand(`${NEW_SESSION_EDITOR}.copilot-cloud-agent`, { prompt: p }) },
  { label: 'Claude (Agent Host)', description: 'agent-host-claude', run: p => vscode.commands.executeCommand(DELEGATE_AGENT_HOST, { type: 'agent-host-claude', displayName: 'Claude', prompt: p }) },
  { label: 'Codex (Agent Host)', description: 'agent-host-codex', run: p => vscode.commands.executeCommand(DELEGATE_AGENT_HOST, { type: 'agent-host-codex', displayName: 'Codex', prompt: p }) },
  { label: 'Copilot (Agent Host)', description: 'agent-host-copilotcli', run: p => vscode.commands.executeCommand(DELEGATE_AGENT_HOST, { type: 'agent-host-copilotcli', displayName: 'Copilot', prompt: p }) },
];

export interface TurnSource {
  items(): Array<{ resource: vscode.Uri; label: string }>;
  turns(resource: vscode.Uri): Promise<Turn[]>;
}

/** Vibe → autre agent. `item` est fourni par le menu chat/chatSessions ; sinon choix dans la liste. */
export async function continueIn(src: TurnSource, item?: { resource: vscode.Uri; label: string }): Promise<void> {
  if (!item) {
    const pick = await vscode.window.showQuickPick(src.items().map(i => ({ label: i.label, i })), { title: 'Session Mistral Vibe à poursuivre' });
    if (!pick) return;
    item = pick.i;
  }
  const target = await vscode.window.showQuickPick(TARGETS, { title: `Continuer « ${item.label} » dans…` });
  if (!target) return;
  const instruction = await vscode.window.showInputBox({ title: 'Instruction pour la suite', value: 'implement this.' }); // valeur par défaut de VS Code
  if (instruction === undefined) return;
  const prompt = delegationPrompt('Mistral Vibe', buildTranscript(await src.turns(item.resource)), instruction);
  try {
    await target.run(prompt);
  } catch (e) {
    void vscode.window.showErrorMessage(`${target.label} indisponible dans cette version de VS Code : ${(e as Error).message}`);
  }
}

/** Autre contexte → Vibe : nouvelle session Mistral Vibe avec la sélection ou le fichier actif. */
export async function continueInVibe(): Promise<void> {
  const ed = vscode.window.activeTextEditor;
  const instruction = await vscode.window.showInputBox({ title: 'Mistral Vibe : instruction', value: 'implement this.' });
  if (instruction === undefined) return;
  let prompt = instruction;
  if (ed) {
    const sel = ed.selection;
    const rel = vscode.workspace.asRelativePath(ed.document.uri);
    prompt = sel.isEmpty
      ? `${instruction}\n\nFichier : ${rel}`
      : `${instruction}\n\nSélection (${rel}, lignes ${sel.start.line + 1}-${sel.end.line + 1}) :\n\`\`\`${ed.document.languageId}\n${ed.document.getText(sel)}\n\`\`\``;
  }
  // Commande générée par VS Code pour chaque type contribué (chatSessions.contribution.ts).
  await vscode.commands.executeCommand(`${NEW_SESSION_EDITOR}.${SCHEME}`, { prompt });
}
