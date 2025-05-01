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
    input_fields: IJarvisInputRequest[];
  };
}

// Interface for Jarvis response requesting user input storing both request and response
interface IJarvisInputRequest {
  field_name: string;
  field_description: string;
  field_values: readonly string[];
}

interface IJarvisInputResponse {
  field_name: string;
  response?: string;
}

class CustomQuickPickItem implements vscode.QuickPickItem {
  label: string;
  custom: boolean;

  constructor(label: string, custom: boolean) {
    this.label = label;
    this.custom = custom;
  }
}

export class Jarvis {
  private readonly PARTICIPANT_ID = "jarvis.jarvis";
  private connectionStatus = false;

  private readonly statusBarItem: vscode.StatusBarItem;
  private chatParticipant?: vscode.ChatParticipant;

  public readonly HEALTH_CHECK_COMMAND = "jarvis.healthCheck";
  public readonly REQUEST_INPUT_COMMAND = "jarvis.requestInput";

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
        if (prompt.trim().length === 0) {
          stream.markdown("Please enter a prompt.");
          return { metadata: { success: false } };
        }

        const success = await postJarvisPrompt(chatId, prompt);

        if (!success) {
          throw new Error("Failed to post Jarvis prompt");
        }

        // Stream response to the chat window and get user input if needed
        const responseStream = await getJarvisResponseStream(chatId);
        await this.streamJarvisResponse(stream, responseStream);

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

    const jarvisRequestInput = vscode.commands.registerCommand(
      this.REQUEST_INPUT_COMMAND,
      this.takeUserInputs,
      this,
    );

    context.subscriptions.push(this.chatParticipant);
    context.subscriptions.push(this.statusBarItem);
    context.subscriptions.push(jarvisHealthCheck);
    context.subscriptions.push(jarvisRequestInput);

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

      const data: IJarvisChatResponse = JSON.parse(dataPart);

      stream.markdown(data.answer);

      // Take user inputs if requested by the bot
      if (data.metadata.user_input) {
        stream.button({
          title: "Submit details",
          command: this.REQUEST_INPUT_COMMAND,
          arguments: [data.metadata.input_fields],
        });
      }
    }
  }

  /**
   * Opens a quick pick dialog to take user inputs for the given fields.
   * 
   * @param inputFields Jarvis input request, contains field name, description and values
   */
  private async takeUserInputs(inputFields: IJarvisInputRequest[]) {
    const augmentedInputs: IJarvisInputResponse[] = [];

    if (inputFields.length === 1) {
      const result = await this.takeUserInputText(inputFields[0]);
      augmentedInputs.push(result);
    } else {
      for (const inputField of inputFields) {
        const result = await this.takeUserInputSelection(inputField);
        augmentedInputs.push(result);
      }
    }

    vscode.commands.executeCommand("workbench.action.chat.open", {
      query: "@jarvis " + JSON.stringify(augmentedInputs),
    });
  }

  /**
   * Shows a custom quick pick dialog to take user inputs for the given fields.
   * 
   * @param inputField Jarvis input request, contains field name, description and values
   * @return Promise with the user input response
   */
  private async takeUserInputSelection(inputField: IJarvisInputRequest): Promise<IJarvisInputResponse> {
    const disposables: vscode.Disposable[] = [];
  
    return new Promise<IJarvisInputResponse>((resolve, reject) => {
      const quickPick = vscode.window.createQuickPick<CustomQuickPickItem>();
      quickPick.items = inputField.field_values.map(label => ({ label: label, custom: false }));
      quickPick.title = inputField.field_name;
      quickPick.placeholder = inputField.field_description;
      quickPick.canSelectMany = false;
      quickPick.ignoreFocusOut = true;

      disposables.push(
        quickPick.onDidChangeValue(value => {
          quickPick.items = inputField.field_values.map(label => ({ label: label, custom: false })).concat([{label: "Custom input: " + value, custom: true}]);
        }),
        quickPick.onDidChangeSelection(selection => {
          let label = selection[0].label;
          if (selection[0].custom) {
            label = label.slice(14);
          }

          quickPick.hide();
          resolve({ field_name: inputField.field_name, response: label });
        }),
        quickPick.onDidHide(() => {
          disposables.forEach(disposable => disposable.dispose());
        })
      );

      quickPick.show();
    });
  }

  private async takeUserInputText(inputField: IJarvisInputRequest): Promise<IJarvisInputResponse> {
    const disposables: vscode.Disposable[] = [];

    return new Promise<IJarvisInputResponse>((resolve, reject) => {
      const inputBox = vscode.window.createInputBox();
      inputBox.title = inputField.field_name;
      inputBox.prompt = inputField.field_description;
      inputBox.placeholder = "Enter your input here";
      inputBox.ignoreFocusOut = true;
      
      disposables.push(
        inputBox.onDidAccept(() => {
          const input = inputBox.value;
          inputBox.hide();
          resolve({ field_name: inputField.field_name, response: input });
        }),
        inputBox.onDidHide(() => {
          disposables.forEach(disposable => disposable.dispose());
        })
      );
      
      inputBox.show();
    });
  }
}
