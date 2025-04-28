import * as vscode from "vscode";
import { registerJarvisParticipant } from "./jarvis";

const HEALTH_CHECK_COMMAND = "jarvis.healthCheck";

export function activate(context: vscode.ExtensionContext) {
  vscode.commands.executeCommand(HEALTH_CHECK_COMMAND);
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
