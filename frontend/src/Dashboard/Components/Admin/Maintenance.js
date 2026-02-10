import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Card, 
  Table, 
  message, 
  Space, 
  Select, 
  Tag, 
  Row, 
  Col,
  Statistic,
  Progress,
  Modal,
  Alert,
  Tooltip
} from 'antd';
import { 
  DownloadOutlined, 
  SyncOutlined, 
  DatabaseOutlined,
  DeleteOutlined,
  EyeOutlined,
  SecurityScanOutlined,
  RocketOutlined,
  ClearOutlined,
  FileZipOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import axios from 'axios';

const Maintenance = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [format, setFormat] = useState('json');
  const [stats, setStats] = useState({});
  const [health, setHealth] = useState({});
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const API_BASE_URL = 'http://localhost:5001';

  // Fetch all backups and stats
  const fetchBackups = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/backups`);
      setBackups(response.data.backups || []);
      setStats(response.data.stats || {});
    } catch (error) {
      console.error('Fetch backups error:', error);
      if (error.response?.status === 404) {
        message.warning('Backup system initializing...');
      } else {
        message.error('Failed to fetch backups');
      }
    } finally {
      setLoading(false);
    }
  };

  // Create new backup
  const createBackup = async () => {
    setExportLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/backups/create`, { format });
      
      if (format === 'csv') {
        message.success('CSV backup created successfully! Downloading ZIP file...');
      } else {
        message.success(response.data.message);
      }
      
      fetchBackups();
      
      // Auto-download the backup file
      if (response.data.filename) {
        setTimeout(() => {
          const link = document.createElement('a');
          link.href = `${API_BASE_URL}/backups/download/${response.data.filename}`;
          link.setAttribute('download', response.data.filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          if (format === 'csv') {
            message.info('CSV files are packaged in a ZIP file for download');
          }
        }, 1000);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Backup creation failed';
      message.error(`Backup failed: ${errorMsg}`);
      console.error('Backup error:', error);
    } finally {
      setExportLoading(false);
    }
  };

  // Quick backup
  const createQuickBackup = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/backups/quick`);
      message.success(response.data.message);
      fetchBackups();
    } catch (error) {
      message.error('Quick backup failed');
      console.error('Quick backup error:', error);
    }
  };

  // Download backup
  const downloadBackup = (filename) => {
    try {
      const link = document.createElement('a');
      link.href = `${API_BASE_URL}/backups/download/${filename}`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success(`Downloading ${filename}`);
    } catch (error) {
      message.error('Download failed');
      console.error('Download error:', error);
    }
  };

  // Delete backup
  const deleteBackup = async (filename) => {
    Modal.confirm({
      title: 'Confirm Delete',
      content: `Are you sure you want to delete backup "${filename}"? This action cannot be undone.`,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await axios.delete(`${API_BASE_URL}/backups/${filename}`);
          message.success('Backup deleted successfully');
          fetchBackups();
        } catch (error) {
          message.error('Failed to delete backup');
          console.error('Delete backup error:', error);
        }
      }
    });
  };

  // System health check
  const runHealthCheck = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      setHealth(response.data);
      
      if (response.data.status === 'healthy') {
        message.success('System is healthy and running smoothly');
      } else {
        message.warning('System has some issues - check the health status');
      }
    } catch (error) {
      message.error('System health check failed');
      console.error('Health check error:', error);
    }
  };

  // Database statistics
  const getDatabaseStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/database/stats`);
      setStats(prev => ({ ...prev, ...response.data }));
      message.success('Database stats updated');
    } catch (error) {
      console.error('Database stats error:', error);
      message.warning('Could not fetch database stats');
    }
  };

  // Cleanup old backups
  const cleanupBackups = async () => {
    Modal.confirm({
      title: 'Cleanup Old Backups',
      content: 'This will delete all backups except the 10 most recent ones. Continue?',
      okText: 'Yes, Cleanup',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setCleanupLoading(true);
        try {
          const response = await axios.post(`${API_BASE_URL}/backups/cleanup`, { keepLast: 10 });
          message.success(`Cleanup completed: ${response.data.deleted} backups deleted`);
          fetchBackups();
        } catch (error) {
          message.error('Cleanup failed');
          console.error('Cleanup error:', error);
        } finally {
          setCleanupLoading(false);
        }
      }
    });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const columns = [
    {
      title: 'Filename',
      dataIndex: 'filename',
      key: 'filename',
      render: (text, record) => (
        <Space>
          {record.format === 'json' ? <FileTextOutlined /> : <FileZipOutlined />}
          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{text}</span>
        </Space>
      )
    },
    {
      title: 'Date Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => formatDate(date),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      defaultSortOrder: 'descend'
    },
    {
      title: 'Format',
      dataIndex: 'format',
      key: 'format',
      render: (format) => (
        <Tag 
          color={format === 'json' ? 'blue' : 'green'}
          icon={format === 'json' ? <FileTextOutlined /> : <FileZipOutlined />}
        >
          {format?.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (size) => formatFileSize(size),
      sorter: (a, b) => a.size - b.size
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag 
          color={
            type === 'quick' ? 'green' : 
            type === 'auto' ? 'orange' : 
            type === 'manual' ? 'blue' : 'default'
          }
        >
          {type?.charAt(0).toUpperCase() + type?.slice(1)}
        </Tag>
      ),
      filters: [
        { text: 'Manual', value: 'manual' },
        { text: 'Quick', value: 'quick' },
        { text: 'Auto', value: 'auto' }
      ],
      onFilter: (value, record) => record.type === value
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="Download Backup">
            <Button 
              icon={<DownloadOutlined />} 
              onClick={() => downloadBackup(record.filename)}
              size="small"
            >
              Download
            </Button>
          </Tooltip>
          
          <Tooltip title="Delete Backup">
            <Button 
              icon={<DeleteOutlined />}
              onClick={() => deleteBackup(record.filename)}
              size="small"
              danger
            >
              Delete
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  useEffect(() => {
    fetchBackups();
    getDatabaseStats();
    runHealthCheck();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(() => {
      getDatabaseStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Calculate actual collection count from stats
  const actualCollectionCount = stats.collectionStats ? Object.keys(stats.collectionStats).length : 0;

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]}>
        {/* System Health */}
        <Col span={24}>
          <Card 
            title={
              <Space>
                <SecurityScanOutlined />
                System Health
                <Tag color={health.status === 'healthy' ? 'green' : 'red'}>
                  {health.status ? health.status.toUpperCase() : 'UNKNOWN'}
                </Tag>
              </Space>
            } 
            size="small"
          >
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="Database Status"
                  value={health.database === 'connected' ? 'Connected' : 'Disconnected'}
                  valueStyle={{ 
                    color: health.database === 'connected' ? '#3f8600' : '#cf1322',
                    fontSize: '16px'
                  }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Server Uptime"
                  value={health.uptime ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : 'Unknown'}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Active Timers"
                  value={health.active?.timers || 0}
                  suffix={`/ ${health.active?.users || 0} users`}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Memory Usage"
                  value={health.memory?.used || 'Unknown'}
                  suffix={health.memory?.heapUsed ? `(${health.memory.heapUsed})` : ''}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Statistics Cards */}
        <Col span={24}>
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Backups"
                  value={backups.length}
                  prefix={<DatabaseOutlined />}
                  valueStyle={{ color: backups.length > 0 ? '#3f8600' : '#cf1322' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Database Collections"
                  value={actualCollectionCount || stats.collectionsCount || 0}
                  suffix="collections"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Records"
                  value={stats.totalRecords || 0}
                  suffix="records"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Last Backup"
                  value={stats.lastBackup ? formatDate(stats.lastBackup) : 'Never'}
                  valueStyle={{ fontSize: '14px' }}
                />
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Backup Actions */}
        <Col span={24}>
          <Card 
            title={
              <Space>
                <DatabaseOutlined />
                Database Maintenance
                <Tag color="blue">LIVE</Tag>
              </Space>
            } 
            bordered={false}
            extra={
              <Space wrap>
                <Tooltip title="Check System Health">
                  <Button 
                    icon={<SecurityScanOutlined />}
                    onClick={runHealthCheck}
                  >
                    Health Check
                  </Button>
                </Tooltip>
                
                <Tooltip title="Keep only 10 most recent backups">
                  <Button 
                    icon={<ClearOutlined />}
                    onClick={cleanupBackups}
                    loading={cleanupLoading}
                    danger
                    disabled={backups.length <= 10}
                  >
                    Cleanup
                  </Button>
                </Tooltip>
                
                <Tooltip title="Create quick backup (essential data only)">
                  <Button 
                    icon={<RocketOutlined />}
                    onClick={createQuickBackup}
                  >
                    Quick Backup
                  </Button>
                </Tooltip>
                
                <Button 
                  icon={<SyncOutlined />} 
                  onClick={fetchBackups}
                  loading={loading}
                >
                  Refresh
                </Button>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space wrap>
                <Select
                  value={format}
                  style={{ width: 140 }}
                  onChange={setFormat}
                  options={[
                    { 
                      value: 'json', 
                      label: (
                        <Space>
                          <FileTextOutlined />
                          JSON Format
                        </Space>
                      ) 
                    },
                    { 
                      value: 'csv', 
                      label: (
                        <Space>
                          <FileZipOutlined />
                          CSV Format (ZIP)
                        </Space>
                      ) 
                    },
                  ]}
                />
                
                <Tooltip title={`Create full ${format.toUpperCase()} backup of all data`}>
                  <Button 
                    type="primary" 
                    onClick={createBackup}
                    loading={exportLoading}
                    icon={<DownloadOutlined />}
                    size="large"
                  >
                    Create {format.toUpperCase()} Backup
                  </Button>
                </Tooltip>
                
                <Button 
                  onClick={getDatabaseStats}
                  icon={<DatabaseOutlined />}
                >
                  Update Stats
                </Button>
              </Space>

              {/* Storage Usage */}
              {stats.storageUsage && (
                <div style={{ marginTop: 16, maxWidth: 400 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>
                      <DatabaseOutlined /> Storage Usage
                      {stats.totalRecords && (
                        <span style={{ color: '#666', fontSize: '12px', marginLeft: 8 }}>
                          ({stats.totalRecords.toLocaleString()} records)
                        </span>
                      )}
                    </span>
                    <span>{Math.round(stats.storageUsage)}%</span>
                  </div>
                  <Progress 
                    percent={stats.storageUsage} 
                    status={stats.storageUsage > 90 ? 'exception' : stats.storageUsage > 80 ? 'active' : 'normal'}
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#87d068',
                    }}
                  />
                </div>
              )}
            </Space>
          </Card>
        </Col>

        {/* Collection Stats */}
        {stats.collectionStats && (
          <Col span={24}>
            <Card title={`Collection Statistics (${actualCollectionCount} Collections)`} size="small">
              <Row gutter={[16, 16]}>
                {Object.entries(stats.collectionStats).map(([name, count]) => (
                  <Col xs={12} sm={8} md={6} lg={4} key={name}>
                    <Card size="small" hoverable>
                      <Statistic
                        title={name}
                        value={count}
                        valueStyle={{ 
                          fontSize: '16px',
                          color: count > 0 ? '#1890ff' : '#999'
                        }}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        )}

        {/* Backups Table */}
        <Col span={24}>
          <Card 
            title={
              <Space>
                <DownloadOutlined />
                Backup Files
                <Tag>{backups.length} backups</Tag>
              </Space>
            }
            extra={
              <Space>
                <span style={{ color: '#666', fontSize: '12px' }}>
                  Total size: {formatFileSize(backups.reduce((sum, backup) => sum + (backup.size || 0), 0))}
                </span>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={backups}
              loading={loading}
              rowKey="filename"
              pagination={{ 
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} of ${total} backups`
              }}
              scroll={{ x: 800 }}
              locale={{
                emptyText: (
                  <div style={{ padding: '40px 0', textAlign: 'center' }}>
                    <DatabaseOutlined style={{ fontSize: 48, color: '#ddd', marginBottom: 16 }} />
                    <div style={{ color: '#999' }}>
                      No backups found. Create your first backup to get started!
                    </div>
                  </div>
                )
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Maintenance;