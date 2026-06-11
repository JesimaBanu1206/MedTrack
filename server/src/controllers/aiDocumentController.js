/**
 * aiDocumentController.js
 * AI Smart Medical Document Analyzer
 * Uses Tesseract.js for OCR + rule-based NLP for extraction
 */

import supabase from '../config/supabase.js';
import { createWorker } from 'tesseract.js';
import { AppError } from '../utils/errors.js';
import { createActivityLog } from '../utils/activityLogger.js';
import path from 'path';
import fs from 'fs';

// ─────────────────────────────────────────────────────────────────────────────
// NLP EXTRACTION  — rule-based medicine + dosage parser
// ─────────────────────────────────────────────────────────────────────────────

// Common medicine keywords for classification
const DIABETES_MEDS     = ['metformin','glipizide','glimepiride','insulin','sitagliptin','empagliflozin','januvia','jardiance','glucophage'];
const BP_MEDS           = ['amlodipine','losartan','lisinopril','atenolol','ramipril','telmisartan','olmesartan','valsartan','enalapril'];
const FEVER_MEDS        = ['paracetamol','ibuprofen','acetaminophen','aspirin','naproxen','diclofenac','nimesulide','mefenamic'];
const ANTIBIOTIC_MEDS   = ['amoxicillin','azithromycin','ciprofloxacin','doxycycline','metronidazole','cefixime','clindamycin','cotrimoxazole'];

function classifyPurpose(medicineName) {
    const lower = medicineName.toLowerCase();
    if (DIABETES_MEDS.some(m => lower.includes(m)))   return 'Diabetes';
    if (BP_MEDS.some(m => lower.includes(m)))          return 'Blood Pressure';
    if (FEVER_MEDS.some(m => lower.includes(m)))       return 'Fever/Pain';
    if (ANTIBIOTIC_MEDS.some(m => lower.includes(m))) return 'Infection/Antibiotic';
    return 'General';
}

function extractMedicines(text) {
    const medicines = [];
    // Pattern: "1. Medicine Name 500mg - 1-0-1" or "Tab. XYZ 10mg bd"
    const lines = text.split(/\n|\r/);
    const medPattern = /(?:tab|cap|syp|inj|oint|gel|drops?)?\.?\s*([A-Za-z][A-Za-z0-9\s\-]+?)\s*(\d+\.?\d*\s*(?:mg|ml|mcg|g|iu|units?)?)\s*[-–]?\s*([\d\-]+(?:\s*times?\s*(?:a\s*day|daily)?)?|(?:od|bd|tds|qid|hs|sos|stat|bid|tid)?)/gi;

    lines.forEach(line => {
        let m;
        while ((m = medPattern.exec(line)) !== null) {
            const name    = m[1]?.trim();
            const dosage  = m[2]?.trim() || '';
            const timing  = parseTiming(m[3]?.trim() || line);
            if (name && name.length > 2 && name.length < 60) {
                medicines.push({
                    name,
                    dosage,
                    timing,
                    purpose: classifyPurpose(name)
                });
            }
        }
    });

    return medicines;
}

function parseTiming(raw) {
    const lower = (raw || '').toLowerCase();
    if (/1-0-1|bid|twice|bd/.test(lower))        return 'Morning & Night';
    if (/1-1-1|tds|tid|three/.test(lower))        return 'Morning, Afternoon & Night';
    if (/1-0-0|od|once|morning/.test(lower))      return 'Morning';
    if (/0-0-1|hs|night|bedtime/.test(lower))     return 'Night';
    if (/0-1-0|afternoon/.test(lower))            return 'Afternoon';
    if (/1-1-0/.test(lower))                      return 'Morning & Afternoon';
    return raw || 'As directed';
}

function extractDoctorName(text) {
    // Look for "Dr." prefix
    const match = text.match(/Dr\.?\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/);
    return match ? match[0] : null;
}

function extractHospitalName(text) {
    const match = text.match(/(?:Hospital|Clinic|Medical\s+Centre|Health\s+Care|Institute)[^\n]*/i);
    return match ? match[0].trim() : null;
}

function extractDate(text) {
    // Various date formats
    const patterns = [
        /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,
        /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+(\d{2,4})/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) {
            try {
                const d = new Date(m[0]);
                if (!isNaN(d)) return d.toISOString().split('T')[0];
            } catch {}
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYZE DOCUMENT
// POST /api/ai/analyze
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeDocument(req, res, next) {
    const file = req.file;
    if (!file) return next(new AppError('No file uploaded', 400));

    const documentType = req.body.documentType || 'PRESCRIPTION';
    const patientId    = req.body.patientId || null;

    // hospital_id from token (null for patient self-upload)
    const hospitalId = req.user?.hospitalId || null;

    // Create DB record immediately as PROCESSING
    let analysisId;

    try {
        const { data: record, error: insErr } = await supabase
            .from('ai_document_analyses')
            .insert({
                patient_id: patientId,
                hospital_id: hospitalId,
                uploaded_by: req.user.id,
                document_type: documentType.toUpperCase(),
                original_file_name: file.originalname,
                ai_status: 'PROCESSING',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select('id')
            .single();

        if (insErr) throw new AppError('Failed to create analysis record: ' + insErr.message, 500);
        analysisId = record.id;

        // ── OCR ──────────────────────────────────────────────────────────────
        let rawText = '';

        if (file.mimetype === 'application/pdf') {
            // For PDFs we use extracted text (if embedded) via a simple approach
            // Tesseract can handle PDF if rendered to image — skip for now, flag as partial
            rawText = `[PDF: ${file.originalname}] OCR skipped for PDF in this version. Use image upload for best results.`;
        } else {
            // Image OCR
            const worker = await createWorker('eng', 1, {
                logger: () => {}  // suppress verbose output
            });
            const { data: { text } } = await worker.recognize(file.buffer || file.path);
            await worker.terminate();
            rawText = text;
        }

        // ── NLP EXTRACTION ───────────────────────────────────────────────────
        const issueDate   = extractDate(rawText);
        const expiryDate  = issueDate
            ? new Date(new Date(issueDate).setFullYear(new Date(issueDate).getFullYear() + 1)).toISOString().split('T')[0]
            : null;

        const parsed = {
            doctorName:    extractDoctorName(rawText),
            hospitalName:  extractHospitalName(rawText),
            issueDate,
            expiryDate,
            medicines:     extractMedicines(rawText),
            rawTextLength: rawText.length
        };

        // ── UPLOAD FILE TO SUPABASE STORAGE ──────────────────────────────────
        let fileUrl = null;
        const fileBuffer = file.buffer;
        const storageKey = `ai-docs/${analysisId}/${file.originalname}`;

        if (fileBuffer) {
            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from('medical-records')
                .upload(storageKey, fileBuffer, {
                    contentType: file.mimetype,
                    upsert: true
                });

            if (!uploadErr) {
                const { data: urlData } = supabase.storage
                    .from('medical-records')
                    .getPublicUrl(storageKey);
                fileUrl = urlData?.publicUrl || null;
            }
        }

        // ── UPDATE RECORD ────────────────────────────────────────────────────
        const { data: finalRecord, error: updateErr } = await supabase
            .from('ai_document_analyses')
            .update({
                ocr_raw_text:       rawText.slice(0, 10000),  // cap at 10k chars
                parsed_data:        parsed,
                expiry_date:        expiryDate,
                original_file_url:  fileUrl,
                ai_status:          'DONE',
                updated_at:         new Date().toISOString()
            })
            .eq('id', analysisId)
            .select()
            .single();

        if (updateErr) throw new AppError('Failed to save analysis result', 500);

        await createActivityLog({
            hospitalId,
            userId: req.user.id,
            action: 'AI_DOCUMENT_ANALYZED',
            entityType: 'ai_document_analyses',
            entityId: analysisId,
            ipAddress: req.ip,
            metadata: { documentType, medicineCount: parsed.medicines.length }
        });

        res.status(200).json({
            success: true,
            message: 'Document analyzed successfully',
            data: {
                analysisId,
                documentType,
                parsed,
                fileUrl,
                rawTextPreview: rawText.slice(0, 500)
            }
        });

    } catch (error) {
        // Mark as FAILED in DB
        if (analysisId) {
            await supabase
                .from('ai_document_analyses')
                .update({ ai_status: 'FAILED', updated_at: new Date().toISOString() })
                .eq('id', analysisId)
                .catch(() => {});
        }
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ANALYSIS HISTORY
// GET /api/ai/history
// ─────────────────────────────────────────────────────────────────────────────
export async function getAnalysisHistory(req, res, next) {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        let query = supabase
            .from('ai_document_analyses')
            .select('*', { count: 'exact' })
            .eq('is_deleted', false)
            .eq('uploaded_by', req.user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;
        if (error) throw new AppError('Failed to fetch analysis history', 500);

        res.status(200).json({
            success: true,
            data: data || [],
            pagination: { total: count || 0, page: parseInt(page), limit: parseInt(limit) }
        });
    } catch (error) {
        next(error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE ANALYSIS
// GET /api/ai/analysis/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function getAnalysisById(req, res, next) {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('ai_document_analyses')
            .select('*')
            .eq('id', id)
            .eq('uploaded_by', req.user.id)
            .eq('is_deleted', false)
            .single();

        if (error || !data) throw new AppError('Analysis record not found', 404);

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}
