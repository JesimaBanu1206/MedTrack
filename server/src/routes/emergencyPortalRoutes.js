import express from 'express';
import { verifyToken, restrictTo } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
    emergencyDriverRegisterSchema,
    emergencyDriverVerifyOtpSchema,
    emergencyDriverLoginSchema,
    emergencyDriverLocationSchema,
    emergencyDriverStatusSchema,
    emergencyDriverSosNoteSchema,
    emergencyDriverResponseLogSchema,
    emergencyAlertStatusSchema
} from '../middleware/validate.js';
import {
    emergencyDriverRegister,
    emergencyDriverVerifyOtp,
    emergencyDriverLogin,
    getEmergencyDriverProfile,
    updateEmergencyDriverLocation,
    updateEmergencyDriverDutyStatus,
    updateEmergencyDriverSosNote,
    getEmergencyDriverLocationHistory,
    logEmergencyDriverResponse,
    getActiveAlerts,
    updateAlertStatus,
    getMissions
} from '../controllers/emergencyPortalController.js';

import { upload } from '../middleware/upload.js';

const router = express.Router();

router.post('/register', upload.fields([
    { name: 'licenseImage', maxCount: 1 },
    { name: 'profileImage', maxCount: 1 }
]), validate(emergencyDriverRegisterSchema), emergencyDriverRegister);

router.post('/verify-otp', validate(emergencyDriverVerifyOtpSchema), emergencyDriverVerifyOtp);
router.post('/login', validate(emergencyDriverLoginSchema), emergencyDriverLogin);

router.use(verifyToken);
router.use(restrictTo('AMBULANCE'));

router.get('/profile', getEmergencyDriverProfile);
router.post('/location', validate(emergencyDriverLocationSchema), updateEmergencyDriverLocation);
router.patch('/duty-status', validate(emergencyDriverStatusSchema), updateEmergencyDriverDutyStatus);
router.post('/sos-note', validate(emergencyDriverSosNoteSchema), updateEmergencyDriverSosNote);
router.post('/response-log', validate(emergencyDriverResponseLogSchema), logEmergencyDriverResponse);
router.get('/location-history', getEmergencyDriverLocationHistory);

// Emergency Missions
router.get('/alerts/active', getActiveAlerts);
router.patch('/alerts/:alertId/status', validate(emergencyAlertStatusSchema), updateAlertStatus);
router.get('/missions', getMissions);

export default router;
