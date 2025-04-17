import * as vscode from "vscode";
import { registerJarvisParticipant } from "./jarvis";

export function activate(context: vscode.ExtensionContext) {
  // Jarvis chat participant
  registerJarvisParticipant(context);
}

export function deactivate() {
  console.log("extension Jarvis is now deactivated...");
}
