import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CanonicalResume,
  TemplateId,
  AccentColor,
  FontSize,
  SectionKey,
  ATSScoreResponse,
  GenerateSeedsResponse,
} from '../types/resumeStudio';
import { ResumeFormEditor } from '../components/resume/ResumeFormEditor';
import { ResumePaperPreview } from '../components/resume/ResumePaperPreview';
import { ATSScorePanel } from '../components/resume/ATSScorePanel';
import { ExportDropdown } from '../components/resume/ExportDropdown';
import { TailoringModal } from '../components/resume/TailoringModal';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import {
  Sparkles,
  Upload,
  Layout,
  Gauge,
  ChevronDown,
  Columns,
  Eye,
} from 'lucide-react';


const INITIAL_RESUME: CanonicalResume = {
  contact: {
    full_name: 'Shreya Sharma',
    email: 'shreya.sharma@example.com',
    phone: '+91 9876543210',
    location: 'Bengaluru, India',
    linkedin_url: 'https://linkedin.com/in/shreyasharma',
    github_url: 'https://github.com/shreyasharma',
  },
  summary:
    'Full Stack Software Engineer with 2+ years of experience engineering high-throughput microservices and responsive web applications using React, TypeScript, FastAPI, and PostgreSQL.',
  skills: {
    languages: ['Python', 'TypeScript', 'JavaScript', 'SQL'],
    frameworks_libraries: ['React', 'FastAPI', 'Node.js', 'Tailwind CSS'],
    cloud_databases: ['PostgreSQL', 'MongoDB', 'Redis', 'AWS'],
    developer_tools: ['Docker', 'Git', 'Vite', 'Linux'],
    core_concepts: ['RESTful APIs', 'Microservices', 'System Design'],
  },
  experience: [
    {
      id: 'exp-1',
      company: 'CloudScale Technologies',
      role: 'Full Stack Engineer',
      location: 'Bengaluru, India',
      start_date: 'Jan 2023',
      end_date: 'Present',
      is_current: true,
      bullets: [
        'Architected asynchronous FastAPI microservices reducing p99 latency by 35% across 120k daily requests.',
        'Developed interactive dashboard components in React and TypeScript with 98% test coverage.',
        'Engineered Redis caching layer and MongoDB indexing, decreasing query execution times to 38ms.',
      ],
    },
  ],
  projects: [
    {
      id: 'proj-1',
      title: 'InterviewIQ - AI Career Platform',
      tech_stack: ['React', 'TypeScript', 'FastAPI', 'MongoDB', 'Gemini'],
      description: 'AI-assisted technical interview simulator with real-time scoring.',
      bullets: [
        'Built WebSocket state machine handling multi-turn audio interviews with under 200ms round-trip latency.',
        'Engineered deterministic weighted ATS scoring engine evaluating candidate resumes across 5 dimensions.',
      ],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'Visvesvaraya Technological University (VTU)',
      degree: 'B.E.',
      field_of_study: 'Computer Science and Engineering',
      start_date: '2020',
      end_date: '2024',
      gpa_or_percentage: '8.9 CGPA',
    },
  ],
  certifications: [
    {
      id: 'cert-1',
      name: 'AWS Certified Solutions Architect',
      issuer: 'Amazon Web Services',
      year: '2023',
    },
  ],
  achievements: [],
};

export const ResumeStudioPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resume State with Undo / Redo History Stack
  const [history, setHistory] = useState<CanonicalResume[]>([INITIAL_RESUME]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const currentResume = history[historyIndex] || INITIAL_RESUME;

  // Editor Presentation Settings
  const [template, setTemplate] = useState<TemplateId>('modern');
  const [accentColor, setAccentColor] = useState<AccentColor>('cyan');
  const [fontSize, setFontSize] = useState<FontSize>('md');
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>([
    'summary',
    'skills',
    'experience',
    'projects',
    'education',
    'certifications',
  ]);
  const [hiddenSections, setHiddenSections] = useState<SectionKey[]>([]);

  // Right Column View Mode: 'preview' (Paper) | 'score' (ATS Breakdown)
  const [rightViewMode, setRightViewMode] = useState<'preview' | 'score'>('preview');
  // Workspace Layout Mode: 'split' (50/50 side-by-side) | 'preview' (Full width preview & ATS)
  type StudioLayoutMode = 'split' | 'preview';
  const [layoutMode, setLayoutMode] = useState<StudioLayoutMode>('split');

  // Job Description for Live Tailoring Match
  const [jobDescription, setJobDescription] = useState<string>('');
  const [jdOpen, setJdOpen] = useState<boolean>(false);

  // Live ATS Scoring State
  const [atsScoreData, setAtsScoreData] = useState<ATSScoreResponse | null>(null);
  const [scoringLoading, setScoringLoading] = useState<boolean>(false);

  // Autosave State
  const [autosaveState, setAutosaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [isTailoringModalOpen, setIsTailoringModalOpen] = useState<boolean>(false);
  const [tailorRole, setTailorRole] = useState<string>('Full Stack Engineer');
  const [tailorCompany, setTailorCompany] = useState<string>('Target Company');
  const [tailorJDText, setTailorJDText] = useState<string>('');

  const handleApplyTailoring = (tailored: CanonicalResume, role: string) => {
    handleResumeChange(tailored);
    setBannerNotice(`Tailored draft for "${role}" applied! Saved as new draft.`);
    setTimeout(() => setBannerNotice(null), 4000);
  };

  const [practicingSeeds, setPracticingSeeds] = useState<boolean>(false);

  const handlePracticeWeakSpots = async () => {
    setPracticingSeeds(true);
    try {
      const res = await api.post<GenerateSeedsResponse>('/api/v1/resume-studio/interview-seeds', {
        resume: currentResume,
        job_description: jobDescription || undefined,
        target_role: tailorRole || 'Full Stack Engineer',
      });
      const seeds = res.data.seeds || [];
      const seedPrompts = seeds.map((s) => s.seed_prompt);
      navigate('/interview', {
        state: {
          questionSeeds: seedPrompts,
          targetRole: res.data.target_role || tailorRole || 'Full Stack Engineer',
          seedItems: seeds,
        },
      });
    } catch (err: any) {
      console.error('Failed to extract interview seeds:', err);
      navigate('/interview');
    } finally {
      setPracticingSeeds(false);
    }
  };


  // Mutate Resume (Pushes to History Stack)
  const handleResumeChange = (updated: CanonicalResume) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    setHistory([...updatedHistory, updated]);
    setHistoryIndex(updatedHistory.length);
    setAutosaveState('unsaved');
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAutosaveState('unsaved');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAutosaveState('unsaved');
    }
  };

  const toggleHideSection = (key: SectionKey) => {
    if (hiddenSections.includes(key)) {
      setHiddenSections(hiddenSections.filter((k) => k !== key));
    } else {
      setHiddenSections([...hiddenSections, key]);
    }
  };

  // Debounced Live ATS Scoring
  const calculateATSScore = useCallback(
    async (resumeToScore: CanonicalResume, jdText: string) => {
      setScoringLoading(true);
      try {
        const res = await api.post<ATSScoreResponse>('/api/v1/resume-studio/score', {
          resume: resumeToScore,
          job_description: jdText,
          target_role: 'Software Engineer',
        });
        setAtsScoreData(res.data);
      } catch (err) {
        console.warn('Scoring error:', err);
      } finally {
        setScoringLoading(false);
      }
    },
    []
  );

  // Debounce effect for scoring whenever resume or JD changes
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateATSScore(currentResume, jobDescription);
    }, 1200);
    return () => clearTimeout(timer);
  }, [currentResume, jobDescription, calculateATSScore]);

  // Debounced Autosave effect
  useEffect(() => {
    if (autosaveState === 'unsaved') {
      const timer = setTimeout(() => {
        setAutosaveState('saving');
        setTimeout(() => {
          setAutosaveState('saved');
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastSavedTime(time);
        }, 600);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [autosaveState]);

  // Upload & Parse PDF/DOCX
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    setBannerNotice(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/api/v1/resume-studio/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.resume) {
        handleResumeChange(res.data.resume);
        setBannerNotice(`Successfully parsed ${res.data.file_name}!`);
        setTimeout(() => setBannerNotice(null), 4000);
      }
    } catch (err: any) {
      setBannerNotice(`Upload notice: ${err.response?.data?.detail || err.message}`);
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderJobDescriptionAccordion = () => (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl px-3 py-2 text-xs">
      <div
        onClick={() => setJdOpen(!jdOpen)}
        className="flex items-center justify-between cursor-pointer select-none text-slate-300 hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold text-xs">
            {jobDescription ? 'Target Job Description (Active)' : 'Target Job Description (Optional)'}
          </span>
          {jobDescription && (
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-mono">
              40% Match Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <span>{jdOpen ? 'Hide' : jobDescription ? 'Edit' : 'Paste JD'}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${jdOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {jdOpen && (
        <div className="mt-2 pt-2 border-t border-white/5 space-y-1.5">
          <textarea
            rows={3}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste job description requirements to evaluate ATS match..."
            className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 leading-relaxed"
          />
        </div>
      )}
    </div>
  );

  const renderRightPanel = () => (
    <>
      {/* Tab Switcher: Paper Preview vs ATS Score */}
      <div className="flex items-center justify-between bg-slate-900/80 p-1 rounded-xl border border-white/10">
        <div className="flex items-center gap-1 w-full">
          <button
            onClick={() => setRightViewMode('preview')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              rightViewMode === 'preview'
                ? 'bg-cyan-500 text-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Paper Preview</span>
          </button>
          <button
            onClick={() => setRightViewMode('score')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              rightViewMode === 'score'
                ? 'bg-cyan-500 text-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>ATS Score</span>
            {atsScoreData && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  rightViewMode === 'score' ? 'bg-black/25 text-black' : 'bg-cyan-500/20 text-cyan-300'
                }`}
              >
                {atsScoreData.overall_score}%
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Conditional View */}
      {rightViewMode === 'preview' ? (
        <ResumePaperPreview
          resume={currentResume}
          template={template}
          accentColor={accentColor}
          fontSize={fontSize}
          sectionOrder={sectionOrder}
          hiddenSections={hiddenSections}
          onTemplateChange={setTemplate}
          onAccentColorChange={setAccentColor}
          onFontSizeChange={setFontSize}
        />
      ) : (
        <ATSScorePanel
          scoreData={atsScoreData}
          loading={scoringLoading}
          onOpenTailor={() => {
            setTailorRole('Target Role');
            setTailorCompany('Target Company');
            setTailorJDText(jobDescription);
            setIsTailoringModalOpen(true);
          }}
          onPracticeWeakSpots={handlePracticeWeakSpots}
          isPracticing={practicingSeeds}
        />
      )}
    </>
  );

  return (
    <div className="space-y-4 pt-2">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white tracking-tight">
            Resume Studio
          </h1>
          {/* Subtle Autosave Indicator */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 border-l border-white/10 pl-3">
            {autosaveState === 'saving' ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-cyan-400">Saving...</span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-slate-400">{lastSavedTime || 'Saved'}</span>
              </>
            )}
          </div>
        </div>

        {/* Global Action Buttons & View Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Workspace Layout Mode Switcher */}
          <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setLayoutMode('split')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                layoutMode === 'split'
                  ? 'bg-cyan-500 text-black shadow font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Side-by-side Editor & Preview"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                layoutMode === 'preview'
                  ? 'bg-cyan-500 text-black shadow font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Full-Size Preview"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.docx"
            className="hidden"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadLoading}
            className="text-xs flex items-center gap-1 py-1 px-2 text-slate-300 hover:text-white"
          >
            <Upload className={`w-3.5 h-3.5 ${uploadLoading ? 'animate-spin' : ''}`} />
            <span>{uploadLoading ? 'Importing...' : 'Import'}</span>
          </Button>

          {/* Export & ATS Self-Test Dropdown */}
          <ExportDropdown
            resume={currentResume}
            template={template}
            accentColor={accentColor}
            fontSize={fontSize}
            targetRole="Full Stack Engineer"
          />
        </div>
      </div>

      {/* Banner Notice Alert if present */}
      {bannerNotice && (
        <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center justify-between">
          <span>{bannerNotice}</span>
          <button onClick={() => setBannerNotice(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Workspace Area: Controlled by layoutMode */}
      {layoutMode === 'split' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Left Column: Form Editor (50% on LG) */}
          <div className="space-y-3">
            {renderJobDescriptionAccordion()}
            <ResumeFormEditor
              resume={currentResume}
              onChange={handleResumeChange}
              sectionOrder={sectionOrder}
              hiddenSections={hiddenSections}
              onSectionOrderChange={setSectionOrder}
              onToggleHideSection={toggleHideSection}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
              onUndo={handleUndo}
              onRedo={handleRedo}
              autosaveState={autosaveState}
              lastSavedTime={lastSavedTime}
            />
          </div>

          {/* Right Column: Live Paper Preview & ATS Score Panel (50% on LG) */}
          <div className="sticky top-20 space-y-3 max-h-[calc(100vh-5.5rem)] flex flex-col">
            {renderRightPanel()}
          </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-3 w-full">
          <div className="flex justify-end mb-1">
            <button
              onClick={() => setLayoutMode('split')}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline"
            >
              ← Back to Split View
            </button>
          </div>
          {renderRightPanel()}
        </div>
      )}

      {/* One-Click Truthful Tailoring Modal */}
      <TailoringModal
        isOpen={isTailoringModalOpen}
        onClose={() => setIsTailoringModalOpen(false)}
        resume={currentResume}
        jobDescription={tailorJDText || jobDescription}
        targetRole={tailorRole}
        targetCompany={tailorCompany}
        onApplyTailoring={handleApplyTailoring}
      />
    </div>

  );
};

export default ResumeStudioPage;
