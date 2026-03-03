import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Swal from 'sweetalert2';
import AOS from 'aos';
import 'aos/dist/aos.css';
import 'animate.css';
import './Dashboard.css';
import './ReportsPage.css';
import axiosInstance from '../api/axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ReportsPage = () => {
    const navigate = useNavigate();
    const { logout, user, fetchProfile } = useAuthStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState('All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReport, setSelectedReport] = useState(null);

    const [dbReports, setDbReports] = useState([]);
    const [nearbyLabs, setNearbyLabs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Reference range database for common tests
    const referenceRanges = {
        'Hemoglobin': '13.5-17.5 g/dL',
        'WBC Count': '4,500-11,000 cells/\u00b5L',
        'White Blood Cells': '4,500-11,000 cells/\u00b5L',
        'Platelet Count': '150,000-450,000/\u00b5L',
        'Platelets': '150,000-450,000/\u00b5L',
        'RBC Count': '4.5-5.9 million/\u00b5L',
        'Red Blood Cells': '4.5-5.9 million/\u00b5L',
        'Hematocrit': '38.3-48.6%',
        'MCV': '80-100 fL',
        'Total Cholesterol': '<200 mg/dL',
        'HDL Cholesterol': '>40 mg/dL',
        'LDL Cholesterol': '<100 mg/dL',
        'Triglycerides': '<150 mg/dL',
        'VLDL': '2-30 mg/dL',
        'TSH': '0.4-4.0 mIU/L',
        'T3 Total': '80-200 ng/dL',
        'T4 Total': '5.0-12.0 \u00b5g/dL',
        'Free T4': '0.8-1.8 ng/dL',
        'Glucose': '70-100 mg/dL',
        'HbA1c': '<5.7%',
        'Creatinine': '0.7-1.3 mg/dL',
        'Urea': '7-20 mg/dL',
        'SGPT': '7-56 U/L',
        'SGOT': '10-40 U/L',
        'ALT': '7-56 U/L',
        'AST': '10-40 U/L',
        'Bilirubin': '0.1-1.2 mg/dL',
        'Albumin': '3.5-5.5 g/dL',
        'Calcium': '8.5-10.5 mg/dL',
        'Sodium': '136-145 mEq/L',
        'Potassium': '3.5-5.0 mEq/L',
        'ESR': '0-22 mm/hr',
    };

    // AI interpretation data for each test category
    const aiInterpretations = {
        'Complete Blood Count (CBC)': {
            testOverview: 'A complete blood count (CBC) is a blood test used to evaluate your overall health and detect a wide range of disorders, including anemia, infection, and leukemia.',
            getClinicalInterpretation: (results) => {
                const abnormal = results.filter(r => r.status !== 'Normal');
                if (abnormal.length === 0) return 'All parameters are within normal limits. No evidence of anemia, infection, or other blood disorders detected.';
                return `${abnormal.length} parameter(s) are outside normal range: ${abnormal.map(r => `${r.parameter} is ${r.status.toLowerCase()}`).join(', ')}. Further evaluation may be needed.`;
            },
            getRecommendations: (results) => {
                const abnormal = results.filter(r => r.status !== 'Normal');
                const recs = ['Continue with current health maintenance routine', 'Schedule next CBC in 6-12 months for routine monitoring'];
                if (abnormal.length > 0) {
                    recs.unshift('Consult with your physician about the flagged parameters');
                    recs.push('Consider dietary changes rich in iron and vitamins');
                }
                return recs;
            }
        },
        'Lipid Profile': {
            testOverview: 'A lipid profile measures the amount of specific fat molecules called lipids in your blood. It helps assess your risk of cardiovascular disease, heart attack, and stroke.',
            getClinicalInterpretation: (results) => {
                const abnormal = results.filter(r => r.status !== 'Normal');
                if (abnormal.length === 0) return 'All lipid levels are within normal limits. Cardiovascular risk is low based on these results.';
                const highItems = abnormal.map(r => r.parameter).join(', ');
                return `Elevated levels detected in: ${highItems}. This indicates an increased risk of cardiovascular disease. Lifestyle modifications and possibly medication may be recommended.`;
            },
            getRecommendations: (results) => {
                const abnormal = results.filter(r => r.status !== 'Normal');
                const recs = ['Maintain a balanced diet low in saturated fats', 'Exercise regularly (at least 150 minutes/week)'];
                if (abnormal.length > 0) {
                    recs.unshift('Schedule a follow-up with your cardiologist within 4 weeks');
                    recs.push('Reduce intake of processed foods and trans fats');
                    recs.push('Consider omega-3 fatty acid supplementation');
                }
                return recs;
            }
        },
        'Thyroid Profile (T3, T4, TSH)': {
            testOverview: 'A thyroid profile measures thyroid hormones (T3, T4) and thyroid-stimulating hormone (TSH) to evaluate thyroid gland function and detect conditions like hypothyroidism or hyperthyroidism.',
            getClinicalInterpretation: (results) => {
                const abnormal = results.filter(r => r.status !== 'Normal');
                if (abnormal.length === 0) return 'Thyroid function is normal. All hormone levels are within the expected reference ranges. No thyroid dysfunction detected.';
                return `Abnormal thyroid levels detected: ${abnormal.map(r => `${r.parameter} is ${r.status.toLowerCase()}`).join(', ')}. This may indicate thyroid dysfunction requiring further evaluation.`;
            },
            getRecommendations: (results) => {
                const abnormal = results.filter(r => r.status !== 'Normal');
                const recs = ['Continue regular thyroid monitoring annually', 'Maintain adequate iodine intake through diet'];
                if (abnormal.length > 0) {
                    recs.unshift('Consult an endocrinologist for further evaluation');
                    recs.push('Avoid soy-based products that may affect thyroid function');
                }
                return recs;
            }
        }
    };

    // Default interpretation for unknown test types
    const defaultInterpretation = {
        testOverview: 'This lab test evaluates specific health markers to help your doctor assess your health status and detect potential medical conditions.',
        getClinicalInterpretation: (results) => {
            const abnormal = results.filter(r => r.status !== 'Normal');
            if (abnormal.length === 0) return 'All tested parameters are within normal limits. No abnormalities detected.';
            return `${abnormal.length} parameter(s) are outside the normal range and may require further clinical evaluation.`;
        },
        getRecommendations: (results) => {
            const abnormal = results.filter(r => r.status !== 'Normal');
            const recs = ['Follow up with your healthcare provider', 'Schedule routine monitoring as recommended'];
            if (abnormal.length > 0) recs.unshift('Discuss flagged results with your doctor');
            return recs;
        }
    };

    // Sample/mock reports for demo
    const sampleReports = [
        {
            id: 'sample-1',
            test_name: 'Complete Blood Count (CBC)',
            doctor_name: 'Dr. Priya Sharma',
            lab_name: 'Health Genio Diagnostic Center',
            test_date: '2024-01-17',
            report_date: '2024-01-19',
            lab_id: 'LAB-2024-7700',
            status: 'Normal',
            category: 'Hematology',
            file_name: 'CBC_Report_Jan2024.pdf',
            ai_summary: 'All parameters within normal range. Hemoglobin levels are optimal. No abnormalities detected in white blood cell or platelet counts.',
            results: [
                { parameter: 'Hemoglobin', value: '14.2', unit: 'g/dL', status: 'Normal' },
                { parameter: 'White Blood Cells', value: '7,200', unit: 'cells/\u00b5L', status: 'Normal' },
                { parameter: 'Platelets', value: '250,000', unit: '/\u00b5L', status: 'Normal' },
                { parameter: 'Red Blood Cells', value: '4.9', unit: 'million/\u00b5L', status: 'Normal' },
                { parameter: 'Hematocrit', value: '42', unit: '%', status: 'Normal' },
                { parameter: 'MCV', value: '87', unit: 'fL', status: 'Normal' }
            ]
        },
        {
            id: 'sample-2',
            test_name: 'Lipid Profile',
            doctor_name: 'Dr. Ramesh Verma',
            lab_name: 'HealthCare+ Cardiac Center',
            test_date: '2024-01-13',
            report_date: '2024-01-15',
            lab_id: 'LAB-2024-3545',
            status: 'Attention Needed',
            category: 'Cardiology',
            file_name: 'Lipid_Profile_Jan2024.pdf',
            ai_summary: 'Total cholesterol is elevated at 245 mg/dL. LDL cholesterol also high at 165 mg/dL. Triglycerides borderline. Please consult your cardiologist for dietary adjustments.',
            results: [
                { parameter: 'Total Cholesterol', value: '245', unit: 'mg/dL', status: 'High' },
                { parameter: 'HDL Cholesterol', value: '52', unit: 'mg/dL', status: 'Normal' },
                { parameter: 'LDL Cholesterol', value: '165', unit: 'mg/dL', status: 'High' },
                { parameter: 'Triglycerides', value: '178', unit: 'mg/dL', status: 'High' },
                { parameter: 'VLDL', value: '35', unit: 'mg/dL', status: 'Normal' }
            ]
        },
        {
            id: 'sample-3',
            test_name: 'Thyroid Profile (T3, T4, TSH)',
            doctor_name: 'Dr. Meena Reddy',
            lab_name: 'SRL Diagnostics',
            test_date: '2024-01-05',
            report_date: '2024-01-06',
            lab_id: 'LAB-2024-1189',
            status: 'Normal',
            category: 'Thyroid',
            file_name: 'Thyroid_Profile_Jan2024.pdf',
            ai_summary: 'Thyroid function is normal. TSH, T3, and T4 levels are all within optimal reference ranges. No further action needed.',
            results: [
                { parameter: 'TSH', value: '2.5', unit: 'mIU/L', status: 'Normal' },
                { parameter: 'T3 Total', value: '120', unit: 'ng/dL', status: 'Normal' },
                { parameter: 'T4 Total', value: '8.2', unit: '\u00b5g/dL', status: 'Normal' },
                { parameter: 'Free T4', value: '1.2', unit: 'ng/dL', status: 'Normal' }
            ]
        }
    ];

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [reportsRes, labsRes] = await Promise.all([
                axiosInstance.get('/patient/lab-reports'),
                axiosInstance.get('/patient/lab-reports/nearby-labs')
            ]);
            setDbReports(reportsRes.data.data.reports);
            setNearbyLabs(labsRes.data.data.labs);
        } catch (error) {
            console.error('Error fetching reports data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
        fetchData();
        AOS.init({ duration: 800, once: true, offset: 50 });
    }, [fetchProfile]);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const handleLogout = () => {
        Swal.fire({
            title: "Are you sure?",
            text: "You will be logged out of your account.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#0d9488",
            confirmButtonText: "Yes, logout",
        }).then((result) => {
            if (result.isConfirmed) {
                logout();
                navigate('/login');
            }
        });
    };

    // Smart Scan AI Upload
    const handleSmartScan = () => {
        Swal.fire({
            title: 'AI Smart Lab Report Scanner',
            html: `
                <div class="text-center p-6 bg-teal-50/50 rounded-3xl border-2 border-dashed border-teal-200">
                    <div class="mb-6">
                        <i class="fa-solid fa-brain text-5xl text-teal-600 animate-pulse"></i>
                    </div>
                    <h4 class="font-black text-gray-800 mb-2">Upload your Lab Report</h4>
                    <p class="text-sm text-gray-500 mb-6 font-medium">Our AI will automatically extract test names, results, values, and flag abnormalities from your report.</p>
                    
                    <div class="relative group cursor-pointer">
                        <input type="file" id="reportFile" accept="image/*,application/pdf" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10">
                        <div class="bg-white p-8 rounded-2xl border border-teal-100 shadow-sm group-hover:bg-teal-50 transition-all flex flex-col items-center">
                            <i class="fa-solid fa-microscope text-3xl text-teal-400 mb-3"></i>
                            <span class="text-sm font-bold text-teal-700">Select Report Image or PDF</span>
                            <span id="reportFileName" class="text-xs text-gray-400 mt-2 italic">No file selected</span>
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Scan & Analyze Now',
            confirmButtonColor: '#0d9488',
            showLoaderOnConfirm: true,
            didOpen: () => {
                const fileInput = document.getElementById('reportFile');
                const fileNameDisplay = document.getElementById('reportFileName');
                fileInput.addEventListener('change', (e) => {
                    if (e.target.files.length > 0) {
                        fileNameDisplay.innerText = e.target.files[0].name;
                        fileNameDisplay.classList.remove('text-gray-400');
                        fileNameDisplay.classList.add('text-teal-600', 'font-bold');
                    }
                });
            },
            preConfirm: async () => {
                const file = document.getElementById('reportFile').files[0];
                if (!file) {
                    Swal.showValidationMessage('Please select a file to scan');
                    return false;
                }

                Swal.update({
                    title: 'AI is analyzing your report...',
                    html: `
                        <div class="p-8">
                            <div class="relative w-24 h-24 mx-auto mb-6">
                                <div class="absolute inset-0 border-4 border-teal-100 rounded-full"></div>
                                <div class="absolute inset-0 border-4 border-teal-600 rounded-full border-t-transparent animate-spin"></div>
                                <i class="fa-solid fa-dna absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl text-teal-600"></i>
                            </div>
                            <p class="text-teal-800 font-bold">Extracting test parameters, values, and reference ranges...</p>
                            <p class="text-xs text-teal-600 mt-2 animate__animated animate__fadeIn animate__infinite">Identifying abnormalities and generating health insights...</p>
                        </div>
                    `,
                    showConfirmButton: false
                });

                const formData = new FormData();
                formData.append('file', file);
                formData.append('auto_extract', 'true');

                try {
                    const response = await axiosInstance.post('/patient/lab-reports/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    return response.data;
                } catch (error) {
                    Swal.showValidationMessage(`Scan failed: ${error.response?.data?.message || error.message}`);
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    title: 'Smart Scan Complete!',
                    html: '<p>Lab report has been analyzed and saved. Test results and AI health insights are now available.</p>',
                    icon: 'success',
                    confirmButtonColor: '#0d9488'
                });
                fetchData();
            }
        });
    };

    // Merge DB and sample reports
    const allReports = [
        ...dbReports.map(r => ({
            ...r,
            isFromDb: true,
            results: r.results || [],
        })),
        ...sampleReports
    ];

    // Filter
    const filteredReports = allReports.filter(r => {
        const matchesStatus = activeFilter === 'All' || r.status === activeFilter;
        const matchesCategory = categoryFilter === 'All' || r.category === categoryFilter;
        const matchesSearch = r.test_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.doctor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.lab_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.lab_id?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesCategory && matchesSearch;
    });

    // Stats
    const totalReports = allReports.length;
    const normalCount = allReports.filter(r => r.status === 'Normal').length;
    const attentionCount = allReports.filter(r => r.status === 'Attention Needed' || r.status === 'Abnormal').length;

    // Test type categories for top cards
    const testTypes = [
        { name: 'Blood Lab Test', icon: 'fa-vial', iconBg: 'bg-red-50', iconColor: 'text-red-500', count: allReports.filter(r => r.category === 'Hematology').length, cat: 'Hematology' },
        { name: 'Lipid/Heart', icon: 'fa-heart-pulse', iconBg: 'bg-pink-50', iconColor: 'text-pink-500', count: allReports.filter(r => r.category === 'Cardiology').length, cat: 'Cardiology' },
        { name: 'Thyroid', icon: 'fa-shield-virus', iconBg: 'bg-purple-50', iconColor: 'text-purple-500', count: allReports.filter(r => r.category === 'Thyroid').length, cat: 'Thyroid' },
        { name: 'Diabetes', icon: 'fa-droplet', iconBg: 'bg-blue-50', iconColor: 'text-blue-500', count: allReports.filter(r => r.category === 'Diabetes').length, cat: 'Diabetes' },
        { name: 'Liver', icon: 'fa-lungs', iconBg: 'bg-amber-50', iconColor: 'text-amber-500', count: allReports.filter(r => r.category === 'Liver').length, cat: 'Liver' },
        { name: 'Kidney', icon: 'fa-kidneys', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', count: allReports.filter(r => r.category === 'Kidney').length, cat: 'Kidney' },
    ];

    const userDisplayName = user?.fullName || user?.name || '';
    const firstName = userDisplayName ? userDisplayName.split(' ')[0] : 'User';

    const handleDelete = async (reportId) => {
        const result = await Swal.fire({
            title: 'Delete Report?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await axiosInstance.delete(`/patient/lab-reports/${reportId}`);
                Swal.fire({ title: 'Deleted!', icon: 'success', timer: 1500, showConfirmButton: false });
                fetchData();
            } catch (err) {
                Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Failed to delete', icon: 'error' });
            }
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    // Get AI interpretation for a report
    const getInterpretation = (report) => {
        const interp = aiInterpretations[report.test_name] || defaultInterpretation;
        const results = report.results || [];
        return {
            testOverview: interp.testOverview,
            clinicalInterpretation: interp.getClinicalInterpretation(results),
            recommendations: interp.getRecommendations(results)
        };
    };

    // Get reference range for a parameter
    const getRefRange = (param) => referenceRanges[param] || 'N/A';

    // Download PDF function
    const handleDownloadPDF = (report) => {
        const doc = new jsPDF();
        const interp = getInterpretation(report);
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header bar
        doc.setFillColor(13, 148, 136);
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('HealthCare+', 14, 18);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Lab Report', 14, 28);
        doc.text(`Report ID: ${report.lab_id || 'N/A'}`, pageWidth - 14, 18, { align: 'right' });
        doc.text(`Date: ${formatDate(report.report_date)}`, pageWidth - 14, 28, { align: 'right' });

        // Report Title
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(`${report.test_name} Report`, 14, 55);

        // Status badge
        const statusColor = report.status === 'Normal' ? [16, 185, 129] : [239, 68, 68];
        doc.setFillColor(...statusColor);
        doc.roundedRect(14, 59, 30, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text(report.status.toUpperCase(), 29, 64.5, { align: 'center' });

        // Info section
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        let yPos = 78;
        doc.text(`Doctor: ${report.doctor_name || 'N/A'}`, 14, yPos);
        doc.text(`Lab: ${report.lab_name || 'N/A'}`, pageWidth / 2, yPos);
        yPos += 8;
        doc.text(`Test Date: ${formatDate(report.test_date)}`, 14, yPos);
        doc.text(`Category: ${report.category || 'General'}`, pageWidth / 2, yPos);
        yPos += 6;

        // Divider
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.line(14, yPos, pageWidth - 14, yPos);
        yPos += 8;

        // Test Overview
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Test Overview', 14, yPos);
        yPos += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        const overviewLines = doc.splitTextToSize(interp.testOverview, pageWidth - 28);
        doc.text(overviewLines, 14, yPos);
        yPos += overviewLines.length * 5 + 8;

        // Results table
        if (report.results && report.results.length > 0) {
            doc.setTextColor(31, 41, 55);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Detailed Results', 14, yPos);
            yPos += 4;

            const tableData = report.results.map(r => [
                r.parameter,
                `${r.value} ${r.unit}`,
                getRefRange(r.parameter),
                r.status
            ]);

            doc.autoTable({
                startY: yPos,
                head: [['Test', 'Your Value', 'Reference Range', 'Status']],
                body: tableData,
                margin: { left: 14, right: 14 },
                headStyles: {
                    fillColor: [243, 244, 246],
                    textColor: [31, 41, 55],
                    fontStyle: 'bold',
                    fontSize: 9
                },
                bodyStyles: { fontSize: 9, textColor: [55, 65, 81] },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                columnStyles: {
                    3: {
                        cellWidth: 25,
                        halign: 'center',
                        fontStyle: 'bold'
                    }
                },
                didDrawCell: (data) => {
                    if (data.column.index === 3 && data.section === 'body') {
                        const status = data.cell.raw;
                        if (status === 'Normal') data.cell.styles.textColor = [16, 185, 129];
                        else if (status === 'High') data.cell.styles.textColor = [239, 68, 68];
                        else if (status === 'Low') data.cell.styles.textColor = [245, 158, 11];
                    }
                }
            });

            yPos = doc.lastAutoTable.finalY + 10;
        }

        // Check if we need a new page
        if (yPos > 240) {
            doc.addPage();
            yPos = 20;
        }

        // Clinical Interpretation
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Clinical Interpretation', 14, yPos);
        yPos += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        const interpLines = doc.splitTextToSize(interp.clinicalInterpretation, pageWidth - 28);
        doc.text(interpLines, 14, yPos);
        yPos += interpLines.length * 5 + 8;

        // Recommendations
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Recommendations', 14, yPos);
        yPos += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        interp.recommendations.forEach((rec) => {
            if (yPos > 275) { doc.addPage(); yPos = 20; }
            doc.text(`\u2022  ${rec}`, 18, yPos);
            yPos += 6;
        });

        // Footer
        yPos += 10;
        if (yPos > 270) { doc.addPage(); yPos = 20; }
        doc.setDrawColor(229, 231, 235);
        doc.line(14, yPos, pageWidth - 14, yPos);
        yPos += 6;
        doc.setFontSize(7);
        doc.setTextColor(156, 163, 175);
        doc.text('This report was generated by HealthCare+ Smart Scan AI. Please consult your healthcare provider for medical advice.', 14, yPos);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, yPos + 5);

        // Save
        const fileName = report.file_name || `${report.test_name.replace(/[^a-zA-Z0-9]/g, '_')}_Report.pdf`;
        doc.save(fileName);
    };

    return (
        <div className="dashboard-container min-h-screen">
            {/* Sidebar Overlay for Mobile */}
            <div
                className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
            ></div>

            {/* Navbar */}
            <nav className="navbar-custom">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <button onClick={toggleSidebar} className="lg:hidden p-2 text-white">
                            <div className={`hamburger ${isSidebarOpen ? 'active' : ''}`}>
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </button>
                        <div className="flex lg:hidden items-center gap-2 font-bold text-xl sm:text-2xl">
                            <i className="fa-solid fa-stethoscope text-yellow-300"></i>
                            <span>HealthCare<span className="text-teal-300">+</span></span>
                        </div>
                    </div>
                    <div className="navbar-user">
                        <span className="hidden sm:block">Hi, <strong>{firstName}</strong></span>
                        <img
                            src="https://img.icons8.com/fluency/48/user-male-circle.png"
                            className="user-avatar"
                            alt="Profile"
                        />
                    </div>
                </div>
            </nav>

            {/* Sidebar */}
            <div className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
                <div className="brand">
                    <i className="fa-solid fa-heart-pulse text-red-100"></i>
                    HealthCare+
                </div>
                <ul>
                    <li>
                        <a href="#" onClick={() => navigate('/dashboard')}>
                            <i className="fa-solid fa-gauge-high"></i>
                            Dashboard
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/appointments'); }}>
                            <i className="fa-solid fa-calendar-check"></i>
                            Appointments
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={() => navigate('/prescriptions')}>
                            <i className="fa-solid fa-prescription-bottle-medical"></i>
                            Prescriptions
                        </a>
                    </li>
                    <li>
                        <a href="#" className="active" onClick={(e) => e.preventDefault()}>
                            <i className="fa-solid fa-file-medical"></i>
                            Reports & Tests
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={() => navigate('/stats')}>
                            <i className="fa-solid fa-chart-line"></i>
                            Health Stats
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={() => navigate('/tips')}>
                            <i className="fa-solid fa-lightbulb"></i>
                            Health Tips
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={(e) => e.preventDefault()}>
                            <i className="fa-solid fa-user-doctor"></i>
                            Doctors
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={(e) => e.preventDefault()}>
                            <i className="fa-solid fa-hospital"></i>
                            Hospitals
                        </a>
                    </li>
                    <li>
                        <a href="#" onClick={(e) => e.preventDefault()}>
                            <i className="fa-solid fa-gear"></i>
                            Settings
                        </a>
                    </li>
                </ul>
                <button onClick={handleLogout} className="logout-btn">
                    <i className="fa-solid fa-right-from-bracket"></i>
                    Logout
                </button>
            </div>

            {/* Main Content */}
            <main className="main-content flex-1 p-4 sm:p-6 md:p-8 overflow-x-hidden">

                {/* Page Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 mt-4 animate__animated animate__fadeIn">
                    <div>
                        <h1 className="text-4xl font-black text-gray-800 mb-2 tracking-tight">
                            <span className="reports-text-gradient">Reports & Tests</span>
                        </h1>
                        <p className="text-gray-500 font-semibold text-lg">
                            Access and manage your medical lab reports and test results
                        </p>
                    </div>
                    <div className="flex gap-3 mt-6 sm:mt-0">
                        <button className="report-action-btn report-btn-share">
                            <i className="fa-solid fa-share-nodes"></i> Share Records
                        </button>
                        <button className="report-action-btn report-btn-scan" onClick={handleSmartScan}>
                            <i className="fa-solid fa-brain"></i> Smart Scan AI
                        </button>
                    </div>
                </div>

                {/* Test Type Cards (Horizontal Scroll) */}
                <div className="mb-8" data-aos="fade-up">
                    <div className="test-type-scroll">
                        {testTypes.map((type, idx) => (
                            <div
                                key={idx}
                                className={`test-type-card ${categoryFilter === type.cat ? 'active-type' : ''}`}
                                onClick={() => setCategoryFilter(categoryFilter === type.cat ? 'All' : type.cat)}
                            >
                                <div className={`type-icon ${categoryFilter === type.cat ? 'bg-white/20' : type.iconBg}`}>
                                    <i className={`fa-solid ${type.icon} ${categoryFilter === type.cat ? 'text-white' : type.iconColor}`}></i>
                                </div>
                                <h4 className="font-bold text-sm mb-1">{type.name}</h4>
                                <p className={`text-xs font-bold ${categoryFilter === type.cat ? 'text-teal-100' : 'text-gray-400'}`}>
                                    {type.count} reports
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    {[
                        { label: 'Total Reports', value: totalReports, icon: 'fa-flask', color: 'teal', bg: 'bg-teal-50', text: 'text-teal-600' },
                        { label: 'Normal', value: normalCount, icon: 'fa-circle-check', color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600' },
                        { label: 'Attention', value: attentionCount, icon: 'fa-triangle-exclamation', color: 'red', bg: 'bg-red-50', text: 'text-red-500' },
                        { label: 'Labs Visited', value: new Set(allReports.map(r => r.lab_name)).size, icon: 'fa-hospital', color: 'blue', bg: 'bg-blue-50', text: 'text-blue-600' }
                    ].map((stat, idx) => (
                        <div key={idx} className="report-stats-card group" data-aos="fade-up" data-aos-delay={idx * 80}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
                                    <p className={`text-4xl font-black text-gray-800 group-hover:${stat.text} transition-colors`}>{stat.value}</p>
                                </div>
                                <div className={`report-stats-icon ${stat.bg} ${stat.text} group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                                    <i className={`fa-solid ${stat.icon}`}></i>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Search & Filter */}
                <div className="report-search-container" data-aos="fade-up">
                    <div className="report-search-box">
                        <i className="fa-solid fa-search text-teal-500"></i>
                        <input
                            type="text"
                            placeholder="Search by test, doctor, or lab..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="report-filter-pills">
                        {['All', 'Normal', 'Attention Needed'].map(filter => (
                            <button
                                key={filter}
                                className={`report-filter-pill ${activeFilter === filter ? 'active-pill' : ''}`}
                                onClick={() => setActiveFilter(filter)}
                            >
                                {filter === 'Attention Needed' ? 'Attention' : filter}
                            </button>
                        ))}
                    </div>
                    <select
                        className="report-filter-select"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="All">All Categories</option>
                        <option value="Hematology">Hematology</option>
                        <option value="Cardiology">Cardiology</option>
                        <option value="Thyroid">Thyroid</option>
                        <option value="Diabetes">Diabetes</option>
                        <option value="Liver">Liver</option>
                        <option value="Kidney">Kidney</option>
                        <option value="General">General</option>
                    </select>
                    {(searchQuery || activeFilter !== 'All' || categoryFilter !== 'All') && (
                        <button className="report-clear-btn" onClick={() => { setSearchQuery(''); setActiveFilter('All'); setCategoryFilter('All'); }}>
                            <i className="fa-solid fa-xmark mr-1"></i> Clear
                        </button>
                    )}
                </div>

                {/* Recent Reports */}
                <h2 className="text-2xl font-black text-gray-800 mb-6" data-aos="fade-up">
                    Recent Reports
                </h2>

                {isLoading ? (
                    <div className="space-y-6">
                        {[1, 2].map(i => (
                            <div key={i} className="report-skeleton h-64 w-full"></div>
                        ))}
                    </div>
                ) : filteredReports.length > 0 ? (
                    <div className="space-y-8">
                        {filteredReports.map((report, idx) => (
                            <div key={report.id} className="report-card" data-aos="fade-up" data-aos-delay={idx * 100}>
                                {/* Header */}
                                <div className="report-card-header">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 flex-wrap mb-2">
                                                <h3 className="text-xl font-black tracking-tight">{report.test_name}</h3>
                                                <span className={`report-status-badge ${report.status === 'Normal' ? 'status-normal' : report.status === 'Attention Needed' ? 'status-attention' : 'status-abnormal'}`}>
                                                    <span className={`w-2 h-2 rounded-full ${report.status === 'Normal' ? 'bg-emerald-600' : 'bg-red-500'}`}></span>
                                                    {report.status}
                                                </span>
                                            </div>
                                            <p className="text-teal-50 font-bold text-sm opacity-90">
                                                <i className="fa-solid fa-user-doctor mr-2 opacity-60"></i>
                                                {report.doctor_name || 'Doctor not specified'} <span className="mx-2 opacity-40">•</span> {report.category}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2 text-teal-100 text-xs font-semibold">
                                                <div className="bg-white/15 px-2 py-1 rounded-lg backdrop-blur-md">
                                                    <i className="fa-solid fa-hospital-user mr-1"></i>
                                                    {report.lab_name || 'Lab not specified'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white/15 p-4 rounded-2xl backdrop-blur-xl border border-white/15 text-center min-w-[120px]">
                                            <span className="text-[9px] font-black uppercase tracking-[0.15em] opacity-70 block mb-1">Lab ID</span>
                                            <span className="text-lg font-black">{report.lab_id || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="report-card-body">
                                    {/* Date Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
                                            <div className="bg-teal-100/60 p-3 rounded-xl text-teal-600">
                                                <i className="fa-solid fa-calendar-check text-lg"></i>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Test Date</p>
                                                <p className="font-bold text-gray-800">{formatDate(report.test_date)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
                                            <div className="bg-amber-100/60 p-3 rounded-xl text-amber-600">
                                                <i className="fa-solid fa-calendar-days text-lg"></i>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reported Date</p>
                                                <p className="font-bold text-gray-800">{formatDate(report.report_date)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Lab / Diagnostic Info */}
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                                        Lab: {report.lab_name || 'Not specified'}
                                    </div>

                                    {/* Test Results */}
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
                                        Test Results <span className="h-[1px] flex-1 bg-gray-100"></span>
                                    </h4>

                                    {report.results && report.results.length > 0 ? (
                                        <div className="report-results-grid mb-6">
                                            {report.results.slice(0, 4).map((result, rIdx) => (
                                                <div key={rIdx} className={`result-item result-${result.status?.toLowerCase() || 'normal'}`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h5 className="font-bold text-gray-700 text-sm">{result.parameter}</h5>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${result.status === 'Normal' ? 'bg-emerald-100 text-emerald-700' : result.status === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {result.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-2xl font-black text-gray-800">{result.value} <span className="text-xs font-bold text-gray-400">{result.unit}</span></p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 p-6 rounded-2xl text-center mb-6 border border-dashed border-gray-200">
                                            <i className="fa-solid fa-file-medical text-3xl text-gray-300 mb-2"></i>
                                            <p className="text-gray-400 font-bold text-sm">View uploaded file for detailed results</p>
                                            {report.file_url && (
                                                <a href={report.file_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-teal-600 font-black text-xs uppercase tracking-widest border-b-2 border-teal-600 pb-0.5">
                                                    View Document
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {/* PDF File Preview Card */}
                                    <div className="bg-gray-50 rounded-2xl p-8 mb-6 border border-gray-100 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-100 transition-all"
                                        onClick={() => report.file_url ? window.open(report.file_url, '_blank') : handleDownloadPDF(report)}>
                                        <div className="mb-3">
                                            <svg width="48" height="56" viewBox="0 0 48 56" fill="none">
                                                <rect x="0" y="0" width="48" height="56" rx="4" fill="#FEF2F2" />
                                                <rect x="0" y="0" width="48" height="18" rx="4" fill="#EF4444" />
                                                <text x="24" y="13" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">PDF</text>
                                                <rect x="8" y="26" width="32" height="2" rx="1" fill="#E5E7EB" />
                                                <rect x="8" y="32" width="28" height="2" rx="1" fill="#E5E7EB" />
                                                <rect x="8" y="38" width="24" height="2" rx="1" fill="#E5E7EB" />
                                                <rect x="8" y="44" width="20" height="2" rx="1" fill="#E5E7EB" />
                                            </svg>
                                        </div>
                                        <p className="font-bold text-gray-700 text-sm">{report.file_name || `${report.test_name.replace(/[^a-zA-Z0-9 ]/g, '')}.pdf`}</p>
                                        <p className="text-xs text-gray-400 mt-1">Click to view full report</p>
                                    </div>

                                    {/* Interpretation + Action Buttons Row */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-700 text-sm">Interpretation:</span>
                                            <span className="text-gray-500 text-sm font-medium">
                                                {report.ai_summary || 'All parameters within normal limits'}
                                            </span>
                                        </div>
                                        <div className="flex gap-3 flex-wrap flex-shrink-0">
                                            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-teal-200 text-teal-700 font-bold text-sm bg-white hover:bg-teal-50 hover:border-teal-400 transition-all" onClick={(e) => { e.stopPropagation(); handleDownloadPDF(report); }}>
                                                <i className="fa-solid fa-download"></i> Download PDF
                                            </button>
                                            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-teal-200 text-teal-700 font-bold text-sm bg-white hover:bg-teal-50 hover:border-teal-400 transition-all" onClick={(e) => { e.stopPropagation(); setSelectedReport(report); }}>
                                                <i className="fa-solid fa-circle-info"></i> Details
                                            </button>
                                            {report.isFromDb && (
                                                <button className="report-delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}>
                                                    <i className="fa-solid fa-trash mr-1"></i> Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 animate__animated animate__zoomIn">
                        <div className="text-gray-200 mb-6">
                            <i className="fa-solid fa-flask text-8xl"></i>
                        </div>
                        <h3 className="text-3xl font-black text-gray-800 mb-3 tracking-tight">No Reports Found</h3>
                        <p className="text-gray-500 font-bold text-lg max-w-md mx-auto opacity-70">
                            We couldn't find any reports matching your current filters.
                        </p>
                    </div>
                )}

                {/* Nearby Labs Section */}
                <div className="labs-container" data-aos="fade-up">
                    <h3 className="text-2xl font-black text-gray-800 mb-2">Nearby Labs</h3>
                    <div className="h-1 w-12 bg-teal-500 rounded-full mb-6"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {nearbyLabs.length > 0 ? (
                            nearbyLabs.map((lab, idx) => (
                                <div key={idx} className="lab-card" data-aos="fade-up" data-aos-delay={idx * 80}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div
                                            className="lab-dot"
                                            style={{
                                                backgroundColor:
                                                    lab.color === 'teal' ? '#99f6e4' :
                                                        lab.color === 'blue' ? '#bfdbfe' :
                                                            lab.color === 'indigo' ? '#c7d2fe' :
                                                                lab.color === 'purple' ? '#e9d5ff' : '#a7f3d0'
                                            }}
                                        ></div>
                                        <h4 className="font-black text-gray-800">{lab.name}</h4>
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium mb-1">
                                        {lab.area === 'Online' ? 'Online - Home Collection' : `${lab.area}, ${lab.dist} away`}
                                    </p>
                                    <p className="text-xs text-gray-400 font-bold mb-2">
                                        ⭐ {lab.rating} ({lab.reviews} reviews)
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-lg">{lab.status}</span>
                                        <span className="text-[10px] text-gray-400 font-medium">{lab.tests}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            [1, 2, 3].map((_, idx) => (
                                <div key={idx} className="lab-card">
                                    <div className="h-4 report-skeleton w-3/4 mb-3"></div>
                                    <div className="h-3 report-skeleton w-1/2 mb-2"></div>
                                    <div className="h-3 report-skeleton w-2/3 mb-2"></div>
                                    <div className="h-6 report-skeleton w-1/3 mt-2"></div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Health Insights Section */}
                <div className="mt-12 mb-8" data-aos="fade-up">
                    <h3 className="text-2xl font-black text-gray-800 mb-2">Health Insights</h3>
                    <div className="h-1 w-12 bg-teal-500 rounded-full mb-6"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="health-insight-card" style={{ borderLeft: '4px solid #0d9488' }}>
                            <div className="flex items-start gap-4">
                                <div className="bg-teal-50 p-3 rounded-xl flex-shrink-0">
                                    <i className="fa-solid fa-chart-line text-teal-600 text-xl"></i>
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-800 mb-1">Cardiovascular Health</h4>
                                    <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                        Based on your recent lipid profile, it's recommended to maintain a low-fat diet, regular exercise, and follow up with your cardiologist.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="health-insight-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                            <div className="flex items-start gap-4">
                                <div className="bg-purple-50 p-3 rounded-xl flex-shrink-0">
                                    <i className="fa-solid fa-shield-heart text-purple-600 text-xl"></i>
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-800 mb-1">Preventive Care</h4>
                                    <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                        Your complete blood count looks great! Regular check-ups every 6 months are recommended to maintain these optimal levels.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Smart Scan Upload CTA */}
                <div className="mt-12 mb-8" data-aos="zoom-in">
                    <div className="smart-scan-card group" onClick={handleSmartScan}>
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="bg-white p-6 rounded-[2rem] shadow-xl mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500">
                                <i className="fa-solid fa-brain text-5xl text-teal-600"></i>
                            </div>
                            <h3 className="text-3xl font-black text-gray-800 mb-3 tracking-tight">
                                Smart Scan <span className="text-teal-600">AI</span>
                            </h3>
                            <p className="text-gray-500 font-bold text-lg max-w-lg mx-auto leading-relaxed">
                                Upload any lab report image or PDF. Our AI instantly extracts test parameters, values, and flags abnormalities for you.
                            </p>
                            <div className="mt-6">
                                <span className="report-action-btn report-btn-scan px-10 py-3 text-sm uppercase tracking-widest font-black">
                                    Upload & Scan Now <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

            </main>

            {/* Report Detail Modal - AI Interpretation */}
            {selectedReport && (() => {
                const interp = getInterpretation(selectedReport);
                return (
                    <div className="report-detail-overlay" onClick={() => setSelectedReport(null)}>
                        <div className="report-detail-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
                            <button className="modal-close" onClick={() => setSelectedReport(null)}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>

                            {/* Modal Title */}
                            <h2 className="text-2xl font-black text-gray-800 mb-6 pr-10">
                                {selectedReport.test_name} Report
                            </h2>

                            {/* Test Overview */}
                            <div className="mb-6">
                                <h3 className="text-base font-black text-gray-700 mb-2">Test Overview</h3>
                                <p className="text-sm text-gray-600 leading-relaxed font-medium">
                                    {interp.testOverview}
                                </p>
                            </div>

                            {/* Detailed Results Table */}
                            {selectedReport.results && selectedReport.results.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-base font-black text-gray-700 mb-3">Detailed Results</h3>
                                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50">
                                                    <th className="text-left py-3 px-4 font-bold text-gray-600 border-b border-gray-200">Test</th>
                                                    <th className="text-left py-3 px-4 font-bold text-gray-600 border-b border-gray-200">Your Value</th>
                                                    <th className="text-left py-3 px-4 font-bold text-gray-600 border-b border-gray-200">Reference Range</th>
                                                    <th className="text-left py-3 px-4 font-bold text-gray-600 border-b border-gray-200">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedReport.results.map((result, idx) => (
                                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                                        <td className="py-3 px-4 font-semibold text-gray-700 border-b border-gray-100">{result.parameter}</td>
                                                        <td className="py-3 px-4 text-gray-700 border-b border-gray-100">{result.value} {result.unit}</td>
                                                        <td className="py-3 px-4 text-gray-500 border-b border-gray-100">{getRefRange(result.parameter)}</td>
                                                        <td className="py-3 px-4 border-b border-gray-100">
                                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${result.status === 'Normal'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : result.status === 'High'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : 'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                {result.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Clinical Interpretation */}
                            <div className="mb-6">
                                <h3 className="text-base font-black text-gray-700 mb-2">Clinical Interpretation</h3>
                                <p className="text-sm text-gray-600 leading-relaxed font-medium">
                                    {interp.clinicalInterpretation}
                                </p>
                            </div>

                            {/* Recommendations */}
                            <div className="mb-6">
                                <h3 className="text-base font-black text-gray-700 mb-3">Recommendations</h3>
                                <ul className="space-y-2">
                                    {interp.recommendations.map((rec, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 font-medium">
                                            <span className="text-teal-500 mt-0.5">•</span>
                                            <span>{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Report Info Footer */}
                            <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase tracking-wider mb-0.5">Doctor</p>
                                        <p className="text-gray-700 font-semibold">{selectedReport.doctor_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase tracking-wider mb-0.5">Lab</p>
                                        <p className="text-gray-700 font-semibold">{selectedReport.lab_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase tracking-wider mb-0.5">Test Date</p>
                                        <p className="text-gray-700 font-semibold">{formatDate(selectedReport.test_date)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase tracking-wider mb-0.5">Report ID</p>
                                        <p className="text-gray-700 font-semibold">{selectedReport.lab_id || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 mt-4">
                                <button
                                    className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white font-bold py-3 rounded-xl hover:bg-teal-700 transition-all text-sm"
                                    onClick={() => handleDownloadPDF(selectedReport)}
                                >
                                    <i className="fa-solid fa-download"></i> Download PDF
                                </button>
                                <button
                                    className="flex-1 bg-gray-800 text-white font-bold py-3 rounded-xl hover:bg-black transition-all text-sm"
                                    onClick={() => setSelectedReport(null)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default ReportsPage;
