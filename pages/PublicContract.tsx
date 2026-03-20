import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/dbApi';
import { Contract, ContractType } from '../types';
import { useTranslation } from '../services/i18n';
import { Logo } from '../components/Logo';
import { useTenant } from '../services/tenantContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PublicContractProps {
    token: string;
}

export const PublicContract: React.FC<PublicContractProps> = ({ token }) => {
    const { isLoading: isTenantLoading } = useTenant();
    const [contract, setContract] = useState<Contract | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const { t, formatCurrency, formatDate } = useTranslation();
    const contractRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isTenantLoading) return;
        
        const load = async () => {
            setLoading(true);
            try {
                const id = token.replace(/^contract_/, '');
                const found = await db.getContractById(id);
                if (found) setContract(found);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [token, isTenantLoading]);

    const handleExportPDF = async () => {
        if (!contractRef.current || !contract) return;
        setExporting(true);
        try {
            // Ensure all fonts are loaded before capturing to prevent fallback fonts
            await document.fonts.ready;
            
            // Find the scrollable parent container
            const scrollContainer = contractRef.current.closest('.overflow-y-auto');
            const originalScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
            const originalScrollY = window.scrollY;
            
            if (scrollContainer) {
                scrollContainer.scrollTop = 0;
            } else {
                window.scrollTo(0, 0);
            }

            // Add a small delay to allow the browser to render the scroll position
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(contractRef.current, {
                scale: 2, // Higher resolution for print quality
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff', // Force white background
                scrollY: 0,
                windowWidth: contractRef.current.scrollWidth,
                windowHeight: contractRef.current.scrollHeight
            });
            
            // Restore original scroll position
            if (scrollContainer) {
                scrollContainer.scrollTop = originalScrollTop;
            } else {
                window.scrollTo(0, originalScrollY);
            }
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 0;
            
            // Add first page
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
            
            // Add subsequent pages if content is longer than one page
            while (heightLeft > 1) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            
            pdf.save(`Hop_Dong_${contract.id.slice(0, 8).toUpperCase()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            setErrorMsg(t('common.error') || 'Có lỗi xảy ra khi xuất PDF.');
            setTimeout(() => setErrorMsg(null), 4000);
        } finally {
            setExporting(false);
        }
    };

    const handleSendEmail = () => {
        if (!contract) return;
        const subject = encodeURIComponent(`Hợp đồng ${contract.type === ContractType.DEPOSIT ? 'Đặt cọc' : 'Mua bán'} - Mã: #${contract.id.slice(0, 8).toUpperCase()}`);
        const body = encodeURIComponent(`Chào bạn,\n\nVui lòng xem chi tiết hợp đồng tại đường link sau:\n${window.location.href}\n\nTrân trọng,\nSGS LAND`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    };

    if (loading) return <div className="h-screen flex items-center justify-center text-slate-400 font-mono animate-pulse">{t('common.loading') || 'Đang tải hợp đồng...'}</div>;
    
    if (!contract) return (
        <div className="h-screen flex flex-col items-center justify-center text-[var(--text-tertiary)] bg-[var(--glass-surface)]">
            <div className="w-16 h-16 bg-[var(--bg-surface)] rounded-full flex items-center justify-center mb-4 shadow-sm">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t('contracts.not_found')}</h1>
            <p>{t('contracts.not_found_desc')}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[var(--glass-surface)] text-[var(--text-primary)] py-8 px-4 sm:px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
            <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center">
                <button 
                    onClick={() => {
                        const token = localStorage.getItem('sgs_token');
                        if (token) {
                            window.location.hash = '#/contracts';
                        } else {
                            window.location.hash = '#/';
                        }
                    }}
                    className="flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors font-medium"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    {t('common.back')}
                </button>
            </div>
            <div className="max-w-4xl mx-auto bg-[var(--bg-surface)] shadow-xl rounded-2xl overflow-hidden border border-[var(--glass-border)]">
                
                <div ref={contractRef} className="bg-[var(--bg-surface)]" style={{ fontFamily: "'Noto Serif', 'Times New Roman', Times, serif" }}>
                    {/* Header */}
                    <div className="bg-indigo-600 p-8 text-white text-center relative">
                        <div className="absolute top-6 left-6 flex items-center gap-2 opacity-80">
                            <Logo className="w-6 h-6" />
                            <span className="font-bold text-sm tracking-widest">SGS LAND</span>
                        </div>
                        <h1 className="text-3xl font-bold mt-8 mb-2 uppercase tracking-wide">
                            {contract.type === ContractType.DEPOSIT ? t('contracts.type_DEPOSIT') : t('contracts.type_SALES')}
                        </h1>
                        <p className="opacity-80 text-sm">
                            {t('contracts.contract_id')}: <span
                                className="font-mono cursor-pointer hover:underline"
                                title={contract.id}
                                onClick={() => navigator.clipboard.writeText(contract.id)}
                            >
                                #{contract.id.slice(0, 8).toUpperCase()}
                            </span>
                            {' '}•{' '}{t('contracts.created_at')}: {formatDate(contract.createdAt)}
                        </p>
                    </div>

                    <div className="p-8 sm:p-12 space-y-10">
                        
                        {/* Parties */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-[var(--glass-surface)] p-6 rounded-xl border border-[var(--glass-border)]">
                                <h3 className="font-bold text-indigo-700 mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs">A</span>
                                    {t('contracts.party_a_title')}
                                </h3>
                                <div className="space-y-3 text-sm">
                                    <p><span className="text-[var(--text-tertiary)] w-24 inline-block">{t('contracts.party_a_name')}</span> <strong className="text-[var(--text-primary)]">{contract.partyAName}</strong></p>
                                    {contract.partyARepresentative && <p><span className="text-[var(--text-tertiary)] w-24 inline-block">{t('contracts.representative')}</span> <span className="text-[var(--text-primary)]">{contract.partyARepresentative}</span></p>}
                                    <p><span className="text-[var(--text-tertiary)] w-24 inline-block">{t('contracts.phone')}</span> <span className="text-[var(--text-primary)]">{contract.partyAPhone}</span></p>
                                    <p><span className="text-[var(--text-tertiary)] w-24 inline-block">{t('contracts.tax_code')}</span> <span className="text-[var(--text-primary)]">{contract.partyAIdNumber || contract.partyATaxCode}</span></p>
                                    <p><span className="text-[var(--text-tertiary)] w-24 inline-block">{t('contracts.address')}</span> <span className="text-[var(--text-primary)]">{contract.partyAAddress}</span></p>
                                </div>
                            </div>

                            <div className="bg-[var(--glass-surface)] p-6 rounded-xl border border-[var(--glass-border)]">
                                <h3 className="font-bold text-emerald-700 mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs">B</span>
                                    {t('contracts.party_b_title')}
                                </h3>
                                <div className="space-y-3 text-sm">
                                    <p><span className="text-[var(--text-tertiary)] w-24 inline-block">{t('contracts.party_b_name')}</span> <strong className="text-[var(--text-primary)]">{contract.partyBName}</strong></p>
                                    <p><span className="text-[var(--text-tertiary)] w-24 inline-block">{t('contracts.phone')}</span> <span className="text-[var(--text-primary)]">{contract.partyBPhone}</span></p>
                                    <p><span className="text-[var(--text-tertiary)] w-24 inline-block">{t('contracts.id_number')}</span> <span className="text-[var(--text-primary)]">{contract.partyBIdNumber}</span></p>
                                    <p><span className="text-[var(--text-tertiary)] w-24 inline-block">{t('contracts.address')}</span> <span className="text-[var(--text-primary)]">{contract.partyBAddress}</span></p>
                                </div>
                            </div>
                        </div>

                        {/* Property Details */}
                        <div>
                            <h3 className="font-bold text-[var(--text-primary)] border-b-2 border-[var(--glass-border)] pb-2 mb-4 uppercase text-sm tracking-wider">{t('contracts.property_info_title')}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                <p><span className="text-[var(--text-tertiary)] block mb-1">{t('contracts.property_address')}</span> <strong className="text-[var(--text-primary)] text-base">{contract.propertyAddress}</strong></p>
                                <p><span className="text-[var(--text-tertiary)] block mb-1">{t('contracts.property_type')}</span> <span className="text-[var(--text-primary)]">{contract.propertyType || '---'}</span></p>
                                <p><span className="text-[var(--text-tertiary)] block mb-1">{t('contracts.total_area')}</span> <span className="text-[var(--text-primary)]">{contract.propertyArea} m²</span></p>
                                <p><span className="text-[var(--text-tertiary)] block mb-1">{t('contracts.certificate_number')}</span> <span className="text-[var(--text-primary)]">{contract.propertyCertificateNumber || '---'}</span></p>
                            </div>
                        </div>

                        {/* Financials */}
                        <div>
                            <h3 className="font-bold text-[var(--text-primary)] border-b-2 border-[var(--glass-border)] pb-2 mb-4 uppercase text-sm tracking-wider">{t('contracts.finance_terms_title')}</h3>
                            <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                    <div>
                                        <p className="text-amber-700 text-sm font-bold uppercase mb-1">{t('contracts.transfer_price')}</p>
                                        <p className="text-3xl font-black text-amber-900">{formatCurrency(contract.propertyPrice)}</p>
                                    </div>
                                    {contract.type === ContractType.DEPOSIT && contract.depositAmount && (
                                        <div className="sm:text-right">
                                            <p className="text-amber-700 text-sm font-bold uppercase mb-1">{t('contracts.deposit_amount')}</p>
                                            <p className="text-2xl font-bold text-amber-900">{formatCurrency(contract.depositAmount)}</p>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="space-y-4 text-sm text-amber-900/80 border-t border-amber-200/50 pt-4">
                                    {contract.paymentTerms && (
                                        <div>
                                            <strong className="block text-amber-900 mb-1">{t('contracts.payment_terms_notes')}</strong>
                                            <p className="whitespace-pre-line">{contract.paymentTerms}</p>
                                        </div>
                                    )}
                                    {contract.handoverDate && (
                                        <p><strong className="text-amber-900">{t('contracts.expected_handover_date')}</strong> {formatDate(contract.handoverDate)}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="pt-8 border-t-2 border-dashed border-[var(--glass-border)]">
                            <div className="grid grid-cols-2 gap-8 text-center pt-4">
                                <div>
                                    <h4 className="font-bold text-[var(--text-primary)] mb-1">{t('contracts.party_a_rep_title')}</h4>
                                    <p className="text-xs text-[var(--text-tertiary)] mb-24">{t('contracts.sign_note')}</p>
                                    <p className="font-bold text-[var(--text-primary)]">{contract.partyARepresentative || contract.partyAName}</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-[var(--text-primary)] mb-1">{t('contracts.party_b_rep_title')}</h4>
                                    <p className="text-xs text-[var(--text-tertiary)] mb-24">{t('contracts.sign_note')}</p>
                                    <p className="font-bold text-[var(--text-primary)]">{contract.partyBName}</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                
                {/* Actions */}
                <div className="bg-[var(--glass-surface)] p-6 border-t border-[var(--glass-border)] flex flex-wrap justify-center gap-4 print:hidden">
                    <button 
                        onClick={() => window.print()}
                        className="px-6 py-2.5 bg-[var(--bg-surface)] border border-slate-300 text-[var(--text-secondary)] rounded-xl font-bold hover:bg-[var(--glass-surface)] transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        {t('contracts.print')}
                    </button>
                    
                    <button 
                        onClick={handleExportPDF}
                        disabled={exporting}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
                    >
                        {exporting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        )}
                        {t('contracts.export_pdf')}
                    </button>

                    <button 
                        onClick={handleSendEmail}
                        className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {t('contracts.send_email')}
                    </button>
                </div>
            </div>

            {/* Error toast */}
            {errorMsg && (
                <div className="fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border bg-rose-900/90 border-rose-500 text-white text-sm font-medium">
                    {errorMsg}
                </div>
            )}
        </div>
    );
};

export default PublicContract;
