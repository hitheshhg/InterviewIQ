import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { LandingPage } from './pages/LandingPage';
import { ResumeAnalyzerPage } from './pages/ResumeAnalyzerPage';
import { InterviewRoomPage } from './pages/InterviewRoomPage';
import { InterviewReportPage } from './pages/InterviewReportPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { DashboardPage } from './pages/DashboardPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export const App: React.FC = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <ErrorBoundary>
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
                <Route path="/report" element={<InterviewReportPage />} />
                <Route path="/report/:sessionId" element={<InterviewReportPage />} />
                <Route path="/roadmap" element={<RoadmapPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
              </Routes>
            </main>
          </div>

          <Footer />

          {/* Authentication Dialog */}
          <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        </div>
      </Router>
    </AuthProvider>
  </ErrorBoundary>
  );
};

export default App;
