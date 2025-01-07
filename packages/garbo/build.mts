/* eslint-env node */
import esbuild, { Plugin } from "esbuild";
import babel from "esbuild-plugin-babel";

const watch = process.argv.some((arg) => ["--watch", "-w"].includes(arg));

const context = await esbuild.context({
  bundle: true,
  platform: "node",
  target: "rhino1.7.15",
  external: ["kolmafia"],
  define: {
    "process.env.GITHUB_SHA": `"${
      process.env?.["GITHUB_SHA"] ?? "CustomBuild"
    }"`,
    "process.env.GITHUB_REF_NAME": `"${
      process.env?.["GITHUB_REF_NAME"] ?? "CustomBuild"
    }"`,
    "process.env.GITHUB_REPOSITORY": `"${
      process.env?.["GITHUB_REPOSITORY"] ?? "CustomBuild"
    }"`,
  },
  entryPoints: {
    "scripts/garbage-collector/garbo": "src/index.ts",
    "scripts/garbage-collector/garbo_choice": "src/garboChoice.ts",
    "relay/relay_garbo": "src/relay_garbo.ts",
  },
  entryNames: "[dir]/[name]",
  outdir: "dist",
  plugins: [babel() as Plugin],
});

await context.rebuild();

if (watch) {
  await context.watch();
} else {
  context.dispose();
}
