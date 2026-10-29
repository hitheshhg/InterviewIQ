import { api } from './api';
import { auth } from '../config/firebase';

export interface QuestionItem {
  question_id: string;
  question_index: number;
  question_text: string;
  question_category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  context_note?: string;
  sample_answer_hint?: string;
}

export interface AnswerScores {
  relevance: number;
  technical_accuracy: number;
  clarity: number;
  depth: number;
  confidence: number;
}

export interface AnswerEvaluation {
  scores: AnswerScores;
  average_score: number;
  feedback: string;
  strengths: string[];
  areas_for_improvement: string[];
  ideal_answer_summary: string;
}

export interface StartInterviewRequest {
  target_role: string;
  job_description?: string;
  resume_id?: string;
  resume_text?: string;
  total_questions?: number;
  initial_difficulty?: 'easy' | 'medium' | 'hard';
  question_seeds?: string[];
}

export interface StartInterviewResponse {
  session_id: string;
  target_role: string;
  total_questions: number;
  current_question_index: number;
  current_difficulty: string;
  first_question: QuestionItem;
  status: string;
}

export interface SubmitAnswerRequest {
  answer_text: string;
  duration_seconds?: number;
}

export interface SubmitAnswerResponse {
  session_id: string;
  question_index: number;
  evaluation: AnswerEvaluation;
  next_question?: QuestionItem | null;
  is_complete: boolean;
  current_difficulty: string;
  average_score_so_far: number;
}

export interface SessionSummary {
  session_id: string;
  user_id: string;
  target_role: string;
  total_questions: number;
  completed_turns: number;
  overall_average_score: number;
  difficulty_progression: string[];
  category_scores: Record<string, number>;
  status: string;
  started_at: string;
  completed_at?: string;
}

export const startInterview = async (
  payload: StartInterviewRequest
): Promise<StartInterviewResponse> => {
  const response = await api.post<StartInterviewResponse>('/api/v1/interview/start', payload);
  return response.data;
};

export const submitAnswer = async (
  sessionId: string,
  payload: SubmitAnswerRequest
): Promise<SubmitAnswerResponse> => {
  const response = await api.post<SubmitAnswerResponse>(
    `/api/v1/interview/${sessionId}/answer`,
    payload
  );
  return response.data;
};

export const getSession = async (sessionId: string) => {
  const response = await api.get(`/api/v1/interview/${sessionId}`);
  return response.data;
};

export const endInterview = async (sessionId: string): Promise<SessionSummary> => {
  const response = await api.post<SessionSummary>(`/api/v1/interview/${sessionId}/end`);
  return response.data;
};

export const getWebSocketUrl = async (sessionId: string): Promise<string> => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  const wsBase = apiBase.replace(/^http/, 'ws');
  const token = await auth.currentUser?.getIdToken();
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${wsBase}/api/v1/interview/ws/${sessionId}${tokenParam}`;
};
