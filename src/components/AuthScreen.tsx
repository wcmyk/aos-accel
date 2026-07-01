import { FormEvent, useState } from 'react';
import { useAuthStore } from '../store/auth-store';

export function AuthScreen() {
  const { signIn, signUp, error, isLoading } = useAuthStore();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setConfirmationSent(false);
    if (mode === 'sign-in') {
      await signIn(email, password);
    } else {
      await signUp(email, password);
      setConfirmationSent(true);
    }
    setSubmitting(false);
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Radix</h1>
        <p className="auth-subtitle">
          {mode === 'sign-in' ? 'Sign in to your workbooks' : 'Create an account'}
        </p>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          />
        </label>

        {error && <div className="auth-error">{error}</div>}
        {confirmationSent && !error && (
          <div className="auth-info">Check your email to confirm your account, then sign in.</div>
        )}

        <button type="submit" disabled={submitting || isLoading}>
          {mode === 'sign-in' ? 'Sign in' : 'Sign up'}
        </button>

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setConfirmationSent(false);
          }}
        >
          {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
