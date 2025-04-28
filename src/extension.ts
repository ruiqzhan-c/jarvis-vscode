import * as vscode from "vscode";
import { Jarvis } from "./jarvis";

export function activate(context: vscode.ExtensionContext) {
  const jarvis = new Jarvis();

  vscode.commands.executeCommand(jarvis.HEALTH_CHECK_COMMAND);

  const chatId = getChatId();
  jarvis.registerChatParticipant(context, chatId);

  console.log("extension Jarvis is now activated...");
}

export function deactivate() {
  console.log("extension Jarvis is now deactivated...");
}

export function getChatId(): string {
  return "local_" + crypto.randomUUID();
}
