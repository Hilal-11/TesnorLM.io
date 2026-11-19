// Runs Vitest with an upper-case drive letter on Windows.
//
// When the cwd is "c:\..." (VS Code often opens folders that way), Vitest 5 loads two copies of its
// runner and every suite fails with "Cannot read properties of undefined (reading 'config')".
// Starting Vitest from "C:\..." avoids it. On Linux/macOS this is a plain pass-through.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const upperDrive = (p) => p.replace(/^[a-z]:/, (drive) => drive.toUpperCase());

const require = createRequire(import.meta.url);
const vitestDir = path.dirname(require.resolve("vitest/package.json"));
const cli = upperDrive(path.join(vitestDir, "vitest.mjs"));

const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: upperDrive(process.cwd()),
  stdio: "inherit",
});

process.exit(result.status ?? 1);
