import { build } from "esbuild";
import { copyFileSync } from "fs";

const watch = process.argv.includes("--watch");

const opts = {
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "cjs",
    platform: "browser",
    target: ["es2020"],
    outfile: "index.js",
    // SiYuan provides require("siyuan") at runtime.
    external: ["siyuan"],
    banner: { js: "/* Fussy_Fran v0.1.0 */" },
    define: {},
};

if (watch) {
    await build({ ...opts });
    console.log("built index.js (watch mode: rerun on change manually)");
} else {
    await build({ ...opts });
    console.log("built index.js");
}
try {
    copyFileSync("src/styles.css", "index.css");
    console.log("copied src/styles.css -> index.css");
} catch (e) {
    console.error("css copy failed", e);
}
