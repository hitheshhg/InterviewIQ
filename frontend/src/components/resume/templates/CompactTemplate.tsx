import React from 'react';
import { CanonicalResume, AccentColor, FontSize, SectionKey } from '../../../types/resumeStudio';

interface TemplateProps {
  resume: CanonicalResume;
  accentColor?: AccentColor;
  fontSize?: FontSize;
  sectionOrder?: SectionKey[];
  hiddenSections?: SectionKey[];
}

const colorMap: Record<AccentColor, { primary: string; tagBg: string }> = {
  slate: { primary: '#1e293b', tagBg: '#f8fafc' },
  cyan: { primary: '#0e7490', tagBg: '#f0fdfa' },
  emerald: { primary: '#047857', tagBg: '#f0fdf4' },
  navy: { primary: '#1d4ed8', tagBg: '#eff6ff' },
  violet: { primary: '#5b21b6', tagBg: '#faf5ff' },
};

const fontMap: Record<FontSize, { body: string; h2: string; h1: string }> = {
  sm: { body: 'text-[10px] leading-[1.3]', h2: 'text-[11px]', h1: 'text-[18px]' },
  md: { body: 'text-[11px] leading-[1.35]', h2: 'text-[12px]', h1: 'text-[20px]' },
  lg: { body: 'text-[12px] leading-[1.4]', h2: 'text-[13px]', h1: 'text-[22px]' },
};

export const CompactTemplate: React.FC<TemplateProps> = ({
  resume,
  accentColor = 'navy',
  fontSize = 'sm',
  sectionOrder = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
  hiddenSections = [],
}) => {
  const { contact, summary, skills, experience, projects, education, certifications } = resume;
  const colors = colorMap[accentColor] || colorMap.navy;
  const fonts = fontMap[fontSize] || fontMap.sm;

  const isVisible = (key: SectionKey) => !hiddenSections.includes(key);

  const renderSection = (key: SectionKey) => {
    switch (key) {
      case 'summary':
        if (!isVisible('summary') || !summary) return null;
        return (
          <section key="summary" className="mb-2.5">
            <h2
              className={`${fonts.h2} font-bold uppercase tracking-wider pb-0.5 mb-1 border-b border-slate-300`}
              style={{ color: colors.primary }}
            >
              Summary
            </h2>
            <p className={`${fonts.body} text-slate-700`}>{summary}</p>
          </section>
        );

      case 'skills':
        if (!isVisible('skills')) return null;
        const allGroups = [
          { label: 'Languages', items: skills.languages },
          { label: 'Frameworks', items: skills.frameworks_libraries },
          { label: 'Databases & Cloud', items: skills.cloud_databases },
          { label: 'Tools', items: skills.developer_tools },
          { label: 'Core', items: skills.core_concepts },
        ].filter((g) => g.items && g.items.length > 0);

        if (allGroups.length === 0) return null;

        return (
          <section key="skills" className="mb-2.5">
            <h2
              className={`${fonts.h2} font-bold uppercase tracking-wider pb-0.5 mb-1 border-b border-slate-300`}
              style={{ color: colors.primary }}
            >
              Skills
            </h2>
            <div className={`${fonts.body} space-y-0.5`}>
              {allGroups.map((g) => (
                <div key={g.label} className="flex items-baseline">
                  <span className="font-semibold text-slate-900 w-36 shrink-0">{g.label}:</span>
                  <span className="text-slate-700 flex-1">{g.items.join(', ')}</span>
                </div>
              ))}
            </div>
          </section>
        );

      case 'experience':
        if (!isVisible('experience') || experience.length === 0) return null;
        return (
          <section key="experience" className="mb-2.5">
            <h2
              className={`${fonts.h2} font-bold uppercase tracking-wider pb-0.5 mb-1 border-b border-slate-300`}
              style={{ color: colors.primary }}
            >
              Experience
            </h2>
            <div className="space-y-2">
              {experience.map((exp) => (
                <div key={exp.id || exp.company}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">
                      {exp.role} <span className="font-normal text-slate-600">| {exp.company}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {exp.start_date} – {exp.is_current ? 'Present' : exp.end_date || 'Present'}
                    </span>
                  </div>
                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className={`${fonts.body} list-disc ml-4 mt-0.5 space-y-0.5 text-slate-700`}>
                      {exp.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        );

      case 'projects':
        if (!isVisible('projects') || projects.length === 0) return null;
        return (
          <section key="projects" className="mb-2.5">
            <h2
              className={`${fonts.h2} font-bold uppercase tracking-wider pb-0.5 mb-1 border-b border-slate-300`}
              style={{ color: colors.primary }}
            >
              Projects
            </h2>
            <div className="space-y-2">
              {projects.map((proj) => (
                <div key={proj.id || proj.title}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">
                      {proj.title}
                      {proj.tech_stack && proj.tech_stack.length > 0 && (
                        <span className="font-normal text-slate-500 text-[10px] ml-1.5 font-mono">
                          ({proj.tech_stack.join(', ')})
                        </span>
                      )}
                    </span>
                  </div>
                  {proj.bullets && proj.bullets.length > 0 && (
                    <ul className={`${fonts.body} list-disc ml-4 mt-0.5 space-y-0.5 text-slate-700`}>
                      {proj.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        );

      case 'education':
        if (!isVisible('education') || education.length === 0) return null;
        return (
          <section key="education" className="mb-2.5">
            <h2
              className={`${fonts.h2} font-bold uppercase tracking-wider pb-0.5 mb-1 border-b border-slate-300`}
              style={{ color: colors.primary }}
            >
              Education
            </h2>
            <div className="space-y-1">
              {education.map((edu) => (
                <div key={edu.id || edu.institution} className="flex justify-between items-baseline">
                  <div>
                    <span className="font-bold text-slate-900">{edu.institution}</span>
                    <span className={`${fonts.body} text-slate-700 ml-1.5`}>
                      — {edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ''}
                      {edu.gpa_or_percentage ? ` (${edu.gpa_or_percentage})` : ''}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{edu.end_date}</span>
                </div>
              ))}
            </div>
          </section>
        );

      case 'certifications':
        if (!isVisible('certifications') || certifications.length === 0) return null;
        return (
          <section key="certifications" className="mb-2">
            <h2
              className={`${fonts.h2} font-bold uppercase tracking-wider pb-0.5 mb-1 border-b border-slate-300`}
              style={{ color: colors.primary }}
            >
              Certifications
            </h2>
            <div className={`${fonts.body} space-y-0.5`}>
              {certifications.map((cert) => (
                <div key={cert.id || cert.name} className="flex justify-between">
                  <span className="text-slate-800 font-medium">{cert.name} ({cert.issuer})</span>
                  {cert.year && <span className="text-slate-500 text-[10px]">{cert.year}</span>}
                </div>
              ))}
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <article className="font-sans text-slate-900 max-w-full print:p-0">
      <header className="text-center pb-2 mb-2 border-b-2 border-slate-300">
        <h1 className={`${fonts.h1} font-bold text-slate-900 uppercase tracking-tight`}>
          {contact.full_name || 'Candidate Name'}
        </h1>
        <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-[10px] text-slate-600 mt-1">
          {contact.email && <span>{contact.email}</span>}
          {contact.phone && <span>• {contact.phone}</span>}
          {contact.location && <span>• {contact.location}</span>}
          {contact.linkedin_url && <span>• {contact.linkedin_url.replace('https://', '')}</span>}
          {contact.github_url && <span>• {contact.github_url.replace('https://', '')}</span>}
        </div>
      </header>

      <div>{sectionOrder.map((key) => renderSection(key))}</div>
    </article>
  );
};

