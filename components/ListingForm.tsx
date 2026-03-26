
import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Listing, PropertyType, ListingStatus, TransactionType } from '../types';
import { db } from '../services/dbApi'; // Import DB to fetch projects
import { Dropdown } from './Dropdown';
import { VN_PHONE_REGEX } from '../types'; // Reuse regex from types/constants if available, or define locally
import { useTranslation } from '../services/i18n';
import { buildVNGeoQueries } from '../utils/vnAddress';

interface ListingFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<Listing>) => Promise<void>;
    initialData?: Listing;
    t: any;
    isProjectUnit?: boolean;
}

const ICONS = {
    CLOSE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    IMAGE_ADD: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    DELETE: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    VERIFIED: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M11.379 1.665a3 3 0 00-3.14.318 3.001 3.001 0 00-2.117 2.376 3 3 0 00-2.827 1.398 3 3 0 00-.884 3.056A3.001 3.001 0 002 11.25a3 3 0 00.411 2.439 3 3 0 00.884 3.055 3.001 3.001 0 002.827 1.398 3 3 0 002.117 2.376 3 3 0 003.14.318 3 3 0 003.242 0 3 3 0 003.14-.318 3.001 3.001 0 002.117-2.376 3 3 0 002.827-1.398 3 3 0 00.884-3.056A3.001 3.001 0 0022 11.25a3 3 0 00-.411-2.439 3 3 0 00-.884-3.055 3.001 3.001 0 00-2.827-1.398 3 3 0 00-2.117-2.376 3 3 0 00-3.14-.318 3 3 0 00-3.242 0zM9.53 13.03a.75.75 0 001.06 1.06l4.25-4.25a.75.75 0 00-1.06-1.06L10.06 12.5 8.47 10.91a.75.75 0 00-1.06 1.06l2.12 2.12z" clipRule="evenodd" /></svg>
};

// Pricing Units
const getUnits = (t: any) => ({
    BILLION: { value: 1_000_000_000, label: t('format.billion') },
    MILLION: { value: 1_000_000, label: t('format.million') },
    ONE: { value: 1, label: 'VND' }
});

export const ListingForm: React.FC<ListingFormProps> = memo(({ isOpen, onClose, onSubmit, initialData, t, isProjectUnit = false }) => {
    const { formatCurrency } = useTranslation();
    // Default State
    const defaultState: Partial<Listing> = {
        code: '',
        title: '',
        location: '',
        price: 0,
        area: 0,
        bedrooms: 0,
        bathrooms: 0,
        type: PropertyType.APARTMENT,
        status: ListingStatus.AVAILABLE,
        transaction: TransactionType.SALE,
        projectCode: '',
        attributes: { direction: 'North', legalStatus: 'PinkBook', furniture: 'BASIC', roadWidth: 0 },
        images: [],
        isVerified: false,
        contactPhone: '',
        ownerName: '',
        ownerPhone: '',
        commission: 0,
        commissionUnit: 'PERCENT'
    };

    const UNITS = useMemo(() => getUnits(t), [t]);

    const [formData, setFormData] = useState<Partial<Listing>>(defaultState);
    const [images, setImages] = useState<string[]>([]);
    const [projects, setProjects] = useState<{value: string, label: string}[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [uploadError, setUploadError] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeMsg, setGeocodeMsg] = useState<string>('');

    // Split Price State for UX
    const [priceShort, setPriceShort] = useState<string>('');
    const [priceUnit, setPriceUnit] = useState<number>(UNITS.BILLION.value);

    // Shared geocoding helper — returns { lat, lng } or null.
    // Uses buildVNGeoQueries which:
    //   • Restores diacritics for HCMC district/ward names typed without dấu
    //   • Tries original + normalised address × 4 city suffixes
    //   • Constrains results to HCMC via viewbox + bounded=1
    const geocodeAddress = async (addr: string): Promise<{ lat: number; lng: number } | null> => {
        const HCMC_VIEWBOX = '106.40,10.60,107.00,11.20';
        const queries = buildVNGeoQueries(addr);
        for (let i = 0; i < queries.length; i++) {
            if (i > 0) await new Promise(r => setTimeout(r, 1100));
            try {
                const q = encodeURIComponent(queries[i]);
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=vn&viewbox=${HCMC_VIEWBOX}&bounded=1`,
                    { headers: { 'Accept-Language': 'vi,en', 'User-Agent': 'SGSLand/1.0' } }
                );
                const data = await res.json();
                if (data.length > 0) {
                    return {
                        lat: parseFloat(parseFloat(data[0].lat).toFixed(6)),
                        lng: parseFloat(parseFloat(data[0].lon).toFixed(6)),
                    };
                }
            } catch { /* try next query */ }
        }
        return null;
    };

    const autoGeocode = async () => {
        const addr = formData.location?.trim();
        if (!addr) { setGeocodeMsg(t('inventory.geocode_no_addr') || 'Vui lòng nhập địa chỉ trước'); return; }
        setGeocoding(true);
        setGeocodeMsg('');
        const result = await geocodeAddress(addr);
        if (result) {
            setFormData(prev => ({ ...prev, coordinates: result }));
            setGeocodeMsg(`✓ ${result.lat}, ${result.lng}`);
        } else {
            setGeocodeMsg(t('inventory.geocode_not_found') || 'Không tìm thấy toạ độ — thử nhập địa chỉ đầy đủ hơn');
        }
        setGeocoding(false);
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Escape key + body scroll lock
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isSubmitting) onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, isSubmitting, onClose]);

    // Initialization & Data Conversion
    useEffect(() => {
        if (isOpen) {
            setErrors({});
            // Load Projects for Dropdown from the Projects API
            db.getProjects(1, 200).then(res => {
                const projectList = (res.data || [])
                    .filter((p: any) => p.status !== 'SUSPENDED')
                    .map((p: any) => ({
                        value: p.code || p.id,
                        label: p.name + (p.code ? ` (${p.code})` : '') + (p.location ? ` — ${p.location}` : '')
                    }));
                setProjects(projectList);
            }).catch(() => setProjects([]));

            if (initialData && initialData.id) {
                setFormData(JSON.parse(JSON.stringify(initialData)));
                setImages(initialData.images || []);
                
                // Smart Price Reverse Logic
                const val = initialData.price || 0;
                if (val >= 1_000_000_000) {
                    setPriceShort((val / 1_000_000_000).toString());
                    setPriceUnit(UNITS.BILLION.value);
                } else if (val >= 1_000_000) {
                    setPriceShort((val / 1_000_000).toString());
                    setPriceUnit(UNITS.MILLION.value);
                } else {
                    setPriceShort(val.toString());
                    setPriceUnit(UNITS.ONE.value);
                }
            } else {
                // Initialize for NEW listing
                const initNew = async () => {
                    // Fetch current user to pre-fill contact phone
                    const user = await db.getCurrentUser();
                    
                    setFormData({
                        ...defaultState,
                        ...initialData,
                        code: `LST${Date.now().toString().slice(-6)}`,
                        attributes: { ...defaultState.attributes, ...(initialData?.attributes || {}) },
                        contactPhone: user?.phone || '' // Pre-fill
                    });
                    setImages([]);
                    setPriceShort('');
                    setPriceUnit(UNITS.BILLION.value); 
                };
                initNew();
            }
        }
    }, [isOpen, initialData]);

    const uploadImageFiles = async (files: File[]) => {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        setUploadError('');

        if (images.length + imageFiles.length > 10) {
            setUploadError(t('inventory.max_images'));
            return;
        }

        const MAX_SIZE = 10 * 1024 * 1024;
        const oversized = imageFiles.find(f => f.size > MAX_SIZE);
        if (oversized) {
            setUploadError(t('profile.error_file_size'));
            return;
        }

        setIsUploading(true);
        try {
            const result = await db.uploadFiles(imageFiles);
            const urls = result.files.map(f => f.url);
            setImages(prev => [...prev, ...urls]);
        } catch (err: any) {
            setUploadError(err.message || t('common.error'));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await uploadImageFiles(Array.from(e.target.files));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files) as File[];
            await uploadImageFiles(droppedFiles);
        }
    };

    const handleImageReorder = (fromIdx: number, toIdx: number) => {
        setImages(prev => {
            const updated = [...prev];
            const [moved] = updated.splice(fromIdx, 1);
            updated.splice(toIdx, 0, moved);
            return updated;
        });
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const updateAttribute = (key: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            attributes: { ...prev.attributes, [key]: value }
        }));
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.title?.trim()) newErrors.title = t('validation.title_required');
        if (!isProjectUnit && !formData.location?.trim()) newErrors.location = t('validation.location_required');
        
        // Price Validation based on calculated value
        const calculatedPrice = parseFloat(priceShort) * priceUnit;
        if (!priceShort || isNaN(calculatedPrice) || calculatedPrice <= 0) newErrors.price = t('validation.price_invalid');
        
        if (!formData.area || formData.area <= 0) newErrors.area = t('validation.area_invalid');
        
        // Contact Phone Validation — skip for project units (inherited from parent)
        if (!isProjectUnit) {
            if (!formData.contactPhone?.trim()) {
                newErrors.contactPhone = t('validation.required');
            } else if (!VN_PHONE_REGEX.test(formData.contactPhone)) {
                newErrors.contactPhone = t('validation.phone_invalid');
            }
        }

        // Owner Phone Validation (optional field — only validate if filled)
        if (!isProjectUnit && formData.ownerPhone?.trim() && !VN_PHONE_REGEX.test(formData.ownerPhone)) {
            newErrors.ownerPhone = t('validation.owner_phone_invalid');
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setIsSubmitting(true);

        // Calculate final raw price for DB
        const finalPrice = parseFloat(priceShort) * priceUnit;

        // Auto-geocode if coordinates are missing — this ensures every listing
        // is stored with real coordinates so the map pin is always accurate.
        let coordinates = formData.coordinates;
        const hasCoords = coordinates?.lat != null && coordinates?.lng != null &&
            (coordinates.lat !== 0 || coordinates.lng !== 0);

        if (!hasCoords && formData.location?.trim()) {
            setGeocodeMsg('Đang tự động lấy toạ độ...');
            const result = await geocodeAddress(formData.location.trim());
            if (result) {
                coordinates = result;
                setFormData(prev => ({ ...prev, coordinates: result }));
                setGeocodeMsg(`✓ ${result.lat}, ${result.lng}`);
            } else {
                setGeocodeMsg('');
            }
        }

        try {
            await onSubmit({
                ...formData,
                price: finalPrice,
                images,
                coordinates,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- OPTIONS MEMOIZATION ---
    const directionOptions = useMemo(() => [
        { value: 'North', label: t('direction.North') },
        { value: 'South', label: t('direction.South') },
        { value: 'East', label: t('direction.East') },
        { value: 'West', label: t('direction.West') },
        { value: 'NorthEast', label: t('direction.NorthEast') },
        { value: 'NorthWest', label: t('direction.NorthWest') },
        { value: 'SouthEast', label: t('direction.SouthEast') },
        { value: 'SouthWest', label: t('direction.SouthWest') },
    ], [t]);

    const legalOptions = useMemo(() => [
        { value: 'PinkBook', label: t('legal.PinkBook') },
        { value: 'Contract', label: t('legal.Contract') },
        { value: 'Waiting', label: t('legal.Waiting') },
    ], [t]);

    const landTypeOptions = useMemo(() => ['ONT', 'ODT', 'CLN', 'LUK', 'SKK', 'TMD'].map(type => ({ value: type, label: type })), []);
    const typeOptions = useMemo(() => Object.values(PropertyType)
        .filter(tKey => !isProjectUnit || tKey !== PropertyType.PROJECT)
        .map(tKey => ({ value: tKey, label: t(`property.${tKey.toUpperCase()}`) })), [t, isProjectUnit]);
    const statusOptions = useMemo(() => Object.values(ListingStatus).map(s => ({ value: s, label: t(`status.${s}`) })), [t]);
    const transactionOptions = useMemo(() => Object.values(TransactionType).map(tr => ({ value: tr, label: t(`transaction.${tr}`) })), [t]);
    const priceUnitOptions = useMemo(() => Object.values(UNITS).map(u => ({ value: u.value, label: u.label })), [UNITS]);

    const commissionUnitOptions = useMemo(() => [
        { value: 'PERCENT', label: '%' },
        { value: 'FIXED', label: 'VND' }
    ], []);

    const furnitureOptions = useMemo(() => [
        { value: 'FULL', label: t('furniture.FULL') },
        { value: 'BASIC', label: t('furniture.BASIC') },
        { value: 'NONE', label: t('furniture.NONE') },
    ], [t]);

    // --- DYNAMIC FIELDS LOGIC ---
    const isProject = formData.type === PropertyType.PROJECT;
    const isLand = [PropertyType.LAND, PropertyType.FACTORY, PropertyType.COMMERCIAL, PropertyType.TOWNHOUSE, PropertyType.VILLA].includes(formData.type as PropertyType);

    const renderDynamicFields = () => {
        if (isProject) {
            return (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_developer')}</label>
                        <input value={formData.attributes?.developer || ''} onChange={e => updateAttribute('developer', e.target.value)} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_total_units')}</label>
                        <input type="number" value={formData.totalUnits || ''} onChange={e => setFormData({...formData, totalUnits: Number(e.target.value)})} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_handover')}</label>
                        <input value={formData.attributes?.handoverYear || ''} onChange={e => updateAttribute('handoverYear', e.target.value)} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" placeholder="YYYY" />
                    </div>
                    <div>
                        <Dropdown
                            label={t('inventory.label_legal')}
                            value={(formData.attributes?.legalStatus as string) || ''}
                            onChange={v => updateAttribute('legalStatus', v)}
                            options={legalOptions}
                        />
                    </div>
                </div>
            );
        }
        
        if (isLand) {
            return (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_frontage')} (m)</label>
                        <input type="number" value={(formData.attributes?.frontage as number) || ''} onChange={e => updateAttribute('frontage', Number(e.target.value))} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_road_width')} (m)</label>
                        <input type="number" value={(formData.attributes?.roadWidth as number) || ''} onChange={e => updateAttribute('roadWidth', Number(e.target.value))} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                        <Dropdown
                            label={t('inventory.label_land_type')}
                            value={(formData.attributes?.landType as string) || 'ODT'}
                            onChange={v => updateAttribute('landType', v)}
                            options={landTypeOptions}
                        />
                    </div>
                    <div>
                        <Dropdown
                            label={t('inventory.label_direction')}
                            value={(formData.attributes?.direction as string) || ''}
                            onChange={v => updateAttribute('direction', v)}
                            options={directionOptions}
                        />
                    </div>
                    <div className="col-span-2">
                        <Dropdown
                            label={t('inventory.label_legal')}
                            value={(formData.attributes?.legalStatus as string) || ''}
                            onChange={v => updateAttribute('legalStatus', v)}
                            options={legalOptions}
                        />
                    </div>
                </div>
            );
        }

        // Default: Apartment
        return (
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_bed')}</label>
                    <input type="number" value={formData.bedrooms ?? ''} onChange={e => setFormData({...formData, bedrooms: Number(e.target.value)})} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div>
                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_bath')}</label>
                    <input type="number" value={formData.bathrooms ?? ''} onChange={e => setFormData({...formData, bathrooms: Number(e.target.value)})} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div>
                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_floors')}</label>
                    <input type="number" value={formData.attributes?.floor ?? ''} onChange={e => updateAttribute('floor', Number(e.target.value))} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div className="col-span-1">
                    <Dropdown
                        label={t('inventory.label_direction')}
                        value={(formData.attributes?.direction as string) || ''}
                        onChange={v => updateAttribute('direction', v)}
                        options={directionOptions}
                    />
                </div>
                <div className="col-span-1">
                    <Dropdown
                        label={t('inventory.label_furniture')}
                        value={(formData.attributes?.furniture as string) || 'BASIC'}
                        onChange={v => updateAttribute('furniture', v)}
                        options={furnitureOptions}
                    />
                </div>
                <div className="col-span-1">
                    <Dropdown
                        label={t('inventory.label_legal')}
                        value={(formData.attributes?.legalStatus as string) || ''}
                        onChange={v => updateAttribute('legalStatus', v)}
                        options={legalOptions}
                    />
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="listing-form-title">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={!isSubmitting ? onClose : undefined} />
            <div className="bg-[var(--bg-surface)] w-full max-w-4xl rounded-[24px] shadow-2xl flex flex-col h-[90vh] md:h-auto md:max-h-[90vh] relative z-10 animate-scale-up overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--bg-surface)] shrink-0">
                    <h3 id="listing-form-title" className="text-xl font-bold text-[var(--text-primary)]">
                        {initialData && initialData.id ? t('inventory.edit_title') : t('inventory.create_title')}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--glass-surface-hover)] rounded-full text-[var(--text-secondary)] transition-colors">
                        {ICONS.CLOSE}
                    </button>
                </div>
                
                {/* Scroll Container: Added no-scrollbar */}
                <div className="flex-1 overflow-y-auto p-6 bg-[var(--glass-surface)]/50 overscroll-contain no-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm space-y-4">
                                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{t('inventory.section_general')}</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {!isProject && (
                                        <div>
                                            <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_code')}</label>
                                            <input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm font-mono bg-[var(--glass-surface)] focus:bg-[var(--bg-surface)] focus:border-indigo-500 outline-none" />
                                        </div>
                                    )}
                                    {!isProject && !isProjectUnit && (
                                        <div>
                                            <Dropdown
                                                label={t('inventory.label_project')}
                                                value={formData.projectCode || ''}
                                                onChange={v => setFormData({...formData, projectCode: v as string})}
                                                options={[{ value: '', label: t('inventory.project_none') }, ...projects]}
                                                placeholder={t('inventory.project_select')}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_title')} <span className="text-rose-500">*</span></label>
                                    <input 
                                        value={formData.title || ''} 
                                        onChange={e => setFormData({...formData, title: e.target.value})} 
                                        className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none ${errors.title ? 'border-rose-300 bg-rose-50' : 'border-[var(--glass-border)]'}`} 
                                        placeholder={isProject ? t('inventory.placeholder_title_project') : t('inventory.placeholder_title_unit')} 
                                    />
                                    {errors.title && <p className="text-xs2 text-rose-500 mt-1">{errors.title}</p>}
                                </div>
                                
                                {/* CONTACT PHONE — hidden for project units */}
                                {!isProjectUnit && (
                                <div>
                                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">
                                        {t('leads.phone')} <span className="text-rose-500">*</span>
                                    </label>
                                    <input 
                                        value={formData.contactPhone || ''} 
                                        onChange={e => setFormData({...formData, contactPhone: e.target.value})} 
                                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none font-mono ${errors.contactPhone ? 'border-rose-300 bg-rose-50' : 'border-[var(--glass-border)]'}`} 
                                        placeholder="0912..." 
                                    />
                                    {errors.contactPhone && <p className="text-xs2 text-rose-500 mt-1">{errors.contactPhone}</p>}
                                </div>
                                )}

                                {/* CONSIGNMENT INFO (OWNER & COMMISSION) — hidden for project units */}
                                {!isProjectUnit && (
                                <div className="p-4 bg-[var(--glass-surface)] rounded-xl border border-[var(--glass-border)] space-y-4">
                                    <h5 className="text-xs2 font-black text-[var(--text-secondary)] uppercase tracking-widest">{t('inventory.section_consignment')}</h5>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_owner_name')}</label>
                                            <input 
                                                value={formData.ownerName || ''} 
                                                onChange={e => setFormData({...formData, ownerName: e.target.value})} 
                                                className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-[var(--bg-surface)]" 
                                                placeholder={t('common.placeholder_fullname')}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_owner_phone')}</label>
                                            <input 
                                                value={formData.ownerPhone || ''} 
                                                onChange={e => setFormData({...formData, ownerPhone: e.target.value})} 
                                                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-[var(--bg-surface)] font-mono ${errors.ownerPhone ? 'border-rose-300 bg-rose-50' : 'border-[var(--glass-border)]'}`}
                                                placeholder="09..."
                                            />
                                            {errors.ownerPhone && <p className="text-xs2 text-rose-500 mt-1">{errors.ownerPhone}</p>}
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_commission')}</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="number"
                                                    value={formData.commission || ''} 
                                                    onChange={e => setFormData({...formData, commission: Number(e.target.value)})} 
                                                    className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-[var(--bg-surface)] font-bold" 
                                                    placeholder={formData.commissionUnit === 'FIXED' ? '50000000' : '1.5'}
                                                />
                                                <div className="w-24 shrink-0">
                                                    <Dropdown
                                                        value={formData.commissionUnit || 'PERCENT'}
                                                        onChange={v => setFormData({...formData, commissionUnit: v as any})}
                                                        options={commissionUnitOptions}
                                                        className="w-full"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                )}

                                {/* LOCATION + COORDINATES — hidden for project units (inherited from parent) */}
                                {!isProjectUnit && (
                                <div>
                                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_location')} <span className="text-rose-500">*</span></label>
                                    <input 
                                        value={formData.location || ''} 
                                        onChange={e => setFormData({...formData, location: e.target.value})} 
                                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none ${errors.location ? 'border-rose-300 bg-rose-50' : 'border-[var(--glass-border)]'}`} 
                                        placeholder={t('inventory.placeholder_addr')} 
                                    />
                                    {errors.location && <p className="text-xs2 text-rose-500 mt-1">{errors.location}</p>}
                                </div>
                                )}
                                {!isProjectUnit && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_lat')}</label>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            value={formData.coordinates?.lat ?? ''}
                                            onChange={e => {
                                                const lat = parseFloat(e.target.value);
                                                setFormData({ ...formData, coordinates: { lat: isNaN(lat) ? 0 : lat, lng: formData.coordinates?.lng ?? 0 } });
                                            }}
                                            className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm font-mono focus:border-indigo-500 outline-none"
                                            placeholder="10.776900"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_lng')}</label>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            value={formData.coordinates?.lng ?? ''}
                                            onChange={e => {
                                                const lng = parseFloat(e.target.value);
                                                setFormData({ ...formData, coordinates: { lat: formData.coordinates?.lat ?? 0, lng: isNaN(lng) ? 0 : lng } });
                                            }}
                                            className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm font-mono focus:border-indigo-500 outline-none"
                                            placeholder="106.700900"
                                        />
                                    </div>
                                    <div className="col-span-2 flex flex-col gap-1 -mt-1">
                                        <button
                                            type="button"
                                            onClick={autoGeocode}
                                            disabled={geocoding || !formData.location?.trim()}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-fit"
                                        >
                                            {geocoding ? (
                                                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/></svg>
                                            ) : (
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                            )}
                                            {geocoding ? (t('inventory.geocoding') || 'Đang tìm toạ độ...') : (t('inventory.auto_geocode') || 'Lấy toạ độ từ địa chỉ')}
                                        </button>
                                        {geocodeMsg && (
                                            <p className={`text-xs2 ${geocodeMsg.startsWith('✓') ? 'text-emerald-600 font-semibold' : 'text-amber-600'}`}>{geocodeMsg}</p>
                                        )}
                                        <p className="text-xs2 text-[var(--text-secondary)]">{t('inventory.coordinates_hint')}</p>
                                    </div>
                                </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Smart Price Input */}
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">
                                            {isProject ? t('inventory.min_price') : t('inventory.label_price')} <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="number"
                                                step="0.1"
                                                value={priceShort} 
                                                onChange={e => setPriceShort(e.target.value)} 
                                                className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] focus:border-indigo-500 outline-none ${errors.price ? 'border-rose-300 bg-rose-50' : 'border-[var(--glass-border)]'}`} 
                                                placeholder="5.5"
                                            />
                                            <div className="w-24 shrink-0">
                                                <Dropdown
                                                    value={priceUnit}
                                                    onChange={v => setPriceUnit(Number(v))}
                                                    options={priceUnitOptions}
                                                    className="w-full"
                                                />
                                            </div>
                                        </div>
                                        {/* Real-time Raw Value Preview */}
                                        {errors.price && <p className="text-xs2 text-rose-500 mt-1">{errors.price}</p>}
                                        <div className="text-xs2 text-[var(--text-secondary)] font-mono mt-1 text-right truncate">
                                            = {formatCurrency((isNaN(parseFloat(priceShort)) ? 0 : parseFloat(priceShort)) * priceUnit)}
                                        </div>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_area')} <span className="text-rose-500">*</span></label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                value={formData.area ?? ''} 
                                                onChange={e => setFormData({...formData, area: Number(e.target.value)})} 
                                                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none pr-8 ${errors.area ? 'border-rose-300 bg-rose-50' : 'border-[var(--glass-border)]'}`} 
                                            />
                                            <span className="absolute right-3 inset-y-0 flex items-center pointer-events-none text-xs text-[var(--text-secondary)] font-bold">m²</span>
                                        </div>
                                        {errors.area && <p className="text-xs2 text-rose-500 mt-1">{errors.area}</p>}
                                    </div>
                                </div>

                                {/* DESCRIPTION — hidden for project units */}
                                {!isProjectUnit && (
                                <div>
                                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_desc')}</label>
                                    <textarea
                                        value={(formData.attributes?.description as string) || ''}
                                        onChange={e => updateAttribute('description', e.target.value)}
                                        rows={4}
                                        className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none"
                                        placeholder={t('inventory.placeholder_notes')}
                                    />
                                </div>
                                )}
                            </div>
                            <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm space-y-4">
                                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{t('inventory.section_details')}</h4>
                                {renderDynamicFields()}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{t('inventory.section_class')}</h4>
                                    {/* VERIFIED — hidden for project units */}
                                    {!isProjectUnit && (
                                    <label className="flex items-center gap-2 cursor-pointer select-none bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                        <input 
                                            type="checkbox" 
                                            checked={!!formData.isVerified} 
                                            onChange={e => setFormData({...formData, isVerified: e.target.checked})}
                                            className="w-3.5 h-3.5 accent-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs2 font-bold text-indigo-700 uppercase flex items-center gap-1">
                                            {t('inventory.verified')}
                                        </span>
                                    </label>
                                    )}
                                </div>
                                <div className="mb-4">
                                    <Dropdown
                                        label={t('inventory.label_transaction')}
                                        value={formData.transaction as string}
                                        onChange={v => setFormData({...formData, transaction: v as TransactionType})}
                                        options={transactionOptions}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Dropdown
                                            label={t('inventory.label_type')}
                                            value={formData.type as string}
                                            onChange={v => setFormData({...formData, type: v as PropertyType})}
                                            options={typeOptions}
                                        />
                                    </div>
                                    <div>
                                        <Dropdown
                                            label={t('inventory.label_status')}
                                            value={formData.status as string}
                                            onChange={v => setFormData({...formData, status: v as ListingStatus})}
                                            options={statusOptions}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            {/* IMAGES SECTION — hidden for project units */}
                            {!isProjectUnit && (
                            <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm flex-1">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{t('inventory.label_images')}</h4>
                                    <span className="text-xs2 text-[var(--text-secondary)] font-bold bg-[var(--glass-surface-hover)] px-2 py-1 rounded">{t('inventory.files_selected', {count: images.length})}</span>
                                </div>
                                {uploadError && (
                                    <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        <span>{uploadError}</span>
                                        <button onClick={() => setUploadError('')} className="ml-auto text-rose-400 hover:text-rose-600 shrink-0">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                )}
                                <div className="grid grid-cols-3 gap-3 mb-4 max-h-[240px] overflow-y-auto no-scrollbar">
                                    {images.map((img, idx) => (
                                        <div 
                                            key={img + idx} 
                                            className={`relative aspect-square rounded-xl overflow-hidden group border ${dragIdx === idx ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-[var(--glass-border)]'}`}
                                            draggable
                                            onDragStart={() => setDragIdx(idx)}
                                            onDragOver={(e) => { e.preventDefault(); }}
                                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIdx !== null && dragIdx !== idx) handleImageReorder(dragIdx, idx); setDragIdx(null); }}
                                            onDragEnd={() => setDragIdx(null)}
                                        >
                                            <img src={img} className="w-full h-full object-cover" alt="" loading="lazy" />
                                            {idx === 0 && <span className="absolute top-1 left-1 bg-indigo-600 text-white text-3xs font-bold px-1.5 py-0.5 rounded">{t('inventory.cover')}</span>}
                                            <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-sm">
                                                {ICONS.DELETE}
                                            </button>
                                        </div>
                                    ))}
                                    {isUploading && (
                                        <div className="aspect-square rounded-xl border border-[var(--glass-border)] flex items-center justify-center bg-[var(--glass-surface)]">
                                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                    {images.length < 10 && !isUploading && (
                                        <div 
                                            onClick={() => fileInputRef.current?.click()} 
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 text-[var(--text-secondary)] hover:border-indigo-400 hover:text-indigo-500 bg-[var(--glass-surface)] hover:bg-indigo-50'}`}
                                        >
                                            {ICONS.IMAGE_ADD}
                                            <span className="text-xs2 font-bold mt-2 text-center px-2">{t('inventory.drag_drop')}</span>
                                        </div>
                                    )}
                                </div>
                                <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                            </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="p-6 border-t border-[var(--glass-border)] bg-[var(--bg-surface)] rounded-b-[24px] flex gap-3 shrink-0">
                    <button onClick={onClose} disabled={isSubmitting} className="flex-1 py-3 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-70">{t('common.cancel')}</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all hover:-translate-y-0.5 disabled:opacity-70 flex items-center justify-center gap-2">
                        {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        {t('common.save')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
});
