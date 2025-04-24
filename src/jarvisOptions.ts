// Enum of available options for Jarvis
export enum options {
  CISCO = "cisco",
  OPTIONS = "options",
  JIRA = "jira",
  TRIAGE = "triage",
  GITHUB_REPO = "githubRepo",
}

// Map of options to their descriptions
export const optionsMap = new Map<string, string>([
  [options.CISCO, "Give a very brief description of Cisco."],
  [options.OPTIONS, "List the capabilities of Jarvis."],
  [options.JIRA, "Create a Jira ticket for me."],
  [options.TRIAGE, "Who is currently on-call?"],
  [options.GITHUB_REPO, "Create a new GitHub repo."],
]);
