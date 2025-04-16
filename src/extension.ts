import * as vscode from "vscode";

const BASE_PROMPT = "You are Jarvis, a helpful assistant. If I write foo, you respond with bar.";

const CISCO_PROMPT = "You are Jarvis, a helpful assistant. Your job is to give a very brief description of Cisco.";

// Main chat handler for Jarvis
const handler: vscode.ChatRequestHandler = async (
	request: vscode.ChatRequest,
	context: vscode.ChatContext,
	stream: vscode.ChatResponseStream,
	token: vscode.CancellationToken
  ) => {

	// Handles case where Jarvis is @ed but no prompt is given
	if (request.prompt.length === 0) {
		console.log("no prompt received");
		stream.markdown("Please enter a prompt.");
		return;
	}

	let prompt = BASE_PROMPT;

	// Check if the request is a command and set the prompt accordingly
	switch (request.command) {

		case "cisco":
			console.log("command: cisco");
			prompt = CISCO_PROMPT;
			break;

		default:
			console.log("command: none");
	}
  
	// Initialise messages with base prompt
	const messages = [vscode.LanguageModelChatMessage.User(prompt)];

	// Get all previous participant messages
	const previousMessages = context.history.filter(
		h => h instanceof vscode.ChatResponseTurn
	);

	previousMessages.forEach(m => {
		let fullMessage = "";
		m.response.forEach(r => {
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

export function activate(context: vscode.ExtensionContext) {

	console.log("extension Jarvis is now active...");

	// Placeholder command
	const disposable = vscode.commands.registerCommand("jarvis.hello", () => {
		vscode.window.showInformationMessage("Jarvis says hi!");
	});
	context.subscriptions.push(disposable);

	// Jarvis chat participant
	const tutor = vscode.chat.createChatParticipant("jarvis.jarvis", handler);
	tutor.iconPath = vscode.Uri.joinPath(context.extensionUri, "jarvis-icon.webp");

}

export function deactivate() {
	console.log("extension Jarvis is now deactivated...");
}
