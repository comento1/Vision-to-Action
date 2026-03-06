export type Department = string;

export interface ExecutiveTask {
  id: string;
  department: Department;
  priority: string;
  expectedArea: string;
  reason: string;
  expectedChange: string;
  executingOrg: string;
  considerations: string;
  oneLineSummary: string;
  workflow: string;
  leaderKeyPoints: string;
  explorationQuestions: string;
  implementationScope: string;
  preReviewItems: string;
  successDefinition: string;
  // Categorized for UI grouping
  coreData: {
    [key: string]: string;
  };
  interpretationData: {
    [key: string]: string;
  };
  allData: {
    [key: string]: any;
  };
}

export interface ProjectDefinition {
  taskId: string;
  painPointDetail: string;
  currentHours: number;
  targetKpiQuant: string;
  targetKpiQual: string;
  mvpScope: string;
  collaborators: string[];
  securityChecks: {
    externalInstall: boolean;
    dataMasking: boolean;
    logicValidation: boolean;
  };
  successDefinition: string;
}

/** 구체화(Concretize) 단계 6개 질문 답안 */
export interface ConcretizeForm {
  q1: string; // 대상 과업의 현재 수행방식(워크플로우) 정리하기
  q2: string; // 현재의 수행방식으로 인해 발생된 현상과 Root Cause 도출/ 정의하기
  q3: string; // 과업의 Root Cause를 해소하기 위해 무엇을 바꿔야 하는가?
  q4: string; // Root Cause가 AI를 기반으로 해소된 모습 그려보기
  q5: string; // 후속 과정에서 구현될 솔루션은 핵심적으로 어떤 요소를 포함하고 있어야 하는가?
  q6: string; // 구현 과정에서 고려해야 할 혹은 예상되는 어려움은 무엇인가?
}

export interface MockData {
  tasks: ExecutiveTask[];
}
