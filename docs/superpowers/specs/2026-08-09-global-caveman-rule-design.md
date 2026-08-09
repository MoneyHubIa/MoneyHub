# Global Caveman Rule Design

## Objective

Create `C:\Users\Ishvar\.codex\AGENTS.md` so Codex must use the installed
`caveman` skill at level `full` when retrieving project information or when
analyzing, explaining, or summarizing project-related material.

## Scope and triggers

The rule applies globally to Codex sessions and activates `caveman` before:

- inspecting, searching, reading, or extracting information from a project;
- analyzing or explaining project code, configuration, architecture, behavior,
  errors, logs, tests, changes, or documentation;
- summarizing project files, findings, status, diffs, history, or tool output.

The rule does not require Caveman formatting for persisted artifacts such as
source code, comments, documentation, commit messages, issue text, pull request
text, or other third-party communication.

## Communication behavior

- Use intensity `full`.
- Preserve the user's language.
- Preserve exact technical terms, paths, commands, code, API names, numbers,
  units, and error messages.
- Remove filler and unnecessary narration while retaining all technical facts.
- Do not narrate routine tool calls.

## Clarity and safety exceptions

Temporarily use normal, explicit prose for security warnings, irreversible
action confirmations, ordered procedures where fragments could obscure the
sequence, and any passage where compression would create technical ambiguity.
Resume `caveman` afterward while the trigger remains applicable.

## Verification

After creation, read the global file back and confirm it contains the required
skill name, `full` level, project-information triggers, explanation and summary
triggers, preservation rules, and clarity exceptions.
