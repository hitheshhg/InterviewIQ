import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { api } from '../services/api';

export interface UserProfile {
  firebase_uid: string;
  email: string;
  display_name: string;
  photo_url?: string;
  created_at?: string;
  last_login?: string;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  token: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const syncBackendUser = async (idToken: string) => {
    try {
      const response = await api.post(
        '/api/v1/auth/sync',
        {},
        {
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );
      if (response.data && response.data.user) {
        setUserProfile(response.data.user);
      }
    } catch (err) {
      console.error('[AuthContext] Backend user sync failed:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const idToken = await user.getIdToken();
          setToken(idToken);
          await syncBackendUser(idToken);
        } catch (err) {
          console.error('[AuthContext] Failed to retrieve ID token:', err);
        }
      } else {
        setToken(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    setToken(idToken);
    await syncBackendUser(idToken);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    const idToken = await result.user.getIdToken();
    setToken(idToken);
    await syncBackendUser(idToken);
  };

  const signupWithEmail = async (email: string, pass: string, name: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(result.user, { displayName: name });
    const idToken = await result.user.getIdToken(true);
    setToken(idToken);
    await syncBackendUser(idToken);
  };

  const logout = async () => {
    await signOut(auth);
    setToken(null);
    setUserProfile(null);
    setCurrentUser(null);
  };

  const refreshProfile = async () => {
    if (token) {
      await syncBackendUser(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        token,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
