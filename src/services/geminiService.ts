import { GoogleGenAI, Type } from "@google/genai";
import { ExecutiveTask, ProjectDefinition } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getAiCoaching(task: ExecutiveTask, currentStep: string, userInput: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      당신은 롯데웰푸드의 AX(AI Transformation) 전략 코치입니다. 
      팀장이 임원의 비전을 구체적인 프로젝트로 전환하는 것을 돕고 있습니다.
      
      현재 과제: ${task.expectedArea}
      부문: ${task.department}
      
      [임원진 비전 요약]
      ${task.oneLineSummary}
      
      [상세 맥락]
      - 기대이유: ${task.reason}
      - 기대변화: ${task.expectedChange}
      - 고려사항: ${task.considerations}
      - 워크플로우: ${task.workflow}
      - 팀장 관점 포인트: ${task.leaderKeyPoints}
      
      현재 단계: ${currentStep}
      팀장의 입력: ${userInput}
      
      다음 가이드라인에 따라 팀장에게 실무적이고 구체적인 피드백과 추천을 제공하세요:
      1. "Pragmatic Brilliance" 톤앤매너를 유지하세요 (전문적, 신뢰감, 실행 중심, 공감).
      2. 제공된 상세 데이터와 해석 내용을 바탕으로 맥락에 맞는 조언을 하세요.
      3. 정량적 지표(KPI)를 설정할 때 구체적인 수치 예시를 제안하세요.
      4. MVP 범위를 좁히는 현실적인 제안을 하세요.
      5. 위트 있는 리더십 메시지를 포함하세요.
      
      응답은 마크다운 형식으로 작성하세요.
    `,
  });

  return response.text;
}

export async function suggestKpis(task: ExecutiveTask) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      과제 "${task.expectedArea}"에 대해 팀장이 설정할 수 있는 구체적인 KPI(정량/정성) 3가지를 추천해줘.
      
      [과제 맥락]
      - 한줄요약: ${task.oneLineSummary}
      - 기대변화: ${task.expectedChange}
      - 성공정의: ${task.successDefinition}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          quantitative: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          qualitative: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
