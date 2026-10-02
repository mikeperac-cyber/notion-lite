// PostToolUse hook: after a .ts/.tsx edit, run the type checker and feed any errors back to Claude (exit 2).
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8")); } catch {}

const file = String(input.tool_input?.file_path || "");
if (!/\.tsx?$/.test(file) || file.includes("node_modules")) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
if (!existsSync(tsc)) process.exit(0);

const result = spawnSync(process.execPath, [tsc, "--noEmit", "--pretty", "false"], { cwd: root, encoding: "utf8", timeout: 120000 });
if (result.error || result.status === 0) process.exit(0);

const lines = `${result.stdout || ""}${result.stderr || ""}`.split("\n").filter(line => line.trim()).slice(0, 30);
console.error(`TypeScript errors after editing ${path.basename(file)}:\n${lines.join("\n")}`);
process.exit(2);
