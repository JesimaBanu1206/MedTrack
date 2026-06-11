/**
 * districtRoutes.js
 * District Health Officer portal
 */
import express from 'express';
import {
    districtOfficerLogin,
    getDistrictOverview,
    getHospitalDetail,
    getDiseaseTrends,
    getDistrictAmbulances,
    acknowledgeAlert,
    getDistrictReport
} from '../controllers/districtController.js';
import { verifyToken, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Public
router.post('/login', districtOfficerLogin);

// Protected — district officer only
router.use(verifyToken);
router.use(restrictTo('DISTRICT_OFFICER', 'SUPER_ADMIN'));

router.get('/overview',             getDistrictOverview);
router.get('/hospitals/:id',        getHospitalDetail);
router.get('/disease-trends',       getDiseaseTrends);
router.get('/ambulances',           getDistrictAmbulances);
router.patch('/alerts/:id/acknowledge', acknowledgeAlert);
router.get('/report',               getDistrictReport);

export default router;
