import * as vscode from "vscode";
import { registerJarvisParticipant, getChatId } from "./jarvis";

export function activate(context: vscode.ExtensionContext) {
  const chatId = getChatId();
  registerJarvisParticipant(context, chatId);
  console.log("extension Jarvis is now activated...");
}

export function deactivate() {
  console.log("extension Jarvis is now deactivated...");
}
