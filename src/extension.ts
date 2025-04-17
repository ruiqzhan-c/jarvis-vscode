import * as vscode from "vscode";
import { options, optionsMap } from "./options";

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
    console.log({
      command: request.command,
      prompt: request.prompt,
    });

    let prompt = BASE_PROMPT;

    // Check if the request is a command and set the prompt accordingly
    switch (request.command) {
      case options.CISCO: {
        prompt = CISCO_PROMPT;
        const chatResponse = await request.model.sendRequest(
          [vscode.LanguageModelChatMessage.User(prompt)],
          {},
          token,
        );
        for await (const fragment of chatResponse.text) {
          stream.markdown(fragment);
        }
        stream.markdown("\n\n<https://www.cisco.com/>");
        return;
      }

      case options.OPTIONS: {
        stream.markdown("Here are some of the things I can do for you:\n");
        for (const [key, value] of optionsMap) {
          stream.markdown(`- **${key}**: ${value}\n`);
          // stream.button({
          //   title: `Run ${key}`,
          //   command: "jarvis.run",
          // })
        }
        return;
      }

      case options.JIRA: {
        console.error("NOT IMPLEMENTED: jira");
        break;
      }

      case options.TRIAGE: {
        console.error("NOT IMPLEMENTED: triage");
        break;
      }
    }

    // Handles case where Jarvis is @ed but no prompt is given
    if (request.prompt.length === 0) {
      console.log("no prompt received");
      stream.markdown("Please enter a prompt.");
      return;
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
  const jarvis = vscode.chat.createChatParticipant("jarvis.jarvis", handler);
  jarvis.iconPath = vscode.Uri.joinPath(context.extensionUri, "icon.webp");
  jarvis.followupProvider = {
    provideFollowups(
      result: vscode.ChatResult,
      _context: vscode.ChatContext,
      _token: vscode.CancellationToken,
    ) {
      if (result.metadata!.command === "options") {
        return [
          {
            prompt: "let us play",
            label: vscode.l10n.t("Play with the cat"),
          } satisfies vscode.ChatFollowup,
        ];
      }
    },
  };
}

export function deactivate() {
  console.log("extension Jarvis is now deactivated...");
}
