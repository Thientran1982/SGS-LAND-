
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../services/dbApi';
import { KnowledgeDocument } from '../types';
import { useTranslation } from '../services/i18n';

const ICONS = {
    UPLOAD: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
    SEARCH: <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    TRASH: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    FILE_PDF: <svg className="w-8 h-8 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M7 3a1 1 0 000 2h10a1 1 0 100-2H7zM5 7a1 1 0 000 2h14a1 1 0 100-2H5zM5 11a1 1 0 000 2h14a1 1 0 100-2H5zM5 15a1 1 0 000 2h14a1 1 0 100-2H5zM5 19a1 1 0 000 2h10a1 1 0 100-2H5z" /></svg>,
    FILE_DOC: <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4a2 2 0 012-2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>,
    FILE_TXT: <svg className="w-8 h-8 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4a2 2 0 012-2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>,
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
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const { t, formatDate } = useTranslation();

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await db.getDocuments();
            setDocs(data || []);
        } catch (e) { console.error(e); } 
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const processFile = async (file: File) => {
        // Validation
        const validTypes = ['.pdf', '.docx', '.doc', '.txt'];
        const isValidType = validTypes.some(type => file.name.toLowerCase().endsWith(type));
        if (!isValidType) {
            notify(t('knowledge.error_type') || 'Chỉ hỗ trợ định dạng PDF, DOCX, TXT', 'error');
            return;
        }

        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            notify(t('knowledge.error_size') || 'Kích thước file vượt quá 50MB', 'error');
            return;
        }

        setIsUploading(true);
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
                status: 'ACTIVE',
                fileUrl: uploaded.url,
                sizeKb: Math.round(file.size / 1024),
            });
            setDocs(prev => [doc, ...prev]);
            notify(t('knowledge.upload_success') || 'Tải lên thành công', 'success');
        } catch (error) {
            notify(t('common.error') || 'Đã xảy ra lỗi', 'error');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processFile(file);
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
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        
        await processFile(file);
    };

    const handleDelete = async (id: string) => {
        try {
            await db.deleteDocument(id);
            setDocs(prev => (prev || []).filter(d => d.id !== id));
            notify(t('knowledge.delete_success') || 'Xóa thành công', 'success');
            setConfirmDeleteId(null);
        } catch (error) {
            notify(t('common.error') || 'Đã xảy ra lỗi', 'error');
        }
    };

    const normalizedSearch = normalizeString(search);
    const filteredDocs = docs.filter(d => normalizeString(d.title).includes(normalizedSearch));

    if (loading) return <div className="p-10 text-center text-slate-400 font-mono animate-pulse">{t('common.loading') || 'Đang tải...'}</div>;

    return (
        <div className="space-y-6 pb-20 animate-enter relative max-w-6xl mx-auto px-4 md:px-0">
            {toast && <div className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-white' : 'bg-rose-900/90 border-rose-500 text-white'}`}><span className="font-bold text-sm">{toast.msg}</span></div>}

            {/* Delete Confirmation Modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-enter">
                    <div className="bg-white rounded-[24px] shadow-2xl max-w-sm w-full p-6 animate-enter-scale border border-slate-100">
                        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                            {ICONS.TRASH}
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">
                            {t('knowledge.confirm_delete') || 'Bạn có chắc chắn muốn xóa tài liệu này?'}
                        </h3>
                        <p className="text-slate-500 text-sm mb-6">
                            {t('knowledge.delete_warning') || 'Hành động này không thể hoàn tác. Tài liệu sẽ bị xóa khỏi hệ thống học của AI.'}
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                {t('common.cancel') || 'Hủy'}
                            </button>
                            <button 
                                onClick={() => handleDelete(confirmDeleteId)}
                                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-rose-600/20"
                            >
                                {t('common.delete') || 'Xóa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{t('knowledge.title') || 'Dữ liệu huấn luyện AI'}</h2>
                    <p className="text-sm text-slate-500 mt-1">{t('knowledge.subtitle') || 'Tải lên tài liệu để AI học và trả lời khách hàng chính xác hơn.'}</p>
                </div>
                <div className="w-full md:w-auto">
                    <div className="relative w-full md:w-72 group">
                        <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                            {ICONS.SEARCH}
                        </div>
                        <input 
                            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all outline-none placeholder:text-slate-400"
                            placeholder={t('knowledge.search_placeholder') || 'Tìm kiếm tài liệu...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <div className="absolute right-2 inset-y-0 flex items-center">
                                <button 
                                    onClick={() => setSearch('')}
                                    className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-200 flex items-center justify-center"
                                    title={t('knowledge.clear_search') || 'Xóa tìm kiếm'}
                                >
                                    {ICONS.X}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div 
                className={`relative overflow-hidden border-2 border-dashed rounded-[24px] p-10 text-center transition-all duration-300 ${
                    isDragging 
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                }`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <div className="flex flex-col items-center justify-center pointer-events-none">
                    {ICONS.CLOUD}
                    <h3 className="text-lg font-bold text-slate-800 mb-2">
                        {isDragging ? (t('knowledge.drop_here') || 'Thả file vào đây') : (t('knowledge.drag_drop') || 'Kéo thả tài liệu vào đây')}
                    </h3>
                    <p className="text-sm text-slate-500 mb-6 max-w-md">
                        {t('knowledge.upload_desc') || 'Hỗ trợ định dạng PDF, DOCX, TXT. Kích thước tối đa 50MB mỗi file. Dữ liệu sẽ được tự động vector hóa để AI học.'}
                    </p>
                </div>
                
                <label className={`relative z-10 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 cursor-pointer ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}>
                    {isUploading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        ICONS.UPLOAD
                    )}
                    {isUploading ? 'Đang xử lý...' : (t('knowledge.btn_upload') || 'Chọn file tải lên')}
                    <input 
                        type="file" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleUpload} 
                        accept=".pdf,.docx,.doc,.txt" 
                        disabled={isUploading}
                    />
                </label>
            </div>

            {/* Documents Grid */}
            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    {t('knowledge.uploaded_docs') || 'Tài liệu đã tải lên'}
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{filteredDocs.length}</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocs.map(doc => (
                        <div key={doc.id} className="bg-white p-5 rounded-[20px] border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group relative flex flex-col h-full">
                            <div className="flex gap-4 items-start mb-4">
                                <div className="shrink-0 p-2 bg-slate-50 rounded-xl">
                                    {doc.type === 'PDF' ? ICONS.FILE_PDF : doc.type === 'DOCX' ? ICONS.FILE_DOC : ICONS.FILE_TXT}
                                </div>
                                <div className="flex-1 min-w-0 pt-1">
                                    <h3 className="font-bold text-slate-800 text-sm line-clamp-2 leading-snug" title={doc.title}>{doc.title}</h3>
                                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{doc.sizeKb} KB</span>
                                        <span>•</span>
                                        <span>{formatDate(doc.createdAt)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">{t('knowledge.status_indexed') || 'Đã học xong'}</span>
                                </div>
                                <button 
                                    onClick={() => setConfirmDeleteId(doc.id)} 
                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Xóa tài liệu"
                                >
                                    {ICONS.TRASH}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                
                {filteredDocs.length === 0 && (
                    <div className="py-16 text-center bg-white rounded-[24px] border border-slate-100 border-dashed">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            {ICONS.SEARCH}
                        </div>
                        <h3 className="text-slate-800 font-bold mb-1">{t('knowledge.empty_title') || 'Không tìm thấy tài liệu'}</h3>
                        <p className="text-slate-500 text-sm">
                            {search ? (t('knowledge.empty_search') || 'Thử thay đổi từ khóa tìm kiếm') : (t('knowledge.empty_desc') || 'Chưa có tài liệu nào được tải lên')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

