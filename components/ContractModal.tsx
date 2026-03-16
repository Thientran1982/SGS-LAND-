import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../services/i18n';
import { Contract, ContractType, ContractStatus } from '../types';
import { db } from '../services/dbApi';
import { Dropdown } from './Dropdown';

interface ContractModalProps {
    contract?: Contract | null;
    initialData?: Partial<Contract>;
    onClose: () => void;
    onSuccess: () => void;
}

export const ContractModal: React.FC<ContractModalProps> = ({ contract, initialData, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Contract>>(contract || {
        type: ContractType.DEPOSIT,
        status: ContractStatus.DRAFT,
        partyAName: t('contracts.party_a_default_name') || 'Công ty CP BĐS SGS LAND',
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
            const msg = err?.data?.error || err?.message || t('common.error_generic') || 'Đã xảy ra lỗi. Vui lòng thử lại.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full border border-[var(--glass-border)] rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-[var(--glass-surface)] focus:bg-[var(--bg-surface)]";
    const labelClass = "block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1";

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-full flex flex-col animate-enter">
                <div className="flex items-center justify-between p-6 border-b border-[var(--glass-border)] shrink-0">
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">
                        {contract ? t('contracts.modal_edit_title') : t('contracts.modal_create_title')}
                    </h2>
                    <button onClick={onClose} className="p-2 text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 no-scrollbar min-h-0">
                    {error && (
                        <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                            <span>{error}</span>
                        </div>
                    )}
                    <form id="contract-form" onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Dropdown
                                    label={t('contracts.contract_type') || "Loại Hợp Đồng"}
                                    value={formData.type as string}
                                    onChange={val => handleChange('type', val)}
                                    options={[
                                        { value: ContractType.DEPOSIT, label: t('contracts.type_DEPOSIT') || 'Thoả thuận đặt cọc' },
                                        { value: ContractType.SALES, label: t('contracts.type_SALES') || 'Hợp đồng mua bán' }
                                    ]}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <Dropdown
                                    label={t('contracts.status_label') || "Trạng Thái"}
                                    value={formData.status as string}
                                    onChange={val => handleChange('status', val)}
                                    options={[
                                        { value: ContractStatus.DRAFT, label: t('contracts.status_DRAFT') || 'Bản nháp' },
                                        { value: ContractStatus.PENDING_SIGNATURE, label: t('contracts.status_PENDING_SIGNATURE') || 'Chờ ký' },
                                        { value: ContractStatus.SIGNED, label: t('contracts.status_SIGNED') || 'Đã ký' },
                                        { value: ContractStatus.CANCELLED, label: t('contracts.status_CANCELLED') || 'Đã hủy' }
                                    ]}
                                    className="w-full"
                                />
                            </div>
                        </div>

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

                        <div className="space-y-4">
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

                        <div className="space-y-4">
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
                                    rows={6}
                                    className={`${inputClass} resize-none`}
                                    placeholder={t('contracts.payment_terms_placeholder') || 'Các đợt thanh toán, thời hạn công chứng...'}
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-[var(--glass-border)] flex justify-end gap-3 bg-[var(--glass-surface)] rounded-b-2xl shrink-0">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-sm text-[var(--text-secondary)] hover:bg-slate-200 transition-colors">
                        {t('common.cancel')}
                    </button>
                    <button type="submit" form="contract-form" disabled={loading} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50 flex items-center gap-2">
                        {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        {loading ? (contract ? t('contracts.btn_updating') : t('contracts.btn_creating')) : (contract ? t('contracts.btn_save') : t('contracts.btn_create'))}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
