import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { answerElicitation } from '../src/elicitation';
import { ChatQuestionType } from './vscode-stub';

const schema = JSON.parse(readFileSync('test/vibe-schema.json', 'utf8')); // produit par le code réel de Vibe
const req: any = { mode: 'form', sessionId: 's', toolCallId: 'tc1', message: 'User input required', requestedSchema: schema };
const vibeValidate = (content: unknown) =>
  execFileSync('python3', ['test/vibe_schema.py', 'validate', JSON.stringify(content)], { encoding: 'utf8' }).trim().split('\n').map(l => JSON.parse(l));
const fakeStream = (reply: (qs: any[]) => any) => ({ questionCarousel: async (qs: any[], skip: boolean) => { (fakeStream as any).last = { qs, skip }; return reply(qs); } }) as any;

// 1. Mapping schéma Vibe → questions VS Code
let seen: any;
await answerElicitation(req, fakeStream(qs => { seen = qs; return undefined; }), 'Demande de précisions');
assert.deepEqual(seen.map((q: any) => q.type), [ChatQuestionType.SingleSelect, ChatQuestionType.MultiSelect, ChatQuestionType.SingleSelect]);
assert.deepEqual(seen[1].options.map((o: any) => o.label), ['linux', 'macos', 'windows']);
assert.equal(seen[0].title, 'Tests');
assert.ok(seen.every((q: any) => q.allowFreeformInput));
assert.match(seen[0].message.value, /Demande de précisions[\s\S]*Réponses modifiables plus tard[\s\S]*Quel framework/);
assert.equal((fakeStream as any).last.skip, false, 'questions requises : pas de bouton Passer');
console.log('1 OK mapping (string/oneOf, array/items.anyOf, titre, note, contexte)');

// 2. Réponses au format VS Code → content accepté par _elicit_user_answers de Vibe
let res = await answerElicitation(req, fakeStream(() => ({
  q0: { selectedValue: 'pytest' },
  q1: { selectedValues: ['linux', 'macos'], freeformValue: 'freebsd' },
  q2: { selectedValue: 'core', freeformValue: 'monmodule' },
})), undefined);
assert.equal(res.action, 'accept');
const answers = vibeValidate((res as any).content);
assert.deepEqual(answers.map((a: any) => [a.answer, a.is_other]), [['pytest', false], ['linux, macos, freebsd', true], ['monmodule', true]]);
console.log('2 OK validé par Vibe :', JSON.stringify(answers.map((a: any) => a.answer)));

// 3. Passer → cancel (Vibe : deny_callback)
res = await answerElicitation(req, fakeStream(() => undefined), undefined);
assert.equal(res.action, 'cancel');
console.log('3 OK passer → cancel');

// 4. Réponse requise manquante → decline (évite l'InvalidRequestError côté Vibe)
res = await answerElicitation(req, fakeStream(() => ({ q0: { selectedValue: 'pytest' }, q1: { selectedValues: [] } })), undefined);
assert.equal(res.action, 'decline');
console.log('4 OK réponse incomplète → decline');

// 5. Mode url non annoncé → decline ; types texte/booléen/entier (schéma ACP générique)
assert.equal((await answerElicitation({ mode: 'url', sessionId: 's', url: 'https://x', elicitationId: 'e', message: 'm' } as any, fakeStream(() => ({})), undefined)).action, 'decline');
res = await answerElicitation({ mode: 'form', sessionId: 's', message: 'm', requestedSchema: { type: 'object', properties: {
  t: { type: 'string', title: 'Texte' }, b: { type: 'boolean', title: 'Ok ?' }, n: { type: 'integer', title: 'N' } }, required: ['t'] } } as any,
  fakeStream(() => ({ t: 'abc', b: { selectedValue: 'true' }, n: '42' })), undefined);
assert.deepEqual(res, { action: 'accept', content: { t: 'abc', b: true, n: 42 } });
console.log('5 OK url → decline ; texte/booléen/entier');
