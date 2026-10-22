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

// l10n minimal : substitue {0}…{n} comme le fait vscode.l10n.t (tests en anglais, valeur source).
export const l10n = {
  t(message: string, ...args: Array<string | number | boolean | Record<string, unknown>>): string {
    const named = typeof args[0] === 'object' && args[0] !== null ? args[0] as Record<string, unknown> : undefined;
    return message.replace(/\{(\w+)\}/g, (_, k) => String(named ? named[k] : (args as unknown[])[Number(k)]));
  },
};
