
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { toast } from 'react-hot-toast';
import axiosInstance from '../api/axios';
import './ProfilePage.css';

const ProfilePage = () => {
    const navigate = useNavigate();
    const { user, logout, fetchProfile } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    const [formData, setFormData] = useState({
        patientId: user?.patientId || '',
        fullName: user?.fullName || user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        bloodGroup: user?.bloodGroup || '',
        gender: user?.gender || '',
        dob: user?.dob || '',
        address: user?.address || '',
        guardianName: user?.guardianName || '',
        guardianPhone: user?.guardianPhone || '',
        relation: user?.emergencyContact || '',
        pincode: user?.pincode || '',
        city: user?.city || '',
        state: user?.state || ''
    });

    const [stateSearch, setStateSearch] = useState('');
    const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);

    const indianStates = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
        "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
        "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
        "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
        "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
        "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
        "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
    ];

    const filteredStates = indianStates.filter(state =>
        state.toLowerCase().includes(stateSearch.toLowerCase())
    );

    useEffect(() => {
        // Sync with store if user changes
        if (user) {
            setFormData(prev => ({
                ...prev,
                patientId: user.patientId || prev.patientId,
                fullName: user.fullName || user.name || prev.fullName,
                email: user.email || prev.email,
                phone: user.phone || prev.phone,
                bloodGroup: user.bloodGroup || prev.bloodGroup,
                gender: user.gender || prev.gender,
                dob: user.dob || prev.dob,
                address: user.address || prev.address,
                guardianName: user.guardianName || prev.guardianName,
                guardianPhone: user.guardianPhone || prev.guardianPhone,
                relation: user.emergencyContact || prev.relation,
                pincode: user.pincode || prev.pincode,
                city: user.city || prev.city,
                state: user.state || prev.state
            }));
            if (user.state) setStateSearch(user.state);
            if (user.profilePictureUrl) {
                setPreviewUrl(user.profilePictureUrl);
            }
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                if (formData[key]) data.append(key, formData[key]);
            });
            if (selectedFile) {
                data.append('profilePicture', selectedFile);
            }

            const response = await axiosInstance.put('/patient/profile', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                toast.success('Profile updated successfully!');
                await fetchProfile(); // Refresh global state
                navigate('/dashboard');
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to update profile';
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="profile-container">
            <header className="profile-header">
                <div className="brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
                    HealthCare+
                </div>
                <div className="logout-link" onClick={handleLogout}>
                    Logout
                </div>
            </header>

            <main>
                <div className="profile-card">
                    <h2>Patient Profile</h2>

                    <form onSubmit={handleSaveProfile}>
                        {/* Patient ID */}
                        <div className="form-group">
                            <label>Patient ID</label>
                            <input
                                type="text"
                                name="patientId"
                                value={formData.patientId}
                                className="form-control"
                                disabled
                            />
                        </div>

                        <div className="form-group">
                            <label>Upload Photo <span className="required">*</span></label>
                            <div className="file-upload-wrapper">
                                {previewUrl && (
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                )}
                                <label className="file-upload-btn">
                                    Choose File
                                    <input type="file" accept="image/*" onChange={handleFileChange} hidden />
                                </label>
                                <span className="file-name">{selectedFile ? selectedFile.name : 'No file chosen'}</span>
                            </div>
                        </div>

                        {/* Full Name */}
                        <div className="form-group">
                            <label>Full Name <span className="required">*</span></label>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="Enter full name"
                                className="form-control"
                                required
                            />
                        </div>

                        {/* Email */}
                        <div className="form-group">
                            <label>Email Address (Optional)</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Enter email"
                                className="form-control"
                            />
                        </div>

                        {/* Phone Number Section */}
                        <div className="form-group">
                            <label>Phone Number <span className="required">*</span></label>
                            <div className="phone-input-wrapper">
                                <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAKCAYAAAC9Y9beAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3goXFBAu5mS6mAAAALFJREFUKM9jZEACDAwMDCzMTExoIn9+fP3P8P8/AyXm/Gf4/5+BQYSRkRHmYmIsTEyyDAwM0gyYIn//MshA9TMyMsyFqQOpy/DfPwNDIsN/P1AdTFA9TIxEWMzExCSDJm5mZmb6/58BSVxsYWFhYGBgEGVkZGRkZGRm+v8fKjYwMDCwMDAwsrCwsPyHqgW6mInpP1Q8Q/8fSizYIAsLCwvID7///SMLMjEzk2UoA70AAMbPKrNoBfP4AAAAAElFTkSuQmCC" alt="IN" />
                                <span className="country-code">+91</span>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="98765 43210"
                                    required
                                />
                            </div>

                            <div className="otp-row">
                                <button type="button" className="btn-send-otp">Send OTP</button>
                                <input type="text" placeholder="Enter OTP" className="otp-input" />
                                <button type="button" className="btn-verify-otp">Verify OTP</button>
                            </div>
                        </div>

                        {/* Blood Group */}
                        <div className="form-group">
                            <label>Blood Group <span className="required">*</span></label>
                            <div className="select-wrapper">
                                <select
                                    className="form-control"
                                    name="bloodGroup"
                                    value={formData.bloodGroup}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select blood group</option>
                                    <option value="A+">A+</option>
                                    <option value="A-">A-</option>
                                    <option value="B+">B+</option>
                                    <option value="B-">B-</option>
                                    <option value="O+">O+</option>
                                    <option value="O-">O-</option>
                                    <option value="AB+">AB+</option>
                                    <option value="AB-">AB-</option>
                                </select>
                            </div>
                        </div>

                        {/* Gender and DOB row */}
                        <div className="form-row">
                            <div className="form-group">
                                <label>Gender <span className="required">*</span></label>
                                <div className="select-wrapper">
                                    <select
                                        className="form-control"
                                        name="gender"
                                        value={formData.gender}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Date of Birth <span className="required">*</span></label>
                                <input
                                    type="date"
                                    name="dob"
                                    value={formData.dob}
                                    onChange={handleChange}
                                    className="form-control"
                                    max={new Date().toISOString().split('T')[0]}
                                    required
                                />
                            </div>
                        </div>

                        {/* Address */}
                        <div className="form-group">
                            <label>Address <span className="required">*</span></label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="Enter full address"
                                className="form-control"
                                style={{ height: '100px', resize: 'none' }}
                                required
                            ></textarea>
                        </div>

                        {/* Pincode and City row */}
                        <div className="form-row">
                            <div className="form-group">
                                <label>Pincode <span className="required">*</span></label>
                                <input
                                    type="text"
                                    name="pincode"
                                    value={formData.pincode}
                                    onChange={handleChange}
                                    placeholder="6-digit pincode"
                                    className="form-control"
                                    maxLength="6"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>City/District <span className="required">*</span></label>
                                <input
                                    type="text"
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    placeholder="Enter city"
                                    className="form-control"
                                    required
                                />
                            </div>
                        </div>

                        {/* State Searchable Dropdown */}
                        <div className="form-group" style={{ position: 'relative' }}>
                            <label>State <span className="required">*</span></label>
                            <div className="searchable-select">
                                <input
                                    type="text"
                                    placeholder="Search state..."
                                    value={stateSearch}
                                    onChange={(e) => {
                                        setStateSearch(e.target.value);
                                        setIsStateDropdownOpen(true);
                                    }}
                                    onFocus={() => setIsStateDropdownOpen(true)}
                                    className="form-control"
                                />
                                {isStateDropdownOpen && (
                                    <div className="dropdown-options" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        backgroundColor: 'white',
                                        border: '1px solid #edf2f7',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                        zIndex: 100,
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        marginTop: '5px'
                                    }}>
                                        {filteredStates.map(state => (
                                            <div
                                                key={state}
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, state }));
                                                    setStateSearch(state);
                                                    setIsStateDropdownOpen(false);
                                                }}
                                                style={{
                                                    padding: '12px 20px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseOver={(e) => e.target.style.backgroundColor = '#f8fafc'}
                                                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                                            >
                                                {state}
                                            </div>
                                        ))}
                                        {filteredStates.length === 0 && (
                                            <div style={{ padding: '12px 20px', color: '#a0aec0', fontSize: '14px' }}>
                                                No states found
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Guardian Name */}
                        <div className="form-group">
                            <label>Husband/Wife/Guardian Name <span className="required">*</span></label>
                            <input
                                type="text"
                                name="guardianName"
                                value={formData.guardianName}
                                onChange={handleChange}
                                placeholder="Enter guardian name"
                                className="form-control"
                                required
                            />
                        </div>

                        {/* Guardian Phone */}
                        <div className="form-group">
                            <label>Guardian Phone Number <span className="required">*</span></label>
                            <div className="phone-input-wrapper">
                                <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAKCAYAAAC9Y9beAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3goXFBAu5mS6mAAAALFJREFUKM9jZEACDAwMDCzMTExoIn9+fP3P8P8/AyXm/Gf4/5+BQYSRkRHmYmIsTEyyDAwM0gyYIn//MshA9TMyMsyFqQOpy/DfPwNDIsN/P1AdTFA9TIxEWMzExCSDJm5mZmb6/58BSVxsYWFhYGBgEGVkZGRkZGRm+v8fKjYwMDCwMDAwsrCwsPyHqgW6mInpP1Q8Q/8fSizYIAsLCwvID7///SMLMjEzk2UoA70AAMbPKrNoBfP4AAAAAElFTkSuQmCC" alt="IN" />
                                <span className="country-code">+91</span>
                                <input
                                    type="tel"
                                    name="guardianPhone"
                                    value={formData.guardianPhone}
                                    onChange={handleChange}
                                    placeholder="9876543210"
                                    required
                                />
                            </div>
                        </div>

                        {/* Relation */}
                        <div className="form-group">
                            <label>Relation <span className="required">*</span></label>
                            <div className="select-wrapper">
                                <select
                                    className="form-control"
                                    name="relation"
                                    value={formData.relation}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select relation</option>
                                    <option value="Father">Father</option>
                                    <option value="Mother">Mother</option>
                                    <option value="Spouse">Spouse</option>
                                    <option value="Sibling">Sibling</option>
                                    <option value="Guardian">Guardian</option>
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-save-profile"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Saving...' : 'Save Profile'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default ProfilePage;
