
import React, { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { db } from '../services/dbApi';
import { Article, UserRole, User } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { copyToClipboard } from '../utils/clipboard';
import { useTranslation } from '../services/i18n';
import { injectArticleSEO, clearDynamicSEO } from '../utils/seo';

const sanitizeHtml = (html: string): string => DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
});

// -----------------------------------------------------------------------------
// TYPES & MOCK DATA (2026 CONTEXT)
// -----------------------------------------------------------------------------

const ICONS = {
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    CALENDAR: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    ARROW: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
    SHARE: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
    CLOCK: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    USER: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    SEND: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
    CHECK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    ERROR: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
};

// -----------------------------------------------------------------------------
// NEWS DETAIL COMPONENT
// -----------------------------------------------------------------------------

const ArticleDetail = ({ article, onBack, onEdit, onDelete, isAdmin }: { article: Article; onBack: () => void; onEdit?: (a: Article) => void; onDelete?: (id: string) => Promise<void>; isAdmin?: boolean }) => {
    const { t } = useTranslation();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
        injectArticleSEO({
            id: article.id,
            title: article.title,
            excerpt: article.excerpt,
            body: article.content,
            image: article.image,
            author: article.author,
            date: article.date,
            category: article.category,
        });
        return () => { clearDynamicSEO('news'); };
    }, [article]);

    const [shareFeedback, setShareFeedback] = useState<string | null>(null);

    const handleDelete = async () => {
        if (onDelete) {
            setIsDeleting(true);
            try {
                await onDelete(article.id);
            } catch {
                setIsDeleting(false);
            }
            setIsConfirmOpen(false);
        }
    };

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({ title: article.title, text: article.excerpt, url });
            } catch (err) {
                console.error('Share failed', err);
            }
        } else {
            const success = await copyToClipboard(url);
            setShareFeedback(success ? t('news.share_copied') : t('news.share_failed'));
            setTimeout(() => setShareFeedback(null), 2500);
        }
    };

    return (
        <div className="animate-enter pb-20">
            <ConfirmModal
                isOpen={isConfirmOpen}
                title={t('news.confirm_delete_title')}
                message={t('news.confirm_delete_message')}
                confirmLabel={t('common.delete')}
                cancelLabel={t('common.cancel')}
                onConfirm={handleDelete}
                onCancel={() => setIsConfirmOpen(false)}
                processing={isDeleting}
                variant="danger"
            />
            {/* Article Header */}
            <div className="max-w-4xl mx-auto px-6 pt-8">
                <div className="flex justify-between items-center mb-8">
                    <button 
                        onClick={onBack}
                        className="flex items-center gap-2 text-sm font-bold text-[var(--text-tertiary)] hover:text-indigo-600 transition-colors group"
                    >
                        <span className="p-2 bg-[var(--bg-surface)] rounded-full shadow-sm group-hover:shadow-md border border-[var(--glass-border)] transition-all group-hover:-translate-x-1">
                            {ICONS.BACK}
                        </span>
                        {t('news.back_to_list')}
                    </button>
                    {isAdmin && (
                        <div className="flex gap-2">
                            <button onClick={() => onEdit && onEdit(article)} className="px-4 py-2 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors">
                                {t('common.edit')}
                            </button>
                            <button onClick={() => setIsConfirmOpen(true)} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-sm font-bold hover:bg-rose-100 transition-colors">
                                {t('common.delete')}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-6 text-xs font-bold uppercase tracking-wider">
                    <span className="bg-indigo-600 text-white px-3 py-1 rounded-full shadow-md shadow-indigo-200">
                        {article.category}
                    </span>
                    <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                        {ICONS.CALENDAR} {article.date}
                    </span>
                    <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                        {ICONS.CLOCK} {article.readTime}
                    </span>
                </div>

                <h1 className="text-3xl md:text-5xl font-black text-[var(--text-primary)] mb-8 leading-tight break-words">
                    {article.title}
                </h1>

                <div className="flex items-center justify-between border-t border-b border-[var(--glass-border)] py-6 mb-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                            {article.author.charAt(0)}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-[var(--text-primary)]">{article.author}</div>
                            <div className="text-xs text-[var(--text-tertiary)]">{t('news.editorial_team')}</div>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        {shareFeedback && (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 animate-enter">
                                {shareFeedback}
                            </span>
                        )}
                        <button onClick={handleShare} className="p-2 rounded-full hover:bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] hover:text-indigo-600 transition-colors" title={t('common.copy_link')}>
                            {ICONS.SHARE}
                        </button>
                    </div>
                </div>
            </div>

            {/* Featured Image */}
            <div className="max-w-5xl mx-auto px-4 md:px-6 mb-12">
                <div className="aspect-video rounded-[32px] overflow-hidden shadow-2xl relative">
                    <img src={article.image} className="w-full h-full object-cover" alt={article.title} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                </div>
            </div>

            {/* Content Body */}
            <div className="max-w-3xl mx-auto px-6">
                <div className="prose prose-lg prose-slate prose-headings:font-bold prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-a:text-indigo-600 hover:prose-a:text-indigo-700 max-w-none">
                    <p className="lead font-medium text-xl text-[var(--text-primary)] mb-8 not-prose border-l-4 border-indigo-500 pl-4 bg-[var(--glass-surface)] py-2 rounded-r-lg">
                        {article.excerpt}
                    </p>
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content || '') }} />
                </div>

                {/* Media Gallery */}
                {(article.images?.length || article.videos?.length) ? (
                    <div className="mt-12 pt-8 border-t border-[var(--glass-border)]">
                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-6">{t('news.media_gallery')}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {article.images?.map((url, index) => (
                                <div key={`img-${index}`} className="aspect-video rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow cursor-pointer isolate transform-gpu [-webkit-mask-image:-webkit-radial-gradient(white,black)]">
                                    <img src={url} alt={`Gallery ${index}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                                </div>
                            ))}
                            {article.videos?.map((url, index) => (
                                <div key={`vid-${index}`} className="aspect-video rounded-2xl overflow-hidden shadow-md bg-slate-900">
                                    <video src={url} className="w-full h-full object-cover" controls preload="metadata" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {/* Tags */}
                <div className="mt-12 pt-8 border-t border-[var(--glass-border)]">
                    <div className="flex flex-wrap gap-2">
                        {article.tags.map(tag => (
                            <span key={tag} className="px-3 py-1.5 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] rounded-lg text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ArticleForm = ({ initialData, onSave, onCancel }: { initialData?: Article, onSave: (data: Partial<Article>) => void, onCancel: () => void }) => {
    const [formData, setFormData] = useState<Partial<Article>>(initialData || {
        title: '',
        excerpt: '',
        content: '',
        category: '',
        author: '',
        date: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' }),
        readTime: '5 phút',
        image: '',
        images: [],
        videos: [],
        featured: false,
        tags: []
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }));
    };

    const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
        setFormData(prev => ({ ...prev, tags }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_WIDTH = 800;
                            const MAX_HEIGHT = 800;
                            let width = img.width;
                            let height = img.height;

                            if (width > height) {
                                if (width > MAX_WIDTH) {
                                    height *= MAX_WIDTH / width;
                                    width = MAX_WIDTH;
                                }
                            } else {
                                if (height > MAX_HEIGHT) {
                                    width *= MAX_HEIGHT / height;
                                    height = MAX_HEIGHT;
                                }
                            }

                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0, width, height);
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

                            setFormData(prev => ({
                                ...prev,
                                images: [...(prev.images || []), dataUrl],
                                image: prev.image || dataUrl
                            }));
                        };
                        img.src = event.target?.result as string;
                    };
                    reader.readAsDataURL(file);
                } else if (file.type.startsWith('video/')) {
                    // For videos in mock DB, we just use a placeholder or the blob URL 
                    // (Note: blob URLs won't persist across reloads, but Base64 video is too large for localStorage)
                    const url = URL.createObjectURL(file);
                    setFormData(prev => ({
                        ...prev,
                        videos: [...(prev.videos || []), url]
                    }));
                }
            });
        }
    };

    const removeMedia = (type: 'image' | 'video', index: number) => {
        setFormData(prev => {
            if (type === 'image') {
                const newImages = [...(prev.images || [])];
                newImages.splice(index, 1);
                return { ...prev, images: newImages, image: newImages.length > 0 ? newImages[0] : prev.image };
            } else {
                const newVideos = [...(prev.videos || [])];
                newVideos.splice(index, 1);
                return { ...prev, videos: newVideos };
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-[var(--bg-surface)] p-8 rounded-2xl shadow-sm border border-[var(--glass-border)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">Tiêu đề</label>
                    <input type="text" name="title" value={formData.title} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">Tóm tắt (Excerpt)</label>
                    <textarea name="excerpt" value={formData.excerpt} onChange={handleChange} required rows={3} className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none" />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">Nội dung (HTML)</label>
                    <textarea name="content" value={formData.content} onChange={handleChange} required rows={10} className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">Chuyên mục</label>
                    <input type="text" name="category" value={formData.category} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">Tác giả</label>
                    <input type="text" name="author" value={formData.author} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">URL Hình ảnh chính</label>
                    <input type="text" name="image" value={formData.image} onChange={handleChange} placeholder="https://... hoặc tải ảnh lên ở trên" className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">Tags (cách nhau bằng dấu phẩy)</label>
                    <input type="text" value={formData.tags?.join(', ')} onChange={handleTagsChange} className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                </div>
                
                {/* Media Upload Section */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">Hình ảnh & Video đính kèm</label>
                    <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:border-indigo-500 transition-colors bg-[var(--glass-surface)]">
                        <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-[var(--text-secondary)]" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex text-sm text-[var(--text-secondary)] justify-center">
                                <label htmlFor="file-upload" className="relative cursor-pointer bg-[var(--bg-surface)] rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1 shadow-sm border border-[var(--glass-border)]">
                                    <span>Tải file lên</span>
                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple accept="image/*,video/*" onChange={handleFileChange} />
                                </label>
                                <p className="pl-1 py-1">hoặc kéo thả vào đây</p>
                            </div>
                            <p className="text-xs text-[var(--text-tertiary)]">PNG, JPG, GIF, MP4 lên đến 50MB</p>
                        </div>
                    </div>

                    {/* Media Preview */}
                    {(formData.images?.length || formData.videos?.length) ? (
                        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                            {formData.images?.map((url, index) => (
                                <div key={`img-${index}`} className="relative group rounded-xl overflow-hidden aspect-square border border-[var(--glass-border)]">
                                    <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                                    <button 
                                        type="button" 
                                        onClick={() => removeMedia('image', index)}
                                        className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-rose-600"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                            {formData.videos?.map((url, index) => (
                                <div key={`vid-${index}`} className="relative group rounded-xl overflow-hidden aspect-square border border-[var(--glass-border)] bg-slate-900">
                                    <video src={url} className="w-full h-full object-cover opacity-80" controls />
                                    <button 
                                        type="button" 
                                        onClick={() => removeMedia('video', index)}
                                        className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-rose-600 z-10"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>

                <div className="md:col-span-2 flex items-center gap-3">
                    <input type="checkbox" id="featured" name="featured" checked={formData.featured} onChange={handleChange} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                    <label htmlFor="featured" className="text-sm font-bold text-[var(--text-secondary)] cursor-pointer">Bài viết nổi bật</label>
                </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t border-[var(--glass-border)]">
                <button type="button" onClick={onCancel} className="px-6 py-3 rounded-xl font-bold text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] transition-colors">Hủy</button>
                <button type="submit" className="px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">Lưu bài viết</button>
            </div>
        </form>
    );
};

// -----------------------------------------------------------------------------
// MAIN NEWS COMPONENT (List View)
// -----------------------------------------------------------------------------

export const News: React.FC = () => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const [editingArticle, setEditingArticle] = useState<Article | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [email, setEmail] = useState('');
    const [subStatus, setSubStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [errorToast, setErrorToast] = useState<string | null>(null);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const PAGE_SIZE = 6; // Number of articles per page (excluding featured)
    const { t } = useTranslation();

    const showError = (msg: string) => {
        setErrorToast(msg);
        setTimeout(() => setErrorToast(null), 3000);
    };
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch articles from public endpoint (no auth required)
                const allRes = await db.getPublicArticles(1, 100);
                const allArticles = (allRes as any).data || [];
                const featuredArticle = allArticles.find((a: Article) => a.featured) || allArticles[0];
                
                // Filter out featured article for pagination
                const otherArticles = allArticles.filter((a: Article) => a.id !== featuredArticle?.id);
                
                // Calculate pagination
                const total = otherArticles.length;
                setTotalItems(total);
                setTotalPages(Math.ceil(total / PAGE_SIZE));
                
                // Slice for current page
                const startIndex = (currentPage - 1) * PAGE_SIZE;
                const paginatedOthers = otherArticles.slice(startIndex, startIndex + PAGE_SIZE);
                
                // Set articles: featured + paginated others
                if (featuredArticle && currentPage === 1) {
                    setArticles([featuredArticle, ...paginatedOthers]);
                } else {
                    setArticles(paginatedOthers);
                }
                
                const user = await db.getCurrentUser();
                setCurrentUser(user);
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [currentPage]);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;

    const handleSubscribe = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Basic Email Validation
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            setSubStatus('ERROR');
            setTimeout(() => setSubStatus('IDLE'), 2000);
            return;
        }

        setSubStatus('LOADING');

        // Simulate API Call
        setTimeout(() => {
            setSubStatus('SUCCESS');
            setEmail('');
            setTimeout(() => setSubStatus('IDLE'), 3000); // Reset for next
        }, 1500);
    };

    const handleSaveArticle = async (articleData: Partial<Article>) => {
        try {
            if (editingArticle) {
                const updated = await db.updateArticle(editingArticle.id, articleData);
                setArticles(articles.map(a => a.id === updated.id ? updated : a));
                setEditingArticle(null);
            } else {
                const created = await db.createArticle(articleData as Omit<Article, 'id'>);
                setArticles([created, ...articles]);
                setIsCreating(false);
            }
        } catch (error) {
            console.error("Failed to save article", error);
            showError("Có lỗi xảy ra khi lưu bài viết.");
        }
    };
    
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[var(--glass-surface)] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (isCreating || editingArticle) {
        return (
            <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
                <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                    <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                        <button onClick={() => { setIsCreating(false); setEditingArticle(null); }} className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors">
                            {ICONS.BACK} <span className="hidden md:inline">Hủy</span>
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-lg hidden sm:inline">{isCreating ? 'ĐĂNG TIN MỚI' : 'SỬA TIN TỨC'}</span>
                        </div>
                        <button onClick={handleLogin} className="px-4 md:px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-sm">
                            {currentUser ? 'Bảng Điều Khiển' : 'Đăng Nhập'}
                        </button>
                    </div>
                </div>
                <div className="max-w-4xl mx-auto px-6 py-12">
                    <ArticleForm 
                        initialData={editingArticle || undefined} 
                        onSave={handleSaveArticle} 
                        onCancel={() => { setIsCreating(false); setEditingArticle(null); }} 
                    />
                </div>
            </div>
        );
    }

    // Derived state
    const featured = articles.find(a => a.featured) || articles[0];
    const others = articles.filter(a => a.id !== featured?.id);

    // If an article is selected, render detail view
    if (selectedArticleId !== null) {
        const article = articles.find(a => a.id === selectedArticleId);
        if (article) {
            return (
                <div className="min-h-screen bg-[var(--bg-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
                    {/* Header reused */}
                    <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                        <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                            <button onClick={() => setSelectedArticleId(null)} className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors">
                                {ICONS.BACK} <span className="hidden md:inline">Quay lại</span>
                            </button>
                            <div className="flex items-center gap-2">
                                <Logo className="w-6 h-6 text-indigo-600" />
                                <span className="font-bold text-lg hidden sm:inline">TIN TỨC</span>
                            </div>
                            <button onClick={handleLogin} className="px-4 md:px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-sm">
                                {currentUser ? 'Bảng Điều Khiển' : 'Đăng Nhập'}
                            </button>
                        </div>
                    </div>
                    <ArticleDetail 
                        article={article} 
                        onBack={() => setSelectedArticleId(null)} 
                        isAdmin={currentUser?.role === UserRole.ADMIN}
                        onEdit={(a) => {
                            setEditingArticle(a);
                            setSelectedArticleId(null);
                        }}
                        onDelete={async (id) => {
                            try {
                                await db.deleteArticle(id);
                                setArticles(prev => prev.filter(a => a.id !== id));
                                setSelectedArticleId(null);
                            } catch (error) {
                                console.error('Failed to delete article', error);
                                showError('Có lỗi xảy ra khi xóa bài viết.');
                            }
                        }}
                    />
                </div>
            );
        }
    }

    // Default: List View
    return (
        <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
            {errorToast && (
                <div className="fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl bg-rose-900/90 border border-rose-500 text-white flex items-center gap-3 animate-enter">
                    <span className="font-bold text-sm">{errorToast}</span>
                </div>
            )}
            
            {/* Header */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                    <button onClick={handleHome} className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors">
                        {ICONS.BACK} <span className="hidden md:inline">Trang Chủ</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <Logo className="w-6 h-6 text-indigo-600" />
                        <span className="font-bold text-lg hidden sm:inline">TIN TỨC SGS</span>
                    </div>
                    <button onClick={handleLogin} className="px-4 md:px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-sm">
                        {currentUser ? 'Bảng Điều Khiển' : 'Đăng Nhập'}
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-12 animate-enter">
                <div className="text-center mb-16 relative">
                    <span className="inline-block py-1 px-3 rounded-full bg-slate-900 text-white text-xs2 font-bold uppercase tracking-widest mb-4">
                        {t('news.year_badge')}
                    </span>
                    <h1 className="text-3xl md:text-6xl font-black text-[var(--text-primary)] mb-6 tracking-tight">
                        Tương Lai Bất Động Sản
                    </h1>
                    <p className="text-[var(--text-tertiary)] text-lg max-w-2xl mx-auto">
                        Thông tin thị trường, xu hướng công nghệ PropTech và phân tích dữ liệu AI độc quyền từ SGS Land.
                    </p>
                    {currentUser?.role === UserRole.ADMIN && (
                        <div className="mt-8 flex justify-center md:absolute md:top-0 md:right-0 md:mt-0">
                            <button 
                                onClick={() => setIsCreating(true)}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Đăng tin mới
                            </button>
                        </div>
                    )}
                </div>

                {/* Featured Article */}
                {featured && (
                    <div 
                        onClick={() => setSelectedArticleId(featured.id)}
                        className="mb-16 group cursor-pointer relative rounded-3xl md:rounded-[40px] overflow-hidden shadow-2xl min-h-[420px] md:min-h-0 md:aspect-[21/9] flex flex-col justify-end transform transition-transform hover:scale-[1.01] isolate transform-gpu [-webkit-mask-image:-webkit-radial-gradient(white,black)]"
                    >
                        <img src={featured.image} className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt={featured.title} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                        <div className="absolute top-6 left-6 md:top-10 md:left-10 z-10">
                             <span className="inline-block px-4 py-1.5 rounded-xl bg-[var(--bg-surface)]/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold uppercase tracking-wider shadow-lg">
                                Nổi Bật
                            </span>
                        </div>
                        <div className="relative z-10 p-6 md:p-16 max-w-4xl mt-auto">
                            <span className="inline-block text-indigo-300 font-bold mb-2 md:mb-3 uppercase text-xs tracking-widest">
                                {featured.category}
                            </span>
                            <h2 className="text-2xl md:text-5xl font-bold text-white mb-3 md:mb-6 leading-tight group-hover:text-indigo-200 transition-colors line-clamp-none break-words">
                                {featured.title}
                            </h2>
                            <p className="text-white/90 text-sm md:text-lg mb-6 md:mb-8 line-clamp-3 md:line-clamp-none max-w-3xl leading-relaxed">
                                {featured.excerpt}
                            </p>
                            <div className="flex items-center gap-4 md:gap-6 text-white/70 text-xs2 md:text-xs font-bold uppercase tracking-widest">
                                <span className="flex items-center gap-2">{ICONS.CALENDAR} {featured.date}</span>
                                <span className="w-1 h-1 bg-[var(--bg-surface)]/50 rounded-full"></span>
                                <span>{featured.readTime} đọc</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Grid Articles */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                    {others.map(article => (
                        <div 
                            key={article.id} 
                            onClick={() => setSelectedArticleId(article.id)}
                            className="bg-[var(--bg-surface)] rounded-2xl md:rounded-[32px] border border-[var(--glass-border)] overflow-hidden hover:shadow-2xl transition-all duration-300 group cursor-pointer hover:-translate-y-2 flex flex-col h-full isolate transform-gpu [-webkit-mask-image:-webkit-radial-gradient(white,black)]"
                        >
                            <div className="aspect-[4/3] overflow-hidden relative isolate transform-gpu [-webkit-mask-image:-webkit-radial-gradient(white,black)]">
                                <img src={article.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={article.title} />
                                <div className="absolute top-4 left-4">
                                    <span className="px-3 py-1 bg-[var(--bg-surface)]/90 backdrop-blur-sm text-[var(--text-primary)] text-xs2 font-bold rounded-lg shadow-sm">
                                        {article.category}
                                    </span>
                                </div>
                            </div>
                            <div className="p-8 flex flex-col flex-1">
                                <div className="text-xs2 font-bold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                                    {article.date} <span className="w-1 h-1 bg-slate-300 rounded-full"></span> {article.readTime}
                                </div>
                                <h3 className="font-bold text-xl text-[var(--text-primary)] mb-4 line-clamp-3 group-hover:text-indigo-600 transition-colors leading-snug">
                                    {article.title}
                                </h3>
                                <p className="text-sm text-[var(--text-tertiary)] leading-relaxed line-clamp-3 mb-6 flex-1">
                                    {article.excerpt}
                                </p>
                                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] group-hover:text-indigo-600 transition-all mt-auto">
                                    Đọc chi tiết {ICONS.ARROW}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mb-24 flex-wrap">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        
                        <div className="flex items-center gap-1 flex-wrap justify-center">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-10 h-10 sm:w-8 sm:h-8 rounded-xl text-sm font-bold transition-colors ${
                                        currentPage === page 
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]'
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>

                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                )}

                {/* Newsletter (Enhanced) */}
                <div className="bg-slate-900 rounded-[40px] p-8 md:p-20 text-center relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600 rounded-full blur-[150px] opacity-20 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600 rounded-full blur-[150px] opacity-20 pointer-events-none"></div>
                    
                    <div className="relative z-10 max-w-xl mx-auto">
                        <div className="w-16 h-16 bg-[var(--bg-surface)]/10 rounded-2xl flex items-center justify-center mx-auto mb-8 backdrop-blur-sm text-white">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Đừng bỏ lỡ xu hướng 2026</h2>
                        <p className="text-indigo-200 mb-10 text-lg leading-relaxed">
                            Nhận bản tin phân tích độc quyền hàng tuần từ đội ngũ chuyên gia SGS Land. Không spam, chỉ có giá trị thực.
                        </p>
                        
                        <form onSubmit={handleSubscribe} className={`flex flex-col sm:flex-row gap-3 ${subStatus === 'ERROR' ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
                            <div className="relative flex-1">
                                <input 
                                    className={`w-full px-6 py-4 rounded-2xl bg-white border text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 
                                        ${subStatus === 'ERROR' ? 'border-rose-500 focus:border-rose-500' : 'border-white/20'}
                                    `}
                                    placeholder="Nhập email của bạn..."
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    disabled={subStatus === 'LOADING' || subStatus === 'SUCCESS'}
                                    type="email"
                                    required
                                />
                                {subStatus === 'ERROR' && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500">
                                        {ICONS.ERROR}
                                    </div>
                                )}
                            </div>
                            
                            <button 
                                type="submit"
                                disabled={subStatus === 'LOADING' || subStatus === 'SUCCESS'}
                                className={`px-8 py-4 font-bold rounded-2xl transition-all whitespace-nowrap shadow-lg flex items-center justify-center gap-2 min-w-[160px]
                                    ${subStatus === 'SUCCESS' 
                                        ? 'bg-emerald-500 text-white cursor-default' 
                                        : 'bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-indigo-50 active:scale-95'}
                                `}
                            >
                                {subStatus === 'LOADING' ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin"></div>
                                        <span>Đang xử lý</span>
                                    </>
                                ) : subStatus === 'SUCCESS' ? (
                                    <>
                                        {ICONS.CHECK}
                                        <span>Đã đăng ký!</span>
                                    </>
                                ) : (
                                    <>
                                        {ICONS.SEND}
                                        <span>Đăng Ký Ngay</span>
                                    </>
                                )}
                            </button>
                        </form>
                        
                        {subStatus === 'ERROR' && (
                            <p className="text-rose-400 text-xs font-bold mt-3 animate-enter text-left pl-4">
                                Email không hợp lệ. Vui lòng kiểm tra lại.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
