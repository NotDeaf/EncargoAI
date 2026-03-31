// Fallback JSX definitions to satisfy TS when react types aren't picked up.
// Replace with @types/react and proper tsconfig jsx settings for full typing.
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
