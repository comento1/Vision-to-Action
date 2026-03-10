import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Target, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  ArrowRight, 
  ChevronRight, 
  Clock, 
  ShieldCheck, 
  Users,
  Download,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  PenLine,
  Lightbulb,
  Plus,
  Trash2
} from 'lucide-react';
import { MOCK_TASKS } from './constants';
import { ExecutiveTask, ProjectDefinition, Department, ConcretizeForm, DerivedTopic } from './types';
import { cn, bulletToNumbered } from './lib/utils';
import Markdown from 'react-markdown';
import { getAiCoaching, suggestKpis, getConcretizeGuides } from './services/geminiService';
import { fetchTasks, saveWrittenContent, fetchWrittenContents, toUserKey, type UserProfile, type WrittenEntry } from './services/sheetService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type Step = 'dashboard' | 'review' | 'concretize' | 'ideation' | 'export';

const LOTTE_LOGO = "https://potens-box.s3.ap-northeast-2.amazonaws.com/IMG%2F%EB%A1%AF%EB%8D%B0%EC%9B%B0%ED%91%B8%EB%93%9C.png";

export default function App() {
  const [currentStep, setCurrentStep] = useState<Step>('dashboard');
  const [tasks, setTasks] = useState<ExecutiveTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ExecutiveTask | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>('전체');
  const [profile, setProfile] = useState<UserProfile>({ org: '', name: '', title: '' });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(true);
  const [writtenEntries, setWrittenEntries] = useState<WrittenEntry[]>([]);
  const [isWrittenModalOpen, setIsWrittenModalOpen] = useState(false);
  const [writtenLoadError, setWrittenLoadError] = useState<string>('');
  const [definition, setDefinition] = useState<ProjectDefinition>({
    taskId: '',
    painPointDetail: '',
    currentHours: 0,
    targetKpiQuant: '',
    targetKpiQual: '',
    mvpScope: '',
    collaborators: [],
    securityChecks: {
      externalInstall: false,
      dataMasking: true,
      logicValidation: true,
    },
    successDefinition: '',
  });

  const [aiCoaching, setAiCoaching] = useState<string>('');
  const [suggestedKpis, setSuggestedKpis] = useState<{ quantitative: string[], qualitative: string[] }>({ quantitative: [], qualitative: [] });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [concretizeGuides, setConcretizeGuides] = useState<{ q1?: string; q2?: string; q3?: string; q4?: string; q5?: string }>({});
  const [concretize, setConcretize] = useState<ConcretizeForm>({
    q1: '', q2: '', q3: '', q4: '', q5: '', q6: '',
  });
  const [concretizeChatQuestionIndex, setConcretizeChatQuestionIndex] = useState<number | null>(null);
  const [concretizeChatInput, setConcretizeChatInput] = useState('');
  const [concretizeChatReply, setConcretizeChatReply] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isGuideLoading, setIsGuideLoading] = useState(false);
  /** 추가 도출 주제 (최소 1개, 구체화 이후 단계) */
  const [derivedTopics, setDerivedTopics] = useState<DerivedTopic[]>([
    { id: 'topic-0', title: '', reason: '', expectedDirection: '', topicType: 'within' },
  ]);

  const formatGuideText = (text: string) => {
    const t = String(text || "").trim();
    if (!t) return "";
    // 긴 문단을 보기 좋게: 번호/불릿 시작 전 줄바꿈을 보강
    return t
      .replace(/\r\n/g, "\n")
      .replace(/\n(?=\d+\))/g, "\n\n")
      .replace(/\n(?=\[\d+\])/g, "\n\n")
      .replace(/\n(?=\d+\.)/g, "\n\n")
      .replace(/\n(?=-\s)/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // 시트에 저장된 PDF 결과물 링크(?report=1&taskId=xxx)로 접근 시 해당 과제 Export 화면으로 진입
  useEffect(() => {
    if (typeof window === 'undefined' || tasks.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('report') !== '1') return;
    const taskId = params.get('taskId');
    if (!taskId) return;
    const task = tasks.find((t) => t.id === decodeURIComponent(taskId));
    if (task) {
      setSelectedTask(task);
      setCurrentStep('export');
    }
  }, [tasks]);

  useEffect(() => {
    const loadGuides = async () => {
      if (currentStep !== 'concretize' || !selectedTask) return;
      setIsGuideLoading(true);
      try {
        const guides = await getConcretizeGuides(selectedTask);
        setConcretizeGuides(guides || {});
      } catch (e) {
        console.error('Guide generation error:', e);
      } finally {
        setIsGuideLoading(false);
      }
    };
    loadGuides();
  }, [currentStep, selectedTask]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  useEffect(() => {
    setDerivedTopics([{ id: 'topic-0', title: '', reason: '', expectedDirection: '', topicType: 'within' }]);
  }, [selectedTask?.id]);

  // 대시보드 진입 시 작성 내역 미리 로드 → 버튼 조건부 표시 및 클릭 시 즉시 모달
  const hasProfile = Boolean(profile.org?.trim() && profile.name?.trim() && profile.title?.trim());
  useEffect(() => {
    if (currentStep !== 'dashboard' || !hasProfile) return;
    loadWrittenEntries(profile);
  }, [currentStep, profile.org, profile.name, profile.title]);

  const loadTasks = async () => {
    setIsLoadingTasks(true);
    const result = await fetchTasks();
    setTasks(result.tasks);
    setIsLoadingTasks(false);
  };

  const departments = ['전체', ...Array.from(new Set(tasks.map(t => t.department)))];

  const filteredTasks = departmentFilter === '전체' 
    ? tasks 
    : tasks.filter(t => t.department === departmentFilter);

  const handleTaskSelect = (task: ExecutiveTask) => {
    setSelectedTask(task);
    setDefinition(prev => ({ ...prev, taskId: task.id }));
    setCurrentStep('review');
  };

  const loadWrittenEntries = async (p: UserProfile) => {
    const hasProfile = p.org?.trim() && p.name?.trim() && p.title?.trim();
    if (!hasProfile) {
      setWrittenEntries([]);
      return;
    }
    setWrittenLoadError('');
    const result = await fetchWrittenContents(p);
    if (result.error) setWrittenLoadError(result.error);
    // 서버/Apps Script에서 userKey로 필터링된 결과만 내려오는 것이 정상이므로, 클라이언트에서 2중 필터링하지 않음
    setWrittenEntries(result.items || []);
  };

  /** WrittenEntry만으로 최소 ExecutiveTask 생성 (과제 목록에 없을 때 수정 단계 진입용) */
  const entryToTask = (entry: WrittenEntry): ExecutiveTask => ({
    id: entry.taskId,
    department: entry.taskDepartment || '',
    priority: '',
    expectedArea: entry.expectedArea || '',
    reason: '',
    expectedChange: '',
    executingOrg: '',
    considerations: '',
    oneLineSummary: '',
    workflow: '',
    leaderKeyPoints: '',
    explorationQuestions: '',
    implementationScope: '',
    preReviewItems: '',
    successDefinition: '',
    coreData: {},
    interpretationData: {},
    allData: {},
  });

  const selectWrittenEntry = (entry: WrittenEntry) => {
    const task = tasks.find((t) => t.id === entry.taskId) || entryToTask(entry);
    setSelectedTask(task);
    setDepartmentFilter('전체');
    setConcretize({
      q1: entry.concretize.q1 || '',
      q2: entry.concretize.q2 || '',
      q3: entry.concretize.q3 || '',
      q4: entry.concretize.q4 || '',
      q5: entry.concretize.q5 || entry.concretize.q6 || '',
      q6: '',
    });
    setCurrentStep('concretize');
    setIsWrittenModalOpen(false);
  };

  const handleGoToExport = async () => {
    if (!selectedTask) return;
    setSaveStatus('saving');
    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname || '/'}` : '';
    const reportLink = base ? `${base}?report=1&taskId=${encodeURIComponent(selectedTask.id)}` : '';
    const result = await saveWrittenContent({
      taskId: selectedTask.id,
      department: selectedTask.department,
      expectedArea: selectedTask.expectedArea,
      user: profile,
      pdfResultLink: reportLink,
      concretize: {
        q1: concretize.q1,
        q2: concretize.q2,
        q3: concretize.q3,
        q4: concretize.q4,
        q5: concretize.q5,
        q6: '',
      },
    });
    setSaveStatus(result.success ? 'saved' : 'error');
    setCurrentStep('export');
    if (profile.org && profile.name && profile.title) {
      await loadWrittenEntries(profile);
    }
  };

  const handleAiCoaching = async (stepName: string, input: string) => {
    if (!selectedTask || !input) return;
    setIsAiLoading(true);
    try {
      const coaching = await getAiCoaching(selectedTask, stepName, input);
      setAiCoaching(coaching || '');
    } catch (error) {
      console.error('AI Coaching Error:', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const fetchKpiSuggestions = async () => {
    if (!selectedTask) return;
    setIsAiLoading(true);
    try {
      const suggestions = await suggestKpis(selectedTask);
      setSuggestedKpis(suggestions);
    } catch (error) {
      console.error('KPI Suggestion Error:', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const exportToPDF = async () => {
    const element = document.getElementById("report-content");
    if (!element) return;

    const makeColorNormalizer = () => {
      if (typeof document === "undefined") return { normalize: (v: string) => v, cleanup: () => {} };
      const tmp = document.createElement("div");
      tmp.style.position = "fixed";
      tmp.style.left = "-99999px";
      tmp.style.top = "-99999px";
      tmp.style.width = "1px";
      tmp.style.height = "1px";
      document.body.appendChild(tmp);
      const toRgb = (prop: "color" | "backgroundColor" | "borderColor", val: string) => {
        try {
          // 브라우저가 지원하는 색상(oklch 등)을 rgb로 정규화
          (tmp.style as any)[prop] = "";
          (tmp.style as any)[prop] = val;
          const computed = getComputedStyle(tmp) as any;
          const out = String(computed[prop] || "");
          return out || val;
        } catch {
          return val;
        }
      };
      return {
        normalize: (val: string, kind: "color" | "backgroundColor" | "borderColor") => toRgb(kind, val),
        cleanup: () => {
          try { tmp.remove(); } catch {}
        },
      };
    };

    const inlineComputedColors = (root: HTMLElement) => {
      const touched: Array<{ el: HTMLElement; prevStyle: string | null }> = [];
      const apply = (el: HTMLElement) => {
        touched.push({ el, prevStyle: el.getAttribute("style") });
        const cs = window.getComputedStyle(el);
        const normalizer = makeColorNormalizer();
        const color = normalizer.normalize(cs.color, "color");
        const bg = normalizer.normalize(cs.backgroundColor, "backgroundColor");
        const borderTop = normalizer.normalize(cs.borderTopColor, "borderColor");
        const borderRight = normalizer.normalize(cs.borderRightColor, "borderColor");
        const borderBottom = normalizer.normalize(cs.borderBottomColor, "borderColor");
        const borderLeft = normalizer.normalize(cs.borderLeftColor, "borderColor");
        normalizer.cleanup();
        el.style.setProperty("color", color);
        el.style.setProperty("background-color", bg);
        el.style.setProperty("border-top-color", borderTop);
        el.style.setProperty("border-right-color", borderRight);
        el.style.setProperty("border-bottom-color", borderBottom);
        el.style.setProperty("border-left-color", borderLeft);
      };
      apply(root);
      root.querySelectorAll<HTMLElement>("*").forEach(apply);
      return () => {
        // 원본 DOM 스타일 복구
        for (const t of touched) {
          if (t.prevStyle === null) t.el.removeAttribute("style");
          else t.el.setAttribute("style", t.prevStyle);
        }
      };
    };

    const pdfSafeCss = `
      .pdf-safe, .pdf-safe * { box-shadow: none !important; text-shadow: none !important; }
      .pdf-safe { background-color: #ffffff !important; color: #0f172a !important; }
      .pdf-safe .bg-slate-900, .pdf-safe [class*="bg-slate-900"] { background-color: #0f172a !important; color: #e2e8f0 !important; }
      .pdf-safe .bg-slate-50, .pdf-safe [class*="bg-slate-50"] { background-color: #f8fafc !important; }
      .pdf-safe .bg-gray-100, .pdf-safe [class*="bg-gray-100"] { background-color: #f3f4f6 !important; }
      .pdf-safe .bg-white { background-color: #ffffff !important; }
      .pdf-safe .text-slate-900, .pdf-safe [class*="text-slate-900"] { color: #0f172a !important; }
      .pdf-safe .text-slate-800 { color: #1e293b !important; }
      .pdf-safe .text-slate-700 { color: #334155 !important; }
      .pdf-safe .text-slate-600 { color: #475569 !important; }
      .pdf-safe .text-slate-500 { color: #64748b !important; }
      .pdf-safe .text-slate-400 { color: #94a3b8 !important; }
      .pdf-safe .text-slate-300 { color: #cbd5e1 !important; }
      .pdf-safe .text-emerald-600 { color: #059669 !important; }
      .pdf-safe .border-slate-100, .pdf-safe .border-gray-100 { border-color: #e2e8f0 !important; }
    `;

    const safeHex: Record<string, string> = {
      "bg-slate-900": "#0f172a", "bg-slate-50": "#f8fafc", "bg-gray-100": "#f3f4f6", "bg-white": "#ffffff",
      "text-slate-900": "#0f172a", "text-slate-800": "#1e293b", "text-slate-700": "#334155", "text-slate-600": "#475569",
      "text-slate-500": "#64748b", "text-slate-400": "#94a3b8", "text-slate-300": "#cbd5e1", "text-emerald-600": "#059669",
      "border-slate-100": "#e2e8f0", "border-gray-100": "#f3f4f6",
    };
    const forceHexInClone = (el: HTMLElement) => {
      const cls = String(el.className || "");
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("text-shadow", "none", "important");
      for (const [key, hex] of Object.entries(safeHex)) {
        if (cls.includes(key)) {
          if (key.startsWith("bg-")) el.style.setProperty("background-color", hex, "important");
          else if (key.startsWith("text-")) el.style.setProperty("color", hex, "important");
          else if (key.startsWith("border-")) el.style.setProperty("border-color", hex, "important");
        }
      }
      if (cls.includes("bg-slate-900")) el.style.setProperty("color", "#e2e8f0", "important");
      Array.from(el.children).forEach((c) => c instanceof HTMLElement && forceHexInClone(c));
    };
    const stripOklchInClone = (el: HTMLElement) => {
      const s = el.style;
      if (s.color && /oklch|lab|lch/.test(s.color)) s.setProperty("color", "#0f172a", "important");
      if (s.backgroundColor && /oklch|lab|lch/.test(s.backgroundColor)) s.setProperty("background-color", "#ffffff", "important");
      if (s.borderColor && /oklch|lab|lch/.test(s.borderColor)) s.setProperty("border-color", "#e2e8f0", "important");
      el.querySelectorAll<HTMLElement>("*").forEach(stripOklchInClone);
    };

    try {
      const restore = inlineComputedColors(element as HTMLElement);
      try {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          height: element.scrollHeight,
          windowHeight: element.scrollHeight,
          onclone: (_doc, clonedEl) => {
            const style = _doc.createElement("style");
            style.textContent = pdfSafeCss;
            _doc.head.appendChild(style);
            const root = clonedEl as HTMLElement;
            root.style.setProperty("color", "#0f172a");
            root.style.setProperty("background-color", "#ffffff");
            root.style.height = `${element.scrollHeight}px`;
            root.style.minHeight = `${element.scrollHeight}px`;
            forceHexInClone(root);
            stripOklchInClone(root);
          },
        });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfPageHeight = pdf.internal.pageSize.getHeight();
        const totalImgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        const numPages = Math.max(1, Math.ceil(totalImgHeight / pdfPageHeight));
        for (let p = 0; p < numPages; p++) {
          if (p > 0) pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, -p * pdfPageHeight, pdfWidth, totalImgHeight);
        }
        pdf.save(`VisionToAction_Report_${selectedTask?.id}.pdf`);
      } finally {
        restore();
      }
    } catch (err) {
      console.error("PDF export failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (typeof window !== "undefined") {
        const usePrint = window.confirm(
          `PDF 생성 중 오류가 발생했습니다. 브라우저에서 인쇄(Ctrl+P) 후 "PDF로 저장"을 선택해 주세요. 인쇄 창을 지금 열까요?`
        );
        if (usePrint) window.print();
      }
    }
  };

  const openPrintForPdf = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#212529] font-sans">
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 p-8">
            <h2 className="text-2xl font-black text-slate-900 mb-2">접속 정보 입력</h2>
            <p className="text-slate-500 text-sm font-medium mb-6">작성 내용을 구현자(실무자)에게 인계할 수 있도록, 아래 정보를 입력해 주세요.</p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">소속 본부</label>
                <input
                  value={profile.org}
                  onChange={(e) => setProfile(prev => ({ ...prev, org: e.target.value }))}
                  placeholder="예: 글로벌사업본부"
                  className="w-full p-4 rounded-2xl border border-slate-200 focus:border-[#ED1C24] outline-none font-medium"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">이름</label>
                  <input
                    value={profile.name}
                    onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="예: 홍길동"
                    className="w-full p-4 rounded-2xl border border-slate-200 focus:border-[#ED1C24] outline-none font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">직급</label>
                  <input
                    value={profile.title}
                    onChange={(e) => setProfile(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="예: 팀장"
                    className="w-full p-4 rounded-2xl border border-slate-200 focus:border-[#ED1C24] outline-none font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={async () => {
                  if (!profile.org.trim() || !profile.name.trim() || !profile.title.trim()) return;
                  setIsProfileModalOpen(false);
                  await loadWrittenEntries(profile);
                }}
                disabled={!profile.org.trim() || !profile.name.trim() || !profile.title.trim()}
                className="px-6 py-3 rounded-2xl bg-[#ED1C24] text-white font-black disabled:opacity-40"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {isWrittenModalOpen && (
        <div className="fixed inset-0 z-[998] bg-black/50 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 mb-1">기존 작성내용 확인하기</h2>
                <p className="text-slate-500 text-sm font-medium">접속 시 입력한 소속·이름·직급 기준으로 본인이 작성한 내용만 표시됩니다. 항목을 선택하면 구체화(수정) 단계로 이동해 이어서 수정할 수 있습니다.</p>
              </div>
              <button
                onClick={() => setIsWrittenModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            {writtenLoadError && (
              <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-sm font-bold">
                {writtenLoadError}
              </div>
            )}

            <div className="mt-6 space-y-3 max-h-[55vh] overflow-auto pr-1">
              {writtenEntries.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 text-slate-600 text-sm font-bold">
                  저장된 작성내용이 없습니다.
                </div>
              ) : (
                writtenEntries
                  .slice()
                  .reverse()
                  .map((entry, idx) => (
                    <button
                      key={`${entry.taskId}-${idx}`}
                      onClick={() => selectWrittenEntry(entry)}
                      className="w-full text-left p-5 rounded-2xl border border-slate-100 hover:border-[#ED1C24]/30 hover:bg-red-50/20 transition-all"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-black text-slate-900">{entry.expectedArea || entry.taskId}</div>
                          <div className="text-xs font-bold text-slate-500 mt-1">{entry.taskDepartment}</div>
                        </div>
                        <div className="text-xs font-mono font-bold text-slate-400">{entry.taskId}</div>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-6">
          <img 
            src={LOTTE_LOGO} 
            alt="Lotte Wellfood" 
            className="h-8 object-contain"
            referrerPolicy="no-referrer"
          />
          <div className="h-6 w-px bg-gray-200" />
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-[#ED1C24]">Vision to Action</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">AX Strategy Builder</p>
            </div>
          </div>
        </div>
        
        <nav className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
          {(['dashboard', 'review', 'concretize', 'ideation', 'export'] as Step[]).map((step, idx) => {
            const stepLabels: Record<Step, string> = {
              dashboard: 'Dashboard',
              review: 'Review',
              concretize: 'Concretize',
              ideation: '주제 도출',
              export: 'Export',
            };
            return (
              <button
                key={step}
                onClick={() => selectedTask && setCurrentStep(step)}
                disabled={!selectedTask && step !== 'dashboard'}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2",
                  currentStep === step 
                    ? "bg-[#ED1C24] text-white shadow-md shadow-red-200" 
                    : "text-gray-400 hover:text-gray-600 disabled:opacity-30"
                )}
              >
                <span className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0",
                  currentStep === step ? "bg-white/20" : "bg-gray-200"
                )}>{idx + 1}</span>
                {stepLabels[step]}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        <AnimatePresence mode="wait">
          {currentStep === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              <div className="flex items-center justify-end gap-4">
                {writtenEntries.length > 0 && (
                  <button
                    onClick={() => setIsWrittenModalOpen(true)}
                    className="shrink-0 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition-all flex items-center gap-2"
                  >
                    <FileText size={18} />
                    기존 작성 내용 확인하기
                  </button>
                )}
              </div>
              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-[#ED1C24] rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100">
                    <Sparkles size={12} /> Executive Vision Bridge
                  </div>
                  <h2 className="text-5xl font-black tracking-tighter text-slate-900 leading-none">본부별 <span className="text-[#ED1C24]">AI 활용 영역</span> 대시보드</h2>
                  <p className="text-slate-600 text-lg max-w-2xl font-medium leading-relaxed whitespace-pre-line">
                    본부별로 임원진이 도출한 AI 활용 희망 영역을 한눈에 보고, 팀에서 구체화할 과제를 선택합니다.
                    그후 우리 본부 내에서 구현할 과제를 선택한 뒤 다음 단계(임원진 비전 리뷰)로 진행하세요.
                  </p>
                </div>
                {/* 부제 하단: 구글 시트 A열 기준 전체 본부 선택 버튼 */}
                <div className="flex flex-wrap items-center gap-2 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                  {departments.map(dept => (
                    <button
                      key={dept}
                      onClick={() => setDepartmentFilter(dept)}
                      className={cn(
                        "px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                        departmentFilter === dept 
                          ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                          : "text-slate-400 hover:bg-gray-50 hover:text-slate-600"
                      )}
                    >
                      {dept}
                    </button>
                  ))}
                  <button 
                    onClick={loadTasks}
                    className="p-2.5 rounded-xl text-slate-400 hover:bg-gray-50 hover:text-[#ED1C24] transition-all ml-auto"
                    title="새로고침"
                  >
                    <RefreshCw size={20} className={isLoadingTasks ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {isLoadingTasks ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="bg-white rounded-3xl p-8 h-64 animate-pulse border border-gray-100 shadow-sm" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredTasks.map((task, taskIndex) => (
                    <motion.div
                      key={task.id}
                      whileHover={{ y: -8, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleTaskSelect(task)}
                      className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 cursor-pointer hover:border-[#ED1C24]/30 hover:shadow-2xl hover:shadow-red-500/5 transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <TrendingUp size={120} className="text-[#ED1C24]" />
                      </div>
                      
                      <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="flex gap-2">
                          <span className="px-4 py-1.5 bg-slate-50 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100">
                            {task.department}
                          </span>
                          <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black border border-slate-200">
                            #{taskIndex + 1}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-300">{task.id}</span>
                      </div>
                      
                      {/* 상단: 과제 소개(간단 식별), 하단: AI 적용 기대 영역(상대적으로 길 수 있음) */}
                      <h3 className="text-2xl font-black leading-tight mb-4 text-slate-900 group-hover:text-[#ED1C24] transition-colors relative z-10 whitespace-pre-wrap">
                        {task.oneLineSummary}
                      </h3>
                      
                      <p className="text-slate-500 text-sm leading-relaxed mb-8 line-clamp-3 font-medium relative z-10 whitespace-pre-wrap">
                        {task.expectedArea}
                      </p>
                      
                      <div className="flex items-center justify-between pt-6 border-t border-gray-50 relative z-10">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                          <Target size={14} /> 임원 기대 영역
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#ED1C24] group-hover:text-white group-hover:rotate-45 transition-all duration-500">
                          <ArrowRight size={20} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {currentStep === 'review' && selectedTask && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="space-y-10"
            >
              <div className="bg-white rounded-[3rem] p-12 shadow-xl shadow-slate-200/50 border border-gray-100">
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#ED1C24] shadow-inner">
                    <Target size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black tracking-tighter text-slate-900">임원진 비전 리뷰</h2>
                    <p className="text-slate-500 font-bold text-sm mt-2 leading-relaxed max-w-2xl">
                      선택한 과제에 대해 임원진이 작성한 내용과 AI 검토 내용을 좌우로 비교하며 확인합니다. 전략 구체화 단계로 진행해 주세요.
                    </p>
                  </div>
                </div>

                {/* 좌(임원 작성) vs 우(AI 검토) 헤더 - 시선 유도 강조 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="rounded-2xl border-2 border-[#ED1C24]/40 bg-red-50/50 p-6 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-[#ED1C24]/15 flex items-center justify-center shrink-0">
                      <PenLine className="w-6 h-6 text-[#ED1C24]" />
                    </div>
                    <p className="text-base md:text-lg font-extrabold text-[#ED1C24] tracking-tight leading-snug">임원진이 실제로 작성해 주신 내용입니다.</p>
                  </div>
                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/80 p-6 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-slate-200/80 flex items-center justify-center shrink-0">
                      <Sparkles className="w-6 h-6 text-slate-600" />
                    </div>
                    <p className="text-base md:text-lg font-extrabold text-slate-700 tracking-tight leading-snug">임원진이 작성한 내용을 AI로 검토한 내용입니다.</p>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* 1단: AI를 적용하고 싶은 업무/영역 | 임원진이 개선을 희망하는 업무 영역 */}
                  <section className="rounded-[2rem] border border-slate-200 bg-slate-50/30 p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-white rounded-2xl border-2 border-[#ED1C24]/20 shadow-md">
                        <h4 className="text-sm font-black text-[#ED1C24] tracking-tight mb-3">AI를 적용하고 싶은 업무/영역</h4>
                        <p className="text-slate-800 text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedTask.expectedArea}</p>
                      </div>
                      <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm opacity-95">
                        <h4 className="text-sm font-black text-slate-600 tracking-tight mb-3">임원진이 개선을 희망하는 업무 영역</h4>
                        <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedTask.oneLineSummary}</p>
                      </div>
                    </div>
                  </section>

                  {/* 2단: AI 적용이 필요한 이유 (전체 폭) */}
                  <section className="rounded-[2rem] border border-slate-200 bg-slate-50/30 p-6 md:p-8">
                    <div className="p-6 bg-white rounded-2xl border-2 border-[#ED1C24]/20 shadow-md">
                      <h4 className="text-sm font-black text-[#ED1C24] tracking-tight mb-3">AI 적용이 필요한 이유</h4>
                      <p className="text-slate-800 text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedTask.reason}</p>
                    </div>
                  </section>

                  {/* 3단: AI 적용 후 기대하는 변화 | AI 적용 시 기대되는 전체 워크플로우 예시 + Tip 팀장 관점 핵심 포인트 */}
                  <section className="rounded-[2rem] border border-slate-200 bg-slate-50/30 p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-white rounded-2xl border-2 border-[#ED1C24]/20 shadow-md">
                        <h4 className="text-sm font-black text-[#ED1C24] tracking-tight mb-3">AI 적용 후 기대하는 변화</h4>
                        <p className="text-slate-800 text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedTask.expectedChange}</p>
                      </div>
                      <div className="space-y-4">
                        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                          <h4 className="text-sm font-black text-slate-600 tracking-tight mb-3">AI 적용 시 기대되는 전체 워크플로우 예시</h4>
                          <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{bulletToNumbered(selectedTask.workflow)}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                          <p className="text-xs font-black text-amber-800 uppercase tracking-widest mb-2">Tip · 팀장 관점 핵심 포인트</p>
                          <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{bulletToNumbered(selectedTask.leaderKeyPoints)}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* 4단: 구현 시 고려해야 할 사항 | 구현 전 검토 사항 */}
                  <section className="rounded-[2rem] border border-slate-200 bg-slate-50/30 p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-white rounded-2xl border-2 border-[#ED1C24]/20 shadow-md">
                        <h4 className="text-sm font-black text-[#ED1C24] tracking-tight mb-3">구현 시 고려해야 할 사항</h4>
                        <p className="text-slate-800 text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedTask.considerations}</p>
                      </div>
                      <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <h4 className="text-sm font-black text-slate-600 tracking-tight mb-3">구현 전 검토 사항</h4>
                        <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{bulletToNumbered(selectedTask.preReviewItems)}</p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="mt-16 flex justify-end">
                  <button
                    onClick={() => setCurrentStep('concretize')}
                    className="px-10 py-5 bg-[#ED1C24] text-white rounded-2xl font-black text-lg flex items-center gap-3 hover:bg-[#D11920] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-red-500/20"
                  >
                    전략 구체화 시작하기 <ChevronRight size={24} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 'concretize' && selectedTask && (
            <motion.div
              key="concretize"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-10"
            >
              <div className="lg:col-span-2 space-y-10">
                <div className="bg-white rounded-[3rem] p-12 shadow-xl shadow-slate-200/50 border border-gray-100">
                  <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#ED1C24] shadow-inner">
                        <FileText size={32} />
                      </div>
                      <div>
                        <h2 className="text-4xl font-black tracking-tighter text-slate-900">과제 구체화</h2>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Strategy Concretization</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {saveStatus === 'saving' && <span className="text-xs font-bold text-slate-500">저장 중…</span>}
                      {saveStatus === 'saved' && <span className="text-xs font-bold text-emerald-600">저장 완료</span>}
                      {saveStatus === 'error' && <span className="text-xs font-bold text-red-600">저장 실패</span>}
                    </div>
                  </div>

                  <p className="text-slate-600 text-sm font-medium mb-8 leading-relaxed border-l-4 border-[#ED1C24] pl-5 py-2">
                    임원진이 제시한 AI 적용 희망 영역을 바탕으로, 과제를 구현할 구현자가 구현을 시작할 수 있도록 구체화 하는 단계입니다.
                    아래 5가지 질문에 답하며 해소되어야 할 근본 원인을 규명하고, 개선 방향을 구체화 해 주세요.
                  </p>

                  <div className="space-y-10">
                    {[
                      { num: 1, key: 'q1', title: '임원이 제시한 문제상황은 왜 발생하는 것인가요?', value: concretize.q1, onChange: (v: string) => setConcretize(prev => ({ ...prev, q1: v })), guideText: concretizeGuides.q1 || '', sub: 'AI 적용이 필요하다고 임원이 판단한 이유를 기반으로, 현업에서 그 이유가 왜 발생하는지 규명해 주세요.' },
                      { num: 2, key: 'q2', title: '이 문제를 해결하기 위해 반드시 개선되어야 하는 것은 무엇입니까?', value: concretize.q2, onChange: (v: string) => setConcretize(prev => ({ ...prev, q2: v })), guideText: concretizeGuides.q2 || '', sub: '' },
                      { num: 3, key: 'q3', title: '개선되어야 하는 과업이 AI를 기반으로 어떻게 변화되길 기대하십니까?', value: concretize.q3, onChange: (v: string) => setConcretize(prev => ({ ...prev, q3: v })), guideText: concretizeGuides.q3 || '', sub: '' },
                      { num: 4, key: 'q4', title: '이 문제가 AI를 기반으로 성공적으로 해소/생산성이 향상되었다고 인정 받기 위해, 달성되어야 하거나, 구현된 결과물에 반드시 고려되어야 할 것은 무엇입니까?', value: concretize.q4, onChange: (v: string) => setConcretize(prev => ({ ...prev, q4: v })), guideText: concretizeGuides.q4 || '', sub: '' },
                      { num: 5, key: 'q5', title: '구현 과정에서 구현자가 반드시 고려해야 할 사항은 무엇입니까?', value: concretize.q5, onChange: (v: string) => setConcretize(prev => ({ ...prev, q5: v })), guideText: concretizeGuides.q5 || '', sub: '특정 단계에서 상급자 컨펌, 준수 사항 등을 포함해 주세요.' },
                    ].map(({ num, title, value, onChange, guideText, sub }, idx) => (
                      <section key={num} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-[#ED1C24] text-white flex items-center justify-center text-sm font-black">{num}</div>
                          <div>
                            <h3 className="text-lg font-black text-slate-800">{title}</h3>
                            {sub ? <p className="text-slate-500 text-xs font-medium mt-1">{sub}</p> : null}
                          </div>
                        </div>
                        <div className="mb-4 p-4 bg-white rounded-xl border border-slate-100">
                          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">작성 가이드</p>
                          <div className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{formatGuideText(guideText) || (isGuideLoading ? '가이드를 생성 중입니다…' : '가이드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')}</div>
                        </div>
                        <textarea
                          value={value}
                          onChange={(e) => onChange(e.target.value)}
                          placeholder="구현자가 바로 이해할 수 있도록 구체적으로 작성해 주세요."
                          className="w-full min-h-[100px] p-4 bg-white rounded-xl border border-slate-200 focus:border-[#ED1C24] focus:ring-2 focus:ring-red-100 outline-none text-sm font-medium leading-relaxed transition-all"
                        />
                      </section>
                    ))}
                  </div>

                  <div className="mt-14 flex justify-between items-center">
                    <button onClick={() => setCurrentStep('review')} className="px-6 py-3 text-slate-500 font-bold rounded-xl hover:bg-slate-100 transition-all">이전</button>
                    <button
                      onClick={() => setCurrentStep('ideation')}
                      className="px-10 py-5 bg-[#ED1C24] text-white rounded-2xl font-black text-lg flex items-center gap-3 hover:bg-[#D11920] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-red-500/20"
                    >
                      다음: 추가 주제 도출 <ChevronRight size={24} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 sticky top-32">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-[#ED1C24]"><Sparkles size={20} /> 각 질문에 대해 AI의 도움을 받을 수 있습니다</h3>
                  <p className="text-slate-300 text-xs font-medium mb-4">어떤 질문이든 입력해 보세요. 맥락을 지정하면 토큰을 아끼며 더 정확한 피드백을 받을 수 있습니다.</p>
                  <div className="space-y-4">
                    <label className="block text-slate-400 text-xs font-bold">보다 특화하여 논의를 원하는 경우 질문을 선택해 주세요.</label>
                    <select
                      value={concretizeChatQuestionIndex === null ? '' : concretizeChatQuestionIndex}
                      onChange={(e) => setConcretizeChatQuestionIndex(e.target.value === '' ? null : Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-white border border-white/20 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#ED1C24]"
                    >
                      <option value="">선택 안 함</option>
                      {[
                        '임원이 제시한 문제상황은 왜 발생하는 것인가요?',
                        '이 문제를 해결하기 위해 반드시 개선되어야 하는 것은 무엇입니까?',
                        '개선되어야 하는 과업이 AI를 기반으로 어떻게 변화되길 기대하십니까?',
                        '이 문제가 AI를 기반으로 성공적으로 해소/생산성이 향상되었다고 인정 받기 위해, 달성되어야 하거나, 구현된 결과물에 반드시 고려되어야 할 것은 무엇입니까?',
                        '구현 과정에서 구현자가 반드시 고려해야 할 사항은 무엇입니까?',
                      ].map((q, i) => (
                        <option key={i} value={i}>{q}</option>
                      ))}
                    </select>
                    <textarea
                      value={concretizeChatInput}
                      onChange={(e) => setConcretizeChatInput(e.target.value)}
                      placeholder="질문에 대한 생각이나 초안을 입력하면 AI가 피드백을 드립니다."
                      className="w-full min-h-[80px] p-3 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ED1C24]"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!concretizeChatInput.trim() || selectedTask == null) return;
                        setIsAiLoading(true);
                        setConcretizeChatReply('');
                        try {
                          const stepName = concretizeChatQuestionIndex !== null ? `concretize_q${concretizeChatQuestionIndex + 1}` : 'concretize_general';
                          const reply = await getAiCoaching(selectedTask, stepName, concretizeChatInput);
                          setConcretizeChatReply(reply || '');
                        } catch (e) {
                          setConcretizeChatReply('응답을 불러오지 못했습니다. 다시 시도해 주세요.');
                        } finally {
                          setIsAiLoading(false);
                        }
                      }}
                      disabled={isAiLoading || !concretizeChatInput.trim()}
                      className="w-full py-2.5 rounded-xl bg-[#ED1C24] text-white text-sm font-black disabled:opacity-50"
                    >
                      {isAiLoading ? '응답 생성 중…' : 'AI에게 질문하기'}
                    </button>
                    {concretizeChatReply ? (
                      <div className="p-4 rounded-xl bg-white/10 border border-white/20 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                        <Markdown>{concretizeChatReply}</Markdown>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 'ideation' && selectedTask && (
            <motion.div
              key="ideation"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="space-y-10"
            >
              <div className="bg-white rounded-[3rem] p-12 shadow-xl shadow-slate-200/50 border border-gray-100">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-600 shadow-inner">
                    <Lightbulb size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black tracking-tighter text-slate-900">추가 주제 도출</h2>
                    <p className="text-slate-500 font-bold text-sm mt-2 leading-relaxed max-w-3xl">
                      임원진이 도출한 영역을 리뷰·구체화한 경험을 바탕으로, 추가로 도출하고 싶은 주제를 적어 주세요.
                      <br />
                      <span className="text-slate-600">임원 도출 영역 내 추가 주제</span> 또는 <span className="text-slate-600">임원이 도출하지 않았으나 중요도가 높다고 판단되는 새 주제</span>를 최소 1개 이상 입력해 주세요.
                    </p>
                  </div>
                </div>

                <div className="space-y-8">
                  {derivedTopics.map((topic, idx) => (
                    <section
                      key={topic.id}
                      className="rounded-[2rem] border-2 border-slate-200 bg-slate-50/40 p-6 md:p-8 relative"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <span className="text-sm font-black text-slate-500 uppercase tracking-widest">주제 #{idx + 1}</span>
                        {derivedTopics.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setDerivedTopics(prev => prev.filter(t => t.id !== topic.id))}
                            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                            title="이 주제 삭제"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">주제명 (한 줄 요약) *</label>
                          <input
                            value={topic.title}
                            onChange={e => setDerivedTopics(prev => prev.map(t => t.id === topic.id ? { ...t, title: e.target.value } : t))}
                            placeholder="예: 해외법인 실적 데이터 자동 수집 및 대시보드 연동"
                            className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-[#ED1C24] outline-none font-medium text-slate-800"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">이 주제를 도출한 이유 (앞선 과제와의 연관성 또는 중요도) *</label>
                          <textarea
                            value={topic.reason}
                            onChange={e => setDerivedTopics(prev => prev.map(t => t.id === topic.id ? { ...t, reason: e.target.value } : t))}
                            placeholder="예: 앞서 구체화한 ‘실적 데이터 정합성’ 과제와 연계되며, 동일 데이터 소스에서 활용 범위를 넓히는 주제입니다."
                            className="w-full min-h-[80px] p-4 rounded-xl border-2 border-slate-200 focus:border-[#ED1C24] outline-none font-medium text-slate-800 resize-y"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">AI 적용 시 기대하는 방향 *</label>
                          <textarea
                            value={topic.expectedDirection}
                            onChange={e => setDerivedTopics(prev => prev.map(t => t.id === topic.id ? { ...t, expectedDirection: e.target.value } : t))}
                            placeholder="예: 수작업 엑셀 정리 대신 API/스케줄 기반 자동 수집 후 대시보드에 반영되어 의사결정 속도가 빨라지는 것."
                            className="w-full min-h-[80px] p-4 rounded-xl border-2 border-slate-200 focus:border-[#ED1C24] outline-none font-medium text-slate-800 resize-y"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">유형</label>
                          <select
                            value={topic.topicType}
                            onChange={e => setDerivedTopics(prev => prev.map(t => t.id === topic.id ? { ...t, topicType: e.target.value as 'within' | 'new' } : t))}
                            className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-[#ED1C24] outline-none font-medium text-slate-800"
                          >
                            <option value="within">임원 도출 영역 내 추가 주제</option>
                            <option value="new">임원이 도출하지 않은 새 주제</option>
                          </select>
                        </div>
                      </div>
                    </section>
                  ))}

                  <button
                    type="button"
                    onClick={() => setDerivedTopics(prev => [...prev, {
                      id: `topic-${Date.now()}`,
                      title: '',
                      reason: '',
                      expectedDirection: '',
                      topicType: 'within',
                    }])}
                    className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 font-bold flex items-center justify-center gap-2 hover:border-[#ED1C24] hover:text-[#ED1C24] hover:bg-red-50/30 transition-all"
                  >
                    <Plus size={20} /> 주제 추가
                  </button>
                </div>

                <div className="mt-14 flex justify-between items-center">
                  <button
                    onClick={() => setCurrentStep('concretize')}
                    className="px-6 py-3 text-slate-500 font-bold rounded-xl hover:bg-slate-100 transition-all"
                  >
                    이전
                  </button>
                  <button
                    onClick={handleGoToExport}
                    disabled={!derivedTopics.some(t => t.title.trim().length > 0)}
                    className={cn(
                      "px-10 py-5 rounded-2xl font-black text-lg flex items-center gap-3 transition-all shadow-xl",
                      derivedTopics.some(t => t.title.trim().length > 0)
                        ? "bg-[#ED1C24] text-white hover:bg-[#D11920] hover:scale-105 active:scale-95 shadow-red-500/20"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    최종 보고서 확인하기 <ChevronRight size={24} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 'export' && selectedTask && (
            <motion.div
              key="export"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-10"
            >
              <div className="flex justify-between items-center">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black tracking-tighter text-slate-900">최종 AX 과업지시서</h2>
                  <p className="text-slate-500 font-medium text-lg">작성된 내용을 바탕으로 롯데웰푸드 양식의 보고서가 생성되었습니다.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-6 py-3 bg-slate-600 text-white rounded-2xl font-black flex items-center gap-2 hover:bg-slate-700"
                  >
                    인쇄하여 PDF 저장
                  </button>
                  <button
                  onClick={exportToPDF}
                  className="px-8 py-4 bg-[#ED1C24] text-white rounded-2xl font-black text-lg flex items-center gap-3 hover:bg-[#D11920] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-red-500/20"
                >
                  <Download size={24} /> PDF 다운로드
                </button>
                </div>
              </div>

              <div id="report-content" className="pdf-safe bg-white shadow-2xl mx-auto max-w-[900px] p-16 border border-gray-100 min-h-[1200px] rounded-[3rem]">
                {/* PDF Header */}
                <div className="flex justify-between items-end border-b-4 border-[#ED1C24] pb-10 mb-12">
                  <div className="space-y-4">
                    <img 
                      src={LOTTE_LOGO} 
                      alt="Lotte Wellfood" 
                      className="h-10 object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-1 uppercase">AX STRATEGY REPORT</h1>
                      <p className="text-sm font-black text-[#ED1C24] tracking-[0.3em]">VISION TO ACTION PROJECT</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm font-black text-slate-900">{new Date().toLocaleDateString()}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedTask.department}</p>
                  </div>
                </div>

                {/* PDF Content */}
                <div className="space-y-12">
                  <section>
                    <div className="flex items-center gap-3 bg-slate-900 text-white px-6 py-3 rounded-2xl mb-8 shadow-lg">
                      <LayoutDashboard size={20} className="text-[#ED1C24]" />
                      <span className="text-lg font-black uppercase tracking-tight">1. 과제 선정 배경 및 임원 니즈</span>
                    </div>
                    <div className="grid grid-cols-4 gap-px bg-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
                      <div className="bg-slate-50 p-6 text-xs font-black text-slate-400 uppercase tracking-widest">과제명</div>
                      <div className="col-span-3 bg-white p-6 text-lg font-black text-slate-900">{selectedTask.expectedArea}</div>
                      <div className="bg-slate-50 p-6 text-xs font-black text-slate-400 uppercase tracking-widest">임원진이 개선을 희망하는 업무 영역</div>
                      <div className="col-span-3 bg-white p-6 text-base font-bold text-slate-600 leading-relaxed">{selectedTask.oneLineSummary}</div>
                      <div className="bg-slate-50 p-6 text-xs font-black text-slate-400 uppercase tracking-widest">임원진은 왜 이 영역에 AI가 적용되길 기대하는가</div>
                      <div className="col-span-3 bg-white p-6 text-base font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedTask.reason}</div>
                      <div className="bg-slate-50 p-6 text-xs font-black text-slate-400 uppercase tracking-widest">기대 변화</div>
                      <div className="col-span-3 bg-white p-6 text-base font-bold text-emerald-600 leading-relaxed whitespace-pre-wrap">{selectedTask.expectedChange}</div>
                      <div className="bg-slate-50 p-6 text-xs font-black text-slate-400 uppercase tracking-widest">수행 조직</div>
                      <div className="col-span-3 bg-white p-6 text-base font-bold text-slate-600 leading-relaxed">{selectedTask.executingOrg}</div>
                      <div className="bg-slate-50 p-6 text-xs font-black text-slate-400 uppercase tracking-widest">고려 사항</div>
                      <div className="col-span-3 bg-white p-6 text-base font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedTask.considerations}</div>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-3 bg-slate-900 text-white px-6 py-3 rounded-2xl mb-8 shadow-lg">
                      <RefreshCw size={20} className="text-[#ED1C24]" />
                      <span className="text-lg font-black uppercase tracking-tight">2. 전략적 가이드 및 워크플로우 (AI가 검토한 리뷰 내용)</span>
                    </div>
                    <div className="space-y-6">
                      <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">AI가 설계한 예상 워크플로우</h4>
                        <p className="text-base font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedTask.workflow}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">팀장 관점 포인트</h4>
                          <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedTask.leaderKeyPoints}</p>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">성공 정의</h4>
                          <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedTask.successDefinition}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-3 bg-slate-900 text-white px-6 py-3 rounded-2xl mb-8 shadow-lg">
                      <FileText size={20} className="text-[#ED1C24]" />
                      <span className="text-lg font-black uppercase tracking-tight">3. 과제 구체화 (작성 내용)</span>
                    </div>
                    <div className="space-y-6">
                      {[
                        { label: '임원이 제시한 문제상황은 왜 발생하는 것인가요?', value: concretize.q1 },
                        { label: '이 문제를 해결하기 위해 반드시 개선되어야 하는 것은 무엇입니까?', value: concretize.q2 },
                        { label: '개선되어야 하는 과업이 AI를 기반으로 어떻게 변화되길 기대하십니까?', value: concretize.q3 },
                        { label: '이 문제가 AI를 기반으로 성공적으로 해소/생산성이 향상되었다고 인정 받기 위해, 달성되어야 하거나, 구현된 결과물에 반드시 고려되어야 할 것은 무엇입니까?', value: concretize.q4 },
                        { label: '구현 과정에서 구현자가 반드시 고려해야 할 사항은 무엇입니까?', value: concretize.q5 },
                      ].map(({ label, value }, i) => (
                        <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                          <h4 className="text-sm font-black text-slate-800 tracking-tight mb-2">{i + 1}. {label}</h4>
                          <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{value || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {derivedTopics.some(t => t.title.trim()) && (
                    <section>
                      <div className="flex items-center gap-3 bg-slate-900 text-white px-6 py-3 rounded-2xl mb-8 shadow-lg">
                        <Lightbulb size={20} className="text-amber-400" />
                        <span className="text-lg font-black uppercase tracking-tight">4. 추가 도출 주제</span>
                      </div>
                      <div className="space-y-6">
                        {derivedTopics.filter(t => t.title.trim()).map((topic, i) => (
                          <div key={topic.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">주제 {i + 1}</span>
                              <span className="text-xs font-bold text-slate-400">
                                {topic.topicType === 'within' ? '· 임원 도출 영역 내' : '· 새 주제'}
                              </span>
                            </div>
                            <h4 className="text-base font-black text-slate-800 mb-2">{topic.title}</h4>
                            <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap mb-2">{topic.reason || '—'}</p>
                            <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{topic.expectedDirection || '—'}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="pt-16 border-t-2 border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <img 
                          src={LOTTE_LOGO} 
                          alt="Lotte Wellfood" 
                          className="h-6 object-contain grayscale opacity-30"
                          referrerPolicy="no-referrer"
                        />
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Vision to Action</p>
                      </div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Confidential & Strategic Document</p>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
