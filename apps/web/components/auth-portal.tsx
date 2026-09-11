'use client';

import { useClerk } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../../../convex/_generated/api';

type Mode = 'sign-in' | 'sign-up';
type IdentifierMode = 'email' | 'mobile';
type Notice = { tone: 'error' | 'success' | 'info'; text: string } | null;

function MailIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3.7 6.4h16.6v11.2H3.7z" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg>;
}
function LockIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5.2" y="10.4" width="13.6" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M8.2 10.4V7.7a3.8 3.8 0 0 1 7.6 0v2.7" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg>;
}
function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3 21 21M10.6 10.8a2 2 0 0 0 2.7 2.7M9.8 5.2A11 11 0 0 1 12 5c5.3 0 8.6 5.1 8.6 7s-1.3 3.5-3.2 4.8M6.1 6.2C3.9 7.8 3.4 10.3 3.4 12c0 1.9 3.3 7 8.6 7 .9 0 1.8-.1 2.6-.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg> : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3.4 12S6.7 5 12 5s8.6 5.1 8.6 7-3.3 7-8.6 7S3.4 13.9 3.4 12Z" fill="none" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg>;
}
function DeviceIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="6.2" y="2.9" width="11.6" height="18.2" rx="2" fill="none" stroke="currentColor" strokeWidth="1.55"/><path d="M10 18.1h4" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round"/></svg>;
}

function PortalArtwork() {
  return (
    <div className="artwork" aria-hidden="true">
      <svg className="art-svg" viewBox="0 0 620 820" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sky" x1="0" x2="0.86" y1="0.05" y2="1">
            <stop stopColor="#ecfaff"/><stop offset="0.48" stopColor="#c5e9fa"/><stop offset="1" stopColor="#7cc4e8"/>
          </linearGradient>
          <linearGradient id="mist" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fff" stopOpacity=".9"/><stop offset="1" stopColor="#effdff" stopOpacity=".06"/></linearGradient>
          <linearGradient id="floor" x1="0" x2="1"><stop stopColor="#7cc7e8"/><stop offset=".4" stopColor="#e2f6fb"/><stop offset="1" stopColor="#85d3ef"/></linearGradient>
          <radialGradient id="orb" cx=".37" cy=".22"><stop stopColor="#fff"/><stop offset=".38" stopColor="#dff3f8"/><stop offset="1" stopColor="#81c4dd"/></radialGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
          <filter id="orbShadow" x="-30%" y="-40%" width="160%" height="180%"><feDropShadow dx="-8" dy="24" stdDeviation="12" floodColor="#326b82" floodOpacity=".26"/></filter>
        </defs>
        <rect width="620" height="820" fill="url(#sky)"/>
        <g opacity=".83">
          <path d="M-35 0h60l118 356H80z" fill="#fff"/>
          <path d="m237 0 43 0L80 390H27z" fill="#fff" opacity=".94"/>
          <path d="m421 0 54 0L213 426h-52z" fill="#fff"/>
          <path d="m613 0 32 0-292 442h-39z" fill="#faffff"/>
        </g>
        <g opacity=".43" stroke="#b4e2f2" strokeWidth="4">
          <path d="M130 0 92 412M258 0 147 454M411 0 255 464M557 0 362 458"/>
        </g>
        <path d="M0 390c117-75 278-52 620-2v432H0Z" fill="url(#floor)"/>
        <path d="M0 477c132-86 295-46 620-16v359H0Z" fill="#d5f2fa" opacity=".62"/>
        <g fill="none" strokeLinecap="round" transform="translate(245 510) rotate(-9)">
          <path d="M-167 205C-2 92 131 100 290 220" stroke="#5eaeca" strokeWidth="24"/>
          <path d="M-159 236C-4 124 142 131 304 253" stroke="#f9ffff" strokeWidth="16"/>
          <path d="M-190 272C-20 153 148 159 330 292" stroke="#77bfd9" strokeWidth="28"/>
          <path d="M-179 303C-9 184 158 190 341 324" stroke="#effdff" strokeWidth="16"/>
          <path d="M-198 340C-23 218 155 223 349 361" stroke="#62afcc" strokeWidth="26"/>
          <path d="M-185 370C-10 247 164 253 361 393" stroke="#f5feff" strokeWidth="15"/>
        </g>
        <ellipse cx="298" cy="560" rx="190" ry="56" fill="#579ab4" opacity=".20" filter="url(#blur)"/>
        <g filter="url(#orbShadow)">
          <path d="M144 478c0-82 67-149 150-149s150 67 150 149c0 47-18 78-49 111H194c-32-32-50-66-50-111Z" fill="url(#orb)"/>
          <ellipse cx="294" cy="469" rx="144" ry="141" fill="none" stroke="#d9f2f8" strokeWidth="5" opacity=".8"/>
          <g fill="none" stroke="#7bb9d0" strokeWidth="6" opacity=".65">
            <path d="M169 507c72 37 178 37 250-1"/><path d="M161 529c77 43 191 43 267-2"/><path d="M157 552c82 45 199 45 275-3"/><path d="M166 576c77 41 182 42 258-1"/>
          </g>
          <ellipse cx="248" cy="399" rx="41" ry="25" fill="#fff" opacity=".55"/>
        </g>
        <path d="M0 0h620v820H0z" fill="url(#mist)" opacity=".12"/>
      </svg>
      <div className="art-scrim" />
      <div className="art-caption"><span>Welcome to the community</span><strong>Save together. Grow together.</strong><div className="pager"><i/><i className="on"/><i/><i/></div></div>
    </div>
  );
}

export function AuthPortal() {
  const { openSignIn, openSignUp } = useClerk();
  const portal = useQuery(api.portal.getConfiguration);
  const [mode, setMode] = useState<Mode>('sign-in');
  const [identifierMode, setIdentifierMode] = useState<IdentifierMode>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [systemName, setSystemName] = useState('Secure Chama Portal');
  const [mfaStage, setMfaStage] = useState<'enroll' | 'verify' | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaUri, setMfaUri] = useState('');
  const [form, setForm] = useState({ identifier: '', invitation: '', password: '', confirmation: '' });

  useEffect(() => { if (portal?.systemName) setSystemName(portal.systemName); }, [portal]);

  const identifierLabel = identifierMode === 'email' ? 'Email address' : 'Mobile number';
  const identifierPlaceholder = identifierMode === 'email' ? 'Enter your email address' : 'Enter your mobile number';
  const passwordScore = useMemo(() => [form.password.length >= 12, /[a-z]/.test(form.password), /[A-Z]/.test(form.password), /\d/.test(form.password), /[^\w\s]/.test(form.password)].filter(Boolean).length, [form.password]);

  const switchMode = (next: Mode) => {
    setMode(next); setNotice(null); setMfaStage(null); setMfaCode(''); setMfaUri(''); setForm({ identifier: '', invitation: '', password: '', confirmation: '' });
  };
  const update = (key: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [key]: value }));

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaStage || !csrfToken) return;
    setNotice(null); setBusy(true);
    try {
      const response = await fetch('/api/v1/auth/mfa/verify', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ code: mfaCode }) });
      if (response.status === 204) {
        setMfaStage(null); setMfaCode('');
        setNotice({ tone: 'success', text: 'MFA verified. Your secure session is established.' });
        return;
      }
      const payload = await response.json().catch(() => ({ error: 'SERVICE_UNAVAILABLE' })) as { error?: string };
      setNotice({ tone: 'error', text: payload.error === 'INVALID_MFA_CODE' ? 'That verification code is not valid. Try the current code from your authenticator.' : 'We could not verify that code securely.' });
    } catch { setNotice({ tone: 'error', text: 'Secure verification is not available right now. Please try again shortly.' }); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mfaStage) return submitMfa(event);
    setNotice(null);
    if (mode === 'sign-in') {
      openSignIn();
      return;
    }
    if (mode === 'sign-up') {
      openSignUp();
      return;
    }
    if (mode === 'sign-up' && form.password !== form.confirmation) {
      setNotice({ tone: 'error', text: 'The passwords do not match.' }); return;
    }
    if (mode === 'sign-up' && passwordScore < 4) {
      setNotice({ tone: 'error', text: 'Use at least 12 characters with upper/lowercase, a number and a symbol.' }); return;
    }
    setBusy(true);
    try {
      const endpoint = mode === 'sign-in' ? '/api/v1/auth/login' : '/api/v1/auth/invitations/activate';
      const body = mode === 'sign-in'
        ? { identifier: form.identifier, password: form.password }
        : { token: form.invitation.trim(), password: form.password };
      const response = await fetch(endpoint, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (response.status === 204) {
        setNotice({ tone: 'success', text: 'Your account is activated. You can now sign in securely.' });
        setMode('sign-in'); setForm({ identifier: '', invitation: '', password: '', confirmation: '' }); return;
      }
      const payload = await response.json().catch(() => ({ error: 'SERVICE_UNAVAILABLE' })) as { error?: string; mfaEnrollmentRequired?: boolean; mfaRequired?: boolean; csrfToken?: string };
      if (response.ok && payload.mfaRequired && payload.csrfToken) {
        setCsrfToken(payload.csrfToken);
        if (payload.mfaEnrollmentRequired) {
          const enrolment = await fetch('/api/v1/auth/mfa/totp/enroll', { method: 'POST', credentials: 'include', headers: { 'x-csrf-token': payload.csrfToken } });
          const enrolmentData = await enrolment.json().catch(() => ({})) as { otpauthUri?: string };
          if (!enrolment.ok || !enrolmentData.otpauthUri) throw new Error('MFA_ENROLLMENT_UNAVAILABLE');
          setMfaUri(enrolmentData.otpauthUri); setMfaStage('enroll');
          setNotice({ tone: 'info', text: 'Add this one-time secure key to your authenticator, then enter its 6-digit code.' });
        } else {
          setMfaStage('verify');
          setNotice({ tone: 'info', text: 'Enter the current 6-digit code from your authenticator.' });
        }
        return;
      }
      const messages: Record<string, string> = {
        INVALID_CREDENTIALS: 'We could not sign you in with those details.',
        INVALID_OR_EXPIRED_INVITATION: 'This invitation is invalid, expired, or has already been used.',
        RATE_LIMITED: 'Too many attempts. Please wait before trying again.',
        SERVICE_UNAVAILABLE: 'Secure sign-in is not available right now. Please try again shortly.',
      };
      setNotice({ tone: 'error', text: messages[payload.error ?? ''] ?? 'We could not complete that request securely.' });
    } catch {
      setNotice({ tone: 'error', text: 'Secure sign-in is not available right now. Please try again shortly.' });
    } finally { setBusy(false); }
  }

  return (
    <main className="portal-shell">
      <div className="texture texture-one" aria-hidden="true"/><div className="texture texture-two" aria-hidden="true"/>
      <section className="brand-panel" aria-label={`${systemName} access portal`}>
        <div className="toolkit"><span className="toolkit-mark"/><span>{systemName}</span></div>
        <div className="headline"><p><em>Simple</em> Web</p><p><b>{mode === 'sign-in' ? 'Login' : 'Sign'} <span>&amp;</span> {mode === 'sign-in' ? 'Secure' : 'Set'}</b></p><p><b><span>{mode === 'sign-in' ? 'Access' : 'up'}</span> Page</b></p></div>
        <div className="figma-line"><span className="figma-mark"><i/><i/><i/><i/><i/></span><strong>Chama</strong><small>Secure member platform</small></div>
        <p className="brand-note">Private access for invited members and authorized staff.</p>
      </section>

      <section className="portal-card" aria-label="Account access">
        <PortalArtwork />
        <div className="form-side">
          <div className="form-inner">
            <div className="mobile-brand">{systemName}</div>
            <header className="form-heading"><h1>{mode === 'sign-in' ? 'Login your account!' : 'Set up your account!'}</h1><p>{mode === 'sign-in' ? 'Welcome back. Your account is protected.' : 'Use the one-time invitation sent to you.'}</p></header>
            <div className="mode-tabs" role="tablist" aria-label="Account action">
              <button type="button" role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'selected' : ''} onClick={() => switchMode('sign-in')}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === 'sign-up'} className={mode === 'sign-up' ? 'selected' : ''} onClick={() => switchMode('sign-up')}>Sign up</button>
            </div>
            <form onSubmit={submit} noValidate>
              {mfaStage ? <>
                <p className="mfa-kicker">Two-step verification</p>
                {mfaStage === 'enroll' && <label className="field"><span className="field-label">One-time authenticator link</span><span className="field-box mfa-uri"><input value={mfaUri} readOnly aria-label="One-time authenticator setup link"/><button className="copy" type="button" onClick={() => void navigator.clipboard?.writeText(mfaUri)}>Copy</button></span></label>}
                <p className="mfa-help">{mfaStage === 'enroll' ? 'Open the copied link in a compatible authenticator, or add it manually. This setup link is only shown in this protected session.' : 'Use the current code in your authenticator app.'}</p>
                <label className="field"><span className="field-label">6-digit verification code</span><span className="field-box"><LockIcon/><input value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required /></span></label>
              </> : <>
                {mode === 'sign-in' ? <>
                  <div className="identity-tabs" role="tablist" aria-label="Sign in identifier">
                    <button type="button" role="tab" aria-selected={identifierMode === 'email'} className={identifierMode === 'email' ? 'selected' : ''} onClick={() => setIdentifierMode('email')}>E-mail</button>
                    <button type="button" role="tab" aria-selected={identifierMode === 'mobile'} className={identifierMode === 'mobile' ? 'selected' : ''} onClick={() => setIdentifierMode('mobile')}>Mobile Number</button>
                  </div>
                  <label className="field"><span className="field-label">{identifierLabel}</span><span className="field-box"><MailIcon/><input value={form.identifier} onChange={(e) => update('identifier', e.target.value)} placeholder={identifierPlaceholder} autoComplete={identifierMode === 'email' ? 'username' : 'tel'} inputMode={identifierMode === 'email' ? 'email' : 'tel'} required /></span></label>
                </> : <label className="field"><span className="field-label">Invitation code</span><span className="field-box"><DeviceIcon/><input value={form.invitation} onChange={(e) => update('invitation', e.target.value)} placeholder="Paste your secure invitation code" autoComplete="one-time-code" required /></span></label>}
                <label className="field"><span className="field-label">Password</span><span className="field-box"><LockIcon/><input value={form.password} onChange={(e) => update('password', e.target.value)} type={showPassword ? 'text' : 'password'} placeholder={mode === 'sign-in' ? 'Enter your password' : 'Create a strong password'} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} required minLength={12}/><button type="button" className="eye" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}><EyeIcon visible={showPassword}/></button></span></label>
                {mode === 'sign-up' && <><div className="strength" aria-label={`Password strength ${passwordScore} of 5`}><i className={passwordScore >= 1 ? 'on' : ''}/><i className={passwordScore >= 2 ? 'on' : ''}/><i className={passwordScore >= 3 ? 'on' : ''}/><i className={passwordScore >= 4 ? 'on' : ''}/><i className={passwordScore >= 5 ? 'on' : ''}/></div><label className="field"><span className="field-label">Confirm password</span><span className="field-box"><LockIcon/><input value={form.confirmation} onChange={(e) => update('confirmation', e.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Repeat your password" autoComplete="new-password" required minLength={12}/></span></label></>}
                {mode === 'sign-in' && <button type="button" className="forgot" onClick={() => setNotice({ tone: 'info', text: 'Password recovery is available from your registered support channel.' })}>Forgot password?</button>}
              </>}
              {notice && <p className={`notice ${notice.tone}`} role="status">{notice.text}</p>}
              <button className="continue" disabled={busy} type="submit">{busy ? 'Please wait…' : mfaStage ? 'Verify secure code' : mode === 'sign-in' ? 'Continue' : 'Activate secure account'}</button>
            </form>
            <div className="security-strip"><span><LockIcon/> Encrypted session</span><span><DeviceIcon/> MFA for staff</span></div>
            <p className="account-switch">{mode === 'sign-in' ? <>Have an invitation? <button type="button" onClick={() => switchMode('sign-up')}>Sign up</button></> : <>Already activated? <button type="button" onClick={() => switchMode('sign-in')}>Sign in</button></>}</p>
            <p className="privacy">By continuing, you acknowledge the platform privacy notice. Never share your invitation code or password.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
