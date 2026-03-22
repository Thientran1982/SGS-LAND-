import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/dbApi';
import { Contract, ContractType, ContractStatus, PaymentMilestone, PaymentStatus } from '../types';
import { useTenant } from '../services/tenantContext';

interface PublicContractProps {
    token: string;
}

/* ── Helpers ── */
const fmtVND = (n?: number | null): string => {
    if (n == null || isNaN(n)) return '...........';
    const billions = Math.floor(n / 1_000_000_000);
    const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
    const thousands = Math.floor((n % 1_000_000) / 1_000);
    const remainder = n % 1_000;
    const parts: string[] = [];
    if (billions > 0) parts.push(`${billions} tỷ`);
    if (millions > 0) parts.push(`${millions} triệu`);
    if (thousands > 0) parts.push(`${thousands} nghìn`);
    if (remainder > 0) parts.push(`${remainder}`);
    const text = parts.length ? parts.join(' ') + ' đồng' : 'không đồng';
    return text.charAt(0).toUpperCase() + text.slice(1);
};

const fmtMoney = (n?: number | null): string => {
    if (n == null) return '................';
    return n.toLocaleString('vi-VN') + ' đồng';
};

const fmtDate = (d?: string | null): string => {
    if (!d) return 'ngày ........ tháng ........ năm ........';
    try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return d;
        return `ngày ${dt.getDate().toString().padStart(2, '0')} tháng ${(dt.getMonth() + 1).toString().padStart(2, '0')} năm ${dt.getFullYear()}`;
    } catch { return d; }
};

const fmtShortDate = (d?: string | null): string => {
    if (!d) return '........';
    try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return d;
        return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()}`;
    } catch { return d; }
};

const blank = (s?: string | null, fallback = '...') =>
    s && s.trim() ? s.trim() : fallback;

/* ── Styling constants ── */
const FONT = "'Times New Roman', 'DejaVu Serif', 'Noto Serif', Times, serif";
const FONT_SANS = "'Arial', 'Helvetica Neue', sans-serif";
const TEXT = '#000000';
const GRAY = '#4b5563';

const pageStyle: React.CSSProperties = {
    maxWidth: '794px',
    margin: '0 auto',
    background: '#ffffff',
    fontFamily: FONT,
    color: TEXT,
    fontSize: '13pt',
    lineHeight: '1.9',
};

const center: React.CSSProperties = { textAlign: 'center' };
const bold: React.CSSProperties = { fontWeight: 700 };

/* ── Sub-components ── */
const ArticleTitle: React.FC<{ num: string | number; title: string }> = ({ num, title }) => (
    <div style={{ marginTop: '22px', marginBottom: '8px' }}>
        <p style={{ fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', fontSize: '13pt', margin: 0 }}>
            Điều {num}. {title}
        </p>
    </div>
);

const EMPTY_PLACEHOLDER = <span style={{ color: '#999', fontStyle: 'italic', letterSpacing: '0.05em' }}>...</span>;

const Line: React.FC<{ label: string; value?: string | null; inline?: boolean }> = ({ label, value, inline }) => {
    const hasValue = value && value.trim();
    if (inline) {
        return (
            <span>
                <span style={{ fontWeight: 600 }}>{label}: </span>
                {hasValue ? <span>{value!.trim()}</span> : EMPTY_PLACEHOLDER}
            </span>
        );
    }
    return (
        <p style={{ margin: '2px 0', paddingLeft: '16px' }}>
            <span style={{ fontWeight: 600 }}>- {label}: </span>
            {hasValue ? <span>{value!.trim()}</span> : EMPTY_PLACEHOLDER}
        </p>
    );
};

const Divider: React.FC<{ style?: React.CSSProperties; className?: string }> = ({ style, className }) => (
    <div className={className} style={{ borderBottom: '1px solid #000', margin: '6px 0', ...style }} />
);

export const PublicContract: React.FC<PublicContractProps> = ({ token }) => {
    const { isLoading: isTenantLoading } = useTenant();
    const [contract, setContract] = useState<Contract | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
        if (!contractRef.current) { window.print(); return; }
        // Open a dedicated print window with just the contract DOM (avoids iframe constraints)
        const pw = window.open('', '_blank', 'width=900,height=700');
        if (!pw) { window.print(); return; } // fallback if popup blocked
        const html = contractRef.current.outerHTML;
        pw.document.write(`<!DOCTYPE html><html lang="vi"><head>
<meta charset="utf-8"><title>Hợp Đồng</title>
<style>
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;-ms-overflow-style:none!important;scrollbar-width:none!important;}
*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;}
html,body{margin:0;padding:0;background:#fff;overflow:visible!important;height:auto!important;}
.contract-divider{display:none!important;}
.blank-field-border{border-bottom:none!important;}
table{border-collapse:collapse;width:100%;page-break-inside:auto;}
tr{page-break-inside:avoid;page-break-after:auto;}
thead{display:table-header-group;}
p{orphans:2;widows:2;}
@page{size:A4 portrait;margin:12mm 10mm;}
</style></head><body>${html}<script>
window.onload=function(){setTimeout(function(){window.print();},400);};
</script></body></html>`);
        pw.document.close();
    };

    const handleExportPDF = async () => {
        if (!contract) return;
        setExporting(true);
        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import('html2canvas'),
                import('jspdf'),
            ]);
            if (!contractRef.current) return;
            await document.fonts.ready;
            window.scrollTo(0, 0);
            await new Promise(r => setTimeout(r, 400));

            // Inject clean CSS right before capture (minimal reflow time)
            const cleanStyle = document.createElement('style');
            cleanStyle.id = 'pdf-clean-mode';
            cleanStyle.textContent = '.blank-field-border { border-bottom: none !important; } .contract-divider { display: none !important; }';
            document.head.appendChild(cleanStyle);

            // Give browser a frame to apply the style before capture
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

            const el = contractRef.current;
            const fullWidth = el.offsetWidth;
            const fullHeight = el.scrollHeight;

            const canvas = await html2canvas(el, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: -window.scrollY,
                x: 0,
                y: 0,
                width: fullWidth,
                height: fullHeight,
                windowWidth: fullWidth,
                windowHeight: fullHeight,
            });

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const W = pdf.internal.pageSize.getWidth();
            const H = pdf.internal.pageSize.getHeight();
            const imgH = (canvas.height * W) / canvas.width;
            let remaining = imgH;
            let yOffset = 0;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, yOffset, W, imgH);
            remaining -= H;
            while (remaining > 1) {
                yOffset -= H;
                pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, yOffset, W, imgH);
                remaining -= H;
            }
            pdf.save(`HopDong_${contract.id.slice(0, 8).toUpperCase()}.pdf`);
        } catch (err) {
            console.error('PDF export error:', err);
            setErrorMsg('Xuất PDF thất bại. Hãy dùng In (Ctrl+P) → Save as PDF.');
            setTimeout(() => setErrorMsg(null), 5000);
        } finally {
            document.getElementById('pdf-clean-mode')?.remove();
            setExporting(false);
        }
    };

    /* ── States ── */
    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_SANS, color: GRAY }}>
            Đang tải hợp đồng...
        </div>
    );
    if (!contract) return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_SANS, color: GRAY }}>
            <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Không tìm thấy hợp đồng</p>
            <p style={{ fontSize: '14px' }}>Liên kết không hợp lệ hoặc hợp đồng đã bị xóa.</p>
        </div>
    );

    const isDeposit = contract.type === ContractType.DEPOSIT;
    const schedule: PaymentMilestone[] = contract.paymentSchedule || [];
    const now = new Date();
    const isSigned = contract.status === ContractStatus.SIGNED;
    // signDate: ngày ký thực tế (dùng cho badge "Đã ký kết" và footer)
    const signDate = contract.signedAt || contract.createdAt;
    // contractDate: ưu tiên contractDate tùy chỉnh → signedAt → createdAt (khi đã ký), hoặc null
    const contractDate = contract.contractDate
        || (isSigned ? (contract.signedAt || contract.createdAt) : null);
    // signedPlace: địa điểm ký hợp đồng
    const signedPlace = contract.signedPlace || null;
    const contractNum = `HĐ-${contract.id.slice(0, 8).toUpperCase()}`;

    const legalRefs = isDeposit
        ? ['Bộ Luật Dân sự năm 2015;', 'Luật Kinh doanh Bất động sản năm 2023;', 'Nhu cầu và sự thỏa thuận của hai bên.']
        : ['Bộ Luật Dân sự năm 2015;', 'Luật Đất đai năm 2024;', 'Luật Kinh doanh Bất động sản năm 2023;', 'Nhu cầu và sự thỏa thuận của hai bên.'];

    // articleOffset: +1 nếu có lịch thanh toán (Điều 4)
    const articleOffset = schedule.length > 0 ? 1 : 0;
    // handoverOffset: +1 nếu có thông tin bàn giao
    const handoverOffset = (contract.handoverDate || contract.handoverCondition) ? 1 : 0;

    /* ── Render ── */
    return (
        <div style={{ minHeight: '100vh', background: '#e8e8e8', padding: '32px 16px', fontFamily: FONT_SANS }} className="public-contract-page">

            {/* ── TOOLBAR (ẩn khi in) ── */}
            <div className="no-print" style={{
                maxWidth: '860px', margin: '0 auto 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
            }}>
                <button
                    onClick={() => { window.location.hash = localStorage.getItem('sgs_token') ? '#/contracts' : '#/'; }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#374151', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600 }}
                >
                    ← Quay lại
                </button>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={handlePrint} style={{ padding: '8px 18px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: FONT_SANS }}>
                        🖨 In / Lưu PDF
                    </button>
                    <button onClick={handleExportPDF} disabled={exporting} style={{ padding: '8px 18px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: FONT_SANS, opacity: exporting ? 0.7 : 1 }}>
                        {exporting ? 'Đang xuất...' : '⬇ Xuất PDF'}
                    </button>
                </div>
            </div>

            {/* ── DOCUMENT ── */}
            <div ref={contractRef} style={{ ...pageStyle, padding: '48px 64px', boxShadow: '0 2px 24px rgba(0,0,0,0.15)' }} className="contract-document">

                {/* QUỐC HIỆU */}
                <div style={{ ...center, marginBottom: '20px' }}>
                    <p style={{ ...bold, fontSize: '13pt', margin: 0 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p style={{ ...bold, fontSize: '13pt', margin: '2px 0 0' }}>
                        <span style={{ borderBottom: '1.5px solid #000', paddingBottom: '2px' }}>
                            Độc lập – Tự do – Hạnh phúc
                        </span>
                    </p>
                </div>

                {/* TÊN HỢP ĐỒNG */}
                <div style={{ ...center, margin: '0 0 16px' }}>
                    <p style={{ ...bold, fontSize: '15pt', textTransform: 'uppercase', letterSpacing: '1px', margin: 0, lineHeight: 1.6 }}>
                        {isDeposit ? (
                            <>Hợp Đồng Đặt Cọc<br />Chuyển Nhượng Quyền Sử Dụng Đất</>
                        ) : (
                            <>Hợp Đồng Chuyển Nhượng<br />Quyền Sử Dụng Đất</>
                        )}
                    </p>
                    {!isDeposit && (
                        <p style={{ fontSize: '11pt', margin: '6px 0 0', color: GRAY, fontStyle: 'italic' }}>
                            (Kèm theo Giấy chứng nhận quyền sử dụng đất)
                        </p>
                    )}
                    <p style={{ ...bold, fontSize: '12pt', margin: '8px 0 0' }}>Số: {contractNum}</p>
                    {isSigned && (
                        <p style={{ fontSize: '11pt', margin: '4px 0 0', color: '#166534' }}>
                            ✓ Đã ký kết {fmtDate(signDate)}
                        </p>
                    )}
                </div>

                <Divider className="contract-divider" style={{ margin: '16px 0' }} />

                {/* CĂN CỨ */}
                <div style={{ marginBottom: '12px' }}>
                    <p style={{ ...bold, margin: '0 0 4px' }}>Căn cứ:</p>
                    {legalRefs.map((ref, i) => (
                        <p key={i} style={{ margin: '2px 0', paddingLeft: '16px' }}>- {ref}</p>
                    ))}
                </div>

                {/* MỞ ĐẦU */}
                <p style={{ margin: '12px 0' }}>
                    Hôm nay, {fmtDate(contractDate)}, tại{' '}
                    {signedPlace
                        ? <span style={{ fontWeight: 600 }}>{signedPlace}</span>
                        : EMPTY_PLACEHOLDER
                    }
                    {' '}(tỉnh/thành phố), chúng tôi gồm:
                </p>

                {/* ── ĐIỀU 1: CÁC BÊN ── */}
                <ArticleTitle num={1} title={`Các Bên Tham Gia Hợp Đồng`} />

                {/* Bên A */}
                <p style={{ ...bold, margin: '8px 0 4px' }}>BÊN A ({isDeposit ? 'BÊN NHẬN ĐẶT CỌC' : 'BÊN CHUYỂN NHƯỢNG'}):</p>
                <Line label="Tên cá nhân / tổ chức" value={contract.partyAName} />
                {contract.partyARepresentative && <Line label="Người đại diện theo pháp luật" value={contract.partyARepresentative} />}
                {contract.partyATaxCode && <Line label="Mã số thuế / Số ĐKDN" value={contract.partyATaxCode} />}
                {contract.partyAIdNumber && (
                    <Line label="CMND / CCCD số" value={[
                        contract.partyAIdNumber,
                        contract.partyAIdDate ? `cấp ngày ${fmtShortDate(contract.partyAIdDate)}` : null,
                        contract.partyAIdPlace ? `tại ${contract.partyAIdPlace}` : null,
                    ].filter(Boolean).join(', ')} />
                )}
                <Line label="Địa chỉ thường trú / trụ sở" value={contract.partyAAddress} />
                <Line label="Số điện thoại" value={contract.partyAPhone} />
                {contract.partyABankAccount && (
                    <Line label="Số tài khoản" value={`${contract.partyABankAccount}${contract.partyABankName ? ` – ${contract.partyABankName}` : ''}`} />
                )}
                <p style={{ margin: '4px 0 0', paddingLeft: '16px', fontStyle: 'italic' }}>
                    (Sau đây gọi là "<strong>Bên A</strong>")
                </p>

                {/* Bên B */}
                <p style={{ ...bold, margin: '14px 0 4px' }}>BÊN B ({isDeposit ? 'BÊN ĐẶT CỌC' : 'BÊN NHẬN CHUYỂN NHƯỢNG'}):</p>
                <Line label="Họ và tên" value={contract.partyBName} />
                {contract.partyBIdNumber && (
                    <Line label="CMND / CCCD số" value={[
                        contract.partyBIdNumber,
                        contract.partyBIdDate ? `cấp ngày ${fmtShortDate(contract.partyBIdDate)}` : null,
                        contract.partyBIdPlace ? `tại ${contract.partyBIdPlace}` : null,
                    ].filter(Boolean).join(', ')} />
                )}
                <Line label="Địa chỉ thường trú" value={contract.partyBAddress} />
                <Line label="Số điện thoại" value={contract.partyBPhone} />
                {contract.partyBBankAccount && (
                    <Line label="Số tài khoản" value={`${contract.partyBBankAccount}${contract.partyBBankName ? ` – ${contract.partyBBankName}` : ''}`} />
                )}
                <p style={{ margin: '4px 0 0', paddingLeft: '16px', fontStyle: 'italic' }}>
                    (Sau đây gọi là "<strong>Bên B</strong>")
                </p>

                <p style={{ margin: '12px 0' }}>
                    Hai bên đồng ý ký kết hợp đồng với các điều khoản và điều kiện sau đây:
                </p>

                {/* ── ĐIỀU 2: BẤT ĐỘNG SẢN ── */}
                <ArticleTitle num={2} title="Đối Tượng Hợp Đồng" />
                <p style={{ margin: '4px 0 8px' }}>
                    Bên A {isDeposit
                        ? 'đồng ý nhận đặt cọc, và Bên B đồng ý đặt cọc để mua'
                        : 'đồng ý chuyển nhượng cho Bên B'} quyền sử dụng thửa đất / tài sản gắn liền với đất có thông tin như sau:
                </p>
                <div style={{ paddingLeft: '16px' }}>
                    <p style={{ margin: '3px 0' }}>
                        <strong>- Địa chỉ: </strong>{blank(contract.propertyAddress)}
                    </p>
                    {contract.propertyType && (
                        <p style={{ margin: '3px 0' }}>
                            <strong>- Loại đất / loại hình bất động sản: </strong>{contract.propertyType}
                        </p>
                    )}
                    {(contract.propertyLandArea != null || contract.propertyArea != null) && (
                        <p style={{ margin: '3px 0' }}>
                            <strong>- Diện tích: </strong>
                            {contract.propertyLandArea != null ? `Đất: ${contract.propertyLandArea} m²` : ''}
                            {contract.propertyLandArea != null && contract.propertyConstructionArea != null ? ' / ' : ''}
                            {contract.propertyConstructionArea != null ? `Xây dựng: ${contract.propertyConstructionArea} m²` : ''}
                            {contract.propertyLandArea == null && contract.propertyArea != null ? `${contract.propertyArea} m²` : ''}
                        </p>
                    )}
                    <p style={{ margin: '3px 0' }}>
                        <strong>- Giấy chứng nhận quyền sử dụng đất số: </strong>{blank(contract.propertyCertificateNumber)}
                        {(contract.propertyCertificateDate || contract.propertyCertificatePlace) && (
                            <span>
                                {contract.propertyCertificateDate ? `, cấp ngày ${fmtShortDate(contract.propertyCertificateDate)}` : ''}
                                {contract.propertyCertificatePlace ? `, do ${contract.propertyCertificatePlace} cấp` : ''}
                            </span>
                        )}
                    </p>
                </div>

                {/* ── ĐIỀU 3: GIÁ TRỊ & THANH TOÁN ── */}
                <ArticleTitle num={3} title={isDeposit ? 'Số Tiền Đặt Cọc và Giá Chuyển Nhượng' : 'Giá Chuyển Nhượng và Phương Thức Thanh Toán'} />

                <div style={{ paddingLeft: '16px' }}>
                    {isDeposit && contract.depositAmount != null && (
                        <p style={{ margin: '4px 0' }}>
                            <strong>1. Số tiền đặt cọc: </strong>
                            {fmtMoney(contract.depositAmount)}
                            {contract.depositAmount ? ` (Bằng chữ: ${fmtVND(contract.depositAmount)})` : ''}
                        </p>
                    )}
                    <p style={{ margin: '4px 0' }}>
                        <strong>{isDeposit ? '2.' : '1.'} Giá chuyển nhượng: </strong>
                        {fmtMoney(contract.propertyPrice)}
                        {contract.propertyPrice ? ` (Bằng chữ: ${fmtVND(contract.propertyPrice)})` : ''}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                        <strong>{isDeposit ? '3.' : '2.'} Phương thức thanh toán: </strong>
                        Chuyển khoản ngân hàng / tiền mặt theo lịch đã thỏa thuận.
                    </p>
                    {contract.paymentTerms && (
                        <p style={{ margin: '4px 0' }}>
                            <strong>{isDeposit ? '4.' : '3.'} Điều khoản thanh toán: </strong>
                            {contract.paymentTerms}
                        </p>
                    )}
                </div>

                {/* ── ĐIỀU 4: LỊCH THANH TOÁN ── */}
                {schedule.length > 0 && (
                    <>
                        <ArticleTitle num={4} title="Lịch Thanh Toán Chi Tiết" />
                        <p style={{ margin: '0 0 10px', paddingLeft: '16px' }}>
                            Việc thanh toán được thực hiện thành <strong>{schedule.length} đợt</strong> theo lịch dưới đây:
                        </p>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt', marginBottom: '10px' }}>
                            <thead>
                                <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                                    <th style={{ border: '1px solid #1e3a8a', padding: '7px 10px', textAlign: 'center', fontFamily: FONT, fontSize: '11pt', fontWeight: 700 }}>STT</th>
                                    <th style={{ border: '1px solid #1e3a8a', padding: '7px 10px', textAlign: 'left', fontFamily: FONT, fontSize: '11pt', fontWeight: 700 }}>Nội dung đợt thanh toán</th>
                                    <th style={{ border: '1px solid #1e3a8a', padding: '7px 10px', textAlign: 'center', fontFamily: FONT, fontSize: '11pt', fontWeight: 700 }}>Tỷ lệ (%)</th>
                                    <th style={{ border: '1px solid #1e3a8a', padding: '7px 10px', textAlign: 'right', fontFamily: FONT, fontSize: '11pt', fontWeight: 700 }}>Số tiền (VNĐ)</th>
                                    <th style={{ border: '1px solid #1e3a8a', padding: '7px 10px', textAlign: 'center', fontFamily: FONT, fontSize: '11pt', fontWeight: 700 }}>Thời hạn</th>
                                    <th style={{ border: '1px solid #1e3a8a', padding: '7px 10px', textAlign: 'center', fontFamily: FONT, fontSize: '11pt', fontWeight: 700 }}>Tình trạng</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schedule.map((m, idx) => {
                                    const isOverdue = m.status === PaymentStatus.OVERDUE ||
                                        (m.status === PaymentStatus.PENDING && m.dueDate && new Date(m.dueDate) < now);
                                    const isPaid = m.status === PaymentStatus.PAID;
                                    const rowBg = idx % 2 === 0 ? '#f9f9f9' : '#fff';
                                    return (
                                        <tr key={m.id || idx} style={{ background: rowBg }}>
                                            <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'center', fontFamily: FONT }}>{idx + 1}</td>
                                            <td style={{ border: '1px solid #ccc', padding: '6px 10px', fontFamily: FONT }}>{m.name || `Đợt ${idx + 1}`}</td>
                                            <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'center', fontFamily: FONT }}>
                                                {m.percentage != null ? `${m.percentage}%` : '—'}
                                            </td>
                                            <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'right', fontFamily: FONT, fontWeight: 600 }}>
                                                {(m.paidAmount ?? m.amount ?? 0).toLocaleString('vi-VN')}
                                            </td>
                                            <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'center', fontFamily: FONT, fontSize: '11pt' }}>
                                                {fmtShortDate(m.dueDate)}
                                            </td>
                                            <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'center', fontFamily: FONT, fontSize: '10pt', fontStyle: 'italic' }}>
                                                {isPaid ? 'Đã thanh toán' : isOverdue ? 'Quá hạn' : m.status === PaymentStatus.WAIVED ? 'Miễn giảm' : 'Chưa thanh toán'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr style={{ background: '#f0f0f0', fontWeight: 700 }}>
                                    <td colSpan={3} style={{ border: '1px solid #ccc', padding: '8px 10px', fontFamily: FONT, fontWeight: 700 }}>Tổng cộng</td>
                                    <td style={{ border: '1px solid #ccc', padding: '8px 10px', textAlign: 'right', fontFamily: FONT, fontWeight: 700 }}>
                                        {schedule.reduce((s, m) => s + (m.amount || 0), 0).toLocaleString('vi-VN')}
                                    </td>
                                    <td colSpan={2} style={{ border: '1px solid #ccc', padding: '8px 10px', textAlign: 'center', fontFamily: FONT }}>
                                        {schedule.length} đợt
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </>
                )}

                {/* ── ĐIỀU 5: NGHĨA VỤ CÁC BÊN ── */}
                <ArticleTitle num={4 + articleOffset} title="Nghĩa Vụ Các Bên" />
                <p style={{ ...bold, margin: '6px 0 2px', paddingLeft: '16px' }}>1. Nghĩa vụ của Bên A:</p>
                <div style={{ paddingLeft: '32px' }}>
                    <p style={{ margin: '2px 0' }}>a) Giao cho Bên B toàn bộ hồ sơ, giấy tờ liên quan đến bất động sản;</p>
                    <p style={{ margin: '2px 0' }}>b) Bàn giao bất động sản đúng thời hạn và hiện trạng đã thỏa thuận;</p>
                    <p style={{ margin: '2px 0' }}>c) Phối hợp với Bên B hoàn thành thủ tục sang tên tại cơ quan nhà nước có thẩm quyền.</p>
                </div>
                <p style={{ ...bold, margin: '8px 0 2px', paddingLeft: '16px' }}>2. Nghĩa vụ của Bên B:</p>
                <div style={{ paddingLeft: '32px' }}>
                    <p style={{ margin: '2px 0' }}>a) Thanh toán đầy đủ, đúng hạn theo lịch đã thỏa thuận tại Điều {schedule.length > 0 ? '4' : '3'};</p>
                    <p style={{ margin: '2px 0' }}>b) Chịu trách nhiệm về việc sử dụng bất động sản sau khi nhận bàn giao;</p>
                    <p style={{ margin: '2px 0' }}>c) Phối hợp với Bên A hoàn thành thủ tục sang tên theo quy định pháp luật.</p>
                </div>

                {/* ── ĐIỀU 6: THUẾ & PHÍ ── */}
                <ArticleTitle num={5 + articleOffset} title="Thuế, Phí và Lệ Phí" />
                <div style={{ paddingLeft: '16px' }}>
                    {contract.taxResponsibility ? (
                        <p style={{ margin: '4px 0' }}>{contract.taxResponsibility}</p>
                    ) : (
                        <>
                            <p style={{ margin: '3px 0' }}>- Thuế thu nhập cá nhân từ chuyển nhượng bất động sản: <strong>Bên A</strong> chịu trách nhiệm nộp theo quy định của pháp luật.</p>
                            <p style={{ margin: '3px 0' }}>- Lệ phí trước bạ, phí công chứng và các phí sang tên: Các bên thỏa thuận và tự chịu theo quy định.</p>
                        </>
                    )}
                </div>

                {/* ── ĐIỀU 7: BÀN GIAO ── */}
                {(contract.handoverDate || contract.handoverCondition) && (
                    <>
                        <ArticleTitle num={6 + articleOffset} title="Bàn Giao Tài Sản" />
                        <div style={{ paddingLeft: '16px' }}>
                            {contract.handoverDate && (
                                <p style={{ margin: '3px 0' }}>
                                    - Thời hạn bàn giao: <strong>{fmtDate(contract.handoverDate)}</strong>
                                </p>
                            )}
                            {contract.handoverCondition && (
                                <p style={{ margin: '3px 0' }}>
                                    - Tình trạng bàn giao: {contract.handoverCondition}
                                </p>
                            )}
                        </div>
                    </>
                )}

                {/* ── ĐIỀU: GIẢI QUYẾT TRANH CHẤP ── */}
                <ArticleTitle num={6 + articleOffset + handoverOffset} title="Giải Quyết Tranh Chấp" />
                <div style={{ paddingLeft: '16px' }}>
                    {contract.disputeResolution ? (
                        <p style={{ margin: '4px 0' }}>{contract.disputeResolution}</p>
                    ) : (
                        <p style={{ margin: '4px 0' }}>
                            Mọi tranh chấp phát sinh từ hợp đồng này trước tiên được giải quyết thông qua thương lượng, hòa giải giữa hai bên.
                            Nếu không giải quyết được, tranh chấp sẽ được đưa ra Tòa án nhân dân có thẩm quyền để giải quyết theo quy định của pháp luật Việt Nam.
                        </p>
                    )}
                </div>

                {/* ── ĐIỀU KHOẢN CHUNG ── */}
                <ArticleTitle num={7 + articleOffset + handoverOffset} title="Điều Khoản Chung" />
                <div style={{ paddingLeft: '16px' }}>
                    <p style={{ margin: '3px 0' }}>- Hợp đồng này có hiệu lực kể từ ngày ký.</p>
                    <p style={{ margin: '3px 0' }}>- Hợp đồng được lập thành <strong>02 (hai) bản</strong>, có giá trị pháp lý như nhau; mỗi bên giữ <strong>01 (một) bản</strong>.</p>
                    <p style={{ margin: '3px 0' }}>- Mọi sửa đổi, bổ sung hợp đồng này phải được lập thành văn bản và có chữ ký của cả hai bên.</p>
                    <p style={{ margin: '3px 0' }}>- Các điều khoản khác không được đề cập trong hợp đồng này sẽ được thực hiện theo quy định của pháp luật Việt Nam hiện hành.</p>
                </div>

                {/* ── KÝ TÊN ── */}
                <div style={{ marginTop: '40px' }}>
                    <p style={{ textAlign: 'right', marginBottom: '4px', fontStyle: 'italic' }}>
                        {signedPlace ? <span>{signedPlace}</span> : EMPTY_PLACEHOLDER}
                        , {fmtDate(contractDate)}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '16px' }}>
                        {/* Bên A */}
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ ...bold, textTransform: 'uppercase', fontSize: '12pt', margin: '0 0 4px' }}>
                                {isDeposit ? 'Bên Nhận Đặt Cọc' : 'Bên Chuyển Nhượng'}<br />(Bên A)
                            </p>
                            <p style={{ fontStyle: 'italic', fontSize: '11pt', color: GRAY, margin: '0 0 64px' }}>
                                (Ký, ghi rõ họ tên{contract.partyATaxCode ? ', đóng dấu' : ''})
                            </p>
                            <Divider className="contract-divider" />
                            <p style={{ ...bold, margin: '6px 0 2px', fontSize: '12pt' }}>
                                {blank(contract.partyARepresentative || contract.partyAName)}
                            </p>
                            {contract.partyARepresentative && contract.partyAName && (
                                <p style={{ margin: 0, fontSize: '11pt', color: GRAY }}>{contract.partyAName}</p>
                            )}
                        </div>

                        {/* Bên B */}
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ ...bold, textTransform: 'uppercase', fontSize: '12pt', margin: '0 0 4px' }}>
                                {isDeposit ? 'Bên Đặt Cọc' : 'Bên Nhận Chuyển Nhượng'}<br />(Bên B)
                            </p>
                            <p style={{ fontStyle: 'italic', fontSize: '11pt', color: GRAY, margin: '0 0 64px' }}>
                                (Ký và ghi rõ họ tên)
                            </p>
                            <Divider className="contract-divider" />
                            <p style={{ ...bold, margin: '6px 0 2px', fontSize: '12pt' }}>
                                {blank(contract.partyBName)}
                            </p>
                            {contract.partyBIdNumber && (
                                <p style={{ margin: 0, fontSize: '11pt', color: GRAY }}>CCCD: {contract.partyBIdNumber}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── FOOTER ── */}
                <div style={{ marginTop: '32px', paddingTop: '12px', borderTop: '1px solid #ccc', textAlign: 'center' }}>
                    <p style={{ fontSize: '10pt', color: '#888', fontFamily: FONT_SANS, margin: 0 }}>
                        Số hợp đồng: <strong>{contractNum}</strong> · Hệ thống quản lý: <strong>SGS LAND</strong> · Ngày tạo: {fmtShortDate(contract.createdAt)}
                    </p>
                </div>
            </div>

            {/* Error toast */}
            {errorMsg && (
                <div className="no-print" style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 100,
                    padding: '12px 20px', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                    background: '#7f1d1d', color: '#fff', fontSize: '13px', fontFamily: FONT_SANS,
                }}>
                    {errorMsg}
                </div>
            )}

            {/* Fallback print CSS (used when popup is blocked) */}
            <style>{`
                @media print {
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    body { margin: 0; background: #fff !important; }
                    .no-print { display: none !important; }
                    .blank-field-border { border-bottom: none !important; }
                    .contract-divider { display: none !important; }
                    .public-contract-page {
                        padding: 0 !important;
                        background: #fff !important;
                        min-height: unset !important;
                    }
                    .contract-document {
                        max-width: 100% !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                    }
                    table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    thead { display: table-header-group; }
                    p { orphans: 2; widows: 2; }
                    @page {
                        size: A4 portrait;
                        margin: 12mm 10mm;
                    }
                }
            `}</style>
        </div>
    );
};

export default PublicContract;
