import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Clock,
  Award,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Zap,
  TrendingUp,
  FileText,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ScoreGauge from '../components/ui/ScoreGauge';
import AIOrb, { AIOrbState } from '../components/interview/AIOrb';
import VoiceVisualizer from '../components/interview/VoiceVisualizer';
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

  // Voice vs Text Mode Toggle
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [autoSpeakQuestion, setAutoSpeakQuestion] = useState(true);

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
    isSupported: isSttSupported,
    error: sttError,
  } = useSpeechRecognition(handleSpeechFinal);

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

  // Auto-speak new question when it arrives in Voice Mode
  useEffect(() => {
    if (sessionActive && currentQuestion && autoSpeakQuestion && isTtsSupported) {
      // Delay slightly for smooth page transition
      const timeout = setTimeout(() => {
        speak(currentQuestion.question_text);
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [currentQuestion, sessionActive, autoSpeakQuestion, isTtsSupported, speak]);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* =========================================================================
          VIEW 1: SETUP SCREEN
         ========================================================================= */}
      {!sessionActive && !sessionSummary && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-3xl mx-auto"
        >
          <div className="text-center mb-8">
            <Badge variant="cyan" pulse className="mb-3">
              Phase 8 • Voice AI Mock Interview
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Voice AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400">Mock Interview Room</span>
            </h1>
            <p className="mt-3 text-slate-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Real-time voice conversation with our adaptive AI interviewer. Speak naturally with real-time speech transcription, natural text-to-speech, and responsive AI Orb presence.
            </p>
          </div>

          <Card glow="cyan" padding="lg" className="border-cyan-500/20 bg-slate-900/60 backdrop-blur-xl">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              Configure Interview Session
            </h2>

            {/* Target Role Selector */}
            <div className="mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Target Role Preset
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
                placeholder="Or specify custom position (e.g. Lead SRE / Cloud Architect)..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Interview Length & Initial Difficulty */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Session Length
                </label>
                <div className="flex gap-3">
                  {[3, 5, 8].map((qCount) => (
                    <button
                      key={qCount}
                      type="button"
                      onClick={() => setTotalQuestions(qCount)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        totalQuestions === qCount
                          ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                          : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {qCount} Questions
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Starting Difficulty
                </label>
                <div className="flex gap-3">
                  {(['easy', 'medium', 'hard'] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setInitialDifficulty(diff)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
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

            {/* Voice Mode Preference */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Enable Hands-Free Voice Mode</div>
                  <div className="text-[11px] text-slate-400">
                    Interviewer speaks questions aloud and transcribes your microphone input.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVoiceMode(!isVoiceMode)}
                className={`w-12 h-6 rounded-full transition-colors relative p-1 ${
                  isVoiceMode ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <motion.div
                  animate={{ x: isVoiceMode ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="w-4 h-4 rounded-full bg-white shadow-md"
                />
              </button>
            </div>

            {/* Resume Context Notification */}
            <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 flex items-start gap-3 mb-6">
              <FileText className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-cyan-300">Resume-Aware Interviewing:</span>{' '}
                The AI interviewer reads your technical skills and project experiences from your profile to formulate targeted deep-dive questions.
              </div>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMessage}
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              onClick={handleStartInterview}
              disabled={starting}
              className="w-full flex items-center justify-center gap-2"
            >
              {starting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Opening Question...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Enter AI Interview Room
                </>
              )}
            </Button>
          </Card>
        </motion.div>
      )}

      {/* =========================================================================
          VIEW 2: ACTIVE INTERVIEW ROOM WITH LIVING AI ORB & VOICE CONTROLS
         ========================================================================= */}
      {sessionActive && currentQuestion && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                {isListening ? (
                  <Mic className="w-5 h-5 animate-pulse text-emerald-400" />
                ) : isSpeaking ? (
                  <Volume2 className="w-5 h-5 animate-pulse text-sky-400" />
                ) : (
                  <Radio className="w-5 h-5 text-cyan-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    Question {currentQuestionIndex} of {totalQuestions}
                  </span>
                  <Badge variant={getDifficultyColor(currentDifficulty) as any} size="sm">
                    {currentDifficulty.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-xs text-slate-400">{customRole || targetRole}</div>
              </div>
            </div>

            {/* Stepper Progress Line */}
            <div className="hidden sm:block flex-1 max-w-xs mx-4">
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-violet-400 h-full transition-all duration-500"
                  style={{ width: `${(currentQuestionIndex / totalQuestions) * 100}%` }}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Voice / Text Mode Toggle Pill */}
              <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setIsVoiceMode(true)}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                    isVoiceMode
                      ? 'bg-cyan-500 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Mic className="w-3 h-3" /> Voice
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsVoiceMode(false);
                    stopListening();
                    stopSpeaking();
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                    !isVoiceMode
                      ? 'bg-violet-500 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3 h-3" /> Text
                </button>
              </div>

              {/* Timer */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-cyan-300 font-mono text-xs">
                <Clock className="w-3.5 h-3.5" />
                {formatTimer(timerSeconds)}
              </div>

              <Button variant="danger" size="sm" onClick={handleEndEarly}>
                End Early
              </Button>
            </div>
          </div>

          {/* Main Stage: AI Interviewer Orb + Question + Candidate Response */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Interviewer Stage & Candidate Input */}
            <div className="lg:col-span-7 space-y-6">
              {/* Living AI Interviewer Card with AI Orb */}
              <Card glow="cyan" padding="lg" className="border-cyan-500/20 bg-slate-900/60 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                      AI Interviewer Stage
                    </span>
                  </div>
                  <Badge variant="violet" size="sm">
                    {currentQuestion.question_category.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>

                {/* Central Living AI Orb */}
                <div className="py-4 flex flex-col items-center justify-center">
                  <AIOrb
                    state={getOrbState()}
                    size={120}
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeaking();
                      } else {
                        speak(currentQuestion.question_text);
                      }
                    }}
                  />

                  {/* Audio Controls below Orb */}
                  <div className="mt-3 flex items-center gap-2">
                    {isSpeaking ? (
                      <button
                        type="button"
                        onClick={stopSpeaking}
                        className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-1 hover:bg-rose-500/30 transition-colors"
                      >
                        <VolumeX className="w-3.5 h-3.5" /> Stop Voice
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => speak(currentQuestion.question_text)}
                        className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs flex items-center gap-1 hover:bg-cyan-500/30 transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5" /> Replay Question
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setAutoSpeakQuestion(!autoSpeakQuestion)}
                      className={`px-2.5 py-1 rounded-full border text-[11px] transition-colors ${
                        autoSpeakQuestion
                          ? 'bg-white/10 border-white/20 text-slate-200'
                          : 'bg-transparent border-white/5 text-slate-500'
                      }`}
                    >
                      Auto-Read: {autoSpeakQuestion ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                {/* Formatted Question Text */}
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 mt-2">
                  <h3 className="text-base sm:text-lg font-medium text-white leading-relaxed">
                    "{currentQuestion.question_text}"
                  </h3>

                  {currentQuestion.context_note && (
                    <div className="mt-3 pt-3 border-t border-white/5 flex items-start gap-2 text-xs text-slate-400">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-300">Context:</strong> {currentQuestion.context_note}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Candidate Response Card */}
              <Card padding="lg" className="border-white/10 bg-slate-900/60">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Your Response
                    </label>
                    {isVoiceMode && isListening && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Transcribing Voice Live
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleFillSample}
                    className="text-xs text-cyan-400 hover:text-cyan-300 underline font-medium flex items-center gap-1 transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Fill Sample Answer for Viva Demo
                  </button>
                </div>

                {/* Voice Mode Mic Banner & Visualizer */}
                {isVoiceMode && (
                  <div className="mb-3 p-3.5 rounded-xl bg-black/50 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleToggleVoiceRecording}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                          isListening
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 animate-pulse'
                            : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300'
                        }`}
                        title={isListening ? 'Click to stop recording' : 'Click to start speaking'}
                      >
                        {isListening ? (
                          <MicOff className="w-6 h-6" />
                        ) : (
                          <Mic className="w-6 h-6 animate-pulse" />
                        )}
                      </button>
                      <div>
                        <div className="text-xs font-bold text-white">
                          {isListening ? 'Microphone Active' : 'Voice Input Standby'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {isListening
                            ? 'Speak now — audio is transcribed into your response.'
                            : isSttSupported
                            ? 'Click microphone to answer via voice.'
                            : 'Browser voice recognition not detected; type in Text Mode.'}
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Audio Visualizer */}
                    <VoiceVisualizer
                      isActive={isListening || isSpeaking}
                      barCount={18}
                      mode={isSpeaking ? 'interviewer' : 'user'}
                      className="w-full sm:w-48"
                    />
                  </div>
                )}

                {/* Response Textarea / Live Transcript */}
                <div className="relative">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder={
                      isVoiceMode
                        ? 'Click the microphone above to speak your response, or type directly here...'
                        : 'Articulate your technical response here. Describe architecture, tradeoffs, design patterns, and edge cases...'
                    }
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500/50 leading-relaxed resize-y font-sans"
                  />

                  {/* Interim Real-time speech stream overlay */}
                  {interimTranscript && (
                    <div className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-xs italic">
                      Transcribing: "{interimTranscript}"
                    </div>
                  )}
                </div>

                {sttError && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {sttError}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                  <span className="text-xs text-slate-400">
                    {answerText.trim() ? answerText.trim().split(/\s+/).length : 0} words • {answerText.length} characters
                  </span>

                  <div className="flex items-center gap-2">
                    {isListening && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={stopListening}
                        className="text-xs"
                      >
                        Finish Speaking
                      </Button>
                    )}

                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleSubmitAnswer}
                      disabled={submitting || answerText.trim().length < 5}
                      className="flex items-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Evaluating Turn...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Submit Response
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {errorMessage && (
                  <div className="mt-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errorMessage}
                  </div>
                )}
              </Card>
            </div>

            {/* Right 5 Columns: Real-Time Scorecard Drawer */}
            <div className="lg:col-span-5 space-y-6" ref={feedbackRef}>
              {latestEvaluation ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card glow="violet" padding="lg" className="border-violet-500/20 bg-slate-900/60">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                      <div>
                        <span className="text-xs font-mono text-violet-400 uppercase tracking-wider">
                          Turn Feedback
                        </span>
                        <h4 className="text-sm font-bold text-white">5-Dimension Rubric</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-cyan-400">
                          {latestEvaluation.average_score.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-400"> / 10</span>
                      </div>
                    </div>

                    {/* 5 Rubric Bars */}
                    <div className="space-y-3 mb-6">
                      {[
                        { label: 'Relevance', score: latestEvaluation.scores.relevance },
                        { label: 'Technical Accuracy', score: latestEvaluation.scores.technical_accuracy },
                        { label: 'Clarity & Structure', score: latestEvaluation.scores.clarity },
                        { label: 'Technical Depth', score: latestEvaluation.scores.depth },
                        { label: 'Confidence & Conviction', score: latestEvaluation.scores.confidence },
                      ].map((rubric) => (
                        <div key={rubric.label} className="text-xs">
                          <div className="flex justify-between text-slate-300 mb-1">
                            <span>{rubric.label}</span>
                            <span className="font-semibold text-white">{rubric.score}/10</span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${getScoreColor(rubric.score)} transition-all duration-500`}
                              style={{ width: `${(rubric.score / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Feedback Text */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 mb-4 text-xs text-slate-300 leading-relaxed">
                      <strong className="text-white block mb-1">Evaluator Notes:</strong>
                      {latestEvaluation.feedback}
                    </div>

                    {/* Strengths & Improvements */}
                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="font-semibold text-emerald-400 flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
                        </span>
                        <ul className="list-disc list-inside text-slate-300 space-y-0.5 pl-1">
                          {latestEvaluation.strengths.map((str, i) => (
                            <li key={i}>{str}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <span className="font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Areas for Growth
                        </span>
                        <ul className="list-disc list-inside text-slate-300 space-y-0.5 pl-1">
                          {latestEvaluation.areas_for_improvement.map((imp, i) => (
                            <li key={i}>{imp}</li>
                          ))}
                        </ul>
                      </div>

                      {latestEvaluation.ideal_answer_summary && (
                        <div className="pt-2 border-t border-white/5">
                          <span className="font-semibold text-cyan-400 block mb-1">
                            Target L5 / Senior Standard:
                          </span>
                          <p className="text-slate-400 italic">
                            "{latestEvaluation.ideal_answer_summary}"
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <Card padding="lg" className="border-white/5 bg-slate-900/40 text-center py-12">
                  <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <h4 className="text-sm font-semibold text-slate-400">Waiting for First Response</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                    Answer Question 1 via voice or text to see real-time rubric scores and adaptive question updates.
                  </p>
                </Card>
              )}
            </div>
          </div>
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

            <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  setSessionSummary(null);
                  setSessionActive(false);
                }}
              >
                Start New Interview
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  window.location.href = '/analyzer';
                }}
              >
                Scan Resume (ATS Engine)
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
