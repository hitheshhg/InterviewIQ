import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ResumeAnalyzerPage } from './pages/ResumeAnalyzerPage';
import { InterviewRoomPage } from './pages/InterviewRoomPage';
import { InterviewReportPage } from './pages/InterviewReportPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { ProfilePage } from './pages/ProfilePage';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const AuthRouteHandler: React.FC<{
  mode: 'signin' | 'signup';
  onOpenAuth: (m?: 'signin' | 'signup') => void;
}> = ({ mode, onOpenAuth }) => {
  React.useEffect(() => {
    onOpenAuth(mode);
  }, [mode, onOpenAuth]);
  return <LandingPage onOpenAuth={onOpenAuth} />;
};

export const App: React.FC = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Minimal Landing Page */}
            <Route
              path="/"
              element={<LandingPage onOpenAuth={handleOpenAuth} />}
            />

            {/* Direct Auth URLs opening corresponding modal tab */}
            <Route
              path="/signin"
              element={
                <AuthRouteHandler
                  mode="signin"
                  onOpenAuth={handleOpenAuth}
                />
              }
            />
            <Route
              path="/signup"
              element={
                <AuthRouteHandler
                  mode="signup"
                  onOpenAuth={handleOpenAuth}
                />
              }
            />

            {/* Protected SaaS App with Left Sidebar & Topbar */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <DashboardPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analyzer"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ResumeAnalyzerPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <InterviewRoomPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/report"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <InterviewReportPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/report/:sessionId"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <InterviewReportPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/roadmap"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <RoadmapPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ProfilePage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            {/* Catch-all redirect to / */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Authentication Modal */}
          <AuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            initialMode={authMode}
          />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
