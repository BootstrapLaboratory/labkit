# UI And Theme Boundaries

Labkit UI is intentionally thin.

It provides:

- `cx` for class-name composition;
- typed theme definitions;
- theme-name validation;
- persisted theme controller mechanics;
- document root class application.

It does not provide buttons, fields, layouts, routes, surfaces, visual tokens,
or product components.

## Why

Product UI changes quickly and carries brand decisions. Sharing components too
early creates false reuse. Labkit keeps only the mechanics that repeated apps
need before they have a full design system.

When a second app creates real pressure to share components, create a separate
design-system package rather than expanding Labkit runtime helpers into product
UI.
