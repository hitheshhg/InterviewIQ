import React, { useState } from 'react';
import {
  CanonicalResume,
  SectionKey,
  ExperienceItem,
  ProjectItem,
  EducationItem,
  CertificationItem,
} from '../../types/resumeStudio';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  User,
  FileText,
  Code,
  Briefcase,
  FolderGit2,
  GraduationCap,
  Award,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Undo2,
  Redo2,
  CheckCircle,
} from 'lucide-react';
import { AIAssistModal } from './AIAssistModal';

interface ResumeFormEditorProps {
  resume: CanonicalResume;
  onChange: (updated: CanonicalResume) => void;
  sectionOrder: SectionKey[];
  hiddenSections: SectionKey[];
  onSectionOrderChange: (newOrder: SectionKey[]) => void;
  onToggleHideSection: (key: SectionKey) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  autosaveState: 'saved' | 'saving' | 'unsaved';
  lastSavedTime?: string;
}

export const ResumeFormEditor: React.FC<ResumeFormEditorProps> = ({
  resume,
  onChange,
  sectionOrder,
  hiddenSections,
  onSectionOrderChange,
  onToggleHideSection,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  autosaveState,
  lastSavedTime,
}) => {
  // Accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    contact: true,
    summary: true,
    skills: true,
    experience: true,
    projects: true,
    education: false,
    certifications: false,
  });

  // AI Assist Modal state
  const [assistTarget, setAssistTarget] = useState<{
    text: string;
    contextRole?: string;
    contextCompany?: string;
    onAccept: (rewritten: string) => void;
  } | null>(null);

  const toggleAccordion = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    setOpenSections({
      contact: true,
      summary: true,
      skills: true,
      experience: true,
      projects: true,
      education: true,
      certifications: true,
    });
  };

  const collapseAll = () => {
    setOpenSections({
      contact: false,
      summary: false,
      skills: false,
      experience: false,
      projects: false,
      education: false,
      certifications: false,
    });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...sectionOrder];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    onSectionOrderChange(newOrder);
  };

  // Contact Mutators
  const updateContact = (field: string, value: string) => {
    onChange({
      ...resume,
      contact: {
        ...resume.contact,
        [field]: value,
      },
    });
  };

  // Summary Mutator
  const updateSummary = (value: string) => {
    onChange({
      ...resume,
      summary: value,
    });
  };

  // Skills Mutators
  const addSkillItem = (category: keyof CanonicalResume['skills'], skillName: string) => {
    if (!skillName.trim()) return;
    const current = resume.skills[category] || [];
    if (current.includes(skillName.trim())) return;
    onChange({
      ...resume,
      skills: {
        ...resume.skills,
        [category]: [...current, skillName.trim()],
      },
    });
  };

  const removeSkillItem = (category: keyof CanonicalResume['skills'], skillName: string) => {
    onChange({
      ...resume,
      skills: {
        ...resume.skills,
        [category]: (resume.skills[category] || []).filter((s) => s !== skillName),
      },
    });
  };

  // Experience Mutators
  const addExperience = () => {
    const newItem: ExperienceItem = {
      id: Math.random().toString(36).substring(2, 9),
      company: 'New Company',
      role: 'Software Engineer',
      location: 'Remote',
      start_date: 'Jan 2024',
      end_date: 'Present',
      is_current: true,
      bullets: ['Spearheaded microservices development improving throughput by 25%.'],
    };
    onChange({
      ...resume,
      experience: [newItem, ...resume.experience],
    });
  };

  const updateExperienceItem = (id: string, updates: Partial<ExperienceItem>) => {
    onChange({
      ...resume,
      experience: resume.experience.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    });
  };

  const removeExperience = (id: string) => {
    onChange({
      ...resume,
      experience: resume.experience.filter((e) => e.id !== id),
    });
  };

  const addExperienceBullet = (id: string) => {
    const exp = resume.experience.find((e) => e.id === id);
    if (!exp) return;
    updateExperienceItem(id, {
      bullets: [...exp.bullets, 'Engineered new scalable feature handling high-volume queries.'],
    });
  };

  const updateExperienceBullet = (expId: string, bIndex: number, text: string) => {
    const exp = resume.experience.find((e) => e.id === expId);
    if (!exp) return;
    const newBullets = [...exp.bullets];
    newBullets[bIndex] = text;
    updateExperienceItem(expId, { bullets: newBullets });
  };

  const removeExperienceBullet = (expId: string, bIndex: number) => {
    const exp = resume.experience.find((e) => e.id === expId);
    if (!exp) return;
    updateExperienceItem(expId, {
      bullets: exp.bullets.filter((_, i) => i !== bIndex),
    });
  };

  // Projects Mutators
  const addProject = () => {
    const newProj: ProjectItem = {
      id: Math.random().toString(36).substring(2, 9),
      title: 'New Technical Project',
      tech_stack: ['React', 'FastAPI'],
      bullets: ['Built full-stack application delivering real-time user experiences.'],
    };
    onChange({
      ...resume,
      projects: [newProj, ...resume.projects],
    });
  };

  const updateProjectItem = (id: string, updates: Partial<ProjectItem>) => {
    onChange({
      ...resume,
      projects: resume.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    });
  };

  const removeProject = (id: string) => {
    onChange({
      ...resume,
      projects: resume.projects.filter((p) => p.id !== id),
    });
  };

  // Education Mutators
  const addEducation = () => {
    const newEdu: EducationItem = {
      id: Math.random().toString(36).substring(2, 9),
      institution: 'University / Institute',
      degree: 'B.E.',
      field_of_study: 'Computer Science',
      start_date: '2020',
      end_date: '2024',
      gpa_or_percentage: '8.5 CGPA',
    };
    onChange({
      ...resume,
      education: [...resume.education, newEdu],
    });
  };

  const removeEducation = (id: string) => {
    onChange({
      ...resume,
      education: resume.education.filter((e) => e.id !== id),
    });
  };

  // Certifications Mutator
  const addCertification = () => {
    const newCert: CertificationItem = {
      id: Math.random().toString(36).substring(2, 9),
      name: 'Cloud Practitioner Certification',
      issuer: 'AWS',
      year: '2024',
    };
    onChange({
      ...resume,
      certifications: [...resume.certifications, newCert],
    });
  };

  const removeCertification = (id: string) => {
    onChange({
      ...resume,
      certifications: resume.certifications.filter((c) => c.id !== id),
    });
  };

  // Verified candidate skills for AI evidence checks
  const candidateSkillsList = [
    ...resume.skills.languages,
    ...resume.skills.frameworks_libraries,
    ...resume.skills.cloud_databases,
    ...resume.skills.developer_tools,
  ];

  return (
    <div className="space-y-4">
      {/* Editor Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/80 border border-white/10">
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center gap-1 border-r border-white/10 pr-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed border border-white/5"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed border border-white/5"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Accordion Expand/Collapse */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={expandAll}
              className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors border border-white/5"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors border border-white/5"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Autosave Status Indicator */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
          {autosaveState === 'saving' ? (
            <>
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Saving...</span>
            </>
          ) : autosaveState === 'saved' ? (
            <>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saved {lastSavedTime ? `at ${lastSavedTime}` : ''}</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Unsaved edits</span>
            </>
          )}
        </div>
      </div>

      {/* Quick Section Navigation Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs custom-scrollbar">
        {['contact', ...sectionOrder].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setOpenSections((prev) => ({ ...prev, [key]: true }));
              const el = document.getElementById(`section-${key}`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className={`px-2.5 py-1 rounded-lg border text-[11px] capitalize whitespace-nowrap transition-all ${
              openSections[key]
                ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 font-semibold'
                : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {/* 1. Contact Information Card */}
      <Card id="section-contact" padding="md" className="border-white/10 bg-slate-900/60">
        <div
          onClick={() => toggleAccordion('contact')}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Contact Details</h3>
          </div>
          {openSections.contact ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>

        {openSections.contact && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/5">
            <Input
              label="Full Name"
              value={resume.contact.full_name}
              onChange={(e) => updateContact('full_name', e.target.value)}
              placeholder="e.g. Shreya Sharma"
            />
            <Input
              label="Email Address"
              type="email"
              value={resume.contact.email}
              onChange={(e) => updateContact('email', e.target.value)}
              placeholder="shreya@example.com"
            />
            <Input
              label="Phone Number"
              value={resume.contact.phone || ''}
              onChange={(e) => updateContact('phone', e.target.value)}
              placeholder="+91 9876543210"
            />
            <Input
              label="Location"
              value={resume.contact.location || ''}
              onChange={(e) => updateContact('location', e.target.value)}
              placeholder="Bengaluru, India"
            />
            <Input
              label="LinkedIn URL"
              value={resume.contact.linkedin_url || ''}
              onChange={(e) => updateContact('linkedin_url', e.target.value)}
              placeholder="linkedin.com/in/..."
            />
            <Input
              label="GitHub URL"
              value={resume.contact.github_url || ''}
              onChange={(e) => updateContact('github_url', e.target.value)}
              placeholder="github.com/..."
            />
          </div>
        )}
      </Card>

      {/* Reorderable Section Cards */}
      {sectionOrder.map((sectionKey, sIdx) => {
        const isHidden = hiddenSections.includes(sectionKey);

        switch (sectionKey) {
          case 'summary':
            return (
              <Card id="section-summary" key="summary" padding="md" className="border-white/10 bg-slate-900/60">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div
                    onClick={() => toggleAccordion('summary')}
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">Professional Summary</h3>
                    {isHidden && (
                      <Badge variant="slate" size="sm">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleHideSection('summary')}
                      className="p-1 text-slate-400 hover:text-white"
                      title={isHidden ? 'Show section' : 'Hide section'}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'up')}
                      disabled={sIdx === 0}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'down')}
                      disabled={sIdx === sectionOrder.length - 1}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {openSections.summary && !isHidden && (
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-400">
                        2-3 sentences highlighting role, tech stack, and impact.
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setAssistTarget({
                            text: resume.summary,
                            contextRole: 'Software Engineer',
                            onAccept: (rewritten) => updateSummary(rewritten),
                          })
                        }
                        className="text-xs text-cyan-400 flex items-center gap-1 py-0.5 px-2"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Assist</span>
                      </Button>
                    </div>
                    <textarea
                      rows={3}
                      value={resume.summary}
                      onChange={(e) => updateSummary(e.target.value)}
                      placeholder="Write your professional technical summary..."
                      className="w-full bg-slate-950/70 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 leading-relaxed"
                    />
                  </div>
                )}
              </Card>
            );

          case 'skills':
            return (
              <Card id="section-skills" key="skills" padding="md" className="border-white/10 bg-slate-900/60">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div
                    onClick={() => toggleAccordion('skills')}
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <Code className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">Technical Skills</h3>
                    {isHidden && (
                      <Badge variant="slate" size="sm">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleHideSection('skills')}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'up')}
                      disabled={sIdx === 0}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'down')}
                      disabled={sIdx === sectionOrder.length - 1}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {openSections.skills && !isHidden && (
                  <div className="mt-3 space-y-3">
                    {[
                      { key: 'languages', label: 'Languages' },
                      { key: 'frameworks_libraries', label: 'Frameworks & Libraries' },
                      { key: 'cloud_databases', label: 'Databases & Cloud' },
                      { key: 'developer_tools', label: 'Developer Tools' },
                      { key: 'core_concepts', label: 'Core Concepts' },
                    ].map((cat) => {
                      const categoryKey = cat.key as keyof CanonicalResume['skills'];
                      const items = resume.skills[categoryKey] || [];
                      return (
                        <div key={cat.key} className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            {cat.label}
                          </label>
                          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/70 border border-white/5 rounded-lg min-h-[38px] items-center">
                            {items.map((skill) => (
                              <span
                                key={skill}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-800 text-cyan-300 border border-cyan-500/20"
                              >
                                {skill}
                                <button
                                  onClick={() => removeSkillItem(categoryKey, skill)}
                                  className="text-slate-400 hover:text-rose-400"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                            <input
                              type="text"
                              placeholder="+ Add skill (Press Enter)"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addSkillItem(categoryKey, e.currentTarget.value);
                                  e.currentTarget.value = '';
                                }
                              }}
                              className="text-xs bg-transparent text-white placeholder-slate-500 focus:outline-none flex-1 min-w-[120px]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );

          case 'experience':
            return (
              <Card id="section-experience" key="experience" padding="md" className="border-white/10 bg-slate-900/60">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div
                    onClick={() => toggleAccordion('experience')}
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <Briefcase className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">
                      Work Experience ({resume.experience.length})
                    </h3>
                    {isHidden && (
                      <Badge variant="slate" size="sm">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleHideSection('experience')}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'up')}
                      disabled={sIdx === 0}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'down')}
                      disabled={sIdx === sectionOrder.length - 1}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {openSections.experience && !isHidden && (
                  <div className="mt-3 space-y-4">
                    {resume.experience.map((exp, eIdx) => (
                      <div
                        key={exp.id || eIdx}
                        className="p-3.5 bg-slate-950/70 border border-white/10 rounded-xl space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                            Role #{eIdx + 1}
                          </span>
                          <button
                            onClick={() => removeExperience(exp.id)}
                            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <Input
                            label="Role Title"
                            value={exp.role}
                            onChange={(e) => updateExperienceItem(exp.id, { role: e.target.value })}
                          />
                          <Input
                            label="Company Name"
                            value={exp.company}
                            onChange={(e) => updateExperienceItem(exp.id, { company: e.target.value })}
                          />
                          <Input
                            label="Start Date"
                            value={exp.start_date}
                            onChange={(e) => updateExperienceItem(exp.id, { start_date: e.target.value })}
                            placeholder="Jan 2023"
                          />
                          <Input
                            label="End Date"
                            value={exp.end_date || ''}
                            onChange={(e) => updateExperienceItem(exp.id, { end_date: e.target.value })}
                            placeholder="Present"
                          />
                        </div>

                        {/* Bullets List */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-semibold text-slate-400">
                              Achievement Bullets
                            </span>
                            <button
                              onClick={() => addExperienceBullet(exp.id)}
                              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Bullet</span>
                            </button>
                          </div>

                          {exp.bullets.map((bullet, bIdx) => (
                            <div key={bIdx} className="flex items-start gap-2">
                              <span className="text-slate-500 text-xs mt-2">•</span>
                              <textarea
                                rows={2}
                                value={bullet}
                                onChange={(e) =>
                                  updateExperienceBullet(exp.id, bIdx, e.target.value)
                                }
                                className="flex-1 bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                              />
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() =>
                                    setAssistTarget({
                                      text: bullet,
                                      contextRole: exp.role,
                                      contextCompany: exp.company,
                                      onAccept: (rewritten) =>
                                        updateExperienceBullet(exp.id, bIdx, rewritten),
                                    })
                                  }
                                  title="AI Assist"
                                  className="p-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => removeExperienceBullet(exp.id, bIdx)}
                                  title="Delete bullet"
                                  className="p-1 rounded text-slate-500 hover:text-rose-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addExperience}
                      className="w-full text-xs flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Experience</span>
                    </Button>
                  </div>
                )}
              </Card>
            );

          case 'projects':
            return (
              <Card id="section-projects" key="projects" padding="md" className="border-white/10 bg-slate-900/60">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div
                    onClick={() => toggleAccordion('projects')}
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <FolderGit2 className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">
                      Key Projects ({resume.projects.length})
                    </h3>
                    {isHidden && (
                      <Badge variant="slate" size="sm">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleHideSection('projects')}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'up')}
                      disabled={sIdx === 0}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'down')}
                      disabled={sIdx === sectionOrder.length - 1}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {openSections.projects && !isHidden && (
                  <div className="mt-3 space-y-4">
                    {resume.projects.map((proj, pIdx) => (
                      <div
                        key={proj.id || pIdx}
                        className="p-3.5 bg-slate-950/70 border border-white/10 rounded-xl space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                            Project #{pIdx + 1}
                          </span>
                          <button
                            onClick={() => removeProject(proj.id)}
                            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>

                        <Input
                          label="Project Title"
                          value={proj.title}
                          onChange={(e) => updateProjectItem(proj.id, { title: e.target.value })}
                        />

                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                            Technologies (Comma separated)
                          </label>
                          <input
                            type="text"
                            value={proj.tech_stack.join(', ')}
                            onChange={(e) =>
                              updateProjectItem(proj.id, {
                                tech_stack: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                              })
                            }
                            placeholder="React, TypeScript, FastAPI, Redis"
                            className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>

                        {/* Bullets */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-slate-400 block">
                            Key Features & Accomplishments
                          </span>
                          {proj.bullets.map((bullet, bIdx) => (
                            <div key={bIdx} className="flex items-start gap-2">
                              <span className="text-slate-500 text-xs mt-2">•</span>
                              <textarea
                                rows={2}
                                value={bullet}
                                onChange={(e) => {
                                  const newB = [...proj.bullets];
                                  newB[bIdx] = e.target.value;
                                  updateProjectItem(proj.id, { bullets: newB });
                                }}
                                className="flex-1 bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                              />
                              <button
                                onClick={() =>
                                  setAssistTarget({
                                    text: bullet,
                                    contextRole: 'Project Developer',
                                    contextCompany: proj.title,
                                    onAccept: (rewritten) => {
                                      const newB = [...proj.bullets];
                                      newB[bIdx] = rewritten;
                                      updateProjectItem(proj.id, { bullets: newB });
                                    },
                                  })
                                }
                                title="AI Assist"
                                className="p-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addProject}
                      className="w-full text-xs flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Project</span>
                    </Button>
                  </div>
                )}
              </Card>
            );

          case 'education':
            return (
              <Card id="section-education" key="education" padding="md" className="border-white/10 bg-slate-900/60">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div
                    onClick={() => toggleAccordion('education')}
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <GraduationCap className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">Education ({resume.education.length})</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleHideSection('education')}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'up')}
                      disabled={sIdx === 0}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'down')}
                      disabled={sIdx === sectionOrder.length - 1}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {openSections.education && !isHidden && (
                  <div className="mt-3 space-y-3">
                    {resume.education.map((edu) => (
                      <div
                        key={edu.id}
                        className="p-3 bg-slate-950/70 border border-white/10 rounded-xl space-y-2"
                      >
                        <div className="flex justify-between">
                          <span className="text-xs font-bold text-white">{edu.institution}</span>
                          <button
                            onClick={() => removeEducation(edu.id)}
                            className="text-xs text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            label="Degree & Major"
                            value={edu.degree}
                            onChange={(e) =>
                              onChange({
                                ...resume,
                                education: resume.education.map((item) =>
                                  item.id === edu.id ? { ...item, degree: e.target.value } : item
                                ),
                              })
                            }
                          />
                          <Input
                            label="Grade / CGPA"
                            value={edu.gpa_or_percentage || ''}
                            onChange={(e) =>
                              onChange({
                                ...resume,
                                education: resume.education.map((item) =>
                                  item.id === edu.id
                                    ? { ...item, gpa_or_percentage: e.target.value }
                                    : item
                                ),
                              })
                            }
                          />
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addEducation} className="w-full text-xs">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Education
                    </Button>
                  </div>
                )}
              </Card>
            );

          case 'certifications':
            return (
              <Card id="section-certifications" key="certifications" padding="md" className="border-white/10 bg-slate-900/60">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div
                    onClick={() => toggleAccordion('certifications')}
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <Award className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">
                      Certifications ({resume.certifications.length})
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleHideSection('certifications')}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'up')}
                      disabled={sIdx === 0}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 'down')}
                      disabled={sIdx === sectionOrder.length - 1}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {openSections.certifications && !isHidden && (
                  <div className="mt-3 space-y-2">
                    {resume.certifications.map((cert) => (
                      <div
                        key={cert.id}
                        className="p-2.5 bg-slate-950/70 border border-white/10 rounded-lg flex items-center justify-between"
                      >
                        <span className="text-xs text-slate-200">
                          {cert.name} ({cert.issuer}) {cert.year ? `• ${cert.year}` : ''}
                        </span>
                        <button
                          onClick={() => removeCertification(cert.id)}
                          className="text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addCertification} className="w-full text-xs">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Certification
                    </Button>
                  </div>
                )}
              </Card>
            );

          default:
            return null;
        }
      })}

      {/* AI Assist Modal */}
      {assistTarget && (
        <AIAssistModal
          isOpen={Boolean(assistTarget)}
          onClose={() => setAssistTarget(null)}
          originalText={assistTarget.text}
          contextRole={assistTarget.contextRole}
          contextCompany={assistTarget.contextCompany}
          candidateSkills={candidateSkillsList}
          onAccept={assistTarget.onAccept}
        />
      )}
    </div>
  );
};
