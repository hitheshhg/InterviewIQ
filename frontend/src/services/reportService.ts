import { api } from './api';
import { AnswerScores } from './interviewService';

export interface DimensionScore {
  dimension: string;
  score: number;
  benchmark: number;
  percentage: number;
}

export interface QuestionBreakdownItem {
  question_index: number;
  question_text: string;
  question_category: string;
  difficulty: string;
  candidate_answer: string;
  scores: AnswerScores;
  average_score: number;
  feedback: string;
  strengths: string[];
  areas_for_improvement: string[];
  ideal_answer_summary: string;
}

export interface RoadmapMilestone {
  milestone_id: string;
  step_number: number;
  title: string;
  target_skill: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimated_days: number;
  actionable_tasks: string[];
  recommended_resources: string[];
  capstone_mini_project: string;
}

export interface PersonalizedRoadmap {
  roadmap_id: string;
  user_id: string;
  target_role: string;
  identified_weak_areas: string[];
  milestones: RoadmapMilestone[];
  estimated_total_weeks: number;
  created_at: string;
}

export interface InterviewReport {
  report_id: string;
  session_id: string;
  user_id: string;
  target_role: string;
  overall_score: number;
  verdict: 'Strong Hire' | 'Hire' | 'Leaning Hire' | 'Needs Revision';
  executive_summary: string;
  dimension_scores: DimensionScore[];
  category_scores: Record<string, number>;
  top_strengths: string[];
  priority_improvements: string[];
  questions_breakdown: QuestionBreakdownItem[];
  roadmap?: PersonalizedRoadmap;
  created_at: string;
}

export interface DashboardMetrics {
  user_id: string;
  total_interviews_completed: number;
  average_interview_score: number;
  highest_interview_score: number;
  readiness_level: string;
  latest_ats_score?: number | null;
  recent_sessions: Array<{
    session_id: string;
    target_role: string;
    overall_score: number;
    total_questions: number;
    created_at: string;
  }>;
  score_trend: Array<{
    session_index: number;
    role: string;
    score: number;
    date: string;
  }>;
  dimension_averages: DimensionScore[];
}

export const generateReport = async (sessionId: string): Promise<InterviewReport> => {
  const response = await api.post<InterviewReport>(`/api/v1/report/generate/${sessionId}`);
  return response.data;
};

export const getReportBySession = async (sessionId: string): Promise<InterviewReport> => {
  const response = await api.get<InterviewReport>(`/api/v1/report/session/${sessionId}`);
  return response.data;
};

export const getLatestReport = async (): Promise<InterviewReport> => {
  const response = await api.get<InterviewReport>('/api/v1/report/user/latest');
  return response.data;
};

export const getLatestRoadmap = async (): Promise<PersonalizedRoadmap> => {
  const response = await api.get<PersonalizedRoadmap>('/api/v1/roadmap/user/latest');
  return response.data;
};

export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const response = await api.get<DashboardMetrics>('/api/v1/dashboard/metrics');
  return response.data;
};

