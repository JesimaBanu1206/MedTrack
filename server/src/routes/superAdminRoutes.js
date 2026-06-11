import express from 'express';
import {
    getDashboardStats,
    getResourceMonitor,
    getEmergencyDriverRequests,
    updateEmergencyDriverAccess,
    updateSuperAdminAccount,
    getAmbulanceUsageOverview,
    getEmergencyAlerts,
    getAllDriversFleet,
    getSuperAdminBedAvailability
} from '../controllers/superAdminController.js';
import {
    createDistrictOfficer,
    getDistrictOfficers,
    updateDistrictOfficer,
    resetDistrictOfficerPassword
} from '../controllers/districtOfficerController.js';
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
router.get('/emergency/alerts',          getEmergencyAlerts);
router.get('/emergency/drivers',         getEmergencyDriverRequests);
router.get('/emergency/drivers/fleet',   getAllDriversFleet);
router.patch('/emergency/drivers/:driverId/access', validate(emergencyDriverApprovalSchema), updateEmergencyDriverAccess);

router.patch('/account', validate(superAdminAccountUpdateSchema), updateSuperAdminAccount);
router.get('/ambulance/use', getAmbulanceUsageOverview);
router.get('/bed-availability', getSuperAdminBedAvailability);

// ── District Officers ──────────────────────────────────────────────
router.get('/district-officers',                           getDistrictOfficers);
router.post('/district-officers',                          createDistrictOfficer);
router.patch('/district-officers/:id',                     updateDistrictOfficer);
router.post('/district-officers/:id/reset-password',       resetDistrictOfficerPassword);

export default router;
