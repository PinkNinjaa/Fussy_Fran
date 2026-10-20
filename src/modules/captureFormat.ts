// Formatting helpers for preset captures: timestamps, task lists, and
// dynamic text templates.
import type { CapturePreset } from "./captureTypes";

export const DEFAULT_TIMESTAMP_FORMAT = "DD-MM-YY HH:mm";
export const DEFAULT_TEMPLATE = "{text}";

export interface TemplateContext {
    text: string;
    title: string;
    date: string;
    time: string;
    datetime: string;
    tags: string;
    source: string;
    created: string;
    createdDate: string;
    createdTime: string;
    preset: string;
    target: string;
    parent: string;
}

/** Extra values available to templates when a capture is routed/sent. */
export interface TemplateExtras {
    /** Capture creation time (falls back to the send time). */
    created?: Date;
    /** Preset name applying the format. */
    preset?: string;
    /** Destination page/database name. */
    target?: string;
    /** Full path of the original page the capture came from. */
    parent?: string;
}

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

/** Format a date using the supported tokens: YYYY YY MM DD HH mm ss. */
export function formatTimestamp(date: Date, format: string = DEFAULT_TIMESTAMP_FORMAT): string {
    const pattern = normalizeTimestampFormat(format);
    const values: Record<string, string> = {
        YYYY: String(date.getFullYear()),
        YY: String(date.getFullYear()).slice(-2),
        MM: pad2(date.getMonth() + 1),
        DD: pad2(date.getDate()),
        HH: pad2(date.getHours()),
        mm: pad2(date.getMinutes()),
        ss: pad2(date.getSeconds()),
    };
    return pattern.replace(/YYYY|YY|MM|DD|HH|mm|ss/g, token => values[token] ?? token);
}

/** Normalize user input, accepting lower-case date-only patterns such as dd-mm-yy. */
export function normalizeTimestampFormat(value: string): string {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return DEFAULT_TIMESTAMP_FORMAT;
    if (!/[Hh]/.test(trimmed)) return trimmed.toUpperCase();
    return trimmed;
}

export function buildTemplateContext(
    text: string,
    tags: string[],
    sourceUrl: string,
    date: Date = new Date(),
    timestampFormat: string = DEFAULT_TIMESTAMP_FORMAT,
    extras: TemplateExtras = {},
): TemplateContext {
    const clean = text.trim();
    const title = clean.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? "";
    const created = extras.created ?? date;
    return {
        text: clean,
        title,
        date: formatTimestamp(date, "DD-MM-YY"),
        time: formatTimestamp(date, "HH:mm"),
        datetime: formatTimestamp(date, timestampFormat),
        tags: tags.map(tag => `#${tag}#`).join(" "),
        source: sourceUrl.trim(),
        created: formatTimestamp(created, timestampFormat),
        createdDate: formatTimestamp(created, "DD-MM-YY"),
        createdTime: formatTimestamp(created, "HH:mm"),
        preset: extras.preset ?? "",
        target: extras.target ?? "",
        parent: extras.parent ?? "",
    };
}

const TEMPLATE_TOKENS = [
    "text", "title", "date", "time", "datetime", "tags", "source",
    "created", "createdDate", "createdTime", "preset", "target", "parent",
] as const;

export function applyTemplate(template: string, context: TemplateContext): string {
    const source = (template ?? "").trim() || DEFAULT_TEMPLATE;
    return source.replace(
        new RegExp(`\\{(${TEMPLATE_TOKENS.join("|")})\\}`, "g"),
        (_match, key: string) => (context as unknown as Record<string, string>)[key] ?? _match,
    );
}

/** True when a custom template already renders tags, so they should not be appended twice. */
export function presetUsesTags(preset: CapturePreset): boolean {
    return preset.contentMode === "custom" && /\{tags\}/.test(preset.template || "");
}

/**
 * Build the content for a preset before it is written to a destination.
 * Task mode creates one checkbox item per non-empty line, optionally with a
 * timestamp prefix. Bullet mode creates one bullet per line. Custom mode
 * applies the template exactly once.
 */
export function buildPresetContent(
    preset: CapturePreset,
    text: string,
    tags: string[],
    sourceUrl: string,
    date: Date = new Date(),
    extras: TemplateExtras = {},
): string {
    const clean = text.trim();

    if (preset.contentMode === "task") {
        const stamp = preset.timestamp ? formatTimestamp(date, preset.timestampFormat) : "";
        return clean.split(/\r?\n/).map(line => {
            const value = line.trim();
            return value ? `- [ ] ${stamp ? `${stamp} ` : ""}${value}` : "";
        }).join("\n");
    }

    if (preset.contentMode === "bullet") {
        return clean.split(/\r?\n/).map(line => {
            const value = line.trim();
            return value ? `- ${value}` : "";
        }).join("\n");
    }

    if (preset.contentMode === "custom") {
        const rendered = applyTemplate(
            preset.template,
            buildTemplateContext(clean, tags, sourceUrl, date, preset.timestampFormat, extras),
        );
        return rendered.trim() ? rendered : clean;
    }

    return clean;
}

/** Friendly starter templates offered by the preset editor. */
export interface PresetTemplateStarter {
    id: string;
    template: string;
}

export const PRESET_TEMPLATE_STARTERS: PresetTemplateStarter[] = [
    { id: "blank", template: DEFAULT_TEMPLATE },
    { id: "task", template: "- [ ] {datetime} {text}" },
    { id: "note", template: "## {title}\n\n{text}\n\n{tags}" },
    { id: "journal", template: "### {created}\n\n{text}\n\n{source}" },
    { id: "meeting", template: "## {title}\n\n- Date: {date}\n- Source: {source}\n\n{text}" },
];
