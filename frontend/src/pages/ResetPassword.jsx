import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { resetDoctorPassword } from '../lib/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await resetDoctorPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Link may be expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#1A1A18] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl text-center">
          <h1 className="font-headline-lg text-amber-900 text-xl mb-4">Invalid Link</h1>
          <p className="font-body-md text-on-surface-variant mb-6">This password reset link is invalid or missing.</p>
          <Link to="/provider" className="bg-primary text-white px-6 py-3 rounded-xl font-label-sm inline-block">Go to Provider Portal</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1A18] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="font-headline-lg text-amber-900 text-2xl mb-1">Reset Password</h1>
          <p className="font-body-md text-on-surface-variant text-sm">Enter a new password for your provider account.</p>
        </div>
        
        {success ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">check</span>
            </div>
            <p className="font-body-md text-green-700 mb-6 font-semibold">Your password has been reset successfully!</p>
            <Link to="/provider" className="w-full bg-primary text-white py-4 rounded-xl font-label-sm hover:opacity-90 transition-all block">Sign in to Portal</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest block mb-2">New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none font-body-md" required minLength={6} />
            </div>
            <div>
              <label className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest block mb-2">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none font-body-md" required minLength={6} />
            </div>
            {error && <p className="text-secondary font-label-sm text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-primary text-white py-4 rounded-xl font-label-sm hover:opacity-90 transition-all disabled:opacity-60">
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
