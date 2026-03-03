import express from 'express';
import {
    getPatientDashboard,
    updatePatientProfile,
    getMedicalRecords,
    uploadMedicalRecord,
    deleteMedicalRecord,
    getMedicalRecordById,
    getPrescriptions,
    uploadPrescription,
    getNearbyPharmacies
} from '../controllers/patientController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePatient } from '../middleware/roleMiddleware.js';
import { validate, updatePatientSchema, uploadRecordSchema } from '../middleware/validate.js';
import { upload, handleMulterError } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// All routes require authentication and PATIENT role
router.use(authenticate);
router.use(requirePatient);

/**
 * @route   GET /api/patient/dashboard
 * @desc    Get patient dashboard data
 * @access  Private (Patient only)
 */
router.get('/dashboard', getPatientDashboard);

/**
 * @route   PUT /api/patient/profile
 * @desc    Update patient profile
 * @access  Private (Patient only)
 */
router.put(
    '/profile',
    upload.single('profilePicture'),
    handleMulterError,
    validate(updatePatientSchema),
    updatePatientProfile
);

/**
 * @route   GET /api/patient/medical-records
 * @desc    Get all medical records for patient
 * @access  Private (Patient only)
 */
router.get('/medical-records', getMedicalRecords);

/**
 * @route   GET /api/patient/medical-records/:recordId
 * @desc    Get single medical record by ID
 * @access  Private (Patient only)
 */
router.get('/medical-records/:recordId', getMedicalRecordById);

/**
 * @route   POST /api/patient/medical-records/upload
 * @desc    Upload medical record file
 * @access  Private (Patient only)
 */
router.post(
    '/medical-records/upload',
    uploadLimiter,
    upload.single('file'),
    handleMulterError,
    validate(uploadRecordSchema),
    uploadMedicalRecord
);

/**
 * @route   DELETE /api/patient/medical-records/:recordId
 * @desc    Delete medical record
 * @access  Private (Patient only)
 */
router.delete('/medical-records/:recordId', deleteMedicalRecord);

/**
 * @route   GET /api/patient/prescriptions
 * @desc    Get all prescriptions for patient
 * @access  Private (Patient only)
 */
router.get('/prescriptions', getPrescriptions);

/**
 * @route   POST /api/patient/prescriptions/upload
 * @desc    Upload prescription file
 * @access  Private (Patient only)
 */
router.post(
    '/prescriptions/upload',
    uploadLimiter,
    upload.single('file'),
    handleMulterError,
    uploadPrescription
);

/**
 * @route   GET /api/patient/nearby-pharmacies
 * @desc    Get nearby pharmacies
 * @access  Private (Patient only)
 */
router.get('/nearby-pharmacies', getNearbyPharmacies);

export default router;
