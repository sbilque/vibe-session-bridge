// ACP elicitation/create (mode "form") → stream.questionCarousel.
//
// Côté Vibe (mistral-vibe 2.26.1, vibe/acp/agent.py) :
//   - activé seulement si clientCapabilities.elicitation.form est annoncé (_supports_user_input) ;
//   - _build_elicitation_schema : une propriété "q{i}" par question de l'outil ask_user_question,
//       choix unique  → { type: "string", title: header, description: question, oneOf: [{const,title}] }
//       choix multiple → { type: "array", title, description, items: { anyOf: [{const,title}] } }
//     toutes requises ; footer_note → schema.description ;
//   - les réponses hors liste sont acceptées (« Other ») ; chaîne ou tableau vide → erreur ;
//   - toute réponse autre que action "accept" avec content → deny_callback.
//
// Côté VS Code (src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatQuestionCarouselPart.ts) :
//   réponse par id de question : Text → string ; SingleSelect → { selectedValue, freeformValue } ;
//   MultiSelect → { selectedValues, freeformValue }. undefined si l'utilisateur passe.
import * as vscode from 'vscode';
import type * as acp from '@agentclientprotocol/sdk';

type Prop = acp.ElicitationPropertySchema & { title?: string | null; description?: string | null };
interface EnumOpt { value: string; label: string }

const enumOf = (p: Record<string, unknown>): EnumOpt[] | undefined => {
  // string → oneOf ; array → items.anyOf (TitledMultiSelectItems) ; variantes sans titre → enum.
  const oneOf = (p.oneOf ?? p.anyOf) as acp.EnumOption[] | null | undefined;
  if (oneOf?.length) return oneOf.map(o => ({ value: o.const, label: o.title || o.const }));
  const e = p.enum as string[] | null | undefined;
  return e?.length ? e.map(v => ({ value: v, label: v })) : undefined;
};

interface Mapped {
  key: string;
  prop: Prop;
  question: vscode.ChatQuestion;
  choices?: EnumOpt[];
}

/** Traduit une propriété du schéma en ChatQuestion. */
function toQuestion(key: string, prop: Prop): Mapped {
  const title = prop.title || prop.description || key;
  const message = prop.title && prop.description ? prop.description : undefined;
  const p = prop as unknown as Record<string, unknown>;
  const opt = (choices: EnumOpt[]) => choices.map(c => ({ id: c.value, label: c.label, value: c.value }));

  switch (prop.type) {
    case 'string': {
      const choices = enumOf(p);
      if (choices) {
        return {
          key, prop, choices,
          question: new vscode.ChatQuestion(key, vscode.ChatQuestionType.SingleSelect, title, {
            message, options: opt(choices),
            defaultValue: typeof p.default === 'string' ? p.default : undefined,
            allowFreeformInput: true, // Vibe accepte les réponses hors liste (option « Other »)
          }),
        };
      }
      return { key, prop, question: new vscode.ChatQuestion(key, vscode.ChatQuestionType.Text, title, { message, defaultValue: typeof p.default === 'string' ? p.default : undefined }) };
    }
    case 'array': {
      const choices = enumOf((p.items ?? {}) as Record<string, unknown>) ?? [];
      return {
        key, prop, choices,
        question: new vscode.ChatQuestion(key, vscode.ChatQuestionType.MultiSelect, title, {
          message, options: opt(choices),
          defaultValue: Array.isArray(p.default) ? p.default as string[] : undefined,
          allowFreeformInput: true,
        }),
      };
    }
    case 'boolean': {
      const choices = [{ value: 'true', label: vscode.l10n.t('Yes') }, { value: 'false', label: vscode.l10n.t('No') }];
      return {
        key, prop, choices,
        question: new vscode.ChatQuestion(key, vscode.ChatQuestionType.SingleSelect, title, {
          message, options: opt(choices),
          defaultValue: typeof p.default === 'boolean' ? String(p.default) : undefined,
        }),
      };
    }
    default: // number, integer
      return { key, prop, question: new vscode.ChatQuestion(key, vscode.ChatQuestionType.Text, title, { message, defaultValue: p.default != null ? String(p.default) : undefined }) };
  }
}

/** Réponse du carousel → valeur ACP (ElicitationContentValue) ; undefined si vide ou invalide. */
function toValue(m: Mapped, answer: unknown): acp.ElicitationContentValue | undefined {
  const a = answer as { selectedValue?: string; selectedValues?: string[]; freeformValue?: string } | string | undefined;
  switch (m.prop.type) {
    case 'string': {
      if (typeof a === 'string') return a.trim() || undefined;
      const v = a?.freeformValue?.trim() || a?.selectedValue;
      return v || undefined;
    }
    case 'array': {
      if (typeof a === 'string') return a.trim() ? [a.trim()] : undefined;
      const vals = [...(a?.selectedValues ?? [])];
      const free = a?.freeformValue?.trim();
      if (free) vals.push(free); // Vibe : is_other = valeur hors des libellés
      return vals.length ? vals : undefined;
    }
    case 'boolean': {
      const v = typeof a === 'string' ? a : a?.selectedValue;
      return v === 'true' ? true : v === 'false' ? false : undefined;
    }
    case 'number':
    case 'integer': {
      const raw = typeof a === 'string' ? a : a?.freeformValue ?? a?.selectedValue;
      const n = raw != null && raw.trim() !== '' ? Number(raw) : NaN;
      if (Number.isNaN(n) || (m.prop.type === 'integer' && !Number.isInteger(n))) return undefined;
      return n;
    }
    default:
      return undefined;
  }
}

/**
 * Traite une requête elicitation/create pour le tour en cours.
 * Le mode "url" n'est pas annoncé dans les capacités, on le refuse proprement.
 */
export async function answerElicitation(
  req: acp.CreateElicitationRequest,
  stream: vscode.ChatResponseStream,
  contextTitle: string | undefined,
): Promise<acp.CreateElicitationResponse> {
  if (req.mode !== 'form') return { action: 'decline' };
  const schema = (req as { requestedSchema: acp.ElicitationSchema }).requestedSchema;
  const props = Object.entries(schema.properties ?? {}) as Array<[string, Prop]>;
  if (!props.length) return { action: 'decline' };

  const mapped = props.map(([k, p]) => toQuestion(k, p));
  // Contexte commun (message de l'agent, note de bas de formulaire) sur la première question.
  const intro = [contextTitle, req.message !== 'User input required' ? req.message : undefined, schema.description]
    .filter(Boolean).join('\n\n');
  if (intro) {
    const q = mapped[0].question;
    const own = typeof q.message === 'string' ? q.message : q.message?.value;
    q.message = new vscode.MarkdownString([intro, own].filter(Boolean).join('\n\n'));
  }

  const required = new Set(schema.required ?? []);
  const answers = await stream.questionCarousel(mapped.map(m => m.question), required.size === 0);
  if (!answers) return { action: 'cancel' }; // « Passer » → Vibe refuse l'appel d'outil (deny_callback)

  const content: Record<string, acp.ElicitationContentValue> = {};
  for (const m of mapped) {
    const v = toValue(m, answers[m.key]);
    if (v === undefined) {
      if (required.has(m.key)) return { action: 'decline' }; // évite l'InvalidRequestError côté Vibe
      continue;
    }
    content[m.key] = v;
  }
  return { action: 'accept', content };
}
