const createConfig = require("./create-config.cjs");

module.exports = (_env, argv) =>
  createConfig({
    mode: argv.mode || "development",
    name: "requesterApp",
    filename: "remoteEntry.js",
    exposes: { "./RequesterRoutes": "./src/requester/RequesterRoutes.tsx" },
    entry: "src/requester/index.ts",
    outputDirectory: "requester",
    port: 3001,
    title: "AMM - Solicitante",
  });
