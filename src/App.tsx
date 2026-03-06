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
  RefreshCw
} from 'lucide-react';
import { MOCK_TASKS } from './constants';
import { ExecutiveTask, ProjectDefinition, Department, ConcretizeForm } from './types';
import { cn, bulletToNumbered } from './lib/utils';
import Markdown from 'react-markdown';
import { getAiCoaching, suggestKpis, getConcretizeGuides } from './services/geminiService';
import { fetchTasks, saveWrittenContent, fetchWrittenContents, toUserKey, type UserProfile, type WrittenEntry } from './services/sheetService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type Step = 'dashboard' | 'review' | 'concretize' | 'export';

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
  const [concretizeGuides, setConcretizeGuides] = useState<{ q1?: string; q2?: string; q4?: string; q5?: string; q6?: string }>({});
  const [concretize, setConcretize] = useState<ConcretizeForm>({
    q1: '', q2: '', q3: '', q4: '', q5: '', q6: '',
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isGuideLoading, setIsGuideLoading] = useState(false);

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
    // 페이지 이동 시 항상 상단으로 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

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
    const myKey = toUserKey(p);
    const mineOnly = (result.items || []).filter((e) => String(e.userKey || '').trim() === myKey);
    setWrittenEntries(mineOnly);
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
      q5: entry.concretize.q5 || '',
      q6: entry.concretize.q6 || '',
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
        q3: '',
        q4: concretize.q4,
        q5: concretize.q5,
        q6: concretize.q6,
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

    const forceHexInClone = (el: HTMLElement) => {
      const cls = el.className || "";
      if (typeof cls !== "string") return;
      if (cls.includes("bg-slate-900")) {
        el.style.setProperty("background-color", "#0f172a", "important");
        el.style.setProperty("color", "#e2e8f0", "important");
      } else if (cls.includes("bg-slate-50")) el.style.setProperty("background-color", "#f8fafc", "important");
      else if (cls.includes("bg-gray-100")) el.style.setProperty("background-color", "#f3f4f6", "important");
      else if (cls.includes("bg-white")) el.style.setProperty("background-color", "#ffffff", "important");
      else if (cls.includes("text-slate-900")) el.style.setProperty("color", "#0f172a", "important");
      else if (cls.includes("text-slate-800")) el.style.setProperty("color", "#1e293b", "important");
      else if (cls.includes("text-slate-700")) el.style.setProperty("color", "#334155", "important");
      else if (cls.includes("text-slate-600")) el.style.setProperty("color", "#475569", "important");
      else if (cls.includes("text-slate-500")) el.style.setProperty("color", "#64748b", "important");
      else if (cls.includes("text-slate-400")) el.style.setProperty("color", "#94a3b8", "important");
      else if (cls.includes("text-slate-300")) el.style.setProperty("color", "#cbd5e1", "important");
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("text-shadow", "none", "important");
      Array.from(el.children).forEach((c) => c instanceof HTMLElement && forceHexInClone(c));
    };

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        onclone: (_doc, clonedEl) => {
          const style = _doc.createElement("style");
          style.textContent = pdfSafeCss;
          _doc.head.appendChild(style);
          clonedEl.style.setProperty("color", "#0f172a");
          clonedEl.style.setProperty("background-color", "#ffffff");
          forceHexInClone(clonedEl as HTMLElement);
        },
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`VisionToAction_Report_${selectedTask?.id}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (typeof window !== "undefined" && window.alert) {
        window.alert(`PDF 생성 중 오류가 발생했습니다. 브라우저에서 인쇄(Ctrl+P) 후 "PDF로 저장"을 선택해 주세요. (오류: ${msg})`);
      }
    }
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
          {(['dashboard', 'review', 'concretize', 'export'] as Step[]).map((step, idx) => (
            <button
              key={step}
              onClick={() => selectedTask && setCurrentStep(step)}
              disabled={!selectedTask && step !== 'dashboard'}
              className={cn(
                "px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2",
                currentStep === step 
                  ? "bg-[#ED1C24] text-white shadow-md shadow-red-200" 
                  : "text-gray-400 hover:text-gray-600 disabled:opacity-30"
              )}
            >
              <span className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px]",
                currentStep === step ? "bg-white/20" : "bg-gray-200"
              )}>{idx + 1}</span>
              {step.charAt(0).toUpperCase() + step.slice(1)}
            </button>
          ))}
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
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => {
                    if (profile.org?.trim() && profile.name?.trim() && profile.title?.trim()) {
                      loadWrittenEntries(profile).then(() => setIsWrittenModalOpen(true));
                    } else {
                      setIsWrittenModalOpen(true);
                    }
                  }}
                  className="shrink-0 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  <FileText size={18} />
                  기존 작성 내용 확인하기
                </button>
                <div className="min-w-0" />
              </div>
              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-[#ED1C24] rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100">
                    <Sparkles size={12} /> Executive Vision Bridge
                  </div>
                  <h2 className="text-5xl font-black tracking-tighter text-slate-900 leading-none">본부별 <span className="text-[#ED1C24]">AI 활용 영역</span> 대시보드</h2>
                  <p className="text-slate-600 text-lg max-w-2xl font-medium leading-relaxed">임원진이 도출한 AI 활용 영역을 확인하고, 팀의 역량을 집중할 핵심 과제를 선택하여 구체화하세요.</p>
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
                  {filteredTasks.map(task => (
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
                          {task.priority && (
                            <span className="px-3 py-1.5 bg-red-50 text-[#ED1C24] rounded-full text-[10px] font-black border border-red-100">
                              우선순위 {task.priority}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-300">{task.id}</span>
                      </div>
                      
                      <h3 className="text-2xl font-black leading-tight mb-4 text-slate-900 group-hover:text-[#ED1C24] transition-colors relative z-10">
                        {task.expectedArea}
                      </h3>
                      
                      <p className="text-slate-500 text-sm leading-relaxed mb-8 line-clamp-3 font-medium relative z-10">
                        {task.oneLineSummary}
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
              className="grid grid-cols-1 lg:grid-cols-3 gap-10"
            >
              <div className="lg:col-span-2 space-y-10">
                <div className="bg-white rounded-[3rem] p-12 shadow-xl shadow-slate-200/50 border border-gray-100">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#ED1C24] shadow-inner">
                      <Target size={32} />
                    </div>
                    <div>
                      <h2 className="text-4xl font-black tracking-tighter text-slate-900">임원진 비전 리뷰</h2>
                      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Executive Needs Analysis</p>
                    </div>
                  </div>

                  <div className="space-y-14">
                    <section className="rounded-[2rem] border-2 border-[#ED1C24]/20 bg-red-50/30 p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-[#ED1C24] text-white flex items-center justify-center text-sm font-black">1</div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900">임원진이 작성한 AI 적용 희망 영역을 확인해 보세요.</h3>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="p-5 bg-white rounded-xl border border-slate-100 shadow-sm">
                          <h4 className="text-sm font-black text-[#ED1C24] tracking-tight mb-2">AI를 적용하고 싶은 업무/영역</h4>
                          <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedTask.expectedArea}</p>
                        </div>
                        <div className="p-5 bg-white rounded-xl border border-slate-100 shadow-sm">
                          <h4 className="text-sm font-black text-[#ED1C24] tracking-tight mb-2">AI 적용이 필요한 이유</h4>
                          <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedTask.reason}</p>
                        </div>
                        <div className="p-5 bg-white rounded-xl border border-slate-100 shadow-sm">
                          <h4 className="text-sm font-black text-[#ED1C24] tracking-tight mb-2">AI 적용 후 기대하는 변화</h4>
                          <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedTask.expectedChange}</p>
                        </div>
                        <div className="p-5 bg-white rounded-xl border border-slate-100 shadow-sm">
                          <h4 className="text-sm font-black text-[#ED1C24] tracking-tight mb-2">수행 조직/협업 범위</h4>
                          <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedTask.executingOrg}</p>
                        </div>
                        <div className="p-5 bg-white rounded-xl border border-slate-100 shadow-sm md:col-span-2">
                          <h4 className="text-sm font-black text-[#ED1C24] tracking-tight mb-2">구현 시 고려해야 할 사항</h4>
                          <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedTask.considerations}</p>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[2rem] border-2 border-slate-200 bg-slate-50/50 p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center text-sm font-black">2</div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900">과제를 구체화하기 위해 과제 리뷰내용을 참고하세요.</h3>
                        </div>
                      </div>
                      <div className="space-y-5">
                        <div className="p-5 bg-white rounded-xl border border-slate-100">
                          <h4 className="text-sm font-black text-slate-800 tracking-tight mb-2">핵심 한 줄 요약</h4>
                          <p className="text-slate-800 text-base font-bold leading-relaxed whitespace-pre-wrap">{selectedTask.oneLineSummary}</p>
                        </div>
                        <div className="p-6 bg-slate-900 text-white rounded-xl shadow-lg">
                          <h4 className="text-sm font-black text-[#ED1C24] tracking-tight mb-3">AI 적용 시 기대되는 전체 워크플로우 예시</h4>
                          <p className="text-slate-300 text-sm font-medium leading-relaxed whitespace-pre-wrap">{bulletToNumbered(selectedTask.workflow)}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="p-5 bg-white rounded-xl border border-slate-100">
                            <h4 className="text-sm font-black text-slate-800 tracking-tight mb-2">팀장 관점 핵심 포인트</h4>
                            <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{bulletToNumbered(selectedTask.leaderKeyPoints)}</p>
                          </div>
                          <div className="p-5 bg-white rounded-xl border border-slate-100">
                            <h4 className="text-sm font-black text-slate-800 tracking-tight mb-2">구체화 탐색 질문</h4>
                            <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{bulletToNumbered(selectedTask.explorationQuestions)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="p-5 bg-white rounded-xl border border-slate-100">
                            <h4 className="text-sm font-black text-slate-800 tracking-tight mb-2">현실적인 구현 범위(힌트)</h4>
                            <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{bulletToNumbered(selectedTask.implementationScope)}</p>
                          </div>
                          <div className="p-5 bg-white rounded-xl border border-slate-100">
                            <h4 className="text-sm font-black text-slate-800 tracking-tight mb-2">구현 전 검토 사항</h4>
                            <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{bulletToNumbered(selectedTask.preReviewItems)}</p>
                          </div>
                        </div>
                        <div className="p-5 bg-amber-50 rounded-xl border border-amber-100">
                          <h4 className="text-sm font-black text-amber-800 tracking-tight mb-2">성공의 정의(평가 기준)</h4>
                          <p className="text-slate-800 text-sm font-bold leading-relaxed whitespace-pre-wrap">{bulletToNumbered(selectedTask.successDefinition)}</p>
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
              </div>

              <div className="space-y-8">
                <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                  <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-[#ED1C24]">
                    <Sparkles size={24} /> 팀장 필수 확인 사항
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed mb-6 font-medium">
                    구현 단계로 넘기기 전에, 아래 관점에서 과제가 명확한지 점검하세요.
                  </p>
                  <div className="space-y-5">
                    <div className="flex items-start gap-4 group">
                      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-xs font-black shrink-0 group-hover:bg-[#ED1C24] transition-colors">1</div>
                      <p className="text-xs text-slate-300 font-bold leading-relaxed">비효율·개선 포인트를 <span className="text-white">구체적 수치·사례</span>로 적었는가? (예: 소요 시간, 발생 빈도, 오류율)</p>
                    </div>
                    <div className="flex items-start gap-4 group">
                      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-xs font-black shrink-0 group-hover:bg-[#ED1C24] transition-colors">2</div>
                      <p className="text-xs text-slate-300 font-bold leading-relaxed">성공의 정의가 <span className="text-white">측정 가능한 기준</span>으로 되어 있는가? (단순 “시간 단축”이 아닌, 얼마나·어떤 결과물까지)</p>
                    </div>
                    <div className="flex items-start gap-4 group">
                      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-xs font-black shrink-0 group-hover:bg-[#ED1C24] transition-colors">3</div>
                      <p className="text-xs text-slate-300 font-bold leading-relaxed">구현 범위가 <span className="text-white">한 번에 달성 가능한 수준</span>으로 한정되어 있는가? (과도한 범위는 실패 요인)</p>
                    </div>
                    <div className="flex items-start gap-4 group">
                      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-xs font-black shrink-0 group-hover:bg-[#ED1C24] transition-colors">4</div>
                      <p className="text-xs text-slate-300 font-bold leading-relaxed">결과물에 <span className="text-white">반드시 포함되어야 할 산출물·기능</span>이 명시되어 있는가? (구현자가 빠뜨리지 않도록)</p>
                    </div>
                  </div>
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

                  <p className="text-slate-600 text-sm font-medium mb-10 leading-relaxed">아래 내용은 후속 과정에서 구현자(실무자)에게 인계할 수 있도록, 가능한 한 구체적으로 작성해 주세요.</p>

                  <div className="space-y-10">
                    {[
                      { num: 1, key: 'q1', title: '현재는 해당 과업을 어떻게 수행하고 있는지 상세하게 정리해주세요.', value: concretize.q1, onChange: (v: string) => setConcretize(prev => ({ ...prev, q1: v })), guideText: concretizeGuides.q1 || '' },
                      { num: 2, key: 'q2', title: '현재의 수행방식으로 인해 발생된 비효율 및 개선 포인트는 무엇인가요?', value: concretize.q2, onChange: (v: string) => setConcretize(prev => ({ ...prev, q2: v })), guideText: concretizeGuides.q2 || '' },
                      { num: 3, key: 'q4', title: '선택한 과업이 AI를 기반으로 어떻게 생산성이 향상되기를 기대하십니까?', value: concretize.q4, onChange: (v: string) => setConcretize(prev => ({ ...prev, q4: v })), guideText: concretizeGuides.q4 || '' },
                      { num: 4, key: 'q5', title: '이 문제가 AI를 기반으로 성공적으로 해소/생산성이 향상되었다고 인정 받기 위해, 달성되어야 하거나, 구현된 결과물에 반드시 포함되어야 할 것은 무엇입니까?', value: concretize.q5, onChange: (v: string) => setConcretize(prev => ({ ...prev, q5: v })), guideText: concretizeGuides.q5 || '' },
                      { num: 5, key: 'q6', title: '구현 과정에서 고려해야 할 혹은 예상되는 어려움은 무엇인가요?', value: concretize.q6, onChange: (v: string) => setConcretize(prev => ({ ...prev, q6: v })), guideText: concretizeGuides.q6 || '' },
                    ].map(({ num, title, value, onChange, guideText }) => (
                      <section key={num} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-[#ED1C24] text-white flex items-center justify-center text-sm font-black">{num}</div>
                          <h3 className="text-lg font-black text-slate-800">{title}</h3>
                        </div>
                          <div className="mb-4 p-4 bg-white rounded-xl border border-slate-100">
                          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">작성 가이드</p>
                          <div className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{guideText || (isGuideLoading ? '가이드를 생성 중입니다…' : '가이드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')}</div>
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
                      onClick={handleGoToExport}
                      className="px-10 py-5 bg-[#ED1C24] text-white rounded-2xl font-black text-lg flex items-center gap-3 hover:bg-[#D11920] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-red-500/20"
                    >
                      최종 보고서 확인하기 <ChevronRight size={24} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 sticky top-32">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-[#ED1C24]"><FileText size={20} /> 작성 시 팀장이 지킬 것</h3>
                  <ul className="space-y-3 text-slate-300 text-sm font-medium leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-[#ED1C24] font-black shrink-0">·</span>
                      <span>각 질문은 <strong className="text-white">실행 가능한 문장</strong>으로 작성 (예: “~를 자동화한다”보다 “~ 조건일 때 ~ 형식으로 리포트를 생성한다”)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#ED1C24] font-black shrink-0">·</span>
                      <span>수치·기준이 있으면 <strong className="text-white">반드시 명시</strong> (소요 시간, 건수, 품질 기준 등)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#ED1C24] font-black shrink-0">·</span>
                      <span>결과물에 “반드시 포함되어야 할 것”은 <strong className="text-white">체크리스트 형태</strong>로 구체화</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#ED1C24] font-black shrink-0">·</span>
                      <span>구현 시 예상 어려움은 <strong className="text-white">데이터·권한·시스템</strong> 등 유형별로 구분해 적기</span>
                    </li>
                  </ul>
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
                <button
                  onClick={exportToPDF}
                  className="px-8 py-4 bg-[#ED1C24] text-white rounded-2xl font-black text-lg flex items-center gap-3 hover:bg-[#D11920] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-red-500/20"
                >
                  <Download size={24} /> PDF 다운로드
                </button>
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
                      <div className="bg-slate-50 p-6 text-xs font-black text-slate-400 uppercase tracking-widest">임원 제시 내용</div>
                      <div className="col-span-3 bg-white p-6 text-base font-bold text-slate-600 leading-relaxed">{selectedTask.oneLineSummary}</div>
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
                      <span className="text-lg font-black uppercase tracking-tight">2. 전략적 가이드 및 워크플로우</span>
                    </div>
                    <div className="space-y-6">
                      <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">전체 워크플로우</h4>
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
                        { label: '현재는 해당 과업을 어떻게 수행하고 있는지 상세하게 정리해주세요.', value: concretize.q1 },
                        { label: '현재의 수행방식으로 인해 발생된 비효율 및 개선 포인트는 무엇인가요?', value: concretize.q2 },
                        { label: '선택한 과업이 AI를 기반으로 어떻게 생산성이 향상되기를 기대하십니까?', value: concretize.q4 },
                        { label: '이 문제가 AI를 기반으로 성공적으로 해소/생산성이 향상되었다고 인정 받기 위해, 달성되어야 하거나, 구현된 결과물에 반드시 포함되어야 할 것은 무엇입니까?', value: concretize.q5 },
                        { label: '구현 과정에서 고려해야 할 혹은 예상되는 어려움은 무엇인가요?', value: concretize.q6 },
                      ].map(({ label, value }, i) => (
                        <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                          <h4 className="text-sm font-black text-slate-800 tracking-tight mb-2">{i + 1}. {label}</h4>
                          <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{value || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </section>

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
