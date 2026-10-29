import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CanonicalResume,
  TemplateId,
  AccentColor,
  FontSize,
  SectionKey,
  ATSScoreResponse,
  CreateVersionRequest,
} from '../types/resumeStudio';
import { ResumeFormEditor } from '../components/resume/ResumeFormEditor';
import { ResumePaperPreview } from '../components/resume/ResumePaperPreview';
import { ATSScorePanel } from '../components/resume/ATSScorePanel';
import { ExportDropdown } from '../components/resume/ExportDropdown';
import { MultiJDModal } from '../components/resume/MultiJDModal';
import { TailoringModal } from '../components/resume/TailoringModal';
import { ResumeVersionsModal } from '../components/resume/ResumeVersionsModal';
import { VersionCompareModal } from '../components/resume/VersionCompareModal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { api } from '../services/api';
import {
  Sparkles,
  Upload,
  Save,
  Layout,
  Gauge,
  ChevronDown,
  Layers,
  History,
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

  // Job Description for Live Tailoring Match
  const [jobDescription, setJobDescription] = useState<string>('');
  const [jdOpen, setJdOpen] = useState<boolean>(false);

  // Live ATS Scoring State
  const [atsScoreData, setAtsScoreData] = useState<ATSScoreResponse | null>(null);
  const [scoringLoading, setScoringLoading] = useState<boolean>(false);

  // Autosave & Versioning State
  const [autosaveState, setAutosaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');
  const [isSavingVersion, setIsSavingVersion] = useState<boolean>(false);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [isMultiJDModalOpen, setIsMultiJDModalOpen] = useState<boolean>(false);
  const [isTailoringModalOpen, setIsTailoringModalOpen] = useState<boolean>(false);
  const [tailorRole, setTailorRole] = useState<string>('Full Stack Engineer');
  const [tailorCompany, setTailorCompany] = useState<string>('Target Company');
  const [tailorJDText, setTailorJDText] = useState<string>('');

  // Version Management & Comparison State
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState<boolean>(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [compareVersionIds, setCompareVersionIds] = useState<{ id1: string; id2: string }>({
    id1: '',
    id2: '',
  });
  const [savedVersionsCount, setSavedVersionsCount] = useState<number>(0);

  const refreshVersionsCount = useCallback(async () => {
    try {
      const res = await api.get<any[]>('/api/v1/resume-studio/versions');
      setSavedVersionsCount(res.data.length);
    } catch (err) {
      // silent
    }
  }, []);

  useEffect(() => {
    refreshVersionsCount();
  }, [refreshVersionsCount]);

  const handleApplyTailoring = (tailored: CanonicalResume, role: string) => {
    handleResumeChange(tailored);
    setBannerNotice(`Tailored draft for "${role}" applied! Saved as new draft.`);
    setTimeout(() => setBannerNotice(null), 4000);
    refreshVersionsCount();
  };

  const handleLoadVersionFromModal = (loaded: CanonicalResume, label: string) => {
    handleResumeChange(loaded);
    setBannerNotice(`Loaded "${label}" into active editor!`);
    setTimeout(() => setBannerNotice(null), 4000);
    refreshVersionsCount();
  };

  const handleOpenCompareFromModal = (id1: string, id2: string) => {
    setCompareVersionIds({ id1, id2 });
    setIsCompareModalOpen(true);
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

  // Save Version to MongoDB Atlas
  const handleSaveVersion = async () => {
    setIsSavingVersion(true);
    try {
      const payload: CreateVersionRequest = {
        label: 'Base Resume',
        target_role: 'Full Stack Engineer',
        data: currentResume,
        ats_score: atsScoreData?.overall_score || 0,
      };

      await api.post('/api/v1/resume-studio/version', payload);
      setBannerNotice('Version saved to your cloud profile!');
      setTimeout(() => setBannerNotice(null), 3000);
      refreshVersionsCount();
    } catch (err) {
      console.error('Failed to save version:', err);
    } finally {
      setIsSavingVersion(false);
    }

  };

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

  return (
    <div className="space-y-6 pt-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Resume Studio
            </h1>
            <Badge variant="cyan" size="sm">
              Live ATS
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Build, edit, and score ATS-friendly resumes in real-time.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.docx"
            className="hidden"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadLoading}
            className="text-xs flex items-center gap-1.5"
          >
            <Upload className={`w-3.5 h-3.5 ${uploadLoading ? 'animate-spin' : ''}`} />
            <span>{uploadLoading ? 'Parsing...' : 'Import Resume'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveVersion}
            disabled={isSavingVersion}
            className="text-xs flex items-center gap-1.5"
          >
            <Save className={`w-3.5 h-3.5 ${isSavingVersion ? 'animate-spin' : ''}`} />
            <span>Save Version</span>
          </Button>

          {/* Versions Drawer Trigger Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsVersionsModalOpen(true)}
            className="text-xs flex items-center gap-1.5 text-violet-400 border-violet-500/30 hover:bg-violet-500/10"
          >
            <History className="w-3.5 h-3.5" />
            <span>Versions</span>
            {savedVersionsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-mono font-bold">
                {savedVersionsCount}
              </span>
            )}
          </Button>

          {/* Multi-JD Comparison Trigger Button */}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMultiJDModalOpen(true)}
            className="text-xs flex items-center gap-1.5 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Compare JDs</span>
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
        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center justify-between">
          <span>{bannerNotice}</span>
          <button onClick={() => setBannerNotice(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Split-Screen Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Editor (7 Cols on LG) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Target Job Description Collapsible Accordion */}
          <div className="bg-slate-900/70 border border-white/10 rounded-xl p-3.5">
            <div
              onClick={() => setJdOpen(!jdOpen)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Target Job Description
                </span>
                {jobDescription && (
                  <Badge variant="cyan" size="sm">
                    Active Match
                  </Badge>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${jdOpen ? 'rotate-180' : ''}`}
              />
            </div>

            {jdOpen && (
              <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                <p className="text-[11px] text-slate-400">
                  Paste the JD below to activate the 40% keyword & semantic match scoring.
                </p>
                <textarea
                  rows={3}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste job description requirements here..."
                  className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            )}
          </div>

          {/* Form Editor */}
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

        {/* Right Column: Live Paper Preview & ATS Score Panel (5 Cols on LG) */}
        <div className="lg:col-span-5 sticky top-20 space-y-4">
          {/* Tab Switcher: Paper Preview vs ATS Score */}
          <div className="flex items-center justify-between bg-slate-900/90 p-1.5 rounded-xl border border-white/10">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setRightViewMode('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  rightViewMode === 'score'
                    ? 'bg-cyan-500 text-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>ATS Score</span>
                {atsScoreData && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/20 text-black font-bold">
                    {atsScoreData.overall_score}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Score Pill on Preview Mode */}
            {rightViewMode === 'preview' && atsScoreData && (
              <button
                onClick={() => setRightViewMode('score')}
                className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-1 rounded-md border border-cyan-500/20 hover:border-cyan-400"
              >
                <span>Score:</span>
                <span className="font-bold">{atsScoreData.overall_score}/100</span>
              </button>
            )}
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
            />
          )}
        </div>
      </div>

      {/* Multi-JD Comparison Modal */}
      <MultiJDModal
        isOpen={isMultiJDModalOpen}
        onClose={() => setIsMultiJDModalOpen(false)}
        resume={currentResume}
        onSelectForTailoring={(role, company, text) => {
          setIsMultiJDModalOpen(false);
          setTailorRole(role);
          setTailorCompany(company);
          setTailorJDText(text);
          setIsTailoringModalOpen(true);
        }}
      />

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

      {/* Resume Versions Drawer / Modal */}
      <ResumeVersionsModal
        isOpen={isVersionsModalOpen}
        onClose={() => setIsVersionsModalOpen(false)}
        currentResume={currentResume}
        currentScore={atsScoreData?.overall_score || 0}
        onLoadVersion={handleLoadVersionFromModal}
        onOpenCompare={handleOpenCompareFromModal}
      />

      {/* Side-by-Side Version Comparison Modal */}
      <VersionCompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        versionId1={compareVersionIds.id1}
        versionId2={compareVersionIds.id2}
      />
    </div>

  );
};

export default ResumeStudioPage;
