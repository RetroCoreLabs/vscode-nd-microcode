/**
 * Which variant does a .uc file use? The one place that knows the rule:
 *
 *   1. a `%#MODEL <name>` line in the first 50 lines of the file,
 *   2. the setting `vscode-nd-microcode.fileModels` (glob -> model),
 *   3. the guess from the words in the file (shown only, never written),
 *   4. the setting `vscode-nd-microcode.defaultModel`.
 *
 * No VS Code import: the settings and the file text are passed in.
 */

import { detectModel } from "@nd100uc/microcode";
import { allTokenNameSets } from "./defs";
import { type AnyModel, normaliseModelName } from "./models";

export type ModelSource = "directive" | "settings" | "autodetect" | "default";

export interface Resolution {
  model: AnyModel;
  source: ModelSource;
  /** Short text for the status bar: "directive", "settings *.uc", "autodetect 0.95". */
  detail: string;
  /** Things the user should know, e.g. an unknown model name in a directive. */
  problems: string[];
}

export interface ResolverSettings {
  /** Glob -> model name, from `vscode-nd-microcode.fileModels`. */
  fileModels: Record<string, string>;
  /** `vscode-nd-microcode.defaultModel`. */
  defaultModel: string;
  /** `vscode-nd-microcode.autodetect.enabled`. */
  autodetect: boolean;
}

export const DIRECTIVE_LINES = 50;

/** The `%#MODEL name` line (first 50 lines): the name as written, and where. */
export function findDirective(
  text: string,
): { raw: string; line: number } | undefined {
  const lines = text.split(/\r?\n/, DIRECTIVE_LINES);
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*%#MODEL\s+([A-Za-z0-9-]+)/i.exec(lines[i]);
    if (m) return { raw: m[1], line: i };
  }
  return undefined;
}

/** Turn a glob into a regular expression. Supports **, *, ? and {a,b}. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  let inBraces = false;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (c === "{") {
      inBraces = true;
      re += "(?:";
    } else if (c === "}" && inBraces) {
      inBraces = false;
      re += ")";
    } else if (c === "," && inBraces) {
      re += "|";
    } else if ("\\^$.|+()[]".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$", "i");
}

/**
 * First entry of `fileModels` (in object order) whose glob matches the path.
 * `relPath` is the file path relative to its workspace folder, with forward
 * slashes. A glob without a slash is matched against the file name only.
 */
export function matchFileModel(
  relPath: string,
  fileModels: Record<string, string>,
): { model: AnyModel; glob: string } | undefined {
  const path = relPath.replace(/\\/g, "/");
  const base = path.slice(path.lastIndexOf("/") + 1);
  for (const [glob, name] of Object.entries(fileModels)) {
    const model = normaliseModelName(name);
    if (!model) continue;
    const g = glob.replace(/\\/g, "/");
    const target = g.includes("/") ? path : base;
    if (globToRegExp(g).test(target)) return { model, glob };
  }
  return undefined;
}

/** Apply the four rules. */
export function resolveModel(
  text: string,
  relPath: string,
  settings: ResolverSettings,
): Resolution {
  const problems: string[] = [];

  const directive = findDirective(text);
  if (directive) {
    const model = normaliseModelName(directive.raw);
    if (model) {
      return { model, source: "directive", detail: "%#MODEL", problems };
    }
    problems.push(`unknown model '${directive.raw}' in the %#MODEL line`);
  }

  const bySettings = matchFileModel(relPath, settings.fileModels);
  if (bySettings) {
    return {
      model: bySettings.model,
      source: "settings",
      detail: `settings ${bySettings.glob}`,
      problems,
    };
  }

  const fallback = normaliseModelName(settings.defaultModel) ?? "nd110";
  let openNote = "";
  if (settings.autodetect) {
    const guess = detectModel(text, allTokenNameSets());
    if (guess.model) {
      const score = guess.scores.find((s) => s.model === guess.model)?.score ?? 0;
      return {
        model: guess.model,
        source: "autodetect",
        detail: `autodetect ${score.toFixed(2)}`,
        problems,
      };
    }
    openNote = guess.note;
  }

  return {
    model: fallback,
    source: "default",
    detail: openNote ? `default (${openNote})` : "default",
    problems,
  };
}
