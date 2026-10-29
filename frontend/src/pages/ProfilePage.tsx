import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import Avatar from '../components/common/Avatar';
import Card from '../components/ui/Card';
import { Calendar, Award, Mail, RefreshCw } from 'lucide-react';

interface ProfileDetails {
  email: string;
  display_name: string;
  photo_url?: string;
  created_at?: string;
  total_sessions: number;
}

export const ProfilePage: React.FC = () => {
  const { currentUser } = useAuth();
  const [details, setDetails] = useState<ProfileDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/v1/auth/profile');
        if (res.data) {
          setDetails(res.data);
        }
      } catch (err) {
        console.error('Failed to load profile details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const displayName =
    details?.display_name || currentUser?.displayName || 'Candidate';
  const email = details?.email || currentUser?.email || 'No email provided';
  const photoUrl = details?.photo_url || currentUser?.photoURL || null;

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'Active Candidate';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recent Member';
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8">
      {/* Page Title: max 4 words */}
      <h1 className="text-2xl font-bold text-white mb-6">Candidate Profile</h1>

      <Card glow="cyan" padding="lg" className="border-cyan-500/20 bg-slate-900/60">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Avatar with initials fallback */}
          <Avatar src={photoUrl} name={displayName} size="xl" className="ring-4 ring-cyan-500/20" />

          {/* Name & Email */}
          <div>
            <h2 className="text-xl font-bold text-white">{displayName}</h2>
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-1">
              <Mail className="w-3.5 h-3.5 text-cyan-400" />
              <span>{email}</span>
            </div>
          </div>

          <div className="w-full border-t border-white/10 pt-4 grid grid-cols-2 gap-4 text-left">
            {/* Member Since */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Member Since</span>
              </div>
              <p className="text-sm font-semibold text-white mt-1">
                {loading ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />
                ) : (
                  formatDate(details?.created_at)
                )}
              </p>
            </div>

            {/* Total Sessions */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Award className="w-3.5 h-3.5 text-violet-400" />
                <span>Total Sessions</span>
              </div>
              <p className="text-sm font-semibold text-white mt-1">
                {loading ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />
                ) : (
                  details?.total_sessions ?? 0
                )}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ProfilePage;

