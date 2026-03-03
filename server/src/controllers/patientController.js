import supabase from '../config/supabase.js';
import { config } from '../config/env.js';
import { validateFileType, validateFileSize, generateUniqueFilename } from '../utils/fileValidator.js';
import { createAuditLog, getClientIp, AUDIT_ACTIONS } from '../utils/auditLogger.js';
import { AppError } from '../utils/errors.js';
import { generateMTPatientId } from '../utils/patientIdGenerator.js';
import { generatePrescriptionId } from '../utils/prescriptionIdGenerator.js';
import { createWorker } from 'tesseract.js';

/**
 * GET PATIENT DASHBOARD
 * Returns patient profile and medical records
 * CRITICAL: Must only return data for logged-in patient
 */
export async function getPatientDashboard(req, res, next) {
    const userId = req.user.id; // From auth middleware

    try {
        // Get patient data - MUST filter by user_id
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (patientError || !patient) {
            throw new AppError('Patient profile not found', 404);
        }

        // Get medical records count - MUST filter by patient_id
        const { count: recordsCount, error: countError } = await supabase
            .from('medical_records')
            .select('*', { count: 'exact', head: true })
            .eq('patient_id', patient.id);

        if (countError) {
            console.error('Error counting medical records:', countError);
        }

        // Get recent medical records - MUST filter by patient_id
        const { data: recentRecords, error: recordsError } = await supabase
            .from('medical_records')
            .select('*')
            .eq('patient_id', patient.id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (recordsError) {
            console.error('Error fetching recent records:', recordsError);
        }

        // Audit log
        await createAuditLog({
            userId,
            action: AUDIT_ACTIONS.PATIENT_PROFILE_VIEWED,
            entityType: 'patient',
            entityId: patient.id,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            status: 'SUCCESS'
        });

        res.status(200).json({
            success: true,
            message: 'Patient dashboard data retrieved successfully',
            data: {
                patient: {
                    id: patient.id,
                    patientId: patient.patient_id,
                    fullName: patient.full_name,
                    dob: patient.dob,
                    gender: patient.gender,
                    bloodGroup: patient.blood_group,
                    address: patient.address,
                    emergencyContact: patient.emergency_contact,
                    guardianName: patient.guardian_name,
                    guardianPhone: patient.guardian_phone,
                    profilePictureUrl: patient.profile_picture_url,
                    pincode: patient.medical_history?.pincode,
                    city: patient.medical_history?.city,
                    state: patient.medical_history?.state,
                    createdAt: patient.created_at
                },
                statistics: {
                    totalRecords: recordsCount || 0
                },
                recentRecords: recentRecords || []
            }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * UPDATE PATIENT PROFILE
 * Allows patient to update their own profile
 * Includes profile picture upload and MT ID generation
 */
export async function updatePatientProfile(req, res, next) {
    const userId = req.user.id;
    const file = req.file;
    const {
        fullName,
        dob,
        gender,
        bloodGroup,
        address,
        guardianName,
        guardianPhone,
        relation,
        pincode,
        city,
        state
    } = req.body;

    try {
        // Get existing patient data
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (patientError || !patient) {
            throw new AppError('Patient profile not found', 404);
        }

        let profilePictureUrl = patient.profile_picture_url;
        let patientId = patient.patient_id;

        // 1. Handle Profile Picture Upload
        if (file) {
            // Validate file size
            const sizeValidation = validateFileSize(file.size, config.upload.maxFileSize);
            if (!sizeValidation.valid) {
                throw new AppError(sizeValidation.error, 400);
            }

            // Validate file type
            const typeValidation = await validateFileType(file.buffer, file.mimetype);
            if (!typeValidation.valid) {
                throw new AppError(typeValidation.error, 400);
            }

            // Generate unique filename
            const uniqueFilename = generateUniqueFilename(file.originalname, userId);
            const filePath = `profile-pictures/${userId}/${uniqueFilename}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase
                .storage
                .from('patients')
                .upload(filePath, file.buffer, {
                    contentType: typeValidation.detectedType,
                    upsert: true
                });

            if (uploadError) {
                console.error('Profile picture upload error:', uploadError);
                throw new AppError('Failed to upload profile picture', 500);
            }

            // Get public URL
            const { data: urlData } = supabase
                .storage
                .from('patients')
                .getPublicUrl(filePath);

            profilePictureUrl = urlData.publicUrl;
        }

        // 2. Generate Permanent MT ID if currently PENDING
        if (patientId.startsWith('PENDING')) {
            patientId = generateMTPatientId();
        }

        // 3. Update patient profile
        const { data: updatedPatient, error: updateError } = await supabase
            .from('patients')
            .update({
                full_name: fullName,
                dob,
                gender: gender,
                blood_group: bloodGroup,
                address,
                guardian_name: guardianName,
                guardian_phone: guardianPhone,
                emergency_contact: relation, // Using relation as emergency contact for now as per design
                patient_id: patientId,
                profile_picture_url: profilePictureUrl,
                medical_history: {
                    ...patient.medical_history,
                    pincode,
                    city,
                    state
                }
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (updateError) {
            console.error('Update profile error:', updateError);
            throw new AppError('Failed to update patient profile', 500);
        }

        // Audit log
        await createAuditLog({
            userId,
            action: AUDIT_ACTIONS.PATIENT_UPDATED,
            entityType: 'patient',
            entityId: patient.id,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            metadata: {
                updatedFields: Object.keys(req.body),
                hasNewProfilePicture: !!file,
                newPatientId: patientId !== patient.patient_id ? patientId : undefined
            },
            status: 'SUCCESS'
        });

        res.status(200).json({
            success: true,
            message: 'Patient profile updated successfully',
            data: {
                patient: {
                    ...updatedPatient,
                    fullName: updatedPatient.full_name,
                    bloodGroup: updatedPatient.blood_group,
                    patientId: updatedPatient.patient_id,
                    dob: updatedPatient.dob,
                    profilePictureUrl: updatedPatient.profile_picture_url
                }
            }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * GET ALL MEDICAL RECORDS
 * Returns all medical records for logged-in patient
 */
export async function getMedicalRecords(req, res, next) {
    const userId = req.user.id;
    const { page = 1, limit = 10, category } = req.query;

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

        // Build query - MUST filter by patient_id
        let query = supabase
            .from('medical_records')
            .select('*', { count: 'exact' })
            .eq('patient_id', patient.id);

        // Apply category filter if provided
        if (category) {
            query = query.eq('category', category);
        }

        // Apply pagination
        const offset = (page - 1) * limit;
        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data: records, error: recordsError, count } = await query;

        if (recordsError) {
            throw new AppError('Failed to fetch medical records', 500);
        }

        res.status(200).json({
            success: true,
            message: 'Medical records retrieved successfully',
            data: {
                records: records || [],
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
 * UPLOAD MEDICAL RECORD
 * Upload and validate medical record file
 * CRITICAL: Validate file type using magic numbers
 */
export async function uploadMedicalRecord(req, res, next) {
    const userId = req.user.id;
    const file = req.file;
    const { category = 'GENERAL', description } = req.body;

    try {
        if (!file) {
            throw new AppError('No file uploaded', 400);
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

        // Validate file size
        const sizeValidation = validateFileSize(file.size, config.upload.maxFileSize);
        if (!sizeValidation.valid) {
            throw new AppError(sizeValidation.error, 400);
        }

        // Validate file type using magic numbers
        const typeValidation = await validateFileType(file.buffer, file.mimetype);
        if (!typeValidation.valid) {
            throw new AppError(typeValidation.error, 400);
        }

        // Generate unique filename
        const uniqueFilename = generateUniqueFilename(file.originalname, userId);
        const filePath = `medical-records/${patient.patient_id}/${uniqueFilename}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('medical-records')
            .upload(filePath, file.buffer, {
                contentType: typeValidation.detectedType,
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('File upload error:', uploadError);
            throw new AppError('Failed to upload file to storage', 500);
        }

        // Get public URL (or signed URL for private bucket)
        const { data: urlData } = supabase
            .storage
            .from('medical-records')
            .getPublicUrl(filePath);

        // For private bucket, use createSignedUrl instead:
        // const { data: urlData, error: urlError } = await supabase
        //     .storage
        //     .from('medical-records')
        //     .createSignedUrl(filePath, 31536000); // 1 year expiry

        // Store metadata in database - MUST link to patient_id
        const { data: record, error: recordError } = await supabase
            .from('medical_records')
            .insert({
                patient_id: patient.id,
                file_url: urlData.publicUrl,
                file_name: file.originalname,
                file_type: typeValidation.detectedType,
                file_size: file.size,
                mime_type: typeValidation.detectedType,
                category,
                description,
                uploaded_by: userId
            })
            .select()
            .single();

        if (recordError) {
            console.error('Database insert error:', recordError);
            // Cleanup uploaded file
            await supabase.storage.from('medical-records').remove([filePath]);
            throw new AppError('Failed to save file metadata', 500);
        }

        // Audit log
        await createAuditLog({
            userId,
            action: AUDIT_ACTIONS.MEDICAL_RECORD_UPLOADED,
            entityType: 'medical_record',
            entityId: record.id,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            metadata: {
                fileName: file.originalname,
                fileSize: file.size,
                fileType: typeValidation.detectedType,
                category
            },
            status: 'SUCCESS'
        });

        res.status(201).json({
            success: true,
            message: 'Medical record uploaded successfully',
            data: {
                record
            }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * DELETE MEDICAL RECORD
 * Delete medical record file and metadata
 */
export async function deleteMedicalRecord(req, res, next) {
    const userId = req.user.id;
    const { recordId } = req.params;

    try {
        // Get patient ID
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id, patient_id')
            .eq('user_id', userId)
            .single();

        if (patientError || !patient) {
            throw new AppError('Patient profile not found', 404);
        }

        // Get record - MUST verify ownership
        const { data: record, error: recordError } = await supabase
            .from('medical_records')
            .select('*')
            .eq('id', recordId)
            .eq('patient_id', patient.id) // CRITICAL: Verify ownership
            .single();

        if (recordError || !record) {
            throw new AppError('Medical record not found or access denied', 404);
        }

        // Extract file path from URL
        const urlParts = record.file_url.split('/medical-records/');
        if (urlParts.length < 2) {
            throw new AppError('Invalid file URL', 400);
        }
        const filePath = `medical-records/${urlParts[1]}`;

        // Delete from storage
        const { error: deleteStorageError } = await supabase
            .storage
            .from('medical-records')
            .remove([filePath]);

        if (deleteStorageError) {
            console.error('Storage deletion error:', deleteStorageError);
            // Continue with database deletion even if storage deletion fails
        }

        // Delete from database
        const { error: deleteDbError } = await supabase
            .from('medical_records')
            .delete()
            .eq('id', recordId)
            .eq('patient_id', patient.id); // CRITICAL: Verify ownership

        if (deleteDbError) {
            throw new AppError('Failed to delete medical record', 500);
        }

        // Audit log
        await createAuditLog({
            userId,
            action: AUDIT_ACTIONS.MEDICAL_RECORD_DELETED,
            entityType: 'medical_record',
            entityId: recordId,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            metadata: {
                fileName: record.file_name,
                category: record.category
            },
            status: 'SUCCESS'
        });

        res.status(200).json({
            success: true,
            message: 'Medical record deleted successfully'
        });

    } catch (error) {
        next(error);
    }
}

/**
 * GET MEDICAL RECORD BY ID
 * Retrieve single medical record
 */
export async function getMedicalRecordById(req, res, next) {
    const userId = req.user.id;
    const { recordId } = req.params;

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

        // Get record - MUST verify ownership
        const { data: record, error: recordError } = await supabase
            .from('medical_records')
            .select('*')
            .eq('id', recordId)
            .eq('patient_id', patient.id) // CRITICAL: Verify ownership
            .single();

        if (recordError || !record) {
            throw new AppError('Medical record not found or access denied', 404);
        }

        // Audit log
        await createAuditLog({
            userId,
            action: AUDIT_ACTIONS.MEDICAL_RECORD_VIEWED,
            entityType: 'medical_record',
            entityId: recordId,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            status: 'SUCCESS'
        });

        res.status(200).json({
            success: true,
            message: 'Medical record retrieved successfully',
            data: {
                record
            }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * GET ALL PRESCRIPTIONS
 * Returns all prescriptions for logged-in patient
 */
export async function getPrescriptions(req, res, next) {
    const userId = req.user.id;

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

        // Fetch prescriptions from database
        const { data: prescriptions, error: prescriptionsError } = await supabase
            .from('prescriptions')
            .select('*')
            .eq('patient_id', patient.id)
            .order('created_at', { ascending: false });

        if (prescriptionsError) {
            console.error('Error fetching prescriptions:', prescriptionsError);
            throw new AppError('Failed to fetch prescriptions', 500);
        }

        res.status(200).json({
            success: true,
            message: 'Prescriptions retrieved successfully',
            data: {
                prescriptions: prescriptions || []
            }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * UPLOAD PRESCRIPTION
 * Handles manual upload of prescription files
 */
export async function uploadPrescription(req, res, next) {
    const userId = req.user.id;
    const file = req.file;
    const { docName, hospital, medications, category, date, auto_extract } = req.body;

    try {
        if (!file) {
            throw new AppError('No file uploaded', 400);
        }

        let extractedData = {
            docName: docName || 'Unknown Doctor',
            hospital: hospital || 'Unknown Hospital',
            date: date || new Date().toISOString().split('T')[0],
            category: category || 'General',
            medications: typeof medications === 'string' ? JSON.parse(medications) : (medications || [])
        };

        // Trigger AI Extraction if flag is set
        if (auto_extract === 'true') {
            console.log('Starting AI Extraction...');
            const worker = await createWorker('eng');

            // For a production app, we would handle PDF vs Image differently. 
            // Tesseract handles images. For PDFs, we'd need a converter.
            // Here we assume it's an image or we process the buffer if it's an image type.
            const { data: { text } } = await worker.recognize(file.buffer);
            await worker.terminate();

            console.log('Extracted Text:', text);

            // Smart Parsing Logic
            // Doctor Name
            const docMatch = text.match(/(?:Dr\.|Doctor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
            if (docMatch) extractedData.docName = docMatch[0].trim();

            // Hospital/Clinic
            const hospMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Hospital|Clinic|Medical|Care|Health))/i);
            if (hospMatch) extractedData.hospital = hospMatch[0].trim();

            // Date
            const dateMatch = text.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/);
            if (dateMatch) extractedData.date = dateMatch[0].trim();

            // Medicines Parsing (Simple heuristic)
            const lines = text.split('\n');
            const medicineLines = lines.filter(line =>
                line.match(/(?:Tab|Cap|Inj|Syp|Tablet|Injection|Capsule|Syrup)/i) ||
                line.match(/\d+(?:mg|mcg|ml)/i)
            );

            if (medicineLines.length > 0) {
                extractedData.medications = medicineLines.map(line => {
                    const namePart = line.replace(/(?:Tab|Cap|Inj|Syp|Tablet|Injection|Capsule|Syrup|\d+(?:mg|mcg|ml))/gi, '').trim();
                    const type = line.match(/Injection/i) ? 'Injection' : (line.match(/Syrup/i) ? 'Syrup' : 'Tablet');

                    // Timing heuristics
                    const isMorning = /morning|am|1-0-0|1-0-1|1-1-1/i.test(line);
                    const isAfternoon = /afternoon|1-1-0|0-1-0|1-1-1/i.test(line);
                    const isNight = /night|pm|hs|0-0-1|1-0-1|1-1-1/i.test(line);

                    return {
                        name: namePart.split(' ')[0] || 'Unknown Med',
                        type: type,
                        dosage: line.trim(),
                        timings: { morning: isMorning, afternoon: isAfternoon, evening: false, night: isNight },
                        instructions: "As found on prescription."
                    };
                });
            }

            // Category estimation
            if (text.match(/sugar|diabetes|glucose|metformin|insulin/i)) extractedData.category = 'Diabetes';
            else if (text.match(/pressure|bp|hypertension|amlodipine/i)) extractedData.category = 'Blood Pressure';
            else if (text.match(/cholesterol|statin|lipid/i)) extractedData.category = 'Cholesterol';
        }

        // Use extracted or provided data
        const finalDocName = extractedData.docName;
        const finalHospital = extractedData.hospital;
        const finalMedications = extractedData.medications;
        const finalCategory = extractedData.category;
        const finalDate = extractedData.date;

        // Get patient data
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id, patient_id')
            .eq('user_id', userId)
            .single();

        if (patientError || !patient) {
            throw new AppError('Patient profile not found', 404);
        }

        // Validate file size and type
        const sizeValidation = validateFileSize(file.size, config.upload.maxFileSize);
        if (!sizeValidation.valid) {
            throw new AppError(sizeValidation.error, 400);
        }

        const typeValidation = await validateFileType(file.buffer, file.mimetype);
        if (!typeValidation.valid) {
            throw new AppError(typeValidation.error, 400);
        }

        // Generate unique filename and path
        const uniqueFilename = generateUniqueFilename(file.originalname, userId);
        const filePath = `prescriptions/${patient.patient_id}/${uniqueFilename}`;

        // Upload to Supabase Storage (bucket: prescriptions)
        // Note: Make sure the bucket 'prescriptions' exists in Supabase
        const { error: uploadError } = await supabase
            .storage
            .from('medical-records') // Reusing existing bucket to avoid bucket creation issues
            .upload(filePath, file.buffer, {
                contentType: typeValidation.detectedType,
                upsert: false
            });

        if (uploadError) {
            console.error('SUPABASE STORAGE ERROR:', uploadError);
            throw new AppError(`Storage upload failed: ${uploadError.message}`, 500);
        }

        // Get public URL
        const { data: urlData } = supabase
            .storage
            .from('medical-records')
            .getPublicUrl(filePath);

        // Generate custom prescription ID
        const customPrescriptionId = generatePrescriptionId();

        // Store in database
        const { data: prescription, error: prescriptionError } = await supabase
            .from('prescriptions')
            .insert({
                patient_id: patient.id,
                doctor_name: finalDocName,
                hospital_name: finalHospital,
                file_url: urlData.publicUrl,
                file_type: typeValidation.detectedType,
                status: 'active',
                issued_date: finalDate,
                medications: finalMedications,
                category: finalCategory,
                custom_id: customPrescriptionId
            })
            .select()
            .single();

        if (prescriptionError) {
            console.error('DATABASE INSERT ERROR:', prescriptionError);
            // Cleanup: remove file from storage
            await supabase.storage.from('medical-records').remove([filePath]);
            throw new AppError(`Database save failed: ${prescriptionError.message}`, 500);
        }

        // Audit log
        await createAuditLog({
            userId,
            action: AUDIT_ACTIONS.MEDICAL_RECORD_UPLOADED,
            entityType: 'prescription',
            entityId: prescription.id,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            metadata: {
                docName,
                hospital,
                fileName: file.originalname
            },
            status: 'SUCCESS'
        });

        res.status(201).json({
            success: true,
            message: 'Prescription uploaded successfully',
            data: {
                prescription
            }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * GET NEARBY PHARMACIES
 * Returns list of pharmacies nearby
 */
export async function getNearbyPharmacies(req, res, next) {
    try {
        // In a real app, we would use external API like Google Places
        // Mock data for now, but served from backend
        const pharmacies = [
            { id: 1, name: 'MedPlus', area: 'Koramangala', dist: '1.2 km', rating: '4.3', reviews: '128', status: 'Open until 10 PM', color: 'teal', phone: '080-12345678' },
            { id: 2, name: 'Apollo Pharmacy', area: 'HSR Layout', dist: '2.1 km', rating: '4.5', reviews: '94', status: 'Open 24/7', color: 'blue', phone: '080-87654321' },
            { id: 3, name: 'Netmeds', area: 'Online', dist: 'Free Delivery', rating: '4.2', reviews: '210', status: 'Express Delivery', color: 'indigo', phone: '1800-123-444' },
            { id: 4, name: 'HealthKart', area: 'Indiranagar', dist: '3.5 km', rating: '4.1', reviews: '56', status: 'Open until 9 PM', color: 'purple', phone: '080-11122233' },
            { id: 5, name: 'Wellness Forever', area: 'Jayanagar', dist: '4.2 km', rating: '4.6', reviews: '150', status: 'Open 24/7', color: 'emerald', phone: '080-44455566' }
        ];

        res.status(200).json({
            success: true,
            data: {
                pharmacies
            }
        });
    } catch (error) {
        next(error);
    }
}
