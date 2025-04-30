import * as vscode from "vscode";
import { options, optionsPrompts } from "./jarvisOptions";
import { prompts } from "./prompts";
import { renderPrompt } from "@vscode/prompt-tsx";
import { postJarvisPrompt, getJarvisResponseStream, getJarvisConnectionHealth } from "./jarvisAgent";
import { Readable } from "stream";

interface IJarvisChatResult extends vscode.ChatResult {
  metadata: {
    success: boolean;
    command?: string;
  };
}

interface IJarvisChatResponse {
  answer: string;
  metadata: {
    user_input: boolean;
    input_fields: IJarvisUserInput[];
  };
}

// Interface for Jarvis response requesting user input storing both request and response
interface IJarvisUserInput {
  field_name: string;               // Name of requested field
  field_description: string;        // Description provided by Jarvis
  field_values: readonly string[];  // Value choices provided by Jarvis
  userInput?: string;               // Initially undefined, will be set to the user input
}

export class Jarvis {
  private readonly PARTICIPANT_ID = "jarvis.jarvis";
  private connectionStatus = false;

  private readonly statusBarItem: vscode.StatusBarItem;
  private chatParticipant?: vscode.ChatParticipant;

  public readonly HEALTH_CHECK_COMMAND = "jarvis.healthCheck";

  constructor() {
    // Status bar
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
    this.statusBarItem.command = this.HEALTH_CHECK_COMMAND;
    this.statusBarItem.text = "Jarvis: $(loading~spin)";
    this.statusBarItem.show();
  }

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
        stream.progress("Jarvis is thinking...");

        console.log("Handler: ", {
          command: request.command,
          prompt: request.prompt,
        });

        // Initialise the prompt with command if given
        let prompt = request.command ? optionsPrompts.get(request.command)! : "";

        // Handle commands accordingly if they have special cases
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

        const success = await postJarvisPrompt(chatId, prompt);

        if (!success) {
          throw new Error("Failed to post Jarvis prompt");
        }

        // Stream response to the chat window and get user input if needed
        const responseStream = await getJarvisResponseStream(chatId);
        const userInputs = await this.streamJarvisResponse(stream, responseStream);

        // TODO: handle user inputs
        console.log("User inputs: ", userInputs);

        return { metadata: { success: true, command: request.command } };
      } catch (error) {
        console.trace(error);
        throw new Error("Jarvis is not available at the moment.");
      }
    };

    // Register the Jarvis chat participant
    this.chatParticipant = vscode.chat.createChatParticipant(this.PARTICIPANT_ID, handler);
    this.chatParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, "jarvis.png");
    

    this.chatParticipant.followupProvider = {
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

    // TODO: can try to create a custom event for refreshing the status bar item
    const jarvisHealthCheck = vscode.commands.registerCommand(
      this.HEALTH_CHECK_COMMAND,
      this.healthHandler,
      this,
    );

    context.subscriptions.push(this.chatParticipant);
    context.subscriptions.push(jarvisHealthCheck);
    context.subscriptions.push(this.statusBarItem);

    console.log("participant Jarvis has been registered...");
  }

  /**
   * Handler for the health check command. Retrieves the health status of Jarvis and displays
   * a message to the user using the VSCode API's information messages.
   */
  private async healthHandler() {
    const health = await getJarvisConnectionHealth();
    let selection = undefined;

    this.connectionStatus = health;

    if (!health) {
      selection = await vscode.window.showErrorMessage(
        "Unable to connect to Jarvis. Please check your connection.",
        "Dismiss",
        "Retry",
      );
    } else {
      vscode.window.showInformationMessage("Jarvis connected!");
    }

    this.statusBarItem.text = "Jarvis: " + (this.connectionStatus ? "connected" : "disconnected");

    if (selection === "Retry") {
      this.healthHandler();
    }
  }

  /**
   * Streams the Jarvis API response to the chat window.
   * 
   * @param stream vscode chat response stream
   * @param responseStream stream response from Jarvis API
   */
  private async streamJarvisResponse(
    stream: vscode.ChatResponseStream,
    responseStream: Readable,
  ): Promise<IJarvisUserInput[]> {
    // Keep track of any inputs given by the user
    const userInputs = [];

    for await (const chunk of responseStream) {
      console.log("Chunk:\n", chunk.toString());
      // TODO: this is hacky, need to fix in the future
      const [eventPart, dataPart] = chunk.toString().split(/event:\s*|\s*data:\s*/).filter(Boolean);
      const parsedEvent = eventPart.trim();

      // Skip parsing for non-data events
      if (parsedEvent !== "data") {
        continue;
      }

      const data: IJarvisChatResponse = JSON.parse(dataPart);

      stream.markdown(data.answer);

      // Take user inputs if requested by the bot
      if (data.metadata.user_input) {
        for (const inputField of data.metadata.input_fields) {
          userInputs.push(await this.takeUserInputs(inputField));
        }
      }
    }

    return userInputs;
  }

  /**
   * Opens a quick pick dialog to take user inputs for the given field.
   * 
   * @param inputField Jarvis input request, contains field name, description and values
   * @returns augmented `inputField` with user input
   */
  private async takeUserInputs(inputField: IJarvisUserInput): Promise<IJarvisUserInput> {
    const result = await vscode.window.showQuickPick(inputField.field_values, {
      title: inputField.field_name,
      placeHolder: inputField.field_description,
      canPickMany: false,
      ignoreFocusOut: true,
    });

    inputField.userInput = result;

    return inputField;
  }
}
