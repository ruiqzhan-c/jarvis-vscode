import {
  AssistantMessage,
  BasePromptElementProps,
  PromptElement,
  PromptSizing,
  UserMessage,
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
        <UserMessage>
          Give a very brief description of Cisco.
        </UserMessage>
      </>
    );
  }
}

export const prompts = {
  CISCO_PROMPT: 
    "Give a very brief description of Cisco.",

  OPTIONS_PROMPT:
    "What can JARVIS do?",

  GITHUB_REPO_PROMPT:
    "Create GitHub repo",

  LLM_ACCESS_PROMPT:
    "Get LLM Access",

  JIRA_PROMPT:
    "",

  TRIAGE_PROMPT:
    "",

  QUESTION_DOCS_PROMPT:
    "Question about Platform Docs",

  RAG_KEYS_PROMPT:
    "Get RAG Pipeline Keys",
};
