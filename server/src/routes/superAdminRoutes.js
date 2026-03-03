import express from 'express';
import {
    getDashboardStats,
    getResourceMonitor,
    getEmergencyDriverRequests,
    updateEmergencyDriverAccess,
    updateSuperAdminAccount,
    getAmbulanceUsageOverview,
    getEmergencyAlerts,
    getAllDriversFleet
} from '../controllers/superAdminController.js';
import { verifyToken, restrictTo } from '../middleware/auth.js';
import {
    validate,
    emergencyDriverApprovalSchema,
    superAdminAccountUpdateSchema
} from '../middleware/validate.js';

const router = express.Router();

// All routes require Super Admin role
router.use(verifyToken);
router.use(restrictTo('SUPER_ADMIN'));

router.get('/stats', getDashboardStats);
router.get('/resources', getResourceMonitor);

// ── Emergency / Ambulance ──────────────────────────────────────────
// IMPORTANT: specific static paths MUST come before parameterized routes
// e.g. /emergency/drivers/fleet must be before /emergency/drivers/:driverId/access
router.get('/emergency/alerts',          getEmergencyAlerts);
router.get('/emergency/drivers',         getEmergencyDriverRequests);
router.get('/emergency/drivers/fleet',   getAllDriversFleet);
router.patch('/emergency/drivers/:driverId/access', validate(emergencyDriverApprovalSchema), updateEmergencyDriverAccess);

router.patch('/account', validate(superAdminAccountUpdateSchema), updateSuperAdminAccount);
router.get('/ambulance/use', getAmbulanceUsageOverview);

export default router;
