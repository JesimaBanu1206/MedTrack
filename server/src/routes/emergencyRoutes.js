import express from 'express';
import { createEmergencyAlert } from '../controllers/emergencyController.js';
import { optionalAuthenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/emergency/alert
 * @desc    Create an emergency alert with photo and location
 * @access  Public/Private (Authentication optional for emergencies)
 */
router.post('/alert', optionalAuthenticate, createEmergencyAlert);

export default router;
