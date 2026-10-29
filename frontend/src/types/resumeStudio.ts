export interface ContactInfo {
  full_name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
}

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  location?: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  bullets: string[];
}

export interface ProjectItem {
  id: string;
  title: string;
  tech_stack: string[];
  bullets: string[];
  description?: string;
  github_url?: string;
  live_url?: string;
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date?: string;
  gpa_or_percentage?: string;
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  year?: string;
  url?: string;
}

export interface CategorizedSkills {
  languages: string[];
  frameworks_libraries: string[];
  cloud_databases: string[];
  developer_tools: string[];
  core_concepts: string[];
}

export interface CanonicalResume {
  contact: ContactInfo;
  summary: string;
  skills: CategorizedSkills;
  experience: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  achievements: string[];
}

export interface ResumeVersionSummary {
  id: string;
  user_id: string;
  label: string;
  target_role: string;
  parent_version_id?: string | null;
  ats_score: number;
  created_at: string;
  updated_at: string;
}

export type VersionSummaryItem = ResumeVersionSummary;

export interface CreateVersionRequest {
  label: string;
  target_role: string;
  data: CanonicalResume;
  ats_score?: number;
  parent_version_id?: string | null;
}

export interface ResumeVersionDoc {
  id: string;
  user_id: string;
  parent_version_id?: string | null;
  label: string;
  target_role: string;
  data: CanonicalResume;
  ats_score: number;
  created_at: string;
  updated_at: string;
}

export interface ParseResumeResponse {
  status: string;
  file_name: string;
  file_type: string;
  resume: CanonicalResume;
  raw_character_count: number;
}


export interface SkillMatchItem {
  skill: string;
  status: 'matched' | 'partial' | 'missing';
  resume_evidence_line?: string;
  category?: string;
}

export interface WeakLineItem {
  section: string;
  original_line: string;
  issue_type: 'passive_phrase' | 'missing_metric' | 'too_long' | 'too_short';
  recommendation: string;
}

export interface SectionScoreItem {
  name: string;
  score_percentage: number;
  weight_percentage: number;
  points_earned: number;
  max_points: number;
  tips: string[];
}

export interface ScoreBreakdown {
  keyword_semantic_match: SectionScoreItem;
  section_completeness: SectionScoreItem;
  quantified_achievements: SectionScoreItem;
  action_verbs_quality: SectionScoreItem;
  formatting_parseability: SectionScoreItem;
}

export interface ATSScoreResponse {
  overall_score: number;
  is_tailored: boolean;
  summary_verdict: string;
  breakdown: ScoreBreakdown;
  matched_skills: SkillMatchItem[];
  partial_skills: SkillMatchItem[];
  missing_skills: SkillMatchItem[];
  weak_lines: WeakLineItem[];
  top_action_items: string[];
}

export interface ScoreRequest {
  resume: CanonicalResume;
  job_description?: string;
  target_role?: string;
}

export type AIAssistAction = 'improve' | 'add_impact' | 'shorten';

export interface AIAssistRequest {
  text: string;
  action: AIAssistAction;
  context_role?: string;
  context_company?: string;
  candidate_skills?: string[];
}

export interface AIAssistOption {
  text: string;
  diff_summary: string;
  has_new_claims: boolean;
  unverified_tokens: string[];
  explanation: string;
}

export interface AIAssistResponse {
  original_text: string;
  action: string;
  options: AIAssistOption[];
}

export type TemplateId = 'classic' | 'modern' | 'compact' | 'minimal';
export type AccentColor = 'slate' | 'cyan' | 'emerald' | 'navy' | 'violet';
export type FontSize = 'sm' | 'md' | 'lg';
export type SectionKey = 'summary' | 'skills' | 'experience' | 'projects' | 'education' | 'certifications';

export interface ResumeEditorSettings {
  template: TemplateId;
  accentColor: AccentColor;
  fontSize: FontSize;
  sectionOrder: SectionKey[];
  hiddenSections: SectionKey[];
}

export type ExportFormat = 'pdf' | 'docx';

export interface ExportSelfTestResponse {
  is_ats_readable: boolean;
  character_count: number;
  name_matched: boolean;
  email_matched: boolean;
  survived_sections: string[];
  skills_survived_count: number;
  file_type: string;
  verdict: string;
  filename: string;
}


