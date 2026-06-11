import express from 'express';
import {
    doctorLogin, getDoctorProfile, updateDoctorProfile, changeDoctorPassword,
    getTodaySchedule, attendanceCheckIn, attendanceBreakStart, attendanceBreakEnd,
    attendanceCheckOut, getTodayAttendance, getDoctorDashboard, getOPQueue,
    addToQueue, getPatientForConsult, createPrescription, createLabRequest,
    getDoctorPrescriptions, updateQueueStatus, getAttendanceHistory,
    getOnlineConsultProfile, updateOnlineConsultProfile,
    getLatestNotices, getMyMessages, markMessageRead,
    applyDoctorLeave, getMyLeaveRequests,
    getDoctorLabNotifications, getDoctorLabRequests
} from '../controllers/doctorController.js';
import { verifyToken, restrictTo } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import Joi from 'joi';
import {
    getDoctorIPWards, updateAdmissionNotes,
    getOnlineConsultBookings, createOnlineConsultBooking, updateBookingStatus
} from '../controllers/wardController.js';
import { getAIMedicalAnalysis } from '../controllers/aiMedicalController.js';

const router = express.Router();

const loginSchema = Joi.object({
    email: Joi.string().email().required().trim().lowercase(),
    password: Joi.string().required()
});
const prescriptionSchema = Joi.object({
    queueEntryId:   Joi.string().uuid().optional().allow(null),
    patientId:      Joi.string().uuid().optional().allow(null),
    patientName:    Joi.string().required(),
    diagnosis:      Joi.string().required(),
    chiefComplaint: Joi.string().optional().allow('', null),
    notes:          Joi.string().optional().allow('', null),
    followUpDate:   Joi.string().optional().allow('', null),
    isLabRequired:  Joi.boolean().optional(),
    medicines: Joi.array().items(Joi.object({
        name:         Joi.string().required(),
        dosage:       Joi.string().optional().allow('', null),
        frequency:    Joi.string().optional().allow('', null),
        morning:      Joi.boolean().optional(),
        afternoon:    Joi.boolean().optional(),
        night:        Joi.boolean().optional(),
        beforeFood:   Joi.boolean().optional(),
        durationDays: Joi.number().integer().min(1).optional(),
        instructions: Joi.string().optional().allow('', null)
    })).optional()
});

// ── PUBLIC
router.post('/login', validate(loginSchema), doctorLogin);

// ── PROTECTED
router.use(verifyToken);
router.use(restrictTo('DOCTOR','NURSE','PHARMACIST','LAB_TECHNICIAN','RECEPTIONIST','OTHER_STAFF'));

router.get('/profile',                   getDoctorProfile);
router.put('/profile',                   updateDoctorProfile);
router.post('/change-password',          changeDoctorPassword);
router.get('/dashboard',                 getDoctorDashboard);
router.get('/notices',                   getLatestNotices);
router.get('/messages',                  getMyMessages);
router.patch('/messages/:msgId/read',    markMessageRead);
router.get('/schedule/today',            restrictTo('DOCTOR'), getTodaySchedule);
router.get('/attendance/today',          getTodayAttendance);
router.get('/attendance/history',        getAttendanceHistory);
router.get('/leave-requests',            restrictTo('DOCTOR'), getMyLeaveRequests);
router.post('/leave-requests',           restrictTo('DOCTOR'), applyDoctorLeave);
router.post('/attendance/check-in',      attendanceCheckIn);
router.post('/attendance/break-start',   attendanceBreakStart);
router.post('/attendance/break-end',     attendanceBreakEnd);
router.post('/attendance/check-out',     attendanceCheckOut);
router.get('/queue',                     getOPQueue);
router.post('/queue',                    addToQueue);
router.patch('/queue/:queueId/status',   updateQueueStatus);
router.get('/patient/:patientPid',       restrictTo('DOCTOR'), getPatientForConsult);
router.post('/prescription',             restrictTo('DOCTOR'), validate(prescriptionSchema), createPrescription);
router.get('/prescriptions',             restrictTo('DOCTOR'), getDoctorPrescriptions);
router.post('/lab-request',              restrictTo('DOCTOR'), createLabRequest);
router.get('/online-consult/profile',                 restrictTo('DOCTOR'), getOnlineConsultProfile);
router.put('/online-consult/profile',                 restrictTo('DOCTOR'), updateOnlineConsultProfile);
router.get('/online-consult/bookings',                restrictTo('DOCTOR'), getOnlineConsultBookings);
router.post('/online-consult/bookings',               restrictTo('DOCTOR'), createOnlineConsultBooking);
router.patch('/online-consult/bookings/:bookingId/status', restrictTo('DOCTOR'), updateBookingStatus);

// IP Ward routes
router.get('/ip-wards',                               restrictTo('DOCTOR'), getDoctorIPWards);
router.patch('/admissions/:admissionId/notes',        restrictTo('DOCTOR'), updateAdmissionNotes);

// Lab requests & notifications
router.get('/lab-requests',                           restrictTo('DOCTOR'), getDoctorLabRequests);
router.get('/lab-notifications',                      restrictTo('DOCTOR'), getDoctorLabNotifications);

// AI Medical Analysis
router.post('/ai-analysis',                           restrictTo('DOCTOR'), getAIMedicalAnalysis);

export default router;
