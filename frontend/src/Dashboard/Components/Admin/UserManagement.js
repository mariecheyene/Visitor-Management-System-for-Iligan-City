import React, { useState, useEffect } from "react";
import { 
  Container, Row, Col, Table, Button, Modal, Form, 
  Spinner, Badge, Card, InputGroup, Alert, Dropdown 
} from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import { Edit2, Trash2, Eye, EyeOff, Search, Plus, Download, MoreVertical, UserCheck, UserX } from 'react-feather';

const UserManagement = () => {
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "",
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    role: "",
    isActive: true
  });
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBy, setSearchBy] = useState('name');

  const searchOptions = [
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
    { value: 'role', label: 'Role' },
    { value: 'status', label: 'Status' }
  ];

  // Predefined system accounts that cannot be edited or deleted
  const predefinedAccounts = ["fulladmin@prison.com", "system@prison.com"];

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, searchBy, users]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("http://localhost:5001/users");
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter(user => {
      const query = searchQuery.toLowerCase();
      
      if (searchBy === 'status') {
        const status = user.isActive ? 'active' : 'inactive';
        return status.includes(query);
      }
      
      const value = user[searchBy]?.toString().toLowerCase() || '';
      return value.includes(query);
    });
    
    setFilteredUsers(filtered);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === "role") setRoleError("");
  };

  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData({ 
      ...editFormData, 
      [name]: type === 'checkbox' ? checked : value 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.role) {
      setRoleError("Please select a role");
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post("http://localhost:5001/users", {
        name: formData.name,
        email: formData.email.toLowerCase(),
        password: formData.password,
        role: formData.role,
        isActive: true // New users are active by default
      });

      toast.success("User created successfully!");
      setFormData({ name: "", email: "", password: "", role: "" });
      setShowPassword(false);
      fetchUsers();
      setShowModal(false);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = error.response?.data?.message || error.message || "Failed to create user";
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = (user) => {
    console.log("Editing user:", user);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    
    if (!editFormData.role) {
      setRoleError("Please select a role");
      return;
    }

    setIsLoading(true);

    try {
      const userToUpdate = users.find(user => user.email === editFormData.email);
      if (!userToUpdate) {
        toast.error("User not found");
        return;
      }

      const response = await axios.put(`http://localhost:5001/users/${userToUpdate._id}`, {
        name: editFormData.name,
        role: editFormData.role,
        isActive: editFormData.isActive
      });

      console.log("Update response:", response.data);
      toast.success("User updated successfully!");
      fetchUsers();
      setShowEditModal(false);
    } catch (error) {
      console.error("Update error:", error);
      const errorMessage = error.response?.data?.message || error.message || "Failed to update user";
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // NEW: Toggle user active status
  const handleToggleStatus = async (user) => {
    if (predefinedAccounts.includes(user.email.toLowerCase())) {
      toast.error("Cannot change status of predefined system accounts");
      return;
    }

    const newStatus = !user.isActive;
    const action = newStatus ? "activate" : "deactivate";
    
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) {
      return;
    }

    setIsLoading(true);
    try {
      await axios.put(`http://localhost:5001/users/${user._id}`, {
        name: user.name,
        role: user.role,
        isActive: newStatus
      });

      toast.success(`User ${action}d successfully!`);
      fetchUsers();
    } catch (error) {
      toast.error(`Failed to ${action} user`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (email) => {
    if (predefinedAccounts.includes(email.toLowerCase())) {
      toast.error("Cannot delete predefined system accounts");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    setIsLoading(true);
    try {
      const userToDelete = users.find(user => user.email === email);
      if (!userToDelete) {
        toast.error("User not found");
        return;
      }

      await axios.delete(`http://localhost:5001/users/${userToDelete._id}`);
      toast.success("User deleted successfully!");
      fetchUsers();
    } catch (error) {
      toast.error("Failed to delete user");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to format role for display
  const formatRole = (role) => {
    const roleMap = {
      'FullAdmin': 'Full Admin',
      'MaleAdmin': 'Male Admin',
      'FemaleAdmin': 'Female Admin',
      'FullStaff': 'Full Staff',
      'MaleStaff': 'Male Staff',
      'FemaleStaff': 'Female Staff'
    };
    return roleMap[role] || role;
  };

  // Function to get badge color based on role
  const getRoleBadgeVariant = (role) => {
    const variantMap = {
      'FullAdmin': 'danger',
      'MaleAdmin': 'primary',
      'FemaleAdmin': 'info',
      'FullStaff': 'warning',
      'MaleStaff': 'success',
      'FemaleStaff': 'secondary'
    };
    return variantMap[role] || 'secondary';
  };

  // NEW: Function to get status badge
  const getStatusBadge = (isActive) => {
    return isActive ? (
      <Badge bg="success">Active</Badge>
    ) : (
      <Badge bg="secondary">Inactive</Badge>
    );
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Role', 'Status'];
    const csvData = users.map(user => [
      user.name,
      user.email,
      formatRole(user.role),
      user.isActive ? 'Active' : 'Inactive'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    toast.success(`Exported ${users.length} users to CSV`);
  };

  return (
    <Container>
      <ToastContainer />
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: "600", color: "#ffffffff" }}>
            👤 User Management
          </h2>
          <Badge bg="info" className="mb-2">
            Admin Access
          </Badge>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-dark" size="sm" onClick={exportToCSV}>
            <Download size={16} className="me-1" />
            Export CSV
          </Button>
          <Button variant="dark" onClick={() => setShowModal(true)}>
            <Plus size={16} className="me-1" />
            Add User
          </Button>
        </div>
      </div>

      {/* Role Information Cards */}
      <Row className="mb-4">
        <Col md={12}>
          <Card style={{ 
            borderLeft: '2px solid #ffc107', 
            borderRight: '2px solid #ffc107', 
            borderTop: '6px solid #ffc107', 
            borderBottom: '2px solid #ffc107', 
            backgroundColor: '#353434a7', 
            borderRadius: '12px'
          }}>
            <Card.Body>
              <h6 className="mb-3" style={{ color: '#ffc107' }}>Role Permissions Overview</h6>
              <Row>
                <Col md={4}>
                  <strong style={{ color: '#ffc107' }}>Admin Roles:</strong>
                  <ul className="mb-0 mt-2">
                    <li><Badge bg="danger">Full Admin</Badge> - Full system access</li>
                    <li><Badge bg="primary">Male Admin</Badge> - Male section management</li>
                    <li><Badge bg="info">Female Admin</Badge> - Female section management</li>
                  </ul>
                </Col>
                <Col md={4}>
                  <strong style={{ color: '#ffc107' }}>Staff Roles:</strong>
                  <ul className="mb-0 mt-2">
                    <li><Badge bg="warning">Full Staff</Badge> - Full staff access</li>
                    <li><Badge bg="success">Male Staff</Badge> - Male section access</li>
                    <li><Badge bg="secondary">Female Staff</Badge> - Female section access</li>
                  </ul>
                </Col>
                <Col md={4}>
                  <strong style={{ color: '#ffc107' }}>Notes:</strong>
                  <ul className="mb-0 mt-2">
                    <li>System accounts cannot be deleted</li>
                    <li>Admins have higher privileges than staff</li>
                    <li>Inactive users cannot login to the system</li>
                  </ul>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card style={{ 
        backgroundColor: '#676767a7', 
        borderRadius: '12px', marginBottom: '20px', 
        borderLeft: '4px solid #FFD700', 
        borderRight: '4px solid #FFD700',}}>
        <Card.Body>
          <Row className="align-items-center">
            <Col md={8}>
              <InputGroup>
                <InputGroup.Text className="bg-white">
                  <Search size={16} color="#000000" />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-start-0"
                />
                <Form.Select 
                  value={searchBy} 
                  onChange={(e) => setSearchBy(e.target.value)}
                  className="bg-white"
                  style={{ maxWidth: '150px', color: '#000000' }}
                >
                  {searchOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </InputGroup>
            </Col>
            <Col md={4}>
              <div className="small" style={{ color: '#ffffffff', textAlign: 'right' }}>
                {filteredUsers.length} users found 
                {users.length > 0 && (
                  <span className="ms-2" style={{ color: '#ffffffff' }}>
                    ({users.filter(u => u.isActive).length} active, {users.filter(u => !u.isActive).length} inactive)
                  </span>
                )}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Users Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">System Users</h5>
        </Card.Header>
        <Card.Body className="p-0">
          {isLoading && users.length === 0 ? (
            <div className="text-center p-4">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          ) : filteredUsers.length === 0 ? (
            <Alert variant="info" className="m-3">
              {searchQuery ? 'No users found matching your search.' : 'No users found. Click "Add User" to create the first user.'}
            </Alert>
          ) : (
            <Table striped bordered hover responsive className="mb-0 bg-white">
              <thead className="table-dark">
                <tr>
                  <th className="text-center align-middle">Name</th>
                  <th className="text-center align-middle">Email</th>
                  <th className="text-center align-middle">Role</th>
                  <th className="text-center align-middle">Status</th>
                  <th className="text-center align-middle">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isPredefined = predefinedAccounts.includes(user.email.toLowerCase());
                  
                  return (
                    <tr key={user.email}>
                      <td className="align-middle">
                        <div className="d-flex align-items-center justify-content-start">
                          <span>{user.name}</span>
                          {isPredefined && (
                            <Badge bg="primary" className="ms-2">System Account</Badge>
                          )}
                        </div>
                      </td>
                      <td className="align-middle text-center">{user.email}</td>
                      <td className="align-middle text-center">
                        <Badge bg={getRoleBadgeVariant(user.role)}>
                          {formatRole(user.role)}
                        </Badge>
                      </td>
                      <td className="align-middle text-center">
                        {getStatusBadge(user.isActive)}
                      </td>
                      <td className="align-middle text-center">
                        <div className="d-flex gap-1 justify-content-center">
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            onClick={() => handleEditUser(user)}
                            disabled={isLoading}
                            className="p-1"
                            title="Edit User"
                          >
                            <Edit2 size={14} />
                          </Button>
                          
                          {/* NEW: Status Toggle Button */}
                          <Button 
                            variant={user.isActive ? "outline-warning" : "outline-success"}
                            size="sm" 
                            onClick={() => handleToggleStatus(user)}
                            disabled={isLoading || isPredefined}
                            className="p-1"
                            title={user.isActive ? "Deactivate User" : "Activate User"}
                          >
                            {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                          </Button>
                          
                          <Button 
                            variant="outline-danger" 
                            size="sm" 
                            onClick={() => handleDeleteUser(user.email)}
                            disabled={isLoading || isPredefined}
                            className="p-1"
                            title="Delete User"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Add User Modal */}
      <Modal 
        show={showModal} 
        onHide={() => {
          setShowModal(false);
          setRoleError("");
          setFormData({ name: "", email: "", password: "", role: "" });
          setShowPassword(false);
        }}
        style={{ maxHeight: "85vh", top: "10vh" }}
      >
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-5">Add New User</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label className="small">Full Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter full name"
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label className="small">Email Address</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter email address"
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label className="small">Password</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter password"
                  required
                  minLength="6"
                />
                <Button 
                  variant="outline-secondary"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ borderLeft: 'none' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </InputGroup>
              <Form.Text className="text-muted small">
                Password must be at least 6 characters long.
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label className="small">User Role</Form.Label>
              <Form.Select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
                isInvalid={!!roleError}
              >
                <option value="">Select a role</option>
                <optgroup label="Administrator Roles">
                  <option value="FullAdmin">Full Admin</option>
                  <option value="MaleAdmin">Male Admin</option>
                  <option value="FemaleAdmin">Female Admin</option>
                </optgroup>
                <optgroup label="Staff Roles">
                  <option value="FullStaff">Full Staff</option>
                  <option value="MaleStaff">Male Staff</option>
                  <option value="FemaleStaff">Female Staff</option>
                </optgroup>
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {roleError}
              </Form.Control.Feedback>
              <Form.Text className="text-muted small">
                Select appropriate role based on required access level.
              </Form.Text>
            </Form.Group>
            
            <div className="d-flex gap-2">
              <Button variant="dark" type="submit" disabled={isLoading} className="flex-fill">
                {isLoading ? <Spinner size="sm" /> : "Create User"}
              </Button>
              <Button 
                variant="outline-secondary" 
                onClick={() => {
                  setShowModal(false);
                  setRoleError("");
                  setShowPassword(false);
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Edit User Modal - UPDATED WITH STATUS TOGGLE */}
      <Modal 
        show={showEditModal} 
        onHide={() => {
          setShowEditModal(false);
          setRoleError("");
        }}
        style={{ maxHeight: "85vh", top: "10vh" }}
      >
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-5">Edit User</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <Form onSubmit={handleUpdateUser}>
            <Form.Group className="mb-3">
              <Form.Label className="small">Full Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={editFormData.name}
                onChange={handleEditInputChange}
                placeholder="Enter full name"
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label className="small">Email Address</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={editFormData.email}
                disabled
                className="bg-light"
              />
              <Form.Text className="text-muted small">
                Email cannot be changed.
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label className="small">User Role</Form.Label>
              <Form.Select
                name="role"
                value={editFormData.role}
                onChange={handleEditInputChange}
                required
                isInvalid={!!roleError}
              >
                <option value="">Select a role</option>
                <optgroup label="Administrator Roles">
                  <option value="FullAdmin">Full Admin</option>
                  <option value="MaleAdmin">Male Admin</option>
                  <option value="FemaleAdmin">Female Admin</option>
                </optgroup>
                <optgroup label="Staff Roles">
                  <option value="FullStaff">Full Staff</option>
                  <option value="MaleStaff">Male Staff</option>
                  <option value="FemaleStaff">Female Staff</option>
                </optgroup>
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {roleError}
              </Form.Control.Feedback>
            </Form.Group>

            {/* NEW: Status Toggle in Edit Modal */}
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                name="isActive"
                label="User is active (can login to system)"
                checked={editFormData.isActive}
                onChange={handleEditInputChange}
                className="small"
              />
              <Form.Text className="text-muted small">
                When unchecked, user will not be able to login or access the system.
              </Form.Text>
            </Form.Group>
            
            <div className="d-flex gap-2">
              <Button variant="dark" type="submit" disabled={isLoading} className="flex-fill">
                {isLoading ? <Spinner size="sm" /> : "Update User"}
              </Button>
              <Button 
                variant="outline-secondary" 
                onClick={() => setShowEditModal(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default UserManagement;