import supabase from '../config/supabase.js';
import { config } from '../config/env.js';
import { validateFileType, validateFileSize, generateUniqueFilename } from '../utils/fileValidator.js';
import { createAuditLog, getClientIp, AUDIT_ACTIONS } from '../utils/auditLogger.js';
import { AppError } from '../utils/errors.js';
import { generateReportId } from '../utils/reportIdGenerator.js';
import { createWorker } from 'tesseract.js';

/**
 * GET ALL LAB REPORTS
 * Returns all lab reports for logged-in patient
 */
export async function getLabReports(req, res, next) {
    const userId = req.user.id;
    const { page = 1, limit = 20, category, status } = req.query;

    try {
        // Get patient ID
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (patientError || !patient) {
            throw new AppError('Patient profile not found', 404);
        }

        // Build query
        let query = supabase
            .from('lab_reports')
            .select('*', { count: 'exact' })
            .eq('patient_id', patient.id);

        if (category && category !== 'All') {
            query = query.eq('category', category);
        }
        if (status && status !== 'All') {
            query = query.eq('status', status);
        }

        const offset = (page - 1) * limit;
        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data: reports, error: reportsError, count } = await query;

        if (reportsError) {
            console.error('Error fetching lab reports:', reportsError);
            throw new AppError('Failed to fetch lab reports', 500);
        }

        res.status(200).json({
            success: true,
            message: 'Lab reports retrieved successfully',
            data: {
                reports: reports || [],
                pagination: {
                    total: count || 0,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil((count || 0) / limit)
                }
            }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * GET SINGLE LAB REPORT
 */
export async function getLabReportById(req, res, next) {
    const userId = req.user.id;
    const { reportId } = req.params;

    try {
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (patientError || !patient) {
            throw new AppError('Patient profile not found', 404);
        }

        const { data: report, error: reportError } = await supabase
            .from('lab_reports')
            .select('*')
            .eq('id', reportId)
            .eq('patient_id', patient.id)
            .single();

        if (reportError || !report) {
            throw new AppError('Lab report not found or access denied', 404);
        }

        res.status(200).json({
            success: true,
            data: { report }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * UPLOAD LAB REPORT (with Smart Scan AI)
 */
export async function uploadLabReport(req, res, next) {
    const userId = req.user.id;
    const file = req.file;
    const {
        test_name, doctor_name, lab_name,
        test_date, report_date, lab_id,
        category, auto_extract
    } = req.body;

    try {
        if (!file) {
            throw new AppError('No file uploaded', 400);
        }

        let extractedData = {
            testName: test_name || 'Lab Test',
            doctorName: doctor_name || '',
            labName: lab_name || '',
            testDate: test_date || new Date().toISOString().split('T')[0],
            reportDate: report_date || new Date().toISOString().split('T')[0],
            labId: lab_id || '',
            category: category || 'General',
            results: [],
            status: 'Normal',
            aiSummary: ''
        };

        // AI Smart Scan Extraction
        if (auto_extract === 'true') {
            console.log('Starting AI Lab Report Extraction...');
            const worker = await createWorker('eng');
            const { data: { text } } = await worker.recognize(file.buffer);
            await worker.terminate();

            console.log('Extracted Lab Report Text:', text);

            // Test Name extraction
            const testNameMatch = text.match(/(?:test\s*name|investigation|profile|panel)[\s:]*([A-Za-z\s]+?)(?:\n|$)/i);
            if (testNameMatch) extractedData.testName = testNameMatch[1].trim();

            // Doctor Name
            const docMatch = text.match(/(?:Dr\.|Doctor|Ref\.?\s*(?:by|doctor))[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
            if (docMatch) extractedData.doctorName = docMatch[0].replace(/Ref\.?\s*(?:by|doctor)[\s:]*/i, '').trim();

            // Lab Name
            const labMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Lab|Laboratory|Diagnostics|Diagnostic|Pathology|Center|Centre))/i);
            if (labMatch) extractedData.labName = labMatch[0].trim();

            // Date extraction
            const dateMatch = text.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/);
            if (dateMatch) {
                extractedData.testDate = dateMatch[0].trim();
                extractedData.reportDate = dateMatch[0].trim();
            }

            // Lab ID
            const labIdMatch = text.match(/(?:Lab\s*(?:ID|No|Number|Ref))[\s:#]*([A-Z0-9-]+)/i);
            if (labIdMatch) extractedData.labId = labIdMatch[1].trim();

            // Results extraction — look for parameter/value/unit/range patterns
            const lines = text.split('\n');
            const resultLines = lines.filter(line =>
                line.match(/\d+\.?\d*\s*(?:g\/dL|mg\/dL|mmol|%|IU|U\/L|mEq|mm|cells|x10|fL|pg|\/mm|count)/i) ||
                line.match(/(?:hemoglobin|glucose|cholesterol|triglycerides|creatinine|urea|platelets|WBC|RBC|ESR|HbA1c|TSH|T3|T4|bilirubin|albumin|protein|calcium|sodium|potassium|SGPT|SGOT|ALT|AST)/i)
            );

            if (resultLines.length > 0) {
                extractedData.results = resultLines.map(line => {
                    // Try to extract parameter name, value, unit
                    const parts = line.split(/\s{2,}|\t/);
                    const valueMatch = line.match(/(\d+\.?\d*)\s*(g\/dL|mg\/dL|mmol\/L|%|IU\/L|U\/L|mEq\/L|mm\/hr|cells\/cumm|x10\^?[0-9]*\/[uμ]L|fL|pg|\/mm3|count\/[uμ]L|ng\/mL|mIU\/L)?/i);

                    const paramName = parts[0] ? parts[0].replace(/[:\-]/g, '').trim() : 'Unknown Parameter';
                    const value = valueMatch ? valueMatch[1] : '';
                    const unit = valueMatch && valueMatch[2] ? valueMatch[2] : '';

                    // Determine status heuristics
                    let status = 'Normal';
                    if (line.match(/high|above|elevated|abnormal|H\b/i)) status = 'High';
                    if (line.match(/low|below|decreased|L\b/i)) status = 'Low';

                    return {
                        parameter: paramName,
                        value: value,
                        unit: unit,
                        status: status
                    };
                }).filter(r => r.value); // Only include results with a value
            }

            // Category estimation
            if (text.match(/CBC|complete\s*blood|hemoglobin|WBC|RBC|platelet/i)) {
                extractedData.category = 'Hematology';
                if (!testNameMatch) extractedData.testName = 'Complete Blood Count (CBC)';
            }
            else if (text.match(/glucose|sugar|HbA1c|fasting/i)) {
                extractedData.category = 'Diabetes';
                if (!testNameMatch) extractedData.testName = 'Blood Glucose Test';
            }
            else if (text.match(/cholesterol|triglyceride|HDL|LDL|lipid/i)) {
                extractedData.category = 'Cardiology';
                if (!testNameMatch) extractedData.testName = 'Lipid Profile';
            }
            else if (text.match(/thyroid|TSH|T3|T4/i)) {
                extractedData.category = 'Thyroid';
                if (!testNameMatch) extractedData.testName = 'Thyroid Profile';
            }
            else if (text.match(/liver|SGPT|SGOT|ALT|AST|bilirubin/i)) {
                extractedData.category = 'Liver';
                if (!testNameMatch) extractedData.testName = 'Liver Function Test';
            }
            else if (text.match(/kidney|creatinine|urea|BUN/i)) {
                extractedData.category = 'Kidney';
                if (!testNameMatch) extractedData.testName = 'Kidney Function Test';
            }
            else if (text.match(/urine|urinalysis/i)) {
                extractedData.category = 'Urine';
                if (!testNameMatch) extractedData.testName = 'Urinalysis';
            }

            // Determine overall status
            const hasAbnormal = extractedData.results.some(r => r.status === 'High' || r.status === 'Low');
            extractedData.status = hasAbnormal ? 'Attention Needed' : 'Normal';

            // Generate AI Summary
            const normalCount = extractedData.results.filter(r => r.status === 'Normal').length;
            const abnormalCount = extractedData.results.filter(r => r.status !== 'Normal').length;
            extractedData.aiSummary = `AI analyzed ${extractedData.results.length} parameters. ${normalCount} are within normal range${abnormalCount > 0 ? `, ${abnormalCount} require attention` : ''}. Category: ${extractedData.category}. ${hasAbnormal ? 'Please consult your doctor for the flagged results.' : 'All results appear normal.'}`;
        }

        // Get patient data
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id, patient_id')
            .eq('user_id', userId)
            .single();

        if (patientError || !patient) {
            throw new AppError('Patient profile not found', 404);
        }

        // Validate file
        const sizeValidation = validateFileSize(file.size, config.upload.maxFileSize);
        if (!sizeValidation.valid) throw new AppError(sizeValidation.error, 400);

        const typeValidation = await validateFileType(file.buffer, file.mimetype);
        if (!typeValidation.valid) throw new AppError(typeValidation.error, 400);

        // Upload to storage
        const uniqueFilename = generateUniqueFilename(file.originalname, userId);
        const filePath = `lab-reports/${patient.patient_id}/${uniqueFilename}`;

        const { error: uploadError } = await supabase
            .storage
            .from('medical-records')
            .upload(filePath, file.buffer, {
                contentType: typeValidation.detectedType,
                upsert: false
            });

        if (uploadError) {
            console.error('Lab report upload error:', uploadError);
            throw new AppError(`Storage upload failed: ${uploadError.message}`, 500);
        }

        const { data: urlData } = supabase
            .storage
            .from('medical-records')
            .getPublicUrl(filePath);

        const customReportId = generateReportId();

        // Insert into database
        const { data: report, error: reportError } = await supabase
            .from('lab_reports')
            .insert({
                patient_id: patient.id,
                test_name: extractedData.testName,
                doctor_name: extractedData.doctorName,
                lab_name: extractedData.labName,
                test_date: extractedData.testDate,
                report_date: extractedData.reportDate,
                lab_id: extractedData.labId || customReportId,
                file_url: urlData.publicUrl,
                file_type: typeValidation.detectedType,
                results: extractedData.results,
                status: extractedData.status,
                category: extractedData.category,
                ai_summary: extractedData.aiSummary
            })
            .select()
            .single();

        if (reportError) {
            console.error('Lab report DB insert error:', reportError);
            await supabase.storage.from('medical-records').remove([filePath]);
            throw new AppError(`Database save failed: ${reportError.message}`, 500);
        }

        // Audit log
        await createAuditLog({
            userId,
            action: AUDIT_ACTIONS.MEDICAL_RECORD_UPLOADED,
            entityType: 'lab_report',
            entityId: report.id,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            metadata: {
                testName: extractedData.testName,
                labName: extractedData.labName,
                fileName: file.originalname,
                aiExtracted: auto_extract === 'true'
            },
            status: 'SUCCESS'
        });

        res.status(201).json({
            success: true,
            message: 'Lab report uploaded successfully',
            data: { report }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * DELETE LAB REPORT
 */
export async function deleteLabReport(req, res, next) {
    const userId = req.user.id;
    const { reportId } = req.params;

    try {
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id, patient_id')
            .eq('user_id', userId)
            .single();

        if (patientError || !patient) {
            throw new AppError('Patient profile not found', 404);
        }

        const { data: report, error: reportError } = await supabase
            .from('lab_reports')
            .select('*')
            .eq('id', reportId)
            .eq('patient_id', patient.id)
            .single();

        if (reportError || !report) {
            throw new AppError('Lab report not found or access denied', 404);
        }

        // Delete from storage
        const urlParts = report.file_url.split('/medical-records/');
        if (urlParts.length >= 2) {
            await supabase.storage.from('medical-records').remove([urlParts[1]]);
        }

        // Delete from database
        const { error: deleteError } = await supabase
            .from('lab_reports')
            .delete()
            .eq('id', reportId)
            .eq('patient_id', patient.id);

        if (deleteError) {
            throw new AppError('Failed to delete lab report', 500);
        }

        await createAuditLog({
            userId,
            action: AUDIT_ACTIONS.MEDICAL_RECORD_DELETED,
            entityType: 'lab_report',
            entityId: reportId,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            status: 'SUCCESS'
        });

        res.status(200).json({
            success: true,
            message: 'Lab report deleted successfully'
        });

    } catch (error) {
        next(error);
    }
}

/**
 * GET NEARBY LABS (mock data)
 */
export async function getNearbyLabs(req, res, next) {
    try {
        const labs = [
            { id: 1, name: 'SRL Diagnostics', area: 'Koramangala', dist: '1.5 km', rating: '4.5', reviews: '245', status: 'Open until 9 PM', color: 'teal', phone: '080-22334455', tests: 'Blood, Urine, ECG' },
            { id: 2, name: 'Dr. Lal PathLabs', area: 'HSR Layout', dist: '2.3 km', rating: '4.6', reviews: '312', status: 'Open until 8 PM', color: 'blue', phone: '080-33445566', tests: 'Full Body Checkup, MRI' },
            { id: 3, name: 'Thyrocare', area: 'Online', dist: 'Home Collection', rating: '4.3', reviews: '189', status: 'Book Online', color: 'indigo', phone: '1800-222-111', tests: 'Thyroid, Diabetes, Heart' },
            { id: 4, name: 'Metropolis Labs', area: 'Indiranagar', dist: '3.1 km', rating: '4.4', reviews: '167', status: 'Open until 7 PM', color: 'purple', phone: '080-55667788', tests: 'Cancer Markers, Liver' },
            { id: 5, name: 'Healthians', area: 'Online', dist: 'Home Collection', rating: '4.7', reviews: '420', status: 'Book Online', color: 'emerald', phone: '1800-333-222', tests: 'Full Body, Vitamin Panel' }
        ];

        res.status(200).json({
            success: true,
            data: { labs }
        });
    } catch (error) {
        next(error);
    }
}
