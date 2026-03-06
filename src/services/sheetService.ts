import { ExecutiveTask } from "../types";
import { MOCK_TASKS } from "../constants";

const SHEET_API_URL = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SHEET_API_URL
  ? String(import.meta.env.VITE_SHEET_API_URL).trim()
  : "";

export interface UserProfile {
  org: string; // 소속 본부/조직
  name: string;
  title: string; // 직급
}

export interface SaveWrittenContentPayload {
  taskId: string;
  department: string;
  expectedArea: string;
  user: UserProfile;
  /** 보고서 확인 URL (최종 PDF/결과물 화면 링크) */
  pdfResultLink?: string;
  concretize: {
    q1: string;
    q2: string;
    q3: string;
    q4: string;
    q5: string;
    q6: string;
  };
}

export interface WrittenEntry {
  timestamp: string;
  userKey: string;
  userOrg: string;
  userName: string;
  userTitle: string;
  taskId: string;
  taskDepartment: string;
  expectedArea: string;
  /** 보고서 확인 URL (최종 PDF/결과물 화면 링크) */
  pdfResultLink?: string;
  concretize: {
    q1: string;
    q2: string;
    q3: string;
    q4: string;
    q5: string;
    q6: string;
  };
}

function ensureTaskArray(data: unknown): ExecutiveTask[] {
  if (Array.isArray(data)) return data as ExecutiveTask[];
  if (data && typeof data === "object" && "tasks" in data && Array.isArray((data as { tasks: unknown }).tasks)) {
    return (data as { tasks: ExecutiveTask[] }).tasks;
  }
  return [];
}

function ensureWrittenArray(data: unknown): WrittenEntry[] {
  if (Array.isArray(data)) return data as WrittenEntry[];
  if (data && typeof data === "object" && "items" in data && Array.isArray((data as { items: unknown }).items)) {
    return (data as { items: WrittenEntry[] }).items;
  }
  return [];
}

export function toUserKey(profile: UserProfile): string {
  return `${profile.org}|${profile.name}|${profile.title}`.trim();
}

export async function fetchTasks(): Promise<{ tasks: ExecutiveTask[]; isDemoMode: boolean }> {
  // 1) 서버 프록시 시도
  try {
    const response = await fetch("/api/tasks", { method: "GET", cache: "no-cache" });
    if (response.ok) {
      const data = await response.json();
      const tasks = ensureTaskArray(data);
      if (tasks.length > 0) return { tasks, isDemoMode: false };
    }
  } catch (e) {
    console.warn("Proxy /api/tasks failed, trying direct sheet URL.");
  }

  // 2) 구글 시트 URL 직접 호출 (Vercel 등 프록시 없을 때)
  if (SHEET_API_URL) {
    try {
      const response = await fetch(SHEET_API_URL, { method: "GET", cache: "no-cache" });
      if (response.ok) {
        const data = await response.json();
        const tasks = ensureTaskArray(data);
        if (tasks.length > 0) return { tasks, isDemoMode: false };
      }
    } catch (e) {
      console.warn("Direct sheet fetch failed:", e);
    }
  }

  return { tasks: MOCK_TASKS, isDemoMode: true };
}

/** 웹에서 작성한 내용을 구글 시트 "작성내용" 시트에 저장 */
export async function saveWrittenContent(
  payload: SaveWrittenContentPayload
): Promise<{ success: boolean; error?: string }> {
  const body = JSON.stringify(payload);
  const opts = { method: "POST" as const, headers: { "Content-Type": "application/json" }, body };

  // 1) 서버 프록시 시도
  try {
    const response = await fetch("/api/save", opts);
    const data = await response.json().catch(() => ({}));
    if (response.ok) return { success: true };
    return { success: false, error: (data as { error?: string }).error || "저장 실패" };
  } catch (_) {
    // 2) 프록시 없으면 구글 시트 URL로 직접 POST (Vercel 등)
    if (!SHEET_API_URL) {
      return { success: false, error: "시트 연동 URL이 설정되지 않았습니다." };
    }
    try {
      const response = await fetch(SHEET_API_URL, opts);
      const data = await response.json().catch(() => ({}));
      if (response.ok && !(data as { error?: string }).error) return { success: true };
      return { success: false, error: (data as { error?: string }).error || "저장 실패" };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }
}

/** 동일 사용자(본부/이름/직급)의 기존 작성내용 조회 */
export async function fetchWrittenContents(
  profile: UserProfile
): Promise<{ items: WrittenEntry[]; error?: string }> {
  const userKey = encodeURIComponent(toUserKey(profile));

  // 1) Vercel/로컬 API 라우트 시도
  try {
    const res = await fetch(`/api/written?userKey=${userKey}`, { method: "GET", cache: "no-cache" });
    if (res.ok) {
      const data = await res.json();
      return { items: ensureWrittenArray(data) };
    }
  } catch (_) {
    // ignore
  }

  // 2) 직접 호출 (CORS 환경에 따라 실패할 수 있음)
  if (!SHEET_API_URL) return { items: [], error: "시트 연동 URL이 설정되지 않았습니다." };
  try {
    const url = `${SHEET_API_URL}?type=written&userKey=${userKey}`;
    const res = await fetch(url, { method: "GET", cache: "no-cache" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { items: [], error: (data as { error?: string }).error || "조회 실패" };
    return { items: ensureWrittenArray(data) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { items: [], error: msg };
  }
}
