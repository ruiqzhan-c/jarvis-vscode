import * as vscode from "vscode";
import { registerJarvisParticipant } from "./jarvis";

export function activate(context: vscode.ExtensionContext) {
  const chatId = getChatId();
  registerJarvisParticipant(context, chatId);
  console.log("extension Jarvis is now activated...");
}

export function deactivate() {
  console.log("extension Jarvis is now deactivated...");
}

export function getChatId(): string {
  return "local_" + crypto.randomUUID();
}
