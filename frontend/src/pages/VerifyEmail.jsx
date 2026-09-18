import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyPatientEmail } from '../lib/api';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState(token ? 'loading' : 'missing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyPatientEmail(token)
      .then(({ data }) => {
        if (cancelled) return;
        setStatus('ok');
        setMessage(data?.message || 'Email verified.');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(
          err.response?.data?.message ||
            err.response?.data?.error ||
            'This verification link is invalid or has expired.'
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-lg border border-outline-variant/30 text-center space-y-4">
        <h1 className="font-headline-md text-xl text-primary">Verify email</h1>
        {status === 'loading' ? (
          <p className="font-body-md text-sm text-on-surface-variant">Confirming your email…</p>
        ) : null}
        {status === 'ok' ? (
          <p className="font-body-md text-sm text-emerald-800">{message}</p>
        ) : null}
        {status === 'error' || status === 'missing' ? (
          <p className="font-body-md text-sm text-red-800">
            {message || 'Missing verification token. Open the link from your email.'}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="w-full py-3 rounded-xl bg-primary text-white font-label-sm"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
};

export default VerifyEmail;
