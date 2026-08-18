const path = require("node:path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { DefinePlugin, container } = require("webpack");

const { ModuleFederationPlugin } = container;
const projectRoot = path.resolve(__dirname, "..");

module.exports = function createConfig(options) {
  const isProduction = options.mode === "production";

  return {
    mode: options.mode,
    entry: path.join(projectRoot, options.entry),
    output: {
      path: path.join(projectRoot, "dist", options.outputDirectory),
      filename: "[name].[contenthash].js",
      clean: true,
      publicPath: "auto",
    },
    devtool: isProduction ? "source-map" : "eval-cheap-module-source-map",
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "ts-loader",
            options: { transpileOnly: true },
          },
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [
      new ModuleFederationPlugin({
        name: options.name,
        filename: options.filename,
        exposes: options.exposes,
        remotes: options.remotes,
        shared: {
          react: { singleton: true, requiredVersion: "18.3.1" },
          "react-dom": { singleton: true, requiredVersion: "18.3.1" },
          "react-router-dom": { singleton: true, requiredVersion: "7.18.2" },
        },
      }),
      new DefinePlugin({
        __APP_API_MODE__: JSON.stringify(process.env.APP_API_MODE || "mock"),
        __APP_API_URL__: JSON.stringify(process.env.APP_API_URL || "/api"),
      }),
      new HtmlWebpackPlugin({
        title: options.title,
        template: path.join(projectRoot, "src", "index.html"),
      }),
    ],
    devServer: {
      port: options.port,
      historyApiFallback: true,
      headers: { "Access-Control-Allow-Origin": "*" },
      hot: true,
    },
    optimization: {
      runtimeChunk: false,
    },
  };
};
