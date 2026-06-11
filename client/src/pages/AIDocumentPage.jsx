/**
 * AIDocumentPage.jsx
 * AI Smart Medical Document Analyzer
 * Supports prescription / lab report upload → OCR → structured JSON display
 * Accessible to: PATIENT, DOCTOR, NURSE, HOSPITAL_ADMIN (any authenticated user)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import axiosInstance from '../api/axios';

/* ─────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────── */
const TIMING_COLORS = {
    'Morning':                   'bg-amber-500/10 border-amber-500/20 text-amber-400',
    'Night':                     'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    'Afternoon':                 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    'Morning & Night':           'bg-blue-500/10 border-blue-500/20 text-blue-400',
    'Morning & Afternoon':       'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    'Morning, Afternoon & Night':'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    'As directed':               'bg-slate-700 border-white/5 text-slate-400',
};

const PURPOSE_ICON = {
    'Diabetes':           'fa-syringe',
    'Blood Pressure':     'fa-heart-pulse',
    'Fever/Pain':         'fa-temperature-high',
    'Infection/Antibiotic':'fa-bacteria',
    'General':            'fa-pills',
};

const STATUS_CFG = {
    DONE:       { cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: 'fa-circle-check',   label: 'Done' },
    PROCESSING: { cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20',         icon: 'fa-circle-notch',   label: 'Processing' },
    FAILED:     { cls: 'text-red-400 bg-red-500/10 border-red-500/20',            icon: 'fa-circle-xmark',   label: 'Failed' },
};

const DOC_TYPE_ICON = {
    PRESCRIPTION: 'fa-prescription',
    LAB_REPORT:   'fa-flask',
    TEST_REPORT:  'fa-microscope',
    OTHER:        'fa-file-medical',
};

/* ─────────────────────────────────────────────────────
   UPLOAD ZONE
───────────────────────────────────────────────────── */
const UploadZone = ({ onFile }) => {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) validate(f);
    };

    const validate = (file) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowed.includes(file.type)) {
            toast.error('Only JPEG, PNG, WebP images and PDFs are allowed');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error('File must be under 10 MB');
            return;
        }
        onFile(file);
    };

    return (
        <div
            className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all select-none ${
                dragging
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-white/10 hover:border-blue-500/50 hover:bg-white/[0.02]'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
        >
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => { if (e.target.files[0]) validate(e.target.files[0]); }}
            />
            <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-cloud-arrow-up text-blue-400 text-3xl"></i>
            </div>
            <p className="text-white font-extrabold text-lg mb-1">Drop your document here</p>
            <p className="text-slate-500 text-sm">Prescription, Lab Report, Test Report</p>
            <p className="text-slate-600 text-xs mt-2">Supports: JPEG · PNG · WebP · PDF · Max 10 MB</p>
        </div>
    );
};

/* ─────────────────────────────────────────────────────
   MEDICINE CARD
───────────────────────────────────────────────────── */
const MedicineCard = ({ med, idx }) => {
    const timingCls = TIMING_COLORS[med.timing] || TIMING_COLORS['As directed'];
    const purposeIcon = PURPOSE_ICON[med.purpose] || 'fa-pills';

    return (
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all">
            {/* Number + name */}
            <div className="flex items-start gap-3 mb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-400 font-black text-[11px]">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white font-extrabold text-sm leading-tight capitalize">{med.name}</p>
                    {med.dosage && (
                        <p className="text-slate-400 text-xs font-bold mt-0.5">{med.dosage}</p>
                    )}
                </div>
                {/* Purpose icon */}
                <div className="w-8 h-8 rounded-xl bg-slate-800/60 flex items-center justify-center flex-shrink-0">
                    <i className={`fa-solid ${purposeIcon} text-slate-400 text-sm`}></i>
                </div>
            </div>

            {/* Timing pill */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${timingCls}`}>
                    <i className="fa-regular fa-clock text-[9px]"></i>
                    {med.timing}
                </span>
                {med.purpose && med.purpose !== 'General' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-purple-500/10 border-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest">
                        <i className={`fa-solid ${purposeIcon} text-[9px]`}></i>
                        {med.purpose}
                    </span>
                )}
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────────
   RESULT PANEL
───────────────────────────────────────────────────── */
const ResultPanel = ({ result, rawPreview, documentType }) => {
    const { parsed } = result;
    const [showRaw, setShowRaw] = useState(false);

    const isExpired = parsed.expiryDate && new Date(parsed.expiryDate) < new Date();
    const daysToExpiry = parsed.expiryDate
        ? Math.ceil((new Date(parsed.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
        : null;

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Header strip */}
            <div className={`flex items-center justify-between p-4 rounded-2xl border ${
                isExpired
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-emerald-500/5 border-emerald-500/20'
            }`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isExpired ? 'bg-red-600/10' : 'bg-emerald-600/10'
                    }`}>
                        <i className={`fa-solid ${DOC_TYPE_ICON[documentType] || 'fa-file-medical'} ${
                            isExpired ? 'text-red-400' : 'text-emerald-400'
                        } text-lg`}></i>
                    </div>
                    <div>
                        <p className="text-white font-extrabold text-sm">{documentType.replace('_', ' ')}</p>
                        <p className={`text-[11px] font-black ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                            {isExpired ? '⚠️ Prescription Expired' : `Valid · ${daysToExpiry !== null ? `Expires in ${daysToExpiry} days` : 'Date unknown'}`}
                        </p>
                    </div>
                </div>
                <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${isExpired ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>
                    {isExpired ? 'EXPIRED' : 'VALID'}
                </span>
            </div>

            {/* Key metadata */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'Doctor', val: parsed.doctorName,   icon: 'fa-user-doctor',   color: 'text-blue-400' },
                    { label: 'Hospital/Clinic', val: parsed.hospitalName, icon: 'fa-hospital',  color: 'text-purple-400' },
                    { label: 'Issue Date', val: parsed.issueDate,  icon: 'fa-calendar-days', color: 'text-amber-400' },
                    { label: 'Expiry Date', val: parsed.expiryDate, icon: 'fa-calendar-xmark', color: isExpired ? 'text-red-400' : 'text-emerald-400' },
                ].map(({ label, val, icon, color }) => (
                    <div key={label} className="bg-slate-900/60 border border-white/5 rounded-xl p-3">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{label}</p>
                        <div className="flex items-center gap-2">
                            <i className={`fa-solid ${icon} ${color} text-sm flex-shrink-0`}></i>
                            <p className="text-white font-bold text-xs truncate">{val || <span className="text-slate-600 italic">Not detected</span>}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Medicines */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-pills text-blue-400"></i>
                        Medicines Detected
                        {parsed.medicines?.length > 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                {parsed.medicines.length}
                            </span>
                        )}
                    </h3>
                </div>

                {(parsed.medicines || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 bg-slate-900/40 border border-white/5 rounded-2xl gap-3">
                        <i className="fa-solid fa-flask text-slate-700 text-3xl"></i>
                        <p className="text-slate-500 text-sm font-bold">No medicines detected</p>
                        <p className="text-slate-600 text-xs">Try uploading a clearer image</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {parsed.medicines.map((med, i) => (
                            <MedicineCard key={i} med={med} idx={i} />
                        ))}
                    </div>
                )}
            </div>

            {/* Raw OCR toggle */}
            {rawPreview && (
                <div>
                    <button
                        onClick={() => setShowRaw(!showRaw)}
                        className="flex items-center gap-2 text-[11px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors"
                    >
                        <i className={`fa-solid fa-chevron-${showRaw ? 'up' : 'down'} text-[9px]`}></i>
                        {showRaw ? 'Hide' : 'Show'} Raw OCR Text
                    </button>
                    {showRaw && (
                        <pre className="mt-2 bg-slate-950 border border-white/5 rounded-xl p-4 text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
                            {rawPreview}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
};

/* ─────────────────────────────────────────────────────
   HISTORY ITEM
───────────────────────────────────────────────────── */
const HistoryItem = ({ record, onView }) => {
    const cfg = STATUS_CFG[record.ai_status] || STATUS_CFG.FAILED;
    const medicines = record.parsed_data?.medicines || [];

    return (
        <div
            className="flex items-center gap-4 p-4 bg-[#0d1117] border border-white/5 rounded-2xl hover:border-white/10 transition-all cursor-pointer"
            onClick={() => onView(record)}
        >
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center flex-shrink-0">
                <i className={`fa-solid ${DOC_TYPE_ICON[record.document_type] || 'fa-file-medical'} text-slate-400`}></i>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{record.original_file_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-slate-500">{record.document_type?.replace('_', ' ')}</span>
                    {medicines.length > 0 && (
                        <>
                            <span className="text-slate-700">·</span>
                            <span className="text-[10px] text-blue-400 font-bold">{medicines.length} med{medicines.length !== 1 ? 's' : ''}</span>
                        </>
                    )}
                    {record.expiry_date && (
                        <>
                            <span className="text-slate-700">·</span>
                            <span className={`text-[10px] font-bold ${new Date(record.expiry_date) < new Date() ? 'text-red-400' : 'text-emerald-400'}`}>
                                Exp: {new Date(record.expiry_date).toLocaleDateString('en-IN')}
                            </span>
                        </>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${cfg.cls}`}>
                    <i className={`fa-solid ${cfg.icon} ${record.ai_status === 'PROCESSING' ? 'animate-spin' : ''} mr-1 text-[9px]`}></i>
                    {cfg.label}
                </span>
                <span className="text-[10px] text-slate-600">
                    {record.created_at ? new Date(record.created_at).toLocaleDateString('en-IN') : '—'}
                </span>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────── */
const AIDocumentPage = () => {
    // ── State ──
    const [tab, setTab]                     = useState('ANALYZE'); // ANALYZE | HISTORY
    const [selectedFile, setSelectedFile]   = useState(null);
    const [previewUrl, setPreviewUrl]       = useState(null);
    const [docType, setDocType]             = useState('PRESCRIPTION');
    const [analyzing, setAnalyzing]         = useState(false);
    const [result, setResult]               = useState(null);
    const [rawPreview, setRawPreview]       = useState('');

    // History
    const [history, setHistory]             = useState([]);
    const [histLoading, setHistLoading]     = useState(false);
    const [histPage, setHistPage]           = useState(1);
    const [histPagination, setHistPagination] = useState(null);

    // Detail modal (from history)
    const [detailRecord, setDetailRecord]   = useState(null);

    // ── File select ──
    const handleFile = (file) => {
        setSelectedFile(file);
        setResult(null);
        setRawPreview('');
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        } else {
            setPreviewUrl(null);
        }
    };

    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    // ── Analyze ──
    const handleAnalyze = async () => {
        if (!selectedFile) { toast.error('Please select a file first'); return; }
        setAnalyzing(true);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('document', selectedFile);
            formData.append('documentType', docType);

            const res = await axiosInstance.post('/ai/analyze', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000, // 2 min for OCR
            });

            if (res.data?.success) {
                setResult(res.data.data);
                setRawPreview(res.data.data.rawTextPreview || '');
                toast.success('Document analyzed successfully!');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Analysis failed. Please try again.');
        } finally {
            setAnalyzing(false);
        }
    };

    // ── History ──
    const fetchHistory = useCallback(async (page = 1) => {
        setHistLoading(true);
        try {
            const res = await axiosInstance.get(`/ai/history?page=${page}&limit=10`);
            if (res.data?.success) {
                setHistory(res.data.data || []);
                setHistPagination(res.data.pagination);
            }
        } catch (err) {
            toast.error('Failed to load analysis history');
        } finally {
            setHistLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tab === 'HISTORY') fetchHistory(histPage);
    }, [tab, histPage]);

    const handleViewDetail = async (record) => {
        // For DONE records with parsed_data, show inline
        if (record.ai_status === 'DONE' && record.parsed_data?.medicines) {
            setDetailRecord(record);
            return;
        }
        // Fetch fresh from API
        try {
            const res = await axiosInstance.get(`/ai/analysis/${record.id}`);
            if (res.data?.success) setDetailRecord(res.data.data);
        } catch {
            toast.error('Failed to load analysis detail');
        }
    };

    const clearAll = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setResult(null);
        setRawPreview('');
    };

    /* ────────────────────────────────────────────────
       RENDER
    ──────────────────────────────────────────────── */
    return (
        <div className="min-h-screen bg-[#070b14] text-[#cbd5e1] font-sans">
            {/* ── Header ── */}
            <header className="bg-[#0d1117] border-b border-white/5 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                        <i className="fa-solid fa-wand-magic-sparkles text-blue-400"></i>
                    </div>
                    <div>
                        <h1 className="text-white font-extrabold text-base leading-tight">AI Medical Analyzer</h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">OCR · NLP · Smart Extraction</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-slate-900/60 border border-white/5 rounded-xl">
                    {[
                        { key: 'ANALYZE', icon: 'fa-wand-magic-sparkles', label: 'Analyze' },
                        { key: 'HISTORY', icon: 'fa-clock-rotate-left',   label: 'History' },
                    ].map(({ key, icon, label }) => (
                        <button key={key} onClick={() => setTab(key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                                tab === key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
                            }`}>
                            <i className={`fa-solid ${icon}`}></i>
                            {label}
                        </button>
                    ))}
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6">

                {/* ── ANALYZE TAB ── */}
                {tab === 'ANALYZE' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* LEFT: Upload */}
                        <div className="space-y-5">
                            <div>
                                <h2 className="text-xl font-extrabold text-white mb-1">Upload Document</h2>
                                <p className="text-slate-500 text-sm">Upload a prescription or lab/test report for AI analysis</p>
                            </div>

                            {/* Document type selector */}
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Document Type</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { key: 'PRESCRIPTION', icon: 'fa-prescription',  label: 'Prescription' },
                                        { key: 'LAB_REPORT',   icon: 'fa-flask',          label: 'Lab Report' },
                                        { key: 'TEST_REPORT',  icon: 'fa-microscope',     label: 'Test Report' },
                                        { key: 'OTHER',        icon: 'fa-file-medical',   label: 'Other' },
                                    ].map(({ key, icon, label }) => (
                                        <button key={key} onClick={() => setDocType(key)}
                                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                                                docType === key
                                                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                                                    : 'bg-slate-900/40 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
                                            }`}>
                                            <i className={`fa-solid ${icon}`}></i>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Upload zone or file preview */}
                            {!selectedFile ? (
                                <UploadZone onFile={handleFile} />
                            ) : (
                                <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                                            <i className={`fa-solid ${selectedFile.type === 'application/pdf' ? 'fa-file-pdf text-red-400' : 'fa-image text-blue-400'}`}></i>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold text-sm truncate">{selectedFile.name}</p>
                                            <p className="text-[11px] text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {selectedFile.type}</p>
                                        </div>
                                        <button onClick={clearAll} className="text-slate-500 hover:text-red-400 transition-colors">
                                            <i className="fa-solid fa-xmark text-lg"></i>
                                        </button>
                                    </div>
                                    {previewUrl && (
                                        <div className="rounded-xl overflow-hidden border border-white/5 mb-3">
                                            <img src={previewUrl} alt="Preview" className="w-full max-h-52 object-contain bg-slate-950" />
                                        </div>
                                    )}
                                    {selectedFile.type === 'application/pdf' && (
                                        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-3">
                                            <i className="fa-solid fa-triangle-exclamation text-amber-400 text-sm"></i>
                                            <p className="text-amber-400 text-xs font-bold">PDF OCR works best on text-based PDFs. For scanned documents, use an image upload.</p>
                                        </div>
                                    )}
                                    {/* Change file */}
                                    <button
                                        onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                                        className="text-[11px] text-slate-500 hover:text-blue-400 font-bold transition-colors"
                                    >
                                        <i className="fa-solid fa-arrow-rotate-left mr-1"></i>Choose different file
                                    </button>
                                </div>
                            )}

                            {/* Analyze button */}
                            <button
                                onClick={handleAnalyze}
                                disabled={!selectedFile || analyzing}
                                className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl font-black uppercase tracking-wide transition-all text-sm shadow-lg shadow-blue-900/20"
                            >
                                {analyzing ? (
                                    <>
                                        <i className="fa-solid fa-circle-notch animate-spin"></i>
                                        Analyzing… This may take a moment
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-wand-magic-sparkles"></i>
                                        Analyze Document
                                    </>
                                )}
                            </button>

                            {/* Feature pills */}
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { icon: 'fa-font',         label: 'OCR Handwriting' },
                                    { icon: 'fa-pills',        label: 'Medicine Extraction' },
                                    { icon: 'fa-clock',        label: 'Dosage Timing' },
                                    { icon: 'fa-calendar-xmark', label: 'Expiry Detection' },
                                    { icon: 'fa-brain',        label: 'Purpose Classification' },
                                ].map(({ icon, label }) => (
                                    <span key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-400 font-bold">
                                        <i className={`fa-solid ${icon} text-blue-400 text-[10px]`}></i>
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT: Results */}
                        <div>
                            {!result && !analyzing && (
                                <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
                                    <div className="w-20 h-20 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-center">
                                        <i className="fa-solid fa-file-waveform text-slate-700 text-3xl"></i>
                                    </div>
                                    <p className="text-slate-500 font-bold text-center">Upload a document and click<br /><span className="text-blue-400">Analyze Document</span> to see results</p>
                                </div>
                            )}

                            {analyzing && (
                                <div className="flex flex-col items-center justify-center h-full py-20 gap-5">
                                    <div className="relative w-20 h-20">
                                        <div className="absolute inset-0 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                                            <i className="fa-solid fa-wand-magic-sparkles text-blue-400 text-3xl animate-pulse"></i>
                                        </div>
                                        <div className="absolute -inset-1 rounded-3xl border-2 border-blue-500/20 animate-ping"></div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-white font-extrabold text-lg">AI is reading your document</p>
                                        <p className="text-slate-500 text-sm mt-1">OCR → Text Extraction → Medicine Classification</p>
                                    </div>
                                    {/* Progress steps */}
                                    <div className="flex flex-col gap-2 w-full max-w-xs">
                                        {['Running OCR engine…','Extracting doctor & hospital…','Detecting medicines & dosage…','Classifying purpose…'].map((step, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                                                    <i className="fa-solid fa-circle-notch animate-spin text-blue-400 text-[8px]"></i>
                                                </div>
                                                <span className="text-xs text-slate-400 font-bold">{step}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {result && !analyzing && (
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-extrabold text-white">Analysis Result</h2>
                                        <button onClick={clearAll} className="text-[11px] font-bold text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
                                            <i className="fa-solid fa-arrow-rotate-left text-[10px]"></i>New Analysis
                                        </button>
                                    </div>
                                    <ResultPanel result={result} rawPreview={rawPreview} documentType={docType} />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── HISTORY TAB ── */}
                {tab === 'HISTORY' && (
                    <div>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-xl font-extrabold text-white mb-0.5">Analysis History</h2>
                                <p className="text-slate-500 text-sm">All your previously analyzed documents</p>
                            </div>
                            <button onClick={() => fetchHistory(histPage)}
                                className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 border border-white/5 py-2 px-4 rounded-xl text-xs font-bold text-blue-400 transition-all">
                                <i className={`fa-solid fa-rotate-right ${histLoading ? 'animate-spin' : ''}`}></i>
                                Refresh
                            </button>
                        </div>

                        {histLoading ? (
                            <div className="flex flex-col items-center justify-center py-24 gap-4">
                                <i className="fa-solid fa-circle-notch animate-spin text-4xl text-blue-500"></i>
                                <p className="text-slate-500 font-bold">Loading history…</p>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-700 text-2xl">
                                    <i className="fa-solid fa-clock-rotate-left"></i>
                                </div>
                                <p className="text-slate-500 font-bold">No analyses yet</p>
                                <button onClick={() => setTab('ANALYZE')} className="text-blue-400 text-sm font-bold hover:underline">
                                    Analyze your first document
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {history.map(record => (
                                    <HistoryItem key={record.id} record={record} onView={handleViewDetail} />
                                ))}
                                {/* Pagination */}
                                {histPagination && histPagination.pages > 1 && (
                                    <div className="flex items-center justify-between pt-4">
                                        <p className="text-[11px] text-slate-500">
                                            Showing {history.length} of {histPagination.total}
                                        </p>
                                        <div className="flex gap-2">
                                            <button disabled={histPage <= 1} onClick={() => setHistPage(p => p - 1)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 bg-slate-800 disabled:opacity-30">← Prev</button>
                                            <span className="px-3 py-1.5 text-xs text-slate-400">{histPage} / {histPagination.pages}</span>
                                            <button disabled={histPage >= histPagination.pages} onClick={() => setHistPage(p => p + 1)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 bg-slate-800 disabled:opacity-30">Next →</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ── DETAIL MODAL (from history) ── */}
            {detailRecord && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-extrabold text-white">Document Analysis</h3>
                                <button onClick={() => setDetailRecord(null)} className="text-slate-500 hover:text-white">
                                    <i className="fa-solid fa-xmark text-lg"></i>
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-4 font-bold truncate">{detailRecord.original_file_name}</p>
                            {detailRecord.ai_status === 'DONE' && detailRecord.parsed_data ? (
                                <ResultPanel
                                    result={{ parsed: detailRecord.parsed_data }}
                                    rawPreview={detailRecord.ocr_raw_text?.slice(0, 500) || ''}
                                    documentType={detailRecord.document_type}
                                />
                            ) : detailRecord.ai_status === 'FAILED' ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <i className="fa-solid fa-circle-xmark text-red-400 text-4xl"></i>
                                    <p className="text-red-400 font-bold">Analysis failed for this document</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <i className="fa-solid fa-circle-notch animate-spin text-blue-400 text-4xl"></i>
                                    <p className="text-blue-400 font-bold">Still processing…</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIDocumentPage;
