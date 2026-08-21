import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Listing, PropertyType, ListingStatus, TransactionType } from '../types';
import { db } from '../services/dbApi'; // Import DB to fetch projects
import { Dropdown } from './Dropdown';
import { VN_PHONE_REGEX } from '../types'; // Reuse regex from types/constants if available, or define locally
import { useTranslation } from '../services/i18n';
import { buildVNGeoQueries } from '../utils/vnAddress';
import { compressImages } from '../utils/imageCompressor';
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
        attributes: { direction: '', legalStatus: '', furniture: 'BASIC', roadWidth: 0 },
        images: [],
        isVerified: false,
        contactPhone: '',
        ownerName: '',
        ownerPhone: '',
        commission: undefined,
        commissionUnit: 'PERCENT'
    };
    const UNITS = useMemo(() => getUnits(t), [t]);
    const [formData, setFormData] = useState<Partial<Listing>>(defaultState);
    // Only elevated roles may set the verified badge; the server drops the
    // field for everyone else (listingFieldPolicy), so the checkbox must not
    // pretend it worked.
    const [canVerify, setCanVerify] = useState(false);
    useEffect(() => {
        let alive = true;
        Promise.resolve(db.getCurrentUser())
            .then((u: any) => { if (alive) setCanVerify(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(u?.role)); })
            .catch(() => { /* stay read-only on failure */ });
        return () => { alive = false; };
    }, []);
    const [images, setImages] = useState<string[]>([]);
    const [projects, setProjects] = useState<{value: string, label: string}[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [step, setStep] = useState(0);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [uploadError, setUploadError] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeMsg, setGeocodeMsg] = useState<string>('');
    // Split Price State for UX
    const [priceShort, setPriceShort] = useState<string>('');
  useEffect(() => {
    setErrors(prev => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      if (next.title && formData.title?.trim()) delete next.title;
      if (next.location && formData.location?.trim()) delete next.location;
      if (next.price && priceShort) delete next.price;
      if (next.area && formData.area) delete next.area;
      if (next.contactPhone && formData.contactPhone?.trim()) delete next.contactPhone;
      if (next.ownerPhone && formData.ownerPhone?.trim()) delete next.ownerPhone;
      return next;
    });
  }, [formData.title, formData.location, priceShort, formData.area, formData.contactPhone, formData.ownerPhone]);
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
            setStep(0);
            // Load Projects for Dropdown from the Projects API
            setProjectsLoading(true);
            db.getProjects(1, 200).then(res => {
                const projectList = (res.data || [])
                    .filter((p: any) => p.status !== 'SUSPENDED')
                    .map((p: any) => ({
                        value: p.code || p.id,
                        label: p.name + (p.code ? ` (${p.code})` : '') + (p.location ? ` — ${p.location}` : '')
                    }));
                setProjects(projectList);
            }).catch(() => setProjects([])).finally(() => setProjectsLoading(false));

            if (initialData && initialData.id) {
                setFormData(JSON.parse(JSON.stringify(initialData)));
                setImages(initialData.images || []);                
                // Smart Price Reverse Logic — dùng toFixed(6) rồi parseFloat để loại FP noise
                const val = Math.round(Number(initialData.price) || 0);
                if (val >= 1_000_000_000) {
                    setPriceShort(parseFloat((val / 1_000_000_000).toFixed(6)).toString());
                    setPriceUnit(UNITS.BILLION.value);
                } else if (val >= 1_000_000) {
                    setPriceShort(parseFloat((val / 1_000_000).toFixed(6)).toString());
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
            setUploadError(t('inventory.upload_error_size'));
            return;
        }
        setIsUploading(true);
        try {
            const compressed = await compressImages(imageFiles);
            const result = await db.uploadFiles(compressed);
            const urls = result.files.map(f => f.url);
            setImages(prev => [...prev, ...urls]);
        } catch (err: any) {
            setUploadError(t('inventory.upload_failed'));
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
        if (!validate()) {
      setTimeout(() => {
        const el = document.querySelector('.border-rose-300') as HTMLElement | null;
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus?.(); }
      }, 50);
      return;
    }
        setIsSubmitting(true);
        // Calculate final raw price for DB — Math.round loại bỏ lỗi floating-point
        const finalPrice = Math.round(parseFloat(priceShort) * priceUnit);
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
        // Auto-generate code if user left it blank (required by server)
        const finalCode = formData.code?.trim() ||
            `SGS-${Date.now().toString(36).toUpperCase()}`;
        try {
            await onSubmit({
                ...formData,
                code: finalCode,
                price: finalPrice,
                images,
                coordinates,
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    const handleNextStep = () => {
        if (step === 0) {
            if (!validate()) {
                setTimeout(() => {
                    const el = document.querySelector('.border-rose-300') as HTMLElement | null;
                    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus?.(); }
                }, 50);
                return;
            }
        }
        setStep(current => Math.min(current + 1, 2));
    };
    const handlePreviousStep = () => setStep(current => Math.max(current - 1, 0));
    // --- OPTIONS MEMOIZATION ---
    const directionOptions = useMemo(() => [
        { value: '', label: '\u2014' },
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
        { value: '', label: '\u2014' },
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
    const isApartmentLike = [PropertyType.APARTMENT, PropertyType.PENTHOUSE].includes(formData.type as PropertyType);
    const BUILT_AREA_TYPES = [PropertyType.TOWNHOUSE, PropertyType.VILLA, PropertyType.HOUSE, PropertyType.OFFICE, PropertyType.FACTORY, PropertyType.COMMERCIAL];
    const hasBuiltArea = BUILT_AREA_TYPES.includes(formData.type as PropertyType);
    const renderDynamicFields = () => {
        if (isProject) {
            return (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_developer')}</label>
                        <input value={formData.attributes?.developer || ''} onChange={e => updateAttribute('developer', e.target.value)} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" />
                    </div>
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_total_units')}</label>
                        <input type="number" value={formData.totalUnits || ''} onChange={e => setFormData({...formData, totalUnits: Number(e.target.value)})} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" />
                    </div>
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_handover')}</label>
                        <input value={formData.attributes?.handoverYear || ''} onChange={e => updateAttribute('handoverYear', e.target.value)} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" placeholder="YYYY" />
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
                        <input type="number" value={(formData.attributes?.frontage as number) || ''} onChange={e => updateAttribute('frontage', Number(e.target.value))} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" />
                    </div>
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_road_width')} (m)</label>
                        <input type="number" value={(formData.attributes?.roadWidth as number) || ''} onChange={e => updateAttribute('roadWidth', Number(e.target.value))} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" />
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
        // Apartment / Penthouse — full 9-field 3×3 grid
        if (isApartmentLike) {
            return (
                <div className="grid grid-cols-3 gap-4">
                    {/* Row 1: PN | WC | Toà */}
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_bed')}</label>
                        <input type="number" min={0} value={formData.bedrooms || ''} onChange={e => setFormData({...formData, bedrooms: Number(e.target.value)})} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" />
                    </div>
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_bath')}</label>
                        <input type="number" min={0} value={formData.bathrooms || ''} onChange={e => setFormData({...formData, bathrooms: Number(e.target.value)})} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" />
                    </div>
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_tower')}</label>
                        <input type="text" value={(formData.attributes?.tower as string) || ''} onChange={e => updateAttribute('tower', e.target.value)} placeholder="A, B, T1..." className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" />
                    </div>
                    {/* Row 2: Tầng | Hướng | View */}
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_floor')}</label>
                        <input type="number" min={1} value={(formData.attributes?.floor as number) || ''} onChange={e => updateAttribute('floor', Number(e.target.value))} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" />
                    </div>
                    <div>
                        <Dropdown
                            label={t('inventory.label_direction')}
                            value={(formData.attributes?.direction as string) || ''}
                            onChange={v => updateAttribute('direction', v)}
                            options={directionOptions}
                        />
                    </div>
                    <div>
                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_view')}</label>
                        <input type="text" value={(formData.attributes?.view as string) || ''} onChange={e => updateAttribute('view', e.target.value)} placeholder="Sông, Hồ bơi, Nội khu..." className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" />
                    </div>
                    {/* Row 3: Nội thất | Pháp lý */}
                    <div>
                        <Dropdown
                            label={t('inventory.label_furniture')}
                            value={(formData.attributes?.furniture as string) || 'BASIC'}
                            onChange={v => updateAttribute('furniture', v)}
                            options={furnitureOptions}
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
        // Default: House / Office (bedrooms, bathrooms, floor, direction, furniture, legal)
        return (
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_bed')}</label>
                    <input type="number" min={0} value={formData.bedrooms || ''} onChange={e => setFormData({...formData, bedrooms: Number(e.target.value)})} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" />
                </div>
                <div>
                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_bath')}</label>
                    <input type="number" min={0} value={formData.bathrooms || ''} onChange={e => setFormData({...formData, bathrooms: Number(e.target.value)})} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" />
                </div>
                <div>
                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_floors')}</label>
                    <input type="number" min={1} value={(formData.attributes?.floor as number) || ''} onChange={e => updateAttribute('floor', Number(e.target.value))} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none" />
                </div>
                <div>
                    <Dropdown
                        label={t('inventory.label_direction')}
                        value={(formData.attributes?.direction as string) || ''}
                        onChange={v => updateAttribute('direction', v)}
                        options={directionOptions}
                    />
                </div>
                <div>
                    <Dropdown
                        label={t('inventory.label_furniture')}
                        value={(formData.attributes?.furniture as string) || 'BASIC'}
                        onChange={v => updateAttribute('furniture', v)}
                        options={furnitureOptions}
                    />
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
    };
    if (!isOpen) return null;
    const reviewAttrs = formData.attributes || {};
    const reviewRows = [
        { label: 'Mã tin', value: formData.code },
        { label: 'Dự án', value: formData.projectCode },
        { label: 'Điện thoại liên hệ', value: formData.contactPhone },
        { label: 'Tên chủ nhà', value: formData.ownerName },
        { label: 'Điện thoại chủ nhà', value: formData.ownerPhone },
        { label: 'Hoa hồng', value: formData.commission ? `${formData.commission} ${formData.commissionUnit === 'FIXED' ? 'VND' : '%'}` : undefined },
        { label: 'Pháp lý', value: reviewAttrs.legalStatus ? t(`legal.${reviewAttrs.legalStatus}`) : undefined },
        { label: 'Hướng', value: reviewAttrs.direction ? t(`direction.${reviewAttrs.direction}`) : undefined },
        { label: 'Nội thất', value: reviewAttrs.furniture ? t(`furniture.${reviewAttrs.furniture}`) : undefined },
        { label: 'Phòng ngủ', value: formData.bedrooms || undefined },
        { label: 'Phòng tắm', value: formData.bathrooms || undefined },
        { label: 'Mặt tiền', value: reviewAttrs.frontage ? `${reviewAttrs.frontage} m` : undefined },
        { label: 'Lộ giới', value: reviewAttrs.roadWidth ? `${reviewAttrs.roadWidth} m` : undefined },
        { label: 'Tọa độ', value: formData.coordinates?.lat && formData.coordinates?.lng ? `${formData.coordinates.lat}, ${formData.coordinates.lng}` : undefined },
        { label: 'Mô tả', value: reviewAttrs.description },
    ].filter(row => row.value !== undefined && row.value !== null && String(row.value).trim() !== '');
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
                 <div className="px-6 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-surface)] shrink-0">
                     <div className="flex items-center gap-2" aria-label="Tiến trình đăng tin">
                         {[
                             { label: 'Thông tin chính', hint: 'Tiêu đề, giá, địa chỉ' },
                             { label: 'Phân loại & ảnh', hint: 'Loại hình, trạng thái, hình ảnh' },
                             { label: 'Xem lại & đăng', hint: 'Kiểm tra trước khi lưu' },
                         ].map((item, index) => (
                             <React.Fragment key={item.label}>
                                 <button
                                     type="button"
                                     onClick={() => index < step ? setStep(index) : undefined}
                                     className={`min-w-0 flex-1 text-left ${index < step ? 'cursor-pointer' : 'cursor-default'}`}
                                     aria-current={step === index ? 'step' : undefined}
                                 >
                                     <div className={`flex items-center gap-2 text-xs font-bold ${step === index ? 'text-sgs-primary' : index < step ? 'text-sgs-verified' : 'text-[var(--text-tertiary)]'}`}>
                                         <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${step === index ? 'bg-sgs-primary text-white' : index < step ? 'bg-emerald-100 text-sgs-verified' : 'bg-[var(--glass-surface-hover)]'}`}>
                                             {index < step ? '✓' : index + 1}
                                         </span>
                                         <span className="truncate">{item.label}</span>
                                     </div>
                                     <span className="hidden pl-8 text-[10px] text-[var(--text-tertiary)] sm:block truncate">{item.hint}</span>
                                 </button>
                                 {index < 2 && <span className={`h-px flex-1 ${index < step ? 'bg-emerald-300' : 'bg-[var(--glass-border)]'}`} />}
                             </React.Fragment>
                         ))}
                     </div>
                 </div>
                {/* Scroll Container: Added no-scrollbar */}
                <div className="flex-1 overflow-y-auto p-6 bg-[var(--glass-surface)]/50 overscroll-contain no-scrollbar">
                     {step === 0 && <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-4">
                            <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm space-y-4">
                                <h4 className="text-xs font-bold text-sgs-primary uppercase tracking-wide">{t('inventory.section_general')}</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {!isProject && (
                                        <div>
                                            <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_code')}</label>
                                            <input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm font-mono bg-[var(--glass-surface)] focus:bg-[var(--bg-surface)] focus:border-sgs-primary outline-none" />
                                        </div>
                                    )}
                                    {!isProject && !isProjectUnit && (projectsLoading || projects.length > 0 || !!formData.projectCode) && (
                                        <div>
                                            {projectsLoading ? (
                                                <div>
                                                    <div className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1">{t('inventory.label_project')}</div>
                                                    <div className="w-full h-[44px] rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] animate-pulse flex items-center px-3 gap-2">
                                                        <div className="w-3 h-3 rounded-full bg-[var(--glass-border)] animate-pulse" />
                                                        <div className="h-3 w-28 rounded bg-[var(--glass-border)] animate-pulse" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <Dropdown
                                                    label={t('inventory.label_project')}
                                                    value={formData.projectCode || ''}
                                                    onChange={v => setFormData({...formData, projectCode: v as string})}
                                                    options={[{ value: '', label: t('inventory.project_none') }, ...projects]}
                                                    placeholder={t('inventory.project_select')}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_title')} <span className="text-rose-500">*</span></label>
                                    <input 
                                        value={formData.title || ''} 
                                        onChange={e => setFormData({...formData, title: e.target.value})} 
                                        className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold focus:border-[var(--sgs-primary)] outline-none ${errors.title ? 'border-rose-300 bg-rose-50' : 'border-[var(--glass-border)]'}`} 
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
                                        type="tel" inputMode="tel" value={formData.contactPhone || ''} 
                                        onChange={e => setFormData({...formData, contactPhone: e.target.value})} 
                                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[var(--sgs-primary)] outline-none font-mono ${errors.contactPhone ? 'border-rose-300 bg-rose-50' : 'border-[var(--glass-border)]'}`} 
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
                                                className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none bg-[var(--bg-surface)]" 
                                                placeholder={t('common.placeholder_fullname')}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_owner_phone')}</label>
                                            <input 
                                                type="tel" inputMode="tel" value={formData.ownerPhone || ''} 
                                                onChange={e => setFormData({...formData, ownerPhone: e.target.value})} 
                                                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[var(--sgs-primary)] outline-none bg-[var(--bg-surface)] font-mono ${errors.ownerPhone ? 'border-rose-300 bg-rose-50' : 'border-[var(--glass-border)]'}`}
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
                                                    className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none bg-[var(--bg-surface)] font-bold" 
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
                                            <p className="text-xs2 text-sgs-accent-text dark:text-sgs-accent-text mt-1.5 font-medium">
                                                {t('inventory.label_commission_hint')}
                                            </p>
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
                                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[var(--sgs-primary)] outline-none ${errors.location ? 'border-rose-300 bg-rose-50' : 'border-[var(--glass-border)]'}`} 
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
                                            value={formData.coordinates?.lat || ''}
                                            onChange={e => {
                                                const lat = parseFloat(e.target.value);
                                                if (e.target.value === '' || isNaN(lat)) {
                                                    const lng = formData.coordinates?.lng;
                                                    setFormData({ ...formData, coordinates: lng ? { lat: 0, lng } : undefined });
                                                } else {
                                                    setFormData({ ...formData, coordinates: { lat, lng: formData.coordinates?.lng ?? 0 } });
                                                }
                                            }}
                                            className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm font-mono focus:border-sgs-primary outline-none"
                                            placeholder="10.776900"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_lng')}</label>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            value={formData.coordinates?.lng || ''}
                                            onChange={e => {
                                                const lng = parseFloat(e.target.value);
                                                if (e.target.value === '' || isNaN(lng)) {
                                                    const lat = formData.coordinates?.lat;
                                                    setFormData({ ...formData, coordinates: lat ? { lat, lng: 0 } : undefined });
                                                } else {
                                                    setFormData({ ...formData, coordinates: { lat: formData.coordinates?.lat ?? 0, lng } });
                                                }
                                            }}
                                            className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm font-mono focus:border-sgs-primary outline-none"
                                            placeholder="106.700900"
                                        />
                                    </div>
                                    <div className="col-span-2 flex flex-col gap-1 -mt-1">
                                        <p className="text-xs2 text-[var(--text-secondary)]">{t('inventory.coordinates_hint')}</p>
                                    </div>
                                </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Smart Price Input */}
                                    <div className="col-span-2">
                                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">
                                            {isProject ? t('inventory.min_price') : t('inventory.label_price')} <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text"
                                                inputMode="decimal"
                                                value={priceShort} 
                                                onChange={e => {
                                                    let raw = e.target.value.replace(/[^\d.,]/g,'');
                                                const seps=(raw.match(/[.,]/g)||[]).length;
                                                if(seps>1){raw=raw.replace(/[.,]/g,'');}
                                                else if(seps===1){const p=raw.split(/[.,]/);if(p[1]&&p[1].length===3)raw=p.join('');else raw=p.join('.');}
                                                    if (/^\d*\.?\d*$/.test(raw)) setPriceShort(raw);
                                                }}
                                                onBlur={() => {
                                                    const num = parseFloat(priceShort);
                                                    if (isNaN(num) || num <= 0) return;
                                                    const rawVal = num * priceUnit;
                                                    // Nếu tổng VNĐ > 10.000 tỷ → chắc chắn user nhập số VNĐ thô, tự chuyển đơn vị
                                                    if (num >= 1_000_000) {
                                                        if (num >= 1_000_000_000) {
                                                            setPriceUnit(UNITS.BILLION.value);
                                                            setPriceShort(parseFloat((num / 1_000_000_000).toFixed(6)).toString());
                                                        } else if (num >= 1_000_000) {
                                                            setPriceUnit(UNITS.MILLION.value);
                                                            setPriceShort(parseFloat((num / 1_000_000).toFixed(6)).toString());
                                                        }
                                                    }
                                                }}
                                                className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] focus:border-[var(--sgs-primary)] outline-none ${errors.price ? 'border-rose-300 bg-rose-50' : 'border-[var(--glass-border)]'}`} 
                                                placeholder={priceUnit === UNITS.BILLION.value ? 'VD: 5.5' : priceUnit === UNITS.MILLION.value ? 'VD: 5500' : 'VD: 5500000000'}
                                            />
                                            <div className="w-28 shrink-0">
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
                                        {(() => {
                                            const num = isNaN(parseFloat(priceShort)) ? 0 : parseFloat(priceShort);
                                            const rawVal = num * priceUnit;
                                            if (rawVal <= 0) return null;
                                            if (rawVal > 1e13) {
                                                const suggestion = num >= 1_000_000_000
                                                    ? `${parseFloat((num / 1_000_000_000).toFixed(3))} tỷ`
                                                    : num >= 1_000_000
                                                    ? `${parseFloat((num / 1_000_000).toFixed(3))} triệu`
                                                    : null;
                                                return (
                                                    <div className="text-xs font-semibold text-sgs-accent-text mt-1 text-right flex items-center justify-end gap-1">
                                                        <span>⚠ Giá vô lý!</span>
                                                        {suggestion && <span className="text-sgs-primary">Rời ô → tự chỉnh thành <strong>{suggestion}</strong></span>}
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="text-xs font-semibold text-sgs-primary font-mono mt-1 text-right">
                                                    = {Math.round(rawVal).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className={isApartmentLike ? 'col-span-1' : 'col-span-2 sm:col-span-1'}>
                                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_area')} <span className="text-rose-500">*</span></label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                value={formData.area || ''} 
                                                onChange={e => setFormData({...formData, area: Number(e.target.value)})} 
                                                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[var(--sgs-primary)] outline-none pr-8 ${errors.area ? 'border-rose-300 bg-rose-50' : 'border-[var(--glass-border)]'}`} 
                                            />
                                            <span className="absolute right-3 inset-y-0 flex items-center pointer-events-none text-xs text-[var(--text-secondary)] font-bold">m²</span>
                                        </div>
                                        {errors.area && <p className="text-xs2 text-rose-500 mt-1">{errors.area}</p>}
                                    </div>
                                    {/* CLEAR AREA (DT thông thủy) — cùng hàng với Diện tích, chỉ hiển thị cho Căn hộ / Penthouse */}
                                    {isApartmentLike && (
                                    <div className="col-span-1">
                                        <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_clear_area')} (m²)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min={0}
                                                value={(formData.attributes?.clearArea as number) || ''}
                                                onChange={e => updateAttribute('clearArea', e.target.value ? Number(e.target.value) : undefined)}
                                                className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none pr-8"
                                                placeholder="0"
                                            />
                                            <span className="absolute right-3 inset-y-0 flex items-center pointer-events-none text-xs text-[var(--text-secondary)] font-bold">m²</span>
                                        </div>
                                    </div>
                                    )}
                                </div>
                                {/* BUILT AREA — chỉ hiển thị cho: Nhà phố, Biệt thự, Nhà riêng, Văn phòng, Nhà xưởng, Thương mại */}
                                {hasBuiltArea && (
                                <div>
                                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_built_area')}</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={formData.builtArea || ''}
                                            onChange={e => setFormData({...formData, builtArea: e.target.value ? Number(e.target.value) : undefined})}
                                            className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none pr-8"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-3 inset-y-0 flex items-center pointer-events-none text-xs text-[var(--text-secondary)] font-bold">m²</span>
                                    </div>
                                </div>
                                )}
                                {/* DESCRIPTION — hidden for project units */}
                                {!isProjectUnit && (
                                <div>
                                    <label className="text-xs3 font-bold text-[var(--text-tertiary)] uppercase mb-1 block">{t('inventory.label_desc')}</label>
                                    <textarea
                                        value={(formData.attributes?.description as string) || ''}
                                        onChange={e => updateAttribute('description', e.target.value)}
                                        rows={8}
                                        className="w-full border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm focus:border-sgs-primary outline-none resize-none"
                                        placeholder={t('inventory.placeholder_notes')}
                                    />
                                </div>
                                )}
                            </div>
                            <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm space-y-4">
                                <h4 className="text-xs font-bold text-sgs-primary uppercase tracking-wide">{t('inventory.section_details')}</h4>
                                {renderDynamicFields()}
                            </div>
                        </div>
                     </div>}

                     {step === 1 && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                         <div className="space-y-4">
                            <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-xs font-bold text-sgs-primary uppercase tracking-wide">{t('inventory.section_class')}</h4>
                                    {/* VERIFIED — hidden for project units */}
                                    {!isProjectUnit && (
                                    <label className="flex items-center gap-2 cursor-pointer select-none bg-sgs-champagne px-2 py-1 rounded-lg border border-sgs-border">
                                        <input 
                                            type="checkbox" 
                                            checked={!!formData.isVerified} 
                                            disabled={!canVerify}
                                        title={canVerify ? undefined : 'Ch\u1ec9 Tr\u01b0\u1edfng nh\u00f3m / Qu\u1ea3n tr\u1ecb vi\u00ean m\u1edbi \u0111\u01b0\u1ee3c \u0111\u00e1nh d\u1ea5u \u0111\u00e3 x\u00e1c th\u1ef1c'}
                                        onChange={e => { if (!canVerify) return; setFormData({...formData, isVerified: e.target.checked}); }}
                                            className="w-3.5 h-3.5 accent-[var(--sgs-primary)] rounded border-slate-300 focus:ring-sgs-primary"
                                        />
                                        <span className="text-xs2 font-bold text-sgs-primary uppercase flex items-center gap-1">
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
                            {/* IMAGES SECTION */}
                            <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm flex-1">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-xs font-bold text-sgs-primary uppercase tracking-wide">{t('inventory.label_images')}</h4>
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
                                            className={`relative aspect-square rounded-xl overflow-hidden group border ${dragIdx === idx ? 'border-[var(--sgs-primary)] ring-2 ring-[var(--sgs-primary)]' : 'border-[var(--glass-border)]'}`}
                                            draggable
                                            onDragStart={() => setDragIdx(idx)}
                                            onDragOver={(e) => { e.preventDefault(); }}
                                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIdx !== null && dragIdx !== idx) handleImageReorder(dragIdx, idx); setDragIdx(null); }}
                                            onDragEnd={() => setDragIdx(null)}
                                        >
                                            <img src={img} className="w-full h-full object-cover" alt="" loading="lazy" />
                                            {idx === 0 && <span className="absolute top-1 left-1 bg-sgs-primary text-white text-3xs font-bold px-1.5 py-0.5 rounded">{t('inventory.cover')}</span>}
                                            <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-sm">
                                                {ICONS.DELETE}
                                            </button>
                                        </div>
                                    ))}
                                    {isUploading && (
                                        <div className="aspect-square rounded-xl border border-[var(--glass-border)] flex items-center justify-center bg-[var(--glass-surface)]">
                                            <div className="w-6 h-6 border-2 border-sgs-primary border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                    {images.length < 10 && !isUploading && (
                                        <div 
                                            onClick={() => fileInputRef.current?.click()} 
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? 'border-[var(--sgs-primary)] bg-[var(--sgs-primary)]/10' : 'border-slate-300 text-[var(--text-secondary)] hover:border-[var(--sgs-primary)] hover:text-[var(--sgs-primary)] bg-[var(--glass-surface)] hover:bg-[var(--sgs-primary)]/10'}`}
                                        >
                                            {ICONS.IMAGE_ADD}
                                            <span className="text-xs2 font-bold mt-2 text-center px-2">{t('inventory.drag_drop')}</span>
                                        </div>
                                    )}
                                </div>
                                <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                            </div>
                        </div>
                     </div>}

                     {step === 2 && (
                         <div className="mx-auto w-full max-w-2xl space-y-4">
                             <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-5 shadow-sm">
                                 <h4 className="mb-4 text-sm font-bold text-sgs-primary">Kiểm tra thông tin trước khi đăng</h4>
                                 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                     <div><span className="text-xs text-[var(--text-tertiary)]">Tiêu đề</span><p className="font-semibold text-[var(--text-primary)]">{formData.title || 'Chưa nhập'}</p></div>
                                     <div><span className="text-xs text-[var(--text-tertiary)]">Giao dịch / Loại hình</span><p className="font-semibold text-[var(--text-primary)]">{t(`transaction.${String(formData.transaction || '').toUpperCase()}`)} · {t(`property.${String(formData.type || '').toUpperCase()}`)}</p></div>
                                     <div><span className="text-xs text-[var(--text-tertiary)]">Trạng thái</span><p className="font-semibold text-[var(--text-primary)]">{t(`status.${String(formData.status || '').toUpperCase()}`)}</p></div>
                                     <div><span className="text-xs text-[var(--text-tertiary)]">Giá</span><p className="font-semibold text-[var(--text-primary)]">{priceShort ? `${priceShort} ${UNITS[priceUnit === UNITS.BILLION.value ? 'BILLION' : priceUnit === UNITS.MILLION.value ? 'MILLION' : 'ONE'].label}` : 'Chưa nhập'}</p></div>
                                     <div><span className="text-xs text-[var(--text-tertiary)]">Diện tích</span><p className="font-semibold text-[var(--text-primary)]">{formData.area ? `${formData.area} m²` : 'Chưa nhập'}</p></div>
                                     {!isProjectUnit && <div className="sm:col-span-2"><span className="text-xs text-[var(--text-tertiary)]">Địa chỉ</span><p className="font-semibold text-[var(--text-primary)]">{formData.location || 'Chưa nhập'}</p></div>}
                                 </div>
                             </div>
                             <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-5 shadow-sm">
                                 <div className="mb-3 flex items-center justify-between gap-3">
                                     <h4 className="text-sm font-bold text-sgs-primary">Thông tin đã ghi nhận</h4>
                                     <span className="text-xs font-semibold text-[var(--text-tertiary)]">{reviewRows.length} trường</span>
                                 </div>
                                 <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
                                     {reviewRows.map(row => (
                                         <div key={row.label} className={row.label === 'Mô tả' ? 'sm:col-span-2' : ''}>
                                             <span className="text-xs text-[var(--text-tertiary)]">{row.label}</span>
                                             <p className="break-words font-semibold text-[var(--text-primary)]">{String(row.value)}</p>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                             <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)]">
                                 <p className="font-semibold text-sgs-primary">Hình ảnh và xác thực</p>
                                 <p className="mt-1">{images.length} ảnh đã chọn{formData.isVerified ? ' · Đã xác thực' : ''}</p>
                             </div>
                             <div className="rounded-2xl border border-sgs-border bg-sgs-champagne/40 p-4 text-sm text-[var(--text-secondary)]">
                                 <p className="font-semibold text-sgs-primary">Đã sẵn sàng đăng tin?</p>
                                 <p className="mt-1">Bạn có thể quay lại bước trước để chỉnh sửa. Hệ thống sẽ tự lưu ảnh, tọa độ và các trường thông tin cùng tin đăng.</p>
                             </div>
                         </div>
                     )}
                </div>                
                <div className="p-6 border-t border-[var(--glass-border)] bg-[var(--bg-surface)] rounded-b-[24px] flex gap-3 shrink-0">
                     <button onClick={step > 0 ? handlePreviousStep : onClose} disabled={isSubmitting} className="flex-1 py-3 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-70">{step > 0 ? 'Quay lại' : t('common.cancel')}</button>
                     {step < 2 ? (
                         <button onClick={handleNextStep} disabled={isSubmitting} className="flex-1 py-3 bg-sgs-primary text-white font-bold rounded-xl shadow-lg hover:bg-sgs-primary transition-all hover:-translate-y-0.5 disabled:opacity-70">
                             Tiếp tục
                         </button>
                     ) : (
                         <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-3 bg-sgs-primary text-white font-bold rounded-xl shadow-lg hover:bg-sgs-primary transition-all hover:-translate-y-0.5 disabled:opacity-70 flex items-center justify-center gap-2">
                             {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                             {initialData && initialData.id ? t('inventory.update_submit') : t('inventory.create_submit')}
                         </button>
                     )}
                </div>
            </div>
        </div>,
        document.body
    );
});