## Project

Prettier plugin for WGSL (WebGPU Shading Language). Implements a lexer, parser, and pretty-printer that integrates with Prettier's plugin API.

## Development Guidelines

- Use TDD / red / green / refactor loop for ANY implementation work. Write tests first, see them fail, then implement the minimum code to make them pass, then refactor for cleanliness and maintainability.
- If you're trying to fix typescript errors, avoid type casts and instead try to fix the underlying type issues, even if it requires refactoring code to be more type-friendly.
- if there is a switch statement, the default case should throw an error, and uses exhaustive type checking to ensure all cases are handled (unless the default case is explicitly intended).
- For any decisions related the output of the printer, try to follow Prettier's default JavaScript style as much as possible for consistency, unless there's a compelling reason to deviate. The goal is to have the output look like it was formatted by Prettier itself.
