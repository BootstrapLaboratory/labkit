# Tasks files Convention

- When creating task files under `tasks`, prepend the filename with the current
  date and time in `YYYY-MM-DD-HHMM` format.
- Use this filename shape:
  `tasks/YYYY-MM-DD-HHMM_SHORT_TASK_NAME_IN_UPPER_SNAKE_CASE.md`
- Example:
  `tasks/2026-04-25-0345_UPDATE_PACKAGE_BOUNDARIES.md`
- When all checklist items in a task file are fully completed, move the task
  file to `tasks/completed`.
- Do not modify files under `tasks/completed`; completed task files are an
  archive. If follow-up work is needed, create a new task file under `tasks`.
