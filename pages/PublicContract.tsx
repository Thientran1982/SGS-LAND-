import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/dbApi';
import { Contract, ContractType, ContractStatus, PaymentMilestone, PaymentStatus } from '../types';
import { useTranslation } from '../services/i18n';
import { useTenant } from '../services/tenantContext';

interface PublicContractProps {
    token: string;
}

const fmtVND = (n?: number | null) => {
    if (!n && n !== 0) return '---';
    if (n >= 1_000_000_000) {
        const b = n / 1_000_000_000;
        return `${b % 1 === 0 ? b.toFixed(0) : b.toFixed(2)} tỷ đồng (${n.toLocaleString('vi-VN')} đ)`;
    }
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} triệu đồng (${n.toLocaleString('vi-VN')} đ)`;
    return `${n.toLocaleString('vi-VN')} đồng`;
};

const fmtDate = (d?: string | null) => {
    if (!d) return '___/___/______';
    try {
        const dt = new Date(d);
        return `ngày ${dt.getDate().toString().padStart(2,'0')} tháng ${(dt.getMonth()+1).toString().padStart(2,'0')} năm ${dt.getFullYear()}`;
    } catch { return d; }
};

const fmtShortDate = (d?: string | null) => {
    if (!d) return '---';
    try {
        const dt = new Date(d);
        return `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getFullYear()}`;
    } catch { return d; }
};

const Row: React.FC<{ label: string; value?: string | number | null; bold?: boolean; full?: boolean }> = ({ label, value, bold, full }) => (
    <div style={{ display: full ? 'block' : 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
        <span style={{ color: '#6b7280', minWidth: '160px', fontSize: '13px', flexShrink: 0 }}>{label}:</span>
        <span style={{ fontWeight: bold ? 700 : 400, fontSize: '13px', color: '#111827', flex: 1, wordBreak: 'break-word' }}>
            {value && value !== '' ? value : '---'}
        </span>
    </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{
        borderBottom: '2px solid #1e3a8a',
        marginBottom: '12px',
        paddingBottom: '6px',
        marginTop: '24px',
    }}>
        <h3 style={{
            fontFamily: "'Noto Serif', 'Times New Roman', serif",
            fontSize: '14px',
            fontWeight: 700,
            color: '#1e3a8a',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: 0,
        }}>{children}</h3>
    </div>
);

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
    [PaymentStatus.PAID]:    { bg: '#dcfce7', color: '#166534', label: 'Đã thanh toán' },
    [PaymentStatus.OVERDUE]: { bg: '#fee2e2', color: '#991b1b', label: 'Quá hạn' },
    [PaymentStatus.WAIVED]:  { bg: '#f1f5f9', color: '#64748b', label: 'Miễn giảm' },
    [PaymentStatus.PENDING]: { bg: '#fef3c7', color: '#92400e', label: 'Chờ thanh toán' },
};

export const PublicContract: React.FC<PublicContractProps> = ({ token }) => {
    const { isLoading: isTenantLoading } = useTenant();
    const [contract, setContract] = useState<Contract | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const { t } = useTranslation();
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

    const handlePrint = () => {
        window.print();
    };

    const handleExportPDF = async () => {
        if (!contract) return;
        setExporting(true);
        try {
            // Dynamically import html2canvas + jsPDF only when needed
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import('html2canvas'),
                import('jspdf'),
            ]);
            if (!contractRef.current) return;

            await document.fonts.ready;
            const scrollEl = contractRef.current.closest('.overflow-y-auto') as HTMLElement | null;
            const savedScroll = scrollEl ? scrollEl.scrollTop : window.scrollY;
            if (scrollEl) scrollEl.scrollTop = 0; else window.scrollTo(0, 0);
            await new Promise(r => setTimeout(r, 150));

            const canvas = await html2canvas(contractRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                scrollY: 0,
                windowWidth: contractRef.current.scrollWidth,
                windowHeight: contractRef.current.scrollHeight,
            });

            if (scrollEl) scrollEl.scrollTop = savedScroll; else window.scrollTo(0, savedScroll);

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const W = pdf.internal.pageSize.getWidth();
            const H = pdf.internal.pageSize.getHeight();
            const imgH = (canvas.height * W) / canvas.width;
            let left = imgH;
            let pos = 0;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, pos, W, imgH);
            left -= H;
            while (left > 1) {
                pos -= H;
                pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, pos, W, imgH);
                left -= H;
            }
            const num = contract.id.slice(0, 8).toUpperCase();
            pdf.save(`HopDong_${num}.pdf`);
        } catch (err) {
            console.error('PDF export error:', err);
            setErrorMsg('Có lỗi khi xuất PDF. Vui lòng thử In (Ctrl+P) → Save as PDF.');
            setTimeout(() => setErrorMsg(null), 5000);
        } finally {
            setExporting(false);
        }
    };

    const handleSendEmail = () => {
        if (!contract) return;
        const subject = encodeURIComponent(`Hợp đồng ${contract.type === ContractType.DEPOSIT ? 'Đặt cọc' : 'Mua bán'} - HĐ-${contract.id.slice(0, 8).toUpperCase()}`);
        const body = encodeURIComponent(`Kính gửi,\n\nVui lòng xem chi tiết hợp đồng tại:\n${window.location.href}\n\nTrân trọng,\nSGS LAND`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    };

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', color: '#94a3b8' }}>
            Đang tải hợp đồng...
        </div>
    );

    if (!contract) return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <p style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Không tìm thấy hợp đồng</p>
            <p style={{ fontSize: '14px' }}>Liên kết không hợp lệ hoặc hợp đồng đã bị xóa.</p>
        </div>
    );

    const isDeposit = contract.type === ContractType.DEPOSIT;
    const schedule: PaymentMilestone[] = contract.paymentSchedule || [];
    const now = new Date();
    const totalPaid = schedule.filter(m => m.status === PaymentStatus.PAID).reduce((s, m) => s + (m.paidAmount ?? m.amount ?? 0), 0);
    const contractNum = `HĐ-${contract.id.slice(0, 8).toUpperCase()}`;

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '32px 16px', fontFamily: "'Inter', sans-serif" }} className="public-contract-wrapper">
            {/* Print/Back toolbar — hidden when printing */}
            <div className="no-print" style={{ maxWidth: '860px', margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <button
                    onClick={() => { window.location.hash = localStorage.getItem('sgs_token') ? '#/contracts' : '#/'; }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
                >
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Quay lại
                </button>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={handlePrint}
                        style={{ padding: '8px 18px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        In / Lưu PDF
                    </button>
                    <button onClick={handleExportPDF} disabled={exporting}
                        style={{ padding: '8px 18px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: exporting ? 0.7 : 1 }}>
                        {exporting
                            ? <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                        Xuất PDF
                    </button>
                    <button onClick={handleSendEmail}
                        style={{ padding: '8px 18px', background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        Gửi Email
                    </button>
                </div>
            </div>

            {/* ===== CONTRACT DOCUMENT ===== */}
            <div ref={contractRef} style={{
                maxWidth: '860px',
                margin: '0 auto',
                background: '#ffffff',
                boxShadow: '0 4px 32px rgba(0,0,0,0.12)',
                borderRadius: '12px',
                overflow: 'hidden',
                fontFamily: "'Noto Serif', 'Times New Roman', Times, serif",
                color: '#111827',
            }} className="contract-document">

                {/* ── HEADER ── */}
                <div style={{ background: '#1e3a8a', padding: '32px 48px', color: '#ffffff', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div>
                            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: '18px', letterSpacing: '2px', opacity: 0.9, marginBottom: '2px' }}>SGS LAND</div>
                            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', opacity: 0.6, fontWeight: 500 }}>Nền tảng BĐS Thông Minh</div>
                        </div>
                        <div style={{ textAlign: 'right', fontFamily: "'Inter', sans-serif" }}>
                            <div style={{ fontSize: '11px', opacity: 0.7 }}>Số hợp đồng</div>
                            <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'monospace', opacity: 0.95 }}>{contractNum}</div>
                        </div>
                    </div>
                    <h1 style={{
                        fontFamily: "'Noto Serif', 'Times New Roman', serif",
                        fontSize: '22px',
                        fontWeight: 700,
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '3px',
                        margin: '16px 0 8px',
                        lineHeight: 1.4,
                    }}>
                        {isDeposit ? 'Thoả Thuận Đặt Cọc' : 'Hợp Đồng Chuyển Nhượng\nQuyền Sử Dụng Đất'}
                    </h1>
                    <div style={{ textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: '12px', opacity: 0.75 }}>
                        Lập tại: _____________________ · {fmtDate(contract.signedAt || contract.createdAt)}
                    </div>
                    {contract.status === ContractStatus.SIGNED && (
                        <div style={{ position: 'absolute', top: '24px', right: '24px', background: '#22c55e', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', fontFamily: "'Inter', sans-serif", letterSpacing: '0.05em', transform: 'rotate(3deg)' }}>
                            ĐÃ KÝ
                        </div>
                    )}
                </div>

                {/* ── BODY ── */}
                <div style={{ padding: '40px 48px' }}>

                    {/* Preamble */}
                    <p style={{ fontSize: '13px', lineHeight: 1.8, marginBottom: '8px' }}>
                        Hôm nay, {fmtDate(contract.signedAt || contract.createdAt)}, tại _____________________, chúng tôi gồm:
                    </p>

                    {/* ── BÊN A ── */}
                    <SectionTitle>Điều 1. Các Bên Tham Gia Hợp Đồng</SectionTitle>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '8px' }}>
                        {/* Party A */}
                        <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '16px', borderLeft: '4px solid #3b82f6' }}>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e40af', marginBottom: '12px', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", letterSpacing: '0.05em' }}>
                                Bên A — Bên {isDeposit ? 'Nhận đặt cọc' : 'Bán'}
                            </div>
                            <Row label="Tên cá nhân / Tổ chức" value={contract.partyAName} bold />
                            {contract.partyARepresentative && <Row label="Người đại diện" value={contract.partyARepresentative} />}
                            {contract.partyATaxCode && <Row label="Mã số thuế / ĐKKD" value={contract.partyATaxCode} />}
                            {contract.partyAIdNumber && <Row label="CMND / CCCD" value={contract.partyAIdNumber} />}
                            {(contract.partyAIdDate || contract.partyAIdPlace) && (
                                <Row label="Ngày / Nơi cấp" value={[contract.partyAIdDate ? fmtShortDate(contract.partyAIdDate) : null, contract.partyAIdPlace].filter(Boolean).join(' · ')} />
                            )}
                            <Row label="Địa chỉ" value={contract.partyAAddress} />
                            <Row label="Điện thoại" value={contract.partyAPhone} />
                            {contract.partyABankAccount && <Row label="Số tài khoản" value={contract.partyABankAccount} />}
                            {contract.partyABankName && <Row label="Ngân hàng" value={contract.partyABankName} />}
                        </div>

                        {/* Party B */}
                        <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '16px', borderLeft: '4px solid #22c55e' }}>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#166534', marginBottom: '12px', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", letterSpacing: '0.05em' }}>
                                Bên B — Bên {isDeposit ? 'Đặt cọc' : 'Mua'}
                            </div>
                            <Row label="Họ và tên" value={contract.partyBName} bold />
                            <Row label="CMND / CCCD" value={contract.partyBIdNumber} />
                            {(contract.partyBIdDate || contract.partyBIdPlace) && (
                                <Row label="Ngày / Nơi cấp" value={[contract.partyBIdDate ? fmtShortDate(contract.partyBIdDate) : null, contract.partyBIdPlace].filter(Boolean).join(' · ')} />
                            )}
                            <Row label="Địa chỉ thường trú" value={contract.partyBAddress} />
                            <Row label="Điện thoại" value={contract.partyBPhone} />
                            {contract.partyBBankAccount && <Row label="Số tài khoản" value={contract.partyBBankAccount} />}
                            {contract.partyBBankName && <Row label="Ngân hàng" value={contract.partyBBankName} />}
                        </div>
                    </div>

                    {/* ── BĐS ── */}
                    <SectionTitle>Điều 2. Đối Tượng Hợp Đồng — Thông Tin Bất Động Sản</SectionTitle>
                    <p style={{ fontSize: '13px', marginBottom: '12px', lineHeight: 1.7 }}>
                        Bên A {isDeposit ? 'đồng ý nhận đặt cọc và Bên B đồng ý đặt cọc để' : 'đồng ý chuyển nhượng cho Bên B'} quyền sử dụng thửa đất / căn nhà có các thông tin sau:
                    </p>
                    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0' }}>
                        <Row label="Địa chỉ bất động sản" value={contract.propertyAddress} bold />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                            <Row label="Loại đất / nhà ở" value={contract.propertyType} />
                            {contract.propertyLandArea != null && <Row label="Diện tích đất (m²)" value={`${contract.propertyLandArea} m²`} />}
                            {contract.propertyConstructionArea != null && <Row label="Diện tích xây dựng" value={`${contract.propertyConstructionArea} m²`} />}
                            {contract.propertyArea != null && <Row label="Diện tích tổng" value={`${contract.propertyArea} m²`} />}
                        </div>
                        <Row label="Số GCN / Sổ đỏ" value={contract.propertyCertificateNumber} />
                        {(contract.propertyCertificateDate || contract.propertyCertificatePlace) && (
                            <Row label="Ngày / Nơi cấp GCN"
                                value={[contract.propertyCertificateDate ? fmtShortDate(contract.propertyCertificateDate) : null, contract.propertyCertificatePlace].filter(Boolean).join(' · ')} />
                        )}
                    </div>

                    {/* ── GIÁ TRỊ & TÀI CHÍNH ── */}
                    <SectionTitle>Điều 3. Giá Trị Hợp Đồng & Điều Khoản Thanh Toán</SectionTitle>

                    <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '20px', border: '1px solid #fde68a', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <div style={{ fontSize: '12px', color: '#92400e', fontFamily: "'Inter', sans-serif", fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                                    {isDeposit ? 'Giá chuyển nhượng thỏa thuận' : 'Tổng giá chuyển nhượng'}
                                </div>
                                <div style={{ fontSize: '26px', fontWeight: 900, color: '#78350f', lineHeight: 1.2 }}>
                                    {contract.propertyPrice ? contract.propertyPrice.toLocaleString('vi-VN') + ' đ' : '---'}
                                </div>
                                <div style={{ fontSize: '13px', color: '#92400e', marginTop: '2px' }}>
                                    {contract.propertyPrice ? `(Bằng chữ: ${fmtVND(contract.propertyPrice)})` : ''}
                                </div>
                            </div>
                            {isDeposit && contract.depositAmount ? (
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '12px', color: '#92400e', fontFamily: "'Inter', sans-serif", fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Số tiền đặt cọc</div>
                                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#78350f' }}>
                                        {contract.depositAmount.toLocaleString('vi-VN')} đ
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {contract.paymentTerms && (
                            <div style={{ borderTop: '1px solid #fde68a', paddingTop: '12px' }}>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: '#78350f', marginBottom: '6px' }}>Điều khoản thanh toán & ghi chú:</div>
                                <p style={{ fontSize: '13px', lineHeight: 1.8, whiteSpace: 'pre-line', color: '#92400e' }}>{contract.paymentTerms}</p>
                            </div>
                        )}
                    </div>

                    {/* ── LỊCH THANH TOÁN ── */}
                    {schedule.length > 0 && (
                        <>
                            <SectionTitle>Điều 4. Lịch Thanh Toán Chi Tiết</SectionTitle>
                            <div style={{ marginBottom: '8px' }}>
                                {/* Progress summary */}
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                    <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '10px 16px', border: '1px solid #bbf7d0', flex: 1 }}>
                                        <div style={{ fontSize: '11px', color: '#166534', fontFamily: "'Inter', sans-serif", fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Đã thanh toán</div>
                                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#166534' }}>
                                            {totalPaid.toLocaleString('vi-VN')} đ
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '2px' }}>
                                            {contract.propertyPrice ? `${Math.min(100, Math.round(totalPaid / contract.propertyPrice * 100))}% giá trị HĐ` : `${schedule.filter(m => m.status === PaymentStatus.PAID).length}/${schedule.length} đợt`}
                                        </div>
                                    </div>
                                    <div style={{ background: '#fefce8', borderRadius: '8px', padding: '10px 16px', border: '1px solid #fde68a', flex: 1 }}>
                                        <div style={{ fontSize: '11px', color: '#92400e', fontFamily: "'Inter', sans-serif", fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Còn lại</div>
                                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#92400e' }}>
                                            {Math.max(0, (contract.propertyPrice || 0) - totalPaid).toLocaleString('vi-VN')} đ
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '2px' }}>
                                            {schedule.filter(m => m.status !== PaymentStatus.PAID && m.status !== PaymentStatus.WAIVED).length} đợt chờ thanh toán
                                        </div>
                                    </div>
                                </div>

                                {/* Table */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>STT</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>Nội dung đợt thanh toán</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>Tỷ lệ</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>Số tiền (VNĐ)</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>Ngày đến hạn</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {schedule.map((m, idx) => {
                                            const isOverdue = m.status === PaymentStatus.OVERDUE ||
                                                (m.status === PaymentStatus.PENDING && m.dueDate && new Date(m.dueDate) < now);
                                            const effectiveStatus = isOverdue ? PaymentStatus.OVERDUE : m.status;
                                            const sc = STATUS_COLORS[effectiveStatus] || STATUS_COLORS[PaymentStatus.PENDING];
                                            return (
                                                <tr key={m.id || idx} style={{ background: idx % 2 === 0 ? '#f8fafc' : '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280' }}>{idx + 1}</td>
                                                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{m.name || `Đợt ${idx + 1}`}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#4b5563' }}>
                                                        {m.percentage != null ? `${m.percentage}%` : '---'}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
                                                        {(m.paidAmount ?? m.amount ?? 0).toLocaleString('vi-VN')}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#4b5563', fontFamily: "'Inter', sans-serif", fontSize: '12px' }}>
                                                        {fmtShortDate(m.dueDate)}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                        <span style={{ background: sc.bg, color: sc.color, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' }}>
                                                            {sc.label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* Total row */}
                                        <tr style={{ background: '#1e3a8a', color: '#fff', fontWeight: 700 }}>
                                            <td colSpan={3} style={{ padding: '10px 12px', fontFamily: "'Inter', sans-serif", fontSize: '13px' }}>Tổng cộng</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'Inter', sans-serif", fontSize: '14px' }}>
                                                {schedule.reduce((s, m) => s + (m.amount || 0), 0).toLocaleString('vi-VN')}
                                            </td>
                                            <td colSpan={2} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', opacity: 0.8, fontFamily: "'Inter', sans-serif" }}>
                                                {schedule.length} đợt
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* ── ĐIỀU KHOẢN KHÁC ── */}
                    {(contract.handoverDate || contract.handoverCondition || contract.taxResponsibility || contract.disputeResolution) && (
                        <>
                            <SectionTitle>Điều {schedule.length > 0 ? '5' : '4'}. Điều Khoản Bổ Sung</SectionTitle>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {(contract.handoverDate || contract.handoverCondition) && (
                                    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontWeight: 700, fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '8px', fontFamily: "'Inter', sans-serif" }}>Bàn giao</div>
                                        {contract.handoverDate && <Row label="Ngày bàn giao dự kiến" value={fmtDate(contract.handoverDate)} />}
                                        {contract.handoverCondition && <Row label="Tình trạng bàn giao" value={contract.handoverCondition} />}
                                    </div>
                                )}
                                {contract.taxResponsibility && (
                                    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontWeight: 700, fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '8px', fontFamily: "'Inter', sans-serif" }}>Thuế & phí</div>
                                        <p style={{ fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{contract.taxResponsibility}</p>
                                    </div>
                                )}
                                {contract.disputeResolution && (
                                    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px', border: '1px solid #e2e8f0', gridColumn: '1 / -1' }}>
                                        <div style={{ fontWeight: 700, fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '8px', fontFamily: "'Inter', sans-serif" }}>Giải quyết tranh chấp</div>
                                        <p style={{ fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{contract.disputeResolution}</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── CHỮ KÝ ── */}
                    <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '2px dashed #cbd5e1' }}>
                        <p style={{ fontSize: '13px', textAlign: 'center', color: '#6b7280', marginBottom: '32px', fontStyle: 'italic' }}>
                            Hai bên đã đọc kỹ và đồng ý với tất cả các điều khoản nêu trên. Hợp đồng được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', textAlign: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', color: '#1e3a8a', marginBottom: '4px' }}>Đại diện Bên A</div>
                                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '80px' }}>(Ký, đóng dấu và ghi rõ họ tên)</div>
                                <div style={{ borderTop: '1px solid #374151', paddingTop: '8px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{contract.partyARepresentative || contract.partyAName}</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{contract.partyAName}</div>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', color: '#166534', marginBottom: '4px' }}>Đại diện Bên B</div>
                                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '80px' }}>(Ký và ghi rõ họ tên)</div>
                                <div style={{ borderTop: '1px solid #374151', paddingTop: '8px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{contract.partyBName}</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>CMND/CCCD: {contract.partyBIdNumber || '---'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── FOOTER ── */}
                    <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'Inter', sans-serif", lineHeight: 1.8 }}>
                            Tài liệu được tạo bởi <strong style={{ color: '#4f46e5' }}>SGS LAND</strong> — Nền tảng BĐS Thông Minh Việt Nam
                            <br />
                            Mã tài liệu: {contract.id} · Ngày tạo: {fmtShortDate(contract.createdAt)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Error toast */}
            {errorMsg && (
                <div className="no-print" style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 100,
                    padding: '12px 20px', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                    background: '#7f1d1d', color: '#fff', fontSize: '13px', fontFamily: "'Inter', sans-serif",
                    border: '1px solid #ef4444', maxWidth: '360px',
                }}>
                    {errorMsg}
                </div>
            )}

            {/* Print & spin CSS */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }

                @media print {
                    body { margin: 0; background: #fff !important; }
                    .no-print { display: none !important; }
                    .public-contract-wrapper {
                        padding: 0 !important;
                        background: #fff !important;
                        min-height: unset !important;
                    }
                    .contract-document {
                        max-width: 100% !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                    }
                    table { page-break-inside: avoid; }
                    tr { page-break-inside: avoid; }
                    h3, h4 { page-break-after: avoid; }
                    @page {
                        size: A4 portrait;
                        margin: 18mm 15mm;
                    }
                }
            `}</style>
        </div>
    );
};

export default PublicContract;
