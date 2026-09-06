// Minimal ambient types for Node builtins used in tests — avoids adding @types/node (docs/claude/code-notes.md).
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean };
}
declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

// Minimal jsdom surface for the a11y harness — avoids adding @types/jsdom (docs/claude/code-notes.md).
declare module 'jsdom' {
  export class VirtualConsole {}
  export interface JsdomWindow {
    eval(code: string): void;
    document: import('axe-core').ElementContext;
    axe: {
      run(context?: import('axe-core').ElementContext): Promise<import('axe-core').AxeResults>;
    };
  }
  export class JSDOM {
    constructor(
      html?: string,
      options?: { runScripts?: 'outside-only' | 'dangerously'; virtualConsole?: VirtualConsole },
    );
    readonly window: JsdomWindow;
  }
}
