// Test de fumée ACP sans VS Code : initialize → session/new (→ auth_required attendu sans clé) → session/list
import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';

const cmd = process.env.VIBE_ACP ?? 'vibe-acp';
const p = spawn(cmd, [], { stdio: ['pipe', 'pipe', 'inherit'], cwd: process.cwd() });
const conn = new acp.ClientSideConnection(() => ({
  sessionUpdate: async (n) => console.log('update', n.update.sessionUpdate),
  requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
  readTextFile: async () => ({ content: '' }),
  writeTextFile: async () => ({}),
}), acp.ndJsonStream(Writable.toWeb(p.stdin), Readable.toWeb(p.stdout)));

const timeout = setTimeout(() => { console.error('TIMEOUT'); p.kill(); process.exit(2); }, 60000);
try {
  const init = await conn.initialize({
    protocolVersion: acp.PROTOCOL_VERSION,
    clientInfo: { name: 'smoke', version: '0' },
    clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false, _meta: { 'terminal-auth': true } },
  });
  console.log('terminal-auth meta', JSON.stringify(init.authMethods?.find(m=>m.id==='vibe-setup')?._meta));console.log('initialize OK', JSON.stringify({ v: init.protocolVersion, agent: init.agentInfo, caps: init.agentCapabilities, auth: init.authMethods?.map(m => m.id) }, null, 1));
  try {
    const s = await conn.newSession({ cwd: process.cwd(), mcpServers: [] });
    console.log('session/new OK', s.sessionId, (s.configOptions ?? []).map(o => `${o.id}=${o.currentValue}`));
    for (const o of s.configOptions ?? []) {
      if (o.type !== 'select') continue;
      const flat = o.options.flatMap(x => 'group' in x ? x.options : [x]);
      const other = flat.find(x => x.value !== o.currentValue);
      if (!other) continue;
      const r = await conn.setSessionConfigOption({ sessionId: s.sessionId, configId: o.id, value: other.value });
      console.log(`set_config_option ${o.id}: ${o.currentValue} -> ${r.configOptions.find(x => x.id === o.id)?.currentValue}`);
    }
    try {
      const f = await conn.unstable_forkSession({ sessionId: s.sessionId, cwd: process.cwd(), mcpServers: [] });
      console.log('session/fork OK', f.sessionId !== s.sessionId);
    } catch (e) { console.log('session/fork erreur', e.code, e.message); }
    try {
      await conn.closeSession({ sessionId: s.sessionId });
      console.log('session/close OK');
    } catch (e) { console.log('session/close erreur', e.code, e.message); }
    const l = await conn.listSessions({ cwd: process.cwd() });
    console.log('session/list OK', l.sessions.length);
  } catch (e) { console.log('session/new erreur', e.code, e.message); }
} finally { clearTimeout(timeout); p.kill(); }
