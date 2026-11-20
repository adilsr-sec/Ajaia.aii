import { spawn } from "node:child_process";
import path from "node:path";

const rawArgs = process.argv.slice(2);
const mode = rawArgs[0] === "start" ? "start" : "dev";
const rest = rawArgs[0] === "start" || rawArgs[0] === "dev" ? rawArgs.slice(1) : rawArgs;

let port = process.env.PORT || "3000";
let hostname = "0.0.0.0";

for (let i = 0; i < rest.length; i++) {
  const arg = rest[i];
  if (arg === "--port" || arg === "-p") {
    if (rest[i + 1]) {
      port = rest[i + 1];
      i++;
    }
  } else if (arg.startsWith("--port=")) {
    port = arg.slice("--port=".length);
  } else if (arg === "--host" || arg === "--hostname" || arg === "-H") {
    if (rest[i + 1] && !rest[i + 1].startsWith("-")) {
      hostname = rest[i + 1];
      i++;
    } else {
      hostname = "0.0.0.0";
    }
  } else if (arg.startsWith("--host=")) {
    hostname = arg.slice("--host=".length);
  } else if (arg.startsWith("--hostname=")) {
    hostname = arg.slice("--hostname=".length);
  }
}

const nextBin = path.resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);

const child = spawn(nextBin, [mode, "-p", port, "-H", hostname], {
  stdio: "inherit",
  env: process.env,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
