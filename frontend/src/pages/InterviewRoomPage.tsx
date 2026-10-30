import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Clock,
  Award,
  AlertCircle,
  RefreshCw,
  Zap,
  TrendingUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ScoreGauge from '../components/ui/ScoreGauge';
import AIOrb, { AIOrbState } from '../components/interview/AIOrb';
import MinimalistLoadingVisual from '../components/interview/MinimalistLoadingVisual';
import WebcamVisionTracker from '../components/interview/WebcamVisionTracker';
import { useDeliveryAnalytics } from '../hooks/useDeliveryAnalytics';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import {
  startInterview,
  submitAnswer,
  endInterview,
  QuestionItem,
  AnswerEvaluation,
  SessionSummary,
} from '../services/interviewService';

const PRESET_ROLES = [
  'Full Stack Developer',
  'Backend Python Engineer',
  'Frontend React Engineer',
  'AI / Machine Learning Engineer',
  'DevOps & Cloud Engineer',
  'System Design & Distributed Systems',
];

const SAMPLE_ANSWERS: Record<string, string> = {
  project_deep_dive:
    'In my major project, InterviewIQ, I architected a full-stack AI interview platform using FastAPI and React. I implemented Google Gemini structured JSON mode with multi-tier fallback chains to achieve zero failed evaluations. On the database layer, I used Motor async MongoDB Atlas with compound indexes, maintaining sub-50ms query latencies. I engineered the interview state machine to dynamically adapt difficulty based on rolling answer scores.',
  technical:
    'In FastAPI, asynchronous endpoints run directly on the single-threaded asyncio event loop. When awaiting non-blocking operations like database queries or external API calls, execution yields control back to the event loop to handle concurrent connections. For CPU-intensive operations, we offload processing to thread pools using run_in_threadpool or background Celery task queues to prevent event loop starvation.',
  system_design:
    'To design a high-throughput distributed rate limiter, I would utilize Redis with the Token Bucket algorithm. Using Redis Lua scripts ensures atomic execution of token refills and decrements without race conditions across multiple application server instances. A sliding window counter tracks per-tenant limits with sub-millisecond overhead and graceful degradation if Redis fails.',
  behavioral:
    'In a previous team project, we had a strong disagreement regarding whether to use SQL or NoSQL for our primary datastore. Rather than debating opinions, I created a reproducible benchmark measuring latency and serialization overhead for 5,000 synthetic payloads. The data clearly demonstrated 40% faster writes with MongoDB, allowing the team to align objectively on evidence and ship on time.',
  situational:
    'If a production service starts throwing 500 errors after deployment and rollback fails, my first priority is incident containment. I check APM dashboards and error logs to isolate the failing component, divert traffic via Cloudflare or our load balancer to a static maintenance fallback, and disable recent feature flags before applying an emergency hotfix.',
  default:
    'I approach technical problems by first decomposing requirements, identifying potential bottlenecks and edge cases, and evaluating trade-offs between latency, maintainability, and architectural complexity.',
};

export const InterviewRoomPage: React.FC = () => {
  // Session configuration & state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState('Full Stack Developer');
  const [customRole, setCustomRole] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [initialDifficulty, setInitialDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [currentDifficulty, setCurrentDifficulty] = useState<string>('medium');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionItem | null>(null);

  // Candidate interaction
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Feedback & History
  const [latestEvaluation, setLatestEvaluation] = useState<AnswerEvaluation | null>(null);
  const [turnHistory, setTurnHistory] = useState<
    Array<{
      question: QuestionItem;
      answerText: string;
      evaluation: AnswerEvaluation;
    }>
  >([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<'camera' | 'scorecard'>('camera');

  // Speech Hooks
  const {
    isSpeaking,
    speak,
    stop: stopSpeaking,
    isSupported: isTtsSupported,
  } = useSpeechSynthesis();

  const handleSpeechFinal = useCallback((finalTranscript: string) => {
    setAnswerText(finalTranscript);
  }, []);

  const {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error: sttError,
  } = useSpeechRecognition(handleSpeechFinal);

  // Multimodal Vision & Delivery Analytics
  const { metrics: deliveryMetrics, recordEyeContact, updatePosture } = useDeliveryAnalytics(
    answerText + ' ' + (interimTranscript || ''),
    timerSeconds
  );

  // Auto-scroll anchor
  const feedbackRef = useRef<HTMLDivElement>(null);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine living AI Orb state
  const getOrbState = (): AIOrbState => {
    if (submitting) return 'thinking';
    if (isSpeaking) return 'speaking';
    if (isListening) return 'listening';
    return 'idle';
  };

  // Auto-speak new question when it arrives
  useEffect(() => {
    if (sessionActive && currentQuestion && isTtsSupported) {
      // Delay slightly for smooth page transition
      const timeout = setTimeout(() => {
        speak(currentQuestion.question_text);
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [currentQuestion, sessionActive, isTtsSupported, speak]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
    };
  }, [stopSpeaking, stopListening]);

  // Start interview handler
  const handleStartInterview = async () => {
    setStarting(true);
    setErrorMessage(null);
    try {
      const selectedRole = customRole.trim() || targetRole;
      const resp = await startInterview({
        target_role: selectedRole,
        total_questions: totalQuestions,
        initial_difficulty: initialDifficulty,
        resume_text:
          'Candidate with experience in Python, FastAPI, React, TypeScript, and MongoDB Atlas. Major project: InterviewIQ AI Platform.',
      });

      setSessionId(resp.session_id);
      setCurrentQuestion(resp.first_question);
      setCurrentQuestionIndex(1);
      setCurrentDifficulty(resp.current_difficulty);
      setSessionActive(true);
      setSessionSummary(null);
      setTurnHistory([]);
      setLatestEvaluation(null);
      setAnswerText('');
      resetTranscript();
      setTimerSeconds(0);
      setIsTimerRunning(true);
    } catch (err: any) {
      console.error('Failed to start interview:', err);
      setErrorMessage(
        err.response?.data?.detail || 'Unable to connect to AI Interview Room. Please sign in.'
      );
    } finally {
      setStarting(false);
    }
  };

  // Submit answer handler
  const handleSubmitAnswer = async () => {
    stopListening();
    stopSpeaking();

    const fullAnswer = (answerText + (interimTranscript ? ' ' + interimTranscript : '')).trim();

    if (!sessionId || !currentQuestion || fullAnswer.length < 5) {
      setErrorMessage('Please provide a substantive answer (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const resp = await submitAnswer(sessionId, {
        answer_text: fullAnswer,
        duration_seconds: timerSeconds,
      });

      // Record turn history
      const completedTurn = {
        question: currentQuestion,
        answerText: fullAnswer,
        evaluation: resp.evaluation,
      };
      setTurnHistory((prev) => [...prev, completedTurn]);
      setLatestEvaluation(resp.evaluation);
      setCurrentDifficulty(resp.current_difficulty);

      if (resp.is_complete || !resp.next_question) {
        // Finalize interview
        setIsTimerRunning(false);
        const summary = await endInterview(sessionId);
        setSessionSummary(summary);
        setSessionActive(false);
      } else {
        // Move to next question
        setCurrentQuestion(resp.next_question);
        setCurrentQuestionIndex(resp.next_question.question_index);
        setAnswerText('');
        resetTranscript();
        setTimerSeconds(0);
      }

      // Smooth scroll to feedback
      setTimeout(() => {
        feedbackRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      console.error('Turn submission failed:', err);
      setErrorMessage(err.response?.data?.detail || 'Evaluation failed. Please try submitting again.');
    } finally {
      setSubmitting(false);
    }
  };

  // End interview early
  const handleEndEarly = async () => {
    if (!sessionId) return;
    if (window.confirm('Are you sure you want to end this mock interview session?')) {
      try {
        stopListening();
        stopSpeaking();
        setIsTimerRunning(false);
        const summary = await endInterview(sessionId);
        setSessionSummary(summary);
        setSessionActive(false);
      } catch (err) {
        console.error('Failed to end interview:', err);
      }
    }
  };

  // Quick fill sample answer helper
  const handleFillSample = () => {
    stopListening();
    const category = currentQuestion?.question_category || 'default';
    const sample = SAMPLE_ANSWERS[category] || SAMPLE_ANSWERS.default;
    setAnswerText(sample);
  };

  // Toggle speech recording
  const handleToggleVoiceRecording = () => {
    if (isListening) {
      stopListening();
    } else {
      stopSpeaking(); // stop AI speech if playing
      startListening();
    }
  };

  // Difficulty badge color
  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'easy':
        return 'emerald';
      case 'hard':
        return 'rose';
      default:
        return 'cyan';
    }
  };

  // Rubric bar score color
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-emerald-500';
    if (score >= 6) return 'bg-cyan-500';
    if (score >= 4) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="w-full py-4 space-y-4">
      {/* =========================================================================
          VIEW 1: SETUP SCREEN
         ========================================================================= */}
      {!sessionActive && !sessionSummary && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          {starting ? (
            <Card glow="cyan" padding="lg" className="border-cyan-500/20 bg-slate-900/60 backdrop-blur-xl py-16">
              <MinimalistLoadingVisual
                mode="connecting"
                title="Initializing Interview Room"
                subtitle={`Setting up adaptive questions for ${customRole || targetRole}...`}
              />
            </Card>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Start interview
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Adaptive technical mock session
                </p>
              </div>

              <Card glow="cyan" padding="lg" className="border-cyan-500/20 bg-slate-900/60 backdrop-blur-xl space-y-5">
                {/* Target Role Selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Target role
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {PRESET_ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          setTargetRole(role);
                          setCustomRole('');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          targetRole === role && !customRole
                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="Or specify custom position..."
                    className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                {/* Length & Difficulty */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Questions
                    </label>
                    <div className="flex gap-2">
                      {[3, 5, 8].map((qCount) => (
                        <button
                          key={qCount}
                          type="button"
                          onClick={() => setTotalQuestions(qCount)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            totalQuestions === qCount
                              ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                              : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {qCount}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Difficulty
                    </label>
                    <div className="flex gap-2">
                      {(['easy', 'medium', 'hard'] as const).map((diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => setInitialDifficulty(diff)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-all ${
                            initialDifficulty === diff
                              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                              : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleStartInterview}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Start interview
                </Button>
              </Card>
            </>
          )}
        </motion.div>
      )}

      {/* =========================================================================
          VIEW 2: ACTIVE INTERVIEW ROOM WITH MINIMALIST DUAL STAGE
         ========================================================================= */}
      {sessionActive && currentQuestion && (
        <div className="space-y-4">
          {/* Sleek Minimal Header Bar */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-white font-mono">
                Q{currentQuestionIndex}/{totalQuestions}
              </span>
              <Badge variant={getDifficultyColor(currentDifficulty) as any} size="sm">
                {currentDifficulty.toUpperCase()}
              </Badge>
              <span className="hidden sm:inline text-xs text-slate-400 font-medium">
                {customRole || targetRole}
              </span>
            </div>

            {/* Stepper Progress Line */}
            <div className="hidden md:block flex-1 max-w-xs mx-4">
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-violet-400 h-full transition-all duration-500"
                  style={{ width: `${(currentQuestionIndex / totalQuestions) * 100}%` }}
                />
              </div>
            </div>

            {/* Timer & Subtle End Link */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-cyan-300 font-mono text-xs">
                <Clock className="w-3.5 h-3.5" />
                {formatTimer(timerSeconds)}
              </div>

              <button
                type="button"
                onClick={handleEndEarly}
                className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                title="End interview early"
              >
                End
              </button>
            </div>
          </div>

          {/* Balanced Dual Stage: AI Interviewer (Left) & Candidate Stage (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Stage Tile: AI Interviewer */}
            <div className="h-[360px] rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden">
              {/* Top Row: AI Status & Subtle Replay */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                    AI Interviewer
                  </span>
                  <Badge variant="violet" size="sm">
                    {currentQuestion.question_category.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isSpeaking) {
                      stopSpeaking();
                    } else {
                      speak(currentQuestion.question_text);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-cyan-400 transition-colors"
                  title={isSpeaking ? 'Stop voice' : 'Replay question audio'}
                >
                  {isSpeaking ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Center: Minimalist Evaluating Waveform OR Living AI Orb */}
              <AnimatePresence mode="wait">
                {submitting ? (
                  <motion.div
                    key="evaluating"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex items-center justify-center"
                  >
                    <MinimalistLoadingVisual
                      mode="evaluating"
                      title="Calibrating Evaluation"
                      subtitle="Benchmarking against L5 rubric standards..."
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="orb"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col items-center justify-center py-1"
                  >
                    <AIOrb
                      state={getOrbState()}
                      size={74}
                      onClick={() => {
                        if (isSpeaking) {
                          stopSpeaking();
                        } else {
                          speak(currentQuestion.question_text);
                        }
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom: Question Text with AnimatePresence Smoothness */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestion.question_id || currentQuestionIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="p-3.5 rounded-xl bg-black/40 border border-white/5"
                >
                  <h3 className="text-sm sm:text-base font-medium text-white leading-relaxed">
                    "{currentQuestion.question_text}"
                  </h3>
                  {currentQuestion.context_note && (
                    <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Sparkles className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                      <span className="truncate">{currentQuestion.context_note}</span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right Stage Tile: Candidate Camera HUD / Feedback Scorecard */}
            <div className="h-[360px] rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl relative overflow-hidden flex flex-col" ref={feedbackRef}>
              {/* Floating Minimalist Score Pill if latest evaluation exists */}
              {latestEvaluation && (
                <div className="absolute top-2.5 right-12 z-20">
                  <button
                    type="button"
                    onClick={() => setRightPanelTab(rightPanelTab === 'camera' ? 'scorecard' : 'camera')}
                    className="px-2.5 py-1 rounded-full bg-black/75 hover:bg-black/95 border border-white/20 text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 transition-all shadow-lg backdrop-blur-md"
                    title={rightPanelTab === 'camera' ? 'View last rubric evaluation' : 'View live camera feed'}
                  >
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    {rightPanelTab === 'camera'
                      ? `Score: ${latestEvaluation.average_score.toFixed(1)}/10 ▾`
                      : 'Back to Camera'}
                  </button>
                </div>
              )}

              {/* Tile Content with AnimatePresence */}
              <AnimatePresence mode="wait">
                {rightPanelTab === 'camera' || !latestEvaluation ? (
                  <motion.div
                    key="camera"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="h-full flex-1 min-h-0"
                  >
                    <WebcamVisionTracker
                      isActive={sessionActive}
                      deliveryMetrics={deliveryMetrics}
                      onRecordEyeContact={recordEyeContact}
                      onUpdatePosture={updatePosture}
                      className="h-full border-0 rounded-none shadow-none bg-transparent"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="scorecard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="h-full overflow-y-auto p-4 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div>
                        <div className="text-[11px] font-mono text-violet-400 uppercase">
                          Turn {turnHistory.length} Rubric
                        </div>
                        <div className="text-sm font-bold text-white">Evaluation Breakdown</div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-cyan-400">
                          {latestEvaluation.average_score.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-400"> / 10</span>
                      </div>
                    </div>

                    {/* 5 Rubric Bars */}
                    <div className="space-y-2">
                      {[
                        { label: 'Relevance', score: latestEvaluation.scores.relevance },
                        { label: 'Technical Accuracy', score: latestEvaluation.scores.technical_accuracy },
                        { label: 'Clarity & Structure', score: latestEvaluation.scores.clarity },
                        { label: 'Technical Depth', score: latestEvaluation.scores.depth },
                        { label: 'Confidence', score: latestEvaluation.scores.confidence },
                      ].map((rubric) => (
                        <div key={rubric.label}>
                          <div className="flex justify-between text-slate-300 text-[11px] mb-0.5">
                            <span>{rubric.label}</span>
                            <span className="font-semibold text-white">{rubric.score}/10</span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${getScoreColor(rubric.score)}`}
                              style={{ width: `${(rubric.score / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Feedback Note */}
                    <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] text-slate-300 leading-relaxed">
                      <strong className="text-white block mb-0.5">Evaluator Notes:</strong>
                      {latestEvaluation.feedback}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom Response Console: Unified Minimalist Capsule */}
          <Card padding="md" className="border-white/10 bg-slate-900/60 backdrop-blur-xl">
            <div className="space-y-2">
              {/* Input Capsule with Integrated Mic & Actions */}
              <div className="relative rounded-2xl bg-black/40 border border-white/10 focus-within:border-cyan-500/40 transition-colors p-2.5 flex items-start gap-3">
                {/* Glowing Mic Toggle */}
                <button
                  type="button"
                  onClick={handleToggleVoiceRecording}
                  className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center transition-all ${
                    isListening
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 animate-pulse'
                      : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white'
                  }`}
                  title={isListening ? 'Stop recording' : 'Click to answer via voice'}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Textarea / Voice Stream */}
                <div className="flex-1 min-w-0">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder={
                      isListening
                        ? 'Listening... words will stream here as you speak.'
                        : 'Click mic to speak, or type your technical response here...'
                    }
                    rows={2}
                    className="w-full bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none leading-relaxed resize-none font-sans"
                  />

                  {interimTranscript && (
                    <div className="text-emerald-400 text-xs italic flex items-center gap-1.5 pt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      "{interimTranscript}"
                    </div>
                  )}
                </div>

                {/* Right Action Cluster */}
                <div className="flex items-center gap-1.5 self-end">
                  <button
                    type="button"
                    onClick={handleFillSample}
                    className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-colors"
                    title="Fill sample answer"
                  >
                    <Zap className="w-4 h-4" />
                  </button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSubmitAnswer}
                    disabled={submitting || (answerText.trim().length + (interimTranscript?.length || 0)) < 5}
                    className="h-9 px-3.5 flex items-center gap-1.5 text-xs font-semibold"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Evaluating</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Status footer: Word count & Mic state */}
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  {isListening && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Microphone active
                    </span>
                  )}
                  {sttError && <span className="text-amber-400">{sttError}</span>}
                </div>

                <span>
                  {answerText.trim() ? answerText.trim().split(/\s+/).length : 0} words
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="mt-2 p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errorMessage}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: INTERVIEW COMPLETION SUMMARY
         ========================================================================= */}
      {sessionSummary && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="max-w-4xl mx-auto space-y-6"
        >
          <Card glow="emerald" padding="lg" className="border-emerald-500/20 text-center py-10">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8" />
            </div>

            <Badge variant="emerald" pulse className="mb-2">
              Mock Interview Completed
            </Badge>
            <h2 className="text-3xl font-extrabold text-white">
              Performance Evaluation Report
            </h2>
            <p className="text-slate-300 text-sm max-w-md mx-auto mt-2">
              You completed all {sessionSummary.completed_turns} questions for the position of{' '}
              <strong className="text-cyan-400">{sessionSummary.target_role}</strong>.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-8">
              <ScoreGauge
                score={Math.round(sessionSummary.overall_average_score * 10)}
                size={140}
                strokeWidth={12}
                label="Overall"
                sublabel="Score %"
              />

              <div className="text-left space-y-2">
                <div className="text-xs text-slate-400">
                  Adaptive Difficulty Reached:{' '}
                  <span className="font-semibold text-white capitalize">
                    {sessionSummary.difficulty_progression.slice(-1)[0]}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Questions Answered:{' '}
                  <span className="font-semibold text-white">
                    {sessionSummary.completed_turns} of {sessionSummary.total_questions}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Recommendation:{' '}
                  <span className="font-semibold text-emerald-400">
                    {sessionSummary.overall_average_score >= 7.5
                      ? 'Strong Hire Profile'
                      : sessionSummary.overall_average_score >= 6.0
                      ? 'Hire Profile (Minor Gaps)'
                      : 'Needs Foundational Review'}
                  </span>
                </div>
              </div>
            </div>

            {/* Multimodal Delivery Summary */}
            <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[11px] text-slate-400 font-mono block">Direct Eye Contact</span>
                <span className="text-xl font-bold text-cyan-400 font-mono mt-1 block">
                  {deliveryMetrics.eyeContactScore}%
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Camera engagement</span>
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[11px] text-slate-400 font-mono block">Speech Fillers</span>
                <span className="text-xl font-bold text-emerald-400 font-mono mt-1 block">
                  {deliveryMetrics.fillerCount} detected
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5 capitalize">
                  Rating: {deliveryMetrics.fillerRating}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[11px] text-slate-400 font-mono block">Speaking Pace</span>
                <span className="text-xl font-bold text-violet-400 font-mono mt-1 block">
                  {deliveryMetrics.wpm > 0 ? `${deliveryMetrics.wpm} WPM` : '135 WPM'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5 capitalize">
                  Cadence: {deliveryMetrics.pacingStatus}
                </span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  setSessionSummary(null);
                  setSessionActive(false);
                }}
              >
                New interview
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  window.location.href = '/analyzer';
                }}
              >
                Scan resume
              </Button>
            </div>
          </Card>

          {/* Turn History Breakdown */}
          {turnHistory.length > 0 && (
            <Card padding="lg" className="border-white/10">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Question-by-Question Breakdown
              </h3>
              <div className="space-y-4">
                {turnHistory.map((turn, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">
                        Q{idx + 1}: {turn.question.question_category.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono font-semibold">
                        Score: {turn.evaluation.average_score.toFixed(1)}/10
                      </span>
                    </div>
                    <p className="text-slate-400 italic">"{turn.question.question_text}"</p>
                    <p className="text-slate-300 font-sans">{turn.evaluation.feedback}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default InterviewRoomPage;
