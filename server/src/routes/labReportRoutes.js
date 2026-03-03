import express from 'express';
import {
    getLabReports,
    getLabReportById,
    uploadLabReport,
    deleteLabReport,
    getNearbyLabs
} from '../controllers/labReportController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePatient } from '../middleware/roleMiddleware.js';
import { upload, handleMulterError } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// All routes require authentication and PATIENT role
router.use(authenticate);
router.use(requirePatient);

/**
 * @route   GET /api/patient/lab-reports
 * @desc    Get all lab reports for patient
 * @access  Private (Patient only)
 */
router.get('/', getLabReports);

/**
 * @route   GET /api/patient/lab-reports/nearby-labs
 * @desc    Get nearby diagnostic labs
 * @access  Private (Patient only)
 */
router.get('/nearby-labs', getNearbyLabs);

/**
 * @route   GET /api/patient/lab-reports/:reportId
 * @desc    Get single lab report by ID
 * @access  Private (Patient only)
 */
router.get('/:reportId', getLabReportById);

/**
 * @route   POST /api/patient/lab-reports/upload
 * @desc    Upload lab report with optional AI scan
 * @access  Private (Patient only)
 */
router.post(
    '/upload',
    uploadLimiter,
    upload.single('file'),
    handleMulterError,
    uploadLabReport
);

/**
 * @route   DELETE /api/patient/lab-reports/:reportId
 * @desc    Delete lab report
 * @access  Private (Patient only)
 */
router.delete('/:reportId', deleteLabReport);

export default router;
