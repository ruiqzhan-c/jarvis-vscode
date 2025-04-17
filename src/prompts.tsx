import {
  AssistantMessage,
  BasePromptElementProps,
  PromptElement,
  PromptSizing,
} from "@vscode/prompt-tsx";

export interface PromptProps extends BasePromptElementProps {
  userQuery?: string;
}

export interface PromptState {
  creationScript: string;
}

export class BasePrompt extends PromptElement<PromptProps, void> {
  // override async prepare() {}

  async render(_state: void, _sizing: PromptSizing) {
    return (
      <>
        <AssistantMessage>
          You are Jarvis, a helpful assistant. If the user writes foo, you
          respond with bar.
        </AssistantMessage>
      </>
    );
  }
}

export class CiscoPrompt extends PromptElement<PromptProps, void> {
  async render(_state: void, _sizing: PromptSizing) {
    return (
      <>
        <AssistantMessage>
          Give a very brief description of Cisco.
        </AssistantMessage>
      </>
    );
  }
}
