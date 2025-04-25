import { prompts } from "./prompts";

// Enum of available options for Jarvis
export enum options {
  CISCO = "cisco",
  OPTIONS = "options",
  JIRA = "jira",
  TRIAGE = "triage",
  GITHUB_REPO = "githubRepo",
  LLM_ACCESS = "llmAccess",
}

// Map of options to their prompts
export const optionsPrompts = new Map<string, string>([
  [options.CISCO, prompts.CISCO_PROMPT],
  [options.OPTIONS, prompts.OPTIONS_PROMPT],
  [options.JIRA, prompts.JIRA_PROMPT],
  [options.TRIAGE, prompts.TRIAGE_PROMPT],
  [options.GITHUB_REPO, prompts.GITHUB_REPO_PROMPT],
  [options.LLM_ACCESS, prompts.LLM_ACCESS_PROMPT],
]);
