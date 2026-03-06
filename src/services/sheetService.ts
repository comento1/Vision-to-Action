import { ExecutiveTask } from "../types";
import { MOCK_TASKS } from "../constants";

export interface SaveWrittenContentPayload {
  taskId: string;
  department: string;
  expectedArea: string;
  concretize: {
    q1: string;
    q2: string;
    q3: string;
    q4: string;
    q5: string;
    q6: string;
  };
}

export async function fetchTasks(): Promise<{ tasks: ExecutiveTask[]; isDemoMode: boolean }> {
  try {
    const response = await fetch("/api/tasks", {
      method: "GET",
      cache: "no-cache",
    });

    if (!response.ok) {
      console.warn(`Server proxy returned status ${response.status}. Using mock data.`);
      return { tasks: MOCK_TASKS, isDemoMode: true };
    }

    const data = await response.json();

    if (data.error) {
      console.error("Proxy API Error:", data.error);
      return { tasks: MOCK_TASKS, isDemoMode: true };
    }

    return { tasks: data as ExecutiveTask[], isDemoMode: false };
  } catch (error: unknown) {
    console.error("Error fetching tasks via proxy:", error);
    return { tasks: MOCK_TASKS, isDemoMode: true };
  }
}

/** 웹에서 작성한 내용을 구글 시트 "작성내용" 시트에 저장 */
export async function saveWrittenContent(
  payload: SaveWrittenContentPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: (data as { error?: string }).error || "저장 실패" };
    }
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}
