
import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { AreaChart, Area, YAxis, ResponsiveContainer } from 'recharts';
import { db } from '../services/dbApi';
import { useTranslation } from '../services/i18n';
import { Logo } from '../components/Logo';
import { ROUTES } from '../config/routes';

interface LoginProps {
  onLoginSuccess: () => void;
}

// -----------------------------------------------------------------------------
//  CONSTANTS & CONFIG
// -----------------------------------------------------------------------------
const AUTH_CONFIG = {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    // Check for free email providers to encourage business email usage in B2B
    FREE_EMAIL_DOMAINS: ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'],
    BG_IMAGE: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop",
    PASSWORD_MIN_LENGTH: 8
};

// Mock Data for the Marketing Chart (Simulating Market Trends)
const CHART_DATA = [
    { value: 4000 }, { value: 3000 }, { value: 2000 }, { value: 2780 },
    { value: 1890 }, { value: 2390 }, { value: 3490 }, { value: 4200 },
    { value: 3800 }, { value: 5000 }, { value: 4600 }, { value: 5500 },
    { value: 6000 }
];

// -----------------------------------------------------------------------------
//  UTILITIES
// -----------------------------------------------------------------------------
const calculatePasswordStrength = (password: string): number => {
    let score = 0;
    if (!password) return 0;
    if (password.length > 5) score++;
    if (password.length >= AUTH_CONFIG.PASSWORD_MIN_LENGTH) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    return score;
};

// -----------------------------------------------------------------------------
//  SUB-COMPONENT: MARKETING COLUMN (ENHANCED)
// -----------------------------------------------------------------------------
const MarketingColumn = memo(({ view, t }: { view: string, t: any }) => {
    
    const content = useMemo(() => {
        const prefix = view === 'REGISTER' ? 'register' : view.startsWith('FORGOT') ? 'reset' : 'login';
        return {
            title: t(`auth.marketing_${prefix}_title`),
            desc: t(`auth.marketing_${prefix}_desc`)
        };
    }, [view, t]);

    return (
        <div className="flex-1 hidden lg:flex relative items-center justify-center overflow-hidden bg-[#050505]" aria-hidden="true">
            {/* Background with Overlay */}
            <div className="absolute inset-0 z-0">
                <img 
                    src={AUTH_CONFIG.BG_IMAGE} 
                    alt="" 
                    className="w-full h-full object-cover grayscale opacity-20 mix-blend-luminosity scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-transparent to-transparent"></div>
            </div>

            <div className="relative z-10 w-[550px] flex flex-col gap-8">
                
                {/* 1. GLASS BENTO CARD - LIVE ANALYTICS */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-20 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('auth.market_velocity')}</div>
                            <div className="text-2xl font-bold text-white flex items-center gap-2">
                                +24.5%
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">{t('auth.live')}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        </div>
                    </div>

                    <div className="h-48 w-full relative">
                        <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={150}>
                            <AreaChart data={CHART_DATA}>
                                <defs>
                                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <YAxis hide domain={['dataMin', 'dataMax']} />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#6366f1" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorVal)" 
                                    isAnimationActive={true}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. TEXT CONTENT */}
                <div className="pl-4 border-l-2 border-indigo-500 animate-enter" key={view}>
                    <h2 className="text-3xl font-bold text-white mb-3 tracking-tight leading-tight">{content.title}</h2>
                    <p className="text-gray-400 text-sm leading-relaxed max-w-md">{content.desc}</p>
                </div>

                {/* 3. TRUST SIGNALS */}
                <div className="flex items-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500 pt-4">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('auth.trusted_by')}</span>
                    {['Vinhomes', 'Masterise', 'Keppel', 'Gamuda'].map((brand, i) => (
                        <span key={i} className="text-sm font-bold text-white/80 font-display">{brand}</span>
                    ))}
                </div>
            </div>
        </div>
    );
});

// -----------------------------------------------------------------------------
//  MAIN COMPONENT
// -----------------------------------------------------------------------------
export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  // Enhanced View State: Added 'FORGOT_VERIFY' for better UX
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_REQUEST' | 'FORGOT_VERIFY'>('LOGIN');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState(''); // New B2B Field
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  
  // UX State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSsoMode, setIsSsoMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const [isPersonalEmail, setIsPersonalEmail] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const { t } = useTranslation();

  useEffect(() => {
      const savedEmail = localStorage.getItem('sgs_last_email');
      if (savedEmail) setEmail(savedEmail);
  }, []);

  // Real-time B2B Email Check
  useEffect(() => {
      if (email.includes('@')) {
          const domain = email.split('@')[1];
          const isFree = AUTH_CONFIG.FREE_EMAIL_DOMAINS.includes(domain);
          setIsPersonalEmail(isFree);
      } else {
          setIsPersonalEmail(false);
      }
  }, [email]);

  const triggerShake = () => {
      setShake(true);
      setTimeout(() => setShake(false), 500);
  };

  const validate = () => {
      const errors: Record<string, string> = {};
      
      // Common Email Validation
      if (view !== 'FORGOT_VERIFY') {
          const trimmedEmail = email.trim();
          if (!trimmedEmail) errors.email = t('auth.error_email_required');
          else if (!AUTH_CONFIG.EMAIL_REGEX.test(trimmedEmail)) errors.email = t('auth.error_email_invalid');
      }

      // Login Validation
      if (view === 'LOGIN' && !isSsoMode && !password) errors.password = t('auth.error_password_required');

      // Registration Validation
      if (view === 'REGISTER') {
          if (!name.trim()) errors.name = t('auth.error_name_required');
          if (!password) errors.password = t('auth.error_password_required');
          else if (calculatePasswordStrength(password) < 2) errors.password = t('auth.error_password_weak');
      }

      // Forgot Password Validation
      if (view === 'FORGOT_VERIFY') {
          if (!otp.trim()) errors.otp = t('auth.error_token_required');
          if (!newPassword) errors.newPassword = t('auth.error_password_required');
          else if (calculatePasswordStrength(newPassword) < 2) errors.newPassword = t('auth.error_password_weak');
      }

      return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGlobalError('');
    setSuccessMsg('');
    
    const errors = validate();
    if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        triggerShake();
        return;
    }

    setLoading(true);
    
    try {
      // 1. FORGOT PASSWORD REQUEST
      const trimmedEmail = email.trim();
      if (view === 'FORGOT_REQUEST') {
          const token = await db.requestPasswordReset(trimmedEmail);
          // In real app, token goes to email. Here we simulate it.
          console.info(`[DEV] Recovery Token for ${trimmedEmail}: ${token}`);
          setSuccessMsg(t('auth.success_reset'));
          // Auto transition to verify step after delay
          setTimeout(() => {
              setSuccessMsg('');
              setView('FORGOT_VERIFY');
          }, 1500);
          return;
      }

      // 2. FORGOT PASSWORD VERIFY & RESET
      if (view === 'FORGOT_VERIFY') {
          await db.resetPassword(otp, newPassword);
          alert(t('auth.pass_changed_success'));
          setView('LOGIN');
          setPassword('');
          setNewPassword('');
          setOtp('');
          return;
      }

      // 3. SSO LOGIN
      if (isSsoMode) {
          await db.authenticateViaSSO(trimmedEmail);
      } 
      // 4. REGISTER (B2B: Create Tenant)
      else if (view === 'REGISTER') {
        // Pass company name to trigger Tenant Creation logic
        await db.register(name, trimmedEmail, password, company); 
        // Auto login after register
        await db.authenticate(trimmedEmail, password);
      } 
      // 5. STANDARD LOGIN
      else {
        await db.authenticate(trimmedEmail, password);
      }
      
      if (rememberMe) {
        localStorage.setItem('sgs_last_email', trimmedEmail);
      } else {
        localStorage.removeItem('sgs_last_email');
      }
      onLoginSuccess();

    } catch (err: any) {
      const msg = err.message || t('auth.error_generic');
      setGlobalError(msg);
      triggerShake();
    } finally {
      if (view !== 'FORGOT_REQUEST') setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGlobalError('');
    setGoogleLoading(true); // Specific loader for button
    try {
        // High-Fidelity Simulation: 
        // 1. Wait a bit to simulate redirect/popup load
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // 2. Simulate User authenticating at Google (longer delay)
        // In a real app, this would be where window.open() happens
        await new Promise(resolve => setTimeout(resolve, 1200));

        // 3. Process result (mock email from Google)
        // Use the entered email to allow testing different domains, fallback to default
        const googleUserEmail = email.trim() || 'sarah.connor@skynet.com'; 
        
        await db.authenticateViaSSO(googleUserEmail);
        localStorage.setItem('sgs_last_email', googleUserEmail);
        
        onLoginSuccess();
    } catch (err: any) {
        setGlobalError(err.message || t('auth.error_generic'));
        triggerShake();
    } finally {
        setGoogleLoading(false);
    }
  };

  const getInputClass = useCallback((hasError: boolean) => {
      return `w-full bg-white/5 border rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 transition-all outline-none text-white placeholder-gray-600 
      ${hasError 
          ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-500/5' 
          : 'border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/50 focus:bg-white/10'}`;
  }, []);

  return (
    <div className="min-h-[100dvh] w-full flex bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 selection:text-indigo-200 overflow-hidden relative">
      
      {/* FORM COLUMN */}
      <div className="w-full lg:w-[520px] xl:w-[600px] flex flex-col relative z-20 overflow-y-auto no-scrollbar scroll-smooth h-[100dvh] bg-black/40 backdrop-blur-md border-r border-white/5 shadow-2xl">
        
        {/* Top Bar */}
        <div className="p-8 flex justify-between items-center">
             <div className="flex items-center gap-3">
                <Logo className="w-8 h-8 text-white" strokeWidth={2.5} />
                <span className="font-bold text-lg tracking-tight">SGS<span className="text-gray-500">ID</span></span>
             </div>
             <button 
                onClick={() => window.location.hash = `#/${ROUTES.LANDING}`}
                className="text-xs font-bold text-gray-500 hover:text-white transition-colors"
             >
                {t('legal.back_home')}
             </button>
        </div>

        <div className="flex-1 flex flex-col px-8 md:px-14 justify-center min-h-[600px]">
            
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-white animate-enter">
                    {view === 'REGISTER' ? t('auth.register_title') : view.startsWith('FORGOT') ? t('auth.reset_title') : t('auth.welcome')}
                </h1>
                <p className="text-gray-400 text-sm leading-relaxed max-w-sm animate-enter" style={{animationDelay: '0.1s'}}>
                    {view === 'REGISTER' ? t('auth.register_subtitle') : view.startsWith('FORGOT') ? t('auth.reset_subtitle') : t('auth.login_subtitle')}
                </p>
            </div>

            <form onSubmit={handleSubmit} className={`space-y-5 animate-enter ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`} style={{animationDelay: '0.2s'}}>
                {/* Global Feedback */}
                {globalError && (
                    <div className="text-rose-200 text-xs font-medium bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 flex items-start animate-pulse" role="alert">
                        {globalError}
                    </div>
                )}
                {successMsg && (
                    <div className="text-emerald-200 text-xs font-medium bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 flex items-start" role="status">
                        {successMsg}
                    </div>
                )}
                
                {/* --- REGISTRATION FIELDS --- */}
                {view === 'REGISTER' && (
                    <>
                        <div className="space-y-1.5 group">
                            <label className="text-[11px] font-bold uppercase tracking-wider ml-1 text-gray-400">{t('auth.label_name')}</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-gray-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></span>
                                <input value={name} onChange={e => setName(e.target.value)} className={getInputClass(!!fieldErrors.name)} placeholder={t('auth.placeholder_name')} />
                            </div>
                            {fieldErrors.name && <p className="text-[10px] text-rose-400 ml-1">{fieldErrors.name}</p>}
                        </div>
                        <div className="space-y-1.5 group">
                            <label className="text-[11px] font-bold uppercase tracking-wider ml-1 text-gray-400">{t('auth.label_company')} <span className="text-gray-500 font-normal lowercase">{t('auth.optional')}</span></label>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-gray-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 01 1v5m-4 0h4" /></svg></span>
                                <input value={company} onChange={e => setCompany(e.target.value)} className={getInputClass(!!fieldErrors.company)} placeholder={t('auth.placeholder_company')} />
                            </div>
                            {fieldErrors.company && <p className="text-[10px] text-rose-400 ml-1">{fieldErrors.company}</p>}
                        </div>
                    </>
                )}
                
                {/* --- EMAIL INPUT (Shared) --- */}
                {view !== 'FORGOT_VERIFY' && (
                    <div className="space-y-1.5 group">
                        <label className="text-[11px] font-bold uppercase tracking-wider ml-1 text-gray-400">{t('auth.label_email')}</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3.5 text-gray-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></span>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={getInputClass(!!fieldErrors.email)} placeholder={t('auth.placeholder_email')} />
                        </div>
                        {fieldErrors.email && <p className="text-[10px] text-rose-400 ml-1">{fieldErrors.email}</p>}
                        
                        {/* B2B Nudge */}
                        {isPersonalEmail && view === 'REGISTER' && (
                            <div className="flex items-center gap-2 mt-1 ml-1 text-amber-400">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                <p className="text-[10px] font-medium">{t('auth.b2b_nudge')}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* --- FORGOT PASSWORD VERIFY STEP --- */}
                {view === 'FORGOT_VERIFY' && (
                    <>
                        <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 mb-4 animate-enter">
                            <p className="text-xs text-indigo-200">{t('auth.otp_sent_msg')} <span className="font-bold text-white block mt-1 text-sm">{email}</span></p>
                        </div>
                        <div className="space-y-1.5 group">
                            <label className="text-[11px] font-bold uppercase tracking-wider ml-1 text-gray-400">{t('auth.security_token')}</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-gray-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg></span>
                                <input value={otp} onChange={e => setOtp(e.target.value)} className={getInputClass(!!fieldErrors.otp)} placeholder={t('auth.placeholder_otp')} />
                            </div>
                            {fieldErrors.otp && <p className="text-[10px] text-rose-400 ml-1">{fieldErrors.otp}</p>}
                        </div>
                    </>
                )}

                {/* --- PASSWORD INPUT --- */}
                {(view !== 'FORGOT_REQUEST' && !isSsoMode) && (
                    <div className="space-y-1.5 group">
                        <div className="flex justify-between ml-1 items-center">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                {view === 'FORGOT_VERIFY' ? t('auth.new_pass_label') : t('auth.label_password')}
                            </label>
                            {view === 'LOGIN' && (
                                <button type="button" onClick={() => { setView('FORGOT_REQUEST'); setGlobalError(''); setFieldErrors({}); }} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                                    {t('auth.forgot_password')}
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-3.5 text-gray-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></span>
                            <input 
                                type={showPassword ? "text" : "password"} 
                                value={view === 'FORGOT_VERIFY' ? newPassword : password} 
                                onChange={e => view === 'FORGOT_VERIFY' ? setNewPassword(e.target.value) : setPassword(e.target.value)} 
                                className={`${getInputClass(!!fieldErrors.password || !!fieldErrors.newPassword)} pr-12`}
                                placeholder={t('auth.placeholder_password')}
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3 p-1 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPassword ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                            </button>
                        </div>
                        {(fieldErrors.password || fieldErrors.newPassword) && <p className="text-[10px] text-rose-400 ml-1">{fieldErrors.password || fieldErrors.newPassword}</p>}
                        
                        {(view === 'REGISTER' || view === 'FORGOT_VERIFY') && (
                            <div className="pt-2 flex items-center gap-2">
                                <div className="h-1 flex-1 bg-gray-800 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-500 ease-out 
                                        ${calculatePasswordStrength(view === 'FORGOT_VERIFY' ? newPassword : password) < 2 ? 'bg-rose-500' : calculatePasswordStrength(view === 'FORGOT_VERIFY' ? newPassword : password) < 4 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                        style={{ width: `${(calculatePasswordStrength(view === 'FORGOT_VERIFY' ? newPassword : password) / 4) * 100}%` }}>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-gray-500 uppercase">
                                    {calculatePasswordStrength(view === 'FORGOT_VERIFY' ? newPassword : password) < 2 ? t('auth.weak') : calculatePasswordStrength(view === 'FORGOT_VERIFY' ? newPassword : password) < 4 ? t('auth.medium') : t('auth.strong')}
                                </span>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Remember Me Checkbox for Login */}
                {view === 'LOGIN' && !isSsoMode && (
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="remember" 
                            checked={rememberMe} 
                            onChange={e => setRememberMe(e.target.checked)}
                            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                        />
                        <label htmlFor="remember" className="text-xs text-gray-400 cursor-pointer select-none">{t('auth.remember_me')}</label>
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={loading || googleLoading} 
                    className="w-full bg-white text-black font-bold rounded-xl py-3.5 text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] disabled:opacity-70 disabled:hover:scale-100 mt-2"
                >
                    {loading ? t('auth.processing') : (
                        view === 'REGISTER' ? t('auth.btn_register') : 
                        view === 'FORGOT_REQUEST' ? t('auth.btn_reset') : 
                        view === 'FORGOT_VERIFY' ? t('auth.btn_change_pass') : 
                        t('auth.btn_login')
                    )}
                </button>
            </form>

            {/* ACTION FOOTER */}
            {view === 'LOGIN' && (
                <div className="animate-enter mt-6" style={{animationDelay: '0.3s'}}>
                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10"></span></div>
                        <div className="relative flex-1 justify-center text-[10px] uppercase font-bold tracking-widest text-center"><span className="bg-[#09090b] px-3 text-gray-500">{t('auth.or')}</span></div>
                    </div>

                    <div className="space-y-3">
                        <button onClick={() => { setIsSsoMode(!isSsoMode); setGlobalError(''); }} className="w-full bg-white/5 border border-white/10 text-gray-300 font-bold rounded-xl py-3 text-sm hover:bg-white/10 transition-all flex justify-center items-center gap-3">
                            {isSsoMode ? t('auth.password_login') : t('auth.sso_login')}
                        </button>
                        
                        {!isSsoMode && (
                            <button 
                                onClick={handleGoogleLogin}
                                disabled={googleLoading || loading}
                                className="w-full bg-white/5 border border-white/10 text-gray-300 font-bold rounded-xl py-3 text-sm hover:bg-white/10 transition-all flex justify-center items-center gap-3 disabled:opacity-50"
                            >
                                {googleLoading ? (
                                    <div className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84.81-.06z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                )}
                                {googleLoading ? t('auth.connecting_google') : t('auth.google_login')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="mt-auto py-8 text-center text-sm font-medium text-gray-500 animate-enter">
                {view === 'REGISTER' ? t('auth.has_account') : view.startsWith('FORGOT') ? '' : t('auth.no_account')}
                
                {!view.startsWith('FORGOT') && (
                    <button onClick={() => { setView(view === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setGlobalError(''); setFieldErrors({}); setPassword(''); }} className="text-white hover:text-indigo-300 font-bold ml-1 transition-colors">
                        {view === 'REGISTER' ? t('auth.login_link') : t('auth.register_link')}
                    </button>
                )}
                
                {view.startsWith('FORGOT') && (
                    <button onClick={() => { setView('LOGIN'); setGlobalError(''); setFieldErrors({}); setSuccessMsg(''); }} className="text-white hover:text-indigo-300 font-bold ml-1 transition-colors">
                        ← {t('auth.back_to_login')}
                    </button>
                )}
            </div>
        </div>
      </div>

      <MarketingColumn view={view} t={t} />
    </div>
  );
};
