import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ShieldCheck,
  X,
  FileCode,
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  CanonicalResume,
  TemplateId,
  AccentColor,
  FontSize,
  ExportSelfTestResponse,
} from '../../types/resumeStudio';
import { api } from '../../services/api';

interface ExportDropdownProps {
  resume: CanonicalResume;
  template: TemplateId;
  accentColor: AccentColor;
  fontSize: FontSize;
  targetRole?: string;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  resume,
  template,
  accentColor,
  fontSize,
  targetRole = 'Full Stack Engineer',
}) => {
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'docx' | null>(null);
  const [selfTestLoading, setSelfTestLoading] = useState<boolean>(false);
  const [selfTestResult, setSelfTestResult] = useState<ExportSelfTestResponse | null>(null);
  const [selfTestModalOpen, setSelfTestModalOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDownload = async (format: 'pdf' | 'docx') => {
    setDownloadingFormat(format);
    try {
      const response = await api.post(
        '/api/v1/resume-studio/export',
        {
          resume,
          format,
          template,
          accent_color: accentColor,
          font_size: fontSize,
          target_role: targetRole,
        },
        { responseType: 'blob' }
      );

      // Extract filename from header or fallback
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${resume.contact.full_name || 'Candidate'}_Resume.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      // Trigger browser download
      const blob = new Blob([response.data], {
        type:
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloadingFormat(null);
      setDropdownOpen(false);
    }
  };

  const handleRunSelfTest = async () => {
    setSelfTestLoading(true);
    setDropdownOpen(false);
    try {
      const response = await api.post<ExportSelfTestResponse>(
        '/api/v1/resume-studio/export/self-test',
        {
          resume,
          format: 'pdf',
          template,
          accent_color: accentColor,
          font_size: fontSize,
          target_role: targetRole,
        }
      );
      setSelfTestResult(response.data);
      setSelfTestModalOpen(true);
    } catch (err) {
      console.error('Self-test failed:', err);
    } finally {
      setSelfTestLoading(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div className="flex items-center gap-1.5">
        {/* Verified Badge Pill if already tested */}
        {selfTestResult?.is_ats_readable && (
          <div
            onClick={() => setSelfTestModalOpen(true)}
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium cursor-pointer hover:bg-emerald-500/20 transition-all"
            title="Click to view ATS self-test audit report"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>ATS-Readable</span>
          </div>
        )}

        {/* Main Export Dropdown Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={downloadingFormat !== null || selfTestLoading}
          className="text-xs flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>
            {downloadingFormat
              ? `Exporting ${downloadingFormat.toUpperCase()}...`
              : selfTestLoading
              ? 'Testing ATS...'
              : 'Export'}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </Button>
      </div>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-cyan-500/30 shadow-2xl p-1.5 z-50 text-white animate-fade-in">
          <div className="px-2.5 py-1.5 border-b border-white/5 mb-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
              Download Format
            </span>
          </div>

          {/* PDF Option */}
          <button
            onClick={() => handleDownload('pdf')}
            className="w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium hover:bg-white/5 text-slate-200 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Download PDF</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">.pdf</span>
          </button>

          {/* Word DOCX Option */}
          <button
            onClick={() => handleDownload('docx')}
            className="w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium hover:bg-white/5 text-slate-200 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-violet-400" />
              <span>Download Word</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">.docx</span>
          </button>

          <div className="my-1 border-t border-white/5" />

          {/* Self-Test Audit Option */}
          <button
            onClick={handleRunSelfTest}
            className="w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium hover:bg-emerald-500/10 text-emerald-400 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Run ATS Self-Test</span>
            </div>
            <Badge variant="emerald" size="sm">
              Audit
            </Badge>
          </button>
        </div>
      )}

      {/* Self-Test Audit Modal */}
      {selfTestModalOpen && selfTestResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl p-5 sm:p-6 text-white space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">ATS Readability Self-Test</h3>
                  <p className="text-[11px] text-slate-400">
                    Automated re-parse audit of exported {selfTestResult.file_type} file.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelfTestModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Verdict Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                selfTestResult.is_ats_readable
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              {selfTestResult.is_ats_readable ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div>
                <h4 className="text-xs font-bold">{selfTestResult.verdict}</h4>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {selfTestResult.is_ats_readable
                    ? 'All standard ATS parsing checks passed. Content is 100% extractable.'
                    : 'Some sections or contact fields could not be cleanly extracted.'}
                </p>
              </div>
            </div>

            {/* Detailed Audit Checklist */}
            <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-white/5 text-xs">
              {/* Filename */}
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Standard Filename:</span>
                <span className="font-mono text-cyan-300 text-[11px]">{selfTestResult.filename}</span>
              </div>

              {/* Name Extraction */}
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Candidate Name:</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{selfTestResult.name_matched ? 'Verified' : 'Missing'}</span>
                </span>
              </div>

              {/* Email Extraction */}
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Email Address:</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{selfTestResult.email_matched ? 'Verified' : 'Missing'}</span>
                </span>
              </div>

              {/* Character Count */}
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Selectable Characters:</span>
                <span className="font-mono text-white">
                  {selfTestResult.character_count} chars
                </span>
              </div>

              {/* Survived Sections */}
              <div className="pt-2">
                <span className="text-slate-400 block mb-1.5">
                  Surviving Section Headings ({selfTestResult.survived_sections.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {selfTestResult.survived_sections.map((sec) => (
                    <span
                      key={sec}
                      className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-cyan-300 border border-cyan-500/20 font-medium"
                    >
                      ✓ {sec}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelfTestModalOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelfTestModalOpen(false);
                  handleDownload('pdf');
                }}
                className="flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Verified PDF</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
