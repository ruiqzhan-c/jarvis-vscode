import * as vscode from "vscode";

const BASE_PROMPT =
  "You are Jarvis, a helpful assistant. If I write foo, you respond with bar.";

const CISCO_PROMPT = "Give a very brief description of Cisco.";

export function activate(context: vscode.ExtensionContext) {
  console.log("extension Jarvis is now active...");

  // Main chat handler for Jarvis
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ) => {
    // Handles case where Jarvis is @ed but no prompt is given
    if (request.prompt.length === 0) {
      console.log("no prompt received");
      stream.markdown("Please enter a prompt.");
      return;
    }

    console.log({
      "command": request.command,
      "prompt": request.prompt,
    });

    let prompt = BASE_PROMPT;

    // Check if the request is a command and set the prompt accordingly
    switch (request.command) {
      case "cisco": {
        prompt = CISCO_PROMPT;
        const chatResponse = await request.model.sendRequest([vscode.LanguageModelChatMessage.User(prompt)], {}, token);
        for await (const fragment of chatResponse.text) {
          stream.markdown(fragment);
        }
        return;
      }

      case "capabilities": {
        console.error("NOT IMPLEMENTED: capabilities");
        break;
      }

      case "jira": {
        console.error("NOT IMPLEMENTED: jira");
        break;
      }

      case "triage": {
        console.error("NOT IMPLEMENTED: triage");
        break;
      }
    }

    // Initialise messages with base prompt
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];

    // Get all previous participant messages
    const previousMessages = context.history.filter(
      (h) => h instanceof vscode.ChatResponseTurn,
    );

    previousMessages.forEach((m) => {
      let fullMessage = "";
      m.response.forEach((r) => {
        const mdPart = r as vscode.ChatResponseMarkdownPart;
        fullMessage += mdPart.value.value;
      });
      messages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
    });

    messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

    const chatResponse = await request.model.sendRequest(messages, {}, token);

    for await (const fragment of chatResponse.text) {
      stream.markdown(fragment);
    }
  };

  // Jarvis chat participant
  const tutor = vscode.chat.createChatParticipant("jarvis.jarvis", handler);
  tutor.iconPath = vscode.Uri.joinPath(context.extensionUri, "icon.webp");
}

export function deactivate() {
  console.log("extension Jarvis is now deactivated...");
}
