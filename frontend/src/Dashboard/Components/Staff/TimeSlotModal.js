import React, { useState, useEffect } from 'react';
import { Modal, Button, Card, Row, Col, Badge, Alert, Spinner, Form, ProgressBar } from 'react-bootstrap';
import { Clock, Check, XCircle, AlertCircle, Search, WifiOff, RefreshCw } from 'react-feather';
import axios from 'axios';

const TimeSlotModal = ({ 
  show, 
  onHide, 
  scannedPerson, 
  onTimeSlotSet 
}) => {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState('3h 0m');
  const [isSettingTimer, setIsSettingTimer] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState(null);
  const [isCheckingPerson, setIsCheckingPerson] = useState(false);
  const [connectionTest, setConnectionTest] = useState(null);
  const [verificationStep, setVerificationStep] = useState(''); // 'setting', 'verifying', 'completed'
  const [verificationResult, setVerificationResult] = useState(null);

  useEffect(() => {
    if (show && scannedPerson) {
      // Reset all states
      resetStates();
      
      // Set default times (current time to 3 hours later)
      const now = new Date();
      const defaultEnd = new Date(now.getTime() + (3 * 60 * 60 * 1000)); // 3 hours later
      
      setStartTime(formatTimeForInput(now));
      setEndTime(formatTimeForInput(defaultEnd));
      setDuration('3h 0m');
      
      console.log('🔄 TimeSlotModal opened for:', scannedPerson);
      
      // Test backend connection first
      testBackendConnection();
      
      // Verify person exists in database
      verifyPersonExists();
    }
  }, [show, scannedPerson]);

  const resetStates = () => {
    setError('');
    setDebugInfo(null);
    setConnectionTest(null);
    setVerificationStep('');
    setVerificationResult(null);
  };

  // Test backend connection
  const testBackendConnection = async () => {
    try {
      console.log('🔌 Testing backend connection...');
      const response = await axios.get('http://localhost:5001/', { timeout: 5001 });
      setConnectionTest({
        success: true,
        message: 'Backend connected successfully'
      });
      console.log('✅ Backend connection test:', response.data);
    } catch (error) {
      console.error('❌ Backend connection failed:', error);
      setConnectionTest({
        success: false,
        message: 'Cannot connect to backend server',
        error: error.message
      });
    }
  };

  // Verify person exists in database using multiple methods
  const verifyPersonExists = async () => {
    if (!scannedPerson) return;
    
    try {
      setIsCheckingPerson(true);
      console.log('🔍 Verifying person exists in database:', scannedPerson.id);
      
      const personType = scannedPerson.personType;
      
      // METHOD 1: Use direct visitor endpoint
      try {
        const directEndpoint = `http://localhost:5001/${personType}s/${scannedPerson.id}`;
        console.log('📞 Calling direct endpoint:', directEndpoint);
        
        const response = await axios.get(directEndpoint, { timeout: 8000 });
        console.log('✅ Direct endpoint response:', response.data);
        
        setDebugInfo({
          exists: true,
          data: response.data,
          message: `${personType} found in database`,
          method: 'direct-endpoint'
        });
        
      } catch (directError) {
        console.error('❌ Direct endpoint failed:', directError.response?.data || directError.message);
        
        setDebugInfo({
          exists: false,
          error: directError.response?.data || directError.message,
          message: `${scannedPerson.personType} NOT found via direct endpoint`
        });
        
        setError(`Error: ${directError.response?.data?.message || directError.message}`);
      }
      
    } catch (error) {
      console.error('❌ Person verification failed:', error);
      
      setDebugInfo({
        exists: false,
        error: error.response?.data || error.message,
        message: `Verification failed: ${error.message}`
      });
      
      setError(`Connection error: ${error.message}`);
    } finally {
      setIsCheckingPerson(false);
    }
  };

  // Format time for HTML time input (HH:MM)
  const formatTimeForInput = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Calculate duration when times change
  const calculateDuration = (start, end) => {
    if (!start || !end) return '0h 0m';
    
    try {
      const startDate = new Date(`2000-01-01T${start}`);
      const endDate = new Date(`2000-01-01T${end}`);
      
      // Handle overnight case (end time next day)
      if (endDate <= startDate) {
        endDate.setDate(endDate.getDate() + 1);
      }
      
      const diffMs = endDate - startDate;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      return `${hours}h ${minutes}m`;
    } catch (error) {
      console.error('Duration calculation error:', error);
      return '0h 0m';
    }
  };

  // Handle time changes
  const handleStartTimeChange = (time) => {
    setStartTime(time);
    if (time && endTime) {
      setDuration(calculateDuration(time, endTime));
    }
  };

  const handleEndTimeChange = (time) => {
    setEndTime(time);
    if (startTime && time) {
      setDuration(calculateDuration(startTime, time));
    }
  };

  // Validate the time period
  const validateTimePeriod = () => {
    if (!startTime || !endTime) {
      return 'Please set both start and end times';
    }

    try {
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      
      // Allow overnight visits (end time next day)
      const adjustedEnd = end <= start ? new Date(end.getTime() + (24 * 60 * 60 * 1000)) : end;
      const diffMs = adjustedEnd - start;
      
      // Minimum 15 minutes
      if (diffMs < (15 * 60 * 1000)) {
        return 'Minimum visit duration is 15 minutes';
      }
      
      // Maximum 8 hours (or adjust as needed)
      if (diffMs > (8 * 60 * 60 * 1000)) {
        return 'Maximum visit duration is 8 hours';
      }

      return null; // No errors
    } catch (error) {
      return 'Invalid time format';
    }
  };

  // Convert to 12-hour format for backend
  const convertTo12HourFormat = (time24h) => {
    if (!time24h) return '';
    
    try {
      const [hours, minutes] = time24h.split(':');
      const hour = parseInt(hours, 10);
      const period = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${period}`;
    } catch (error) {
      console.error('Time conversion error:', error);
      return time24h;
    }
  };

  // Verify timer was actually set in database
  const verifyTimerWasSet = async () => {
    if (!scannedPerson) return false;
    
    try {
      setVerificationStep('verifying');
      console.log('🔍 Verifying timer was set in database...');
      
      // Use the SIMPLE timer verification endpoint
      const verifyEndpoint = scannedPerson.personType === 'guest' 
        ? `http://localhost:5001/verify-custom-timer-guest/${scannedPerson.id}`
        : `http://localhost:5001/verify-custom-timer/${scannedPerson.id}`;
      
      console.log('📞 Calling verification endpoint:', verifyEndpoint);
      
      const response = await axios.get(verifyEndpoint, { timeout: 8000 });
      
      console.log('✅ Timer verification result:', response.data);
      
      if (response.data.hasCustomTimer) {
        setVerificationResult({
          success: true,
          data: response.data,
          message: `Custom timer confirmed: ${response.data.customTimer?.startTime} - ${response.data.customTimer?.endTime}`
        });
        return true;
      } else {
        setVerificationResult({
          success: false,
          data: response.data,
          message: 'Custom timer not found in database after setting'
        });
        return false;
      }
      
    } catch (error) {
      console.error('❌ Timer verification failed:', error);
      setVerificationResult({
        success: false,
        error: error.response?.data || error.message,
        message: `Verification failed: ${error.message}`
      });
      return false;
    } finally {
      setVerificationStep('');
    }
  };

  // SIMPLE TIMER SETTING - Using your new endpoints
  const handleSetTimer = async () => {
    if (!scannedPerson) {
      setError('No visitor selected');
      return;
    }

    // Check if person exists
    if (!debugInfo || !debugInfo.exists) {
      setError('Person not found in database. Please scan again.');
      return;
    }

    // Check backend connection
    if (!connectionTest || !connectionTest.success) {
      setError('Cannot connect to backend server. Please check if the server is running.');
      return;
    }

    const validationError = validateTimePeriod();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSettingTimer(true);
      setVerificationStep('setting');
      setError('');
      setVerificationResult(null);

      console.log('🔄 Setting custom timer for:', scannedPerson.id);

      // Convert to 12-hour format for display
      const startTime12h = convertTo12HourFormat(startTime);
      const endTime12h = convertTo12HourFormat(endTime);

      console.log('⏰ Setting timer period:', { 
        startTime: startTime12h, 
        endTime: endTime12h, 
        duration 
      });

      // SIMPLE API CALL - Just set the timer directly using your new endpoint
      const timerEndpoint = `http://localhost:5001/${scannedPerson.personType}s/${scannedPerson.id}/set-custom-timer`;
      console.log('📞 Calling simple timer endpoint:', timerEndpoint);
      
      const response = await axios.put(
        timerEndpoint,
        {
          startTime: startTime12h,
          endTime: endTime12h,
          duration: duration
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Timer set successfully:', response.data);

      // Simple verification
      setVerificationStep('verifying');
      const verifySuccess = await verifyTimerWasSet();
      
      if (verifySuccess) {
        // SUCCESS!
        setVerificationStep('completed');
        setVerificationResult({
          success: true,
          data: response.data,
          message: `Custom timer set successfully: ${startTime12h} - ${endTime12h} (${duration})`
        });

        console.log('🎉 CUSTOM TIMER SET SUCCESSFULLY!');

        // Notify parent component
        if (onTimeSlotSet) {
          onTimeSlotSet({
            startTime: startTime12h,
            endTime: endTime12h,
            duration: duration,
            verified: true
          });
        }

        // Auto-close after 3 seconds
        setTimeout(() => {
          onHide();
        }, 3000);
        
      } else {
        throw new Error('Timer was set but verification failed');
      }

    } catch (error) {
      console.error('❌ Timer setting failed:', error);
      setVerificationStep('');
      
      let errorMessage = 'Failed to set timer';
      
      if (error.response) {
        console.error('Server response:', error.response.data);
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        errorMessage = error.message || 'Unknown error occurred';
      }
      
      setError(errorMessage);
    } finally {
      setIsSettingTimer(false);
    }
  };

  // Quick time period buttons
  const quickTimePeriods = [
    { label: '1 hour', hours: 1 },
    { label: '2 hours', hours: 2 },
    { label: '3 hours', hours: 3 },
    { label: '4 hours', hours: 4 }
  ];

  const setQuickTimePeriod = (hours) => {
    const start = new Date();
    const end = new Date(start.getTime() + (hours * 60 * 60 * 1000));
    
    setStartTime(formatTimeForInput(start));
    setEndTime(formatTimeForInput(end));
    setDuration(`${hours}h 0m`);
    setError('');
  };

  // Check current timer status
  const checkCurrentTimerStatus = async () => {
    if (!scannedPerson) return;
    
    try {
      const statusEndpoint = scannedPerson.personType === 'guest'
        ? `http://localhost:5001/verify-custom-timer-guest/${scannedPerson.id}`
        : `http://localhost:5001/verify-custom-timer/${scannedPerson.id}`;
      
      const response = await axios.get(statusEndpoint);
      
      if (response.data.hasCustomTimer) {
        setDebugInfo(prev => ({
          ...prev,
          currentTimer: response.data.customTimer,
          currentStatus: `Has custom timer: ${response.data.customTimer.startTime} - ${response.data.customTimer.endTime}`
        }));
      } else {
        setDebugInfo(prev => ({
          ...prev,
          currentTimer: null,
          currentStatus: 'No custom timer set'
        }));
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };

  const handleClose = () => {
    setStartTime('');
    setEndTime('');
    setDuration('3h 0m');
    setIsSettingTimer(false);
    setError('');
    setDebugInfo(null);
    setConnectionTest(null);
    setVerificationStep('');
    setVerificationResult(null);
    onHide();
  };

  // Retry verification
  const handleRetryVerification = () => {
    setError('');
    setDebugInfo(null);
    setConnectionTest(null);
    setVerificationStep('');
    setVerificationResult(null);
    testBackendConnection();
    verifyPersonExists();
  };

  return (
    <Modal 
      show={show} 
      onHide={handleClose} 
      centered
      backdrop="static"
      size="lg"
    >
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title>
          <Clock size={20} className="me-2" />
          Set Custom Visit Timer
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* Connection Test */}
        {connectionTest && (
          <Alert variant={connectionTest.success ? "success" : "danger"} className="py-2 mb-3">
            <div className="d-flex align-items-center">
              {connectionTest.success ? (
                <Check size={16} className="me-2" />
              ) : (
                <WifiOff size={16} className="me-2" />
              )}
              <span>{connectionTest.message}</span>
            </div>
          </Alert>
        )}

        {/* Person Info */}
        {scannedPerson && (
          <Alert variant="info" className="py-2 mb-3">
            <div className="text-center">
              <strong>{scannedPerson.fullName}</strong>
              <br />
              <small>ID: {scannedPerson.id} • {scannedPerson.personType === 'guest' ? 'Guest' : 'Visitor'}</small>
              <br />
              <Button 
                variant="outline-light" 
                size="sm" 
                className="mt-1"
                onClick={checkCurrentTimerStatus}
              >
                <RefreshCw size={12} className="me-1" />
                Check Current Timer
              </Button>
            </div>
          </Alert>
        )}

        {/* Current Timer Status */}
        {debugInfo?.currentStatus && (
          <Alert variant="warning" className="py-2 mb-3">
            <div className="text-center">
              <strong>Current Status:</strong> {debugInfo.currentStatus}
            </div>
          </Alert>
        )}

        {/* Debug Information */}
        {debugInfo && (
          <Alert 
            variant={debugInfo.exists ? "success" : "danger"} 
            className="py-2 mb-3"
          >
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <strong>
                  {debugInfo.exists ? '✅' : '❌'} {debugInfo.message}
                </strong>
                {debugInfo.exists && debugInfo.data && (
                  <div className="small mt-1">
                    Method: <Badge bg="secondary">{debugInfo.method}</Badge>
                    {debugInfo.data.status && (
                      <>
                        • Status: <Badge bg="info">{debugInfo.data.status}</Badge>
                      </>
                    )}
                  </div>
                )}
              </div>
              {(!debugInfo.exists || !connectionTest?.success) && (
                <Button 
                  variant="outline-light" 
                  size="sm" 
                  onClick={handleRetryVerification}
                >
                  <Search size={14} className="me-1" />
                  Retry
                </Button>
              )}
            </div>
          </Alert>
        )}

        {isCheckingPerson && (
          <Alert variant="info" className="py-2 mb-3">
            <div className="d-flex align-items-center">
              <Spinner animation="border" size="sm" className="me-2" />
              <span>Checking person in database...</span>
            </div>
          </Alert>
        )}

        {/* Progress Steps */}
        {verificationStep && (
          <Alert variant="info" className="py-2 mb-3">
            <div className="text-center">
              <Spinner animation="border" size="sm" className="me-2" />
              <strong>
                {verificationStep === 'setting' && 'Setting custom timer...'}
                {verificationStep === 'verifying' && 'Verifying timer was saved...'}
                {verificationStep === 'completed' && 'Timer set successfully!'}
              </strong>
            </div>
            <ProgressBar 
              animated 
              now={
                verificationStep === 'setting' ? 50 :
                verificationStep === 'verifying' ? 75 :
                100
              } 
              className="mt-2"
            />
          </Alert>
        )}

        {/* Verification Result */}
        {verificationResult && (
          <Alert 
            variant={verificationResult.success ? "success" : "danger"} 
            className="py-2 mb-3"
          >
            <div className="text-center">
              {verificationResult.success ? (
                <Check size={20} className="me-2" />
              ) : (
                <AlertCircle size={20} className="me-2" />
              )}
              <strong>{verificationResult.message}</strong>
              {verificationResult.success && verificationResult.data?.customTimer && (
                <div className="mt-2">
                  <Badge bg="light" text="dark" className="me-1">
                    Start: {verificationResult.data.customTimer.startTime}
                  </Badge>
                  <Badge bg="light" text="dark" className="me-1">
                    End: {verificationResult.data.customTimer.endTime}
                  </Badge>
                  <Badge bg="light" text="dark">
                    Duration: {verificationResult.data.customTimer.duration}
                  </Badge>
                </div>
              )}
            </div>
          </Alert>
        )}

        {/* ULTIMATE SUCCESS CONFIRMATION */}
        {verificationStep === 'completed' && verificationResult?.success && (
          <Alert variant="success" className="py-3 mb-3">
            <div className="text-center">
              <Check size={24} className="me-2 mb-2" />
              <h5 className="mb-2">🎉 Custom Timer Successfully Set!</h5>
              {verificationResult.data?.customTimer && (
                <div>
                  <div className="mb-2">
                    <strong>{verificationResult.data.customTimer.startTime} - {verificationResult.data.customTimer.endTime}</strong>
                    <br />
                    <span className="text-muted">({verificationResult.data.customTimer.duration})</span>
                  </div>
                  <Badge bg="success" className="fs-6">
                    READY FOR TIME-IN
                  </Badge>
                  <div className="mt-2 small text-muted">
                    This modal will close automatically...
                  </div>
                </div>
              )}
            </div>
          </Alert>
        )}

        {error && (
          <Alert variant="danger" className="py-2">
            <div className="d-flex align-items-center">
              <AlertCircle size={16} className="me-2" />
              <span>{error}</span>
            </div>
          </Alert>
        )}

        {/* Only show timer settings if person exists and connection is good */}
        {debugInfo && debugInfo.exists && connectionTest && connectionTest.success && !verificationStep && (
          <>
            {/* Quick Time Periods */}
            <div className="mb-4">
              <h6 className="mb-2">Quick Timer Settings:</h6>
              <Row className="g-2">
                {quickTimePeriods.map((period, index) => (
                  <Col key={index} md={3}>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="w-100"
                      onClick={() => setQuickTimePeriod(period.hours)}
                    >
                      {period.label}
                    </Button>
                  </Col>
                ))}
              </Row>
            </div>

            <hr />

            {/* Custom Time Period */}
            <div className="mb-4">
              <h6 className="mb-3">Custom Timer:</h6>
              <Row className="g-3">
                <Col md={5}>
                  <Form.Group>
                    <Form.Label>Start Time (24-hour format)</Form.Label>
                    <Form.Control 
                      type="time" 
                      value={startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      required
                    />
                    <Form.Text className="text-muted">
                      Example: 09:00, 14:30
                    </Form.Text>
                  </Form.Group>
                </Col>
                
                <Col md={5}>
                  <Form.Group>
                    <Form.Label>End Time (24-hour format)</Form.Label>
                    <Form.Control 
                      type="time" 
                      value={endTime}
                      onChange={(e) => handleEndTimeChange(e.target.value)}
                      required
                    />
                    <Form.Text className="text-muted">
                      Example: 11:00, 16:45
                    </Form.Text>
                  </Form.Group>
                </Col>
                
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Duration</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={duration}
                      readOnly
                      className="text-center fw-bold bg-light"
                    />
                  </Form.Group>
                </Col>
              </Row>
            </div>

            {/* Timer Preview */}
            <Card className="border-warning">
              <Card.Header className="bg-warning text-dark py-2">
                <strong>Timer Preview</strong>
              </Card.Header>
              <Card.Body className="py-3">
                <Row className="text-center">
                  <Col md={4}>
                    <div className="mb-2">
                      <div className="text-white small">Start Time</div>
                      <div className="h5 mb-0" style={{ color: '#FFD700' }}>
                        {startTime ? convertTo12HourFormat(startTime) : '--:-- --'}
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="mb-2">
                      <div className="text-white small">End Time</div>
                      <div className="h5 mb-0" style={{ color: '#FFD700' }}>
                        {endTime ? convertTo12HourFormat(endTime) : '--:-- --'}
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="mb-2">
                      <div className="text-white small">Total Duration</div>
                      <div className="h5 mb-0" style={{ color: '#FFD700' }}>
                        {duration}
                      </div>
                    </div>
                  </Col>
                </Row>
                <div className="text-center mt-2">
                  <small className="text-white">
                    Timer will use this custom time period instead of default 3 hours
                  </small>
                </div>
              </Card.Body>
            </Card>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        
        {/* Only show set timer button if person exists and connection is good */}
        {debugInfo && debugInfo.exists && connectionTest && connectionTest.success && !verificationStep && (
          <Button 
            variant="primary" 
            onClick={handleSetTimer}
            disabled={!startTime || !endTime || isSettingTimer}
          >
            {isSettingTimer ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Setting Timer...
              </>
            ) : (
              <>
                <Check size={16} className="me-1" />
                Set Custom Timer
              </>
            )}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default TimeSlotModal;