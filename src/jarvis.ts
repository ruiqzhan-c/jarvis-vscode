import * as vscode from "vscode";
import * as dotenv from "dotenv";
import { options, optionsMap } from "./jarvisOptions";
import { CiscoPrompt } from "./prompts";
import { renderPrompt } from "@vscode/prompt-tsx";
import { postJarvisPrompt, getJarvisResponseStream } from "./jarvisAgent";

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
export function registerJarvisParticipant(context: vscode.ExtensionContext) {
  // Main chat handler for Jarvis
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ) => {
    // Logging
    console.log({
      command: request.command,
      prompt: request.prompt,
    });

    // Check if the request is a command and handle it accordingly
    switch (request.command) {
      // Provides a brief description of Cisco
      case options.CISCO:
        // TODO: make this set a prompt to pass to jarvis
        await ciscoHandler(request, context, stream, token);
        return;

      // Provides a list of available commands
      case options.OPTIONS: {
        // TODO: jarvis should be able to handle this
        optionsHandler(stream);
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

    // If Jarvis is @ed but no prompt is given, reply and do nothing
    if (request.prompt.length === 0) {
      stream.markdown("Please enter a prompt.");
      return;
    }

    // TODO: hacky, fix in future, can add to context
    const chatId = "local_123475aadsf";

    // Send the prompt to Jarvis
    await postJarvisPrompt(chatId, request.prompt);

    const responseStream = await getJarvisResponseStream(chatId);

    for await (const chunk of responseStream) {
      // Construct the stream chunk JSON object
      // TODO: this is hacky, need to fix in the future
      const [eventPart, dataPart] = chunk.toString().split(/event:\s*|\s*data:\s*/).filter(Boolean);
      const parsedData = JSON.parse(dataPart);

      const data = {
        event: eventPart.trim(),
        data: parsedData,
      };

      if (data.event === "data") {
        stream.markdown(data.data.answer);
      }
    }

    return;

    // // Initialise messages with base prompt
    // const messages = prompt.messages;

    // // Get all previous participant messages
    // const previousMessages = context.history.filter(
    //   (h) => h instanceof vscode.ChatResponseTurn,
    // );

    // previousMessages.forEach((m) => {
    //   let fullMessage = "";
    //   m.response.forEach((r) => {
    //     const mdPart = r as vscode.ChatResponseMarkdownPart;
    //     fullMessage += mdPart.value.value;
    //   });
    //   messages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
    // });

    // messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

    // const chatResponse = await request.model.sendRequest(messages, {}, token);

    // for await (const fragment of chatResponse.text) {
    //   stream.markdown(fragment);
    // }
  };

  // Register the Jarvis chat participant
  const jarvis = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  jarvis.iconPath = vscode.Uri.joinPath(context.extensionUri, "icon.webp");

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
 * Handles the cisco command, providing a brief description of Cisco.
 * 
 * @param request 
 * @param _context unused
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