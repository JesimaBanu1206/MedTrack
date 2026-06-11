/**
 * hospitalRoutes.js
 * Super Admin → GH & PHC Centres management routes
 */

import express from 'express';
import {
    createHospital,
    getAllHospitals,
    getHospitalById,
    updateHospital,
    toggleHospitalStatus,
    softDeleteHospital,
    getHospitalAnalytics,
    exportHospitalsCSV,
    getHospitalAdmin,
    updateHospitalAdmin
} from '../controllers/hospitalController.js';
import { verifyToken, restrictTo } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import Joi from 'joi';

const router = express.Router();

// ── Validation Schemas ───────────────────────────────────────────────────────
const createHospitalSchema = Joi.object({
    hospitalName:  Joi.string().min(2).max(255).required().trim(),
    hospitalCode:  Joi.string().min(2).max(50).required().trim()
                      .pattern(/^[A-Za-z0-9\-_]+$/),
    type:          Joi.string().valid('GH','PHC','PRIVATE','CLINIC').required(),
    address:       Joi.string().max(500).optional().allow('', null),
    district:      Joi.string().max(120).optional().allow('', null),
    city:          Joi.string().max(120).optional().allow('', null),
    contactEmail:  Joi.string().email().max(255).required().trim().lowercase(),
    contactPhone:  Joi.string().pattern(/^[0-9]{10}$/).required(),
    licenseNo:     Joi.string().max(100).optional().allow('', null),
    planType:      Joi.string().valid('MONTHLY','YEARLY','PPP').optional().default('MONTHLY'),
    startDate:     Joi.string().optional().allow('', null),
    renewalDate:   Joi.string().optional().allow('', null),
    price:         Joi.string().optional().allow('', null),
    adminName:     Joi.string().max(255).optional().allow('', null),
    adminPhone:    Joi.string().max(20).optional().allow('', null),
    username:      Joi.string().max(100).optional().allow('', null),
    password:      Joi.string().max(100).optional().allow('', null),
    permissions:   Joi.object().optional(),
    status:        Joi.string().valid('ACTIVE','INACTIVE').optional().default('ACTIVE')
});

const updateHospitalSchema = Joi.object({
    hospitalName:  Joi.string().min(2).max(255).optional().trim(),
    type:          Joi.string().valid('GH','PHC','PRIVATE','CLINIC').optional(),
    address:       Joi.string().max(500).optional().allow('', null),
    district:      Joi.string().max(120).optional().allow('', null),
    city:          Joi.string().max(120).optional().allow('', null),
    contactEmail:  Joi.string().email().max(255).optional().trim().lowercase(),
    contactPhone:  Joi.string().pattern(/^[0-9]{10}$/).optional(),
    licenseNo:     Joi.string().max(100).optional().allow('', null),
    planType:      Joi.string().valid('MONTHLY','YEARLY','PPP').optional(),
    startDate:     Joi.string().optional().allow('', null),
    renewalDate:   Joi.string().optional().allow('', null),
    price:         Joi.string().optional().allow('', null),
    isActive:      Joi.boolean().optional()
});

const updateAdminSchema = Joi.object({
    name:        Joi.string().max(255).optional(),
    email:       Joi.string().email().optional().lowercase(),
    phone:       Joi.string().max(20).optional(),
    username:    Joi.string().max(100).optional(),
    password:    Joi.string().max(100).optional().allow('', null),
    permissions: Joi.object().optional()
});

// All routes require Super Admin
router.use(verifyToken);
router.use(restrictTo('SUPER_ADMIN'));

// Analytics (before /:id to avoid conflict)
router.get('/analytics', getHospitalAnalytics);
router.get('/export/csv', exportHospitalsCSV);

// CRUD
router.post('/',                          validate(createHospitalSchema), createHospital);
router.get('/',                           getAllHospitals);
router.get('/:id',                        getHospitalById);
router.put('/:id',                        validate(updateHospitalSchema), updateHospital);
router.patch('/:id/toggle-status',        toggleHospitalStatus);
router.delete('/:id',                     softDeleteHospital);

// Admin management for existing hospital
router.get('/:idOrCode/admin',            getHospitalAdmin);
router.put('/:idOrCode/admin',            validate(updateAdminSchema), updateHospitalAdmin);

export default router;
