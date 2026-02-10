import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Table, Button, Card, 
  Form, Badge, Spinner, Alert, InputGroup,
  Modal, Tabs, Tab
} from 'react-bootstrap';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import { 
  Search, 
  Filter,
  Calendar,
  Download,
  User,
  AlertTriangle,
  Slash,
  Edit,
  CheckCircle,
  Eye,
  Users,
  RefreshCw
} from 'react-feather';

const ViewRecordVisits = () => {
  const [visitLogs, setVisitLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [banned, setBanned] = useState([]);
  const [filteredBanned, setFilteredBanned] = useState([]);
  const [bannedSearch, setBannedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inmates, setInmates] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  
  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBy, setSearchBy] = useState('personName');

  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);

  // Form states
  const [violationForm, setViolationForm] = useState({
    violationType: '',
    violationDetails: ''
  });

  const [banForm, setBanForm] = useState({
    reason: '',
    banStartDate: new Date().toISOString().split('T')[0],
    banEndDate: '',
    calculatedDuration: '',
    durationType: 'temporary',
    notes: ''
  });

  // Counts state
  const [counts, setCounts] = useState({
    all: 0,
    visitors: 0,
    guests: 0,
    banned: 0
  });

  // History states
  const [banHistory, setBanHistory] = useState([]);
  const [filteredBanHistory, setFilteredBanHistory] = useState([]);
  const [violationHistory, setViolationHistory] = useState([]);
  const [filteredViolationHistory, setFilteredViolationHistory] = useState([]);
  const [violationHistorySearch, setViolationHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState({
    startDate: '',
    endDate: '',
    personType: ''
  });
  const [banHistorySearch, setBanHistorySearch] = useState('');

  const API_BASE = 'http://localhost:5001';

  const searchOptions = [
    { value: 'personName', label: 'Person Name' },
    { value: 'personId', label: 'Person ID' },
    { value: 'visitPurpose', label: 'Visit Purpose' },
    { value: 'personType', label: 'Type' }
  ];

  const violationTypes = [
    'Late Arrival',
    'Early Departure',
    'Misconduct',
    'Prohibited Items',
    'Unauthorized Areas',
    'Disruptive Behavior',
    'Other'
  ];

  const banDurations = [
    { value: '1_week', label: '1 Week' },
    { value: '2_weeks', label: '2 Weeks' },
    { value: '1_month', label: '1 Month' },
    { value: '3_months', label: '3 Months' },
    { value: '6_months', label: '6 Months' },
    { value: '1_year', label: '1 Year' },
    { value: 'permanent', label: 'Permanent' },
    { value: 'custom', label: 'Custom Duration' }
  ];

  useEffect(() => {
    fetchVisitLogs();
    fetchInmates();
    fetchBanned();
    fetchBanHistory();
    fetchViolationHistory();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [visitLogs, startDate, endDate, searchQuery, searchBy, activeTab]);

  useEffect(() => {
    const visitorLogs = visitLogs.filter(log => log.personType === 'visitor');
    const guestLogs = visitLogs.filter(log => log.personType === 'guest');
    
    setCounts({
      all: visitLogs.length,
      visitors: visitorLogs.length,
      guests: guestLogs.length,
      banned: banned.length
    });
  }, [visitLogs, banned]);

  useEffect(() => {
    if (activeTab === 'ban-history' || activeTab === 'violation-history') {
      fetchBanHistory();
      fetchViolationHistory();
    }
  }, [historyFilter, activeTab]);

  useEffect(() => {
    filterBanHistory();
  }, [banHistory, banHistorySearch]);

  useEffect(() => {
    filterViolationHistory();
  }, [violationHistory, violationHistorySearch]);

  useEffect(() => {
    filterBanned();
  }, [banned, bannedSearch]);

  const filterBanned = () => {

    if (!bannedSearch.trim()) {
      setFilteredBanned(banned);
      return;
    }

    const searchLower = bannedSearch.toLowerCase().trim();
    const filtered = banned.filter(person => {
      const personName = (person.personName || '').toLowerCase();
      const personId = (person.id || '').toLowerCase();
      const banReason = (person.banReason || '').toLowerCase();
      const personType = (person.personType || '').toLowerCase();
      
      return personName.includes(searchLower) ||
             personId.includes(searchLower) ||
             banReason.includes(searchLower) ||
             personType.includes(searchLower);
    });

    setFilteredBanned(filtered);
  };

  const filterBanHistory = () => {
    if (!banHistorySearch.trim()) {
      setFilteredBanHistory(banHistory);
      return;
    }

    const searchLower = banHistorySearch.toLowerCase().trim();
    const filtered = banHistory.filter(record => {
      const personName = (record.personName || '').toLowerCase();
      const personId = (record.personId || '').toLowerCase();
      const banReason = (record.banReason || '').toLowerCase();
      const personType = (record.personType || '').toLowerCase();
      
      return personName.includes(searchLower) ||
             personId.includes(searchLower) ||
             banReason.includes(searchLower) ||
             personType.includes(searchLower);
    });

    setFilteredBanHistory(filtered);
  };

  const filterViolationHistory = () => {
    if (!violationHistorySearch.trim()) {
      setFilteredViolationHistory(violationHistory);
      return;
    }

    const searchLower = violationHistorySearch.toLowerCase().trim();
    const filtered = violationHistory.filter(record => {
      const personName = (record.personName || '').toLowerCase();
      const personId = (record.personId || '').toLowerCase();
      const violationType = (record.violationType || '').toLowerCase();
      const violationDetails = (record.violationDetails || '').toLowerCase();
      const personType = (record.personType || '').toLowerCase();
      
      return personName.includes(searchLower) ||
             personId.includes(searchLower) ||
             violationType.includes(searchLower) ||
             violationDetails.includes(searchLower) ||
             personType.includes(searchLower);
    });

    setFilteredViolationHistory(filtered);
  };

  const fetchVisitLogs = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/visit-logs`);
      console.log('Raw visit logs:', response.data);
      
      const logsWithGuestDetails = await Promise.all(
        response.data.map(async (log) => {
          if (log.personType === 'guest') {
            try {
              const guestResponse = await axios.get(`${API_BASE}/guests/${log.personId}`);
              return {
                ...log,
                visitPurpose: guestResponse.data.visitPurpose || 'General Visit'
              };
            } catch (error) {
              console.error(`Error fetching guest ${log.personId}:`, error);
              return { ...log, visitPurpose: 'General Visit' };
            }
          }
          return log;
        })
      );
      
      const sortedLogs = logsWithGuestDetails.sort((a, b) => {
        const dateA = new Date(a.visitDate);
        const dateB = new Date(b.visitDate);
        if (dateA.getTime() === dateB.getTime()) {
          return b.timeIn.localeCompare(a.timeIn);
        }
        return dateB - dateA;
      });
      
      setVisitLogs(sortedLogs);
    } catch (error) {
      console.error("Error fetching visit logs:", error);
      toast.error("Failed to fetch visit records");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInmates = async () => {
    try {
      const response = await axios.get(`${API_BASE}/inmates`);
      setInmates(response.data);
    } catch (error) {
      console.error('Error fetching PDLs:', error);
    }
  };



  const fetchBanned = async () => {
    try {
      const [visitorsRes, guestsRes] = await Promise.all([
        axios.get(`${API_BASE}/visitors`),
        axios.get(`${API_BASE}/guests`)
      ]);
      
      const bannedVisitors = visitorsRes.data
        .filter(visitor => visitor.isBanned === true && !isClientSideBanExpired(visitor))
        .map(visitor => ({
          ...visitor,
          personType: 'visitor',
          personName: visitor.fullName,
          id: visitor.id,
          banReason: visitor.banReason || 'Administrative ban',
          banDuration: visitor.banDuration || 'permanent',
          banNotes: visitor.banNotes || '',
          banStartDate: visitor.banStartDate || null,
          banEndDate: visitor.banEndDate || null,
          calculatedDuration: visitor.calculatedDuration || null
        }));
      
      const bannedGuests = guestsRes.data
        .filter(guest => guest.isBanned === true && !isClientSideBanExpired(guest))
        .map(guest => ({
          ...guest,
          personType: 'guest',
          personName: guest.fullName,
          id: guest.id,
          banReason: guest.banReason || 'Administrative ban',
          banDuration: guest.banDuration || 'permanent',
          banNotes: guest.banNotes || '',
          banStartDate: guest.banStartDate || null,
          banEndDate: guest.banEndDate || null,
          calculatedDuration: guest.calculatedDuration || null
        }));
      
      const allBanned = [...bannedVisitors, ...bannedGuests];
      console.log('✅ Fetched banned persons with new fields:', allBanned.length);
      setBanned(allBanned);
    } catch (error) {
      console.error('Error fetching banned persons:', error);
      toast.error('Failed to fetch banned persons');
    }
  };

  const fetchBanHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (historyFilter.startDate) params.append('startDate', historyFilter.startDate);
      if (historyFilter.endDate) params.append('endDate', historyFilter.endDate);
      if (historyFilter.personType) params.append('personType', historyFilter.personType);
      if (historyFilter.status) params.append('status', historyFilter.status);

      const response = await axios.get(`${API_BASE}/ban-history?${params}`);
      console.log('✅ Ban history fetched:', response.data.length);
      setBanHistory(response.data);
    } catch (error) {
      console.error('❌ Error fetching ban history:', error);
      toast.error('Failed to fetch ban history');
    }
  };

  const fetchViolationHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (historyFilter.startDate) params.append('startDate', historyFilter.startDate);
      if (historyFilter.endDate) params.append('endDate', historyFilter.endDate);
      if (historyFilter.personType) params.append('personType', historyFilter.personType);
      if (historyFilter.status) params.append('status', historyFilter.status);

      const response = await axios.get(`${API_BASE}/violation-history?${params}`);
      console.log('✅ Violation history fetched:', response.data.length);
      setViolationHistory(response.data);
    } catch (error) {
      console.error('❌ Error fetching violation history:', error);
      toast.error('Failed to fetch violation history');
    }
  };

  const filterLogs = () => {
    let filtered = visitLogs;

    if (activeTab === 'visitors') {
      filtered = filtered.filter(log => log.personType === 'visitor');
    } else if (activeTab === 'guests') {
      filtered = filtered.filter(log => log.personType === 'guest');
    }

    if (startDate) {
      filtered = filtered.filter(log => {
        const visitDate = new Date(log.visitDate).toISOString().split('T')[0];
        return visitDate >= startDate;
      });
    }

    if (endDate) {
      filtered = filtered.filter(log => {
        const visitDate = new Date(log.visitDate).toISOString().split('T')[0];
        return visitDate <= endDate;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => {
        switch (searchBy) {
          case 'personName':
            return log.personName?.toLowerCase().includes(query);
          case 'personId':
            return log.personId?.toLowerCase().includes(query);
          case 'visitPurpose':
            return log.visitPurpose?.toLowerCase().includes(query);
          default:
            return true;
        }
      });
    }

    setFilteredLogs(filtered);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  const clearHistoryFilters = () => {
    setHistoryFilter({
      startDate: '',
      endDate: '',
      personType: '',
      status: ''
    });
  };

  // Helper function to check if a ban has expired (client-side check)
  const isClientSideBanExpired = (person) => {
    if (!person.isBanned || person.banDuration === 'permanent') {
      return false;
    }

    const now = new Date();
    let endDate;

    if (person.banDuration === 'custom' && person.banEndDate) {
      endDate = new Date(person.banEndDate);
    } else if (person.banStartDate) {
      const startDate = new Date(person.banStartDate);
      endDate = new Date(startDate);

      switch (person.banDuration) {
        case '1_week':
          endDate.setDate(startDate.getDate() + 7);
          break;
        case '2_weeks':
          endDate.setDate(startDate.getDate() + 14);
          break;
        case '1_month':
          endDate.setMonth(startDate.getMonth() + 1);
          break;
        case '3_months':
          endDate.setMonth(startDate.getMonth() + 3);
          break;
        case '6_months':
          endDate.setMonth(startDate.getMonth() + 6);
          break;
        case '1_year':
          endDate.setFullYear(startDate.getFullYear() + 1);
          break;
        default:
          return false;
      }
    } else {
      return false;
    }

    return now >= endDate;
  };

  const calculateBanDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return '';
    
    const from = new Date(startDate);
    const to = new Date(endDate);
    
    if (to <= from) return 'Invalid dates - end date must be after start date';
    
    const diffTime = Math.abs(to - from);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffYears = Math.floor(diffDays / 365);
    const diffMonths = Math.floor((diffDays % 365) / 30);
    const remainingDays = diffDays % 30;

    let durationParts = [];
    if (diffYears > 0) durationParts.push(`${diffYears} year${diffYears > 1 ? 's' : ''}`);
    if (diffMonths > 0) durationParts.push(`${diffMonths} month${diffMonths > 1 ? 's' : ''}`);
    if (remainingDays > 0) durationParts.push(`${remainingDays} day${remainingDays > 1 ? 's' : ''}`);
    
    return durationParts.length > 0 ? `${durationParts.join(' ')}` : 'Same day';
  };

  const getBanDurationDisplay = (person) => {
    if (person.banDuration === 'permanent') {
      return 'Permanent';
    }
    
    const now = new Date();
    let endDate;
    
    if (person.banDuration === 'custom' && person.banEndDate) {
      endDate = new Date(person.banEndDate);
    } else {
      const startDate = new Date(person.banStartDate || person.createdAt);
      endDate = new Date(startDate);
      
      switch (person.banDuration) {
        case '1_week':
          endDate.setDate(startDate.getDate() + 7);
          break;
        case '2_weeks':
          endDate.setDate(startDate.getDate() + 14);
          break;
        case '1_month':
          endDate.setMonth(startDate.getMonth() + 1);
          break;
        case '3_months':
          endDate.setMonth(startDate.getMonth() + 3);
          break;
        case '6_months':
          endDate.setMonth(startDate.getMonth() + 6);
          break;
        case '1_year':
          endDate.setFullYear(startDate.getFullYear() + 1);
          break;
        default:
          return 'Unknown duration';
      }
    }
    
    const timeDiff = endDate - now;
    
    if (timeDiff <= 0) return 'Expired';
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  };

  // Modal functions (DELETE FUNCTIONALITY REMOVED)
  const openDetailsModal = (log) => {
    setSelectedLog(log);
    setSelectedPerson(null);
    setShowDetailsModal(true);
  };

  const openPersonDetailsModal = (person) => {
    setSelectedPerson(person);
    setSelectedLog(null);
    setShowDetailsModal(true);
  };

  const openViolationModal = (log) => {
    setSelectedLog(log);
    setSelectedPerson(null);
    setViolationForm({
      violationType: '',
      violationDetails: ''
    });
    setShowViolationModal(true);
  };

  const openBanModal = (log) => {
    setSelectedLog(log);
    setSelectedPerson(null);
    setBanForm({
      reason: '',
      banStartDate: new Date().toISOString().split('T')[0],
      banEndDate: '',
      calculatedDuration: '',
      durationType: 'temporary',
      notes: ''
    });
    setShowBanModal(true);
  };

  const openEditViolationModal = (person) => {
    setSelectedPerson(person);
    setSelectedLog(null);
    setViolationForm({
      violationType: person.violationType || '',
      violationDetails: person.violationDetails || ''
    });
    setShowViolationModal(true);
  };

  const openEditBanModal = (person) => {
    setSelectedPerson(person);
    setSelectedLog(null);
    setBanForm({
      reason: person.banReason || '',
      banStartDate: person.banStartDate ? person.banStartDate.split('T')[0] : new Date().toISOString().split('T')[0],
      banEndDate: person.banEndDate ? person.banEndDate.split('T')[0] : '',
      calculatedDuration: person.calculatedDuration || '',
      durationType: person.banDuration === 'permanent' ? 'permanent' : 'temporary',
      notes: person.banNotes || ''
    });
    setShowBanModal(true);
  };

  const handleAddViolation = async () => {
    if (!violationForm.violationType) {
      toast.error("Please select a violation type");
      return;
    }

    try {
      const endpoint = selectedLog.personType === 'visitor' 
        ? `${API_BASE}/visitors/${selectedLog.personId}/violation`
        : `${API_BASE}/guests/${selectedLog.personId}/violation`;
      
      const violationData = {
        violationType: violationForm.violationType,
        violationDetails: violationForm.violationDetails
      };
      
      console.log('🔄 Adding violation to:', endpoint);
      console.log('📦 Violation data:', violationData);
      
      const response = await axios.put(endpoint, violationData);
      console.log('✅ Violation response:', response.data);
      
      toast.success("Violation added successfully");
      setShowViolationModal(false);
      setSelectedLog(null);
      fetchBanned();
      fetchVisitLogs();
      fetchViolationHistory();
    } catch (error) {
      console.error("❌ Error adding violation:", error);
      console.error("📋 Error response:", error.response?.data);
      toast.error(`Failed to add violation: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleEditViolation = async () => {
    if (!violationForm.violationType) {
      toast.error("Please select a violation type");
      return;
    }

    try {
      const endpoint = selectedPerson.personType === 'visitor' 
        ? `${API_BASE}/visitors/${selectedPerson.id}/violation`
        : `${API_BASE}/guests/${selectedPerson.id}/violation`;
      
      const violationData = {
        violationType: violationForm.violationType,
        violationDetails: violationForm.violationDetails
      };
      
      await axios.put(endpoint, violationData);
      
      toast.success("Violation updated successfully");
      setShowViolationModal(false);
      setSelectedPerson(null);
      fetchBanned();
      fetchViolationHistory();
    } catch (error) {
      console.error("Error updating violation:", error);
      toast.error("Failed to update violation");
    }
  };

  const handleRemoveViolation = async (personId, personType) => {
    if (!window.confirm("Are you sure you want to remove this violation?")) {
      return;
    }

    try {
      const endpoint = personType === 'visitor' 
        ? `${API_BASE}/visitors/${personId}/remove-violation`
        : `${API_BASE}/guests/${personId}/remove-violation`;
      
      console.log('🔄 Removing violation from:', endpoint);
      const response = await axios.put(endpoint);
      console.log('✅ Remove violation response:', response.data);
      
      toast.success("Violation removed successfully");
      
      fetchViolationHistory();
      
    } catch (error) {
      console.error("❌ Error removing violation:", error);
      console.error("📋 Error details:", error.response?.data);
      toast.error(`Failed to remove violation: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleAddBan = async () => {
    if (!banForm.reason) {
      toast.error("Please provide a ban reason");
      return;
    }

    if (banForm.durationType === 'temporary' && (!banForm.banStartDate || !banForm.banEndDate)) {
      toast.error("Please provide both start and end dates for temporary ban");
      return;
    }

    if (banForm.durationType === 'temporary') {
      const start = new Date(banForm.banStartDate);
      const end = new Date(banForm.banEndDate);
      if (end <= start) {
        toast.error("Ban end date must be after start date");
        return;
      }
    }

    try {
      const endpoint = selectedLog.personType === 'visitor' 
        ? `${API_BASE}/visitors/${selectedLog.personId}/ban`
        : `${API_BASE}/guests/${selectedLog.personId}/ban`;
      
      const banData = {
        reason: banForm.reason,
        duration: banForm.durationType === 'permanent' ? 'permanent' : 'custom',
        notes: banForm.notes,
        isBanned: true,
        bannedBy: 'System',
        banStartDate: banForm.banStartDate,
        banEndDate: banForm.durationType === 'permanent' ? null : banForm.banEndDate,
        calculatedDuration: banForm.calculatedDuration
      };
      
      console.log('🔄 Adding ban with data:', banData);
      
      const response = await axios.put(endpoint, banData);
      console.log('✅ Ban response:', response.data);
      
      toast.success("Person banned successfully");
      setShowBanModal(false);
      setSelectedLog(null);
      
      fetchBanned();
      fetchVisitLogs();
      fetchBanHistory();
      
    } catch (error) {
      console.error("❌ Error adding ban:", error);
      console.error("📋 Error details:", error.response?.data);
      toast.error(`Failed to ban person: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleEditBan = async () => {
    if (!banForm.reason) {
      toast.error("Please provide a ban reason");
      return;
    }

    try {
      const endpoint = selectedPerson.personType === 'visitor' 
        ? `${API_BASE}/visitors/${selectedPerson.id}/ban`
        : `${API_BASE}/guests/${selectedPerson.id}/ban`;
      
      const banData = {
        reason: banForm.reason,
        duration: banForm.durationType === 'permanent' ? 'permanent' : 'custom',
        notes: banForm.notes,
        isBanned: true,
        bannedBy: 'System',
        banStartDate: banForm.banStartDate,
        banEndDate: banForm.durationType === 'permanent' ? null : banForm.banEndDate,
        calculatedDuration: banForm.calculatedDuration
      };
      
      await axios.put(endpoint, banData);
      
      toast.success("Ban updated successfully");
      setShowBanModal(false);
      setSelectedPerson(null);
      fetchBanned();
      fetchBanHistory();
    } catch (error) {
      console.error("Error updating ban:", error);
      toast.error("Failed to update ban");
    }
  };

  const handleRemoveBan = async (personId, personType) => {
    if (!window.confirm("Are you sure you want to remove this ban and any associated violation records?")) {
      return;
    }

    try {
      const banEndpoint = personType === 'visitor' 
        ? `${API_BASE}/visitors/${personId}/remove-ban`
        : `${API_BASE}/guests/${personId}/remove-ban`;
      
      console.log('🔄 Removing ban from:', banEndpoint);
      const banResponse = await axios.put(banEndpoint);
      console.log('✅ Remove ban response:', banResponse.data);

      try {
        const violationEndpoint = personType === 'visitor' 
          ? `${API_BASE}/visitors/${personId}/remove-violation`
          : `${API_BASE}/guests/${personId}/remove-violation`;
        
        console.log('🔄 Removing violation from:', violationEndpoint);
        await axios.put(violationEndpoint);
        console.log('✅ Violation removed successfully');
      } catch (violationError) {
        console.log('⚠️ No violation to remove or error removing violation:', violationError.message);
      }
      
      toast.success("Ban removed successfully");
      
      fetchBanned();
      fetchBanHistory();
      
    } catch (error) {
      console.error("❌ Error removing ban:", error);
      console.error("📋 Error details:", error.response?.data);
      toast.error(`Failed to remove ban: ${error.response?.data?.message || error.message}`);
    }
  };

  const exportToCSV = () => {
    let headers = [];
    let csvData = [];

    switch (activeTab) {

      case 'violation-history':
        if (violationHistory.length === 0) {
          toast.warning("No violation history data to export");
          return;
        }
        headers = ['Date Recorded', 'Person ID', 'Name', 'Type', 'Violation Type', 'Violation Details', 'Status', 'Date Removed', 'Recorded By'];
        csvData = violationHistory.map(record => [
          formatDate(record.createdAt) + ' ' + formatTime(record.createdAt),
          record.personId,
          record.personName,
          record.personType.toUpperCase(),
          record.violationType,
          record.violationDetails || 'N/A',
          record.status,
          record.removedAt ? (formatDate(record.removedAt) + ' ' + formatTime(record.removedAt)) : 'Still Active',
          record.recordedBy || 'System'
        ]);
        break;

      case 'banned':
        if (banned.length === 0) {
          toast.warning("No banned data to export");
          return;
        }
        headers = ['Person ID', 'Name', 'Type', 'Ban Reason', 'Ban Duration', 'Time Remaining'];
        csvData = banned.map(person => [
          person.id || 'N/A',
          person.personName || 'N/A',
          (person.personType || 'unknown').toUpperCase(),
          person.banReason || 'N/A',
          person.banDuration ? (banDurations.find(d => d.value === person.banDuration)?.label || person.banDuration) : 'Permanent',
          getBanDurationDisplay(person)
        ]);
        break;

      case 'ban-history':
        if (banHistory.length === 0) {
          toast.warning("No ban history data to export");
          return;
        }
        headers = ['Date Banned', 'Person ID', 'Name', 'Type', 'Ban Reason', 'Ban Duration', 'Status', 'Date Removed', 'Banned By'];
        csvData = banHistory.map(record => [
          formatDate(record.createdAt) + ' ' + formatTime(record.createdAt),
          record.personId,
          record.personName,
          record.personType.toUpperCase(),
          record.banReason,
          record.banDuration ? (banDurations.find(d => d.value === record.banDuration)?.label || record.banDuration) : 'Permanent',
          record.status,
          record.removedAt ? (formatDate(record.removedAt) + ' ' + formatTime(record.removedAt)) : 'Still Active',
          record.bannedBy || 'System'
        ]);
        break;

      default:
        if (filteredLogs.length === 0) {
          toast.warning("No visit logs data to export");
          return;
        }
        headers = [
          'Visit Date', 'Type', 'Person ID', 'Person Name', 'Prisoner ID', 'PDL Name', 'Visit Purpose',
          'Time In', 'Time Out', 'Visit Duration', 'Status', 'Timer Active'
        ];
        csvData = filteredLogs.map(log => [
          formatDate(log.visitDate),
          log.personType.toUpperCase(),
          log.personId,
          log.personName,
          log.prisonerId || 'N/A',
          log.inmateName || 'N/A',
          log.visitPurpose || 'N/A',
          formatTime(log.timeIn),
          formatTime(log.timeOut) || 'N/A',
          log.visitDuration || 'N/A',
          log.status,
          log.isTimerActive ? 'Yes' : 'No'
        ]);
    }

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTab}_records_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    let recordCount = 0;
    let recordType = activeTab;
    
    switch (activeTab) {
      case 'violation-history':
        recordCount = violationHistory.length;
        break;
      case 'banned':
        recordCount = banned.length;
        break;
      case 'ban-history':
        recordCount = banHistory.length;
        break;
      default:
        recordCount = filteredLogs.length;
    }
    
    toast.success(`Exported ${recordCount} ${recordType} records to CSV`);
  };

  const getTypeVariant = (type) => {
    return type === 'visitor' ? 'primary' : 'info';
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in-progress': return 'warning';
      default: return 'secondary';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'Not recorded';
    return timeString;
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const isEditingViolation = selectedPerson !== null;
  const isEditingBan = selectedPerson !== null;

  // Render functions for different tables (DELETE BUTTONS REMOVED)
  const renderVisitTable = (data) => {
    if (data.length === 0) {
      return (
        <Alert variant="info">
          No visit records found in this category.
        </Alert>
      );
    }

    return (
      <Table striped bordered hover responsive className="bg-white">
        <thead className="table-dark">
          <tr>
            <th>Visit Date</th>
            <th>Type</th>
            <th>Person Information</th>
            {activeTab === 'guests' ? (
              <th>Visit Purpose</th>
            ) : (
              <th>PDL Details</th>
            )}
            <th>Time Details</th>
            <th>Status</th>
            <th style={{ width: '150px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map(log => (
            <tr key={log._id}>
              <td>
                <div className="fw-bold">{formatDate(log.visitDate)}</div>
                <div className="small text-muted">
                  {new Date(log.visitDate).toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
              </td>
              <td>
                <Badge bg={getTypeVariant(log.personType)} className="fs-6">
                  {log.personType.toUpperCase()}
                </Badge>
              </td>
              <td>
                <div className="fw-bold">{log.personName}</div>
                <div className="small text-muted">
                  <User size={12} className="me-1" />
                  ID: {log.personId}
                </div>
              </td>
              {activeTab === 'guests' ? (
                <td>
                  <div className="fw-bold text-primary">{log.visitPurpose || 'General Visit'}</div>
                </td>
              ) : (
                <td>
                  {log.prisonerId ? (
                    <>
                      <div className="fw-bold">{log.inmateName}</div>
                      <div className="small text-muted">
                        PDL ID: {log.prisonerId}
                      </div>
                    </>
                  ) : (
                    <div className="text-muted">N/A</div>
                  )}
                </td>
              )}
              <td>
                <div className="small">
                  <div><strong>Time In:</strong> {formatTime(log.timeIn)}</div>
                  <div><strong>Time Out:</strong> {formatTime(log.timeOut) || 'Not checked out'}</div>
                  {log.visitDuration && (
                    <div><strong>Duration:</strong> {log.visitDuration}</div>
                  )}
                </div>
              </td>
              <td className="text-center">
                <Badge bg={getStatusVariant(log.status)} className="fs-6">
                  {log.status.toUpperCase()}
                </Badge>
                {log.isTimerActive && (
                  <div className="small mt-1">
                    <Badge bg="warning">TIMER ACTIVE</Badge>
                  </div>
                )}
              </td>
              <td>
                <div className="d-flex gap-2 justify-content-center flex-wrap">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => openDetailsModal(log)}
                    title="View Details"
                    className="p-1"
                  >
                    <Eye size={16} />
                  </Button>
                  <Button
                    variant="outline-warning"
                    size="sm"
                    onClick={() => openViolationModal(log)}
                    title="Add Violation"
                    className="p-1"
                  >
                    <AlertTriangle size={16} />
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => openBanModal(log)}
                    title="Ban Person"
                    className="p-1"
                  >
                    <Slash size={16} />
                  </Button>
                  {/* DELETE BUTTON REMOVED */}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };



  const renderBannedTable = () => {
    const displayBanned = filteredBanned.length > 0 ? filteredBanned : banned;
    
    if (banned.length === 0) {
      return (
        <Alert variant="info">
          No banned persons found.
        </Alert>
      );
    }

    return (
      <>
        <Card className="mb-3" style={{ 
        backgroundColor: '#676767a7', 
        borderRadius: '12px', marginBottom: '20px', 
        borderLeft: '4px solid #FFD700', 
        borderRight: '4px solid #FFD700',}}>
          <Card.Body>
            <Form.Group>
              <Form.Label>
                <Search size={14} className="me-1" />
                Search Banned Records
              </Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <Search size={16} />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search by name, ID, reason, or type..."
                  value={bannedSearch}
                  onChange={(e) => setBannedSearch(e.target.value)}
                  style={{ backgroundColor: 'white' }}
                />
                {bannedSearch && (
                  <Button 
                    variant="outline-secondary"
                    onClick={() => setBannedSearch('')}
                  >
                    Clear
                  </Button>
                )}
              </InputGroup>
              {bannedSearch && (
                <Form.Text className="text-muted">
                  Found {filteredBanned.length} of {banned.length} records
                </Form.Text>
              )}
            </Form.Group>
          </Card.Body>
        </Card>

        {bannedSearch && filteredBanned.length === 0 ? (
          <Alert variant="warning">
            No banned persons match your search criteria.
          </Alert>
        ) : (
          <Table striped bordered hover responsive className="bg-white">
            <thead className="table-dark">
              <tr>
                <th>Person ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Ban Status</th>
                <th>Ban Reason</th>
                <th>Ban Duration</th>
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayBanned.map(person => (
            <tr key={person.id}>
              <td>{person.id}</td>
              <td className="fw-bold">{person.personName}</td>
              <td>
                <Badge bg={getTypeVariant(person.personType)}>
                  {person.personType.toUpperCase()}
                </Badge>
              </td>
              <td>
                <Badge bg="danger">Banned</Badge>
              </td>
              <td>{person.banReason || 'No reason provided'}</td>
              <td>
                <Badge bg="warning">
                  {getBanDurationDisplay(person)}
                </Badge>
              </td>
              <td>
                <div className="d-flex gap-2 justify-content-center">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => openPersonDetailsModal(person)}
                    title="View Details"
                    className="p-1"
                  >
                    <Eye size={16} />
                  </Button>
                  <Button
                    variant="outline-warning"
                    size="sm"
                    onClick={() => openEditBanModal(person)}
                    title="Edit Ban"
                    className="p-1"
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    variant="outline-success"
                    size="sm"
                    onClick={() => handleRemoveBan(person.id, person.personType)}
                    title="Remove Ban"
                    className="p-1"
                  >
                    <CheckCircle size={16} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
        )}
      </>
    );
  };

  const renderBanHistoryTable = () => {
    const displayHistory = filteredBanHistory.length > 0 ? filteredBanHistory : banHistory;
    
    if (banHistory.length === 0) {
      return (
        <Alert variant="info">
          No ban history found.
        </Alert>
      );
    }

    if (banHistorySearch && filteredBanHistory.length === 0) {
      return (
        <Alert variant="warning">
          No ban history records match your search criteria.
        </Alert>
      );
    }

    return (
      <Table striped bordered hover responsive className="bg-white">
        <thead className="table-dark">
          <tr>
            <th>Person Details</th>
            <th>Ban Information</th>
            <th>Date Banned</th>
            <th>Date Removed</th>
            <th style={{ width: '80px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayHistory.map(record => (
            <tr key={record._id}>
              <td>
                <div className="fw-bold">{record.personName}</div>
                <div className="small text-muted">
                  ID: {record.personId}
                  <Badge bg={getTypeVariant(record.personType)} className="ms-1">
                    {record.personType.toUpperCase()}
                  </Badge>
                </div>
              </td>
              <td>
                <div><strong>Reason:</strong> {record.banReason}</div>
                <div className="small text-muted">
                  <strong>Duration:</strong> {record.calculatedDuration || (record.banDuration === 'permanent' ? 'Permanent' : 'Custom')}
                </div>
              </td>
              <td>
                <div className="fw-bold">{formatDate(record.createdAt)}</div>
                <div className="small text-muted">{formatTime(record.createdAt)}</div>
              </td>
              <td>
                {record.removedAt ? (
                  <>
                    <div className="fw-bold">{formatDate(record.removedAt)}</div>
                    <div className="small text-muted">{formatTime(record.removedAt)}</div>
                  </>
                ) : (
                  <Badge bg="success">Still Active</Badge>
                )}
              </td>
              <td>
                <div className="d-flex gap-2 justify-content-center">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => openPersonDetailsModal(record)}
                    title="View Details"
                    className="p-1"
                  >
                    <Eye size={16} />
                  </Button>
                  {/* DELETE BUTTON REMOVED */}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };
  
  const renderViolationHistoryTable = () => {
    const displayViolations = violationHistorySearch.trim() ? filteredViolationHistory : violationHistory;
    
    if (violationHistory.length === 0) {
      return (
        <Alert variant="info">
          No violation history found.
        </Alert>
      );
    }

    if (violationHistorySearch.trim() && filteredViolationHistory.length === 0) {
      return (
        <Alert variant="warning">
          No violations match your search criteria.
        </Alert>
      );
    }

    return (
      <Table striped bordered hover responsive className="bg-white">
        <thead className="table-dark">
          <tr>
            <th>Person Details</th>
            <th>Violation Information</th>
            <th>Date Recorded</th>
            <th>Date Removed</th>
            <th style={{ width: '80px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayViolations.map(record => (
            <tr key={record._id}>
              <td>
                <div className="fw-bold">{record.personName}</div>
                <div className="small text-muted">
                  ID: {record.personId}
                  <Badge bg={getTypeVariant(record.personType)} className="ms-1">
                    {record.personType.toUpperCase()}
                  </Badge>
                </div>
              </td>
              <td>
                <div>
                  <Badge bg="danger" className="mb-1">
                    {record.violationType}
                  </Badge>
                </div>
                <div className="small">{record.violationDetails || 'No details provided'}</div>
              </td>
              <td>
                <div className="fw-bold">{formatDate(record.createdAt)}</div>
                <div className="small text-muted">{formatTime(record.createdAt)}</div>
              </td>
              <td>
                {record.removedAt ? (
                  <>
                    <div className="fw-bold">{formatDate(record.removedAt)}</div>
                    <div className="small text-muted">{formatTime(record.removedAt)}</div>
                  </>
                ) : (
                  <Badge bg="warning">Still Active</Badge>
                )}
              </td>
              <td>
                <div className="d-flex gap-2 justify-content-center">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => openPersonDetailsModal(record)}
                    title="View Details"
                    className="p-1"
                  >
                    <Eye size={16} />
                  </Button>
                  {/* DELETE BUTTON REMOVED */}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  const renderHistoryFilters = () => (
    <Card style={{ 
        backgroundColor: '#676767a7', 
        borderRadius: '12px', marginBottom: '20px', 
        borderLeft: '4px solid #FFD700', 
        borderRight: '4px solid #FFD700',}}>
      <Card.Header style={{backgroundColor: '#67676741'}}>
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <Filter size={18} className="me-2" />
            <h6 className="mb-0" style={{ color: '#FFD700' }}>Filter History Records</h6>
          </div>
          <Button 
                                  variant="outline-secondary" 
                                  onClick={clearFilters}
                                  style={{
                                    color: 'black',
                                    backgroundColor: '#FFD700',
                                    borderColor: '#FFD700'
                                  }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = '#e15c5cd0'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = '#FFD700'}
                                >
                                  Clear Filters
                                </Button>
        </div>
      </Card.Header>
      <Card.Body>
        <Row className="g-3">
          {activeTab === 'violation-history' && (
            <Col md={12}>
              <Form.Group>
                <Form.Label style={{ color: '#ffffff' }}>
                  <Search size={14} className="me-1" />
                  Search Violation History
                </Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <Search size={16} />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search by name, ID, violation type, details, or person type..."
                    value={violationHistorySearch}
                    onChange={(e) => setViolationHistorySearch(e.target.value)}
                    style={{ backgroundColor: 'white' }}
                  />
                  {violationHistorySearch && (
                    <Button 
                      variant="outline-secondary"
                      onClick={() => setViolationHistorySearch('')}
                    >
                      Clear
                    </Button>
                  )}
                </InputGroup>
                {violationHistorySearch && (
                  <Form.Text className="text-muted">
                    Found {filteredViolationHistory.length} of {violationHistory.length} records
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
          )}
          {activeTab === 'ban-history' && (
            <Col md={12}>
              <Form.Group>
                <Form.Label style={{ color: '#ffffff' }}>
                  <Search size={14} className="me-1" />
                  Search Ban History
                </Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <Search size={16} />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search by name, ID, reason, or type..."
                    value={banHistorySearch}
                    onChange={(e) => setBanHistorySearch(e.target.value)}
                    style={{ backgroundColor: 'white' }}
                  />
                  {banHistorySearch && (
                    <Button 
                      variant="outline-secondary"
                      onClick={() => setBanHistorySearch('')}
                    >
                      Clear
                    </Button>
                  )}
                </InputGroup>
                {banHistorySearch && (
                  <Form.Text className="text-muted">
                    Found {filteredBanHistory.length} of {banHistory.length} records
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
          )}
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ color: '#ffffff' }}>
                <Calendar size={14} className="me-1" />
                Start Date
              </Form.Label>
              <Form.Control
                type="date"
                value={historyFilter.startDate}
                onChange={(e) => setHistoryFilter({...historyFilter, startDate: e.target.value})}
                style={{ backgroundColor: 'white' }}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ color: '#ffffff' }}>
                <Calendar size={14} className="me-1" />
                End Date
              </Form.Label>
              <Form.Control
                type="date"
                value={historyFilter.endDate}
                onChange={(e) => setHistoryFilter({...historyFilter, endDate: e.target.value})}
                style={{ backgroundColor: 'white' }}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label style={{ color: '#ffffff' }}>Person Type</Form.Label>
              <Form.Select 
                value={historyFilter.personType} 
                onChange={(e) => setHistoryFilter({...historyFilter, personType: e.target.value})}
                style={{ backgroundColor: 'white' }}
              >
                <option value="">All Types</option>
                <option value="visitor">Visitor</option>
                <option value="guest">Guest</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={3} className="d-flex align-items-end">
            <Button 
              variant="primary" 
              onClick={activeTab === 'ban-history' ? fetchBanHistory : fetchViolationHistory}
              className="w-100"
              style={{ backgroundColor: '#FFD700', borderColor: '#FFD700', color: 'black' }}
            >
              <RefreshCw size={16} className="me-1" />
              Apply
            </Button>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );

  return (
    <Container>
      <style dangerouslySetInnerHTML={{__html: `
          .form-label,
          label {
            color: #ffffff !important;
          }
          .form-control,
          .form-select {
            color: #000000 !important;
          }
          ::placeholder {
            color: #666666 !important;
          }
          .table tbody td,
          .table tbody td * {
            color: #ffffff !important;
          }
          .table tbody td .badge,
          .table tbody td .badge * {
            color: #000000 !important;
          }
          .table tbody td button,
          .table tbody td button *,
          .table tbody td svg {
            color: #FFD700 !important;
          }
        `}} />
      <ToastContainer />
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: "600", color: "#2c3e50" }}>
            📋 Visit History & Records
          </h2>
          <p className="small" style={{ color: '#ffd9009a' }}>View and manage all visit records, violations, and bans</p>
        </div>
        <Button 
          variant="outline-dark" 
          onClick={exportToCSV} 
          disabled={
            (activeTab === 'all' && filteredLogs.length === 0) ||
            (activeTab === 'visitors' && filteredLogs.length === 0) ||
            (activeTab === 'guests' && filteredLogs.length === 0) ||
            (activeTab === 'violation-history' && violationHistory.length === 0) ||
            (activeTab === 'banned' && banned.length === 0) ||
            (activeTab === 'ban-history' && banHistory.length === 0)
          }
        >
          <Download size={16} className="me-1" />
          Export CSV
        </Button>
      </div>

      <Card className="mb-4 border-0">
        <Card.Body className="p-0">
          <Tabs
            activeKey={activeTab}
            onSelect={(tab) => setActiveTab(tab)}
            className="mb-3"
          >
            <Tab eventKey="all" title={
              <span>
                <Users size={16} className="me-1" />
                All Visits <Badge bg="primary" className="ms-1">{counts.all}</Badge>
              </span>
            }>
              <Card style={{ 
        backgroundColor: '#676767a7', 
        borderRadius: '12px', marginBottom: '20px', 
        borderLeft: '4px solid #FFD700', 
        borderRight: '4px solid #FFD700',}}>
                <Card.Header style={{backgroundColor: '#67676741'}}>
                  <div className="d-flex align-items-center">
                    <Filter size={18} className="me-2" />
                    <h6 className="mb-0" style={{color: '#FFD700'}}>Filter Visit Records</h6>
                  </div>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{ color: '#ffffff' }}>
                          <Calendar size={14} className="me-1" />
                          Start Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          style={{ backgroundColor: 'white' }}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{ color: '#ffffff' }}>
                          <Calendar size={14} className="me-1" />
                          End Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          style={{ backgroundColor: 'white' }}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label style={{ color: '#ffffff' }}>
                          <Search size={14} className="me-1" />
                          Search
                        </Form.Label>
                        <InputGroup>
                          <Form.Control
                            type="text"
                            placeholder="Search visit records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ backgroundColor: 'white' }}
                          />
                          <Form.Select 
                            value={searchBy} 
                            onChange={(e) => setSearchBy(e.target.value)}
                            style={{ maxWidth: '150px', backgroundColor: 'white' }}
                          >
                            {searchOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Form.Select>
                        </InputGroup>
                      </Form.Group>
                    </Col>
                    <Col md={2} className="d-flex align-items-end">
                      <Button 
                                              variant="outline-secondary" 
                                              onClick={clearFilters}
                                              className="w-100"
                                              style={{
                                                color: 'black',
                                                backgroundColor: '#FFD700',
                                                borderColor: '#FFD700'
                                              }}
                                              onMouseEnter={(e) => e.target.style.backgroundColor = '#e15c5cd0'}
                                              onMouseLeave={(e) => e.target.style.backgroundColor = '#FFD700'}
                                            >
                                              Clear Filters
                                            </Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {isLoading ? (
                <div className="text-center">
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading visit records...</span>
                  </Spinner>
                  <p className="mt-2">Loading visit records...</p>
                </div>
              ) : renderVisitTable(filteredLogs)}
            </Tab>

            <Tab eventKey="visitors" title={
              <span>
                <User size={16} className="me-1" />
                Visitors <Badge bg="info" className="ms-1">{counts.visitors}</Badge>
              </span>
            }>
              <Card style={{ 
        backgroundColor: '#676767a7', 
        borderRadius: '12px', marginBottom: '20px', 
        borderLeft: '4px solid #FFD700', 
        borderRight: '4px solid #FFD700',}}>
                <Card.Header style={{backgroundColor: '#67676741'}}>
                  <div className="d-flex align-items-center">
                    <Filter size={18} className="me-2" />
                    <h6 className="mb-0" style={{color: '#FFD700'}}>Filter Visitor Records</h6>
                  </div>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{ color: '#ffffff' }}>
                          <Calendar size={14} className="me-1" />
                          Start Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          style={{ backgroundColor: 'white' }}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{ color: '#ffffff' }}>
                          <Calendar size={14} className="me-1" />
                          End Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          style={{ backgroundColor: 'white' }}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label style={{ color: '#ffffff' }}>
                          <Search size={14} className="me-1" />
                          Search
                        </Form.Label>
                        <InputGroup>
                          <Form.Control
                            type="text"
                            placeholder="Search visitor records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ backgroundColor: 'white' }}
                          />
                          <Form.Select 
                            value={searchBy} 
                            onChange={(e) => setSearchBy(e.target.value)}
                            style={{ maxWidth: '150px', backgroundColor: 'white' }}
                          >
                            {searchOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Form.Select>
                        </InputGroup>
                      </Form.Group>
                    </Col>
                    <Col md={2} className="d-flex align-items-end">
                      <Button 
                                              variant="outline-secondary" 
                                              onClick={clearFilters}
                                              className="w-100"
                                              style={{
                                                color: 'black',
                                                backgroundColor: '#FFD700',
                                                borderColor: '#FFD700'
                                              }}
                                              onMouseEnter={(e) => e.target.style.backgroundColor = '#e15c5cd0'}
                                              onMouseLeave={(e) => e.target.style.backgroundColor = '#FFD700'}
                                            >
                                              Clear Filters
                                            </Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {isLoading ? (
                <div className="text-center">
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading visitor records...</span>
                  </Spinner>
                  <p className="mt-2">Loading visitor records...</p>
                </div>
              ) : renderVisitTable(filteredLogs)}
            </Tab>

            <Tab eventKey="guests" title={
              <span>
                <Users size={16} className="me-1" />
                Guests <Badge bg="secondary" className="ms-1">{counts.guests}</Badge>
              </span>
            }>
              <Card style={{ 
        backgroundColor: '#676767a7', 
        borderRadius: '12px', marginBottom: '20px', 
        borderLeft: '4px solid #FFD700', 
        borderRight: '4px solid #FFD700',}}>
                <Card.Header style={{backgroundColor: '#67676741'}}>
                  <div className="d-flex align-items-center">
                    <Filter size={18} className="me-2" />
                    <h6 className="mb-0" style={{color: '#FFD700'}}>Filter Guest Records</h6>
                  </div>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{ color: '#ffffff' }}>
                          <Calendar size={14} className="me-1" />
                          Start Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          style={{ backgroundColor: 'white' }}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{ color: '#ffffff' }}>
                          <Calendar size={14} className="me-1" />
                          End Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          style={{ backgroundColor: 'white' }}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label style={{ color: '#ffffff' }}>
                          <Search size={14} className="me-1" />
                          Search
                        </Form.Label>
                        <InputGroup>
                          <Form.Control
                            type="text"
                            placeholder="Search guest records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ backgroundColor: 'white' }}
                          />
                          <Form.Select 
                            value={searchBy} 
                            onChange={(e) => setSearchBy(e.target.value)}
                            style={{ maxWidth: '150px', backgroundColor: 'white' }}
                          >
                            {searchOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Form.Select>
                        </InputGroup>
                      </Form.Group>
                    </Col>
                    <Col md={2} className="d-flex align-items-end">
                      <Button 
                                              variant="outline-secondary" 
                                              onClick={clearFilters}
                                              className="w-100"
                                              style={{
                                                color: 'black',
                                                backgroundColor: '#FFD700',
                                                borderColor: '#FFD700'
                                              }}
                                              onMouseEnter={(e) => e.target.style.backgroundColor = '#e15c5cd0'}
                                              onMouseLeave={(e) => e.target.style.backgroundColor = '#FFD700'}
                                            >
                                              Clear Filters
                                            </Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {isLoading ? (
                <div className="text-center">
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading guest records...</span>
                  </Spinner>
                  <p className="mt-2">Loading guest records...</p>
                </div>
              ) : renderVisitTable(filteredLogs)}
            </Tab>

            <Tab eventKey="violation-history" title={
              <span>
                <AlertTriangle size={16} className="me-1" />
                Violations <Badge bg="warning" className="ms-1">{violationHistory.length}</Badge>
              </span>
            }>
              {renderHistoryFilters()}
              {renderViolationHistoryTable()}
            </Tab>

            <Tab eventKey="banned" title={
              <span>
                <Slash size={16} className="me-1" />
                Banned <Badge bg="dark" className="ms-1">{counts.banned}</Badge>
              </span>
            }>
              {renderBannedTable()}
            </Tab>

            <Tab eventKey="ban-history" title={
              <span>
                <Slash size={16} className="me-1" />
                Ban History <Badge bg="secondary" className="ms-1">{banHistory.length}</Badge>
              </span>
            }>
              {renderHistoryFilters()}
              {renderBanHistoryTable()}
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      {/* View Details Modal - COMPLETE CONTENT */}
      <Modal 
        show={showDetailsModal} 
        onHide={() => setShowDetailsModal(false)} 
        size="lg"
        style={{ maxHeight: "85vh", top: "10vh" }}
        contentClassName="modal-content-scrollable"
      >
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-5">
            <Eye size={18} className="me-2" />
            {selectedLog ? 'Visit Details' : 
             selectedPerson?.banReason ? 'Ban Record Details' :
             selectedPerson?.violationType ? 'Violation Record Details' : 
             'Person Details'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
          
          {/* VISIT LOG DETAILS */}
          {selectedLog && (
            <>
              <Row>
                <Col md={6}>
                  <Card className="mb-2">
                    <Card.Header className="py-2">
                      <strong className="small">Visit Information</strong>
                    </Card.Header>
                    <Card.Body className="py-2">
                      <p className="mb-1 small"><strong>Visit Date:</strong> {formatDate(selectedLog.visitDate)}</p>
                      <p className="mb-1 small"><strong>Day:</strong> {new Date(selectedLog.visitDate).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                      <p className="mb-1 small"><strong>Time In:</strong> <Badge bg="success" className="small">{formatTime(selectedLog.timeIn)}</Badge></p>
                      <p className="mb-1 small"><strong>Time Out:</strong> {selectedLog.timeOut ? <Badge bg="secondary" className="small">{formatTime(selectedLog.timeOut)}</Badge> : <Badge bg="warning" className="small">Not checked out</Badge>}</p>
                      <p className="mb-1 small"><strong>Duration:</strong> {selectedLog.visitDuration || 'N/A'}</p>
                      <p className="mb-1 small"><strong>Type:</strong> <Badge bg={getTypeVariant(selectedLog.personType)} className="small">{selectedLog.personType.toUpperCase()}</Badge></p>
                      <p className="mb-1 small"><strong>Status:</strong> <Badge bg={getStatusVariant(selectedLog.status)} className="small">{selectedLog.status.toUpperCase()}</Badge></p>
                      {selectedLog.isTimerActive && (
                        <p className="mb-1 small"><strong>Timer:</strong> <Badge bg="warning" className="small">ACTIVE</Badge></p>
                      )}
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6}>
                  <Card className="mb-2">
                    <Card.Header className="py-2">
                      <strong className="small">Person Information</strong>
                    </Card.Header>
                    <Card.Body className="py-2">
                      <p className="mb-1 small"><strong>Name:</strong> {selectedLog.personName}</p>
                      <p className="mb-1 small"><strong>ID:</strong> <code>{selectedLog.personId}</code></p>
                      <p className="mb-1 small"><strong>Type:</strong> <Badge bg={getTypeVariant(selectedLog.personType)} className="small">{selectedLog.personType.toUpperCase()}</Badge></p>
                      {selectedLog.personType === 'guest' && (
                        <p className="mb-1 small"><strong>Visit Purpose:</strong> {selectedLog.visitPurpose || 'General Visit'}</p>
                      )}
                      <p className="mb-1 small"><strong>Record ID:</strong> <small className="text-muted">{selectedLog._id}</small></p>
                    </Card.Body>
                  </Card>

                  {selectedLog.prisonerId && (
                    <Card className="mb-2">
                      <Card.Header className="py-2">
                        <strong className="small">PDL Information</strong>
                      </Card.Header>
                      <Card.Body className="py-2">
                        <p className="mb-1 small"><strong>PDL Name:</strong> {selectedLog.inmateName}</p> 
                        <p className="mb-1 small"><strong>PDL ID:</strong> <Badge bg="dark" className="small">{selectedLog.prisonerId}</Badge></p>
                      </Card.Body>
                    </Card>
                  )}
                </Col>
              </Row>

              <Card>
                <Card.Header className="py-2">
                  <strong className="small">System Information</strong>
                </Card.Header>
                <Card.Body className="py-2">
                  <Row>
                    <Col md={6}>
                      <p className="mb-1 small"><strong>Record Created:</strong> {selectedLog.createdAt ? formatDateTime(selectedLog.createdAt) : 'N/A'}</p>
                    </Col>
                    <Col md={6}>
                      <p className="mb-1 small"><strong>Last Updated:</strong> {selectedLog.updatedAt ? formatDateTime(selectedLog.updatedAt) : 'N/A'}</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </>
          )}

          {/* PERSON DETAILS (Violators, Banned, History Records) */}
          {selectedPerson && (
            <>
              <Row>
                <Col md={6}>
                  <Card className="mb-2">
                    <Card.Header className="py-2">
                      <strong className="small">Personal Information</strong>
                    </Card.Header>
                    <Card.Body className="py-2">
                      <p className="mb-1 small"><strong>Full Name:</strong> {selectedPerson.personName || selectedPerson.fullName}</p>
                      <p className="mb-1 small"><strong>Person ID:</strong> <code>{selectedPerson.id || selectedPerson.personId}</code></p>
                      <p className="mb-1 small"><strong>Type:</strong> <Badge bg={getTypeVariant(selectedPerson.personType)} className="small">{selectedPerson.personType?.toUpperCase() || 'UNKNOWN'}</Badge></p>
                      {selectedPerson.email && (
                        <p className="mb-1 small"><strong>Email:</strong> {selectedPerson.email}</p>
                      )}
                      {selectedPerson.phone && (
                        <p className="mb-1 small"><strong>Phone:</strong> {selectedPerson.phone}</p>
                      )}
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6}>
                  <Card className="mb-2">
                    <Card.Header className={
                      selectedPerson.isBanned || selectedPerson.banReason ? 'py-2 bg-danger text-white' : 
                      selectedPerson.violationType ? 'py-2 bg-warning text-dark' : 'py-2 bg-success text-white'
                    }>
                      <strong className="small">
                        {selectedPerson.isBanned || selectedPerson.banReason ? 'Ban Information' : 
                         selectedPerson.violationType ? 'Violation Information' : 'Status Information'}
                      </strong>
                    </Card.Header>
                    <Card.Body className="py-2">
                      {selectedPerson.isBanned || selectedPerson.banReason ? (
                        <>
                          <p className="mb-1 small"><strong>Ban Status:</strong> <Badge bg="danger" className="small">BANNED</Badge></p>
                          <p className="mb-1 small"><strong>Ban Reason:</strong> {selectedPerson.banReason || 'No reason provided'}</p>
                          <p className="mb-1 small"><strong>Duration:</strong> <Badge bg="warning" className="small">{selectedPerson.calculatedDuration || (selectedPerson.banDuration === 'permanent' ? 'Permanent' : 'Custom')}</Badge></p>
                          {selectedPerson.banStartDate && (
                            <p className="mb-1 small"><strong>Start Date:</strong> {formatDate(selectedPerson.banStartDate)}</p>
                          )}
                          {selectedPerson.banEndDate && (
                            <p className="mb-1 small"><strong>End Date:</strong> {formatDate(selectedPerson.banEndDate)}</p>
                          )}
                          {selectedPerson.banNotes && (
                            <p className="mb-1 small"><strong>Notes:</strong> {selectedPerson.banNotes}</p>
                          )}
                        </>
                      ) : selectedPerson.violationType ? (
                        <>
                          <p className="mb-1 small"><strong>Violation Type:</strong> <Badge bg="danger" className="small">{selectedPerson.violationType}</Badge></p>
                          <p className="mb-1 small"><strong>Details:</strong> {selectedPerson.violationDetails || 'No details provided'}</p>
                          <p className="mb-1 small"><strong>Status:</strong> {selectedPerson.removedAt ? <Badge bg="secondary" className="small">RESOLVED</Badge> : <Badge bg="warning" className="small">ACTIVE</Badge>}</p>
                        </>
                      ) : (
                        <p className="mb-0 small text-success">No violations or bans recorded</p>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Card className="mb-2">
                <Card.Header className="py-2">
                  <strong className="small">Record Timeline</strong>
                </Card.Header>
                <Card.Body className="py-2">
                  <Row>
                    <Col md={6}>
                      <p className="mb-1 small"><strong>Date {selectedPerson.banReason ? 'Banned' : 'Recorded'}:</strong> {formatDateTime(selectedPerson.createdAt)}</p>
                      {selectedPerson.bannedBy && (
                        <p className="mb-1 small"><strong>Banned By:</strong> {selectedPerson.bannedBy}</p>
                      )}
                      {selectedPerson.recordedBy && (
                        <p className="mb-1 small"><strong>Recorded By:</strong> {selectedPerson.recordedBy}</p>
                      )}
                    </Col>
                    <Col md={6}>
                      {selectedPerson.removedAt ? (
                        <>
                          <p className="mb-1 small"><strong>Date Removed:</strong> {formatDateTime(selectedPerson.removedAt)}</p>
                          {selectedPerson.removedBy && (
                            <p className="mb-1 small"><strong>Removed By:</strong> {selectedPerson.removedBy}</p>
                          )}
                          {selectedPerson.removalReason && (
                            <p className="mb-1 small"><strong>Removal Reason:</strong> {selectedPerson.removalReason}</p>
                          )}
                        </>
                      ) : (
                        <p className="mb-1 small"><strong>Status:</strong> <Badge bg="success" className="small">Currently Active</Badge></p>
                      )}
                    </Col>
                  </Row>
                  
                  {/* Ban Schedule Information for active bans */}
                  {selectedPerson.banStartDate && selectedPerson.banEndDate && !selectedPerson.removedAt && (
                    <div className="mt-2 p-2 bg-light rounded">
                      <h6 className="mb-2 small">Scheduled Ban Period</h6>
                      <Row>
                        <Col md={6}>
                          <p className="mb-1 small"><strong>Start Date:</strong> {formatDate(selectedPerson.banStartDate)}</p>
                        </Col>
                        <Col md={6}>
                          <p className="mb-1 small"><strong>End Date:</strong> {formatDate(selectedPerson.banEndDate)}</p>
                        </Col>
                      </Row>
                      {selectedPerson.calculatedDuration && (
                        <p className="mb-0 small"><strong>Planned Duration:</strong> {selectedPerson.calculatedDuration}</p>
                      )}
                    </div>
                  )}
                </Card.Body>
              </Card>

              {/* Additional Information */}
              {(selectedPerson.banNotes || selectedPerson.violationNotes) && (
                <Card className="mb-2">
                  <Card.Header className="py-2">
                    <strong className="small">Additional Information</strong>
                  </Card.Header>
                  <Card.Body className="py-2">
                    {selectedPerson.banNotes && (
                      <div className="mb-2">
                        <p className="mb-1 small"><strong>Ban Notes:</strong></p>
                        <p className="mb-0 small p-2 bg-light rounded">{selectedPerson.banNotes}</p>
                      </div>
                    )}
                    {selectedPerson.violationNotes && (
                      <div>
                        <p className="mb-1 small"><strong>Violation Notes:</strong></p>
                        <p className="mb-0 small p-2 bg-light rounded">{selectedPerson.violationNotes}</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              )}

              <Card>
                <Card.Header className="py-2">
                  <strong className="small">System Information</strong>
                </Card.Header>
                <Card.Body className="py-2">
                  <Row>
                    <Col md={6}>
                      <p className="mb-1 small"><strong>Record ID:</strong> <small className="text-muted">{selectedPerson._id || selectedPerson.id}</small></p>
                      <p className="mb-1 small"><strong>Created:</strong> {selectedPerson.createdAt ? formatDateTime(selectedPerson.createdAt) : 'N/A'}</p>
                    </Col>
                    <Col md={6}>
                      <p className="mb-1 small"><strong>Last Updated:</strong> {selectedPerson.updatedAt ? formatDateTime(selectedPerson.updatedAt) : 'N/A'}</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <div>
            {selectedPerson && (selectedPerson.isBanned || selectedPerson.violationType) && !selectedPerson.removedAt && (
              <Button 
                variant="outline-primary" 
                size="sm"
                onClick={() => {
                  if (selectedPerson.isBanned || selectedPerson.banReason) {
                    openEditBanModal(selectedPerson);
                  } else if (selectedPerson.violationType) {
                    openEditViolationModal(selectedPerson);
                  }
                  setShowDetailsModal(false);
                }}
              >
                <Edit size={16} className="me-1" />
                Edit Record
              </Button>
            )}
          </div>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add/Edit Violation Modal */}
      <Modal 
        show={showViolationModal} 
        onHide={() => setShowViolationModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <AlertTriangle size={20} className="me-2 text-warning" />
            {isEditingViolation ? 'Edit Violation' : 'Add Violation'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Violation Type *</Form.Label>
              <Form.Select 
                value={violationForm.violationType} 
                onChange={(e) => setViolationForm({...violationForm, violationType: e.target.value})}
              >
                <option value="">Select violation type</option>
                {violationTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Violation Details</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={3} 
                placeholder="Enter violation details..." 
                value={violationForm.violationDetails}
                onChange={(e) => setViolationForm({...violationForm, violationDetails: e.target.value})}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViolationModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="warning" 
            onClick={isEditingViolation ? handleEditViolation : handleAddViolation}
          >
            {isEditingViolation ? 'Update Violation' : 'Add Violation'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add/Edit Ban Modal */}
      <Modal 
        show={showBanModal} 
        onHide={() => setShowBanModal(false)}
        size="lg"
        centered
        style={{ maxHeight: "85vh", top: "10vh" }}
        contentClassName="modal-content-scrollable"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <Slash size={20} className="me-2 text-danger" />
            {isEditingBan ? 'Edit Ban' : 'Ban Person'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Ban Reason *</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={3} 
                placeholder="Enter ban reason..." 
                value={banForm.reason}
                onChange={(e) => setBanForm({...banForm, reason: e.target.value})}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Ban Type</Form.Label>
              <Form.Select 
                value={banForm.durationType} 
                onChange={(e) => {
                  const durationType = e.target.value;
                  setBanForm({
                    ...banForm, 
                    durationType: durationType,
                    banStartDate: durationType === 'permanent' ? '' : banForm.banStartDate,
                    banEndDate: durationType === 'permanent' ? '' : banForm.banEndDate,
                    calculatedDuration: durationType === 'permanent' ? '' : banForm.calculatedDuration
                  });
                }}
              >
                <option value="temporary">Temporary Ban</option>
                <option value="permanent">Permanent Ban</option>
              </Form.Select>
            </Form.Group>

            {banForm.durationType === 'temporary' && (
              <>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Ban Start Date *</Form.Label>
                      <Form.Control
                        type="date"
                        name="banStartDate"
                        value={banForm.banStartDate}
                        onChange={(e) => {
                          const startDate = e.target.value;
                          setBanForm({
                            ...banForm,
                            banStartDate: startDate,
                            calculatedDuration: startDate && banForm.banEndDate 
                              ? calculateBanDuration(startDate, banForm.banEndDate)
                              : ''
                          });
                        }}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Ban End Date *</Form.Label>
                      <Form.Control
                        type="date"
                        name="banEndDate"
                        value={banForm.banEndDate}
                        onChange={(e) => {
                          const endDate = e.target.value;
                          setBanForm({
                            ...banForm,
                            banEndDate: endDate,
                            calculatedDuration: banForm.banStartDate && endDate
                              ? calculateBanDuration(banForm.banStartDate, endDate)
                              : ''
                          });
                        }}
                        min={banForm.banStartDate}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>
                    Ban Duration 
                    {banForm.banStartDate && banForm.banEndDate && !banForm.calculatedDuration?.includes('Invalid') && (
                      <Badge bg="success" className="ms-2" style={{ fontSize: '0.6rem' }}>
                        Auto-calculated
                      </Badge>
                    )}
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="calculatedDuration"
                    value={banForm.calculatedDuration}
                    onChange={(e) => setBanForm({...banForm, calculatedDuration: e.target.value})}
                    placeholder="e.g., 3 months 15 days"
                    readOnly={!!(banForm.banStartDate && banForm.banEndDate)}
                    className={banForm.calculatedDuration?.includes('Invalid') ? 'border-danger' : ''}
                  />
                  <Form.Text className="text-muted">
                    {banForm.banStartDate && banForm.banEndDate 
                      ? `Auto-calculated: ${banForm.calculatedDuration}`
                      : 'Enter manually or set Start/End dates to auto-calculate'
                    }
                    {banForm.calculatedDuration?.includes('Invalid') && (
                      <div className="text-danger small mt-1">
                        Please ensure end date is after start date
                      </div>
                    )}
                  </Form.Text>
                </Form.Group>
              </>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Additional Notes</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={2} 
                placeholder="Enter additional notes..." 
                value={banForm.notes}
                onChange={(e) => setBanForm({...banForm, notes: e.target.value})}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBanModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={isEditingBan ? handleEditBan : handleAddBan}
            disabled={
              !banForm.reason || 
              (banForm.durationType === 'temporary' && 
               (!banForm.banStartDate || !banForm.banEndDate || banForm.calculatedDuration?.includes('Invalid')))
            }
          >
            {isEditingBan ? 'Update Ban' : 'Ban Person'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ViewRecordVisits;