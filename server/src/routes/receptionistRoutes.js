/**
 * receptionistRoutes.js
 * Receptionist portal — appointments, OP timings, patient queue
 */
import express from 'express';
import {
    receptionistLogin,
    getReceptionistDashboard,
    getTodayAppointments,
    updateAppointmentStatus,
    getOpTimings,
    upsertOpTiming,
    searchPatient,
    walkInCheckin,
    getQueueStatus
} from '../controllers/receptionistController.js';
import { verifyToken, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Public
router.post('/login', receptionistLogin);

// Protected
router.use(verifyToken);
router.use(restrictTo('RECEPTIONIST', 'HOSPITAL_ADMIN'));

router.get('/dashboard',              getReceptionistDashboard);
router.get('/appointments',           getTodayAppointments);
router.patch('/appointments/:id',     updateAppointmentStatus);
router.get('/op-timings',             getOpTimings);
router.post('/op-timings',            upsertOpTiming);
router.get('/search-patient',         searchPatient);
router.post('/walk-in',               walkInCheckin);
router.get('/queue',                  getQueueStatus);

export default router;
