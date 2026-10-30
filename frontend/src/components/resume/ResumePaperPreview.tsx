import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  CanonicalResume,
  TemplateId,
  AccentColor,
  FontSize,
  SectionKey,
} from '../../types/resumeStudio';
import { ClassicTemplate } from './templates/ClassicTemplate';
import { ModernTemplate } from './templates/ModernTemplate';
import { CompactTemplate } from './templates/CompactTemplate';
import { MinimalTemplate } from './templates/MinimalTemplate';
import Badge from '../ui/Badge';
import { Check, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ResumePaperPreviewProps {
  resume: CanonicalResume;
  template: TemplateId;
  accentColor: AccentColor;
  fontSize: FontSize;
  sectionOrder: SectionKey[];
  hiddenSections: SectionKey[];
  onTemplateChange: (t: TemplateId) => void;
  onAccentColorChange: (c: AccentColor) => void;
  onFontSizeChange: (f: FontSize) => void;
}

const PAGE_HEIGHT_PX = 1056; // Standard 96 DPI A4/Letter printable page height
const PAPER_WIDTH_PX = 800; // Standard single-column paper width

export const ResumePaperPreview: React.FC<ResumePaperPreviewProps> = ({
  resume,
  template,
  accentColor,
  fontSize,
  sectionOrder,
  hiddenSections,
  onTemplateChange,
  onAccentColorChange,
  onFontSizeChange,
}) => {
  const paperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState<number>(1);
  const [paperHeight, setPaperHeight] = useState<number>(PAGE_HEIGHT_PX);
  const [zoomScale, setZoomScale] = useState<number>(0.9);

  // Auto-fit calculation based on container width
  const handleFitToWidth = useCallback(() => {
    if (containerRef.current) {
      const availableWidth = containerRef.current.clientWidth - 48; // padding margin
      if (availableWidth > 200) {
        const targetScale = Math.min(1.1, Math.max(0.45, availableWidth / PAPER_WIDTH_PX));
        setZoomScale(Number(targetScale.toFixed(2)));
      }
    }
  }, []);

  // Monitor DOM height and dimensions dynamically
  useEffect(() => {
    const updateDimensions = () => {
      if (paperRef.current) {
        const height = paperRef.current.scrollHeight;
        setPaperHeight(height);
        const pages = Math.max(1, Math.ceil((height + 20) / PAGE_HEIGHT_PX));
        setPageCount(pages);
      }
    };
    updateDimensions();
    const timer = setTimeout(updateDimensions, 300);
    return () => clearTimeout(timer);
  }, [resume, template, fontSize, sectionOrder, hiddenSections]);

  // Initial fit and window resize listener
  useEffect(() => {
    const timer = setTimeout(handleFitToWidth, 200);
    window.addEventListener('resize', handleFitToWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleFitToWidth);
    };
  }, [handleFitToWidth]);

  const renderActiveTemplate = () => {
    const props = {
      resume,
      accentColor,
      fontSize,
      sectionOrder,
      hiddenSections,
    };
    switch (template) {
      case 'modern':
        return <ModernTemplate {...props} />;
      case 'compact':
        return <CompactTemplate {...props} />;
      case 'minimal':
        return <MinimalTemplate {...props} />;
      case 'classic':
      default:
        return <ClassicTemplate {...props} />;
    }
  };

  const templatesList: { id: TemplateId; label: string }[] = [
    { id: 'classic', label: 'Classic' },
    { id: 'modern', label: 'Modern' },
    { id: 'compact', label: 'Compact' },
    { id: 'minimal', label: 'Minimal' },
  ];

  const colorsList: { id: AccentColor; colorHex: string; label: string }[] = [
    { id: 'slate', colorHex: '#334155', label: 'Slate' },
    { id: 'cyan', colorHex: '#0891b2', label: 'Cyan' },
    { id: 'emerald', colorHex: '#059669', label: 'Emerald' },
    { id: 'navy', colorHex: '#1e40af', label: 'Navy' },
    { id: 'violet', colorHex: '#7c3aed', label: 'Violet' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950/40 rounded-xl border border-white/10 p-3 sm:p-4">
      {/* Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10 mb-3">
        {/* Template Selector Pills */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-white/10">
          {templatesList.map((t) => (
            <button
              key={t.id}
              onClick={() => onTemplateChange(t.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                template === t.id
                  ? 'bg-cyan-500 text-black shadow-md font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Accent Color & Font Controls */}
        <div className="flex items-center gap-3">
          {/* Colors */}
          <div className="flex items-center gap-1.5">
            {colorsList.map((c) => (
              <button
                key={c.id}
                onClick={() => onAccentColorChange(c.id)}
                title={c.label}
                className={`w-5 h-5 rounded-full border transition-transform flex items-center justify-center ${
                  accentColor === c.id ? 'scale-110 border-white ring-2 ring-white/20' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: c.colorHex }}
              >
                {accentColor === c.id && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>

          {/* Font Size Pills */}
          <div className="flex items-center bg-slate-900/80 p-0.5 rounded-lg border border-white/10 text-[11px]">
            {(['sm', 'md', 'lg'] as FontSize[]).map((f) => (
              <button
                key={f}
                onClick={() => onFontSizeChange(f)}
                className={`px-2 py-0.5 rounded uppercase font-mono ${
                  fontSize === f ? 'bg-white/20 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Fit Indicator */}
          <Badge
            variant={pageCount === 1 ? 'emerald' : pageCount === 2 ? 'amber' : 'rose'}
            size="sm"
          >
            {pageCount === 1 ? '1 Page (Optimal)' : `${pageCount} Pages`}
          </Badge>

          {/* Zoom & Fit Buttons */}
          <div className="flex items-center gap-1 text-slate-400">
            <button
              onClick={handleFitToWidth}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/5 hover:bg-white/10 text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 transition-colors flex items-center gap-1"
              title="Auto-fit paper width to available workspace"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fit</span>
            </button>
            <button
              onClick={() => setZoomScale((prev) => Math.max(0.4, Number((prev - 0.1).toFixed(2))))}
              className="p-1 hover:text-white hover:bg-white/5 rounded"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomScale(1.0)}
              className="text-[11px] font-mono text-slate-300 hover:text-white w-9 text-center px-0.5 py-0.5 rounded hover:bg-white/5"
              title="Click to reset to 100%"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              onClick={() => setZoomScale((prev) => Math.min(1.3, Number((prev + 0.1).toFixed(2))))}
              className="p-1 hover:text-white hover:bg-white/5 rounded"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Live Paper Canvas Scroll Stage with responsive height & zero-phantom-overflow */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-14rem)] min-h-[500px] flex justify-center p-3 sm:p-5 bg-slate-950/70 rounded-xl border border-white/5 custom-scrollbar"
      >
        <div
          style={{
            width: `${PAPER_WIDTH_PX * zoomScale}px`,
            height: `${paperHeight * zoomScale}px`,
            position: 'relative',
            transition: 'width 0.12s ease-out, height 0.12s ease-out',
          }}
          className="shrink-0"
        >
          {/* White Paper Sheet */}
          <div
            ref={paperRef}
            style={{
              width: `${PAPER_WIDTH_PX}px`,
              transform: `scale(${zoomScale})`,
              transformOrigin: 'top left',
              transition: 'transform 0.12s ease-out',
              minHeight: `${PAGE_HEIGHT_PX}px`,
            }}
            className="bg-white text-slate-900 p-8 sm:p-10 rounded-lg shadow-2xl absolute top-0 left-0 border border-slate-200"
          >
            {renderActiveTemplate()}

            {/* Visual Page Break Line if 2+ pages */}
            {pageCount > 1 && (
              <div
                style={{ top: `${PAGE_HEIGHT_PX}px` }}
                className="absolute left-0 right-0 border-t-2 border-dashed border-red-400 flex items-center justify-end pr-4 pointer-events-none"
              >
                <span className="bg-red-500 text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shadow -translate-y-1/2">
                  Page 1 End
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
