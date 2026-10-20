import { build } from "esbuild";
import {
    copyFileSync,
    mkdirSync,
    rmSync,
    cpSync,
    existsSync,
    readdirSync,
} from "fs";
import { join, resolve } from "path";

const TARGET_PLUGIN_DIR = "C:\\Users\\SalesTTNZ\\Documents\\fran\\data\\plugins\\Fussy_Fran";

const PLUGIN_FILES = [
    "plugin.json",
    "index.js",
    "index.css",
    "icon.png",
    "preview.png",
    "README.md",
];

async function buildPlugin() {
    console.log("Building plugin...");
    await build({
        entryPoints: ["src/index.ts"],
        bundle: true,
        format: "cjs",
        platform: "browser",
        target: ["es2020"],
        outfile: "index.js",
        external: ["siyuan"],
        banner: { js: "/* Fussy_Fran */" },
        logLevel: "info",
    });
    console.log("Built index.js");

    // Copy CSS
    copyFileSync("src/styles.css", "index.css");
    console.log("Copied src/styles.css -> index.css");
}

function copyPluginToTarget() {
    console.log(`\nDeploying to ${TARGET_PLUGIN_DIR}...`);

    // Remove existing plugin directory
    if (existsSync(TARGET_PLUGIN_DIR)) {
        rmSync(TARGET_PLUGIN_DIR, { recursive: true, force: true });
        console.log("Removed existing plugin directory");
    }

    // Create fresh directory
    mkdirSync(TARGET_PLUGIN_DIR, { recursive: true });

    // Copy main plugin files
    for (const file of PLUGIN_FILES) {
        if (existsSync(file)) {
            copyFileSync(file, join(TARGET_PLUGIN_DIR, file));
            console.log(`Copied ${file}`);
        } else {
            console.warn(`Warning: ${file} not found, skipping`);
        }
    }

    // Copy i18n directory
    const i18nSrc = "i18n";
    const i18nDest = join(TARGET_PLUGIN_DIR, "i18n");
    if (existsSync(i18nSrc)) {
        cpSync(i18nSrc, i18nDest, { recursive: true });
        console.log("Copied i18n/ directory");
    }

    console.log("\n✅ Plugin deployed successfully!");
    console.log(`   Location: ${TARGET_PLUGIN_DIR}`);
}

async function main() {
    try {
        await buildPlugin();
        copyPluginToTarget();
    } catch (err) {
        console.error("❌ Test deployment failed:", err);
        process.exit(1);
    }
}

main();