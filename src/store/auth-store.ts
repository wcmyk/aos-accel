/**
 * Auth state backed by Supabase Auth. No-op / always-signed-out when cloud
 * features aren't configured (see src/lib/supabase.ts).
 */

import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase, isCloudEnabled } from '../lib/supabase';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  init: () => void;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: isCloudEnabled,
  error: null,

  init: () => {
    if (!supabase) {
      set({ isLoading: false });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      set({ user: data.session?.user ?? null, isLoading: false });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null });
    });
  },

  signUp: async (email, password) => {
    if (!supabase) return;
    set({ error: null });
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) set({ error: error.message });
  },

  signIn: async (email, password) => {
    if (!supabase) return;
    set({ error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) set({ error: error.message });
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  },
}));
