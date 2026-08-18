const createConfig = require("./create-config.cjs");

module.exports = (_env, argv) =>
  createConfig({
    mode: argv.mode || "development",
    name: "shellApp",
    entry: "src/shell/index.ts",
    outputDirectory: "shell",
    port: 3000,
    title: "AMM - Aprobación de compras",
    remotes: {
      requesterApp: `requesterApp@${process.env.REQUESTER_REMOTE_URL || "http://localhost:3001/remoteEntry.js"}`,
      approverApp: `approverApp@${process.env.APPROVER_REMOTE_URL || "http://localhost:3002/remoteEntry.js"}`,
    },
  });
