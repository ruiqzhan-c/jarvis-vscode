import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as http from "http";
import { options, optionsMap } from "./jarvisOptions";
import { BasePrompt, CiscoPrompt } from "./prompts";
import { renderPrompt } from "@vscode/prompt-tsx";

dotenv.config();

const PARTICIPANT_ID = "jarvis.jarvis";

// Jarvis API configuration
const JARVIS_PORT = process.env.JARVIS_PORT || "8000";
const JARVIS_HOST = process.env.JARVIS_HOST || "localhost";
const JARVIS_URL = `http://${JARVIS_HOST}:${JARVIS_PORT}/`;

interface JarvisChatResult extends vscode.ChatResult {
  metadata: {
    command: string;
  };
}

/**
 * Registers the Jarvis chat participant with the given context.
 * 
 * @param context vscode extension context
 */
export function registerJarvisParticipant(context: vscode.ExtensionContext) {
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

    const prompt = await renderPrompt(
      BasePrompt,
      {},
      { modelMaxPromptTokens: request.model.maxInputTokens },
      request.model,
    );

    // Check if the request is a command and handle it accordingly
    switch (request.command) {
      case options.CISCO:
        await ciscoHandler(request, context, stream, token);
        return;

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

      case options.HEALTH: {
        const health = http.get(JARVIS_URL + "healthz");
        console.log(health.getHeaders());
        stream.markdown("check console");
        return;
      }
    }

    // Handles case where Jarvis is @ed but no prompt is given
    if (request.prompt.length === 0) {
      console.log("no prompt received");
      stream.markdown("Please enter a prompt.");
      return;
    }

    // Initialise messages with base prompt
    const messages = prompt.messages;

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
  const jarvis = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  jarvis.iconPath = vscode.Uri.joinPath(context.extensionUri, "icon.webp");

  jarvis.followupProvider = {
    provideFollowups(
      _result: JarvisChatResult,
      _context: vscode.ChatContext,
      _token: vscode.CancellationToken,
    ) {
      if (_result.metadata!.command === "options") {
        return [
          {
            prompt: "let us play",
            label: vscode.l10n.t("Play with the cat"),
          } satisfies vscode.ChatFollowup,
        ];
      }
    },
  };

  console.log("participant Jarvis has been registered...");
}

/**
 * Handles the cisco command, providing a brief description of Cisco.
 * 
 * @param request 
 * @param _context 
 * @param stream 
 * @param token 
 */
async function ciscoHandler(
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
) {
  stream.progress("Fetching data on Cisco...");
  
  // Construct the prompt for Cisco command
  const prompt = await renderPrompt(
    CiscoPrompt,
    {},
    { modelMaxPromptTokens: request.model.maxInputTokens },
    request.model,
  );

  // Get GPT response and stream it to the chat window
  const chatResponse = await request.model.sendRequest(
    prompt.messages,
    {},
    token,
  );

  for await (const fragment of chatResponse.text) {
    stream.markdown(fragment);
  }
  stream.markdown("\n\n<https://www.cisco.com/>");
}
