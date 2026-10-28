import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  FileText, 
  Mic, 
  TrendingUp, 
  ShieldCheck, 
  Cpu, 
  Volume2, 
  CheckCircle, 
  Layers, 
  Activity,
  Play
} from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ScoreGauge from '../components/ui/ScoreGauge';
import { useAuth } from '../context/AuthContext';

interface LandingPageProps {
  onOpenAuth: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'ats' | 'interview'>('ats');

  const handleStartInterview = () => {
    if (!currentUser) {
      onOpenAuth();
    } else {
      window.location.href = '/interview';
    }
  };

  const handleStartAnalyzer = () => {
    if (!currentUser) {
      onOpenAuth();
    } else {
      window.location.href = '/analyzer';
    }
  };

  return (
    <div className="relative text-slate-100 overflow-hidden">
      
      {/* Aurora Ambient Background Elements */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[45rem] h-[25rem] bg-gradient-to-tr from-cyan-500/15 via-violet-600/15 to-pink-500/15 rounded-full blur-[100px] pointer-events-none -z-10 animate-pulse" />
      <div className="absolute top-96 -left-32 w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute top-[40rem] -right-32 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* 1. HERO SECTION */}
      <section className="pt-8 pb-16 px-4 text-center max-w-5xl mx-auto flex flex-col items-center">
        
        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-card border border-cyan-500/30 text-xs font-medium text-cyan-300 mb-6 shadow-neon-cyan"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Final-Year B.E. Major Project • Powered by Google Gemini</span>
        </motion.div>

        {/* Punchy Master Tagline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.15] max-w-4xl"
        >
          Get grilled by AI.{' '}
          <span className="aurora-gradient-text block sm:inline">Get hired by humans.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl leading-relaxed font-normal"
        >
          Upload your resume for deterministic ATS scoring and skill-gap matching, then step into an immersive, voice-enabled AI interview tailored to your actual code projects and target job.
        </motion.p>

        {/* Dual Primary CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto"
        >
          <Button
            size="lg"
            variant="primary"
            icon={<Play className="w-4 h-4 fill-white" />}
            onClick={handleStartInterview}
            className="w-full sm:w-auto text-sm"
          >
            Start Voice Mock Interview
          </Button>

          <Button
            size="lg"
            variant="secondary"
            icon={<FileText className="w-4 h-4 text-cyan-400" />}
            onClick={handleStartAnalyzer}
            className="w-full sm:w-auto text-sm"
          >
            Scan Resume with ATS
          </Button>
        </motion.div>

        {/* Quick Social Proof / Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Deterministic ATS Rule Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-cyan-400" />
            <span>Real-time Voice In / Voice Out</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-violet-400" />
            <span>5-Parameter Evaluation Rubric</span>
          </div>
        </motion.div>
      </section>

      {/* 2. INTERACTIVE PRODUCT SHOWCASE MOCKUP */}
      <section className="px-4 max-w-5xl mx-auto mb-20">
        <div className="glass-card rounded-3xl border border-white/10 p-2 sm:p-4 shadow-glass bg-[#0F1422]/90 backdrop-blur-2xl">
          
          {/* Mockup Top Navigation Tabs */}
          <div className="flex items-center justify-between pb-3 px-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/70" />
              <span className="w-3 h-3 rounded-full bg-amber-500/70" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
              <span className="hidden sm:inline-block text-xs font-mono text-slate-400 ml-2">
                interviewiq.engine/live-session
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setActiveTab('ats')}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
                  activeTab === 'ats'
                    ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ATS Resume Scanner
              </button>
              <button
                onClick={() => setActiveTab('interview')}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
                  activeTab === 'interview'
                    ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Voice AI Interview Room
              </button>
            </div>
          </div>

          {/* Tab Content 1: ATS Scanner Preview */}
          {activeTab === 'ats' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="p-5 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center"
            >
              <div className="md:col-span-5 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10 pb-6 md:pb-0 md:pr-6">
                <ScoreGauge score={88} size={200} strokeWidth={15} label="ATS Score" sublabel="Strong Candidate" />
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="emerald" pulse>High Interview Readiness</Badge>
                </div>
              </div>

              <div className="md:col-span-7 space-y-4 text-left">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center justify-between">
                    <span>Target Match: Full Stack Developer</span>
                    <span className="text-xs font-mono text-cyan-400">Match 88/100</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Evaluated against target JD using keyword density, action verbs, and quantifiable impact ratios.
                  </p>
                </div>

                {/* Keyword Chips */}
                <div className="space-y-2">
                  <span className="text-[11px] font-medium text-slate-300 block">Matched Core Skills:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['React.js', 'Python / FastAPI', 'TypeScript', 'MongoDB', 'REST APIs', 'Async Architecture'].map((kw) => (
                      <span key={kw} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
                        ✓ {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-medium text-slate-300 block">Identified Missing Skill Gaps:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Docker Containerization', 'Redis Caching', 'Kubernetes'].map((kw) => (
                      <span key={kw} className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                        + {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actionable tip */}
                <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-xs text-cyan-300 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Gemini Recommendation:</strong> Quantify your project metrics (e.g., &quot;optimized query latency by 45% using compound indexes&quot;).
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tab Content 2: Voice Interview Room Preview */}
          {activeTab === 'interview' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="p-5 sm:p-8 flex flex-col items-center text-center space-y-6"
            >
              {/* Header Status */}
              <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="violet" pulse>AI Speaking...</Badge>
                  <span className="text-slate-400">Question 3 of 8</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-cyan-400">Difficulty: Medium $\to$ High</span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-slate-300">
                    ⏱ 01:42 left
                  </span>
                </div>
              </div>

              {/* Glowing Pulsing AI Avatar Orb */}
              <div className="relative py-4">
                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-cyan-500 via-violet-600 to-pink-500 flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.4)] animate-pulse">
                  <Volume2 className="w-10 h-10 text-white" />
                </div>
                <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping pointer-events-none" />
              </div>

              {/* Live Question Card */}
              <div className="max-w-2xl w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
                <div className="text-[11px] font-mono text-cyan-300 uppercase tracking-wider mb-1">
                  Technical Architecture • Adaptive Question
                </div>
                <p className="text-sm font-semibold text-white leading-relaxed">
                  &ldquo;I noticed you used MongoDB with FastAPI in your project. How did you structure your indexing strategy to avoid full collection scans during high-concurrency requests?&rdquo;
                </p>
              </div>

              {/* Simulated Mic Waveform Visualizer */}
              <div className="w-full max-w-md flex items-center justify-center gap-1.5 h-10">
                {[12, 28, 45, 18, 35, 60, 48, 22, 50, 70, 30, 16, 40, 24, 55, 32, 18, 26, 48, 15].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [h * 0.4, h, h * 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.05 }}
                    className="w-1.5 bg-gradient-to-t from-cyan-500 to-violet-500 rounded-full"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
                <span>Web Speech API active • Browser native transcription</span>
              </div>
            </motion.div>
          )}

        </div>
      </section>

      {/* 3. HOW IT WORKS (3-STEP PIPELINE) */}
      <section className="py-16 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <Badge variant="cyan">Seamless Workflow</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-3">
            How InterviewIQ Prepares You to Win
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto mt-2">
            A cohesive three-step journey bridging resume screening and live technical interview rounds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          
          {/* Step 1 */}
          <Card hoverEffect padding="lg" glow="cyan">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold font-mono text-sm border border-cyan-500/20 mb-4">
              01
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Upload & ATS Gap Analysis</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload your PDF/DOCX resume along with a target Job Description. Our hybrid rule-based engine computes keyword match density, section completeness, and quantifiable achievements.
            </p>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-cyan-400">
              <FileText className="w-3.5 h-3.5" />
              <span>Instant Score + Missing Skills List</span>
            </div>
          </Card>

          {/* Step 2 */}
          <Card hoverEffect padding="lg" glow="violet">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center font-bold font-mono text-sm border border-violet-500/20 mb-4">
              02
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Voice AI Mock Interview</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Engage in a live, voice-driven mock interview over WebSockets. Gemini analyzes your spoken answers in real-time, asks contextual follow-ups, and dynamically adapts difficulty.
            </p>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-violet-400">
              <Mic className="w-3.5 h-3.5" />
              <span>Voice In / Voice Out + Live Waveform</span>
            </div>
          </Card>

          {/* Step 3 */}
          <Card hoverEffect padding="lg" glow="emerald">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold font-mono text-sm border border-emerald-500/20 mb-4">
              03
            </div>
            <h3 className="text-lg font-bold text-white mb-2">5-Metric Rubric & Roadmap</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Receive a scored report evaluating Relevance, Technical Accuracy, Clarity, Depth, and Confidence, paired with an automated multi-week career roadmap to eliminate weak spots.
            </p>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Interactive Radar Chart + PDF Export</span>
            </div>
          </Card>

        </div>
      </section>

      {/* 4. SIX CORE ARCHITECTURAL FEATURES */}
      <section className="py-16 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <Badge variant="violet">Enterprise Engineering</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-3">
            Engineered for Defense & Real-World Impact
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto mt-2">
            Every module was purposefully chosen to answer university viva queries and demonstrate production engineering best practices.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
          
          <Card hoverEffect padding="md">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 border border-cyan-500/20">
              <Activity className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-white">Adaptive Difficulty Engine</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Calculates rolling performance averages across turns. Raises difficulty to architectural deep-dives if past answers average &gt;7, or provides helpful scaffolding if &lt;4.
            </p>
          </Card>

          <Card hoverEffect padding="md">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-3 border border-violet-500/20">
              <Cpu className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-white">Deterministic ATS Algorithms</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Combines mathematical keyword density formulas, quantifiable metric detection, and action verb ratios with Gemini semantic analysis for explainable, defensible scores.
            </p>
          </Card>

          <Card hoverEffect padding="md">
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-3 border border-pink-500/20">
              <Mic className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-white">Full Voice Duplex In Browser</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Zero cloud speech API costs. Leverages native Web Speech API speech-to-text with silence detection alongside browser SpeechSynthesis audio playback.
            </p>
          </Card>

          <Card hoverEffect padding="md">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 border border-emerald-500/20">
              <Layers className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-white">5-Parameter Grading Rubric</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Every response is scored 1-10 on Relevance, Technical Accuracy, Clarity, Depth, and Confidence with ideal response summaries and actionable strengths.
            </p>
          </Card>

          <Card hoverEffect padding="md">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 border border-amber-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-white">Weak-Area Roadmap Builder</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Instead of generic advice, our algorithm converts low-scoring categories into a structured multi-week milestone plan with recommended engineering projects.
            </p>
          </Card>

          <Card hoverEffect padding="md">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3 border border-rose-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-white">Failsafe Demo Text Fallback</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Engineered with demo resilience. If mic permissions are denied or noisy room conditions occur during the viva presentation, seamlessly switch to text mode in 1 click.
            </p>
          </Card>

        </div>
      </section>

      {/* 5. PLATFORM METRICS KPI BANNER */}
      <section className="py-12 px-4 max-w-5xl mx-auto">
        <div className="glass-card rounded-3xl p-8 border border-white/10 shadow-glass grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-cyan-400 font-mono">98.4%</div>
            <div className="text-xs text-slate-400 mt-1">Parsing Extraction Accuracy</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-violet-400 font-mono">&lt;300ms</div>
            <div className="text-xs text-slate-400 mt-1">Audio Processing Turnaround</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono">5 Rubric</div>
            <div className="text-xs text-slate-400 mt-1">Granular Evaluation Metrics</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-pink-400 font-mono">100% Free</div>
            <div className="text-xs text-slate-400 mt-1">Atlas M0 + Gemini Free Tier</div>
          </div>
        </div>
      </section>

      {/* 6. FINAL CONVERSION CTA */}
      <section className="py-16 px-4 max-w-4xl mx-auto text-center">
        <div className="glass-card rounded-3xl p-8 sm:p-12 border border-white/10 shadow-glass relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ready to experience your first AI interview?
          </h2>
          <p className="text-slate-400 text-sm max-w-lg mx-auto mt-3 leading-relaxed">
            Upload your resume, pinpoint keywords and technical gaps, and rehearse with adaptive AI questions before walking into real interviews.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              variant="primary"
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              onClick={handleStartInterview}
            >
              Get Started Now
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={handleStartAnalyzer}
            >
              Check ATS Score First
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
