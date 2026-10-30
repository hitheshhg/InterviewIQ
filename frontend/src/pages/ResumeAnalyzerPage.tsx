import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ScoreGauge from '../components/ui/ScoreGauge';
import {
  CanonicalResume,
  ATSScoreBreakdown,
  FixIssueItem,
  BulletRewriteOption,
  parseUploadedResume,
  evaluateResume,
  saveActiveResume,
  getActiveResume,
  suggestBulletRewrites,
} from '../services/canonicalResumeService';

const PRESET_JDS: Record<string, { role: string; jd: string }> = {
  fullstack: {
    role: 'Full Stack Developer',
    jd: `We are looking for a Full Stack Software Engineer proficient in Python, FastAPI, React, TypeScript, and MongoDB. The candidate will design resilient microservices, build responsive frontend user interfaces, optimize database queries with indexing, and automate Docker deployments.`,
  },
  backend: {
    role: 'Backend Systems Engineer',
    jd: `Seeking a Backend Engineer experienced in Python, FastAPI, PostgreSQL, Redis, and distributed systems. Responsible for high-concurrency API architecture, asynchronous worker pools, relational schema optimization, and Docker container orchestration.`,
  },
  frontend: {
    role: 'Frontend UI/UX Engineer',
    jd: `Looking for a Senior Frontend Engineer specialized in React, TypeScript, Tailwind CSS, and state management. You will construct high-performance web applications, optimize Lighthouse core web vitals, and integrate WebSocket real-time feeds.`,
  },
};

export const ResumeAnalyzerPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stepper state: 1 = Upload, 2 = Guided Improvement, 3 = Rebuild
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Resume & JD Data
  const [canonicalResume, setCanonicalResume] = useState<CanonicalResume | null>(null);
  const [targetRole, setTargetRole] = useState('Full Stack Developer');
  const [jobDescription, setJobDescription] = useState('');
  const [fileName, setFileName] = useState('Resume.pdf');
  const [activeResumeVersion, setActiveResumeVersion] = useState<number>(1);

  // ATS Evaluation & Fixes
  const [scoreBreakdown, setScoreBreakdown] = useState<ATSScoreBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Fix Cards & AI Rewrites State
  const [loadingRewrites, setLoadingRewrites] = useState<Record<string, boolean>>({});
  const [rewritesByIssue, setRewritesByIssue] = useState<Record<string, BulletRewriteOption[]>>({});
  const [selectedRewriteId, setSelectedRewriteId] = useState<Record<string, string>>({});
  const [fillInValues, setFillInValues] = useState<Record<string, string>>({});
  const [acceptedIssues, setAcceptedIssues] = useState<Set<string>>(new Set());
  const [skippedIssues, setSkippedIssues] = useState<Set<string>>(new Set());
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [manualEditText, setManualEditText] = useState('');

  // Load active resume on initial mount if available
  useEffect(() => {
    let isMounted = true;
    const fetchActive = async () => {
      try {
        const active = await getActiveResume();
        if (isMounted && active && active.canonical_resume) {
          setCanonicalResume(active.canonical_resume);
          setTargetRole(active.target_role || 'Full Stack Developer');
          setJobDescription(active.job_description || '');
          setActiveResumeVersion(active.version || 1);
          // Evaluate loaded resume
          runEvaluation(active.canonical_resume, active.job_description, active.target_role);
          setStep(2);
        }
      } catch (e) {
        // Not fatal, user can simply upload
      }
    };
    fetchActive();
    return () => {
      isMounted = false;
    };
  }, []);

  // Run ATS evaluation
  const runEvaluation = async (
    resume: CanonicalResume,
    jd: string = jobDescription,
    role: string = targetRole
  ) => {
    setEvaluating(true);
    try {
      const breakdown = await evaluateResume(resume, jd, role);
      setScoreBreakdown(breakdown);
    } catch (err: any) {
      console.error('Evaluation error:', err);
    } finally {
      setEvaluating(false);
    }
  };

  // Step 1: File Upload & Parse
  const handleFileUpload = async (selectedFile: File) => {
    setError(null);
    setLoading(true);

    try {
      const result = await parseUploadedResume(selectedFile, jobDescription);
      setCanonicalResume(result.canonical_resume);
      setFileName(selectedFile.name);

      // Save as active resume immediately
      const saved = await saveActiveResume(
        result.canonical_resume,
        targetRole,
        jobDescription,
        selectedFile.name
      );
      setActiveResumeVersion(saved.version);

      // Run initial evaluation
      await runEvaluation(result.canonical_resume, jobDescription, targetRole);
      setStep(2);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Error parsing resume file.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Step 2: Request AI Bullet Rewrites
  const handleFetchRewrites = async (issue: FixIssueItem) => {
    setLoadingRewrites((prev) => ({ ...prev, [issue.id]: true }));
    try {
      const res = await suggestBulletRewrites(
        issue.original_text,
        issue.category,
        issue.section,
        targetRole,
        jobDescription
      );
      setRewritesByIssue((prev) => ({ ...prev, [issue.id]: res.suggestions }));
      if (res.suggestions.length > 0) {
        setSelectedRewriteId((prev) => ({ ...prev, [issue.id]: res.suggestions[0].rewrite_id }));
      }
    } catch (err) {
      console.error('Error fetching bullet rewrites:', err);
    } finally {
      setLoadingRewrites((prev) => ({ ...prev, [issue.id]: false }));
    }
  };

  // Accept a bullet rewrite
  const handleAcceptBulletRewrite = async (issue: FixIssueItem) => {
    if (!canonicalResume) return;

    const suggestions = rewritesByIssue[issue.id] || [];
    const chosenId = selectedRewriteId[issue.id] || (suggestions[0] && suggestions[0].rewrite_id);
    const chosenOption = suggestions.find((s) => s.rewrite_id === chosenId);

    let replacementText = chosenOption ? chosenOption.text : issue.original_text;

    // Plug in candidate's fill-in value if typed
    const fillIn = fillInValues[issue.id];
    if (fillIn && fillIn.trim()) {
      replacementText = replacementText.replace(/\[Fill in:[^\]]+\]/gi, fillIn.trim());
    }

    // Apply replacement into canonical resume bullets
    const updatedResume: CanonicalResume = JSON.parse(JSON.stringify(canonicalResume));
    let replaced = false;

    for (const exp of updatedResume.experience) {
      for (let i = 0; i < exp.bullets.length; i++) {
        if (exp.bullets[i] === issue.original_text || exp.bullets[i].includes(issue.original_text.slice(0, 30))) {
          exp.bullets[i] = replacementText;
          replaced = true;
          break;
        }
      }
      if (replaced) break;
    }

    if (!replaced) {
      for (const proj of updatedResume.projects) {
        for (let i = 0; i < proj.bullets.length; i++) {
          if (proj.bullets[i] === issue.original_text || proj.bullets[i].includes(issue.original_text.slice(0, 30))) {
            proj.bullets[i] = replacementText;
            replaced = true;
            break;
          }
        }
        if (replaced) break;
      }
    }

    setCanonicalResume(updatedResume);
    setAcceptedIssues((prev) => new Set(prev).add(issue.id));

    // Persist and re-evaluate live
    await saveActiveResume(updatedResume, targetRole, jobDescription, fileName);
    await runEvaluation(updatedResume, jobDescription, targetRole);
  };

  // Confirm and add missing skill
  const handleConfirmMissingSkill = async (issue: FixIssueItem) => {
    if (!canonicalResume) return;

    const skillToAdd = issue.original_text.trim();
    if (!skillToAdd) return;

    const updatedResume: CanonicalResume = JSON.parse(JSON.stringify(canonicalResume));
    if (!updatedResume.skills.developer_tools.includes(skillToAdd)) {
      updatedResume.skills.developer_tools.push(skillToAdd);
    }

    setCanonicalResume(updatedResume);
    setAcceptedIssues((prev) => new Set(prev).add(issue.id));

    // Persist and re-evaluate live
    await saveActiveResume(updatedResume, targetRole, jobDescription, fileName);
    await runEvaluation(updatedResume, jobDescription, targetRole);
  };

  // Skip an issue
  const handleSkipIssue = (issueId: string) => {
    setSkippedIssues((prev) => new Set(prev).add(issueId));
  };

  // Manual inline edit
  const handleSaveManualEdit = async (issue: FixIssueItem) => {
    if (!canonicalResume || !manualEditText.trim()) return;

    const updatedResume: CanonicalResume = JSON.parse(JSON.stringify(canonicalResume));
    let replaced = false;

    for (const exp of updatedResume.experience) {
      for (let i = 0; i < exp.bullets.length; i++) {
        if (exp.bullets[i] === issue.original_text) {
          exp.bullets[i] = manualEditText.trim();
          replaced = true;
          break;
        }
      }
      if (replaced) break;
    }

    setCanonicalResume(updatedResume);
    setAcceptedIssues((prev) => new Set(prev).add(issue.id));
    setEditingIssueId(null);
    setManualEditText('');

    await saveActiveResume(updatedResume, targetRole, jobDescription, fileName);
    await runEvaluation(updatedResume, jobDescription, targetRole);
  };

  // Visible fixes filter (exclude accepted and skipped)
  const visibleIssues = (scoreBreakdown?.issues_list || []).filter(
    (issue) => !acceptedIssues.has(issue.id) && !skippedIssues.has(issue.id)
  );

  return (
    <div className="space-y-6 pt-6">
      {/* 3-Step Clean Header Stepper */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Resume Flow Studio
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Upload, improve with truthful AI, and rebuild ATS-friendly.
          </p>
        </div>

        {/* Stepper Indicator */}
        <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl p-1.5 text-xs">
          <button
            onClick={() => setStep(1)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              step === 1
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-cyan-500/30 text-[10px] flex items-center justify-center">1</span>
            Upload
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />

          <button
            onClick={() => canonicalResume && setStep(2)}
            disabled={!canonicalResume}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              step === 2
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : canonicalResume
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-cyan-500/30 text-[10px] flex items-center justify-center">2</span>
            Guided Fixes
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />

          <button
            onClick={() => canonicalResume && setStep(3)}
            disabled={!canonicalResume}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              step === 3
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : canonicalResume
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-cyan-500/30 text-[10px] flex items-center justify-center">3</span>
            Rebuild
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* STEP 1: UPLOAD & ACTIVE RESUME STORAGE */}
      {/* =================================================================== */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* File Upload Stage */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="p-6 border-white/10 bg-white/[0.02]">
              <h2 className="text-base font-semibold text-white mb-1">Upload Resume</h2>
              <p className="text-xs text-slate-400 mb-4">
                Upload your PDF or DOCX resume to extract and verify.
              </p>

              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-white/10 hover:border-cyan-500/40 bg-white/[0.01]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-200">
                  {loading ? 'Parsing resume...' : 'Drop your resume here, or browse'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Supports PDF & DOCX up to 5MB</p>
              </div>

              {/* Already loaded resume notice */}
              {canonicalResume && (
                <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-slate-200">
                      Active: {canonicalResume.contact.full_name} (v{activeResumeVersion})
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setStep(2)}>
                    View Fixes
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Target Role & Optional JD */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="p-6 border-white/10 bg-white/[0.02]">
              <h2 className="text-base font-semibold text-white mb-1">Target Job (Optional)</h2>
              <p className="text-xs text-slate-400 mb-4">
                Paste a target job description for 40% keyword matching.
              </p>

              {/* Preset quick pills */}
              <div className="flex gap-2 mb-3">
                {Object.keys(PRESET_JDS).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTargetRole(PRESET_JDS[key].role);
                      setJobDescription(PRESET_JDS[key].jd);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                  >
                    {PRESET_JDS[key].role.split(' ')[0]}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Target Role Title
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. Full Stack Developer"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Job Description
                  </label>
                  <textarea
                    rows={5}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
                    placeholder="Optional: Paste JD text here..."
                  />
                </div>
              </div>
            </Card>
          </div>
        </motion.div>
      )}

      {/* =================================================================== */}
      {/* STEP 2: GUIDED IMPROVEMENT (LIVE ATS SCORE, FIX LIST, TRUTHFUL REWRITES) */}
      {/* =================================================================== */}
      {step === 2 && scoreBreakdown && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          {/* Top Row: Live ATS Score Gauge + Transparent 5-Factor Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Score Gauge Card */}
            <Card className="lg:col-span-4 p-6 border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-center">
              <ScoreGauge
                score={scoreBreakdown.overall_score}
                size={160}
                label="ATS Score"
                sublabel={scoreBreakdown.overall_score >= 75 ? 'Strong Match' : 'Needs Optimization'}
              />
              <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-center gap-1.5 min-h-[20px]">
                {evaluating ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                    <span className="text-cyan-300">Recalculating ATS score...</span>
                  </>
                ) : (
                  <span>Updates dynamically as you accept verified fixes.</span>
                )}
              </p>
            </Card>

            {/* Factor Scores Grid */}
            <Card className="lg:col-span-8 p-6 border-white/10 bg-white/[0.02] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">5-Factor ATS Scoring</h3>
                  <Badge variant={scoreBreakdown.jd_provided ? 'cyan' : 'amber'}>
                    {scoreBreakdown.jd_provided ? 'With Job Description' : 'Weight Redistributed'}
                  </Badge>
                </div>

                {scoreBreakdown.redistribution_note && (
                  <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                    {scoreBreakdown.redistribution_note}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(scoreBreakdown.factors).map(([key, factor]) => (
                    <div
                      key={key}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-300">{factor.name}</span>
                        <span className="font-semibold text-cyan-400">
                          {factor.score}/100 ({factor.weight_pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden my-1">
                        <div
                          className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, factor.score)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{factor.feedback}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Fix List Section Header */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Actionable Fixes ({visibleIssues.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Sorted by ATS impact. Rewrites never fabricate unverified facts.
              </p>
            </div>

            <Button
              size="sm"
              variant="primary"
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5"
            >
              <span>Build ATS Resume</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Fix Cards List */}
          {visibleIssues.length === 0 ? (
            <Card className="p-8 text-center border-white/10 bg-white/[0.02]">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">All Fixes Completed!</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Your resume satisfies ATS standards. Proceed to generate your clean rebuilt resume.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep(3)}
                className="mt-4"
              >
                Proceed to Rebuild
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {visibleIssues.map((issue) => {
                const isSkillIssue = issue.category === 'missing_skill';
                const rewrites = rewritesByIssue[issue.id] || [];
                const isLoading = loadingRewrites[issue.id] || false;
                const isEditing = editingIssueId === issue.id;

                return (
                  <Card
                    key={issue.id}
                    className="p-5 border-white/10 bg-white/[0.02] hover:border-cyan-500/30 transition-all space-y-3"
                  >
                    {/* Top Row: Title, Impact Badge & Potential Points */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            issue.impact === 'high'
                              ? 'amber'
                              : issue.impact === 'medium'
                              ? 'cyan'
                              : 'slate'
                          }
                        >
                          {issue.impact.toUpperCase()} IMPACT
                        </Badge>
                        <span className="text-xs font-semibold text-white">{issue.title}</span>
                      </div>

                      <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 w-fit">
                        +{issue.potential_points} pts
                      </span>
                    </div>

                    {/* Original Text or Question */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300">
                      {isSkillIssue ? (
                        <div className="space-y-1">
                          <p className="font-medium text-white">Have you used {issue.original_text}?</p>
                          <p className="text-[11px] text-slate-400">
                            Only confirm if you have practical experience. We never add unverified skills.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                            ORIGINAL ({issue.section})
                          </span>
                          <p className="italic text-slate-300">"{issue.original_text}"</p>
                        </div>
                      )}
                    </div>

                    {/* For Bullet Rewrites: AI Suggestions */}
                    {!isSkillIssue && rewrites.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Truthful AI Rewrites (STAR / Google X-Y-Z)
                        </span>

                        <div className="space-y-2">
                          {rewrites.map((opt) => (
                            <label
                              key={opt.rewrite_id}
                              className={`block p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                selectedRewriteId[issue.id] === opt.rewrite_id
                                  ? 'border-cyan-500 bg-cyan-500/10 text-white'
                                  : 'border-white/5 bg-white/[0.01] text-slate-300 hover:border-white/10'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <input
                                  type="radio"
                                  name={`rewrite_${issue.id}`}
                                  checked={selectedRewriteId[issue.id] === opt.rewrite_id}
                                  onChange={() =>
                                    setSelectedRewriteId((prev) => ({
                                      ...prev,
                                      [issue.id]: opt.rewrite_id,
                                    }))
                                  }
                                  className="mt-0.5 accent-cyan-400"
                                />
                                <div className="space-y-1 flex-1">
                                  <p>{opt.text}</p>
                                  {opt.rationale && (
                                    <p className="text-[10px] text-slate-400">{opt.rationale}</p>
                                  )}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>

                        {/* Truth Rule Candidate Fill-In Prompt */}
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                          <label className="text-[11px] font-medium block">
                            Truth Rule: Type your real metric / number (e.g. "35% latency reduction"):
                          </label>
                          <input
                            type="text"
                            value={fillInValues[issue.id] || ''}
                            onChange={(e) =>
                              setFillInValues((prev) => ({
                                ...prev,
                                [issue.id]: e.target.value,
                              }))
                            }
                            placeholder="e.g. 40% reduction, 10,000 requests/sec"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-amber-500/30 text-xs text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>
                    )}

                    {/* Manual Edit Mode */}
                    {isEditing && (
                      <div className="space-y-2 pt-1">
                        <textarea
                          rows={2}
                          value={manualEditText}
                          onChange={(e) => setManualEditText(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-cyan-500/40 text-xs text-white focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="primary" onClick={() => handleSaveManualEdit(issue)}>
                            Save Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingIssueId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons: Accept / Edit / Skip */}
                    {!isEditing && (
                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          {isSkillIssue ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleConfirmMissingSkill(issue)}
                            >
                              Yes, Add Skill
                            </Button>
                          ) : rewrites.length === 0 ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleFetchRewrites(issue)}
                              disabled={isLoading}
                              className="flex items-center gap-1.5"
                            >
                              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                              <span>Suggest Rewrites</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleAcceptBulletRewrite(issue)}
                            >
                              Accept Rewrite
                            </Button>
                          )}

                          {!isSkillIssue && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingIssueId(issue.id);
                                setManualEditText(issue.original_text);
                              }}
                            >
                              Edit
                            </Button>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSkipIssue(issue.id)}
                          className="text-slate-400 hover:text-slate-200"
                        >
                          Skip
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* =================================================================== */}
      {/* STEP 3: ATS REBUILD PREVIEW (STEP 3 PLACEHOLDER FOR PHASE F4) */}
      {/* =================================================================== */}
      {step === 3 && canonicalResume && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          <Card className="p-6 border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Rebuild ATS Resume</h2>
                <p className="text-xs text-slate-400">
                  Ready to export with ATS-safe template and live preview.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setStep(2)}>
                Back to Fixes
              </Button>
            </div>

            {/* Paper Preview Card */}
            <div className="p-8 rounded-xl bg-white text-slate-900 shadow-xl max-w-3xl mx-auto font-sans text-xs space-y-4">
              <div className="text-center border-b pb-3">
                <h3 className="text-lg font-bold tracking-tight text-slate-900">
                  {canonicalResume.contact.full_name}
                </h3>
                <p className="text-[11px] text-slate-600">
                  {canonicalResume.contact.email} • {canonicalResume.contact.phone} • {canonicalResume.contact.location}
                </p>
              </div>

              {canonicalResume.summary && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 border-b pb-0.5 mb-1">
                    Summary
                  </h4>
                  <p className="text-slate-700">{canonicalResume.summary}</p>
                </div>
              )}

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 border-b pb-0.5 mb-1">
                  Technical Skills
                </h4>
                <p className="text-slate-700">
                  <span className="font-semibold">Languages: </span>
                  {canonicalResume.skills.languages.join(', ') || 'None listed'}
                </p>
                <p className="text-slate-700">
                  <span className="font-semibold">Frameworks: </span>
                  {canonicalResume.skills.frameworks.join(', ') || 'None listed'}
                </p>
                <p className="text-slate-700">
                  <span className="font-semibold">Tools & Cloud: </span>
                  {[...canonicalResume.skills.developer_tools, ...canonicalResume.skills.cloud_databases].join(', ') || 'None listed'}
                </p>
              </div>

              {canonicalResume.experience.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 border-b pb-0.5 mb-1">
                    Experience
                  </h4>
                  {canonicalResume.experience.map((exp, idx) => (
                    <div key={idx} className="mb-2">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>{exp.role} • {exp.company}</span>
                        <span>{exp.start_date} - {exp.end_date}</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-700 mt-1">
                        {exp.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button size="sm" variant="primary" onClick={() => setStep(2)}>
                Continue Improving
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default ResumeAnalyzerPage;
