import * as vscode from "vscode";
import { registerJarvisParticipant } from "./jarvis";

export function activate(context: vscode.ExtensionContext) {
  registerJarvisParticipant(context);
  console.log("extension Jarvis is now activated...");
}

export function deactivate() {
  console.log("extension Jarvis is now deactivated...");
}
