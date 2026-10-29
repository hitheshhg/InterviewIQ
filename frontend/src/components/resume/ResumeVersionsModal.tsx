import React, { useState, useEffect } from 'react';
import {
  VersionSummaryItem,
  CanonicalResume,
  CreateVersionRequest,
  ResumeVersionDoc,
} from '../../types/resumeStudio';
import { api } from '../../services/api';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  X,
  History,
  GitCompare,
  RotateCcw,
  Trash2,
  Edit2,
  Check,
  Plus,
  Loader2,
} from 'lucide-react';


interface ResumeVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentResume: CanonicalResume;
  currentScore: number;
  onLoadVersion: (resume: CanonicalResume, label: string) => void;
  onOpenCompare: (versionId1: string, versionId2: string) => void;
}

export const ResumeVersionsModal: React.FC<ResumeVersionsModalProps> = ({
  isOpen,
  onClose,
  currentResume,
  currentScore,
  onLoadVersion,
  onOpenCompare,
}) => {
  const [versions, setVersions] = useState<VersionSummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [savingNew, setSavingNew] = useState<boolean>(false);
  const [newLabel, setNewLabel] = useState<string>('');
  const [targetRole, setTargetRole] = useState<string>('Software Engineer');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabelText, setEditingLabelText] = useState<string>('');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const res = await api.get<VersionSummaryItem[]>('/api/v1/resume-studio/versions');
      setVersions(res.data);
    } catch (err) {
      console.warn('Failed to fetch versions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
      setSelectedForCompare([]);
      setActionNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveCurrentAsVersion = async () => {
    if (!newLabel.trim()) return;
    setSavingNew(true);
    try {
      const payload: CreateVersionRequest = {
        label: newLabel.trim(),
        target_role: targetRole.trim() || 'Software Engineer',
        data: currentResume,
        ats_score: currentScore || 0,
      };
      await api.post('/api/v1/resume-studio/version', payload);
      setNewLabel('');
      setActionNotice('New snapshot saved!');
      setTimeout(() => setActionNotice(null), 3000);
      await fetchVersions();
    } catch (err) {
      console.error('Failed to create version:', err);
    } finally {
      setSavingNew(false);
    }
  };

  const handleUpdateLabel = async (versionId: string) => {
    if (!editingLabelText.trim()) return;
    try {
      await api.patch(`/api/v1/resume-studio/version/${versionId}/label`, {
        label: editingLabelText.trim(),
      });
      setEditingId(null);
      await fetchVersions();
    } catch (err) {
      console.error('Failed to update label:', err);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    setLoading(true);
    try {
      const res = await api.post<ResumeVersionDoc>(`/api/v1/resume-studio/version/${versionId}/restore`);
      onLoadVersion(res.data.data, res.data.label);
      setActionNotice(`Restored as "${res.data.label}"!`);
      setTimeout(() => setActionNotice(null), 3000);
      await fetchVersions();
    } catch (err) {
      console.error('Failed to restore version:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadVersionDirectly = async (versionId: string) => {
    setLoading(true);
    try {
      const res = await api.get<ResumeVersionDoc>(`/api/v1/resume-studio/version/${versionId}`);
      onLoadVersion(res.data.data, res.data.label);
      onClose();
    } catch (err) {
      console.error('Failed to load version:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!window.confirm('Delete this saved resume version?')) return;
    try {
      await api.delete(`/api/v1/resume-studio/version/${versionId}`);
      setSelectedForCompare((prev) => prev.filter((id) => id !== versionId));
      await fetchVersions();
    } catch (err) {
      console.error('Failed to delete version:', err);
    }
  };

  const toggleSelectForCompare = (versionId: string) => {
    if (selectedForCompare.includes(versionId)) {
      setSelectedForCompare(selectedForCompare.filter((id) => id !== versionId));
    } else {
      if (selectedForCompare.length >= 2) {
        setSelectedForCompare([selectedForCompare[1], versionId]);
      } else {
        setSelectedForCompare([...selectedForCompare, versionId]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Resume Versions</h2>
              <p className="text-xs text-slate-400">Manage, restore, or compare versions.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Banner */}
        {actionNotice && (
          <div className="px-6 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-xs font-medium text-emerald-400 flex items-center gap-2">
            <Check className="w-4 h-4" />
            {actionNotice}
          </div>
        )}

        {/* Snapshot Current Form */}
        <div className="px-6 py-4 bg-slate-900/40 border-b border-white/5 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full flex items-center gap-2">
            <input
              type="text"
              placeholder="Version label (e.g., Tailored: Google SDE)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-slate-950/80 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
            <input
              type="text"
              placeholder="Role"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-32 px-3 py-1.5 text-xs bg-slate-950/80 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500 hidden sm:block"
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveCurrentAsVersion}
            disabled={!newLabel.trim() || savingNew}
            className="w-full sm:w-auto text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            {savingNew ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Save current
          </Button>
        </div>

        {/* Comparison Action Bar */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-white/5 flex items-center justify-between text-xs">
          <div className="text-slate-400">
            Select 2 versions to compare ({selectedForCompare.length}/2 selected)
          </div>

          <Button
            variant="secondary"
            size="sm"
            disabled={selectedForCompare.length !== 2}
            onClick={() => onOpenCompare(selectedForCompare[0], selectedForCompare[1])}
            className="text-xs py-1 px-3 flex items-center gap-1.5"
          >
            <GitCompare className="w-3.5 h-3.5 text-cyan-400" />
            Compare
          </Button>
        </div>

        {/* Versions List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading && versions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
              Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No saved versions yet. Save your current draft above.
            </div>
          ) : (
            versions.map((ver) => {
              const isSelected = selectedForCompare.includes(ver.id);
              const isEditing = editingId === ver.id;

              return (
                <div
                  key={ver.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/40'
                      : 'bg-slate-950/40 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectForCompare(ver.id)}
                      className="mt-1 rounded bg-slate-900 border-white/20 text-cyan-500 focus:ring-0 cursor-pointer"
                    />

                    <div>
                      {isEditing ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="text"
                            value={editingLabelText}
                            onChange={(e) => setEditingLabelText(e.target.value)}
                            className="px-2 py-0.5 text-xs bg-slate-900 border border-cyan-500/50 rounded text-white focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateLabel(ver.id)}
                            className="p-1 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-semibold text-white tracking-tight">
                            {ver.label}
                          </h4>
                          <button
                            onClick={() => {
                              setEditingId(ver.id);
                              setEditingLabelText(ver.label);
                            }}
                            className="text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span>{ver.target_role}</span>
                        <span>•</span>
                        <span>{ver.created_at ? ver.created_at.slice(0, 10) : 'Recent'}</span>
                        {ver.parent_version_id && (
                          <Badge variant="slate" className="text-[10px] py-0 px-1.5">
                            Tailored branch
                          </Badge>
                        )}

                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
                      {Math.round(ver.ats_score)}% ATS
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleLoadVersionDirectly(ver.id)}
                        className="text-xs py-1 px-2.5"
                      >
                        Load
                      </Button>

                      <button
                        onClick={() => handleRestoreVersion(ver.id)}
                        title="Restore copy"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteVersion(ver.id)}
                        title="Delete version"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-950/60 flex items-center justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
