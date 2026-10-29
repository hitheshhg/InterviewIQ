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

