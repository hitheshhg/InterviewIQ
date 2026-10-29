import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[InterviewIQ ErrorBoundary] Intercepted runtime error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.href = '/';
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex items-center justify-center p-4 selection:bg-cyan-500 selection:text-white">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-slate-900/80 border border-rose-500/30 backdrop-blur-xl shadow-2xl shadow-rose-950/40 text-center">
            {/* Warning Icon with Glow */}
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-500/20">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20 uppercase tracking-wider">
              UI Runtime Handled
            </span>

            <h2 className="text-xl sm:text-2xl font-bold text-white mt-3">
              Something went wrong
            </h2>

            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              InterviewIQ intercepted an unexpected interface error. Your session data, ATS resumes, and interview evaluations are safely persisted in MongoDB Atlas.
            </p>

            {/* Recovery Action Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload Platform
              </button>

              <button
                type="button"
                onClick={this.handleHome}
                className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" /> Return Home
              </button>
            </div>

            {/* Expandable Technical Diagnostics for Evaluators */}
            <div className="mt-6 pt-4 border-t border-white/5 text-left">
              <button
                type="button"
                onClick={this.toggleDetails}
                className="text-[11px] font-mono text-slate-500 hover:text-slate-300 flex items-center justify-between w-full transition-colors"
              >
                <span>Technical Diagnostics (Evaluation Log)</span>
                {this.state.showDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {this.state.showDetails && (
                <div className="mt-2 p-3 rounded-lg bg-black/60 border border-white/5 font-mono text-[10px] text-rose-300 max-h-40 overflow-y-auto space-y-1">
                  <div className="font-bold">{this.state.error?.toString()}</div>
                  <pre className="text-slate-500 whitespace-pre-wrap">
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
