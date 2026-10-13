import assert from 'node:assert/strict';
import { AcpTerminalManager } from '../src/terminals';
const log: any = { info() {}, warn() {}, error() {}, debug() {} };
const m = new AcpTerminalManager(log);
const S = 'sess-1';

// 1. Ligne shell complète (forme utilisée par Vibe), stdout + stderr, code de sortie
let { terminalId } = m.create({ sessionId: S, command: 'echo hello && echo err 1>&2 && exit 3', cwd: process.cwd() });
let ex = await m.waitForExit({ sessionId: S, terminalId });
assert.equal(ex.exitCode, 3);
let o = m.output({ sessionId: S, terminalId });
assert.match(o.output, /hello/); assert.match(o.output, /err/); assert.equal(o.truncated, false);
assert.equal(o.exitStatus?.exitCode, 3);
console.log('1 OK shell + exit code');

// 2. command + args (exécution directe)
({ terminalId } = m.create({ sessionId: S, command: 'printf', args: ['%s', 'a b'] }));
await m.waitForExit({ sessionId: S, terminalId });
assert.equal(m.output({ sessionId: S, terminalId }).output, 'a b');
console.log('2 OK args directs');

// 3. outputByteLimit : garde la fin, sans couper un caractère UTF-8
({ terminalId } = m.create({ sessionId: S, command: `printf 'début-éééé-FIN'`, outputByteLimit: 9 }));
await m.waitForExit({ sessionId: S, terminalId });
o = m.output({ sessionId: S, terminalId });
assert.equal(o.truncated, true); assert.ok(Buffer.byteLength(o.output) <= 9); assert.ok(o.output.endsWith('FIN')); assert.ok(!o.output.includes('\uFFFD'));
console.log('3 OK troncature', JSON.stringify(o.output));

// 4. kill : processus arrêté (y compris l'enfant du shell), terminal toujours interrogeable
({ terminalId } = m.create({ sessionId: S, command: 'sleep 30; echo jamais' }));
const t0 = Date.now(); m.kill({ sessionId: S, terminalId });
ex = await m.waitForExit({ sessionId: S, terminalId });
assert.ok(Date.now() - t0 < 3000); assert.ok(ex.signal || ex.exitCode !== 0);
assert.doesNotMatch(m.output({ sessionId: S, terminalId }).output, /jamais/);
console.log('4 OK kill', JSON.stringify(ex));

// 5. release : id invalide pour l'agent, sortie encore visible pour le Chat
m.release({ sessionId: S, terminalId });
assert.throws(() => m.output({ sessionId: S, terminalId }), /inconnu/);
assert.ok(m.describe(terminalId));
console.log('5 OK release');

// 6. isolation entre sessions + commande introuvable
({ terminalId } = m.create({ sessionId: S, command: 'true' }));
assert.throws(() => m.output({ sessionId: 'autre', terminalId }));
({ terminalId } = m.create({ sessionId: S, command: 'commande_inexistante_xyz', args: ['x'] }));
ex = await m.waitForExit({ sessionId: S, terminalId });
assert.notEqual(ex.exitCode, 0);
console.log('6 OK isolation + ENOENT', JSON.stringify(ex));

// 7. killSession (annulation du tour)
({ terminalId } = m.create({ sessionId: S, command: 'sleep 30' }));
m.killSession(S);
await m.waitForExit({ sessionId: S, terminalId });
console.log('7 OK killSession');
m.dispose();
