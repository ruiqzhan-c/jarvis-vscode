import * as vscode from "vscode";
import * as dotenv from "dotenv";
import { options, optionsMap } from "./jarvisOptions";
import { CISCO_PROMPT, GITHUB_REPO_PROMPT, OPTIONS_PROMPT } from "./prompts";
import { renderPrompt } from "@vscode/prompt-tsx";
import { postJarvisPrompt, getJarvisResponseStream } from "./jarvisAgent";
import { Readable } from "stream";

dotenv.config();

const PARTICIPANT_ID = "jarvis.jarvis";

// interface JarvisChatResult extends vscode.ChatResult {
//   metadata: {
//     command: string;
//   };
// }

/**
 * Registers the Jarvis chat participant with the given context.
 * 
 * @param context vscode extension context
 */
export function registerJarvisParticipant(context: vscode.ExtensionContext, chatId: string) {
  // Main chat handler for Jarvis
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    _token: vscode.CancellationToken,
  ) => {
    // Progress message to chat window
    stream.progress("Jarvis is thinking...");

    // Logging
    console.log("Handler: ", {
      command: request.command,
      prompt: request.prompt,
    });

    let prompt = request.prompt;

    // Check if the request is a command and handle it accordingly
    switch (request.command) {
      // Provides a brief description of Cisco
      case options.CISCO:
        prompt = CISCO_PROMPT;
        break;

      // Provides a list of available commands
      case options.OPTIONS:
        prompt = OPTIONS_PROMPT;
        break;

      case options.JIRA: {
        console.error("NOT IMPLEMENTED: jira");
        break;
      }

      case options.TRIAGE: {
        console.error("NOT IMPLEMENTED: triage");
        break;
      }

      // Helps the user create a new GitHub repository
      case options.GITHUB_REPO:
        prompt = GITHUB_REPO_PROMPT;
        break;
    }

    // If Jarvis is @ed but no prompt is given, reply and do nothing
    if (prompt.length === 0) {
      stream.markdown("Please enter a prompt.");
      return;
    }

    // Send the prompt to Jarvis
    await postJarvisPrompt(chatId, prompt);

    // Stream response to the chat window
    const responseStream = await getJarvisResponseStream(chatId);
    await streamJarvisResponse(stream, responseStream);
  };

  // Register the Jarvis chat participant
  const jarvis = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  jarvis.iconPath = vscode.Uri.joinPath(context.extensionUri, "icon.webp");
  
  context.subscriptions.push(jarvis);

  // jarvis.followupProvider = {
  //   provideFollowups(
  //     _result: JarvisChatResult,
  //     _context: vscode.ChatContext,
  //     _token: vscode.CancellationToken,
  //   ) {
  //     if (_result.metadata!.command === "options") {
  //       return [
  //         {
  //           prompt: "let us play",
  //           label: vscode.l10n.t("Play with the cat"),
  //         } satisfies vscode.ChatFollowup,
  //       ];
  //     }
  //   },
  // };

  console.log("participant Jarvis has been registered...");
}

/**
 * Streams a list of available commands to the chat window.
 * 
 * @param stream vscode chat response stream
 */
function optionsHandler(stream: vscode.ChatResponseStream) {
  stream.markdown("Here are some of the things I can do for you:\n");
  for (const [key, value] of optionsMap) {
    stream.markdown(`- **${key}**: ${value}\n`);
    // stream.button({
    //   title: `Run ${key}`,
    //   command: "jarvis.run",
    // })
  }
}

async function streamJarvisResponse(
  stream: vscode.ChatResponseStream,
  responseStream: Readable,
) {
  for await (const chunk of responseStream) {
    console.log("Chunk:\n", chunk.toString());
    // Construct the stream chunk JSON object
    // TODO: this is hacky, need to fix in the future
    const [eventPart, dataPart] = chunk.toString().split(/event:\s*|\s*data:\s*/).filter(Boolean);
    const parsedEvent = eventPart.trim();

    // Skip parsing for non-data events
    if (parsedEvent !== "data") {
      continue;
    }

    const parsedData = JSON.parse(dataPart);

    // Parsed chunk data
    const data = {
      event: parsedEvent,
      data: parsedData,
    };
    
    stream.markdown(data.data.answer);
  }
}
