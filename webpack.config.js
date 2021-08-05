/* eslint-env node */

/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { merge } = require("webpack-merge");

const sharedConfig = {
  mode: "production",
  optimization: {
    minimize: false,
  },
  performance: {
    hints: false,
  },
  devtool: false,
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"],
  },
  module: {
    rules: [
      {
        // Include ts, tsx, js, and jsx files.
        test: /\.(ts|js)x?$/,
        // exclude: /node_modules/,
        loader: require.resolve("babel-loader"),
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, require.resolve("css-loader")],
      },
    ],
  },
  plugins: [new MiniCssExtractPlugin()],
  externals: {
    "canadv.ash": "commonjs canadv.ash",
    kolmafia: "commonjs kolmafia",
  },
};

const scriptsConfig = merge(
  {
    entry: {
      garbo: "./src/index.ts",
      "garbo-combat": "./src/combat.ts",
    },
    output: {
      path: path.resolve(__dirname, "KoLmafia", "scripts", "garbage-collector"),
      filename: "[name].js",
      libraryTarget: "commonjs",
    },
  },
  sharedConfig
);

// handle the file creating the garbo UI html file
const otherRelayConfig = merge(
  {
    entry: "./src/relay_garbo.ts",
    output: {
      path: path.resolve(__dirname, "KoLmafia", "relay"),
      filename: "relay_garbo.js",
      libraryTarget: "commonjs",
    },
    module: {
      rules: [
        {
          // Include ts, tsx, js, and jsx files.
          test: /\.(ts|js)x?$/,
          // exclude: /node_modules/,
          loader: require.resolve("babel-loader"),
        },
      ],
    },
  },
  sharedConfig
);

// handle the react files used in the garbo html file
const relayConfig = merge(
  {
    entry: "./src/relay/index.tsx",
    output: {
      path: path.resolve(__dirname, "KoLmafia/relay/garbage-collector/"),
      filename: "garbage-collector.js",
      libraryTarget: "commonjs",
    },
    module: {
      rules: [
        {
          // Include ts, tsx, js, and jsx files.
          test: /\.(ts|js)x?$/,
          // exclude: /node_modules/,
          loader: require.resolve("babel-loader"),
          options: { presets: ["@babel/env", "@babel/preset-react"] },
        },
      ],
    },
  },
  sharedConfig
);

module.exports = [scriptsConfig, relayConfig, otherRelayConfig];
