#!/usr/bin/env node

console.log("🔍 Environment Variables:");
console.log("TERM_PROGRAM:", process.env.TERM_PROGRAM);
console.log("VSCODE_PID:", process.env.VSCODE_PID);
console.log("VSCODE_INJECTION:", process.env.VSCODE_INJECTION);
console.log("CURSOR_PID:", process.env.CURSOR_PID);
console.log("");

console.log('🔍 All environment variables containing "cursor" or "vscode":');
Object.keys(process.env)
  .filter(
    (key) =>
      key.toLowerCase().includes("cursor") ||
      key.toLowerCase().includes("vscode")
  )
  .forEach((key) => {
    console.log(`${key}:`, process.env[key]);
  });

console.log("");
console.log("🔍 PATH:");
console.log(process.env.PATH);
