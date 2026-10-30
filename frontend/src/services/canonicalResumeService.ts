import { api } from './api';

export interface ContactInfo {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
}

export interface CategorizedSkills {
  languages: string[];
  frameworks: string[];
  developer_tools: string[];
  cloud_databases: string[];
  other: string[];
}

export interface ExperienceItem {
  company: string;
  role: string;
  location: string;
  start_date: string;
  end_date: string;
  bullets: string[];
}

export interface ProjectItem {
  name: string;
  description: string;
  tech_stack: string[];
  bullets: string[];
  link?: string | null;
}

export interface EducationItem {
  institution: string;
  degree: string;
  field_of_study: string;
  graduation_year: string;
  gpa_or_grade?: string | null;
}

export interface CertificationItem {
  name: string;
  issuer: string;
  year?: string | null;
}

export interface CanonicalResume {
  contact: ContactInfo;
  summary: string;
  skills: CategorizedSkills;
  experience: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
}

export interface ParseResumeResponse {
  status: string;
  file_name: string;
  file_type: string;
  raw_text_length: number;
  canonical_resume: CanonicalResume;
  job_description?: string;
}

export interface ActiveResumeResponse {
  status: string;
  resume_id: string;
  version: number;
  is_active: boolean;
  target_role: string;
  job_description: string;
  canonical_resume: CanonicalResume;
  updated_at: string;
}

export const parseUploadedResume = async (
  file: File,
  jobDescription: string = ''
): Promise<ParseResumeResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  if (jobDescription) {
    formData.append('job_description', jobDescription);
  }

  const response = await api.post<ParseResumeResponse>(
    '/api/v1/resume/parse-upload',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return response.data;
};

export const saveActiveResume = async (
  canonicalResume: CanonicalResume,
  targetRole: string = 'Full Stack Developer',
  jobDescription: string = '',
  fileName: string = 'Resume.pdf'
): Promise<ActiveResumeResponse> => {
  const response = await api.post<ActiveResumeResponse>(
    '/api/v1/resume/save-active',
    {
      canonical_resume: canonicalResume,
      target_role: targetRole,
      job_description: jobDescription,
      file_name: fileName,
    }
  );
  return response.data;
};

export const getActiveResume = async (): Promise<ActiveResumeResponse | null> => {
  try {
    const response = await api.get<ActiveResumeResponse>('/api/v1/resume/active');
    return response.data;
  } catch (err: any) {
    if (err.response && err.response.status === 404) {
      return null;
    }
    throw err;
  }
};

