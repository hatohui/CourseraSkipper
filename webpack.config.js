const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    "background/service-worker": "./extension/background/service-worker.ts",
    "content/content-script": "./extension/content/content-script.ts",
    "popup/popup": "./extension/popup/popup.ts",
    "options/options": "./extension/options/options.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@feats": path.resolve(__dirname, "./feats"),
      "@types": path.resolve(__dirname, "./types"),
      "@utils": path.resolve(__dirname, "./extension/utils"),
    },
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "extension/manifest.json", to: "manifest.json" },
        { from: "extension/popup/popup.html", to: "popup/popup.html" },
        { from: "extension/popup/popup.css", to: "popup/popup.css" },
        { from: "extension/options/options.html", to: "options/options.html" },
        { from: "extension/options/options.css", to: "options/options.css" },
        {
          from: "extension/content/content-styles.css",
          to: "content/content-styles.css",
        },
        { from: "extension/assets", to: "assets" },
      ],
    }),
  ],
  devtool: "source-map",
};
