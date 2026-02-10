import React, { useState, useEffect } from 'react';
import { Container, Table, Button, Modal, Form, Badge, Spinner, Alert } from 'react-bootstrap';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from 'axios';
import { Edit2, Trash2, Play, Square } from 'react-feather'; // Import icons

const Crimes = () => {
  const [crimes, setCrimes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCrime, setEditingCrime] = useState(null);
  const [formData, setFormData] = useState({ crime: '', status: 'active' });
  const [isLoading, setIsLoading] = useState(false);
  const [crimeError, setCrimeError] = useState('');
  const [fetchLoading, setFetchLoading] = useState(true);

  // API base URL
  const API_BASE = 'http://localhost:5001';

  useEffect(() => {
    fetchCrimes();
  }, []);

  const fetchCrimes = async () => {
    setFetchLoading(true);
    try {
      console.log('🔄 Fetching crimes from:', `${API_BASE}/crimes`);
      const response = await axios.get(`${API_BASE}/crimes`);
      console.log('✅ Crimes fetched:', response.data);
      setCrimes(response.data);
    } catch (error) {
      console.error('❌ Error fetching crimes:', error);
      toast.error('Failed to fetch crimes. Check if backend is running.');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  console.log('=== 🚨 handleSubmit STARTED 🚨 ===');
  console.log('📝 Form Data:', formData);
  console.log('✏️ Editing Crime:', editingCrime);
  
  if (!formData.crime.trim()) {
    console.log('❌ Validation failed: Empty crime name');
    setCrimeError('Please enter a crime name');
    return;
  }

  setIsLoading(true);
  
  try {
    const url = editingCrime 
      ? `${API_BASE}/crimes/${editingCrime._id}`
      : `${API_BASE}/crimes`;
    
    const method = editingCrime ? 'PUT' : 'POST';
    const payload = {
      crime: formData.crime.trim(),
      status: formData.status
    };

    console.log('🌐 API Request Details:');
    console.log('   URL:', url);
    console.log('   Method:', method);
    console.log('   Payload:', payload);

    // Make the API call with maximum debugging
    const response = await axios({
      method: method,
      url: url,
      data: payload,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: function (status) {
        return true; // Don't throw error on any status code
      }
    });

    console.log('✅ API Response Received:');
    console.log('   Status:', response.status);
    console.log('   Status Text:', response.statusText);
    console.log('   Headers:', response.headers);
    console.log('   Data:', response.data);

    if (response.status >= 200 && response.status < 300) {
      // Success
      console.log('🎉 SUCCESS: Crime operation completed');
      toast.success(`Crime ${editingCrime ? 'updated' : 'created'} successfully`);
      setShowModal(false);
      setFormData({ crime: '', status: 'active' });
      setCrimeError('');
      fetchCrimes();
    } else {
      // Server returned error status
      console.log('❌ SERVER ERROR:', response.status);
      throw new Error(`Server returned ${response.status}: ${response.data?.message || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.log('=== 🚨 ERROR CAUGHT 🚨 ===');
    console.log('💥 Error Name:', error.name);
    console.log('💥 Error Message:', error.message);
    console.log('💥 Error Stack:', error.stack);
    console.log('💥 Full Error Object:', JSON.stringify(error, null, 2));
    
    if (axios.isAxiosError(error)) {
      console.log('🔧 Axios Error Details:');
      console.log('   - Response:', error.response);
      console.log('   - Request:', error.request);
      console.log('   - Config:', error.config);
      
      if (error.response) {
        // Server responded with error status
        console.log('🔧 Server Response Error:');
        console.log('   Status:', error.response.status);
        console.log('   Data:', error.response.data);
        console.log('   Headers:', error.response.headers);
        
        if (error.response.status === 409) {
          setCrimeError('This crime already exists');
          toast.error('This crime already exists');
        } else if (error.response.data?.message) {
          toast.error(`Server Error: ${error.response.data.message}`);
        } else {
          toast.error(`Server Error: ${error.response.status}`);
        }
      } else if (error.request) {
        // No response received
        console.log('🔧 No Response Error:');
        console.log('   Request:', error.request);
        toast.error('Cannot connect to server. Make sure backend is running on localhost:5001');
      } else {
        // Other error
        console.log('🔧 Other Axios Error:');
        toast.error(`Network Error: ${error.message}`);
      }
    } else {
      // Non-Axios error
      console.log('🔧 Non-Axios Error:');
      toast.error(`Error: ${error.message}`);
    }
  } finally {
    console.log('=== 🏁 handleSubmit COMPLETED 🏁 ===');
    setIsLoading(false);
  }
};
// Add this function to test the backend
const testBackend = async () => {
  console.log('=== 🔍 Testing Backend Connection 🔍 ===');
  try {
    const response = await axios.get(`${API_BASE}/`, { 
      timeout: 5001,
      validateStatus: () => true // Don't throw on any status
    });
    console.log('✅ Backend Health Check:');
    console.log('   Status:', response.status);
    console.log('   Data:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Backend Connection Failed:');
    console.log('   Error:', error.message);
    return false;
  }
};

// Update your useEffect to test backend
useEffect(() => {
  console.log('=== 🏁 Crimes Component Mounted 🏁 ===');
  testBackend().then(isConnected => {
    if (isConnected) {
      fetchCrimes();
    } else {
      toast.error('Backend server is not accessible. Please start your backend server.');
    }
  });
}, []);

  const handleDelete = async (crimeId) => {
    if (!window.confirm('Are you sure you want to delete this crime?')) {
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 Deleting crime:', crimeId);
      await axios.delete(`${API_BASE}/crimes/${crimeId}`);
      console.log('✅ Crime deleted');
      toast.success('Crime deleted successfully');
      fetchCrimes();
    } catch (error) {
      console.error('❌ Error deleting crime:', error);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to delete crime');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusToggle = async (crimeId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    setIsLoading(true);
    try {
      console.log('🔄 Toggling status:', crimeId, newStatus);
      await axios.put(`${API_BASE}/crimes/${crimeId}`, {
        status: newStatus
      });
      console.log('✅ Status updated');
      toast.success(`Crime status updated to ${newStatus}`);
      fetchCrimes();
    } catch (error) {
      console.error('❌ Error updating status:', error);
      toast.error('Failed to update crime status');
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCrime(null);
    setFormData({ crime: '', status: 'active' });
    setCrimeError('');
    setShowModal(true);
  };

  const openEditModal = (crime) => {
    setEditingCrime(crime);
    setFormData({ crime: crime.crime, status: crime.status });
    setCrimeError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setCrimeError('');
  };

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: "600", color: "#ffffffff" }}>
          ⚖️ Crime Management
        </h2>
        <Button 
          onClick={openAddModal} 
          disabled={isLoading}
          style={{ backgroundColor: "#FFD700", color: "#000000", border: "none", fontWeight: "600" }}
        >
          Add New Crime
        </Button>
      </div>

      {fetchLoading ? (
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading crimes...</span>
          </Spinner>
          <p className="mt-2">Loading crimes...</p>
        </div>
      ) : crimes.length === 0 ? (
        <Alert variant="info">
          No crimes found. Add your first crime to get started.
        </Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Crime Name</th>
              <th>Status</th>
              <th>Created Date</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {crimes.map(crime => (
              <tr key={crime._id}>
                <td>{crime.crime}</td>
                <td>
                  <Badge bg={crime.status === 'active' ? 'success' : 'secondary'}>
                    {crime.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td>{crime.createdAt ? new Date(crime.createdAt).toLocaleDateString() : 'N/A'}</td>
                <td>
                  <div className="d-flex gap-1 justify-content-center">
                    <Button 
                      variant={crime.status === 'active' ? 'outline-warning' : 'outline-success'}
                      size="sm" 
                      onClick={() => handleStatusToggle(crime._id, crime.status)}
                      disabled={isLoading}
                      className="p-1"
                      title={crime.status === 'active' ? 'Deactivate' : 'Activate'}
                    >
                      {crime.status === 'active' ? <Square size={14} /> : <Play size={14} />}
                    </Button>
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      onClick={() => openEditModal(crime)}
                      disabled={isLoading}
                      className="p-1"
                      title="Edit Crime"
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button 
                      variant="outline-danger" 
                      size="sm" 
                      onClick={() => handleDelete(crime._id)}
                      disabled={isLoading}
                      className="p-1"
                      title="Delete Crime"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal 
  show={showModal} 
  onHide={closeModal}
  style={{ maxHeight: "85vh", top: "10vh" }}
>
  <Modal.Header closeButton className="py-2">
    <Modal.Title className="fs-5">
      {editingCrime ? 'Edit Crime' : 'Add New Crime'}
    </Modal.Title>
  </Modal.Header>
  <Form onSubmit={handleSubmit}>
    <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
      <Form.Group className="mb-3">
        <Form.Label className="small">Crime Name *</Form.Label>
        <Form.Control
          type="text"
          value={formData.crime}
          onChange={(e) => {
            setFormData({...formData, crime: e.target.value});
            setCrimeError('');
          }}
          required
          placeholder="Enter crime name"
          isInvalid={!!crimeError}
          disabled={isLoading}
        />
        <Form.Control.Feedback type="invalid">
          {crimeError}
        </Form.Control.Feedback>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label className="small">Status</Form.Label>
        <Form.Select
          value={formData.status}
          onChange={(e) => setFormData({...formData, status: e.target.value})}
          disabled={isLoading}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Form.Select>
        <Form.Text className="text-muted small">
          Active crimes can be assigned to PDLs
        </Form.Text>
      </Form.Group>
    </Modal.Body>
    <Modal.Footer className="py-2">
      <Button variant="secondary" onClick={closeModal} disabled={isLoading}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" disabled={isLoading}>
        {isLoading ? (
          <>
            <Spinner animation="border" size="sm" className="me-2" />
            {editingCrime ? 'Updating...' : 'Creating...'}
          </>
        ) : (
          editingCrime ? 'Update Crime' : 'Add Crime'
        )}
      </Button>
    </Modal.Footer>
  </Form>
</Modal>

      <ToastContainer position="top-right" autoClose={3000} />
    </Container>
  );
};

export default Crimes;