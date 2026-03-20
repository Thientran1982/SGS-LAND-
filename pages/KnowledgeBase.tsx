
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { KnowledgeDocument } from '../types';
import { useTranslation } from '../services/i18n';

const ICONS = {
    UPLOAD: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
    SEARCH: <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    FILE_PDF: <svg className="w-8 h-8 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M7 3a1 1 0 000 2h10a1 1 0 100-2H7zM5 7a1 1 0 000 2h14a1 1 0 100-2H5zM5 11a1 1 0 000 2h14a1 1 0 100-2H5zM5 15a1 1 0 000 2h14a1 1 0 100-2H5zM5 19a1 1 0 000 2h10a1 1 0 100-2H5z" /></svg>,
    FILE_DOC: <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4a2 2 0 012-2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>,
    FILE_TXT: <svg className="w-8 h-8 text-[var(--text-tertiary)]" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4a2 2 0 012-2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>,
    CLOUD: <svg className="w-10 h-10 text-indigo-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
    X: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
};

const normalizeString = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

export const KnowledgeBase: React.FC = () => {
    const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingCount, setUploadingCount] = useState(0);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const { t, formatDate } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Debounce search input — wait 350ms before hitting server
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(handler);
    }, [search]);

    const fetchData = useCallback(async (searchTerm?: string) => {
        setLoading(true);
        try {
            const [data, user] = await Promise.all([
                db.getDocuments(searchTerm || undefined),
                db.getCurrentUser(),
            ]);
            setDocs(data || []);
            setCurrentUser(user);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    // Initial load + re-fetch when debounced search changes
    useEffect(() => { fetchData(debouncedSearch || undefined); }, [fetchData, debouncedSearch]);

    const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_LEAD';

    const processFile = async (file: File): Promise<boolean> => {
        const validTypes = ['.pdf', '.docx', '.doc', '.txt'];
        const isValidType = validTypes.some(type => file.name.toLowerCase().endsWith(type));
        if (!isValidType) {
            notify(t('knowledge.error_type') || 'Chỉ hỗ trợ định dạng PDF, DOCX, TXT', 'error');
            return false;
        }
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            notify(`${file.name}: ${t('knowledge.error_size') || 'Kích thước file vượt quá 10MB'}`, 'error');
            return false;
        }
        try {
            const uploadResult = await db.uploadFiles([file]);
            const uploaded = uploadResult.files[0];
            let type: 'PDF' | 'DOCX' | 'TXT' = 'TXT';
            if (file.name.toLowerCase().endsWith('.pdf')) type = 'PDF';
            else if (file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) type = 'DOCX';
            const doc = await db.createDocument({
                title: file.name,
                type,
                content: '',
                fileUrl: uploaded.url,
                sizeKb: Math.round(file.size / 1024),
            });
            setDocs(prev => [doc, ...prev]);
            return true;
        } catch (err: any) {
            console.error('[KnowledgeBase] Upload failed:', err);
            notify(`${file.name}: ${err?.message || t('common.error') || 'Đã xảy ra lỗi'}`, 'error');
            return false;
        }
    };

    const processFiles = async (files: File[]) => {
        if (!files.length) return;
        setIsUploading(true);
        setUploadingCount(files.length);
        let successCount = 0;
        for (const file of files) {
            const ok = await processFile(file);
            if (ok) successCount++;
        }
        setIsUploading(false);
        setUploadingCount(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (successCount > 0) {
            notify(
                files.length === 1
                    ? (t('knowledge.upload_success') || 'Tải lên thành công')
                    : `${successCount}/${files.length} file tải lên thành công`,
                'success'
            );
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        await processFiles(files);
    };

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (!files.length) return;
        await processFiles(files);
    };

    const handleDelete = async (id: string) => {
        setIsDeleting(true);
        try {
            await db.deleteDocument(id);
            setDocs(prev => (prev || []).filter(d => d.id !== id));
            notify(t('knowledge.delete_success') || 'Xóa thành công', 'success');
            setConfirmDeleteId(null);
        } catch (error: any) {
            notify(error?.message || t('common.error') || 'Đã xảy ra lỗi', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-[var(--text-secondary)] font-mono animate-pulse">{t('common.loading') || 'Đang tải...'}</div>;

    return (
        <div className="space-y-6 pt-6 pb-20 animate-enter relative max-w-6xl mx-auto px-4 md:px-6">
            {toast && (
            <div className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-6 sm:max-w-sm z-[100] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}>
                <span className="font-bold text-sm flex-1">{toast.msg}</span>
            </div>
            )}

            {/* Page Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-extrabold text-[var(--text-primary)]">{t('knowledge.title')}</h1>
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">{t('knowledge.subtitle')}</p>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {confirmDeleteId && createPortal(
                <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-enter">
                    <div className="bg-[var(--bg-surface)] rounded-t-[28px] sm:rounded-[24px] shadow-2xl max-w-sm w-full p-6 border border-[var(--glass-border)]">
                        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4 mx-auto sm:mx-0">
                            {ICONS.TRASH}
                        </div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                            {t('knowledge.confirm_delete') || 'Bạn có chắc chắn muốn xóa tài liệu này?'}
                        </h3>
                        <p className="text-[var(--text-tertiary)] text-sm mb-6">
                            {t('knowledge.delete_warning') || 'Hành động này không thể hoàn tác. Tài liệu và file vật lý sẽ bị xóa hoàn toàn khỏi hệ thống.'}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-3 bg-[var(--glass-surface-hover)] hover:bg-slate-200 text-[var(--text-secondary)] font-bold rounded-xl transition-colors disabled:opacity-50"
                            >
                                {t('common.cancel') || 'Hủy'}
                            </button>
                            <button
                                onClick={() => handleDelete(confirmDeleteId)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-rose-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {isDeleting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {isDeleting ? '...' : (t('common.delete') || 'Xóa')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="flex justify-end">
                <div className="w-full md:w-auto">
                    <div className="relative w-full md:w-72 group">
                        <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-[var(--text-secondary)] group-focus-within:text-indigo-500 transition-colors">
                            {ICONS.SEARCH}
                        </div>
                        <input 
                            className="w-full pl-10 pr-10 py-2.5 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-[var(--bg-surface)] transition-all outline-none placeholder:text-[var(--text-muted)]"
                            placeholder={t('knowledge.search_placeholder') || 'Tìm kiếm tài liệu...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <div className="absolute right-2 inset-y-0 flex items-center">
                                <button 
                                    onClick={() => setSearch('')}
                                    className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors p-1.5 rounded-full hover:bg-slate-200 flex items-center justify-center"
                                    title={t('knowledge.clear_search') || 'Xóa tìm kiếm'}
                                >
                                    {ICONS.X}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Drag & Drop Upload Zone — only for managers */}
            {canManage && (
            <div 
                className={`relative overflow-hidden border-2 border-dashed rounded-[24px] p-6 sm:p-10 text-center transition-all duration-300 ${
                    isDragging 
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                        : 'border-[var(--glass-border)] bg-[var(--bg-surface)] hover:border-indigo-300 hover:bg-[var(--glass-surface)]'
                }`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <div className="flex flex-col items-center justify-center pointer-events-none">
                    {ICONS.CLOUD}
                    <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-2">
                        {isDragging ? (t('knowledge.drop_here') || 'Thả file vào đây') : (t('knowledge.drag_drop') || 'Kéo thả tài liệu vào đây')}
                    </h3>
                    <p className="text-xs sm:text-sm text-[var(--text-tertiary)] mb-5 sm:mb-6 max-w-md">
                        {t('knowledge.upload_desc') || 'Hỗ trợ PDF, DOCX, TXT. Tối đa 10MB mỗi file. Có thể chọn nhiều file cùng lúc.'}
                    </p>
                </div>
                <label className={`relative z-10 inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 cursor-pointer ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}>
                    {isUploading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        ICONS.UPLOAD
                    )}
                    {isUploading
                        ? (uploadingCount > 1 ? t('knowledge.uploading_many', { count: uploadingCount }) : t('knowledge.uploading_one'))
                        : t('knowledge.btn_upload')}
                    <input 
                        type="file" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleUpload} 
                        accept=".pdf,.docx,.doc,.txt"
                        multiple
                        disabled={isUploading}
                    />
                </label>
            </div>
            )}

            {/* Documents Grid */}
            <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    {t('knowledge.uploaded_docs') || 'Tài liệu đã tải lên'}
                    <span className="px-2.5 py-0.5 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] rounded-full text-xs font-bold">{docs.length}</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {docs.map(doc => (
                        <div key={doc.id} className="bg-[var(--bg-surface)] p-5 rounded-[20px] border border-[var(--glass-border)] shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group relative flex flex-col h-full">
                            <div className="flex gap-3 sm:gap-4 items-start mb-4">
                                <div className="shrink-0 p-2 bg-[var(--glass-surface)] rounded-xl">
                                    {doc.type === 'PDF' ? ICONS.FILE_PDF : doc.type === 'DOCX' ? ICONS.FILE_DOC : ICONS.FILE_TXT}
                                </div>
                                <div className="flex-1 min-w-0 pt-1">
                                    <h3 className="font-bold text-[var(--text-primary)] text-sm line-clamp-2 leading-snug" title={doc.title}>{doc.title}</h3>
                                    <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--text-tertiary)] flex-wrap">
                                        {doc.sizeKb && <span className="font-mono bg-[var(--glass-surface-hover)] px-1.5 py-0.5 rounded">{doc.sizeKb} KB</span>}
                                        <span className="hidden sm:inline">•</span>
                                        <span>{formatDate(doc.createdAt)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-4 border-t border-[var(--glass-border)] flex items-center justify-between">
                                {doc.status === 'PROCESSING' ? (
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-xs3 font-bold text-amber-600 uppercase tracking-wider">{t('knowledge.status_processing') || 'Đang xử lý'}</span>
                                    </div>
                                ) : doc.status === 'INACTIVE' ? (
                                    <div className="flex items-center gap-1.5">
                                        <span className="inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                                        <span className="text-xs3 font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('knowledge.status_inactive') || 'Không hoạt động'}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        <span className="text-xs3 font-bold text-emerald-600 uppercase tracking-wider">{t('knowledge.status_indexed') || 'Đã học xong'}</span>
                                    </div>
                                )}
                                {canManage && (
                                    <button
                                        onClick={() => setConfirmDeleteId(doc.id)}
                                        className="p-1.5 text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                        title={t('knowledge.delete_doc') || 'Xóa tài liệu'}
                                    >
                                        {ICONS.TRASH}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {docs.length === 0 && !loading && (debouncedSearch || !canManage) && (
                    <div className="py-16 text-center bg-[var(--bg-surface)] rounded-[24px] border border-[var(--glass-border)] border-dashed">
                        <div className="w-16 h-16 bg-[var(--glass-surface)] rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--text-secondary)]">
                            {debouncedSearch ? ICONS.SEARCH : ICONS.CLOUD}
                        </div>
                        <h3 className="text-[var(--text-primary)] font-bold mb-1">
                            {debouncedSearch ? t('knowledge.empty_title') : t('knowledge.empty_title_no_docs')}
                        </h3>
                        <p className="text-[var(--text-tertiary)] text-sm">
                            {debouncedSearch ? t('knowledge.empty_search') : t('knowledge.empty_desc')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

