const createConfig = require("./create-config.cjs");

module.exports = (_env, argv) =>
  createConfig({
    mode: argv.mode || "development",
    name: "approverApp",
    filename: "remoteEntry.js",
    exposes: { "./ApproverRoutes": "./src/approver/ApproverRoutes.tsx" },
    entry: "src/approver/index.ts",
    outputDirectory: "approver",
    port: 3002,
    title: "AMM - Aprobador",
  });
