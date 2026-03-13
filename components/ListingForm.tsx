
import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Listing, PropertyType, ListingStatus, TransactionType } from '../types';
import { db } from '../services/dbApi'; // Import DB to fetch projects
import { Dropdown } from './Dropdown';
import { VN_PHONE_REGEX } from '../types'; // Reuse regex from types/constants if available, or define locally
import { useTranslation } from '../services/i18n';

interface ListingFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<Listing>) => Promise<void>;
    initialData?: Listing;
    t: any;
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

export const ListingForm: React.FC<ListingFormProps> = memo(({ isOpen, onClose, onSubmit, initialData, t }) => {
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

    const UNITS = getUnits(t);

    const [formData, setFormData] = useState<Partial<Listing>>(defaultState);
    const [images, setImages] = useState<string[]>([]);
    const [projects, setProjects] = useState<{value: string, label: string}[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isDragging, setIsDragging] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    
    // Split Price State for UX
    const [priceShort, setPriceShort] = useState<string>('');
    const [priceUnit, setPriceUnit] = useState<number>(UNITS.BILLION.value);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialization & Data Conversion
    useEffect(() => {
        if (isOpen) {
            setErrors({});
            // Load Projects for Dropdown
            db.getListings(1, 1000).then(res => {
                const projectList = (res.data || [])
                    .filter(l => l.type === PropertyType.PROJECT)
                    .map(p => ({ value: p.code, label: p.title }));
                setProjects(projectList);
            });

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
                        code: `LST${Date.now().toString().slice(-4)}`,
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

        if (images.length + imageFiles.length > 10) {
            alert(t('inventory.max_images'));
            return;
        }

        const MAX_SIZE = 10 * 1024 * 1024;
        const oversized = imageFiles.find(f => f.size > MAX_SIZE);
        if (oversized) {
            alert(t('profile.error_file_size') || 'File too large (max 10MB)');
            return;
        }

        setIsUploading(true);
        try {
            const result = await db.uploadFiles(imageFiles);
            const urls = result.files.map(f => f.url);
            setImages(prev => [...prev, ...urls]);
        } catch (err: any) {
            alert(err.message || t('common.error'));
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
        if (!formData.location?.trim()) newErrors.location = t('validation.location_required');
        
        // Price Validation based on calculated value
        const calculatedPrice = parseFloat(priceShort) * priceUnit;
        if (!priceShort || isNaN(calculatedPrice) || calculatedPrice <= 0) newErrors.price = t('validation.price_invalid');
        
        if (!formData.area || formData.area <= 0) newErrors.area = t('validation.area_invalid');
        
        // Contact Phone Validation
        if (!formData.contactPhone?.trim()) {
            newErrors.contactPhone = t('validation.required');
        } else if (!VN_PHONE_REGEX.test(formData.contactPhone)) {
            newErrors.contactPhone = t('validation.phone_invalid');
        }

        // Owner Phone Validation (optional field — only validate if filled)
        if (formData.ownerPhone?.trim() && !VN_PHONE_REGEX.test(formData.ownerPhone)) {
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

        try {
            await onSubmit({ 
                ...formData, 
                price: finalPrice,
                images 
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
    const typeOptions = useMemo(() => Object.values(PropertyType).map(tKey => ({ value: tKey, label: t(`property.${tKey.toUpperCase()}`) })), [t]);
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
                        <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_developer')}</label>
                        <input value={formData.attributes?.developer || ''} onChange={e => updateAttribute('developer', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_total_units')}</label>
                        <input type="number" value={formData.totalUnits || ''} onChange={e => setFormData({...formData, totalUnits: Number(e.target.value)})} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_handover')}</label>
                        <input value={formData.attributes?.handoverYear || ''} onChange={e => updateAttribute('handoverYear', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" placeholder="YYYY" />
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
                        <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_frontage')} (m)</label>
                        <input type="number" value={(formData.attributes?.frontage as number) || ''} onChange={e => updateAttribute('frontage', Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_road_width')} (m)</label>
                        <input type="number" value={(formData.attributes?.roadWidth as number) || ''} onChange={e => updateAttribute('roadWidth', Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
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
                    <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_bed')}</label>
                    <input type="number" value={formData.bedrooms ?? ''} onChange={e => setFormData({...formData, bedrooms: Number(e.target.value)})} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_bath')}</label>
                    <input type="number" value={formData.bathrooms ?? ''} onChange={e => setFormData({...formData, bathrooms: Number(e.target.value)})} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_floors')}</label>
                    <input type="number" value={formData.attributes?.floor ?? ''} onChange={e => updateAttribute('floor', Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="bg-white w-full max-w-4xl rounded-[24px] shadow-2xl flex flex-col h-[90vh] md:h-auto md:max-h-[90vh] relative z-10 animate-scale-up overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <h3 className="text-xl font-bold text-slate-800">
                        {initialData && initialData.id ? t('inventory.edit_title') : t('inventory.create_title')}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        {ICONS.CLOSE}
                    </button>
                </div>
                
                {/* Scroll Container: Added no-scrollbar */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 overscroll-contain no-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{t('inventory.section_general')}</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {!isProject && (
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_code')}</label>
                                            <input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none" />
                                        </div>
                                    )}
                                    {!isProject && (
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
                                    <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_title')} <span className="text-rose-500">*</span></label>
                                    <input 
                                        value={formData.title || ''} 
                                        onChange={e => setFormData({...formData, title: e.target.value})} 
                                        className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none ${errors.title ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} 
                                        placeholder={isProject ? t('inventory.placeholder_title_project') : t('inventory.placeholder_title_unit')} 
                                    />
                                    {errors.title && <p className="text-[10px] text-rose-500 mt-1">{errors.title}</p>}
                                </div>
                                
                                {/* CONTACT PHONE - NEW FIELD */}
                                 <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">
                                        {t('leads.phone') || 'Contact Phone'} <span className="text-rose-500">*</span>
                                    </label>
                                    <input 
                                        value={formData.contactPhone || ''} 
                                        onChange={e => setFormData({...formData, contactPhone: e.target.value})} 
                                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none font-mono ${errors.contactPhone ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} 
                                        placeholder="0912..." 
                                    />
                                    {errors.contactPhone && <p className="text-[10px] text-rose-500 mt-1">{errors.contactPhone}</p>}
                                </div>

                                {/* CONSIGNMENT INFO (OWNER & COMMISSION) */}
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('inventory.section_consignment')}</h5>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_owner_name')}</label>
                                            <input 
                                                value={formData.ownerName || ''} 
                                                onChange={e => setFormData({...formData, ownerName: e.target.value})} 
                                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white" 
                                                placeholder="Nguyễn Văn A"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_owner_phone')}</label>
                                            <input 
                                                value={formData.ownerPhone || ''} 
                                                onChange={e => setFormData({...formData, ownerPhone: e.target.value})} 
                                                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white font-mono ${errors.ownerPhone ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
                                                placeholder="09..."
                                            />
                                            {errors.ownerPhone && <p className="text-[10px] text-rose-500 mt-1">{errors.ownerPhone}</p>}
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_commission')}</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="number"
                                                    value={formData.commission || ''} 
                                                    onChange={e => setFormData({...formData, commission: Number(e.target.value)})} 
                                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white font-bold" 
                                                    placeholder="1.5"
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

                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_location')} <span className="text-rose-500">*</span></label>
                                    <input 
                                        value={formData.location || ''} 
                                        onChange={e => setFormData({...formData, location: e.target.value})} 
                                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none ${errors.location ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} 
                                        placeholder={t('inventory.placeholder_addr')} 
                                    />
                                    {errors.location && <p className="text-[10px] text-rose-500 mt-1">{errors.location}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Smart Price Input */}
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">
                                            {isProject ? t('inventory.min_price') : t('inventory.label_price')} <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="number"
                                                step="0.1"
                                                value={priceShort} 
                                                onChange={e => setPriceShort(e.target.value)} 
                                                className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:border-indigo-500 outline-none ${errors.price ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} 
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
                                        <div className="text-[10px] text-slate-400 font-mono mt-1 text-right truncate">
                                            = {formatCurrency(parseFloat(priceShort || '0') * priceUnit)}
                                        </div>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_area')} <span className="text-rose-500">*</span></label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                value={formData.area ?? ''} 
                                                onChange={e => setFormData({...formData, area: Number(e.target.value)})} 
                                                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none pr-8 ${errors.area ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} 
                                            />
                                            <span className="absolute right-3 inset-y-0 flex items-center pointer-events-none text-xs text-slate-400 font-bold">m²</span>
                                        </div>
                                    </div>
                                </div>

                                {/* DESCRIPTION / NOTES */}
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">{t('inventory.label_notes')}</label>
                                    <textarea
                                        value={(formData.attributes?.notes as string) || ''}
                                        onChange={e => updateAttribute('notes', e.target.value)}
                                        rows={3}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none"
                                        placeholder={t('inventory.placeholder_notes')}
                                    />
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{t('inventory.section_details')}</h4>
                                {renderDynamicFields()}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{t('inventory.section_class')}</h4>
                                    <label className="flex items-center gap-2 cursor-pointer select-none bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                        <input 
                                            type="checkbox" 
                                            checked={!!formData.isVerified} 
                                            onChange={e => setFormData({...formData, isVerified: e.target.checked})}
                                            className="w-3.5 h-3.5 accent-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                        />
                                        <span className="text-[10px] font-bold text-indigo-700 uppercase flex items-center gap-1">
                                            {ICONS.VERIFIED} {t('inventory.verified')}
                                        </span>
                                    </label>
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
                            
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex-1">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{t('inventory.label_images')}</h4>
                                    <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-1 rounded">{t('inventory.files_selected', {count: images.length})}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-3 mb-4 max-h-[240px] overflow-y-auto no-scrollbar">
                                    {images.map((img, idx) => (
                                        <div 
                                            key={img + idx} 
                                            className={`relative aspect-square rounded-xl overflow-hidden group border ${dragIdx === idx ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-100'}`}
                                            draggable
                                            onDragStart={() => setDragIdx(idx)}
                                            onDragOver={(e) => { e.preventDefault(); }}
                                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIdx !== null && dragIdx !== idx) handleImageReorder(dragIdx, idx); setDragIdx(null); }}
                                            onDragEnd={() => setDragIdx(null)}
                                        >
                                            <img src={img} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                            {idx === 0 && <span className="absolute top-1 left-1 bg-indigo-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">{t('inventory.cover') || 'Cover'}</span>}
                                            <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-sm">
                                                {ICONS.DELETE}
                                            </button>
                                        </div>
                                    ))}
                                    {isUploading && (
                                        <div className="aspect-square rounded-xl border border-slate-200 flex items-center justify-center bg-slate-50">
                                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                    {images.length < 10 && !isUploading && (
                                        <div 
                                            onClick={() => fileInputRef.current?.click()} 
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 bg-slate-50 hover:bg-indigo-50'}`}
                                        >
                                            {ICONS.IMAGE_ADD}
                                            <span className="text-[10px] font-bold mt-2 text-center px-2">{t('inventory.drag_drop')}</span>
                                        </div>
                                    )}
                                </div>
                                <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 border-t border-slate-100 bg-white rounded-b-[24px] flex gap-3 shrink-0">
                    <button onClick={onClose} disabled={isSubmitting} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-70">{t('common.cancel')}</button>
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
