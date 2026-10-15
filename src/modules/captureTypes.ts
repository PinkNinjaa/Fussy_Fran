export type CaptureStatus = "unsorted" | "processed";
export type CaptureTargetType = "database" | "page" | "inbox";
export type QuickCaptureTarget = CaptureTargetType | "daily" | "zettel";

export interface CaptureItem {
    id: string;
    content: string;
    createdAt: number;
    sourceUrl?: string;
    tags: string[];
    status: CaptureStatus;
    targetType: CaptureTargetType;
    targetId: string;
}

export interface FavoriteTarget {
    id: string;
    name: string;
}

export interface RecentTarget {
    type: "database" | "page";
    id: string;
    name: string;
}

export interface QuickCaptureConfig {
    zettelNotebook: string;
    zettelPath: string;
    dailyNotebook: string;
    hotkey: string;
    inboxDocumentId: string;
    favoriteDatabases: FavoriteTarget[];
    favoritePages: FavoriteTarget[];
    recentTargets: RecentTarget[];
    defaultTarget: QuickCaptureTarget;
}