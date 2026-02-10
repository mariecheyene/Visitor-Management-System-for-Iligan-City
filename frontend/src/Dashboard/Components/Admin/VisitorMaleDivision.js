import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Table, Button, Modal, Form, 
  Alert, Badge, Spinner, InputGroup, Card, ButtonGroup 
} from 'react-bootstrap';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import { 
  Search, 
  Plus, 
  Eye, 
  Edit2, 
  Trash2, 
  Download,
  Upload,
  Printer,
  User,
  Grid,
  Clock,
  Calendar
} from 'react-feather';

const VisitorMaleDivision = () => {
  const [visitors, setVisitors] = useState([]);
  const [filteredVisitors, setFilteredVisitors] = useState([]);
  const [inmates, setInmates] = useState([]);
  const [maleInmates, setMaleInmates] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState(null);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [selectedQRVisitor, setSelectedQRVisitor] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBy, setSearchBy] = useState('lastName');
  const [csvFile, setCsvFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [prisonerIdSuggestions, setPrisonerIdSuggestions] = useState([]);
  const [prisonerIdInput, setPrisonerIdInput] = useState('');
  const [prisonerNameInput, setPrisonerNameInput] = useState('');
  const [prisonerNameSuggestions, setPrisonerNameSuggestions] = useState([]);

  const searchOptions = [
    { value: 'lastName', label: 'Last Name' },
    { value: 'firstName', label: 'First Name' },
    { value: 'id', label: 'Visitor ID' },
    { value: 'prisonerId', label: 'Prisoner ID' },
    { value: 'prisonerName', label: 'Prisoner Name' },
    { value: 'relationship', label: 'Relationship' },
    { value: 'status', label: 'Status' }
  ];

  useEffect(() => {
    fetchVisitors();
    fetchInmates();
  }, []);

  useEffect(() => {
    filterVisitors();
  }, [searchQuery, searchBy, visitors, maleInmates]);

  const fetchVisitors = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("http://localhost:5001/visitors");
      setVisitors(response.data);
    } catch (error) {
      console.error("Error fetching visitors:", error);
      toast.error("Failed to fetch visitors");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInmates = async () => {
    try {
      const response = await axios.get("http://localhost:5001/inmates");
      setInmates(response.data);
      // Filter only male inmates for suggestions
      const maleInmates = response.data.filter(inmate => 
        inmate.sex?.toLowerCase() === 'male'
      );
      setMaleInmates(maleInmates);
    } catch (error) {
      console.error('Error fetching PDLs:', error);
      toast.error('Failed to fetch PDLs');
    }
  };

  const filterVisitors = () => {
    let filtered = visitors;

    // FIRST: Filter visitors to only show those connected to male inmates
    if (maleInmates.length > 0) {
      const maleInmateCodes = maleInmates.map(inmate => inmate.inmateCode);
      filtered = filtered.filter(visitor => 
        maleInmateCodes.includes(visitor.prisonerId)
      );
    }

    // SECOND: Apply search filter if there's a search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(visitor => {
        if (searchBy === 'prisonerName') {
          // Search in prisonerName field
          const prisonerName = visitor.prisonerName?.toString().toLowerCase() || '';
          return prisonerName.includes(query);
        }
        
        const value = visitor[searchBy]?.toString().toLowerCase() || '';
        return value.includes(query);
      });
    }
    
    // THIRD: Sort alphabetically by last name, then first name
    filtered = filtered.sort((a, b) => {
      const lastNameCompare = a.lastName.localeCompare(b.lastName);
      if (lastNameCompare !== 0) {
        return lastNameCompare;
      }
      return a.firstName.localeCompare(b.firstName);
    });
    
    setFilteredVisitors(filtered);
  };

  const handlePrisonerIdChange = (e) => {
    const value = e.target.value;
    setPrisonerIdInput(value);
    
    // Filter suggestions based on input - ONLY MALE INMATES
    if (value.trim()) {
      const filtered = maleInmates.filter(inmate => 
        inmate.inmateCode.toLowerCase().includes(value.toLowerCase()) ||
        inmate.fullName.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5); // Show only top 5 suggestions
      setPrisonerIdSuggestions(filtered);
    } else {
      setPrisonerIdSuggestions([]);
    }
    
    setFormData(prev => ({
      ...prev,
      prisonerId: value
    }));
  };

  const handlePrisonerNameChange = (e) => {
    const value = e.target.value;
    setPrisonerNameInput(value);
    
    // Filter suggestions based on name input - ONLY MALE INMATES
    if (value.trim()) {
      const filtered = maleInmates.filter(inmate => 
        inmate.fullName.toLowerCase().includes(value.toLowerCase()) ||
        inmate.lastName.toLowerCase().includes(value.toLowerCase()) ||
        inmate.firstName.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5); // Show only top 5 suggestions
      setPrisonerNameSuggestions(filtered);
    } else {
      setPrisonerNameSuggestions([]);
    }
  };

  const selectPrisonerSuggestion = (inmate) => {
    setPrisonerIdInput(inmate.inmateCode);
    setPrisonerNameInput(inmate.fullName);
    setPrisonerIdSuggestions([]);
    setPrisonerNameSuggestions([]);
    
    setFormData(prev => ({
      ...prev,
      prisonerId: inmate.inmateCode
    }));
  };

  const selectPrisonerNameSuggestion = (inmate) => {
    setPrisonerNameInput(inmate.fullName);
    setPrisonerIdInput(inmate.inmateCode);
    setPrisonerNameSuggestions([]);
    setPrisonerIdSuggestions([]);
    
    setFormData(prev => ({
      ...prev,
      prisonerId: inmate.inmateCode
    }));
  };

  const handleAdd = () => {
    setEditingVisitor(null);
    setPrisonerIdInput('');
    setPrisonerNameInput('');
    setPrisonerIdSuggestions([]);
    setPrisonerNameSuggestions([]);
    const initialData = {
      lastName: '',
      firstName: '',
      middleName: '',
      extension: '',
      dateOfBirth: '',
      age: '',
      sex: '', // Let user select gender
      address: '',
      contact: '',
      prisonerId: '',
      relationship: '',
      status: 'approved'
    };
    setFormData(initialData);
    setImageFile(null);
    setShowModal(true);
  };

  const handleEdit = (visitor) => {
    setEditingVisitor(visitor);
    setPrisonerIdInput(visitor.prisonerId);
    setPrisonerNameInput(visitor.prisonerName || '');
    setPrisonerIdSuggestions([]);
    setPrisonerNameSuggestions([]);
    
    const formattedVisitor = {
      ...visitor,
      dateOfBirth: visitor.dateOfBirth ? visitor.dateOfBirth.split('T')[0] : ''
    };
    setFormData(formattedVisitor);
    setShowModal(true);
  };

  const handleView = (visitor) => {
    setSelectedVisitor(visitor);
    setShowViewModal(true);
  };

  const handleShowQR = async (visitor) => {
    setSelectedQRVisitor(visitor);
    setShowQRModal(true);
  };

  const handleDelete = async (visitorId) => {
    if (!window.confirm('Are you sure you want to delete this visitor?')) {
      return;
    }

    setIsLoading(true);
    try {
      await axios.delete(`http://localhost:5001/visitors/${visitorId}`);
      toast.success('Visitor deleted successfully!');
      fetchVisitors();
    } catch (error) {
      console.error('Error deleting visitor:', error);
      toast.error('Failed to delete visitor');
    } finally {
      setIsLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    extension: '',
    dateOfBirth: '',
    age: '',
    sex: '', // Let user select gender
    address: '',
    contact: '',
    prisonerId: '',
    relationship: '',
    status: 'approved'
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-calculate age if dateOfBirth changes
    if (name === 'dateOfBirth' && value) {
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      setFormData(prev => ({ ...prev, age: age.toString() }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImageFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate required fields
    if (!formData.lastName || !formData.firstName || !formData.sex || !formData.dateOfBirth || 
        !formData.address || !formData.contact || !formData.prisonerId || !formData.relationship) {
      toast.error('Please fill in all required fields');
      setIsLoading(false);
      return;
    }

    // Validate that prisoner ID belongs to a male inmate
    const selectedInmate = maleInmates.find(inmate => inmate.inmateCode === formData.prisonerId);
    if (!selectedInmate) {
      toast.error('Please select a valid male PDL from the suggestions');
      setIsLoading(false);
      return;
    }

    try {
      const submitData = new FormData();
      
      // Format data properly
      const formattedData = {
        ...formData,
        middleName: formData.middleName || '',
        extension: formData.extension || '',
        age: formData.age || '',
        status: 'approved'
      };

      // Append all form data
      Object.keys(formattedData).forEach(key => {
        if (formattedData[key] !== null && formattedData[key] !== undefined) {
          submitData.append(key, formattedData[key]);
        }
      });

      // Append image file
      if (imageFile) {
        submitData.append('photo', imageFile);
      }

      let response;
      if (editingVisitor) {
        response = await axios.put(`http://localhost:5001/visitors/${editingVisitor.id}`, submitData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        toast.success('Visitor updated successfully!');
      } else {
        response = await axios.post("http://localhost:5001/visitors", submitData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        toast.success('Visitor created successfully! QR code has been generated.');
      }
      
      setShowModal(false);
      resetForm();
      fetchVisitors();
    } catch (error) {
      console.error('Error submitting visitor:', error);
      console.error('Error response:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        `Failed to ${editingVisitor ? 'update' : 'create'} visitor`;
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    setCsvFile(e.target.files[0]);
  };

  const handleCsvUpload = async () => {
  if (!csvFile) {
    toast.error('Please select a CSV file');
    return;
  }

  setIsLoading(true);
  const formData = new FormData();
  formData.append('csvFile', csvFile);

  try {
    const response = await axios.post('http://localhost:5001/visitors/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    if (response.data.errors && response.data.errors.length > 0) {
      // Show errors but still success message
      toast.warning(`Imported ${response.data.imported} visitors with ${response.data.errors.length} errors`);
    } else {
      toast.success(`Successfully imported ${response.data.imported} visitors`);
    }
    
    setShowUploadModal(false);
    setCsvFile(null);
    fetchVisitors(); // This will re-fetch and re-sort the visitors
  } catch (error) {
    console.error('Error uploading CSV:', error);
    toast.error(error.response?.data?.message || 'Failed to upload CSV');
  } finally {
    setIsLoading(false);
  }
};

  const exportToCSV = () => {
  const headers = [
    'Visitor ID', 
    'Last Name', 
    'First Name', 
    'Middle Name', 
    'Extension',
    'Date of Birth', 
    'Age', 
    'Gender', 
    'Address', 
    'Contact',
    'PDL ID', 
    'PDL Name',
    'Relationship'
  ];

  const csvData = filteredVisitors.map(visitor => [
    visitor.id,
    visitor.lastName,
    visitor.firstName,
    visitor.middleName || '',
    visitor.extension || '',
    visitor.dateOfBirth ? new Date(visitor.dateOfBirth).toLocaleDateString() : '',
    visitor.age || '',
    visitor.sex,
    visitor.address,
    visitor.contact,
    visitor.prisonerId,
    visitor.prisonerName || 'N/A',
    visitor.relationship
  ]);

  const csvContent = [headers, ...csvData]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `male_division_visitors_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
  
  toast.success(`Exported ${filteredVisitors.length} male division visitors to CSV`);
};

  const downloadQRCode = () => {
    if (!selectedQRVisitor?.qrCode) return;
    
    const link = document.createElement('a');
    link.href = selectedQRVisitor.qrCode;
    link.download = `visitor-qr-${selectedQRVisitor.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR code downloaded successfully!');
  };

  const resetForm = () => {
    setFormData({
      lastName: '',
      firstName: '',
      middleName: '',
      extension: '',
      dateOfBirth: '',
      age: '',
      sex: '', // Reset to empty
      address: '',
      contact: '',
      prisonerId: '',
      relationship: '',
      status: 'approved'
    });
    setPrisonerIdInput('');
    setPrisonerNameInput('');
    setPrisonerIdSuggestions([]);
    setPrisonerNameSuggestions([]);
    setImageFile(null);
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'danger';
      default: return 'secondary';
    }
  };

  const getViolationVariant = (visitor) => {
    if (visitor.violationType && visitor.violationType.trim() !== '') {
      return 'danger';
    }
    return 'success';
  };

  const getViolationText = (visitor) => {
    if (visitor.violationType && visitor.violationType.trim() !== '') {
      return visitor.violationType;
    }
    return 'No violation';
  };

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'N/A';
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getTimeStatus = (visitor) => {
    if (!visitor.hasTimedIn) return { variant: 'secondary', text: 'Not Checked In' };
    if (visitor.hasTimedIn && !visitor.hasTimedOut) return { variant: 'success', text: 'Checked In' };
    if (visitor.hasTimedIn && visitor.hasTimedOut) return { variant: 'info', text: 'Checked Out' };
    return { variant: 'secondary', text: 'Unknown' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No visits';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'No visits';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'No visits';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'Not recorded';
    return timeString;
  };

  const printVisitorDetails = () => {
  const printWindow = window.open('', '_blank');
  
  printWindow.document.write(`
    <html>
      <head>
        <title>Visitor Details - ${selectedVisitor?.id}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            line-height: 1.4;
            color: #333;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 3px solid #333; 
            padding-bottom: 15px; 
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
          }
          .header h2 {
            margin: 5px 0 0 0;
            font-size: 18px;
            font-weight: normal;
            color: #2c3e50;
          }
          .header h3 {
            margin: 10px 0 0 0;
            font-size: 16px;
            font-weight: bold;
            color: #2c3e50;
          }
          .section { 
            margin-bottom: 25px; 
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .section h3 {
            margin-top: 0;
            color: #2c3e50;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .info-item {
            margin-bottom: 10px;
          }
          .label { 
            font-weight: bold; 
            color: #2c3e50;
            display: inline-block;
            width: 140px;
          }
          .full-width {
            grid-column: 1 / -1;
          }
          .qr-code {
            text-align: center;
            margin: 20px 0;
          }
          .qr-code img {
            max-width: 300px;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .visitor-photo {
            text-align: center;
            margin: 20px 0;
          }
          .visitor-photo img {
            max-width: 200px;
            max-height: 200px;
            object-fit: cover;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .photo-container {
            display: flex;
            justify-content: space-around;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 20px;
            margin: 20px 0;
          }
          .photo-item {
            text-align: center;
          }
          .photo-item h4 {
            margin-bottom: 10px;
            color: #2c3e50;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            background-color: #28a745;
          }
          .status-pending { background-color: #ffc107; color: #000; }
          .status-rejected { background-color: #dc3545; }
          @media print {
            body { margin: 10px; }
            .section { border: none; }
            .photo-container { 
              display: flex; 
              justify-content: space-around;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>LANAO DEL NORTE DISTRICT JAIL</h1>
          <h2>Region 10</h2>
          <h3>VISITOR DETAILS RECORD - ID: ${selectedVisitor?.id}</h3>
        </div>
        
        ${selectedVisitor ? `
          <div class="section">
            <h3>Identification</h3>
            <div class="photo-container">
              ${selectedVisitor.photo ? `
                <div class="photo-item">
                  <h4>Visitor Photo</h4>
                  <div class="visitor-photo">
                    <img src="http://localhost:5001/uploads/${selectedVisitor.photo}" alt="Visitor Photo" />
                  </div>
                </div>
              ` : ''}
              ${selectedVisitor.qrCode ? `
                <div class="photo-item">
                  <h4>QR Code</h4>
                  <div class="qr-code">
                    <img src="${selectedVisitor.qrCode}" alt="Visitor QR Code" />
                  </div>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="section">
            <h3>Visitor Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Visitor ID:</span> ${selectedVisitor.id}
              </div>
              <div class="info-item">
                <span class="label">Full Name:</span> ${selectedVisitor.fullName}
              </div>
              <div class="info-item">
                <span class="label">Gender:</span> ${selectedVisitor.sex}
              </div>
              <div class="info-item">
                <span class="label">Date of Birth:</span> ${new Date(selectedVisitor.dateOfBirth).toLocaleDateString()}
              </div>
              <div class="info-item">
                <span class="label">Age:</span> ${calculateAge(selectedVisitor.dateOfBirth)}
              </div>
              <div class="info-item full-width">
                <span class="label">Address:</span> ${selectedVisitor.address}
              </div>
              <div class="info-item">
                <span class="label">Contact:</span> ${selectedVisitor.contact || 'N/A'}
              </div>
              <div class="info-item">
                <span class="label">Status:</span> 
                <span class="status-badge status-${selectedVisitor.status}">${selectedVisitor.status.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Visit Details</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">PDL ID:</span> ${selectedVisitor.prisonerId}
              </div>
              <div class="info-item">
                <span class="label">PDL Name:</span> ${selectedVisitor.prisonerName || 'N/A'}
              </div>
              <div class="info-item">
                <span class="label">Relationship:</span> ${selectedVisitor.relationship}
              </div>
            </div>
          </div>

          <div class="section">
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        ` : ''}
      </body>
    </html>
  `);
  printWindow.document.close();
  
  // Wait for images to load before printing
  printWindow.onload = function() {
    setTimeout(() => {
      printWindow.print();
    }, 1000);
  };
};


  return (
    <Container>
      <ToastContainer />
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: "600", color: "#2c3e50" }}>
            👥 Male Division Visitors Management
          </h2>
          <Badge bg="primary" className="mb-2">
            Male Division Access Only
          </Badge>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-dark" size="sm" onClick={exportToCSV}>
            <Download size={16} className="me-1" />
            Export CSV
          </Button>
          <Button variant="outline-dark" size="sm" onClick={() => setShowUploadModal(true)}>
            <Upload size={16} className="me-1" />
            Import CSV
          </Button>
          <Button variant="dark" onClick={handleAdd}>
            <Plus size={16} className="me-1" />
            Add Visitor
          </Button>
        </div>
      </div>

      {/* Search Section */}
      <Card className="mb-4 border-0 bg-light">
        <Card.Body>
          <Row className="align-items-center">
            <Col md={8}>
              <InputGroup>
                <InputGroup.Text className="bg-white">
                  <Search size={16} />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search male division visitors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-start-0"
                />
                <Form.Select 
                  value={searchBy} 
                  onChange={(e) => setSearchBy(e.target.value)}
                  className="bg-white"
                  style={{ maxWidth: '150px' }}
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
              <div className="text-muted small">
                {filteredVisitors.length} visitors found (Male Division)
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {isLoading && visitors.length === 0 ? (
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading visitors...</span>
          </Spinner>
        </div>
      ) : filteredVisitors.length === 0 ? (
        <Alert variant="info">
          {searchQuery ? 'No male division visitors found matching your search.' : 'No male division visitors found. Add your first visitor to get started.'}
        </Alert>
      ) : (
        <div className="table-responsive" style={{ fontSize: '14px' }}>
  <Table striped bordered hover responsive className="bg-white">
    <thead className="table-dark">
      <tr>
        <th>Visitor ID</th>
        <th>Full Name</th>
        <th>Gender</th>
        <th>PDL ID</th>
        <th>PDL Name</th>
        <th>Relationship</th>
        <th>Last Visit Date</th>
        <th>Time Status</th>
        <th>Violation Type</th>
        <th style={{ width: '140px', minWidth: '140px' }}>Actions</th>
      </tr>
    </thead>
    <tbody>
      {filteredVisitors.map(visitor => (
        <tr key={visitor._id}>
          <td><strong>{visitor.id}</strong></td>
          <td>{visitor.fullName}</td>
          <td>{visitor.sex}</td>
          <td>{visitor.prisonerId}</td>
          <td className="prisoner-name">{visitor.prisonerName || 'N/A'}</td>
          <td>{visitor.relationship}</td>
          <td>
            {visitor.lastVisitDate ? (
              <Badge bg="info" className="text-wrap">
                {formatDate(visitor.lastVisitDate)}
              </Badge>
            ) : (
              <Badge bg="secondary" className="text-wrap">Not visited</Badge>
            )}
          </td>
          <td>
            <Badge bg={getTimeStatus(visitor).variant} className="text-wrap">
              {getTimeStatus(visitor).text}
            </Badge>
          </td>
          <td>
            <Badge bg={getViolationVariant(visitor)} className="text-wrap">
              {getViolationText(visitor)}
            </Badge>
          </td>
          <td>
            <div className="d-flex gap-1">
              <Button 
                variant="outline-primary" 
                size="sm" 
                onClick={() => handleShowQR(visitor)}
                className="p-1"
                title="QR Code"
              >
                <Grid size={14} />
              </Button>
              <Button 
                variant="outline-info" 
                size="sm" 
                onClick={() => handleView(visitor)}
                className="p-1"
                title="View Details"
              >
                <Eye size={14} />
              </Button>
              <Button 
                variant="outline-warning" 
                size="sm" 
                onClick={() => handleEdit(visitor)}
                className="p-1"
                title="Edit Visitor"
              >
                <Edit2 size={14} />
              </Button>
              <Button 
                variant="outline-danger" 
                size="sm" 
                onClick={() => handleDelete(visitor.id)}
                className="p-1"
                title="Delete Visitor"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </Table>
</div>
      )}

      {/* Add/Edit Modal */}
      
      <Modal 
        show={showModal} 
        onHide={() => setShowModal(false)} 
        size="lg"
        style={{ maxHeight: "85vh", top: "10vh" }}
        contentClassName="modal-content-scrollable"
      >
        <Modal.Header closeButton>
          <Modal.Title>{editingVisitor ? 'Edit Visitor' : 'Add New Visitor - Male Division'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <Alert variant="info" className="mb-3">
              <strong>Male Division:</strong> Visitors can only be connected to male PDLs.
            </Alert>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Last Name *</Form.Label>
                  <Form.Control
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter last name"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>First Name *</Form.Label>
                  <Form.Control
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter first name"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Middle Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleInputChange}
                    placeholder="Enter middle name"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Extension (Jr, Sr, III)</Form.Label>
                  <Form.Control
                    type="text"
                    name="extension"
                    value={formData.extension}
                    onChange={handleInputChange}
                    placeholder="e.g., Jr, Sr, III"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Gender *</Form.Label>
                  <Form.Select
                    name="sex"
                    value={formData.sex}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Date of Birth *</Form.Label>
                  <Form.Control
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Age</Form.Label>
                  <Form.Control
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    placeholder="Auto-calculated"
                    readOnly
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Contact Number *</Form.Label>
                  <Form.Control
                    type="text"
                    name="contact"
                    value={formData.contact}
                    onChange={handleInputChange}
                    required
                    placeholder="Phone number"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Address *</Form.Label>
              <Form.Control
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
                placeholder="Enter complete address"
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>PDL ID *</Form.Label>
                  <Form.Control
                    type="text"
                    value={prisonerIdInput}
                    onChange={handlePrisonerIdChange}
                    required
                    placeholder="Enter male PDL ID"
                  />
                  <Form.Text className="text-muted">
                    Only male PDLs available for selection
                  </Form.Text>
                  {prisonerIdSuggestions.length > 0 && (
                    <div className="border mt-1" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {prisonerIdSuggestions.map(inmate => (
                        <div
                          key={inmate._id}
                          className="p-2 border-bottom hover-bg"
                          style={{ cursor: 'pointer', backgroundColor: '#f8f9fa' }}
                          onClick={() => selectPrisonerSuggestion(inmate)}
                        >
                          <strong>{inmate.inmateCode}</strong> - {inmate.fullName} (Male)
                        </div>
                      ))}
                    </div>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>PDL Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={prisonerNameInput}
                    onChange={handlePrisonerNameChange}
                    placeholder="Search by PDL name"
                  />
                  <Form.Text className="text-muted">
                    Only male PDLs available for selection
                  </Form.Text>
                  {prisonerNameSuggestions.length > 0 && (
                    <div className="border mt-1" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {prisonerNameSuggestions.map(inmate => (
                        <div
                          key={inmate._id}
                          className="p-2 border-bottom hover-bg"
                          style={{ cursor: 'pointer', backgroundColor: '#f8f9fa' }}
                          onClick={() => selectPrisonerNameSuggestion(inmate)}
                        >
                          <strong>{inmate.fullName}</strong> - {inmate.inmateCode} (Male)
                        </div>
                      ))}
                    </div>
                  )}
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Relationship *</Form.Label>
                  <Form.Control
                    type="text"
                    name="relationship"
                    value={formData.relationship}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Spouse, Parent, Friend"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Visitor Photo</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              <Form.Text className="text-muted">
                Upload visitor's photo for identification
              </Form.Text>
            </Form.Group>

            <Alert variant="info" className="mt-3">
              <strong>Note:</strong> All visitors added by admin are automatically approved.
              A unique QR code will be generated for time-in/time-out tracking.
              Visitors can only be connected to male PDLs in this division.
            </Alert>
          </Modal.Body>
          <Modal.Footer className="py-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="dark" type="submit" disabled={isLoading}>
              {isLoading ? <Spinner size="sm" /> : (editingVisitor ? 'Update' : 'Add') + ' Visitor'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      
{/* View Modal */}
<Modal 
  show={showViewModal} 
  onHide={() => setShowViewModal(false)} 
  size="lg"
  style={{ maxHeight: "85vh", top: "10vh" }}
  contentClassName="modal-content-scrollable"
>
  <Modal.Header closeButton className="py-2">
    <Modal.Title className="fs-5">
      Visitor Details - {selectedVisitor?.id}
    </Modal.Title>
  </Modal.Header>
  <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
    {selectedVisitor && (
      <Row>
        {/* QR Code Section */}
        <Col md={12}>
          <Card className="mb-3">
            <Card.Header className="py-2">
              <strong className="small">QR Code</strong>
            </Card.Header>
            <Card.Body className="text-center py-2">
              {selectedVisitor.qrCode ? (
                <img 
                  src={selectedVisitor.qrCode} 
                  alt="Visitor QR Code" 
                  style={{ 
                    maxWidth: '250px', 
                    height: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '5px'
                  }}
                />
              ) : (
                <Alert variant="warning" className="py-2">
                  QR code not generated yet.
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
        
        {/* Visitor Photo and Information */}
        <Col md={6}>
          <Card className="mb-2">
            <Card.Header className="py-2">
              <strong className="small">Visitor Information</strong>
            </Card.Header>
            <Card.Body className="py-2">
              {selectedVisitor.photo && (
                <div className="text-center mb-2">
                  <img 
                    src={`http://localhost:5001/uploads/${selectedVisitor.photo}`}
                    alt="Visitor"
                    style={{ 
                      maxWidth: '150px', 
                      maxHeight: '150px', 
                      objectFit: 'cover',
                      borderRadius: '5px'
                    }}
                  />
                </div>
              )}
              <p className="mb-1 small"><strong>Visitor ID:</strong> {selectedVisitor.id}</p>
              <p className="mb-1 small"><strong>Full Name:</strong> {selectedVisitor.fullName}</p>
              <p className="mb-1 small"><strong>Gender:</strong> {selectedVisitor.sex}</p>
              <p className="mb-1 small"><strong>Date of Birth:</strong> {new Date(selectedVisitor.dateOfBirth).toLocaleDateString()}</p>
              <p className="mb-1 small"><strong>Age:</strong> {calculateAge(selectedVisitor.dateOfBirth)}</p>
              <p className="mb-1 small"><strong>Address:</strong> {selectedVisitor.address}</p>
              <p className="mb-1 small"><strong>Contact:</strong> {selectedVisitor.contact || 'N/A'}</p>
              <p className="mb-1 small"><strong>Status:</strong> <Badge bg={getStatusVariant(selectedVisitor.status)}>{selectedVisitor.status}</Badge></p>
            </Card.Body>
          </Card>
        </Col>
        
        {/* PDL Information Only */}
        <Col md={6}>
          <Card className="mb-2">
            <Card.Header className="py-2">
              <strong className="small">Visit Details</strong>
            </Card.Header>
            <Card.Body className="py-2">
              <p className="mb-1 small"><strong>PDL ID:</strong> {selectedVisitor.prisonerId}</p>
              <p className="mb-1 small"><strong>PDL Name:</strong> {selectedVisitor.prisonerName || 'N/A'}</p>
              <p className="mb-1 small"><strong>Relationship:</strong> {selectedVisitor.relationship}</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    )}
  </Modal.Body>
  <Modal.Footer className="py-2">
    <Button variant="secondary" onClick={() => setShowViewModal(false)}>
      Close
    </Button>
    <Button variant="dark" onClick={printVisitorDetails}>
      <Printer size={16} className="me-1" />
      Print
    </Button>
  </Modal.Footer>
</Modal>
      
            {/* QR Code Modal */}
      <Modal show={showQRModal} onHide={() => setShowQRModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Visitor QR Code - {selectedQRVisitor?.id}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {selectedQRVisitor ? (
            <>
              {selectedQRVisitor.qrCode ? (
                <>
                  <img 
                    src={selectedQRVisitor.qrCode} 
                    alt="Visitor QR Code" 
                    style={{ 
                      maxWidth: '100%', 
                      height: 'auto',
                      border: '1px solid #ddd',
                      borderRadius: '5px'
                    }}
                  />
                  <div className="mt-3">
                    <p><strong>Visitor:</strong> {selectedQRVisitor.fullName}</p>
                    <p><strong>PDL ID:</strong> {selectedQRVisitor.prisonerId}</p>
                    <p><strong>Relationship:</strong> {selectedQRVisitor.relationship}</p>
                  </div>
                </>
              ) : (
                <Alert variant="warning">
                  QR code not generated for this visitor.
                </Alert>
              )}
            </>
          ) : (
            <Alert variant="danger">
              No visitor selected.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowQRModal(false)}>
            Close
          </Button>
          {selectedQRVisitor?.qrCode && (
            <Button variant="dark" onClick={downloadQRCode}>
              <Download size={16} className="me-1" />
              Download QR
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* CSV Upload Modal */}
<Modal show={showUploadModal} onHide={() => setShowUploadModal(false)} size="lg" centered>
  <Modal.Header closeButton>
    <Modal.Title>Import Visitors from CSV</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    <Alert variant="info" className="mb-4">
      <strong>CSV Format Requirements:</strong>
      <br />
      Your CSV file should include these columns in the header row:
      <ul className="mb-0 mt-2">
        <li><strong>Last Name</strong> (required)</li>
        <li><strong>First Name</strong> (required)</li>
        <li><strong>Middle Name</strong> (optional)</li>
        <li><strong>Extension</strong> (optional - Jr, Sr, III)</li>
        <li><strong>Date of Birth</strong> (required - YYYY-MM-DD or MM/DD/YYYY)</li>
        <li><strong>Gender</strong> (required - Male or Female)</li>
        <li><strong>Address</strong> (required)</li>
        <li><strong>Contact</strong> (required)</li>
        <li><strong>PDL ID</strong> (required)</li>
        <li><strong>PDL Name</strong> (recommended - will be looked up if not provided)</li>
        <li><strong>Relationship</strong> (required - e.g., Spouse, Parent, Friend)</li>
      </ul>
    </Alert>

    <Form.Group>
      <Form.Label>Select CSV File</Form.Label>
      <Form.Control
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
      />
      <Form.Text className="text-muted">
        CSV file should have headers matching the format above. File will be processed immediately after selection.
      </Form.Text>
    </Form.Group>

    {csvFile && (
      <Alert variant="success" className="mt-3">
        <strong>File selected:</strong> {csvFile.name}
        <br />
        <small>Ready to upload. Click "Upload CSV" to proceed.</small>
      </Alert>
    )}
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => {
      setShowUploadModal(false);
      setCsvFile(null);
    }}>
      Cancel
    </Button>
    <Button 
      variant="dark" 
      onClick={handleCsvUpload} 
      disabled={!csvFile || isLoading}
    >
      {isLoading ? <Spinner size="sm" /> : 'Upload CSV'}
    </Button>
  </Modal.Footer>
</Modal>
    </Container>
  );
};

export default VisitorMaleDivision;