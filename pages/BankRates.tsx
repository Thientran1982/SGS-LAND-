import React, { useState, useEffect, useCallback } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { db } from '../services/dbApi';
import { User } from '../types';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';

const ICONS = {
  BACK:  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>,
  BANK:  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10"/></svg>,
  PLUS:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>,
  SEND:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>,
  CHECK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>,
  ERROR: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  LOCK:  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>,
  EXT:   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>,
  EDIT:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
  TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
};

interface BankRate {
  id: number;
  bank_name: string;
  loan_type: string;
  rate_min: number;
  rate_max: number | null;
  tenor_min: number | null;
  tenor_max: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_verified: boolean;
  submitted_by: string | null;
  updated_at: string;
}

type FormState = {
  bank_name: string;
  loan_type: string;
  rate_min: string;
  rate_max: string;
  tenor_min: string;
  tenor_max: string;
  contact_name: string;
  contact_phone: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  bank_name: '', loan_type: 'Thế chấp BĐS', rate_min: '', rate_max: '',
  tenor_min: '', tenor_max: '', contact_name: '', contact_phone: '', notes: '',
};

const LOAN_TYPE_OPTIONS = [
  { value: 'Thế chấp BĐS',    label: 'Thế chấp BĐS' },
  { value: 'Vay mua nhà',      label: 'Vay mua nhà' },
  { value: 'Vay xây dựng',     label: 'Vay xây dựng' },
  { value: 'Vay tín chấp',     label: 'Vay tín chấp' },
  { value: 'Vay đảo nợ',       label: 'Vay đảo nợ' },
];

const BANK_OPTIONS = [
  'Agribank','Vietcombank','VietinBank','BIDV','Techcombank','MB Bank',
  'ACB','Sacombank','VPBank','HDBank','SHB','OCB','VIB','TPBank','SeABank','LienVietPostBank',
].map(b => ({ value: b, label: b }));

function fmtRate(min: number, max: number | null) {
  return max ? `${min}% – ${max}%` : `${min}%`;
}
function fmtTenor(min: number | null, max: number | null) {
  if (!min && !max) return '—';
  const toYr = (m: number) => m % 12 === 0 ? `${m / 12} năm` : `${m} tháng`;
  if (min && max) return `${toYr(min)} – ${toYr(max)}`;
  if (max) return `Tối đa ${toYr(max)}`;
  return `Từ ${toYr(min!)}`;
}

function getAuthHeaders() {
  const token = localStorage.getItem('sgs_token') || sessionStorage.getItem('sgs_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const BankRates: React.FC = () => {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [rates, setRates] = useState<BankRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState<BankRate | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const notify = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    db.getCurrentUser().then(setUser);
    fetchRates();
  }, []);

  async function fetchRates() {
    setLoading(true);
    try {
      const res = await fetch('/api/public/bank-rates');
      if (res.ok) {
        const data = await res.json();
        setRates(data.rates || []);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.bank_name.trim()) e.bank_name = t('bank_rates.err_bank');
    const rMin = parseFloat(form.rate_min);
    if (!form.rate_min || isNaN(rMin) || rMin <= 0 || rMin > 50) e.rate_min = t('bank_rates.err_rate_min');
    if (form.rate_max) {
      const rMax = parseFloat(form.rate_max);
      if (isNaN(rMax) || rMax <= rMin) e.rate_max = t('bank_rates.err_rate_max');
    }
    const phoneRegex = /^[0-9+\-\s]{8,15}$/;
    if (form.contact_phone && !phoneRegex.test(form.contact_phone)) e.contact_phone = t('bank_rates.err_phone');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSending(true);
    try {
      const res = await fetch('/api/bank-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          ...form,
          rate_min: parseFloat(form.rate_min),
          rate_max: form.rate_max ? parseFloat(form.rate_max) : null,
          tenor_min: form.tenor_min ? parseInt(form.tenor_min) : null,
          tenor_max: form.tenor_max ? parseInt(form.tenor_max) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('bank_rates.err_submit'));
      }
      notify(t('bank_rates.success'), 'success');
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchRates();
    } catch (err: any) {
      notify(err.message || t('bank_rates.err_submit'), 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRate || !validate()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/bank-rates/${editingRate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          ...form,
          rate_min: parseFloat(form.rate_min),
          rate_max: form.rate_max ? parseFloat(form.rate_max) : null,
          tenor_min: form.tenor_min ? parseInt(form.tenor_min) : null,
          tenor_max: form.tenor_max ? parseInt(form.tenor_max) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('bank_rates.err_edit'));
      }
      notify(t('bank_rates.success_edit'), 'success');
      setEditingRate(null);
      setForm(EMPTY_FORM);
      fetchRates();
    } catch (err: any) {
      notify(err.message || t('bank_rates.err_edit'), 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/bank-rates/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('bank_rates.err_delete'));
      }
      notify(t('bank_rates.success_delete'), 'success');
      setConfirmDeleteId(null);
      fetchRates();
    } catch (err: any) {
      notify(err.message || t('bank_rates.err_delete'), 'error');
    } finally {
      setDeletingId(null);
    }
  }

  function openEdit(r: BankRate) {
    setEditingRate(r);
    setForm({
      bank_name: r.bank_name,
      loan_type: r.loan_type,
      rate_min: String(r.rate_min),
      rate_max: r.rate_max != null ? String(r.rate_max) : '',
      tenor_min: r.tenor_min != null ? String(r.tenor_min) : '',
      tenor_max: r.tenor_max != null ? String(r.tenor_max) : '',
      contact_name: r.contact_name || '',
      contact_phone: r.contact_phone || '',
      notes: r.notes || '',
    });
    setErrors({});
    setShowForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingRate(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  const canEdit = (r: BankRate) => user && r.submitted_by === (user as any).id;
  const canDelete = user && ['ADMIN', 'TEAM_LEAD', 'SUPER_ADMIN'].includes((user as any).role);
  const showActionsCol = rates.some(r => canEdit(r)) || canDelete;

  const fieldEl = (id: string, value: string, label: string, type = 'text', placeholder = '') => (
    <div className="space-y-1">
      <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => { setForm(f => ({ ...f, [id]: e.target.value })); if (errors[id]) setErrors(p => ({ ...p, [id]: '' })); }}
        placeholder={placeholder}
        className={`w-full border rounded-xl px-3 py-2.5 text-[15px] outline-none focus:ring-2 transition-all ${errors[id] ? 'border-rose-300 bg-rose-50 focus:ring-rose-500/20' : 'bg-[var(--glass-surface)] border-[var(--glass-border)] focus:ring-indigo-500/20 focus:border-indigo-500'}`}
      />
      {errors[id] && <p className="text-xs font-bold text-rose-500">{errors[id]}</p>}
    </div>
  );

  const rateForm = (isEdit: boolean, onSubmit: (e: React.FormEvent) => void, onCancel: () => void) => (
    <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-6 md:p-8 shadow-xl mb-6">
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">
        {isEdit ? t('bank_rates.edit_form_title') : t('bank_rates.form_title')}
      </h2>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide">{t('bank_rates.label_bank')}</label>
            <input
              type="text"
              list="bank-list"
              value={form.bank_name}
              onChange={e => { setForm(f => ({ ...f, bank_name: e.target.value })); setErrors(p => ({ ...p, bank_name: '' })); }}
              placeholder={t('bank_rates.placeholder_bank')}
              className={`w-full border rounded-xl px-3 py-2.5 text-[15px] outline-none focus:ring-2 transition-all ${errors.bank_name ? 'border-rose-300 bg-rose-50 focus:ring-rose-500/20' : 'bg-[var(--glass-surface)] border-[var(--glass-border)] focus:ring-indigo-500/20 focus:border-indigo-500'}`}
            />
            <datalist id="bank-list">
              {BANK_OPTIONS.map(b => <option key={b.value} value={b.value}/>)}
            </datalist>
            {errors.bank_name && <p className="text-xs font-bold text-rose-500">{errors.bank_name}</p>}
          </div>
          <div className="space-y-1">
            <Dropdown
              label={t('bank_rates.label_loan_type')}
              value={form.loan_type}
              onChange={v => setForm(f => ({ ...f, loan_type: v as string }))}
              options={LOAN_TYPE_OPTIONS}
              placeholder={t('bank_rates.placeholder_loan_type')}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {fieldEl('rate_min', form.rate_min, t('bank_rates.label_rate_min'), 'number', 'vd: 7.5')}
          {fieldEl('rate_max', form.rate_max, t('bank_rates.label_rate_max'), 'number', 'vd: 9.0')}
          {fieldEl('tenor_min', form.tenor_min, t('bank_rates.label_tenor_min'), 'number', 'vd: 12')}
          {fieldEl('tenor_max', form.tenor_max, t('bank_rates.label_tenor_max'), 'number', 'vd: 240')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {fieldEl('contact_name', form.contact_name, t('bank_rates.label_contact'), 'text', t('bank_rates.placeholder_contact'))}
          {fieldEl('contact_phone', form.contact_phone, t('bank_rates.label_phone'), 'tel', 'vd: 0971 132 378')}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide">{t('bank_rates.label_notes')}</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder={t('bank_rates.placeholder_notes')}
            className="w-full border rounded-xl px-3 py-2.5 text-[15px] outline-none focus:ring-2 transition-all resize-none bg-[var(--glass-surface)] border-[var(--glass-border)] focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={sending} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-60">
            {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : ICONS.SEND}
            {sending ? t('bank_rates.btn_sending') : (isEdit ? t('bank_rates.btn_edit') : t('bank_rates.btn_submit'))}
          </button>
          <button type="button" onClick={onCancel} className="px-6 py-3 border border-[var(--glass-border)] text-[var(--text-secondary)] font-bold rounded-xl hover:bg-[var(--glass-surface-hover)] transition-colors">
            {t('bank_rates.btn_cancel')}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}>
          {toast.type === 'success' ? ICONS.CHECK : ICONS.ERROR}
          <span className="font-bold text-sm">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-2">
          <button onClick={() => window.location.hash = `#/${ROUTES.LANDING}`} className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors min-h-[44px] shrink-0">
            {ICONS.BACK} <span className="hidden sm:inline">{t('contact.home')}</span>
          </button>
          <div className="flex items-center gap-2">
            <Logo className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0"/>
            <span className="font-bold text-base sm:text-lg hidden sm:inline">{t('bank_rates.page_header')}</span>
          </div>
          <button onClick={() => window.location.hash = user ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`} className="px-3 sm:px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors text-xs sm:text-sm min-h-[44px] whitespace-nowrap">
            {user ? t('contact.dashboard') : t('contact.login')}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 animate-enter">

        {/* Title + SEO description */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
            {ICONS.BANK} {t('bank_rates.badge')}
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-3 tracking-tight">{t('bank_rates.h1')}</h1>
          <p className="text-[var(--text-tertiary)] text-base max-w-2xl mx-auto mb-4">{t('bank_rates.subtitle')}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">{t('bank_rates.updated')}</span>
            <a href="/lai-suat-vay-ngan-hang" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1 rounded-full flex items-center gap-1 hover:bg-slate-200 transition-colors">
              {ICONS.EXT} {t('bank_rates.view_seo_page')}
            </a>
          </div>
        </div>

        {/* Edit form (shown when editing) */}
        {editingRate && rateForm(true, handleEditSubmit, cancelEdit)}

        {/* Login gate / Add form */}
        {!editingRate && (!user ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-8 text-center mb-8 shadow-sm">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600">{ICONS.LOCK}</div>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-2">{t('bank_rates.login_gate_title')}</h3>
            <p className="text-[var(--text-tertiary)] text-sm mb-5">{t('bank_rates.login_gate_desc')}</p>
            <button onClick={() => window.location.hash = `#/${ROUTES.LOGIN}`} className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">
              {t('bank_rates.login_to_post')}
            </button>
          </div>
        ) : (
          <div className="mb-6">
            {!showForm ? (
              <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md">
                {ICONS.PLUS} {t('bank_rates.btn_add')}
              </button>
            ) : rateForm(false, handleSubmit, () => { setShowForm(false); setForm(EMPTY_FORM); setErrors({}); })}
          </div>
        ))}

        {/* Rate table — UGC */}
        <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--glass-border)]">
            <h2 className="font-bold text-xl text-[var(--text-primary)]">{t('bank_rates.table_title')}</h2>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">{t('bank_rates.table_desc')}</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"/>
            </div>
          ) : rates.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-tertiary)]">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-400">{ICONS.BANK}</div>
              <p className="font-semibold mb-1">{t('bank_rates.empty_title')}</p>
              <p className="text-sm">{t('bank_rates.empty_desc')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-[var(--glass-border)] bg-[var(--glass-surface)]">
                    {[
                      t('bank_rates.col_bank'),
                      t('bank_rates.col_type'),
                      t('bank_rates.col_rate'),
                      t('bank_rates.col_tenor'),
                      t('bank_rates.col_contact'),
                      t('bank_rates.col_phone'),
                      t('bank_rates.col_notes'),
                      t('bank_rates.col_updated'),
                      ...(showActionsCol ? [t('bank_rates.col_actions')] : []),
                    ].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rates.map(r => (
                    <React.Fragment key={r.id}>
                      <tr className="border-b border-[var(--glass-border)]/50 hover:bg-[var(--glass-surface)] transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-bold text-[var(--text-primary)] text-sm">{r.bank_name}</span>
                          {r.is_verified && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">✓</span>}
                        </td>
                        <td className="px-4 py-3"><span className="text-xs bg-[var(--glass-surface)] border border-[var(--glass-border)] px-2 py-1 rounded-lg text-[var(--text-secondary)]">{r.loan_type}</span></td>
                        <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400 text-sm whitespace-nowrap">{fmtRate(r.rate_min, r.rate_max)}/năm</td>
                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">{fmtTenor(r.tenor_min, r.tenor_max)}</td>
                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{r.contact_name || '—'}</td>
                        <td className="px-4 py-3 text-sm">{r.contact_phone ? <a href={`tel:${r.contact_phone}`} className="text-indigo-600 hover:underline font-medium">{r.contact_phone}</a> : '—'}</td>
                        <td className="px-4 py-3 text-xs text-[var(--text-tertiary)] max-w-[200px]">{r.notes || '—'}</td>
                        <td className="px-4 py-3 text-xs text-[var(--text-tertiary)] whitespace-nowrap">
                          {r.updated_at ? (typeof r.updated_at === 'string' ? r.updated_at : new Date(r.updated_at).toISOString()).slice(0, 10) : '—'}
                        </td>
                        {showActionsCol && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {canEdit(r) && (
                                <button
                                  onClick={() => openEdit(r)}
                                  title={t('bank_rates.btn_edit')}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-xs font-bold whitespace-nowrap"
                                >
                                  {ICONS.EDIT}
                                  <span className="hidden sm:inline">{t('bank_rates.btn_edit')}</span>
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => setConfirmDeleteId(r.id)}
                                  title={t('bank_rates.btn_delete')}
                                  disabled={deletingId === r.id}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors text-xs font-bold whitespace-nowrap disabled:opacity-50"
                                >
                                  {deletingId === r.id
                                    ? <div className="w-4 h-4 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin"/>
                                    : ICONS.TRASH}
                                  <span className="hidden sm:inline">{t('bank_rates.btn_delete')}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* Inline delete confirmation row */}
                      {confirmDeleteId === r.id && (
                        <tr className="bg-rose-50 dark:bg-rose-900/10 border-b border-rose-200 dark:border-rose-800">
                          <td colSpan={showActionsCol ? 9 : 8} className="px-4 py-3">
                            <div className="flex items-center gap-4 flex-wrap">
                              <span className="text-sm font-bold text-rose-700 dark:text-rose-400">
                                {t('bank_rates.confirm_delete')}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDelete(r.id)}
                                  disabled={deletingId === r.id}
                                  className="px-4 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-60 flex items-center gap-1"
                                >
                                  {deletingId === r.id
                                    ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                                    : ICONS.TRASH}
                                  {t('bank_rates.btn_delete')}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-4 py-1.5 border border-[var(--glass-border)] text-[var(--text-secondary)] text-xs font-bold rounded-lg hover:bg-[var(--glass-surface)] transition-colors"
                                >
                                  {t('bank_rates.btn_cancel')}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SEO content block — internal link to SSR page */}
        <div className="mt-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl">
          <h3 className="font-bold text-[var(--text-primary)] mb-2">{t('bank_rates.seo_block_title')}</h3>
          <p className="text-sm text-[var(--text-tertiary)] mb-4">{t('bank_rates.seo_block_desc')}</p>
          <a href="/lai-suat-vay-ngan-hang" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
            {ICONS.EXT} {t('bank_rates.seo_block_link')}
          </a>
        </div>

      </div>
    </div>
  );
};
