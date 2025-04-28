import * as vscode from "vscode";
import * as dotenv from "dotenv";
import { options, optionsPrompts } from "./jarvisOptions";
import { prompts } from "./prompts";
import { renderPrompt } from "@vscode/prompt-tsx";
import { postJarvisPrompt, getJarvisResponseStream, getJarvisConnectionHealth } from "./jarvisAgent";
import { Readable } from "stream";

dotenv.config();

interface IJarvisChatResult extends vscode.ChatResult {
  metadata: {
    success: boolean;
    command?: string;
  };
}

export class Jarvis {
  private readonly PARTICIPANT_ID = "jarvis.jarvis";
  private connectionStatus = false;

  public readonly HEALTH_CHECK_COMMAND = "jarvis.healthCheck";

  /**
   * Registers the Jarvis chat participant with the given context.
   * 
   * @param context vscode extension context
   */
  public registerChatParticipant(context: vscode.ExtensionContext, chatId: string) {
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
        await this.streamJarvisResponse(stream, responseStream);

        return { metadata: { success: true, command: request.command } };
      } catch (error) {
        console.trace(error);
        throw new Error("Jarvis is not available at the moment.");
      }
    };

    // Register the Jarvis chat participant
    const jarvis = vscode.chat.createChatParticipant(this.PARTICIPANT_ID, handler);
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
          return [
            {
              prompt: "Get LLM access",
              command: options.LLM_ACCESS,
              label: vscode.l10n.t("Get LLM access"),
            } satisfies vscode.ChatFollowup,
            {
              prompt: "Create GitHub repo",
              command: options.GITHUB_REPO,
              label: vscode.l10n.t("Create GitHub repo"),
            } satisfies vscode.ChatFollowup,
          ];
        }
      },
    };

    const jarvisHealthCheck = vscode.commands.registerCommand(
      this.HEALTH_CHECK_COMMAND,
      this.healthHandler.bind(this),
    );

    context.subscriptions.push(jarvis);
    context.subscriptions.push(jarvisHealthCheck);

    console.log("participant Jarvis has been registered...");
  }

  /**
   * Handler for the health check command. Retrieves the health status of Jarvis and displays
   * a message to the user using the VSCode API's information messages.
   */
  private async healthHandler() {
    const health = await getJarvisConnectionHealth();
    if (!health) {
      const selection = await vscode.window.showErrorMessage(
        "Unable to connect to Jarvis. Please check your connection.",
        "Dismiss",
        "Retry",
      );

      if (selection === "Retry") {
        this.healthHandler();
      }
    } else {
      vscode.window.showInformationMessage("Jarvis connected!");
    }
  }

  private async streamJarvisResponse(
    stream: vscode.ChatResponseStream,
    responseStream: Readable,
  ) {
    for await (const chunk of responseStream) {
      console.log("Chunk:\n", chunk.toString());
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
}
