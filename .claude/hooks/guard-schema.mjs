// PreToolUse hook: schema changes ripple through every API route, so ask before editing the Prisma schema.
import { readFileSync } from "node:fs";

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8")); } catch {}

const file = String(input.tool_input?.file_path || "").replace(/\\/g, "/");
if (file.endsWith("prisma/schema.prisma")) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: "prisma/schema.prisma affects the database and every API route. Confirm this schema change.",
    },
  }));
}
process.exit(0);
