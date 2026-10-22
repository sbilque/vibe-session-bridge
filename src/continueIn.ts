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
  { label: vscode.l10n.t('Local Chat (Copilot)'), description: vscode.l10n.t('new conversation, prompt pre-filled'), run: p => vscode.commands.executeCommand('workbench.action.chat.open', { query: p, isPartialQuery: true }) },
  { label: 'Copilot CLI', description: 'copilotcli', // identifiant de type, non traduit
   run: p => vscode.commands.executeCommand(`${NEW_SESSION_EDITOR}.copilotcli`, { prompt: p }) },
  { label: vscode.l10n.t('Copilot Cloud'), description: 'copilot-cloud-agent', run: p => vscode.commands.executeCommand(`${NEW_SESSION_EDITOR}.copilot-cloud-agent`, { prompt: p }) },
  { label: vscode.l10n.t('Claude (Agent Host)'), description: 'agent-host-claude', run: p => vscode.commands.executeCommand(DELEGATE_AGENT_HOST, { type: 'agent-host-claude', displayName: 'Claude', prompt: p }) },
  { label: vscode.l10n.t('Codex (Agent Host)'), description: 'agent-host-codex', run: p => vscode.commands.executeCommand(DELEGATE_AGENT_HOST, { type: 'agent-host-codex', displayName: 'Codex', prompt: p }) },
  { label: vscode.l10n.t('Copilot (Agent Host)'), description: 'agent-host-copilotcli', run: p => vscode.commands.executeCommand(DELEGATE_AGENT_HOST, { type: 'agent-host-copilotcli', displayName: 'Copilot', prompt: p }) },
];

export interface TurnSource {
  items(): Array<{ resource: vscode.Uri; label: string }>;
  turns(resource: vscode.Uri): Promise<Turn[]>;
}

/** Vibe → autre agent. `item` est fourni par le menu chat/chatSessions ; sinon choix dans la liste. */
export async function continueIn(src: TurnSource, item?: { resource: vscode.Uri; label: string }): Promise<void> {
  if (!item) {
    const pick = await vscode.window.showQuickPick(src.items().map(i => ({ label: i.label, i })), { title: vscode.l10n.t('Mistral Vibe session to continue') });
    if (!pick) return;
    item = pick.i;
  }
  const target = await vscode.window.showQuickPick(TARGETS, { title: vscode.l10n.t('Continue "{0}" in…', item.label) });
  if (!target) return;
  const instruction = await vscode.window.showInputBox({ title: vscode.l10n.t('Instruction for the continuation'), value: 'implement this.' }); // valeur par défaut de VS Code
  if (instruction === undefined) return;
  const prompt = delegationPrompt('Mistral Vibe', buildTranscript(await src.turns(item.resource)), instruction);
  try {
    await target.run(prompt);
  } catch (e) {
    void vscode.window.showErrorMessage(vscode.l10n.t('{0} is not available in this version of VS Code: {1}', target.label, (e as Error).message));
  }
}

/** Autre contexte → Vibe : nouvelle session Mistral Vibe avec la sélection ou le fichier actif. */
export async function continueInVibe(): Promise<void> {
  const ed = vscode.window.activeTextEditor;
  const instruction = await vscode.window.showInputBox({ title: vscode.l10n.t('Mistral Vibe: instruction'), value: 'implement this.' });
  if (instruction === undefined) return;
  let prompt = instruction;
  if (ed) {
    const sel = ed.selection;
    const rel = vscode.workspace.asRelativePath(ed.document.uri);
    prompt = sel.isEmpty
      ? `${instruction}\n\n${vscode.l10n.t('File: {0}', rel)}`
      : `${instruction}\n\n${vscode.l10n.t('Selection ({0}, lines {1}-{2}):', rel, sel.start.line + 1, sel.end.line + 1)}\n\`\`\`${ed.document.languageId}\n${ed.document.getText(sel)}\n\`\`\``;
  }
  // Commande générée par VS Code pour chaque type contribué (chatSessions.contribution.ts).
  await vscode.commands.executeCommand(`${NEW_SESSION_EDITOR}.${SCHEME}`, { prompt });
}
