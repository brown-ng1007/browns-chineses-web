/**
 * Melon Content Contract v1
 * Stable data boundary between AI/content pipelines, Supabase and game renderers.
 * This file is deliberately dependency-free so it can be used in server and browser code.
 */

export const MELON_CONTENT_SCHEMA_VERSION = 1 as const;

export const MELON_SUBJECTS = ["english", "chinese", "math", "science", "general"] as const;
export type MelonSubject = (typeof MELON_SUBJECTS)[number];

export const MELON_RENDERER_REGISTRY = {
  choice: { label: "Chọn đáp án", layout: "options", needsOptions: true },
  listen: { label: "Nghe và chọn", layout: "audio-options", needsOptions: true, supportsAudio: true },
  order: { label: "Sắp xếp", layout: "token-order", needsTokens: true },
  input: { label: "Nhập đáp án", layout: "free-input" },
  binary: { label: "Đúng / Sai", layout: "true-false", needsOptions: true },
  stress: { label: "Trọng âm", layout: "stress-choice", needsOptions: true },
  letters: { label: "Thử thách chữ cái", layout: "letter-tiles", needsLetters: true },
  pairs: { label: "Ghép cặp", layout: "pair-match", needsPairs: true },
} as const;

export type MelonRendererKind = keyof typeof MELON_RENDERER_REGISTRY;
export type MelonQuestionKind = Exclude<MelonRendererKind, "letters" | "pairs">;
export type MelonRuntimeRendererKind = Exclude<MelonRendererKind, "binary">;
export type MelonDifficulty = 1 | 2 | 3;
export type MelonContentState = "draft" | "validated" | "published" | "rejected";
export type MelonProvenanceKind = "ai_generated" | "human_authored" | "licensed" | "public_domain";

export interface MelonMediaRefV1 {
  kind: "image" | "audio" | "video";
  storagePath: string;
  mimeType: string;
  alt?: string;
  durationSeconds?: number;
}

export interface MelonQuestionV1 {
  schemaVersion: typeof MELON_CONTENT_SCHEMA_VERSION;
  id: string;
  subject: MelonSubject;
  locale: string;
  level: string;
  topic: string;
  renderer: MelonRendererKind;
  prompt: string;
  answer: string;
  options?: string[];
  tokens?: string[];
  answerTokens?: string[];
  letters?: string[];
  pairs?: Array<{ left: string; right: string }>;
  speakText?: string;
  explanation?: string;
  difficulty: MelonDifficulty;
  media?: MelonMediaRefV1[];
  provenance: {
    kind: MelonProvenanceKind;
    sourceRef?: string;
    model?: string;
    generatedAt?: string;
  };
  state: MelonContentState;
}

export interface MelonLessonV1 {
  schemaVersion: typeof MELON_CONTENT_SCHEMA_VERSION;
  id: string;
  subject: MelonSubject;
  level: string;
  title: string;
  description: string;
  questionIds: string[];
  order: number;
  state: MelonContentState;
}

export function isMelonRendererKind(value: unknown): value is MelonRendererKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MELON_RENDERER_REGISTRY, value);
}

export function getMelonRenderer(kind: MelonRendererKind) {
  return MELON_RENDERER_REGISTRY[kind];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

/** Runtime validation used by the future import/publish pipeline. Never trusts model output. */
export function validateMelonQuestionV1(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["Question must be an object."] };

  if (value.schemaVersion !== MELON_CONTENT_SCHEMA_VERSION) errors.push("Unsupported schemaVersion.");
  if (!isNonEmptyString(value.id)) errors.push("id is required.");
  if (!(MELON_SUBJECTS as readonly unknown[]).includes(value.subject)) errors.push("subject is not supported.");
  if (!isNonEmptyString(value.locale)) errors.push("locale is required.");
  if (!isNonEmptyString(value.level)) errors.push("level is required.");
  if (!isNonEmptyString(value.topic)) errors.push("topic is required.");
  if (!isNonEmptyString(value.prompt)) errors.push("prompt is required.");
  if (!isNonEmptyString(value.answer)) errors.push("answer is required.");
  if (!isMelonRendererKind(value.renderer)) errors.push("renderer is not registered.");
  if (![1, 2, 3].includes(value.difficulty as number)) errors.push("difficulty must be 1, 2 or 3.");
  if (!( ["draft", "validated", "published", "rejected"] as string[]).includes(String(value.state))) errors.push("state is invalid.");

  if (isMelonRendererKind(value.renderer)) {
    const renderer = getMelonRenderer(value.renderer);
    if ("needsOptions" in renderer && renderer.needsOptions && (!stringArray(value.options) || value.options.length < 2)) errors.push("renderer requires at least two options.");
    if ("needsTokens" in renderer && renderer.needsTokens && (!stringArray(value.tokens) || value.tokens.length < 2)) errors.push("renderer requires tokens.");
    if ("needsLetters" in renderer && renderer.needsLetters && (!stringArray(value.letters) || value.letters.length < 2)) errors.push("renderer requires letter tiles.");
    if ("needsPairs" in renderer && renderer.needsPairs && (!Array.isArray(value.pairs) || value.pairs.length < 2)) errors.push("renderer requires at least two pairs.");
    const normalizedAnswer = isNonEmptyString(value.answer) ? value.answer.trim().toLocaleLowerCase() : null;
    if (typeof value.renderer === "string" && ["choice", "listen", "binary", "stress"].includes(value.renderer) && stringArray(value.options) && normalizedAnswer && !value.options.some((option) => option.trim().toLocaleLowerCase() === normalizedAnswer)) errors.push("answer must be present in options for this renderer.");
    if (value.renderer === "order" && (!stringArray(value.answerTokens) || value.answerTokens.length < 2)) errors.push("order renderer requires answerTokens.");
    if (value.renderer === "letters" && stringArray(value.letters) && normalizedAnswer && !value.letters.some((letter) => letter.trim().toLocaleLowerCase() === normalizedAnswer)) errors.push("letter answer must exist in letters.");
    if ("needsPairs" in renderer && renderer.needsPairs && Array.isArray(value.pairs) && value.pairs.some((pair) => !isRecord(pair) || !isNonEmptyString(pair.left) || !isNonEmptyString(pair.right))) errors.push("each pair must have non-empty left and right values.");
    if ("supportsAudio" in renderer && renderer.supportsAudio && !isNonEmptyString(value.speakText) && !(Array.isArray(value.media) && value.media.some((item) => isRecord(item) && item.kind === "audio"))) errors.push("listening renderer requires speech text or audio media.");
  }

  if (Array.isArray(value.options) && !stringArray(value.options)) errors.push("options must contain non-empty strings.");
  if (Array.isArray(value.tokens) && !stringArray(value.tokens)) errors.push("tokens must contain non-empty strings.");
  if (Array.isArray(value.answerTokens) && !stringArray(value.answerTokens)) errors.push("answerTokens must contain non-empty strings.");
  if (value.provenance !== undefined) {
    if (!isRecord(value.provenance) || !["ai_generated", "human_authored", "licensed", "public_domain"].includes(String(value.provenance.kind))) {
      errors.push("provenance.kind is invalid.");
    } else if (["licensed", "public_domain"].includes(String(value.provenance.kind)) && !isNonEmptyString(value.provenance.sourceRef)) {
      errors.push("licensed/public-domain content requires a sourceRef.");
    }
  } else {
    errors.push("provenance is required.");
  }

  if (value.media !== undefined && !Array.isArray(value.media)) errors.push("media must be an array.");
  if (Array.isArray(value.media)) {
    for (const [index, media] of value.media.entries()) {
      if (!isRecord(media) || !["image", "audio", "video"].includes(String(media.kind)) || !isNonEmptyString(media.storagePath) || !isNonEmptyString(media.mimeType)) {
        errors.push(`media[${index}] is invalid.`);
      } else if (/^(https?:)?\/\//i.test(String(media.storagePath))) {
        errors.push(`media[${index}] must use a controlled storage path, not an arbitrary external URL.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateMelonLessonV1(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["Lesson must be an object."] };
  if (value.schemaVersion !== MELON_CONTENT_SCHEMA_VERSION) errors.push("Unsupported schemaVersion.");
  if (!isNonEmptyString(value.id)) errors.push("id is required.");
  if (!(MELON_SUBJECTS as readonly unknown[]).includes(value.subject)) errors.push("subject is not supported.");
  if (!isNonEmptyString(value.level) || !isNonEmptyString(value.title)) errors.push("level and title are required.");
  if (!stringArray(value.questionIds) || value.questionIds.length === 0) errors.push("questionIds must contain at least one question id.");
  if (!Number.isInteger(value.order) || (value.order as number) < 0) errors.push("order must be a non-negative integer.");
  if (!(["draft", "validated", "published", "rejected"] as unknown[]).includes(value.state)) errors.push("state is invalid.");
  return { valid: errors.length === 0, errors };
}
