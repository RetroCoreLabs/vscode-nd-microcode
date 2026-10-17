/**
 * Which variant does this VS Code document use? Reads the settings and the
 * file text and hands them to src/core/resolver.ts (the rule itself).
 */

import * as vscode from "vscode";
import { resolveModel, type Resolution, type ResolverSettings } from "./core/resolver";

export function readSettings(
  scope?: vscode.ConfigurationScope,
): ResolverSettings {
  const config = vscode.workspace.getConfiguration("nd-microcode", scope);
  return {
    fileModels: config.get<Record<string, string>>("fileModels", {}),
    defaultModel: config.get<string>("defaultModel", "nd110"),
    autodetect: config.get<boolean>("autodetect.enabled", true),
  };
}

/** Path of the document relative to its workspace folder, forward slashes. */
export function relativePath(document: vscode.TextDocument): string {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  const full = document.uri.fsPath;
  if (!folder) return full.replace(/\\/g, "/");
  return vscode.workspace.asRelativePath(document.uri, false).replace(/\\/g, "/");
}

interface CacheEntry {
  version: number;
  settingsKey: string;
  resolution: Resolution;
}
const cache = new Map<string, CacheEntry>();

/** The variant of a document; cached per document version and settings. */
export function resolveForDocument(document: vscode.TextDocument): Resolution {
  const settings = readSettings(document.uri);
  const settingsKey = JSON.stringify(settings);
  const key = document.uri.toString();
  const hit = cache.get(key);
  if (hit && hit.version === document.version && hit.settingsKey === settingsKey) {
    return hit.resolution;
  }
  const resolution = resolveModel(document.getText(), relativePath(document), settings);
  cache.set(key, { version: document.version, settingsKey, resolution });
  return resolution;
}

/** Forget a closed document. */
export function forgetDocument(document: vscode.TextDocument): void {
  cache.delete(document.uri.toString());
}
