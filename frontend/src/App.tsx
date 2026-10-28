import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Map, LayoutDashboard } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { LandingPage } from './pages/LandingPage';
import { ResumeAnalyzerPage } from './pages/ResumeAnalyzerPage';
import { InterviewRoomPage } from './pages/InterviewRoomPage';
import Card from './components/ui/Card';
import Button from './components/ui/Button';

// Placeholder view for modules to be built in subsequent phases
const ModulePlaceholder: React.FC<{
  title: string;
  phase: string;
  icon: React.ReactNode;
  description: string;
}> = ({ title, phase, icon, description }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <Card glow="cyan" padding="lg" className="max-w-2xl mx-auto border-cyan-500/20">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-4 border border-cyan-500/30">
          {icon}
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
          {phase}
        </span>
        <h2 className="text-2xl font-bold text-white mt-3">{title}</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
          {description}
        </p>

        <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center gap-3">
          <Link to="/">
            <Button variant="secondary" size="sm">
              Return to Landing Page
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export const App: React.FC = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
          <div>
            <Navbar onOpenAuth={() => setAuthModalOpen(true)} />

            <main>
              <Routes>
                <Route path="/" element={<LandingPage onOpenAuth={() => setAuthModalOpen(true)} />} />
                <Route path="/analyzer" element={<ResumeAnalyzerPage />} />
                <Route path="/interview" element={<InterviewRoomPage />} />
                <Route
                  path="/roadmap"
                  element={
                    <ModulePlaceholder
                      title="Personalized Career Roadmap Builder"
                      phase="Phase 9 Pipeline"
                      icon={<Map className="w-6 h-6" />}
                      description="Algorithmic milestone progression generated specifically to resolve weak areas identified during the interview."
                    />
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ModulePlaceholder
                      title="Candidate Performance Dashboard"
                      phase="Phase 9 Pipeline"
                      icon={<LayoutDashboard className="w-6 h-6" />}
                      description="Historical analytics, multi-metric radar progress, and past interview breakdown archive."
                    />
                  }
                />
              </Routes>
            </main>
          </div>

          <Footer />

          {/* Authentication Dialog */}
          <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
