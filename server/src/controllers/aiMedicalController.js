/**
 * aiMedicalController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AI Medical Analysis — analyses patient vitals, lab reports, prescriptions
 * and medical history to detect abnormal values, predict disease risks, and
 * generate clinical alerts for the doctor dashboard.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import supabase from '../config/supabase.js';
import { AppError } from '../utils/errors.js';

function parseBP(bp) {
    if (!bp) return null;
    const parts = bp.replace(/\s/g, '').split('/');
    if (parts.length !== 2) return null;
    const s = parseInt(parts[0]);
    const d = parseInt(parts[1]);
    if (isNaN(s) || isNaN(d)) return null;
    return { systolic: s, diastolic: d };
}

function parseSugar(sugar) {
    if (!sugar) return null;
    const n = parseFloat(sugar);
    return isNaN(n) ? null : n;
}

function analyseVitals(vitals) {
    const alerts = [];
    const risks  = [];
    const summary = [];
    if (!vitals) return { alerts, risks, summary };

    const bp = parseBP(vitals.bp);
    if (bp) {
        if (bp.systolic >= 180 || bp.diastolic >= 120) {
            alerts.push({ type: 'CRITICAL', icon: '🚨', message: `Hypertensive Crisis — BP ${vitals.bp}. Immediate intervention required.`, category: 'CARDIOVASCULAR' });
            risks.push('Heart Disease Risk'); risks.push('Stroke Risk');
        } else if (bp.systolic >= 140 || bp.diastolic >= 90) {
            alerts.push({ type: 'HIGH', icon: '⚠️', message: `High Blood Pressure (Stage 2) — BP ${vitals.bp}. Monitor closely.`, category: 'CARDIOVASCULAR' });
            risks.push('Heart Disease Risk');
        } else if (bp.systolic >= 130 || bp.diastolic >= 80) {
            alerts.push({ type: 'MODERATE', icon: '⚠️', message: `Elevated Blood Pressure (Stage 1) — BP ${vitals.bp}.`, category: 'CARDIOVASCULAR' });
        } else if (bp.systolic < 90 || bp.diastolic < 60) {
            alerts.push({ type: 'HIGH', icon: '⚠️', message: `Low Blood Pressure — BP ${vitals.bp}. Risk of hypotensive episode.`, category: 'CARDIOVASCULAR' });
        } else { summary.push(`BP ${vitals.bp} — Normal`); }
    }

    const sugar = parseSugar(vitals.sugar);
    if (sugar !== null) {
        if (sugar >= 300) {
            alerts.push({ type: 'CRITICAL', icon: '🚨', message: `Severe Hyperglycemia — ${sugar} mg/dL. Urgent management needed.`, category: 'METABOLIC' });
            risks.push('Diabetes Risk'); risks.push('Diabetic Ketoacidosis Risk');
        } else if (sugar >= 200) {
            alerts.push({ type: 'HIGH', icon: '⚠️', message: `High Blood Sugar — ${sugar} mg/dL. Possible uncontrolled diabetes.`, category: 'METABOLIC' });
            risks.push('Diabetes Risk');
        } else if (sugar >= 140) {
            alerts.push({ type: 'MODERATE', icon: '🟡', message: `Pre-diabetic range — ${sugar} mg/dL. HbA1c follow-up recommended.`, category: 'METABOLIC' });
            risks.push('Pre-Diabetes Risk');
        } else if (sugar < 70) {
            alerts.push({ type: 'CRITICAL', icon: '🚨', message: `Hypoglycemia — ${sugar} mg/dL. Immediate glucose administration needed.`, category: 'METABOLIC' });
            risks.push('Hypoglycaemic Episode Risk');
        } else { summary.push(`Blood Sugar ${sugar} mg/dL — Normal`); }
    }

    const hr = vitals.heart_rate ? parseInt(vitals.heart_rate) : null;
    if (hr !== null && !isNaN(hr)) {
        if (hr > 150) {
            alerts.push({ type: 'CRITICAL', icon: '🚨', message: `Severe Tachycardia — HR ${hr} bpm. Cardiac evaluation urgent.`, category: 'CARDIOVASCULAR' });
            risks.push('Heart Disease Risk');
        } else if (hr > 100) {
            alerts.push({ type: 'HIGH', icon: '⚠️', message: `Tachycardia — HR ${hr} bpm. Investigate cause.`, category: 'CARDIOVASCULAR' });
        } else if (hr < 50) {
            alerts.push({ type: 'HIGH', icon: '⚠️', message: `Bradycardia — HR ${hr} bpm. Check cardiac function.`, category: 'CARDIOVASCULAR' });
        } else { summary.push(`Heart Rate ${hr} bpm — Normal`); }
    }

    const temp = vitals.temperature ? parseFloat(vitals.temperature) : null;
    if (temp !== null && !isNaN(temp)) {
        if (temp >= 104) {
            alerts.push({ type: 'CRITICAL', icon: '🚨', message: `High-grade Fever — ${temp}°F. Risk of febrile seizure / sepsis.`, category: 'INFECTION' });
            risks.push('Infection Indicators'); risks.push('Sepsis Risk');
        } else if (temp >= 101) {
            alerts.push({ type: 'HIGH', icon: '⚠️', message: `Fever — ${temp}°F. Investigate for infection.`, category: 'INFECTION' });
            risks.push('Infection Indicators');
        } else if (temp > 99) {
            alerts.push({ type: 'MODERATE', icon: '🟡', message: `Low-grade Fever — ${temp}°F. Monitor for progression.`, category: 'INFECTION' });
        } else if (temp < 96) {
            alerts.push({ type: 'HIGH', icon: '⚠️', message: `Hypothermia — ${temp}°F. Investigate cause.`, category: 'METABOLIC' });
        } else { summary.push(`Temperature ${temp}°F — Normal`); }
    }

    const spo2 = vitals.spo2 ? parseInt(vitals.spo2) : null;
    if (spo2 !== null && !isNaN(spo2)) {
        if (spo2 < 90) {
            alerts.push({ type: 'CRITICAL', icon: '🚨', message: `Critical Hypoxia — SpO2 ${spo2}%. Immediate oxygen therapy required.`, category: 'RESPIRATORY' });
            risks.push('Respiratory Failure Risk');
        } else if (spo2 < 95) {
            alerts.push({ type: 'HIGH', icon: '⚠️', message: `Low SpO2 — ${spo2}%. Supplemental oxygen may be needed.`, category: 'RESPIRATORY' });
        } else { summary.push(`SpO2 ${spo2}% — Normal`); }
    }

    const weight = vitals.weight ? parseFloat(vitals.weight) : null;
    if (weight !== null && !isNaN(weight)) {
        if (weight < 40) {
            alerts.push({ type: 'MODERATE', icon: '🟡', message: `Very Low Body Weight — ${weight} kg. Nutritional assessment recommended.`, category: 'METABOLIC' });
            risks.push('Malnutrition Risk');
        } else if (weight > 120) {
            alerts.push({ type: 'MODERATE', icon: '🟡', message: `Obesity — ${weight} kg. Cardiovascular and metabolic risk elevated.`, category: 'METABOLIC' });
            risks.push('Heart Disease Risk'); risks.push('Diabetes Risk');
        }
    }

    return { alerts, risks: [...new Set(risks)], summary };
}

function analyseLabReports(labReports) {
    const alerts = [];
    if (!labReports?.length) return alerts;
    const pending = labReports.filter(l => l.status === 'PENDING');
    if (pending.length > 0) alerts.push({ type: 'INFO', icon: '🔬', message: `${pending.length} lab test(s) pending. Results may change clinical picture.`, category: 'LAB' });
    for (const lab of labReports.filter(l => l.status === 'COMPLETED' && l.result_notes)) {
        const notes = (lab.result_notes || '').toLowerCase();
        if (notes.includes('high') || notes.includes('elevated') || notes.includes('abnormal'))
            alerts.push({ type: 'HIGH', icon: '⚠️', message: `Abnormal Lab Result: ${lab.test_type} — ${lab.result_notes}`, category: 'LAB' });
        if (notes.includes('positive') && (notes.includes('infection') || notes.includes('bacteria') || notes.includes('culture')))
            alerts.push({ type: 'HIGH', icon: '⚠️', message: `Infection Indicated: ${lab.test_type} — ${lab.result_notes}`, category: 'INFECTION' });
        if (notes.includes('critical') || notes.includes('urgent'))
            alerts.push({ type: 'CRITICAL', icon: '🚨', message: `Critical Lab Value: ${lab.test_type} — ${lab.result_notes}`, category: 'LAB' });
    }
    return alerts;
}

function analyseMedicalHistory(medicalHistory, prescriptions) {
    const alerts = [];
    const risks  = [];
    const history = (medicalHistory || '').toLowerCase();
    const prxText = (prescriptions || []).map(p => (p.diagnosis || '') + ' ' + (p.chief_complaint || '')).join(' ').toLowerCase();
    const combined = history + ' ' + prxText;

    if (combined.includes('diabetes') || combined.includes('sugar')) { risks.push('Diabetes Risk'); alerts.push({ type: 'INFO', icon: '💡', message: 'History of Diabetes noted. Monitor blood sugar. HbA1c recommended.', category: 'METABOLIC' }); }
    if (combined.includes('hypertension') || combined.includes('blood pressure')) { risks.push('Heart Disease Risk'); alerts.push({ type: 'INFO', icon: '💡', message: 'History of Hypertension noted. Regular BP monitoring essential.', category: 'CARDIOVASCULAR' }); }
    if (combined.includes('heart') || combined.includes('cardiac')) { risks.push('Heart Disease Risk'); alerts.push({ type: 'INFO', icon: '💡', message: 'Cardiac history noted. ECG and cardiac enzymes if symptoms present.', category: 'CARDIOVASCULAR' }); }
    if (combined.includes('allerg')) alerts.push({ type: 'INFO', icon: '💊', message: 'Known allergies in history. Review before prescribing.', category: 'ALLERGY' });
    if (combined.includes('asthma') || combined.includes('copd') || combined.includes('bronch')) { risks.push('Respiratory Risk'); alerts.push({ type: 'INFO', icon: '💡', message: 'Respiratory history noted. Avoid NSAIDs/β-blockers if possible.', category: 'RESPIRATORY' }); }
    if (combined.includes('kidney') || combined.includes('renal') || combined.includes('ckd')) { risks.push('Renal Disease Risk'); alerts.push({ type: 'INFO', icon: '💡', message: 'Renal history noted. Adjust medication doses accordingly.', category: 'RENAL' }); }

    return { alerts, risks: [...new Set(risks)] };
}

function computeRiskScore(allAlerts) {
    let score = 0;
    for (const a of allAlerts) {
        if (a.type === 'CRITICAL') score += 30;
        else if (a.type === 'HIGH') score += 15;
        else if (a.type === 'MODERATE') score += 7;
        else score += 2;
    }
    return Math.min(score, 100);
}

// POST /api/doctor/ai-analysis
export async function getAIMedicalAnalysis(req, res, next) {
    const { patientPid, patientId, manualVitals } = req.body;
    try {
        let patient = null;
        let vitals  = manualVitals || null;
        let labReports    = [];
        let prescriptions = [];

        if (patientId || patientPid) {
            const matchField = patientId ? 'id' : 'patient_id';
            const matchValue = patientId || patientPid;

            const { data: p } = await supabase.from('patients')
                .select('id, full_name, dob, gender, blood_group, allergies, medical_history')
                .eq(matchField, matchValue).maybeSingle();
            patient = p;

            if (patient) {
                if (!manualVitals) {
                    const { data: vData } = await supabase.from('nurse_vitals')
                        .select('bp, temperature, heart_rate, sugar, weight, spo2, recorded_at')
                        .eq('patient_id', patient.id)
                        .order('recorded_at', { ascending: false }).limit(1).maybeSingle();
                    if (vData) vitals = vData;
                }
                const { data: labs } = await supabase.from('lab_requests')
                    .select('test_type, status, result_notes, completed_at')
                    .eq('patient_id', patient.id).eq('hospital_id', req.user.hospitalId)
                    .order('created_at', { ascending: false }).limit(10);
                labReports = labs || [];

                const { data: rxData } = await supabase.from('prescriptions')
                    .select('diagnosis, chief_complaint')
                    .eq('patient_id', patient.id)
                    .order('created_at', { ascending: false }).limit(5);
                prescriptions = rxData || [];
            }
        }

        const vitalsAnalysis  = analyseVitals(vitals);
        const labAlerts       = analyseLabReports(labReports);
        const historyAnalysis = analyseMedicalHistory(patient?.medical_history, prescriptions);

        const allAlerts = [...vitalsAnalysis.alerts, ...labAlerts, ...historyAnalysis.alerts];
        const allRisks  = [...new Set([...vitalsAnalysis.risks, ...historyAnalysis.risks])];
        const riskScore = computeRiskScore(allAlerts);
        const riskLevel = riskScore >= 70 ? 'CRITICAL' : riskScore >= 40 ? 'HIGH' : riskScore >= 20 ? 'MODERATE' : 'LOW';

        const recommendations = [];
        if (allRisks.includes('Diabetes Risk'))           recommendations.push('Order HbA1c, Fasting Blood Sugar, Post-prandial Sugar');
        if (allRisks.includes('Heart Disease Risk'))       recommendations.push('ECG, Echocardiogram, Lipid Profile, Troponin if symptomatic');
        if (allRisks.includes('Infection Indicators'))     recommendations.push('CBC with differential, CRP, Blood Culture, Urine Culture');
        if (allRisks.includes('Respiratory Risk'))         recommendations.push('Spirometry, Chest X-Ray, Peak Flow assessment');
        if (allRisks.includes('Renal Disease Risk'))       recommendations.push('Serum Creatinine, BUN, eGFR, Urine Routine/Microscopy');
        if (allRisks.includes('Sepsis Risk'))              recommendations.push('URGENT: Blood cultures x2, Lactate, IV access, broad-spectrum antibiotics');
        if (allRisks.includes('Hypoglycaemic Episode Risk')) recommendations.push('STAT: Oral/IV glucose, Recheck sugar in 15 min');

        res.status(200).json({
            success: true,
            data: {
                patient: patient ? { name: patient.full_name, gender: patient.gender, bloodGroup: patient.blood_group, allergies: patient.allergies } : null,
                vitalsUsed: vitals,
                riskScore,
                riskLevel,
                risks: allRisks,
                criticalAlerts: allAlerts.filter(a => a.type === 'CRITICAL'),
                highAlerts:     allAlerts.filter(a => a.type === 'HIGH'),
                allAlerts,
                normalSummary: vitalsAnalysis.summary,
                recommendations,
                labsAnalysed: labReports.length,
                analysedAt: new Date().toISOString()
            }
        });
    } catch (error) { next(error); }
}
