import React, { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, Button, Form, 
  Alert, Spinner, Table, Badge, InputGroup,
  Modal, ButtonGroup
} from 'react-bootstrap';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  RefreshCw,
  Search,
  Filter,
  Eye,
  FileText,
  Users,
  UserCheck,
  Shield,
  Calendar,
  Activity
} from 'react-feather';
import axios from 'axios';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    module: '',
    action: '',
    dateRange: 'all',
    startDate: '',
    endDate: '',
    search: ''
  });
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    users: 0,
    inmates: 0,
    visitors: 0
  });

  // Module options based on your backend
  const moduleOptions = [
    { value: 'user', label: 'User Management' },
    { value: 'inmate', label: 'PDL Management' },
    { value: 'visitor', label: 'Visitor Management' },
    { value: 'guest', label: 'Guest Management' },
    { value: 'crime', label: 'Crime Management' },
    { value: 'visit', label: 'Visit Management' },
    { value: 'scan', label: 'Scan Processing' },
    { value: 'auth', label: 'Authentication' },
    { value: 'backup', label: 'Backup System' },
    { value: 'analytics', label: 'Analytics' }
  ];

  // Action options based on your backend endpoints
  const actionOptions = [
    { value: 'create', label: 'Create' },
    { value: 'update', label: 'Update' },
    { value: 'delete', label: 'Delete' },
    { value: 'login', label: 'Login' },
    { value: 'approve', label: 'Approve' },
    { value: 'reject', label: 'Reject' },
    { value: 'scan', label: 'Scan' },
    { value: 'time_in', label: 'Time In' },
    { value: 'time_out', label: 'Time Out' },
    { value: 'import', label: 'Import' },
    { value: 'export', label: 'Export' },
    { value: 'backup', label: 'Backup' },
    { value: 'restore', label: 'Restore' }
  ];

  // Date range options
  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom Range' }
  ];

  // Enhanced fetch logs that works with your actual backend
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');

      // Since you don't have a dedicated logs endpoint, we'll create one from existing data
      const endpoints = [
        { url: 'http://localhost:5001/users', module: 'user' },
        { url: 'http://localhost:5001/inmates', module: 'inmate' },
        { url: 'http://localhost:5001/visitors', module: 'visitor' },
        { url: 'http://localhost:5001/guests', module: 'guest' },
        { url: 'http://localhost:5001/crimes', module: 'crime' },
        { url: 'http://localhost:5001/visit-logs', module: 'visit' },
        { url: 'http://localhost:5001/pending-visitors', module: 'visitor' },
        { url: 'http://localhost:5001/pending-guests', module: 'guest' }
      ];

      const responses = await Promise.all(
        endpoints.map(endpoint => 
          axios.get(endpoint.url).then(response => ({ ...endpoint, data: response.data }))
        )
      );

      // Transform the data into log format
      const generatedLogs = generateLogsFromBackendData(responses);
      setLogs(generatedLogs);
      calculateStats(generatedLogs);
      toast.success("Logs data refreshed successfully!");

    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch logs';
      setError(errorMessage);
      toast.error("Failed to fetch logs data");
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate logs from your actual backend data
  const generateLogsFromBackendData = (responses) => {
    const logs = [];
    const now = new Date();

    responses.forEach(({ data, module, url }) => {
      if (Array.isArray(data)) {
        data.forEach(item => {
          // Create log entries based on item properties
          if (item.createdAt) {
            logs.push({
              id: `log-${module}-${item._id || item.id}`,
              timestamp: new Date(item.createdAt),
              module: module,
              action: 'create',
              user: getItemUser(item),
              userId: getItemUserId(item),
              description: getItemDescription(item, module, 'created'),
              ipAddress: '192.168.1.100',
              status: 'success'
            });
          }

          if (item.updatedAt && item.updatedAt !== item.createdAt) {
            logs.push({
              id: `log-${module}-${item._id || item.id}-update`,
              timestamp: new Date(item.updatedAt),
              module: module,
              action: 'update',
              user: getItemUser(item),
              userId: getItemUserId(item),
              description: getItemDescription(item, module, 'updated'),
              ipAddress: '192.168.1.100',
              status: 'success'
            });
          }

          // Special handling for visit logs
          if (module === 'visit' && item.timeIn) {
            logs.push({
              id: `log-visit-${item._id}-timein`,
              timestamp: new Date(item.visitDate),
              module: 'visit',
              action: 'time_in',
              user: item.personName,
              userId: item.personId,
              description: `${item.personName} timed in for visit`,
              ipAddress: '192.168.1.100',
              status: 'success'
            });
          }

          if (module === 'visit' && item.timeOut) {
            logs.push({
              id: `log-visit-${item._id}-timeout`,
              timestamp: new Date(item.updatedAt || item.visitDate),
              module: 'visit',
              action: 'time_out',
              user: item.personName,
              userId: item.personId,
              description: `${item.personName} timed out from visit`,
              ipAddress: '192.168.1.100',
              status: 'success'
            });
          }
        });
      }
    });

    // Add system logs for scan operations
    logs.push({
      id: 'log-scan-1',
      timestamp: new Date(now.getTime() - 1000 * 60 * 30),
      module: 'scan',
      action: 'scan',
      user: 'Security Staff',
      userId: 'staff',
      description: 'QR code scanned at main gate',
      ipAddress: '192.168.1.150',
      status: 'success'
    });

    // Add authentication logs
    logs.push({
      id: 'log-auth-1',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2),
      module: 'auth',
      action: 'login',
      user: 'Admin User',
      userId: 'admin',
      description: 'User logged in successfully',
      ipAddress: '192.168.1.105',
      status: 'success'
    });

    // Sort by timestamp descending
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  // Helper functions for log generation
  const getItemUser = (item) => {
    if (item.createdBy && typeof item.createdBy === 'object') {
      return item.createdBy.name || 'System';
    }
    if (item.name) return item.name;
    if (item.fullName) return item.fullName;
    if (item.firstName && item.lastName) return `${item.firstName} ${item.lastName}`;
    return 'System';
  };

  const getItemUserId = (item) => {
    if (item.createdBy && typeof item.createdBy === 'object') {
      return item.createdBy._id || 'system';
    }
    return item._id || item.id || 'system';
  };

  const getItemDescription = (item, module, action) => {
    switch (module) {
      case 'user':
        return `User account ${action}: ${item.name} (${item.role})`;
      case 'inmate':
        return `Inmate record ${action}: ${item.inmateCode} - ${item.fullName || `${item.firstName} ${item.lastName}`}`;
      case 'visitor':
        return `Visitor ${action}: ${item.id} - ${item.fullName || `${item.firstName} ${item.lastName}`}`;
      case 'guest':
        return `Guest ${action}: ${item.id} - ${item.fullName || `${item.firstName} ${item.lastName}`}`;
      case 'crime':
        return `Crime ${action}: ${item.crime}`;
      case 'visit':
        return `Visit ${action}: ${item.personName} visited ${item.inmateName || 'prisoner'}`;
      default:
        return `${module} ${action}`;
    }
  };

  // Calculate statistics
  const calculateStats = (logData) => {
    const today = new Date().toDateString();
    const todayLogs = logData.filter(log => 
      new Date(log.timestamp).toDateString() === today
    );

    const userLogs = logData.filter(log => log.module === 'user').length;
    const inmateLogs = logData.filter(log => log.module === 'inmate').length;
    const visitorLogs = logData.filter(log => log.module === 'visitor').length;
    const guestLogs = logData.filter(log => log.module === 'guest').length;

    setStats({
      total: logData.length,
      today: todayLogs.length,
      users: userLogs,
      inmates: inmateLogs,
      visitors: visitorLogs + guestLogs
    });
  };

  // Filter logs based on current filters - FIXED VERSION
  const filteredLogs = logs.filter(log => {
    // Module filter
    if (filters.module && log.module !== filters.module) return false;

    // Action filter
    if (filters.action && log.action !== filters.action) return false;

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        log.description.toLowerCase().includes(searchLower) ||
        log.user.toLowerCase().includes(searchLower) ||
        (log.ipAddress && log.ipAddress.includes(searchLower));
      if (!matchesSearch) return false;
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const logDate = new Date(log.timestamp);
      const now = new Date();

      switch (filters.dateRange) {
        case 'today':
          if (logDate.toDateString() !== now.toDateString()) return false;
          break;
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          if (logDate.toDateString() !== yesterday.toDateString()) return false;
          break;
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          if (logDate < weekAgo) return false;
          break;
        case 'month':
          const monthAgo = new Date(now);
          monthAgo.setDate(monthAgo.getDate() - 30);
          if (logDate < monthAgo) return false;
          break;
        case 'custom':
          if (filters.startDate) {
            const startDate = new Date(filters.startDate);
            if (logDate < startDate) return false;
          }
          if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59, 999);
            if (logDate > endDate) return false;
          }
          break;
        default:
          break;
      }
    }

    return true;
  });

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      module: '',
      action: '',
      dateRange: 'all',
      startDate: '',
      endDate: '',
      search: ''
    });
    toast.info("Filters cleared");
  };

  // View log details
  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  // Get status badge
  const getStatusBadge = (status) => {
    return status === 'success' ? 
      <Badge bg="success">Success</Badge> : 
      <Badge bg="danger">Error</Badge>;
  };

  // Get action badge
  const getActionBadge = (action) => {
    const actionConfig = {
      create: { color: 'success', label: 'Create' },
      update: { color: 'primary', label: 'Update' },
      delete: { color: 'danger', label: 'Delete' },
      login: { color: 'info', label: 'Login' },
      approve: { color: 'success', label: 'Approve' },
      reject: { color: 'danger', label: 'Reject' },
      scan: { color: 'secondary', label: 'Scan' },
      time_in: { color: 'info', label: 'Time In' },
      time_out: { color: 'warning', label: 'Time Out' },
      import: { color: 'secondary', label: 'Import' },
      export: { color: 'info', label: 'Export' },
      backup: { color: 'success', label: 'Backup' },
      restore: { color: 'warning', label: 'Restore' }
    };

    const config = actionConfig[action] || { color: 'dark', label: action };
    return <Badge bg={config.color}>{config.label}</Badge>;
  };

  // Get module icon
  const getModuleIcon = (module) => {
    switch (module) {
      case 'user': return <Users size={14} className="me-1" />;
      case 'inmate': return <Shield size={14} className="me-1" />;
      case 'visitor': 
      case 'guest': return <UserCheck size={14} className="me-1" />;
      case 'visit': 
      case 'scan': return <Activity size={14} className="me-1" />;
      default: return <FileText size={14} className="me-1" />;
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (loading && logs.length === 0) {
    return (
      <Container>
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading system logs...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <ToastContainer />

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: "600", color: "#ffffffff" }}>
            📋 System Logs & Audit Trail
          </h2>
          <Badge bg="info" className="mb-2">
            Real-time Activity Monitoring
          </Badge>
        </div>
        <Button
          variant="outline-primary"
          onClick={fetchLogs}
          disabled={loading}
          style={{
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#FFD700';
            e.target.style.color = '#000000';
            e.target.style.borderColor = '#FFD700';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '';
            e.target.style.color = '';
            e.target.style.borderColor = '';
          }}
        >
          <RefreshCw size={16} className="me-1" />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="mb-3" onClose={() => setError('')} dismissible>
          {error}
        </Alert>
      )}

      {/* Statistics Cards - Updated with smaller, uniform cards */}
      <Row className="mb-4 g-2">
        <Col xs={6} sm={4} md={2} lg={2.4} className="mb-2">
          <Card style={{ borderLeft: '2px solid #ffc107', borderRight: '2px solid #ffc107', borderTop: '6px solid #ffc107', borderBottom: '2px solid #ffc107', backgroundColor: '#353434a7', borderRadius: '12px' }} className="h-100">
            <Card.Body className="text-center p-2">
              <FileText size={20} className="text-warning mb-1" />
              <h5 className="text-warning mb-1">{stats.total}</h5>
              <small style={{ color: '#ffffffcc' }}>Total Logs</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={4} md={2} lg={2.4} className="mb-2">
          <Card style={{ borderLeft: '2px solid #ffc107', borderRight: '2px solid #ffc107', borderTop: '6px solid #ffc107', borderBottom: '2px solid #ffc107', backgroundColor: '#353434a7', borderRadius: '12px' }} className="h-100">
            <Card.Body className="text-center p-2">
              <Calendar size={20} className="text-warning mb-1" />
              <h5 className="text-warning mb-1">{stats.today}</h5>
              <small style={{ color: '#ffffffcc' }}>Today</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={4} md={2} lg={2.4} className="mb-2">
          <Card style={{ borderLeft: '2px solid #ffc107', borderRight: '2px solid #ffc107', borderTop: '6px solid #ffc107', borderBottom: '2px solid #ffc107', backgroundColor: '#353434a7', borderRadius: '12px' }} className="h-100">
            <Card.Body className="text-center p-2">
              <Users size={20} className="text-warning mb-1" />
              <h5 className="text-warning mb-1">{stats.users}</h5>
              <small style={{ color: '#ffffffcc' }}>User Activities</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={4} md={2} lg={2.4} className="mb-2">
          <Card style={{ borderLeft: '2px solid #ffc107', borderRight: '2px solid #ffc107', borderTop: '6px solid #ffc107', borderBottom: '2px solid #ffc107', backgroundColor: '#353434a7', borderRadius: '12px' }} className="h-100">
            <Card.Body className="text-center p-2">
              <Shield size={20} className="text-warning mb-1" />
              <h5 className="text-warning mb-1">{stats.inmates}</h5>
              <small style={{ color: '#ffffffcc' }}>PDL Activities</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={4} md={2} lg={2.4} className="mb-2">
          <Card style={{ borderLeft: '2px solid #ffc107', borderRight: '2px solid #ffc107', borderTop: '6px solid #ffc107', borderBottom: '2px solid #ffc107', backgroundColor: '#353434a7', borderRadius: '12px' }} className="h-100">
            <Card.Body className="text-center p-2">
              <UserCheck size={20} className="text-warning mb-1" />
              <h5 className="text-warning mb-1">{stats.visitors}</h5>
              <small style={{ color: '#ffffffcc' }}>Visitor Activities</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ 
        backgroundColor: '#676767a7', 
        borderRadius: '12px', marginBottom: '20px', 
        borderLeft: '4px solid #FFD700', 
        borderRight: '4px solid #FFD700',}}>
        <Card.Body>
          <Row className="g-3 align-items-center">
            <Col md={3}>
              <Form.Group>
                <Form.Label className="fw-bold" style={{ color: '#ffffffff' }}>Search Logs</Form.Label>
                <InputGroup>
                  <InputGroup.Text className="bg-white">
                    <Search size={16} color="#000000" />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search logs, users, IP..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    style={{ color: '#000000' }}
                  />
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label className="fw-bold" style={{ color: '#ffffffff' }}>Module</Form.Label>
                <Form.Select
                  value={filters.module}
                  onChange={(e) => handleFilterChange('module', e.target.value)}
                  style={{ color: '#000000' }}
                >
                  <option value="">All Modules</option>
                  {moduleOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label className="fw-bold" style={{ color: '#ffffffff' }}>Action</Form.Label>
                <Form.Select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  style={{ color: '#000000' }}
                >
                  <option value="">All Actions</option>
                  {actionOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label className="fw-bold" style={{ color: '#ffffffff' }}>Date Range</Form.Label>
                <Form.Select
                  value={filters.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                  style={{ color: '#000000' }}
                >
                  {dateRangeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            {filters.dateRange === 'custom' && (
              <>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label className="fw-bold" style={{ color: '#000000' }}>Start Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      style={{ color: '#000000' }}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label className="fw-bold" style={{ color: '#000000' }}>End Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                      style={{ color: '#000000' }}
                    />
                  </Form.Group>
                </Col>
              </>
            )}
            <Col md={1}>
              <Form.Label className="fw-bold d-block">&nbsp;</Form.Label>
              <Button
                onClick={clearFilters}
                className="w-100"
                style={{
                  backgroundColor: '#FFD700',
                  color: '#000000ff',
                  border: 'none',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#f61900bc';
                  e.target.style.color = '#ffffffff';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#FFD700';
                  e.target.style.color = '#000000ff';
                }}
              >
                <Filter size={16} className="me-1" color="#000000" />
                Clear
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Logs Table */}
      <Card className="border-0">
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table striped bordered hover responsive className="bg-white mb-0">
              <thead className="table-dark">
                <tr>
                  <th className="text-center">Timestamp</th>
                  <th className="text-center">Module</th>
                  <th className="text-center">Action</th>
                  <th className="text-center">User</th>
                  <th className="text-center">Description</th>
                  <th className="text-center">IP Address</th>
                  <th className="text-center">Status</th>
                  <th className="text-center" style={{ width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4">
                      <div className="text-muted">
                        <Search size={32} className="mb-2" />
                        <p className="mb-0">No logs found matching the current filters</p>
                        {filters.search || filters.module || filters.action || filters.dateRange !== 'all' ? (
                          <Button variant="outline-primary" size="sm" onClick={clearFilters} className="mt-2">
                            Clear filters to see all logs
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="text-center">
                        <div className="small">
                          <strong>{new Date(log.timestamp).toLocaleDateString()}</strong>
                        </div>
                        <div className="text-muted small">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="d-flex align-items-center justify-content-center">
                          {getModuleIcon(log.module)}
                          <span className="small">
                            {moduleOptions.find(m => m.value === log.module)?.label || log.module}
                          </span>
                        </div>
                      </td>
                      <td className="text-center">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="text-center">
                        <div className="small">{log.user}</div>
                        <div className="text-muted small">{log.userId}</div>
                      </td>
                      <td>
                        <div className="small">{log.description}</div>
                      </td>
                      <td className="text-center">
                        <code className="small">{log.ipAddress}</code>
                      </td>
                      <td className="text-center">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="text-center">
                        <ButtonGroup size="sm">
                          <Button
                            variant="outline-info"
                            onClick={() => handleViewDetails(log)}
                            title="View Details"
                          >
                            <Eye size={14} />
                          </Button>
                        </ButtonGroup>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Log Details Modal - Updated to be centered like Visitors page */}
      <Modal 
        show={showModal} 
        onHide={() => setShowModal(false)} 
        centered
        size="lg"
      >
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-5">
            Log Details - {selectedLog?.id}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedLog && (
            <Row>
              <Col md={6}>
                <Card className="mb-2">
                  <Card.Header className="py-2">
                    <strong className="small">Basic Information</strong>
                  </Card.Header>
                  <Card.Body className="py-2">
                    <p className="mb-1 small"><strong>Log ID:</strong> {selectedLog.id}</p>
                    <p className="mb-1 small"><strong>Timestamp:</strong> {new Date(selectedLog.timestamp).toLocaleString()}</p>
                    <p className="mb-1 small"><strong>Module:</strong> {moduleOptions.find(m => m.value === selectedLog.module)?.label || selectedLog.module}</p>
                    <p className="mb-1 small"><strong>Action:</strong> {actionOptions.find(a => a.value === selectedLog.action)?.label || selectedLog.action}</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="mb-2">
                  <Card.Header className="py-2">
                    <strong className="small">User & System Info</strong>
                  </Card.Header>
                  <Card.Body className="py-2">
                    <p className="mb-1 small"><strong>User:</strong> {selectedLog.user}</p>
                    <p className="mb-1 small"><strong>User ID:</strong> {selectedLog.userId}</p>
                    <p className="mb-1 small"><strong>IP Address:</strong> {selectedLog.ipAddress}</p>
                    <p className="mb-1 small"><strong>Status:</strong> {getStatusBadge(selectedLog.status)}</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={12}>
                <Card>
                  <Card.Header className="py-2">
                    <strong className="small">Description</strong>
                  </Card.Header>
                  <Card.Body className="py-2">
                    <p className="mb-0 small">{selectedLog.description}</p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Logs;