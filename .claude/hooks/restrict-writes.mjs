// PreToolUse hook: blocks Write/Edit calls whose target is outside the allowed directories.
// Usage: node restrict-writes.mjs <allowedDirectory> [<allowedDirectory>...]  (relative to the project root)
import path from "node:path";

const allowedDirectories = process.argv.slice(2);
const projectRoot = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

function isInsideDirectory(targetPath, directory) {
  const relativePath = path.relative(path.resolve(projectRoot, directory), targetPath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

let rawInput = "";
for await (const chunk of process.stdin) {
  rawInput += chunk;
}

function readTargetFilePath(hookInput) {
  try {
    return JSON.parse(hookInput)?.tool_input?.file_path;
  } catch {
    return undefined;
  }
}

const targetFilePath = readTargetFilePath(rawInput);

if (typeof targetFilePath !== "string") {
  console.error("Blocked: the tool call has no file_path to check.");
  process.exit(2);
}

const resolvedTargetPath = path.resolve(projectRoot, targetFilePath);

if (!allowedDirectories.some((directory) => isInsideDirectory(resolvedTargetPath, directory))) {
  console.error(`Blocked: this agent may only write inside: ${allowedDirectories.join(", ")}.`);
  process.exit(2);
}
