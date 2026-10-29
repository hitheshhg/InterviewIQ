import React from 'react';
import { CanonicalResume, AccentColor, FontSize, SectionKey } from '../../../types/resumeStudio';

interface TemplateProps {
  resume: CanonicalResume;
  accentColor?: AccentColor;
  fontSize?: FontSize;
  sectionOrder?: SectionKey[];
  hiddenSections?: SectionKey[];
}

const colorMap: Record<AccentColor, { primary: string; lightBg: string; pillBorder: string }> = {
  slate: { primary: '#334155', lightBg: '#f1f5f9', pillBorder: '#cbd5e1' },
  cyan: { primary: '#0891b2', lightBg: '#ecfeff', pillBorder: '#a5f3fc' },
  emerald: { primary: '#059669', lightBg: '#ecfdf5', pillBorder: '#a7f3d0' },
  navy: { primary: '#1e40af', lightBg: '#eff6ff', pillBorder: '#bfdbfe' },
  violet: { primary: '#7c3aed', lightBg: '#f5f3ff', pillBorder: '#ddd6fe' },
};

const fontMap: Record<FontSize, { body: string; h2: string; h1: string }> = {
  sm: { body: 'text-[11px] leading-[1.4]', h2: 'text-[12px]', h1: 'text-[21px]' },
  md: { body: 'text-[12px] leading-[1.45]', h2: 'text-[13px]', h1: 'text-[24px]' },
  lg: { body: 'text-[13px] leading-[1.5]', h2: 'text-[14px]', h1: 'text-[26px]' },
};

export const ModernTemplate: React.FC<TemplateProps> = ({
  resume,
  accentColor = 'cyan',
  fontSize = 'md',
  sectionOrder = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
  hiddenSections = [],
}) => {
  const { contact, summary, skills, experience, projects, education, certifications } = resume;
  const colors = colorMap[accentColor] || colorMap.cyan;
  const fonts = fontMap[fontSize] || fontMap.md;

  const isVisible = (key: SectionKey) => !hiddenSections.includes(key);

  const renderSection = (key: SectionKey) => {
    switch (key) {
      case 'summary':
        if (!isVisible('summary') || !summary) return null;
        return (
          <section key="summary" className="mb-4">
            <h2
              className={`${fonts.h2} font-sans font-bold uppercase tracking-wider pb-1 mb-2 border-b-2`}
              style={{ color: colors.primary, borderColor: colors.primary }}
            >
              Professional Summary
            </h2>
            <p className={`${fonts.body} text-slate-700 leading-relaxed`}>{summary}</p>
          </section>
        );

      case 'skills':
        if (!isVisible('skills')) return null;
        const allGroups = [
          { label: 'Languages', items: skills.languages },
          { label: 'Frameworks & Libraries', items: skills.frameworks_libraries },
          { label: 'Cloud & Databases', items: skills.cloud_databases },
          { label: 'Developer Tools', items: skills.developer_tools },
          { label: 'Core Concepts', items: skills.core_concepts },
        ].filter((g) => g.items && g.items.length > 0);

        if (allGroups.length === 0) return null;

        return (
          <section key="skills" className="mb-4">
            <h2
              className={`${fonts.h2} font-sans font-bold uppercase tracking-wider pb-1 mb-2 border-b-2`}
              style={{ color: colors.primary, borderColor: colors.primary }}
            >
              Technical Skills
            </h2>
            <div className={`${fonts.body} space-y-1.5`}>
              {allGroups.map((g) => (
                <div key={g.label} className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-slate-900 w-44 shrink-0 text-[11px] uppercase tracking-wide">
                    {g.label}:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {g.items.map((item) => (
                      <span
                        key={item}
                        className="px-1.5 py-0.5 rounded text-[11px] font-medium border"
                        style={{
                          backgroundColor: colors.lightBg,
                          borderColor: colors.pillBorder,
                          color: colors.primary,
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
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
              className={`${fonts.h2} font-sans font-bold uppercase tracking-wider pb-1 mb-2 border-b-2`}
              style={{ color: colors.primary, borderColor: colors.primary }}
            >
              Experience
            </h2>
            <div className="space-y-3.5">
              {experience.map((exp) => (
                <div key={exp.id || exp.company}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">
                      {exp.role} <span className="font-medium text-slate-600">— {exp.company}</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {exp.start_date} – {exp.is_current ? 'Present' : exp.end_date || 'Present'}
                    </span>
                  </div>
                  {exp.location && (
                    <div className="text-[11px] text-slate-500">{exp.location}</div>
                  )}
                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className={`${fonts.body} list-disc ml-5 mt-1 space-y-1 text-slate-700`}>
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
              className={`${fonts.h2} font-sans font-bold uppercase tracking-wider pb-1 mb-2 border-b-2`}
              style={{ color: colors.primary, borderColor: colors.primary }}
            >
              Projects
            </h2>
            <div className="space-y-3">
              {projects.map((proj) => (
                <div key={proj.id || proj.title}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">{proj.title}</span>
                    {proj.tech_stack && proj.tech_stack.length > 0 && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        [{proj.tech_stack.join(', ')}]
                      </span>
                    )}
                  </div>
                  {proj.description && (
                    <p className={`${fonts.body} text-slate-600 mt-0.5`}>{proj.description}</p>
                  )}
                  {proj.bullets && proj.bullets.length > 0 && (
                    <ul className={`${fonts.body} list-disc ml-5 mt-1 space-y-1 text-slate-700`}>
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
              className={`${fonts.h2} font-sans font-bold uppercase tracking-wider pb-1 mb-2 border-b-2`}
              style={{ color: colors.primary, borderColor: colors.primary }}
            >
              Education
            </h2>
            <div className="space-y-2">
              {education.map((edu) => (
                <div key={edu.id || edu.institution} className="flex justify-between items-baseline">
                  <div>
                    <span className="font-bold text-slate-900">{edu.institution}</span>
                    <div className={`${fonts.body} text-slate-700`}>
                      {edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ''}
                      {edu.gpa_or_percentage ? ` • ${edu.gpa_or_percentage}` : ''}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
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
              className={`${fonts.h2} font-sans font-bold uppercase tracking-wider pb-1 mb-2 border-b-2`}
              style={{ color: colors.primary, borderColor: colors.primary }}
            >
              Certifications
            </h2>
            <div className={`${fonts.body} space-y-1`}>
              {certifications.map((cert) => (
                <div key={cert.id || cert.name} className="flex justify-between">
                  <span className="font-semibold text-slate-900">{cert.name} <span className="font-normal text-slate-600">({cert.issuer})</span></span>
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
    <article className="font-sans text-slate-900 max-w-full print:p-0">
      {/* Header */}
      <header className="pb-4 mb-4 border-b border-slate-200">
        <h1
          className={`${fonts.h1} font-bold tracking-tight uppercase`}
          style={{ color: colors.primary }}
        >
          {contact.full_name || 'Candidate Name'}
        </h1>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 mt-1 font-medium">
          {contact.email && <span>{contact.email}</span>}
          {contact.phone && <span>• {contact.phone}</span>}
          {contact.location && <span>• {contact.location}</span>}
          {contact.linkedin_url && (
            <span>
              • <a href={contact.linkedin_url} className="text-slate-800 hover:underline">LinkedIn</a>
            </span>
          )}
          {contact.github_url && (
            <span>
              • <a href={contact.github_url} className="text-slate-800 hover:underline">GitHub</a>
            </span>
          )}
        </div>
      </header>

      {/* Sections */}
      <div>{sectionOrder.map((key) => renderSection(key))}</div>
    </article>
  );
};

