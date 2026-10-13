// Tests d'intégration : vrai processus vibe-acp, vraie boucle d'agent et vrais outils Vibe,
// vrai code du pont (src/acpAgent.ts, src/sessions.ts, src/terminals.ts, src/elicitation.ts).
// Seul VS Code est simulé (vscode-host.ts) et, par défaut, le modèle (mock-llm.ts).
//
//   npm run test:integration                 # modèle simulé (déterministe, sans clé)
//   VIBE_IT_MISTRAL=1 npm run test:integration   # API Mistral réelle (~/.vibe, clé/abonnement requis)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import * as vscode from 'vscode';
import { host, ChatRequestTurn, ChatResponseTurn, ChatResponseMarkdownPart, Location, Range, Uri, RecordingStream, CancellationTokenSource, ChatToolInvocationPart, ChatRequestTurn2, ChatResponseTurn2, type ChatSessionItem, type ChatQuestion } from './vscode-host';
import { MockLlm, textOf } from './mock-llm';
import { continueIn } from '../../src/continueIn';
import { VibeAcpAgent } from '../../src/acpAgent';
import { VibeSessions, SCHEME } from '../../src/sessions';

const REAL = process.env.VIBE_IT_MISTRAL === '1';
// Vibe 2.26 : « Unified Harness » par défaut (shell exécuté dans Vibe) ; `--legacy-harness`
// réactive l'ancien moteur, qui délègue le shell au terminal ACP du client.
const HARNESS = process.env.IT_HARNESS === 'legacy' ? 'legacy' : 'unified';
const LEGACY = HARNESS === 'legacy';
const TIMEOUT = REAL ? 180_000 : 60_000;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-it-'));
const workspaceDir = path.join(tmp, 'ws');
const llm = new MockLlm();
let agent: VibeAcpAgent;
let sessions: VibeSessions;

const controller = () => host.controllers.at(-1)!;
const participant = () => host.participants.get(SCHEME)!;

async function newItem(prompt: string): Promise<ChatSessionItem> {
  return controller().newChatSessionItemHandler!({ request: { prompt } }, undefined);
}

/** Simule un tour de chat : ce que fait VS Code quand l'utilisateur envoie un message. */
async function send(item: ChatSessionItem, prompt: string, opts: { mode?: string; cancelAfterMs?: number; references?: any[]; command?: string; history?: any[] } = {}) {
  const input = await controller().getChatSessionInputState!(item.resource, {}, undefined);
  if (opts.mode) {
    const g = input.groups.find((x: any) => x.id === 'mode');
    g.selected = g.items.find((i: any) => i.id === opts.mode);
    assert.ok(g.selected, `mode ${opts.mode} proposé par Vibe`);
  }
  const stream = new RecordingStream();
  const cts = new CancellationTokenSource();
  if (opts.cancelAfterMs) setTimeout(() => cts.cancel(), opts.cancelAfterMs);
  const req = { prompt, references: opts.references ?? [], toolInvocationToken: undefined, command: opts.command };
  const ctx = { history: opts.history ?? [], chatSessionContext: { chatSessionItem: item, isUntitled: false, inputState: input } };
  const t0 = Date.now();
  const result = await participant().handler(req, ctx, stream, cts.token);
  return { stream, result, ms: Date.now() - t0 };
}

/** Choisit l'option d'un carousel de permission selon son libellé (libellés fournis par Vibe). */
const pick = (re: RegExp) => (qs: ChatQuestion[]) => {
  const q = qs[0];
  const o = q.options!.find(x => re.test(x.label)) ?? q.options![0];
  return { [q.id]: { selectedValue: o.value } };
};

before(async () => {
  fs.mkdirSync(workspaceDir, { recursive: true });
  host.workspaceDir = workspaceDir;
  if (!REAL) {
    // Configuration calquée sur tests/e2e/common.py::write_e2e_config de mistral-vibe.
    const vibeHome = path.join(tmp, 'vibe-home');
    fs.mkdirSync(vibeHome, { recursive: true });
    const apiBase = await llm.start();
    fs.writeFileSync(path.join(vibeHome, 'config.toml'), [
      'active_model = "mock-model"', 'enable_update_checks = false', 'enable_telemetry = false', '',
      '[[providers]]', 'name = "mock-provider"', `api_base = "${apiBase}"`, 'api_key_env_var = "MISTRAL_API_KEY"', 'backend = "generic"', '',
      '[[models]]', 'name = "mock-model"', 'provider = "mock-provider"', 'alias = "mock-model"', 'supports_images = true',
    ].join('\n'));
    host.config['vibeBridge.env'] = { VIBE_HOME: vibeHome, MISTRAL_API_KEY: 'mock' };
  }
  host.config['vibeBridge.terminal.reveal'] = 'onCreate';
  if (LEGACY) host.config['vibeBridge.args'] = ['--legacy-harness'];
  console.log(`    harness Vibe : ${HARNESS}${REAL ? ' (API Mistral réelle)' : ' (modèle simulé)'}`);
  agent = new VibeAcpAgent(vscode.window.createOutputChannel('it', { log: true }) as any);
  await agent.connection();
  sessions = new VibeSessions(agent, vscode.window.createOutputChannel('it', { log: true }) as any);
});

after(() => {
  sessions?.dispose(); agent?.dispose(); llm.stop();
  // Vibe crée des fichiers en lecture seule (cache de plugins) : on rend l'arborescence modifiable avant suppression.
  try { require('node:child_process').execSync(`chmod -R u+w ${JSON.stringify(tmp)} && rm -rf ${JSON.stringify(tmp)}`); } catch { /* best effort */ }
});

test('initialize : capacités annoncées par Vibe', () => {
  const c = agent.capabilities!;
  assert.equal(c.loadSession, true);
  for (const k of ['list', 'fork', 'close'] as const) assert.ok(c.sessionCapabilities?.[k] != null, k);
  // browser-auth n'est proposée que sans clé configurée (constaté : absente avec MISTRAL_API_KEY).
  const ids = agent.authMethods.map(m => m.id);
  assert.ok(ids.includes('vibe-setup'), 'méthode terminal annoncée grâce à _meta.terminal-auth');
  assert.ok(ids.every(id => ['browser-auth', 'browser-auth-delegated', 'vibe-setup'].includes(id)), ids.join(','));
});

test('sélecteur d\'options d\'une nouvelle session (session pré-créée)', { timeout: TIMEOUT }, async () => {
  const input = await controller().getChatSessionInputState!(undefined, {}, undefined);
  const ids = input.groups.map((g: any) => g.id);
  for (const id of ['mode', 'model', 'thinking']) assert.ok(ids.includes(id), `groupe ${id}`);
  const mode = input.groups.find((g: any) => g.id === 'mode');
  // Constaté avec 2.26.1 : unified → ask, accept-edits, auto-approve ; legacy → + plan.
  const modes = mode.items.map((i: any) => i.id);
  for (const m of ['ask', 'accept-edits', 'auto-approve']) assert.ok(modes.includes(m), `mode ${m}`);
  console.log(`    modes ${HARNESS} :`, modes.join(', '));
});

let mainItem: ChatSessionItem;

test('tour texte : réponse diffusée en markdown', { timeout: TIMEOUT }, async () => {
  mainItem = await newItem('Dis bonjour');
  const { stream, result } = await send(mainItem, REAL ? 'Réponds exactement : Bonjour depuis Mistral.' : 'Dis bonjour [texte]');
  assert.equal((result as any).metadata?.stopReason, 'end_turn');
  assert.match(stream.text(), REAL ? /Bonjour/i : /Bonjour depuis le modèle simulé/);
});

test(`bash avec permission acceptée (${LEGACY ? 'terminal ACP côté VS Code' : 'shell exécuté par Vibe'})`, { timeout: TIMEOUT }, async () => {
  host.carousels.length = 0; host.terminals.length = 0;
  host.answerCarousel = pick(/allow|autoris|once|une fois|yes|oui/i);
  const cmd = 'echo vibe-it-$((6*7))';
  const prompt = REAL ? `Exécute exactement cette commande shell avec l'outil bash puis donne sa sortie : ${cmd}` : `[bash:${cmd}]`;
  const { stream } = await send(mainItem, prompt, { mode: 'ask' });

  assert.ok(host.carousels.length >= 1, 'une demande de permission affichée');
  const q = host.carousels[0][0];
  console.log('    options de permission Vibe :', q.options!.map(o => o.label).join(' | '));
  assert.match(String(q.message ?? q.title), /echo vibe-it/, 'la commande est montrée à l\'utilisateur');

  const shell = stream.tools().find(t => t.toolSpecificData?.commandLine);
  assert.ok(shell, 'appel d\'outil shell affiché');
  assert.match(shell!.toolSpecificData.commandLine.original, /echo vibe-it/);
  assert.equal(shell!.isComplete, true);
  assert.equal(shell!.isConfirmed, true);
  assert.match(shell!.toolSpecificData.output.text, /vibe-it-42/);
  if (LEGACY) {
    assert.ok(host.terminals.some(t => /vibe-it-42/.test(t.written)), 'commande exécutée dans un terminal VS Code (terminal/create)');
  } else {
    assert.equal(host.terminals.length, 0, 'unified harness : aucun terminal/create');
  }
  if (LEGACY) assert.equal(shell!.toolSpecificData.state.exitCode, 0, 'code issu du terminal client');
  else assert.equal(shell!.toolSpecificData.state.exitCode, undefined, 'unified : Vibe n\'expose pas le code de sortie en ACP');
  if (!REAL) {
    assert.ok(llm.toolResults().some(r => r.includes('vibe-it-42')), 'le résultat revient au modèle');
    assert.match(stream.text(), /Résultat reçu/);
  }
});

test('bash avec permission refusée : commande non exécutée', { timeout: TIMEOUT, skip: REAL && 'scénario déterministe uniquement' }, async () => {
  host.carousels.length = 0;
  host.answerCarousel = pick(/reject|refus|deny|no|non/i);
  const flag = path.join(workspaceDir, 'rejected.flag');
  const { stream } = await send(mainItem, `[bash:touch ${flag}]`, { mode: 'ask' });
  assert.ok(host.carousels.length >= 1);
  assert.equal(fs.existsSync(flag), false, 'fichier non créé');
  const shell = stream.tools().find(t => t.toolSpecificData?.commandLine?.original.includes('rejected.flag'));
  assert.ok(shell);
  assert.equal(shell!.isConfirmed, false);
});

test('mode auto-approve appliqué au moment de la requête : pas de permission', { timeout: TIMEOUT, skip: REAL && 'scénario déterministe uniquement' }, async () => {
  host.carousels.length = 0;
  const flag = path.join(workspaceDir, 'auto.flag');
  await send(mainItem, `[bash:touch ${flag}]`, { mode: 'auto-approve' });
  assert.equal(host.carousels.length, 0);
  assert.equal(fs.existsSync(flag), true);
});

test('question utilisateur (ask_user_question → elicitation/create → questionCarousel)', { timeout: TIMEOUT, skip: REAL && 'scénario déterministe uniquement' }, async () => {
  host.carousels.length = 0;
  host.answerCarousel = (qs) => {
    if (qs[0].id === 'permission') return pick(/allow|autoris|once|yes|oui/i)(qs);
    return { q0: { selectedValue: 'pytest' }, q1: { selectedValues: ['linux'], freeformValue: 'freebsd' } };
  };
  const { stream } = await send(mainItem, '[question]', { mode: 'auto-approve' });
  const carousel = host.carousels.find(qs => qs[0].id === 'q0');
  assert.ok(carousel, 'questionCarousel affiché');
  assert.deepEqual(carousel!.map(q => q.title), ['Tests', 'OS']);
  assert.deepEqual(carousel![1].options!.map(o => o.label), ['linux', 'macos', 'windows']);
  const result = llm.toolResults().at(-1)!;
  assert.match(result, /pytest/);
  assert.match(result, /linux, freebsd/);
  assert.match(stream.text(), /Résultat reçu/);
});

test('annulation : session/cancel + arrêt du terminal', { timeout: TIMEOUT, skip: REAL && 'scénario déterministe uniquement' }, async () => {
  const { result, ms } = await send(mainItem, '[bash:sleep 30]', { mode: 'auto-approve', cancelAfterMs: 2000 });
  assert.equal((result as any).metadata?.stopReason, 'cancelled');
  assert.ok(ms < 15_000, `tour terminé en ${ms} ms`);
});

const D = { timeout: TIMEOUT, skip: REAL && 'scénario déterministe uniquement' };
const lastUserText = () => textOf(llm.lastUserMessage()?.content);

test('commande slash : request.command → « /help » exécuté par Vibe (sans appel au modèle)', D, async () => {
  const item = await newItem('aide');
  const before = llm.requests.length;
  const { stream } = await send(item, '', { command: 'help' });
  assert.match(stream.text(), /\/compact/);
  assert.equal(llm.requests.filter(r => r.tools?.length).length, llm.requests.filter(r => r.tools?.length).length);
  assert.ok(llm.requests.length - before <= 1);
});

test('références : texte collé et sélection (Location) transmis au modèle en contenu intégré', D, async () => {
  const f = path.join(workspaceDir, 'sel.py');
  fs.writeFileSync(f, 'a = 1\nSELECTION_MARQUEUR = 42\nb = 2\n');
  const item = await newItem('refs');
  await send(item, 'Analyse [echo]', { references: [
    { id: 'paste-1', value: 'COLLE_MARQUEUR texte collé' },
    { id: 'sel', value: new Location(Uri.file(f), new Range(1, 0, 1, 23)) },
  ] });
  const t = lastUserText();
  assert.match(t, /COLLE_MARQUEUR/);
  assert.match(t, /SELECTION_MARQUEUR = 42/);
  assert.doesNotMatch(t, /b = 2/, 'seule la plage sélectionnée est intégrée');
});

test('référence image (ChatReferenceBinaryData) → ContentBlock image', D, async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const item = await newItem('image');
  await send(item, 'Décris [echo]', { references: [{ id: 'img', value: { mimeType: 'image/png', data: async () => new Uint8Array(png) } }] });
  const c = llm.lastUserMessage()?.content;
  const hasImage = Array.isArray(c) && c.some((p: any) => p.type === 'image_url');
  console.log(`    image transmise au modèle par Vibe : ${hasImage}`);
  assert.ok(hasImage || /image/i.test(textOf(c)), 'image reçue par Vibe');
});

test('délégation entrante : ChatContext.history injecté au premier tour', D, async () => {
  const item = await newItem('deleg');
  const history = [new ChatRequestTurn('HIST_Q comment corriger le bug ?'), new ChatResponseTurn([new ChatResponseMarkdownPart('HIST_R modifier parse()')])];
  await send(item, 'Continue [echo]', { history });
  const t = lastUserText();
  assert.match(t, /previous VS Code Chat session/);
  assert.match(t, /User: HIST_Q[\s\S]*Assistant: HIST_R/);
  // Deuxième tour : plus d'injection.
  await send(item, 'Suite [echo]', { history });
  assert.doesNotMatch(lastUserText(), /previous VS Code Chat session/);
});

test('Continuer dans… : transcription au format VS Code vers Claude (Agent Host)', D, async () => {
  host.executed.length = 0;
  host.quickPick = (items: any[]) => items.find(i => /Claude/.test(i.label));
  host.inputBox = () => 'termine la tâche';
  await continueIn(sessions, { resource: mainItem.resource, label: mainItem.label });
  host.quickPick = (items: any[]) => items[0];
  host.inputBox = (o: any) => o.value;
  const call = host.executed.at(-1)!;
  assert.equal(call.id, 'workbench.action.chat.delegateToAgentHostSession');
  const a = call.args[0] as any;
  assert.equal(a.type, 'agent-host-claude');
  assert.match(a.prompt, /previous Mistral Vibe session[\s\S]*User: Dis bonjour[\s\S]*Assistant: [\s\S]*User: termine la tâche$/);
});

test('fichiers modifiés (diff) → ChatSessionItem.changes ; usage → badge', D, async () => {
  const item = await newItem('write');
  const target = path.join(workspaceDir, 'nouveau.txt');
  const { stream } = await send(item, `Écris [write:${target}]`, { mode: 'auto-approve' });
  if (!fs.existsSync(target)) console.log('    DEBUG', stream.text().slice(0, 800), JSON.stringify(stream.parts.map((p: any) => p.constructor.name)));
  assert.ok(fs.existsSync(target), 'fichier écrit');
  const it = controller().items.get(item.resource)!;
  console.log('    changes :', JSON.stringify(it.changes?.map(c => [path.basename(c.uri.fsPath), c.insertions, c.deletions])), '| badge :', it.badge);
  assert.ok(it.changes?.some(c => c.uri.fsPath === target && c.insertions === 3 && c.deletions === 0), 'changes : +3 -0');
  assert.ok(it.timing?.lastRequestEnded, 'timing.lastRequestEnded');
  void stream;
});

test('renommer puis supprimer (méthodes d\'extension session/set_title, session/delete)', D, async () => {
  const item = await newItem('à renommer');
  await send(item, 'x [texte]');
  host.inputBox = () => 'Titre renommé';
  await sessions.rename(controller().items.get(item.resource) as any);
  host.inputBox = (o: any) => o.value;
  await controller().refreshHandler(undefined);
  assert.equal(controller().items.get(item.resource)?.label, 'Titre renommé');
  await sessions.remove(controller().items.get(item.resource) as any);
  await controller().refreshHandler(undefined);
  assert.ok(!controller().items.get(item.resource), 'session supprimée côté Vibe');
});

test('fork d\'une session ayant des échanges', { timeout: TIMEOUT }, async () => {
  const fork = await controller().forkHandler!(mainItem.resource, undefined, undefined);
  assert.notEqual(fork.resource.toString(), mainItem.resource.toString());
});

test('liste puis rechargement dans un nouveau processus vibe-acp (session/load)', { timeout: TIMEOUT }, async () => {
  await controller().refreshHandler(undefined);
  const listed = controller().items.all().map(i => i.resource.toString());
  assert.ok(listed.includes(mainItem.resource.toString()), 'session listée par session/list');

  sessions.dispose(); agent.dispose();
  agent = new VibeAcpAgent(vscode.window.createOutputChannel('it2', { log: true }) as any);
  await agent.connection();
  sessions = new VibeSessions(agent, vscode.window.createOutputChannel('it2', { log: true }) as any);

  const provider = host.contentProviders.get(SCHEME)!;
  const content = await provider.provideChatSessionContent(mainItem.resource, new CancellationTokenSource().token);
  const reqs = content.history.filter((h: unknown) => h instanceof ChatRequestTurn2) as ChatRequestTurn2[];
  const resps = content.history.filter((h: unknown) => h instanceof ChatResponseTurn2) as ChatResponseTurn2[];
  assert.ok(reqs.length >= 2, `${reqs.length} requêtes rejouées`);
  assert.ok(resps.length >= 2, `${resps.length} réponses rejouées`);
  assert.match(reqs[0].prompt, REAL ? /Bonjour/ : /\[texte\]/);
  if (!REAL) {
    const toolParts = resps.flatMap(r => r.response).filter(p => p instanceof ChatToolInvocationPart) as ChatToolInvocationPart[];
    assert.ok(toolParts.some(p => p.toolSpecificData?.commandLine?.original.includes('vibe-it')), 'appel bash présent dans l\'historique');
  }

  // La session rechargée accepte un nouveau tour.
  const { stream } = await send(mainItem, REAL ? 'Réponds : OK' : 'encore [texte]');
  assert.ok(stream.text().length > 0);
});
