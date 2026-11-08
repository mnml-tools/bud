# Frontend code style

- Always leave a blank line between the import block and the rest of the code.
- Separate top-level declarations, types, functions, and components with blank lines.
- Inside functions and hooks, use blank lines between logical sections: setup, handlers, effects, control flow, and the final return. Keep related state declarations and short sequences of related operations together.
- Keep each React component in its own file and follow the atomic design structure documented in `../docs/architecture.md`.
- Run Prettier after edits. Prettier preserves intentional blank lines but does not add these separations automatically.
