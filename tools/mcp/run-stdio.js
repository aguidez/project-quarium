// Shared bit of the MCP launchers: runs the real MCP server with this process' stdin / stdout (the MCP stdio
// channel) and mirrors its exit. Nothing may be printed on stdout here; errors go to stderr.
const { spawn } = require("child_process");

function fail(message) {
	process.stderr.write(`[mcp launcher] ${message}\n`);
	process.exit(1);
}

/** Starts `command args` on the inherited stdio and exits with it. `.bat` / `.cmd` files go through cmd.exe. */
function runStdio(command, args = [], env = process.env) {
	let child;
	if (process.platform === "win32" && /\.(bat|cmd)$/i.test(command)) {
		// cmd.exe /s /c ""<path with spaces>" args": the quoting Node itself uses for shell commands.
		const line = [`"${command}"`, ...args.map((a) => `"${a}"`)].join(" ");
		child = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `"${line}"`], {
			stdio: "inherit",
			env,
			windowsVerbatimArguments: true,
		});
	} else {
		child = spawn(command, args, { stdio: "inherit", env });
	}
	child.on("error", (err) => fail(`cannot start ${command}: ${err.message}`));
	child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
	for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
		process.on(sig, () => child.kill(sig));
	}
}

module.exports = { runStdio, fail };
