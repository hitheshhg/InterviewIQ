import React from 'react';
import { CanonicalResume, AccentColor, FontSize, SectionKey } from '../../../types/resumeStudio';

interface TemplateProps {
  resume: CanonicalResume;
  accentColor?: AccentColor;
  fontSize?: FontSize;
  sectionOrder?: SectionKey[];
  hiddenSections?: SectionKey[];
}

const colorMap: Record<AccentColor, { primary: string; border: string }> = {
  slate: { primary: '#1e293b', border: '#cbd5e1' },
  cyan: { primary: '#0891b2', border: '#a5f3fc' },
  emerald: { primary: '#059669', border: '#a7f3d0' },
  navy: { primary: '#1e3a8a', border: '#bfdbfe' },
  violet: { primary: '#6d28d9', border: '#ddd6fe' },
};

const fontMap: Record<FontSize, { body: string; h2: string; h1: string; gap: string }> = {
  sm: { body: 'text-[11px] leading-[1.4]', h2: 'text-[13px]', h1: 'text-[20px]', gap: 'space-y-3' },
  md: { body: 'text-[12px] leading-[1.45]', h2: 'text-[14px]', h1: 'text-[23px]', gap: 'space-y-4' },
  lg: { body: 'text-[13px] leading-[1.5]', h2: 'text-[15px]', h1: 'text-[25px]', gap: 'space-y-5' },
};

export const ClassicTemplate: React.FC<TemplateProps> = ({
  resume,
  accentColor = 'slate',
  fontSize = 'md',
  sectionOrder = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
  hiddenSections = [],
}) => {
  const { contact, summary, skills, experience, projects, education, certifications } = resume;
  const colors = colorMap[accentColor] || colorMap.slate;
  const fonts = fontMap[fontSize] || fontMap.md;

  const isVisible = (key: SectionKey) => !hiddenSections.includes(key);

  const renderSection = (key: SectionKey) => {
    switch (key) {
      case 'summary':
        if (!isVisible('summary') || !summary) return null;
        return (
          <section key="summary" className="mb-4">
            <h2
              className={`${fonts.h2} font-serif font-bold uppercase tracking-wider pb-1 border-b`}
              style={{ color: colors.primary, borderColor: colors.border }}
            >
              Professional Summary
            </h2>
            <p className={`${fonts.body} text-slate-800 mt-2 font-serif`}>{summary}</p>
          </section>
        );

      case 'skills':
        if (!isVisible('skills')) return null;
        const allSkillsGroups = [
          { label: 'Languages', items: skills.languages },
          { label: 'Frameworks & Libraries', items: skills.frameworks_libraries },
          { label: 'Cloud & Databases', items: skills.cloud_databases },
          { label: 'Developer Tools', items: skills.developer_tools },
          { label: 'Core Concepts', items: skills.core_concepts },
        ].filter((g) => g.items && g.items.length > 0);

        if (allSkillsGroups.length === 0) return null;

        return (
          <section key="skills" className="mb-4">
            <h2
              className={`${fonts.h2} font-serif font-bold uppercase tracking-wider pb-1 border-b`}
              style={{ color: colors.primary, borderColor: colors.border }}
            >
              Technical Skills
            </h2>
            <div className={`${fonts.body} text-slate-800 mt-2 space-y-1`}>
              {allSkillsGroups.map((g) => (
                <div key={g.label} className="flex flex-wrap items-baseline">
                  <span className="font-semibold text-slate-900 w-44 shrink-0">{g.label}:</span>
                  <span className="text-slate-700 flex-1">{g.items.join(', ')}</span>
                </div>
              ))}
            </div>
          </section>
        );

      case 'experience':
        if (!isVisible('experience') || experience.length === 0) return null;
        return (
          <section key="experience" className="mb-4">
            <h2
              className={`${fonts.h2} font-serif font-bold uppercase tracking-wider pb-1 border-b`}
              style={{ color: colors.primary, borderColor: colors.border }}
            >
              Work Experience
            </h2>
            <div className="mt-2 space-y-3">
              {experience.map((exp) => (
                <div key={exp.id || exp.company}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">
                      {exp.role} <span className="font-normal text-slate-600">| {exp.company}</span>
                    </span>
                    <span className="text-slate-500 font-serif text-[11px]">
                      {exp.start_date} – {exp.is_current ? 'Present' : exp.end_date || 'Present'}
                    </span>
                  </div>
                  {exp.location && (
                    <div className="text-[11px] text-slate-500 italic">{exp.location}</div>
                  )}
                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className={`${fonts.body} list-disc ml-5 mt-1 space-y-0.5 text-slate-800`}>
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
          <section key="projects" className="mb-4">
            <h2
              className={`${fonts.h2} font-serif font-bold uppercase tracking-wider pb-1 border-b`}
              style={{ color: colors.primary, borderColor: colors.border }}
            >
              Key Projects
            </h2>
            <div className="mt-2 space-y-3">
              {projects.map((proj) => (
                <div key={proj.id || proj.title}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">{proj.title}</span>
                    {proj.tech_stack && proj.tech_stack.length > 0 && (
                      <span className="text-slate-500 text-[11px] font-mono italic">
                        {proj.tech_stack.join(', ')}
                      </span>
                    )}
                  </div>
                  {proj.description && (
                    <p className={`${fonts.body} text-slate-700 italic mt-0.5`}>{proj.description}</p>
                  )}
                  {proj.bullets && proj.bullets.length > 0 && (
                    <ul className={`${fonts.body} list-disc ml-5 mt-1 space-y-0.5 text-slate-800`}>
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
          <section key="education" className="mb-4">
            <h2
              className={`${fonts.h2} font-serif font-bold uppercase tracking-wider pb-1 border-b`}
              style={{ color: colors.primary, borderColor: colors.border }}
            >
              Education
            </h2>
            <div className="mt-2 space-y-2">
              {education.map((edu) => (
                <div key={edu.id || edu.institution} className="flex justify-between items-baseline">
                  <div>
                    <span className="font-bold text-slate-900">{edu.institution}</span>
                    <div className={`${fonts.body} text-slate-700`}>
                      {edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ''}
                      {edu.gpa_or_percentage ? ` | Score: ${edu.gpa_or_percentage}` : ''}
                    </div>
                  </div>
                  <span className="text-slate-500 text-[11px] font-serif">
                    {edu.start_date ? `${edu.start_date} – ` : ''}{edu.end_date}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );

      case 'certifications':
        if (!isVisible('certifications') || certifications.length === 0) return null;
        return (
          <section key="certifications" className="mb-4">
            <h2
              className={`${fonts.h2} font-serif font-bold uppercase tracking-wider pb-1 border-b`}
              style={{ color: colors.primary, borderColor: colors.border }}
            >
              Certifications
            </h2>
            <div className={`${fonts.body} mt-2 space-y-1`}>
              {certifications.map((cert) => (
                <div key={cert.id || cert.name} className="flex justify-between">
                  <span className="font-semibold text-slate-900">{cert.name} — <span className="font-normal text-slate-600">{cert.issuer}</span></span>
                  {cert.year && <span className="text-slate-500 text-[11px]">{cert.year}</span>}
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
    <article className="font-serif text-slate-900 leading-normal max-w-full print:p-0">
      {/* Contact Header */}
      <header className="text-center pb-4 mb-4 border-b border-slate-300">
        <h1 className={`${fonts.h1} font-serif font-bold tracking-tight text-slate-900 uppercase`}>
          {contact.full_name || 'Candidate Name'}
        </h1>
        <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-1 text-[11px] text-slate-600 mt-1.5 font-sans">
          {contact.email && <span>{contact.email}</span>}
          {contact.phone && <span>• {contact.phone}</span>}
          {contact.location && <span>• {contact.location}</span>}
          {contact.linkedin_url && (
            <span>
              • <a href={contact.linkedin_url} className="hover:underline text-slate-700">LinkedIn</a>
            </span>
          )}
          {contact.github_url && (
            <span>
              • <a href={contact.github_url} className="hover:underline text-slate-700">GitHub</a>
            </span>
          )}
          {contact.portfolio_url && (
            <span>
              • <a href={contact.portfolio_url} className="hover:underline text-slate-700">Portfolio</a>
            </span>
          )}
        </div>
      </header>

      {/* Ordered Sections */}
      <div>{sectionOrder.map((key) => renderSection(key))}</div>
    </article>
  );
};
