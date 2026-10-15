import { build, context } from "esbuild";
import { copyFileSync, watch as fsWatch } from "fs";

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
    banner: { js: "/* Fussy_Fran */" },
    logLevel: "info",
};

const copyCss = () => {
    try {
        copyFileSync("src/styles.css", "index.css");
        console.log("copied src/styles.css -> index.css");
    } catch (e) {
        console.error("css copy failed", e);
    }
};

if (watch) {
    const ctx = await context(opts);
    await ctx.watch();
    copyCss();
    // styles.css -> index.css is a plain copy; keep it in sync on rebuild.
    fsWatch("src/styles.css", { persistent: true }, () => copyCss());
    console.log("watching src/ ... (Ctrl+C to stop)");
} else {
    await build(opts);
    console.log("built index.js");
    copyCss();
}
