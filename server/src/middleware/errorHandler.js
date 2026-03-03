import { AppError } from '../utils/errors.js';
import { config } from '../config/env.js';

/**
 * Global error handler middleware
 * Handles all errors and sends appropriate response
 */
export function errorHandler(err, req, res, next) {
    // Always log the full error in development
    if (config.nodeEnv === 'development') {
        console.error('\n━━━ SERVER ERROR ━━━');
        console.error('Message :', err.message);
        if (err.originalError) console.error('DB Cause:', err.originalError.message);
        console.error('Stack   :', err.stack?.split('\n').slice(0, 5).join('\n'));
        console.error('━━━━━━━━━━━━━━━━━━━\n');
    } else {
        console.error('SERVER ERROR:', err.message);
    }

    // Default error values
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let errors = err.errors || null;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation error';
        errors = Object.values(err.errors).map(e => e.message);
    }

    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    // Supabase / network errors
    if (err.code === '23505') { // Unique violation
        statusCode = 409;
        message = 'Resource already exists';
    }

    if (err.code === '23503') { // Foreign key violation
        statusCode = 400;
        message = 'Invalid reference';
    }

    if (err.code === 'PGRST116') { // PostgREST - no rows returned
        statusCode = 404;
        message = 'Resource not found';
    }

    // Network / fetch failures (Supabase unreachable)
    if (
        err.message === 'fetch failed' ||
        err.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        err.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        err.name === 'TypeError' && err.message?.includes('fetch')
    ) {
        statusCode = 503;
        message = 'Database service is temporarily unreachable. Please try again later.';
    }

    // Send error response
    res.status(statusCode).json({
        success: false,
        message,
        ...(errors && { errors }),
        ...(config.nodeEnv === 'development' && { stack: err.stack })
    });
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req, res, next) {
    const error = new AppError(`Route ${req.originalUrl} not found`, 404);
    next(error);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
