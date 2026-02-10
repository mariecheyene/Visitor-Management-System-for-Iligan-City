import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Row, Col, Card, Button, Form, 
  Alert, Spinner, Table, Badge
} from 'react-bootstrap';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  FileText,
  BarChart2,
  TrendingUp,
  RefreshCw
} from 'react-feather';
import axios from 'axios';
import jsPDF from 'jspdf';

const API_BASE_URL = 'http://localhost:5001';

const ReportsAnalytics = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    endDate: new Date()
  });
  const [reportType, setReportType] = useState('daily');
  const [chartData, setChartData] = useState([]);
  const [summaryData, setSummaryData] = useState({});
  const [rawData, setRawData] = useState({});

  const chartRef = useRef();

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange, reportType]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = {
        startDate: dateRange.startDate.toISOString().split('T')[0],
        endDate: dateRange.endDate.toISOString().split('T')[0],
        reportType
      };

      console.log('🔄 Fetching REAL analytics data with params:', params);

      const response = await axios.get(`${API_BASE_URL}/analytics/reports`, { params });
      
      if (response.data.success) {
        setChartData(response.data.chartData || []);
        setSummaryData(response.data.summaryData || {});
        setRawData(response.data.rawData || {});
        
        console.log('✅ REAL Analytics data loaded:', {
          chartDataPoints: response.data.chartData?.length,
          summaryData: response.data.summaryData,
          rawData: response.data.rawData
        });

        if (response.data.chartData.length === 0) {
          setError('No visit logs found in the system for the selected period. Data will appear when visits are logged.');
        }
      } else {
        throw new Error(response.data.message || 'Failed to fetch analytics');
      }
    } catch (err) {
      console.error('❌ Error fetching REAL analytics data:', err);
      setError('Failed to load analytics data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Simple table creation without autoTable
  const createTable = (doc, headers, data, startY) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const tableWidth = pageWidth - (margin * 2);
    const colCount = headers.length;
    const colWidth = tableWidth / colCount;
    
    let y = startY;
    
    // Draw table header
    doc.setFillColor(66, 66, 66);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    
    headers.forEach((header, index) => {
      doc.rect(margin + (index * colWidth), y, colWidth, 10, 'F');
      doc.text(header, margin + (index * colWidth) + 2, y + 7);
    });
    
    y += 10;
    
    // Draw table rows
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    
    data.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
        
        // Redraw header on new page
        doc.setFillColor(66, 66, 66);
        doc.setTextColor(255, 255, 255);
        headers.forEach((header, index) => {
          doc.rect(margin + (index * colWidth), y, colWidth, 10, 'F');
          doc.text(header, margin + (index * colWidth) + 2, y + 7);
        });
        y += 10;
        doc.setTextColor(0, 0, 0);
      }
      
      row.forEach((cell, cellIndex) => {
        const text = String(cell).substring(0, 30); // Limit text length
        doc.text(text, margin + (cellIndex * colWidth) + 2, y + 7);
      });
      
      // Draw row separator
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y + 10, margin + tableWidth, y + 10);
      
      y += 10;
    });
    
    return y + 10;
  };

  // Export to PDF function with proper title format
  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      
      // Official Title - Lanao Del Norte District Jail Region 10
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.setFont(undefined, 'bold');
      doc.text('Lanao Del Norte District Jail', pageWidth / 2, 20, { align: 'center' });
      doc.text('Region 10', pageWidth / 2, 28, { align: 'center' });
      
      // Report Title
      doc.setFontSize(14);
      doc.text('Analytics and Visit Reports', pageWidth / 2, 40, { align: 'center' });
      
      // Report details
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, 'normal');
      doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, margin, 55);
      doc.text(`Date Range: ${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`, margin, 62);
      doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, margin, 69);
      
      let yPosition = 85;

      // Summary Section
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.setFont(undefined, 'bold');
      doc.text('SUMMARY STATISTICS', margin, yPosition);
      yPosition += 10;

      if (Object.keys(summaryData).length > 0) {
        doc.setFontSize(9);
        const summaryHeaders = ['METRIC', 'VALUE'];
        const summaryRows = Object.entries(summaryData).map(([key, value]) => [
          key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          typeof value === 'object' ? JSON.stringify(value) : String(value)
        ]);

        yPosition = createTable(doc, summaryHeaders, summaryRows, yPosition);
      } else {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('No summary data available', margin, yPosition);
        yPosition += 15;
      }

      // Chart Data Table
      if (chartData.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.setFont(undefined, 'bold');
        doc.text('DETAILED VISIT DATA', margin, yPosition);
        yPosition += 10;

        const tableHeaders = Object.keys(chartData[0]).map(key => 
          key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).toUpperCase()
        );
        
        const tableData = chartData.map(item => 
          Object.values(item).map(value => 
            typeof value === 'object' ? JSON.stringify(value) : String(value)
          )
        );

        yPosition = createTable(doc, tableHeaders, tableData, yPosition);
      }

      // Footer with official designation
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Official Document - Lanao Del Norte District Jail Management System', pageWidth / 2, doc.internal.pageSize.getHeight() - 15, { align: 'center' });
      doc.text(`Page 1 of 1 - Confidential`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

      // Save the PDF with official naming convention
      const fileName = `LNDJ_${reportType}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      toast.success('Official PDF report downloaded successfully!');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate official report. Please try again.');
    }
  };

  // Alternative simple PDF export with official format
  const exportToPDFSimple = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Official Header
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.setFont(undefined, 'bold');
      doc.text('LANAO DEL NORTE DISTRICT JAIL', pageWidth / 2, 20, { align: 'center' });
      doc.text('REGION 10', pageWidth / 2, 28, { align: 'center' });
      
      // Report Title
      doc.setFontSize(14);
      doc.text('VISITOR ANALYTICS REPORT', pageWidth / 2, 40, { align: 'center' });
      
      // Report info
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Report Type: ${reportType.toUpperCase()}`, 20, 55);
      doc.text(`Period: ${dateRange.startDate.toLocaleDateString()} to ${dateRange.endDate.toLocaleDateString()}`, 20, 62);
      doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 20, 69);
      
      let y = 85;
      
      // Summary Data
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('SUMMARY STATISTICS:', 20, y);
      y += 10;
      
      doc.setFontSize(9);
      if (Object.keys(summaryData).length > 0) {
        Object.entries(summaryData).forEach(([key, value], index) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          doc.text(`${label}: ${value}`, 25, y);
          y += 6;
        });
      } else {
        doc.text('No data available for selected period', 25, y);
        y += 10;
      }
      
      y += 10;
      
      // Chart Data
      if (chartData.length > 0) {
        doc.setFontSize(11);
        doc.text('DETAILED VISIT RECORDS:', 20, y);
        y += 10;
        
        doc.setFontSize(7);
        const headers = Object.keys(chartData[0]);
        
        // Headers
        headers.forEach((header, index) => {
          const headerText = header.toUpperCase();
          doc.text(headerText, 20 + (index * 35), y);
        });
        y += 5;
        
        // Data rows
        chartData.slice(0, 25).forEach((row) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          headers.forEach((header, index) => {
            const value = String(row[header] || '').substring(0, 12);
            doc.text(value, 20 + (index * 35), y);
          });
          y += 4;
        });
        
        if (chartData.length > 25) {
          doc.text(`... and ${chartData.length - 25} more records`, 20, y);
        }
      }
      
      // Official Footer
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text('Official Document - Lanao Del Norte District Jail Management System', pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      
      const fileName = `LNDJ_${reportType}_Analytics_${Date.now()}.pdf`;
      doc.save(fileName);
      toast.success('Official report downloaded successfully!');
      
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to generate official report. Please try again.');
    }
  };

  // Render appropriate chart based on report type
  const renderChart = () => {
    console.log('📊 Rendering chart with REAL data:', chartData);

    if (!chartData || chartData.length === 0) {
      return (
        <div className="text-center py-5">
          <BarChart2 size={48} className="text-muted mb-3" />
          <h5 className="text-muted">No Visit Data Available</h5>
          <p className="text-muted">
            No visit logs found in the system for the selected period.
            <br />
            Data will appear automatically when visitors and guests start using the system.
          </p>
          <Card className="bg-light mt-3">
            <Card.Body className="py-2">
              <small className="text-muted">
                <strong>System Status:</strong><br />
                • Visitors: {rawData.visitors || 0}<br />
                • Guests: {rawData.guests || 0}<br />
                • PDLs: {rawData.inmates || 0}<br />
                • Visit Logs: {rawData.visitLogs || 0}
              </small>
            </Card.Body>
          </Card>
        </div>
      );
    }

    switch (reportType) {
      case 'demographic':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={150}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} people`, 'Count']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'performance':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
              <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'Avg Duration') return [`${value} minutes`, name];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="avgDuration" fill="#8884d8" name="Avg Duration (mins)" />
              <Bar yAxisId="right" dataKey="visits" fill="#82ca9d" name="Number of Visits" />
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="visitors" 
                stroke="#aaff00ff" 
                strokeWidth={2}
                dot={{ fill: '#aaff00ff', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#aaff00ff', strokeWidth: 2 }}
                name="Visitors"
              />
              <Line 
                type="monotone" 
                dataKey="guests" 
                stroke="#ff3c00ff" 
                strokeWidth={2}
                dot={{ fill: '#ff3c00ff', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#ff3c00ff', strokeWidth: 2 }}
                name="Guests"
              />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke="#fffc42ff" 
                strokeWidth={3}
                dot={{ fill: '#fffc42ff', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 8, stroke: '#fffc42ff', strokeWidth: 2 }}
                name="Total Visits"
              />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  const getSummaryCards = () => {
    if (Object.keys(summaryData).length === 0 || chartData.length === 0) {
      return (
        <Col xs={12}>
          <Card className="border-0 bg-light">
            <Card.Body className="text-center py-4">
              <BarChart2 size={32} className="text-muted mb-2" />
              <h6 className="text-muted mb-2">No Analytics Data</h6>
              <p className="text-muted mb-0 small">
                No visit logs found in the system. Analytics will appear when visitors start using the system.
              </p>
            </Card.Body>
          </Card>
        </Col>
      );
    }

    const keyMetrics = [
      { key: 'totalVisits', label: 'Total Visits', color: 'warning' },
      { key: 'totalVisitors', label: 'Total Visitors', color: 'warning' },
      { key: 'totalGuests', label: 'Total Guests', color: 'warning' },
      { key: 'avgDailyVisits', label: 'Avg Daily Visits', color: 'warning' },
      { key: 'daysWithVisits', label: 'Active Days', color: 'warning' },
      { key: 'averageDuration', label: 'Avg Duration', color: 'warning' }
    ];

    return keyMetrics
      .filter(metric => summaryData[metric.key] !== undefined)
      .map((metric, index) => (
        <Col xs={12} sm={6} md={4} lg={2} key={metric.key} className="mb-3">
          <Card style={{ 
            borderLeft: '2px solid #ffc107', 
            borderRight: '2px solid #ffc107', 
            borderTop: '6px solid #ffc107', 
            borderBottom: '2px solid #ffc107', 
            backgroundColor: '#353434a7', 
            borderRadius: '12px',
            height: '100%'
          }}>
            <Card.Body>
              <small className="text-uppercase fw-bold" style={{ color: '#ffffff' }}>
                {metric.label}
              </small>
              <h4 className="mt-2 fw-bold" style={{ color: '#ffc107' }}>
                {summaryData[metric.key]}
              </h4>
            </Card.Body>
          </Card>
        </Col>
      ));
  };

  const formatDateForInput = (date) => {
    return date.toISOString().split('T')[0];
  };

  return (
    <Container>
      <ToastContainer />
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 
            style={{ 
              fontFamily: "Poppins, sans-serif", 
              fontWeight: "600", 
              color: "#ffffffff",
              transition: "color 0.3s ease",
              cursor: "pointer"
            }}
            onMouseEnter={(e) => e.target.style.color = '#000000'}
            onMouseLeave={(e) => e.target.style.color = '#ffffffff'}
          >
            📊 Reports & Analytics
          </h2>
          <Badge bg="info" className="mb-2">
            Lanao Del Norte District Jail - Region 10
          </Badge>
        </div>
        <Button
          variant="dark"
          onClick={exportToPDFSimple}
          disabled={loading || chartData.length === 0}
        >
          <FileText size={16} className="me-1" />
          Export PDF Report
        </Button>
      </div>

      {error && (
        <Alert 
          variant={error.includes('No visit logs') ? 'info' : 'danger'} 
          className="mb-3"
        >
          <div className="d-flex justify-content-between align-items-center">
            <span>{error}</span>
            <Button 
              variant="outline-primary" 
              size="sm" 
              onClick={fetchAnalyticsData}
            >
              <RefreshCw size={14} className="me-1" />
              REFRESH
            </Button>
          </div>
        </Alert>
      )}

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
                <Form.Label className="fw-bold" style={{ color: '#ffffffff' }}>Start Date</Form.Label>
                <Form.Control
                  type="date"
                  value={formatDateForInput(dateRange.startDate)}
                  onChange={(e) => setDateRange(prev => ({ 
                    ...prev, 
                    startDate: new Date(e.target.value) 
                  }))}
                  style={{ color: '#000000' }}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="fw-bold" style={{ color: '#ffffffff' }}>End Date</Form.Label>
                <Form.Control
                  type="date"
                  value={formatDateForInput(dateRange.endDate)}
                  onChange={(e) => setDateRange(prev => ({ 
                    ...prev, 
                    endDate: new Date(e.target.value) 
                  }))}
                  style={{ color: '#000000' }}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="fw-bold" style={{ color: '#ffffffff' }}>Report Type</Form.Label>
                <Form.Select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  style={{ color: '#000000' }}
                >
                  <option value="daily">Daily Visitors</option>
                  <option value="weekly">Weekly Trends</option>
                  <option value="monthly">Monthly Overview</option>
                  <option value="demographic">Demographics</option>
                  <option value="performance">Performance Metrics</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Label className="fw-bold d-block" style={{ color: '#000000' }}>&nbsp;</Form.Label>
              <Button
                onClick={fetchAnalyticsData}
                disabled={loading}
                className="w-100"
                style={{ 
                  backgroundColor: '#FFD700', 
                  color: '#000000', 
                  border: 'none',
                  fontWeight: '600',
                  transition: 'background-color 0.3s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#b1e6adff'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#FFD700'}
              >
                {loading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    <TrendingUp size={16} className="me-1" color="#000000" />
                    Refresh Data
                  </>
                )}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Summary Cards */}
      <Row className="mb-4">
        {getSummaryCards()}
      </Row>

      {/* Chart */}
      <Card className="mb-4 border-0">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">
              {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Analytics
            </h5>
            {chartData.length > 0 && (
              <Badge bg="primary" className="fs-6">
                {chartData.length} data points
              </Badge>
            )}
          </div>
          
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status" className="me-2" />
              <span>Loading analytics data...</span>
            </div>
          ) : (
            renderChart()
          )}
        </Card.Body>
      </Card>

      {/* Data Table */}
      <Card className="border-0">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">
              Raw Data {chartData.length > 0 && `(${chartData.length} records)`}
            </h5>
          </div>
          
          {chartData.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted mb-0">No data to display</p>
            </div>
          ) : (
            <>
              <Table striped bordered hover responsive className="bg-white">
                <thead className="table-dark">
                  <tr>
                    {chartData.length > 0 && Object.keys(chartData[0]).map((key) => (
                      <th key={key}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chartData.slice(0, 10).map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map((value, cellIndex) => (
                        <td key={cellIndex}>
                          {typeof value === 'object' ? JSON.stringify(value) : value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
              {chartData.length > 10 && (
                <div className="text-center mt-2">
                  <small className="text-muted">
                    Showing first 10 of {chartData.length} records
                  </small>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ReportsAnalytics;