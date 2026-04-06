import fs from "node:fs";

const file = "docs/implementation/codex-kickoff-prompts.md";
console.log(fs.readFileSync(file, "utf8"));
