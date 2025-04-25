import * as vscode from "vscode";
import * as dotenv from "dotenv";
import { options, optionsPrompts } from "./jarvisOptions";
import { prompts } from "./prompts";
import { renderPrompt } from "@vscode/prompt-tsx";
import { postJarvisPrompt, getJarvisResponseStream } from "./jarvisAgent";
import { Readable } from "stream";

dotenv.config();

const PARTICIPANT_ID = "jarvis.jarvis";

interface IJarvisChatResult extends vscode.ChatResult {
  metadata: {
    success: boolean;
    command?: string;
  };
}

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
  ): Promise<IJarvisChatResult> => {
    try {
      // Progress message to chat window
      stream.progress("Jarvis is thinking...");

      // Logging
      console.log("Handler: ", {
        command: request.command,
        prompt: request.prompt,
      });

      let prompt = request.command ? optionsPrompts.get(request.command)! : "";

      // Check if the request is a command and handle it accordingly
      switch (request.command) {
        case options.JIRA: {
          console.error("NOT IMPLEMENTED: jira");
          break;
        }

        case options.TRIAGE: {
          console.error("NOT IMPLEMENTED: triage");
          break;
        }
      }

      prompt += " " + request.prompt;

      // If Jarvis is @ed but no prompt is given, reply and do nothing
      if (prompt.length === 0) {
        stream.markdown("Please enter a prompt.");
        return { metadata: { success: false } };
      }

      // Send the prompt to Jarvis
      const success = await postJarvisPrompt(chatId, prompt);

      if (!success) {
        throw new Error("Failed to post Jarvis prompt");
      }

      // Stream response to the chat window
      const responseStream = await getJarvisResponseStream(chatId);
      await streamJarvisResponse(stream, responseStream);

      return { metadata: { success: true, command: request.command } };
    } catch (error) {
      console.trace(error);
      throw new Error("Jarvis is not available at the moment.");
    }
  };

  // Register the Jarvis chat participant
  const jarvis = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  jarvis.iconPath = vscode.Uri.joinPath(context.extensionUri, "jarvis.png");
  jarvis.followupProvider = {
    provideFollowups(
      _result: IJarvisChatResult,
      _context: vscode.ChatContext,
      _token: vscode.CancellationToken,
    ) {
      if (!_result.metadata.success) {
        return [];
      };

      if (_result.metadata.command === options.OPTIONS) {
        // TODO: replace with actual prompts
        return [
          {
            prompt: "PLACEHOLDER",
            label: vscode.l10n.t("Get LLM access"),
          } satisfies vscode.ChatFollowup,
        ];
      }
    },
  };

  context.subscriptions.push(jarvis);

  console.log("participant Jarvis has been registered...");
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
