import express from 'express';
import {
    getHospitalAdminDashboard, createStaff, getAllStaff, updateStaff,
    softDeleteStaff, getHospitalActivityLog, hospitalAdminLogin, exportStaffCSV,
    getStaffSchedules, createStaffSchedule, deleteStaffSchedule
} from '../controllers/hospitalAdminController.js';
import {
    getHospitalDoctorAttendance, getHospitalSchedules, createDoctorSchedule,
    updateHospitalResources, createAdminNotice,
    getStaffLiveStatus, sendStaffMessage, getAdminSentMessages,
    getHospitalDoctors, deleteDoctorSchedule, getAdminNotices, deleteAdminNotice,
    getHospitalBedStats
} from '../controllers/doctorController.js';
import {
    getWards, createWard, updateWard, deleteWard,
    getWardBeds, updateBedStatus,
    getWardAssignments, assignDoctorToWard, removeWardAssignment,
    updateHospitalLocation, getHospitalLocation
} from '../controllers/wardController.js';
import { verifyToken, restrictTo } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import Joi from 'joi';

const router = express.Router();

const createStaffSchema = Joi.object({
    fullName:   Joi.string().min(2).max(255).required().trim(),
    email:      Joi.string().email().max(255).required().trim().lowercase(),
    phone:      Joi.string().pattern(/^[0-9]{10}$/).required()
                   .messages({ 'string.pattern.base': 'Valid 10-digit phone required' }),
    staffRole:  Joi.string().valid('DOCTOR','NURSE','PHARMACIST','LAB_TECHNICIAN','RECEPTIONIST','OTHER_STAFF').required(),
    department: Joi.string().max(120).optional().allow('', null)
});
const updateStaffSchema = Joi.object({
    fullName:   Joi.string().min(2).max(255).optional().trim(),
    phone:      Joi.string().pattern(/^[0-9]{10}$/).optional(),
    department: Joi.string().max(120).optional().allow('', null),
    staffRole:  Joi.string().valid('DOCTOR','NURSE','PHARMACIST','LAB_TECHNICIAN','RECEPTIONIST','OTHER_STAFF').optional(),
    isActive:   Joi.boolean().optional()
});
const loginSchema = Joi.object({
    email:    Joi.string().email().required().trim().lowercase(),
    password: Joi.string().required()
});

// ── Public
router.post('/login', validate(loginSchema), hospitalAdminLogin);

// ── Protected
router.use(verifyToken);
router.use(restrictTo('HOSPITAL_ADMIN'));

// Core admin
router.get('/dashboard',               getHospitalAdminDashboard);
router.get('/activity-log',            getHospitalActivityLog);
router.get('/staff/export',            exportStaffCSV);
router.post('/staff',                  validate(createStaffSchema), createStaff);
router.get('/staff',                   getAllStaff);
router.put('/staff/:staffId',          validate(updateStaffSchema), updateStaff);
router.delete('/staff/:staffId',       softDeleteStaff);
router.get('/staff-schedules',         getStaffSchedules);
router.post('/staff-schedules',        createStaffSchedule);
router.delete('/staff-schedules/:scheduleId', deleteStaffSchedule);

// Doctor / schedule management
router.get('/staff-status',            getStaffLiveStatus);
router.get('/doctors',                 getHospitalDoctors);
router.get('/doctor-attendance',       getHospitalDoctorAttendance);
router.get('/doctor-schedules',        getHospitalSchedules);
router.post('/doctor-schedules',       createDoctorSchedule);
router.delete('/doctor-schedules/:scheduleId', deleteDoctorSchedule);
router.put('/resources',               updateHospitalResources);

// Notices
router.get('/notices',                 getAdminNotices);
router.post('/notices',                createAdminNotice);
router.delete('/notices/:noticeId',    deleteAdminNotice);

// Messaging
router.post('/messages',               sendStaffMessage);
router.get('/messages',                getAdminSentMessages);

// Bed stats overview
router.get('/bed-stats',                     getHospitalBedStats);

// Ward & Bed management
router.get('/wards',                         getWards);
router.post('/wards',                        createWard);
router.put('/wards/:wardId',                 updateWard);
router.delete('/wards/:wardId',              deleteWard);
router.get('/wards/:wardId/beds',            getWardBeds);
router.patch('/beds/:bedId/status',          updateBedStatus);

// Ward doctor assignments
router.get('/ward-assignments',              getWardAssignments);
router.post('/ward-assignments',             assignDoctorToWard);
router.delete('/ward-assignments/:assignmentId', removeWardAssignment);

// Hospital location (for ambulance routing)
router.get('/location',                      getHospitalLocation);
router.put('/location',                      updateHospitalLocation);

export default router;
