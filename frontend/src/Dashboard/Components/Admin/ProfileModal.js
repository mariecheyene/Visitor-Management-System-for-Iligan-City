import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Tabs, Tab, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaUser, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import './ProfileModal.css';

const ProfileModal = ({ show, onHide, user, onUserUpdate }) => {
  const [activeTab, setActiveTab] = useState('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Profile edit state
  const [editForm, setEditForm] = useState({
    name: '',
    email: ''
  });
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Password visibility toggles
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handlePasswordFormChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!editForm.name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (!editForm.email.trim()) {
      setError('Email is required');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editForm.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await axios.put(
        `http://localhost:5001/users/${user._id}/profile`,
        {
          name: editForm.name.trim(),
          email: editForm.email.trim().toLowerCase()
        }
      );
      
      // Update localStorage
      const updatedUser = { ...user, ...response.data.user };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Call parent update function
      if (onUserUpdate) {
        onUserUpdate(updatedUser);
      }
      
      toast.success('Profile updated successfully!');
      setActiveTab('view');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update profile';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!passwordForm.currentPassword) {
      setError('Current password is required');
      return;
    }
    
    if (!passwordForm.newPassword) {
      setError('New password is required');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setError('New password must be different from current password');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('Attempting password change for user:', user._id);
      const response = await axios.put(
        `http://localhost:5001/users/${user._id}/password`,
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        }
      );
      
      console.log('Password change response:', response.data);
      toast.success('Password changed successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setActiveTab('view');
    } catch (err) {
      console.error('Password change error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to change password';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleModalHide = () => {
    setActiveTab('view');
    setError('');
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    if (user) {
      setEditForm({
        name: user.name || '',
        email: user.email || ''
      });
    }
    onHide();
  };

  const getRoleBadgeClass = (role) => {
    const roleMap = {
      'FullAdmin': 'danger',
      'MaleAdmin': 'primary',
      'FemaleAdmin': 'info',
      'FullStaff': 'success',
      'MaleStaff': 'warning',
      'FemaleStaff': 'secondary'
    };
    return `badge bg-${roleMap[role] || 'secondary'}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) return null;

  return (
    <Modal show={show} onHide={handleModalHide} size="lg" centered>
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title>
          <FaUser className="me-2" />
          My Profile
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => {
            setActiveTab(k);
            setError('');
          }}
          className="mb-3"
        >
          {/* View Profile Tab */}
          <Tab eventKey="view" title="Profile Information">
            <div className="profile-view">
              <div className="text-center mb-4">
                <div className="profile-avatar mx-auto mb-3">
                  <img 
                    src="/img/admin.png" 
                    alt="Profile" 
                    className="rounded-circle"
                    style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                  />
                </div>
                <h4 className="mb-1">{user.name}</h4>
                <span className={getRoleBadgeClass(user.role)}>{user.role}</span>
              </div>
              
              <div className="profile-details">
                <div className="detail-row">
                  <strong>Email:</strong>
                  <span>{user.email}</span>
                </div>
                <div className="detail-row">
                  <strong>Role:</strong>
                  <span>{user.role}</span>
                </div>
                <div className="detail-row">
                  <strong>Status:</strong>
                  <span className={user.isActive ? 'text-success' : 'text-danger'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="detail-row">
                  <strong>Account Created:</strong>
                  <span>{formatDate(user.createdAt)}</span>
                </div>
                <div className="detail-row">
                  <strong>Last Updated:</strong>
                  <span>{formatDate(user.updatedAt)}</span>
                </div>
              </div>
            </div>
          </Tab>

          {/* Edit Profile Tab */}
          <Tab eventKey="edit" title="Edit Profile">
            <Form onSubmit={handleUpdateProfile}>
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form.Group className="mb-3">
                <Form.Label>Full Name *</Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditFormChange}
                  placeholder="Enter your full name"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Email Address *</Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditFormChange}
                  placeholder="Enter your email"
                  required
                />
                <Form.Text className="text-muted">
                  Make sure you have access to this email address
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Role</Form.Label>
                <Form.Control
                  type="text"
                  value={user.role}
                  disabled
                  readOnly
                />
                <Form.Text className="text-muted">
                  Role cannot be changed. Contact an administrator.
                </Form.Text>
              </Form.Group>

              <div className="d-flex justify-content-end gap-2">
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    setActiveTab('view');
                    setError('');
                    setEditForm({
                      name: user.name || '',
                      email: user.email || ''
                    });
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Updating...
                    </>
                  ) : (
                    'Update Profile'
                  )}
                </Button>
              </div>
            </Form>
          </Tab>

          {/* Change Password Tab */}
          <Tab eventKey="password" title="Change Password">
            <Form onSubmit={handleChangePassword}>
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form.Group className="mb-3">
                <Form.Label>Current Password *</Form.Label>
                <div className="password-input-wrapper">
                  <Form.Control
                    type={showPasswords.current ? "text" : "password"}
                    name="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordFormChange}
                    placeholder="Enter current password"
                    required
                  />
                  <Button
                    variant="link"
                    className="password-toggle"
                    onClick={() => togglePasswordVisibility('current')}
                    tabIndex="-1"
                  >
                    {showPasswords.current ? <FaEyeSlash /> : <FaEye />}
                  </Button>
                </div>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>New Password *</Form.Label>
                <div className="password-input-wrapper">
                  <Form.Control
                    type={showPasswords.new ? "text" : "password"}
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordFormChange}
                    placeholder="Enter new password"
                    required
                  />
                  <Button
                    variant="link"
                    className="password-toggle"
                    onClick={() => togglePasswordVisibility('new')}
                    tabIndex="-1"
                  >
                    {showPasswords.new ? <FaEyeSlash /> : <FaEye />}
                  </Button>
                </div>
                <Form.Text className="text-muted">
                  Password must be at least 6 characters long
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Confirm New Password *</Form.Label>
                <div className="password-input-wrapper">
                  <Form.Control
                    type={showPasswords.confirm ? "text" : "password"}
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordFormChange}
                    placeholder="Re-enter new password"
                    required
                  />
                  <Button
                    variant="link"
                    className="password-toggle"
                    onClick={() => togglePasswordVisibility('confirm')}
                    tabIndex="-1"
                  >
                    {showPasswords.confirm ? <FaEyeSlash /> : <FaEye />}
                  </Button>
                </div>
              </Form.Group>

              <Alert variant="info" className="small">
                <FaLock className="me-2" />
                <strong>Security Tip:</strong> Choose a strong password that you don't use elsewhere.
              </Alert>

              <div className="d-flex justify-content-end gap-2">
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    setActiveTab('view');
                    setError('');
                    setPasswordForm({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Changing...
                    </>
                  ) : (
                    'Change Password'
                  )}
                </Button>
              </div>
            </Form>
          </Tab>
        </Tabs>
      </Modal.Body>
    </Modal>
  );
};

export default ProfileModal;
