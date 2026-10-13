// Faux module 'vscode' minimal pour tester terminals.ts sous Node.
export class EventEmitter<T> { private l: ((v: T) => void)[] = []; event = (f: (v: T) => void) => { this.l.push(f); return { dispose() {} }; }; fire(v: T) { this.l.forEach(f => f(v)); } }
export class ThemeIcon { constructor(public id: string) {} }
export const env = { shell: process.env.SHELL ?? '/bin/sh' };
export const workspace = { workspaceFolders: undefined, getConfiguration: () => ({ get: (_k: string, d: unknown) => (_k === 'terminal.reveal' ? 'never' : d) }) };
export const window = { createTerminal: () => ({ show() {}, dispose() {} }) };
export enum ChatQuestionType { Text = 1, SingleSelect = 2, MultiSelect = 3 }
export class ChatQuestion {
  message?: any; options?: any[]; defaultValue?: any; allowFreeformInput?: boolean;
  constructor(public id: string, public type: ChatQuestionType, public title: string, o: any = {}) { Object.assign(this, o); }
}
export class MarkdownString { constructor(public value = '') {} }
