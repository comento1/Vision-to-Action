import { GoogleGenAI, Type } from "@google/genai";
import { ExecutiveTask, ProjectDefinition } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getAiCoaching(task: ExecutiveTask, currentStep: string, userInput: string) {
  const isIdeation = currentStep === "ideation";
  const stepInstruction = isIdeation
    ? `현재 단계는 "주제 도출(아이디에이션)"입니다. 팀장이 앞선 과제(리뷰·구체화) 경험을 바탕으로, 추가로 도출할 수 있는 주제를 찾고 있습니다.
      - "임원 도출 영역 내 추가 주제" 또는 "임원이 도출하지 않았으나 중요도가 높은 새 주제"를 함께 아이디에이션해 주세요.
      - 팀장의 질문(예: 어떤 주제들이 도출될 수 있을까요?)에 맞춰 구체적인 주제 제안, 도출 이유·기대 방향 예시를 제시하세요.
      - 제안한 주제는 왼쪽 폼에 직접 채워 넣을 수 있도록 한 줄 요약·이유·기대 변화 형태로 써 주세요.`
    : `다음 가이드라인에 따라 팀장에게 실무적이고 구체적인 피드백과 추천을 제공하세요:
      1. "Pragmatic Brilliance" 톤앤매너를 유지하세요 (전문적, 신뢰감, 실행 중심, 공감).
      2. 제공된 상세 데이터와 해석 내용을 바탕으로 맥락에 맞는 조언을 하세요.
      3. 정량적 지표(KPI)를 설정할 때 구체적인 수치 예시를 제안하세요.
      4. MVP 범위를 좁히는 현실적인 제안을 하세요.
      5. 위트 있는 리더십 메시지를 포함하세요.`;

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
      
      ${stepInstruction}
      
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
팀장이 '과제를 구체화하기 위해 과제 리뷰내용을 참고'하여, 생성형 AI를 기반으로 실제 구현 단계에 들어가기 전에 점검·구체화할 수 있도록 돕습니다.
리뷰 내용(아래 [과제 리뷰 참고 내용])을 각 질문에 맞게 활용하여, 팀장 관점에서 구체화·점검해야 할 항목이 충분히 구체적으로 드러나도록 가이드를 작성하세요.

[과제 정보]
- 과제명(희망 영역): ${task.expectedArea}
- 본부: ${task.department}

[과제 리뷰 참고 내용]
- 임원진이 개선을 희망하는 업무 영역(한줄요약): ${task.oneLineSummary}
- AI 적용이 필요한 이유(임원진 기대 맥락): ${task.reason}
- AI 적용 시 기대되는 워크플로우 예시: ${task.workflow}
- 팀장 관점 핵심 포인트: ${task.leaderKeyPoints}
- 현실적인 구현 범위(힌트): ${task.implementationScope}
- 구현 전 검토 사항: ${task.preReviewItems}
- 성공의 정의(평가 기준): ${task.successDefinition}
- 기대변화: ${task.expectedChange}
- 고려사항: ${task.considerations}

아래 5개 질문 각각에 대해, 위 리뷰 내용을 해당 질문에 맞게 발췌·가공하여 '작성 가이드'를 제시하세요.
- 팀장이 구현자(실무자)에게 인계할 때 쓸 수 있도록, 무엇을/어떻게 쓸지 구체적인 체크포인트·예시를 포함하세요.
- 생성형 AI로 실제 구현 단계를 앞둔 상황이므로, 팀장이 구체화·점검해야 할 항목이 빠짐없이 드러나도록 하세요.

질문:
q1: 임원이 제시한 문제상황은 왜 발생하는 것인가요? (AI 적용이 필요하다고 임원이 판단한 이유를 기반으로, 현업에서 그 이유가 왜 발생하는지 규명)
q2: 이 문제를 해결하기 위해 반드시 개선되어야 하는 것은 무엇입니까?
q3: 개선되어야 하는 과업이 AI를 기반으로 어떻게 변화되길 기대하십니까?
q4: 이 문제가 AI를 기반으로 성공적으로 해소/생산성이 향상되었다고 인정 받기 위해, 달성되어야 하거나, 구현된 결과물에 반드시 고려되어야 할 것은 무엇입니까?
q5: 구현 과정에서 구현자가 반드시 고려해야 할 사항은 무엇입니까? (특정 단계에서 상급자 컨펌, 준수 사항 등)
`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          q1: { type: Type.STRING },
          q2: { type: Type.STRING },
          q3: { type: Type.STRING },
          q4: { type: Type.STRING },
          q5: { type: Type.STRING },
        },
      },
    },
  });

  return JSON.parse(response.text || "{}") as { q1?: string; q2?: string; q3?: string; q4?: string; q5?: string };
}

/** 주제 도출 단계: 유형에 맞는 예시 문장 생성 (주제명, 도출 이유, AI 적용 시 기대 변화) */
export async function getIdeationExample(
  task: ExecutiveTask,
  topicType: "within" | "new"
): Promise<{ title: string; reason: string; expectedDirection: string }> {
  const typeLabel = topicType === "within" ? "임원이 도출한 영역 내에서 파생된 추가 주제" : "임원이 도출하지 않았으나 중요도가 높은 새 주제";
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
당신은 롯데웰푸드 AX 전략 보조입니다. 팀장이 "추가 주제 도출" 단계에서 참고할 예시 문장을 생성해 주세요.

[현재 과제 맥락]
- 과제(희망 영역): ${task.expectedArea}
- 본부: ${task.department}
- 한줄요약: ${task.oneLineSummary}
- 기대 이유: ${task.reason?.slice(0, 300)}
- 기대 변화: ${task.expectedChange?.slice(0, 300)}

생성할 주제 유형: ${typeLabel}

다음 3가지 필드에 들어갈 한국어 예시 문장을 각각 한 문단 이내로 작성해 주세요. 실무에 바로 참고할 수 있도록 구체적으로 작성합니다.
`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          reason: { type: Type.STRING },
          expectedDirection: { type: Type.STRING },
        },
      },
    },
  });

  const parsed = JSON.parse(response.text || "{}") as { title?: string; reason?: string; expectedDirection?: string };
  return {
    title: String(parsed.title ?? "").trim() || "예시를 불러오지 못했습니다.",
    reason: String(parsed.reason ?? "").trim() || "",
    expectedDirection: String(parsed.expectedDirection ?? "").trim() || "",
  };
}
