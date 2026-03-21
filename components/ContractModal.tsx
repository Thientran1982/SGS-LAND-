import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../services/i18n';
import { Contract, ContractType, ContractStatus, PaymentMilestone } from '../types';
import { db } from '../services/dbApi';
import { Dropdown } from './Dropdown';
import { PaymentScheduleEditor } from './PaymentScheduleEditor';

interface ContractModalProps {
    contract?: Contract | null;
    initialData?: Partial<Contract>;
    onClose: () => void;
    onSuccess: () => void;
}

type TabId = 'parties' | 'property' | 'terms' | 'schedule';

interface Tab {
    id: TabId;
    labelKey: string;
    color: string;
    activeColor: string;
    icon: React.ReactNode;
}

const TABS: Tab[] = [
    {
        id: 'parties',
        labelKey: 'contracts.tab_parties',
        color: 'text-indigo-500',
        activeColor: 'border-indigo-500 text-indigo-600 bg-indigo-50',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
    {
        id: 'property',
        labelKey: 'contracts.tab_property',
        color: 'text-amber-500',
        activeColor: 'border-amber-500 text-amber-600 bg-amber-50',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        id: 'terms',
        labelKey: 'contracts.tab_terms',
        color: 'text-rose-500',
        activeColor: 'border-rose-500 text-rose-600 bg-rose-50',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    },
    {
        id: 'schedule',
        labelKey: 'contracts.tab_schedule',
        color: 'text-emerald-500',
        activeColor: 'border-emerald-500 text-emerald-600 bg-emerald-50',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
        ),
    },
];

export const ContractModal: React.FC<ContractModalProps> = ({ contract, initialData, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('parties');
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [loading, onClose]);

    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Contract>>(contract || {
        type: ContractType.DEPOSIT,
        status: ContractStatus.DRAFT,
        partyAName: t('contracts.party_a_default_name'),
        partyARepresentative: '',
        partyAAddress: '',
        partyATaxCode: '',
        partyAPhone: '',
        partyBName: '',
        partyBIdNumber: '',
        partyBIdDate: '',
        partyBIdPlace: '',
        partyBAddress: '',
        partyBPhone: '',
        propertyAddress: '',
        propertyArea: 0,
        propertyPrice: 0,
        depositAmount: 0,
        paymentTerms: '',
        ...initialData,
    });

    const handleChange = (field: keyof Contract, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleTabChange = (tab: TabId) => {
        setActiveTab(tab);
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (contract?.id) {
                await db.updateContract(contract.id, formData);
            } else {
                await db.createContract(formData);
            }
            onSuccess();
        } catch (err: any) {
            console.error(err);
            const msg = err?.data?.error || err?.message || t('common.error_generic');
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full border border-[var(--glass-border)] rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-[var(--glass-surface)] focus:bg-[var(--bg-surface)]";
    const labelClass = "block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1";

    const scheduleCount = (formData.paymentSchedule || []).length;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true"></div>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="contract-modal-title"
                className="relative bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-enter"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--glass-border)] shrink-0">
                    <div className="flex flex-col">
                        <h2 id="contract-modal-title" className="text-xl font-bold text-[var(--text-primary)]">
                            {contract ? t('contracts.modal_edit_title') : t('contracts.modal_create_title')}
                        </h2>
                        <div className="flex items-center gap-3 mt-1">
                            <Dropdown
                                label=""
                                value={formData.type as string}
                                onChange={val => handleChange('type', val)}
                                options={[
                                    { value: ContractType.DEPOSIT, label: t('contracts.type_DEPOSIT') },
                                    { value: ContractType.SALES, label: t('contracts.type_SALES') }
                                ]}
                                className="text-xs"
                            />
                            <Dropdown
                                label=""
                                value={formData.status as string}
                                onChange={val => handleChange('status', val)}
                                options={[
                                    { value: ContractStatus.DRAFT, label: t('contracts.status_DRAFT') },
                                    { value: ContractStatus.PENDING_SIGNATURE, label: t('contracts.status_PENDING_SIGNATURE') },
                                    { value: ContractStatus.SIGNED, label: t('contracts.status_SIGNED') },
                                    { value: ContractStatus.CANCELLED, label: t('contracts.status_CANCELLED') }
                                ]}
                                className="text-xs"
                            />
                        </div>
                    </div>
                    <button onClick={onClose} aria-label={t('common.close')} className="p-2 min-h-[44px] min-w-[44px] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] rounded-full transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                {/* Tab Bar */}
                <div className="flex border-b border-[var(--glass-border)] shrink-0 overflow-x-auto no-scrollbar">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap flex-1 justify-center ${
                                activeTab === tab.id
                                    ? tab.activeColor + ' border-current'
                                    : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-surface)]'
                            }`}
                        >
                            {tab.icon}
                            <span>{t(tab.labelKey) || tab.labelKey.split('.')[1]}</span>
                            {tab.id === 'schedule' && scheduleCount > 0 && (
                                <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                    {scheduleCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div ref={contentRef} className="flex-1 overflow-y-auto p-6 min-h-0">
                    {error && (
                        <div role="alert" className="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                            <span>{error}</span>
                        </div>
                    )}
                    <form id="contract-form" onSubmit={handleSubmit}>
                        {/* TAB: PARTIES */}
                        {activeTab === 'parties' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="font-bold text-indigo-600 border-b border-indigo-100 pb-2">{t('contracts.party_a_title')}</h3>
                                    <div>
                                        <label className={labelClass}>{t('contracts.party_a_name')}</label>
                                        <input required value={formData.partyAName || ''} onChange={e => handleChange('partyAName', e.target.value)} className={inputClass} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>{t('contracts.representative')}</label>
                                            <input value={formData.partyARepresentative || ''} onChange={e => handleChange('partyARepresentative', e.target.value)} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>{t('contracts.phone_number')}</label>
                                            <input required value={formData.partyAPhone || ''} onChange={e => handleChange('partyAPhone', e.target.value)} className={inputClass} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>{t('contracts.id_number')}</label>
                                            <input value={formData.partyAIdNumber || ''} onChange={e => handleChange('partyAIdNumber', e.target.value)} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>{t('contracts.tax_code')}</label>
                                            <input value={formData.partyATaxCode || ''} onChange={e => handleChange('partyATaxCode', e.target.value)} className={inputClass} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>{t('contracts.issue_date')}</label>
                                            <input type="date" value={formData.partyAIdDate || ''} onChange={e => handleChange('partyAIdDate', e.target.value)} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>{t('contracts.issue_place')}</label>
                                            <input value={formData.partyAIdPlace || ''} onChange={e => handleChange('partyAIdPlace', e.target.value)} className={inputClass} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>{t('contracts.address')}</label>
                                        <input required value={formData.partyAAddress || ''} onChange={e => handleChange('partyAAddress', e.target.value)} className={inputClass} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>{t('contracts.bank_account')}</label>
                                            <input value={formData.partyABankAccount || ''} onChange={e => handleChange('partyABankAccount', e.target.value)} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>{t('contracts.bank_name')}</label>
                                            <input value={formData.partyABankName || ''} onChange={e => handleChange('partyABankName', e.target.value)} className={inputClass} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-bold text-emerald-600 border-b border-emerald-100 pb-2">{t('contracts.party_b_title')}</h3>
                                    <div>
                                        <label className={labelClass}>{t('contracts.party_b_name')}</label>
                                        <input required value={formData.partyBName || ''} onChange={e => handleChange('partyBName', e.target.value)} className={inputClass} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>{t('contracts.id_number_b')}</label>
                                            <input required value={formData.partyBIdNumber || ''} onChange={e => handleChange('partyBIdNumber', e.target.value)} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>{t('contracts.phone_number')}</label>
                                            <input required value={formData.partyBPhone || ''} onChange={e => handleChange('partyBPhone', e.target.value)} className={inputClass} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>{t('contracts.issue_date')}</label>
                                            <input type="date" value={formData.partyBIdDate || ''} onChange={e => handleChange('partyBIdDate', e.target.value)} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>{t('contracts.issue_place')}</label>
                                            <input value={formData.partyBIdPlace || ''} onChange={e => handleChange('partyBIdPlace', e.target.value)} className={inputClass} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>{t('contracts.permanent_address')}</label>
                                        <input required value={formData.partyBAddress || ''} onChange={e => handleChange('partyBAddress', e.target.value)} className={inputClass} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>{t('contracts.bank_account')}</label>
                                            <input value={formData.partyBBankAccount || ''} onChange={e => handleChange('partyBBankAccount', e.target.value)} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>{t('contracts.bank_name')}</label>
                                            <input value={formData.partyBBankName || ''} onChange={e => handleChange('partyBBankName', e.target.value)} className={inputClass} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: PROPERTY */}
                        {activeTab === 'property' && (
                            <div className="space-y-6">
                                <h3 className="font-bold text-amber-600 border-b border-amber-100 pb-2">{t('contracts.property_info_title')}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelClass}>{t('contracts.property_address')}</label>
                                        <input required value={formData.propertyAddress || ''} onChange={e => handleChange('propertyAddress', e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>{t('contracts.property_type')}</label>
                                        <input value={formData.propertyType || ''} onChange={e => handleChange('propertyType', e.target.value)} className={inputClass} placeholder={t('contracts.property_type_placeholder')} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div>
                                        <label className={labelClass}>{t('contracts.land_area')}</label>
                                        <input type="number" value={formData.propertyLandArea || ''} onChange={e => handleChange('propertyLandArea', Number(e.target.value))} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>{t('contracts.construction_area')}</label>
                                        <input type="number" value={formData.propertyConstructionArea || ''} onChange={e => handleChange('propertyConstructionArea', Number(e.target.value))} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>{t('contracts.total_area')}</label>
                                        <input type="number" required value={formData.propertyArea || ''} onChange={e => handleChange('propertyArea', Number(e.target.value))} className={inputClass} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div>
                                        <label className={labelClass}>{t('contracts.certificate_number')}</label>
                                        <input value={formData.propertyCertificateNumber || ''} onChange={e => handleChange('propertyCertificateNumber', e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>{t('contracts.certificate_issue_date')}</label>
                                        <input type="date" value={formData.propertyCertificateDate || ''} onChange={e => handleChange('propertyCertificateDate', e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>{t('contracts.certificate_issue_place')}</label>
                                        <input value={formData.propertyCertificatePlace || ''} onChange={e => handleChange('propertyCertificatePlace', e.target.value)} className={inputClass} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: TERMS */}
                        {activeTab === 'terms' && (
                            <div className="space-y-6">
                                <h3 className="font-bold text-rose-600 border-b border-rose-100 pb-2">{t('contracts.finance_terms_title')}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelClass}>{t('contracts.transfer_price')}</label>
                                        <input type="number" required value={formData.propertyPrice || ''} onChange={e => handleChange('propertyPrice', Number(e.target.value))} className={inputClass} />
                                    </div>
                                    {formData.type === ContractType.DEPOSIT && (
                                        <div>
                                            <label className={labelClass}>{t('contracts.deposit_amount')}</label>
                                            <input type="number" required value={formData.depositAmount || ''} onChange={e => handleChange('depositAmount', Number(e.target.value))} className={inputClass} />
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelClass}>{t('contracts.expected_handover_date')}</label>
                                        <input type="date" value={formData.handoverDate || ''} onChange={e => handleChange('handoverDate', e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>{t('contracts.handover_condition')}</label>
                                        <input value={formData.handoverCondition || ''} onChange={e => handleChange('handoverCondition', e.target.value)} className={inputClass} placeholder={t('contracts.handover_condition_placeholder')} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelClass}>{t('contracts.tax_responsibility')}</label>
                                        <input value={formData.taxResponsibility || ''} onChange={e => handleChange('taxResponsibility', e.target.value)} className={inputClass} placeholder={t('contracts.tax_responsibility_placeholder')} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>{t('contracts.dispute_resolution')}</label>
                                        <input value={formData.disputeResolution || ''} onChange={e => handleChange('disputeResolution', e.target.value)} className={inputClass} placeholder={t('contracts.dispute_resolution_placeholder')} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>{t('contracts.payment_terms_notes')}</label>
                                    <textarea
                                        value={formData.paymentTerms || ''}
                                        onChange={e => handleChange('paymentTerms', e.target.value)}
                                        rows={4}
                                        className={`${inputClass} resize-none`}
                                        placeholder={t('contracts.payment_terms_placeholder')}
                                    />
                                </div>
                            </div>
                        )}

                        {/* TAB: PAYMENT SCHEDULE */}
                        {activeTab === 'schedule' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-emerald-600 border-b border-emerald-100 pb-2 flex items-center gap-2 flex-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                                        {t('payment.schedule_title')}
                                    </h3>
                                    {formData.propertyPrice ? (
                                        <span className="text-xs text-[var(--text-tertiary)] ml-4 shrink-0">
                                            {t('contracts.transfer_price')}: <strong className="text-[var(--text-primary)]">{(formData.propertyPrice || 0).toLocaleString('vi-VN')} đ</strong>
                                        </span>
                                    ) : null}
                                </div>
                                {!formData.propertyPrice && (
                                    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                        <span>
                                            {t('payment.tip_set_price') || 'Nhập giá bất động sản ở tab Điều khoản để tự động tính % cho mỗi đợt.'}
                                            <button type="button" onClick={() => handleTabChange('terms')} className="ml-1 font-bold text-amber-800 underline underline-offset-2">
                                                {t('contracts.tab_terms') || 'Điều khoản'}
                                            </button>
                                        </span>
                                    </div>
                                )}
                                <PaymentScheduleEditor
                                    milestones={formData.paymentSchedule || []}
                                    totalPrice={formData.propertyPrice || 0}
                                    onChange={(ms: PaymentMilestone[]) => handleChange('paymentSchedule', ms)}
                                />
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[var(--glass-border)] flex items-center justify-between gap-3 bg-[var(--glass-surface)] rounded-b-2xl shrink-0">
                    <div className="flex items-center gap-2">
                        {TABS.map((tab, i) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleTabChange(tab.id)}
                                className={`w-2 h-2 rounded-full transition-all ${activeTab === tab.id ? 'w-5 bg-indigo-500' : 'bg-slate-300 hover:bg-slate-400'}`}
                                title={t(tab.labelKey)}
                                aria-label={t(tab.labelKey)}
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 min-h-[44px] rounded-xl font-bold text-sm text-[var(--text-secondary)] hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
                            {t('common.cancel')}
                        </button>
                        <button type="submit" form="contract-form" disabled={loading} className="px-6 py-2.5 min-h-[44px] rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
                            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                            {loading ? (contract ? t('contracts.btn_updating') : t('contracts.btn_creating')) : (contract ? t('contracts.btn_save') : t('contracts.btn_create'))}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
