/**
 * aiDocumentRoutes.js
 * AI Smart Medical Document Analyzer routes
 */

import express from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/auth.js';
import {
    analyzeDocument,
    getAnalysisHistory,
    getAnalysisById
} from '../controllers/aiDocumentController.js';

const router = express.Router();

// Multer: memory storage for AI processing
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },  // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg','image/jpg','image/png','image/webp','application/pdf'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only images (JPEG, PNG, WebP) and PDF files are allowed'));
    }
});

router.use(verifyToken);

router.post('/analyze',         upload.single('document'), analyzeDocument);
router.get('/history',          getAnalysisHistory);
router.get('/analysis/:id',     getAnalysisById);

export default router;
