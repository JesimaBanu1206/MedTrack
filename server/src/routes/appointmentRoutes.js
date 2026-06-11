/**
 * appointmentRoutes.js
 * Public appointment booking — no auth required
 */
import express from 'express';
import {
    verifyPatient,
    getHospitalsByCity,
    getHospitalOpTimings,
    bookAppointment,
    bookOnlineConsultation,
    getPatientAppointments,
    getCities,
} from '../controllers/appointmentController.js';
import { getOnlineDoctors } from '../controllers/getOnlineDoctors.js';

const router = express.Router();

router.get('/cities',           getCities);
router.get('/hospitals',        getHospitalsByCity);
router.get('/verify-patient',   verifyPatient);
router.get('/op-timings',       getHospitalOpTimings);
router.get('/online-doctors',   getOnlineDoctors);   // ← doctors who enabled online consult
router.post('/book',            bookAppointment);
router.post('/book-online',     bookOnlineConsultation);
router.get('/my',               getPatientAppointments);

export default router;
