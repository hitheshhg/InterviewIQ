import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  Check, 
  Plus, 
  Briefcase, 
  Mic
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ScoreGauge from '../components/ui/ScoreGauge';
import { api } from '../services/api';

interface ATSAnalysis {
  overall_score: number;
  breakdown: {
    keyword_match_score: number;
    section_completeness_score: number;
    formatting_score: number;
    action_verbs_score: number;
    quantifiable_impact_score: number;
  };
  matched_keywords: string[];
  missing_keywords: string[];
  actionable_tips: string[];
  target_role: string;
  parsed_data: {
    candidate_name: string;
    contact?: {
      email?: string;
      phone?: string;
    };
    technical_skills: string[];
    experience: Array<{
      role: string;
      company: string;
    }>;
  };
}

const PRESET_JDS: Record<string, { role: string; jd: string }> = {
  fullstack: {
    role: 'Full Stack Developer',
    jd: `We are looking for a Full Stack Software Engineer proficient in Python, FastAPI, React, TypeScript, and MongoDB Atlas. The candidate will design resilient microservices, build responsive frontend user interfaces, optimize database queries with indexing, and automate Docker deployments. Knowledge of Redis caching and WebSockets is highly desired.`,
  },
  backend: {
    role: 'Backend Systems Engineer',
    jd: `Seeking a Backend Engineer experienced in Python, FastAPI, PostgreSQL, Redis, and distributed systems. Responsible for high-concurrency API architecture, asynchronous worker pools, relational schema optimization, and Docker container orchestration. Experience with Kafka and microservices architecture is preferred.`,
  },
  frontend: {
    role: 'Frontend UI/UX Engineer',
    jd: `Looking for a Senior Frontend Engineer specialized in React 18, TypeScript, Tailwind CSS, and state management. You will construct high-performance web applications, implement micro-interactions using Framer Motion, optimize Lighthouse core web vitals, and integrate WebSocket real-time feeds.`,
  },
};

const SAMPLE_RESUME_TEXT = `Hithesh HG
Full Stack Software Engineer
Email: hitheshhg@gmail.com | Phone: +91 9876543210 | GitHub: github.com/hitheshhg | LinkedIn: linkedin.com/in/hitheshhg

SUMMARY
Results-driven Full Stack Developer with expertise in building scalable, real-time web applications using Python, FastAPI, React, TypeScript, and MongoDB.

TECHNICAL SKILLS
Languages: Python, TypeScript, JavaScript, SQL
Frameworks: FastAPI, React.js, Tailwind CSS, Node.js
Databases & Cloud: MongoDB Atlas, Redis, PostgreSQL, Docker, AWS
Tools: Git, Pytest, WebSockets

EXPERIENCE
Senior Full Stack Developer | Tech Innovations (2023 - Present)
• Architected and deployed microservices backend using FastAPI and MongoDB, handling over 10,000 requests per minute with 99.9% uptime.
• Reduced API endpoint response times by 45% through implementation of Redis caching and compound database indexing strategies.
• Engineered responsive frontend user interfaces with React and TypeScript, boosting user engagement metrics by 30%.
• Automated CI/CD deployment pipelines using Docker and GitHub Actions, cutting release turnaround time from 2 hours to 15 minutes.

PROJECTS
InterviewIQ - Voice AI Mock Interview Platform
• Built real-time WebSocket interview platform with Web Speech API audio processing and Google Gemini structured evaluation.
• Implemented deterministic ATS scoring engine analyzing keyword density, action verbs, and quantified metric achievements.

EDUCATION
Bachelor of Engineering in Computer Science & Engineering (2020 - 2024)
Visvesvaraya Technological University (VTU) | CGPA: 8.9/10`;

export const ResumeAnalyzerPage: React.FC = () => {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [targetRole, setTargetRole] = useState('Full Stack Developer');
  const [jobDescription, setJobDescription] = useState(PRESET_JDS.fullstack.jd);
  const [activePreset, setActivePreset] = useState<string>('fullstack');

  // UI Processing State
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ATSAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Set Preset JD
  const handleSelectPreset = (key: string) => {
    setActivePreset(key);
    setTargetRole(PRESET_JDS[key].role);
    setJobDescription(PRESET_JDS[key].jd);
  };

  // Drag and Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (selectedFile: File) => {
    setError(null);
    const validExtensions = ['.pdf', '.docx'];
    const hasValidExt = validExtensions.some((ext) => selectedFile.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      setError('Please upload a PDF or DOCX resume document.');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size exceeds the 5MB limit.');
      return;
    }

    setFile(selectedFile);
  };

  // Submit Upload & Analysis
  const handleAnalyze = async () => {
    setError(null);
    setAnalyzing(true);
    setAnalysis(null);

    try {
      if (file) {
        // Multipart Form Upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('target_role', targetRole);
        formData.append('job_description', jobDescription);

        const headers: Record<string, string> = { 'Content-Type': 'multipart/form-data' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await api.post('/api/v1/resume/upload', formData, { headers });
        setAnalysis(res.data.ats_analysis);
      } else {
        // Fallback: Analyze Sample Resume Text directly
        const params = new URLSearchParams();
        params.append('resume_text', SAMPLE_RESUME_TEXT);
        params.append('target_role', targetRole);
        params.append('job_description', jobDescription);

        const res = await api.post('/api/v1/resume/analyze-text', params);
        setAnalysis(res.data);
      }
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { detail?: string } } };
      setError(
        errorResponse.response?.data?.detail ||
          'Failed to complete resume analysis. Please verify your file format.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // Quick Demo: Load and analyze Sample Resume immediately
  const handleLoadSampleResume = () => {
    setFile(null);
    handleAnalyze();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-slate-100">
      
      {/* Header */}
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Resume ATS Scanner
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Upload your resume to evaluate keyword match.
        </p>
      </div>

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        
        {/* Left Column: File Upload Area (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card padding="md" glow="cyan">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Resume document
              </span>
              <button
                type="button"
                onClick={handleLoadSampleResume}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Use sample
              </button>
            </h3>

            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
                dragActive
                  ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                  : file
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-white/10 hover:border-cyan-500/40 hover:bg-white/[0.02]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
              />

              {file ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Check className="w-6 h-6" />
                  </div>
                  <div className="font-semibold text-sm text-white">{file.name}</div>
                  <div className="text-xs text-slate-400 font-mono">
                    {Math.round(file.size / 1024)} KB • Click or drop another file to replace
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-white/5 text-cyan-400 flex items-center justify-center border border-white/10 group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white">Click to upload</span> or drag and drop
                  </div>
                  <div className="text-xs text-slate-400">
                    PDF or DOCX documents up to 5MB (Text-based with standard fonts recommended)
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Target Job Description (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card padding="md" glow="violet">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-violet-400" />
              Target Job Description (JD)
            </h3>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Object.keys(PRESET_JDS).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectPreset(key)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                    activePreset === key
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/40 font-semibold'
                      : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'
                  }`}
                >
                  {PRESET_JDS[key].role}
                </button>
              ))}
            </div>

            <textarea
              rows={6}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste target job description or requirements here..."
              className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 resize-none font-sans leading-relaxed"
            />

            <Button
              variant="primary"
              size="md"
              loading={analyzing}
              icon={<Sparkles className="w-4 h-4" />}
              onClick={handleAnalyze}
              className="w-full mt-3"
            >
              {analyzing ? 'Scanning...' : 'Scan resume'}
            </Button>
          </Card>
        </div>

      </div>

      {/* Analysis Results Section */}
      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            {/* Top Score Banner Card */}
            <Card padding="lg" glow="emerald" className="bg-[#0e1320]/95 border-emerald-500/30">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                
                {/* Score Gauge */}
                <div className="md:col-span-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10 pb-6 md:pb-0">
                  <ScoreGauge
                    score={analysis.overall_score}
                    size={210}
                    strokeWidth={16}
                    label="Overall ATS Score"
                    sublabel={analysis.target_role}
                  />
                  <div className="mt-4">
                    <Badge variant={analysis.overall_score >= 75 ? 'emerald' : analysis.overall_score >= 50 ? 'cyan' : 'amber'} pulse>
                      {analysis.overall_score >= 75 ? 'Strong Interview Candidate' : analysis.overall_score >= 50 ? 'Moderate Match Rate' : 'Needs Optimization'}
                    </Badge>
                  </div>
                </div>

                {/* Section-Wise Breakdown Progress Bars */}
                <div className="md:col-span-8 space-y-4 text-left">
                  <div>
                    <h3 className="text-xl font-bold text-white">ATS Scoring Breakdown</h3>
                    <p className="text-xs text-slate-400">
                      Computed via deterministic mathematical rules (weights: 35% keywords, 20% sections, 15% metrics, 15% action verbs, 15% formatting).
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    {[
                      { name: 'Keyword Match Coverage', score: analysis.breakdown.keyword_match_score, color: 'from-cyan-500 to-blue-500' },
                      { name: 'Section Completeness', score: analysis.breakdown.section_completeness_score, color: 'from-emerald-500 to-teal-500' },
                      { name: 'Quantifiable Metrics & Numbers', score: analysis.breakdown.quantifiable_impact_score, color: 'from-violet-500 to-purple-500' },
                      { name: 'Technical Action Verbs', score: analysis.breakdown.action_verbs_score, color: 'from-amber-500 to-orange-500' },
                      { name: 'Formatting & Contact Info', score: analysis.breakdown.formatting_score, color: 'from-pink-500 to-rose-500' },
                    ].map((item) => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300 font-medium">{item.name}</span>
                          <span className="font-mono text-cyan-300 font-bold">{Math.round(item.score)}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.score}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </Card>

            {/* Keyword Match Matrix Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              
              {/* Matched Keywords */}
              <Card padding="md" glow="emerald">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Matched Core Keywords ({analysis.matched_keywords.length})</h4>
                    <p className="text-[11px] text-slate-400">Technical skills verified in both resume and target JD</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {analysis.matched_keywords.map((kw) => (
                    <span
                      key={kw}
                      className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono flex items-center gap-1"
                    >
                      <Check className="w-3 h-3 text-emerald-400" />
                      {kw}
                    </span>
                  ))}
                  {analysis.matched_keywords.length === 0 && (
                    <span className="text-xs text-slate-500 italic">No direct keyword overlap detected.</span>
                  )}
                </div>
              </Card>

              {/* Missing Keywords */}
              <Card padding="md" glow="amber">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Missing Skill Gaps ({analysis.missing_keywords.length})</h4>
                    <p className="text-[11px] text-slate-400">Required by job description; consider adding where applicable</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {analysis.missing_keywords.map((kw) => (
                    <span
                      key={kw}
                      className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 text-amber-400" />
                      {kw}
                    </span>
                  ))}
                  {analysis.missing_keywords.length === 0 && (
                    <span className="text-xs text-emerald-400">Exceptional coverage! No missing required skills.</span>
                  )}
                </div>
              </Card>

            </div>

            {/* Actionable Gemini Recommendations */}
            <Card padding="md" glow="cyan" className="text-left">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Gemini Actionable Optimization Roadmap</h4>
                  <p className="text-[11px] text-slate-400">Targeted recommendations to raise your ATS score before applying</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {analysis.actionable_tips.map((tip, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300 flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-md bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-mono text-[10px] flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{tip}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Gateway CTA to Mock Interview */}
            <Card padding="md" glow="violet" className="text-center relative overflow-hidden bg-gradient-to-r from-cyan-950/40 via-violet-950/40 to-slate-900 border-violet-500/30">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Practice your interview
              </h3>
              <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1">
                Roleplay realistic questions based on your resume.
              </p>

              <div className="mt-4 flex justify-center">
                <Button
                  size="md"
                  variant="primary"
                  icon={<Mic className="w-4 h-4" />}
                  onClick={() => window.location.href = '/interview'}
                >
                  Start interview
                </Button>
              </div>
            </Card>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ResumeAnalyzerPage;
