/**
 * nurseRoutes.js
 * Nurse dashboard routes
 */

import express from 'express';
import {
    getNurseDashboard,
    recordVitals,
    getPatientVitalsHistory,
    updatePatientStatus,
    getNurseQueue,
    completeLabRequest,
    getNursePatient,
    getAllLabRequests
} from '../controllers/nurseController.js';
import {
    getAllWardsForAdmission, admitPatient, getAdmissions, dischargePatient
} from '../controllers/wardController.js';
import { verifyToken, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);
router.use(restrictTo('NURSE', 'LAB_TECHNICIAN', 'PHARMACIST', 'RECEPTIONIST'));

router.get('/dashboard',                            getNurseDashboard);
router.get('/queue',                                getNurseQueue);
router.post('/vitals',                              recordVitals);
router.get('/vitals/:patientId',                    getPatientVitalsHistory);
router.get('/patient/:patientPid',                  getNursePatient);
router.get('/lab-requests',                         restrictTo('NURSE', 'LAB_TECHNICIAN'), getAllLabRequests);
router.patch('/queue/:queueId/status',              updatePatientStatus);
router.patch('/lab-requests/:requestId/complete',   restrictTo('NURSE', 'LAB_TECHNICIAN'), completeLabRequest);

// Ward & Admission routes (Nurse + Receptionist)
router.get('/wards',                                getAllWardsForAdmission);
router.get('/admissions',                           getAdmissions);
router.post('/admissions',                          admitPatient);
router.patch('/admissions/:admissionId/discharge',  dischargePatient);

export default router;
