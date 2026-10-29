import React from 'react';
import { CanonicalResume, AccentColor, FontSize, SectionKey } from '../../../types/resumeStudio';

interface TemplateProps {
  resume: CanonicalResume;
  accentColor?: AccentColor;
  fontSize?: FontSize;
  sectionOrder?: SectionKey[];
  hiddenSections?: SectionKey[];
}

const fontMap: Record<FontSize, { body: string; h2: string; h1: string }> = {
  sm: { body: 'text-[11px] leading-[1.4]', h2: 'text-[12px]', h1: 'text-[22px]' },
  md: { body: 'text-[12px] leading-[1.45]', h2: 'text-[13px]', h1: 'text-[24px]' },
  lg: { body: 'text-[13px] leading-[1.5]', h2: 'text-[14px]', h1: 'text-[26px]' },
};

export const MinimalTemplate: React.FC<TemplateProps> = ({
  resume,
  fontSize = 'md',
  sectionOrder = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
  hiddenSections = [],
}) => {
  const { contact, summary, skills, experience, projects, education, certifications } = resume;
  const fonts = fontMap[fontSize] || fontMap.md;

  const isVisible = (key: SectionKey) => !hiddenSections.includes(key);

  const renderSection = (key: SectionKey) => {
    switch (key) {
      case 'summary':
        if (!isVisible('summary') || !summary) return null;
        return (
          <section key="summary" className="mb-4">
            <h2 className={`${fonts.h2} font-bold text-black uppercase tracking-wider mb-1`}>
              Summary
            </h2>
            <p className={`${fonts.body} text-slate-800 leading-relaxed`}>{summary}</p>
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
          <section key="skills" className="mb-4">
            <h2 className={`${fonts.h2} font-bold text-black uppercase tracking-wider mb-1`}>
              Technical Skills
            </h2>
            <div className={`${fonts.body} space-y-1`}>
              {allGroups.map((g) => (
                <div key={g.label} className="flex">
                  <span className="font-semibold text-black w-40 shrink-0">{g.label}:</span>
                  <span className="text-slate-800 flex-1">{g.items.join(', ')}</span>
                </div>
              ))}
            </div>
          </section>
        );

      case 'experience':
        if (!isVisible('experience') || experience.length === 0) return null;
        return (
          <section key="experience" className="mb-4">
            <h2 className={`${fonts.h2} font-bold text-black uppercase tracking-wider mb-1`}>
              Experience
            </h2>
            <div className="space-y-3">
              {experience.map((exp) => (
                <div key={exp.id || exp.company}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-black">
                      {exp.role}, <span className="font-normal text-slate-700">{exp.company}</span>
                    </span>
                    <span className="text-[11px] text-slate-600">
                      {exp.start_date} – {exp.is_current ? 'Present' : exp.end_date || 'Present'}
                    </span>
                  </div>
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
            <h2 className={`${fonts.h2} font-bold text-black uppercase tracking-wider mb-1`}>
              Projects
            </h2>
            <div className="space-y-3">
              {projects.map((proj) => (
                <div key={proj.id || proj.title}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-black">{proj.title}</span>
                    {proj.tech_stack && proj.tech_stack.length > 0 && (
                      <span className="text-[11px] text-slate-600 font-mono">
                        {proj.tech_stack.join(', ')}
                      </span>
                    )}
                  </div>
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
            <h2 className={`${fonts.h2} font-bold text-black uppercase tracking-wider mb-1`}>
              Education
            </h2>
            <div className="space-y-1.5">
              {education.map((edu) => (
                <div key={edu.id || edu.institution} className="flex justify-between items-baseline">
                  <div>
                    <span className="font-bold text-black">{edu.institution}</span>
                    <span className={`${fonts.body} text-slate-700 ml-1.5`}>
                      — {edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ''}
                      {edu.gpa_or_percentage ? ` (${edu.gpa_or_percentage})` : ''}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-600">{edu.end_date}</span>
                </div>
              ))}
            </div>
          </section>
        );

      case 'certifications':
        if (!isVisible('certifications') || certifications.length === 0) return null;
        return (
          <section key="certifications" className="mb-4">
            <h2 className={`${fonts.h2} font-bold text-black uppercase tracking-wider mb-1`}>
              Certifications
            </h2>
            <div className={`${fonts.body} space-y-1`}>
              {certifications.map((cert) => (
                <div key={cert.id || cert.name} className="flex justify-between">
                  <span className="text-black font-medium">{cert.name} — <span className="text-slate-600">{cert.issuer}</span></span>
                  {cert.year && <span className="text-slate-600 text-[11px]">{cert.year}</span>}
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
    <article className="font-sans text-black max-w-full print:p-0">
      <header className="pb-3 mb-4">
        <h1 className={`${fonts.h1} font-bold tracking-tight text-black uppercase`}>
          {contact.full_name || 'Candidate Name'}
        </h1>
        <div className="flex flex-wrap gap-x-2 text-[11px] text-slate-700 mt-1">
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
