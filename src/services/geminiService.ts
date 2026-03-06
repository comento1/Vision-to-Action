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

export async function getConcretizeGuides(task: ExecutiveTask) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
당신은 롯데웰푸드의 AX(AI Transformation) 실무 가이드 작성자입니다.
팀장이 임원 리뷰 내용을 바탕으로 '구현자(실무자)에게 인계 가능한 수준'으로 과제를 구체화하도록 돕습니다.

[과제 정보]
- 과제명(희망 영역): ${task.expectedArea}
- 본부: ${task.department}

[임원 요약]
${task.oneLineSummary}

[리뷰 참고 내용]
- 기대이유: ${task.reason}
- 기대변화: ${task.expectedChange}
- 고려사항: ${task.considerations}
- 워크플로우: ${task.workflow}
- 팀장 관점 포인트: ${task.leaderKeyPoints}
- 탐색 질문: ${task.explorationQuestions}
- 구현 범위(힌트): ${task.implementationScope}
- 구현 전 검토 사항: ${task.preReviewItems}
- 성공 정의: ${task.successDefinition}

아래 5개 질문 각각에 대해, 팀장이 작성할 때 참고할 수 있는 가이드를 3~5개의 불릿으로 작성하세요.
- 가이드는 '무엇을/어떻게'를 명확히 제시하고, 구체적인 예시/체크포인트를 포함하세요.
- 회사 내부 용어는 과도하게 어렵지 않게, 실무자가 바로 이해할 수 있게 쓰세요.

질문:
q1: 개선하고자 하는 대상 과업을 현재는 어떻게 수행하고 있는지 정리해 주세요.
q2: 현재의 수행방식으로 인해 발생된 병목 및 비효율은 무엇인가요?
q4: 병목 및 비효율이 AI 기반으로 어떻게 해소되길 기대하십니까?
q5: 이 문제가 성공적으로 해소되었다고 판단하기 위해 무엇이 달성되거나, 구현된 결과물에 포함되어 있어야 합니까?
q6: 구현 과정에서 고려해야 할 혹은 예상되는 어려움은 무엇인가요?
`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          q1: { type: Type.STRING },
          q2: { type: Type.STRING },
          q4: { type: Type.STRING },
          q5: { type: Type.STRING },
          q6: { type: Type.STRING },
        },
      },
    },
  });

  return JSON.parse(response.text || "{}") as { q1?: string; q2?: string; q4?: string; q5?: string; q6?: string };
}
