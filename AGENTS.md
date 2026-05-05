# AGENTS.md

- if you do not find files referenced in this document, then STOP processing and write error message about it
- Always load `.ai/conventions.md` first.
- Do not load or read other referenced documents unless they are related to the task you are working on currently.
- Read `.ai/rules/LibraryReleases.md` before working on library releases, package versions, Rush change files, docs version snapshots, package publishing, or release workflows.
- Read `.ai/rules/BashModules.md` only when working on bash modules, shell scripts, or shell-based project layout.
- after completing any repository file changes, give two commit messages in semantic commits style: short and detailed
- Read `.ai/rules/DocEditing.md` only when editing documentation, markdown documents
- Create a task file under `tasks` before implementation when the request is more than a small local fix, needs multiple design decisions, or changes public project contracts. Task files are required by default for package public API changes, package metadata or release metadata changes, behavior changes across shared/server/browser package boundaries, combined docs-and-implementation changes, and anything that needs version guidance.
- Read `.ai/rules/TasksFiles.md` when creating, managing, or modifying
  files under the `tasks` directory.
