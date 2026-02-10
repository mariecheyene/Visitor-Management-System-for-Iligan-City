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
  Trash2,
  AlertTriangle,
  Slash,
  Edit,
  CheckCircle,
  Eye,
  Users,
  RefreshCw,
  Clock
} from 'react-feather';

const RecordVisits = () => {
  const [visitLogs, setVisitLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [violators, setViolators] = useState([]);
  const [banned, setBanned] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inmates, setInmates] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  
  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBy, setSearchBy] = useState('personName');

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);

  // Form states
  const [violationForm, setViolationForm] = useState({
    violationType: '',
    violationDetails: ''
    // REMOVED: additionalNotes field
  });
  // UPDATED: Ban form state (matches inmate form structure)
const [banForm, setBanForm] = useState({
  reason: '',
  banStartDate: new Date().toISOString().split('T')[0], // Today as default (like inmate)
  banEndDate: '',
  calculatedDuration: '', // Auto-calculated field (like inmate sentence)
  durationType: 'temporary', // 'temporary' or 'permanent'
  notes: ''
});

  // Counts state
  const [counts, setCounts] = useState({
    all: 0,
    visitors: 0,
    guests: 0,
    violators: 0,
    banned: 0
  });

  // History states
  const [banHistory, setBanHistory] = useState([]);
  const [violationHistory, setViolationHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState({
    startDate: '',
    endDate: '',
    personType: '',
    searchQuery: ''
  });

  // Banned filter states
  const [bannedFilter, setBannedFilter] = useState({
    personType: '',
    searchQuery: '',
    searchBy: 'personName'
  });
  const [filteredBanned, setFilteredBanned] = useState([]);

  const API_BASE = 'http://localhost:5001';

  const searchOptions = [
    { value: 'personName', label: 'Person Name' },
    { value: 'personId', label: 'Person ID' },
    { value: 'inmateName', label: 'PDL Name' },
    { value: 'prisonerId', label: 'Prisoner ID' },
    { value: 'personType', label: 'Type' }
  ];

  const guestSearchOptions = [
    { value: 'personName', label: 'Person Name' },
    { value: 'personType', label: 'Type' },
    { value: 'visitPurpose', label: 'Visit Purpose' }
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
    fetchViolators();
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
      violators: violators.length,
      banned: banned.length
    });
  }, [visitLogs, violators, banned]);

  useEffect(() => {
    if (activeTab === 'ban-history' || activeTab === 'violation-history') {
      fetchBanHistory();
      fetchViolationHistory();
    }
  }, [historyFilter, activeTab]);

  // Filter banned records
  useEffect(() => {
    let filtered = banned;

    if (bannedFilter.personType) {
      filtered = filtered.filter(person => person.personType === bannedFilter.personType);
    }

    if (bannedFilter.searchQuery.trim()) {
      const query = bannedFilter.searchQuery.toLowerCase();
      filtered = filtered.filter(person => {
        switch (bannedFilter.searchBy) {
          case 'personName':
            return person.personName?.toLowerCase().includes(query);
          case 'personId':
            return person.id?.toLowerCase().includes(query);
          case 'banReason':
            return person.banReason?.toLowerCase().includes(query);
          default:
            return true;
        }
      });
    }

    setFilteredBanned(filtered);
  }, [banned, bannedFilter]);

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
      console.error('Error fetching inmates:', error);
    }
  };

  const fetchViolators = async () => {
    try {
      const [visitorsRes, guestsRes] = await Promise.all([
        axios.get(`${API_BASE}/visitors`),
        axios.get(`${API_BASE}/guests`)
      ]);
      
      // Only show violators who are NOT banned and have violations
      const visitorsWithViolations = visitorsRes.data
        .filter(visitor => 
          visitor.violationType && 
          visitor.violationType.trim() !== '' &&
          visitor.isBanned !== true
        )
        .map(visitor => ({
          ...visitor,
          personType: 'visitor',
          personName: visitor.fullName,
          id: visitor.id
        }));
      
      const guestsWithViolations = guestsRes.data
        .filter(guest => 
          guest.violationType && 
          guest.violationType.trim() !== '' &&
          guest.isBanned !== true
        )
        .map(guest => ({
          ...guest,
          personType: 'guest',
          personName: guest.fullName,
          id: guest.id
        }));
      
      const allViolators = [...visitorsWithViolations, ...guestsWithViolations];
      setViolators(allViolators);
    } catch (error) {
      console.error('Error fetching violators:', error);
      toast.error('Failed to fetch violators');
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
        // NEW: Include the date-based fields
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
        // NEW: Include the date-based fields
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
      if (historyFilter.searchQuery) params.append('search', historyFilter.searchQuery);

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
      if (historyFilter.searchQuery) params.append('search', historyFilter.searchQuery);

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
          case 'inmateName':
            return log.inmateName?.toLowerCase().includes(query);
          case 'prisonerId':
            return log.prisonerId?.toLowerCase().includes(query);
          case 'personType':
            return log.personType?.toLowerCase().includes(query);
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
      searchQuery: ''
    });
  };

  const clearBannedFilters = () => {
    setBannedFilter({
      personType: '',
      searchQuery: '',
      searchBy: 'personName'
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

  // Calculate ban end date
const calculateBanDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return '';
  
  const from = new Date(startDate);
  const to = new Date(endDate);
  
  // Check if endDate is after startDate (EXACTLY LIKE INMATES)
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

// FIXED: Get ban duration display text - NOW SHOWS CALCULATED TIME FOR ALL DURATION TYPES
const getBanDurationDisplay = (person) => {
  if (person.banDuration === 'permanent') {
    return 'Permanent';
  }
  
  // For ALL durations - calculate time remaining
  const now = new Date();
  let endDate;
  
  if (person.banDuration === 'custom' && person.banEndDate) {
    // Use the stored custom end date
    endDate = new Date(person.banEndDate);
  } else {
    // Calculate end date based on duration type
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

  // Modal functions
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

  const openDeleteModal = (log) => {
    setSelectedLog(log);
    setShowDeleteModal(true);
  };

  const openViolationModal = (log) => {
    setSelectedLog(log);
    setSelectedPerson(null);
    setViolationForm({
      violationType: '',
      violationDetails: ''
      // REMOVED: additionalNotes
    });
    setShowViolationModal(true);
  };

  // UPDATED: Open ban modal with proper date initialization
const openBanModal = (log) => {
  setSelectedLog(log);
  setSelectedPerson(null);
  setBanForm({
    reason: '',
    banStartDate: new Date().toISOString().split('T')[0], // Today as default
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
      // REMOVED: additionalNotes
    });
    setShowViolationModal(true);
  };

  // UPDATED: Open edit ban modal with existing data
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

  const handleDeleteLog = async (logId) => {
    try {
      await axios.delete(`${API_BASE}/visit-logs/${logId}`);
      toast.success("Visit record deleted successfully");
      setShowDeleteModal(false);
      setSelectedLog(null);
      fetchVisitLogs();
    } catch (error) {
      console.error("Error deleting visit log:", error);
      toast.error("Failed to delete visit record");
    }
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
        // REMOVED: violationNotes
      };
      
      console.log('🔄 Adding violation to:', endpoint);
      console.log('📦 Violation data:', violationData);
      
      const response = await axios.put(endpoint, violationData);
      console.log('✅ Violation response:', response.data);
      
      toast.success("Violation added successfully");
      setShowViolationModal(false);
      setSelectedLog(null);
      fetchViolators();
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
        // REMOVED: violationNotes
      };
      
      await axios.put(endpoint, violationData);
      
      toast.success("Violation updated successfully");
      setShowViolationModal(false);
      setSelectedPerson(null);
      fetchViolators();
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
    
    // Refresh data
    fetchViolators();
    fetchViolationHistory(); // Refresh history to show removal date
    
  } catch (error) {
    console.error("❌ Error removing violation:", error);
    console.error("📋 Error details:", error.response?.data);
    toast.error(`Failed to remove violation: ${error.response?.data?.message || error.message}`);
  }
};

  // UPDATED: Frontend ban function that matches backend expectations
const handleAddBan = async () => {
  if (!banForm.reason) {
    toast.error("Please provide a ban reason");
    return;
  }

  if (banForm.durationType === 'temporary' && (!banForm.banStartDate || !banForm.banEndDate)) {
    toast.error("Please provide both start and end dates for temporary ban");
    return;
  }

  // Validate dates for temporary ban
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
    
    // UPDATED: Match backend expected format exactly
    const banData = {
      reason: banForm.reason,
      duration: banForm.durationType === 'permanent' ? 'permanent' : 'custom',
      notes: banForm.notes,
      isBanned: true,
      bannedBy: 'System', // Add this required field
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
    
    // Refresh data
    fetchBanned();
    fetchViolators();
    fetchVisitLogs();
    fetchBanHistory();
    
  } catch (error) {
    console.error("❌ Error adding ban:", error);
    console.error("📋 Error details:", error.response?.data);
    toast.error(`Failed to ban person: ${error.response?.data?.message || error.message}`);
  }
};

// UPDATED: Edit ban function
const handleEditBan = async () => {
  if (!banForm.reason) {
    toast.error("Please provide a ban reason");
    return;
  }

  try {
    const endpoint = selectedPerson.personType === 'visitor' 
      ? `${API_BASE}/visitors/${selectedPerson.id}/ban`
      : `${API_BASE}/guests/${selectedPerson.id}/ban`;
    
    // UPDATED: Match backend expected format exactly
    const banData = {
      reason: banForm.reason,
      duration: banForm.durationType === 'permanent' ? 'permanent' : 'custom',
      notes: banForm.notes,
      isBanned: true,
      bannedBy: 'System', // Add this required field
      banStartDate: banForm.banStartDate,
      banEndDate: banForm.durationType === 'permanent' ? null : banForm.banEndDate,
      calculatedDuration: banForm.calculatedDuration
    };
    
    await axios.put(endpoint, banData);
    
    toast.success("Ban updated successfully");
    setShowBanModal(false);
    setSelectedPerson(null);
    fetchBanned();
    fetchViolators();
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
    // Remove ban
    const banEndpoint = personType === 'visitor' 
      ? `${API_BASE}/visitors/${personId}/remove-ban`
      : `${API_BASE}/guests/${personId}/remove-ban`;
    
    console.log('🔄 Removing ban from:', banEndpoint);
    const banResponse = await axios.put(banEndpoint);
    console.log('✅ Remove ban response:', banResponse.data);

    // Remove violation WITHOUT showing another confirmation
    try {
      const violationEndpoint = personType === 'visitor' 
        ? `${API_BASE}/visitors/${personId}/remove-violation`
        : `${API_BASE}/guests/${personId}/remove-violation`;
      
      console.log('🔄 Removing violation from:', violationEndpoint);
      await axios.put(violationEndpoint);
      console.log('✅ Violation removed successfully');
    } catch (violationError) {
      // It's okay if violation removal fails - maybe there was no violation to remove
      console.log('⚠️ No violation to remove or error removing violation:', violationError.message);
    }
    
    toast.success("Ban removed successfully");
    
    // Refresh both lists
    fetchBanned();
    fetchViolators();
    fetchBanHistory(); // Refresh history to show removal date
    
  } catch (error) {
    console.error("❌ Error removing ban:", error);
    console.error("📋 Error details:", error.response?.data);
    toast.error(`Failed to remove ban: ${error.response?.data?.message || error.message}`);
  }
};

const handleDeleteHistoryRecord = async (recordId, recordType) => {
  if (!window.confirm("Are you sure you want to permanently delete this history record? This action cannot be undone.")) {
    return;
  }

  try {
    console.log(`🔄 Deleting ${recordType} history record:`, recordId);
    
    let endpoint;
    if (recordType === 'ban') {
      endpoint = `${API_BASE}/ban-history/${recordId}`;
    } else {
      endpoint = `${API_BASE}/violation-history/${recordId}`;
    }
    
    console.log(`📡 Calling endpoint:`, endpoint);
    
    const response = await axios.delete(endpoint);
    console.log(`✅ Delete ${recordType} history response:`, response.data);
    
    toast.success("History record deleted successfully");
    
    // Refresh the appropriate history
    if (recordType === 'ban') {
      await fetchBanHistory();
    } else {
      await fetchViolationHistory();
    }
    
  } catch (error) {
    console.error(`❌ Error deleting ${recordType} history record:`, error);
    console.error("📋 Error response:", error.response?.data);
    toast.error(`Failed to delete history record: ${error.response?.data?.message || error.message}`);
  }
};

 const exportToCSV = () => {
  let headers = [];
  let csvData = [];

  switch (activeTab) {
    case 'violators':
      if (violators.length === 0) {
        toast.warning("No violators data to export");
        return;
      }
      headers = ['Person ID', 'Name', 'Type', 'Violation Type', 'Violation Details'];
      csvData = violators.map(person => [
        person.id || 'N/A',
        person.personName || 'N/A',
        (person.personType || 'unknown').toUpperCase(),
        person.violationType || 'N/A',
        person.violationDetails || 'No details provided'
      ]);
      break;

    case 'violation-history':
      if (violationHistory.length === 0) {
        toast.warning("No violation history data to export");
        return;
      }
      // UPDATED: Added Date Removed column
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
        getBanDurationDisplay(person) // FIXED: Now shows calculated time
      ]);
      break;

    case 'ban-history':
      if (banHistory.length === 0) {
        toast.warning("No ban history data to export");
        return;
      }
      // UPDATED: Added Date Removed column
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
      // For visit logs tabs (all, visitors, guests)
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
  
  // Update success message based on active tab
  let recordCount = 0;
  let recordType = activeTab;
  
  switch (activeTab) {
    case 'violators':
      recordCount = violators.length;
      break;
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

  // Helper functions
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

  // Render functions for different tables
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
            <th style={{ width: '180px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map(log => (
            <tr key={log._id}>
              <td>
                <div className="fw-bold text-white">{formatDate(log.visitDate)}</div>
                <div className="small text-white" style={{ opacity: 0.7 }}>
                  {new Date(log.visitDate).toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
              </td>
              <td>
                <Badge bg={getTypeVariant(log.personType)} className="fs-6 text-dark">
                  {log.personType.toUpperCase()}
                </Badge>
              </td>
              <td>
                <div className="fw-bold text-white">{log.personName}</div>
                <div className="small text-white" style={{ opacity: 0.7 }}>
                  <User size={12} className="me-1" />
                  ID: {log.personId}
                </div>
              </td>
              {activeTab === 'guests' ? (
                <td>
                  <div className="fw-bold text-white">{log.visitPurpose || 'General Visit'}</div>
                </td>
              ) : (
                <td>
                  {log.prisonerId ? (
                    <>
                      <div className="fw-bold text-white">{log.inmateName}</div>
                      <div className="small text-white" style={{ opacity: 0.7 }}>
                        PDL ID: {log.prisonerId}
                      </div>
                    </>
                  ) : (
                    <div className="text-white" style={{ opacity: 0.7 }}>N/A</div>
                  )}
                </td>
              )}
              <td>
                <div className="small text-white">
                  <div><strong className="text-white">Time In:</strong> {formatTime(log.timeIn)}</div>
                  <div><strong className="text-white">Time Out:</strong> {formatTime(log.timeOut) || 'Not checked out'}</div>
                  {log.visitDuration && (
                    <div><strong className="text-white">Duration:</strong> {log.visitDuration}</div>
                  )}
                </div>
              </td>
              <td className="text-center">
                <Badge bg={getStatusVariant(log.status)} className="fs-6 text-dark">
                  {log.status.toUpperCase()}
                </Badge>
                {log.isTimerActive && (
                  <div className="small mt-1">
                    <Badge bg="warning" className="text-dark">TIMER ACTIVE</Badge>
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
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => openDeleteModal(log)}
                    title="Delete Record"
                    className="p-1"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  const renderViolatorsTable = () => {
    if (violators.length === 0) {
      return (
        <Alert variant="info">
          No violators found.
        </Alert>
      );
    }

    return (
      <Table striped bordered hover responsive className="bg-white">
        <thead className="table-dark">
          <tr>
            <th>Person ID</th>
            <th>Name</th>
            <th>Type</th>
            <th>Violation Type</th>
            <th>Violation Details</th>
            <th style={{ width: '120px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {violators.map(person => (
            <tr key={person.id}>
              <td>{person.id}</td>
              <td className="fw-bold">{person.personName}</td>
              <td>
                <Badge bg={getTypeVariant(person.personType)} className="text-dark">
                  {person.personType.toUpperCase()}
                </Badge>
              </td>
              <td>
                <Badge bg="danger" className="text-dark">
                  {person.violationType === 'Ban' || person.violationType === 'ban' ? 'Banned' : person.violationType}
                </Badge>
              </td>
              <td>{person.violationDetails || 'No details provided'}</td>
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
                    onClick={() => openEditViolationModal(person)}
                    title="Edit Violation"
                    className="p-1"
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    variant="outline-success"
                    size="sm"
                    onClick={() => handleRemoveViolation(person.id, person.personType)}
                    title="Remove Violation"
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
    );
  };

  const renderBannedTable = () => {
    const dataToDisplay = filteredBanned.length > 0 || bannedFilter.personType || bannedFilter.searchQuery ? filteredBanned : banned;
    
    if (dataToDisplay.length === 0) {
      return (
        <Alert variant="info">
          {bannedFilter.personType || bannedFilter.searchQuery ? 'No banned persons found matching the filters.' : 'No banned persons found.'}
        </Alert>
      );
    }

    return (
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
          {dataToDisplay.map(person => (
            <tr key={person.id}>
              <td className="text-white">{person.id}</td>
              <td className="fw-bold text-white">{person.personName}</td>
              <td>
                <Badge bg={getTypeVariant(person.personType)} className="text-dark">
                  {person.personType.toUpperCase()}
                </Badge>
              </td>
              <td>
                <Badge bg="danger" className="text-dark">Banned</Badge>
              </td>
              <td className="text-white">{person.banReason || 'No reason provided'}</td>
              <td>
                <Badge bg="warning" className="text-dark">
                  {getBanDurationDisplay(person)} {/* FIXED: Now shows calculated time */}
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
    );
  };

  const renderBanHistoryTable = () => {
  if (banHistory.length === 0) {
    return (
      <Alert variant="info">
        No ban history found.
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
          <th style={{ width: '120px' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {banHistory.map(record => (
          <tr key={record._id}>
            <td>
              <div className="fw-bold text-white">{record.personName}</div>
              <div className="small text-white" style={{ opacity: 0.7 }}>
                ID: {record.personId}
                <Badge bg={getTypeVariant(record.personType)} className="ms-1 text-dark">
                  {record.personType.toUpperCase()}
                </Badge>
              </div>
            </td>
            <td>
              <div className="text-white"><strong className="text-white">Reason:</strong> {record.banReason}</div>
              <div className="small text-white" style={{ opacity: 0.7 }}>
                <strong className="text-white">Duration:</strong> {record.calculatedDuration || (record.banDuration === 'permanent' ? 'Permanent' : 'Custom')}
              </div>
            </td>
            <td>
              <div className="fw-bold text-white">{formatDate(record.createdAt)}</div>
              <div className="small text-white" style={{ opacity: 0.7 }}>{formatTime(record.createdAt)}</div>
            </td>
            <td>
              {record.removedAt ? (
                <>
                  <div className="fw-bold text-white">{formatDate(record.removedAt)}</div>
                  <div className="small text-white" style={{ opacity: 0.7 }}>{formatTime(record.removedAt)}</div>
                </>
              ) : (
                <Badge bg="success" className="text-dark">Still Active</Badge>
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
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleDeleteHistoryRecord(record._id, 'ban')}
                  title="Delete Record"
                  className="p-1"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};
  
 const renderViolationHistoryTable = () => {
  if (violationHistory.length === 0) {
    return (
      <Alert variant="info">
        No violation history found.
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
          <th style={{ width: '120px' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {violationHistory.map(record => (
          <tr key={record._id}>
            <td>
              <div className="fw-bold text-white">{record.personName}</div>
              <div className="small text-white" style={{ opacity: 0.7 }}>
                ID: {record.personId}
                <Badge bg={getTypeVariant(record.personType)} className="ms-1 text-dark">
                  {record.personType.toUpperCase()}
                </Badge>
              </div>
            </td>
            <td>
              <div>
                <Badge bg="danger" className="mb-1 text-dark">
                  {record.violationType}
                </Badge>
              </div>
              <div className="small text-white">{record.violationDetails || 'No details provided'}</div>
            </td>
            <td>
              <div className="fw-bold text-white">{formatDate(record.createdAt)}</div>
              <div className="small text-white" style={{ opacity: 0.7 }}>{formatTime(record.createdAt)}</div>
            </td>
            <td>
              {record.removedAt ? (
                <>
                  <div className="fw-bold text-white">{formatDate(record.removedAt)}</div>
                  <div className="small text-white" style={{ opacity: 0.7 }}>{formatTime(record.removedAt)}</div>
                </>
              ) : (
                <Badge bg="warning" className="text-dark">Still Active</Badge>
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
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleDeleteHistoryRecord(record._id, 'violation')}
                  title="Delete Record"
                  className="p-1"
                >
                  <Trash2 size={16} />
                </Button>
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
          <h6 className="mb-0" style={{color: '#FFD700'}}>Filter History Records</h6>
        </div>
        <Button 
          variant="outline-secondary" 
          size="sm"
          onClick={clearHistoryFilters}
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
        <Col md={3}>
          <Form.Group>
            <Form.Label style={{color: '#ffffff'}}>
              <Calendar size={14} className="me-1" />
              Start Date
            </Form.Label>
            <Form.Control
              type="date"
              value={historyFilter.startDate}
              onChange={(e) => setHistoryFilter({...historyFilter, startDate: e.target.value})}
              style={{backgroundColor: 'white', color: 'black'}}
            />
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group>
            <Form.Label style={{color: '#ffffff'}}>
              <Calendar size={14} className="me-1" />
              End Date
            </Form.Label>
            <Form.Control
              type="date"
              value={historyFilter.endDate}
              onChange={(e) => setHistoryFilter({...historyFilter, endDate: e.target.value})}
              style={{backgroundColor: 'white', color: 'black'}}
            />
          </Form.Group>
        </Col>
        <Col md={2}>
          <Form.Group>
            <Form.Label style={{color: '#ffffff'}}>Person Type</Form.Label>
            <Form.Select 
              value={historyFilter.personType} 
              onChange={(e) => setHistoryFilter({...historyFilter, personType: e.target.value})}
              style={{backgroundColor: 'white'}}
            >
              <option value="">All Types</option>
              <option value="visitor">Visitor</option>
              <option value="guest">Guest</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group>
            <Form.Label style={{color: '#ffffff'}}>
              <Search size={14} className="me-1" />
              Search
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Search by name or ID..."
              value={historyFilter.searchQuery}
              onChange={(e) => setHistoryFilter({...historyFilter, searchQuery: e.target.value})}
              style={{backgroundColor: 'white'}}
            />
          </Form.Group>
        </Col>
        <Col md={1} className="d-flex align-items-end">
          <Button 
            variant="primary" 
            onClick={activeTab === 'ban-history' ? fetchBanHistory : fetchViolationHistory}
            className="w-100"
            style={{
              color: 'black',
              backgroundColor: '#FFD700',
              borderColor: '#FFD700'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#e15c5cd0'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#FFD700'}
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
      <ToastContainer />
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: "600", color: "#ffffffff" }}>
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
            (activeTab === 'violators' && violators.length === 0) ||
            (activeTab === 'violation-history' && violationHistory.length === 0) ||
            (activeTab === 'banned' && banned.length === 0) ||
            (activeTab === 'ban-history' && banHistory.length === 0)
          }
        >
          <Download size={16} className="me-1" />
          Export CSV
        </Button>
      </div>

      {/* Tabs for different views */}
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
              {/* Filters Card */}
              <Card style={{ 
        backgroundColor: '#676767a7', 
        borderRadius: '12px', marginBottom: '20px', 
        borderLeft: '4px solid #FFD700', 
        borderRight: '4px solid #FFD700',}}>
                <Card.Header style={{backgroundColor: '#67676741'}}>
                  <div className="d-flex align-items-center">
                    <Filter size={18} className="me-2"  />
                    <h6 className="mb-0" style={{color: '#FFD700'}}>Filter Visit Records</h6>
                  </div>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{color: 'white'}}>
                          <Calendar size={14} className="me-1" />
                          Start Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          style={{color: 'black'}}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{color: 'white'}}>
                          <Calendar size={14} className="me-1" />
                          End Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          style={{color: 'black'}}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label style={{color: 'white'}}>
                          <Search size={14} className="me-1" />
                          Search
                        </Form.Label>
                        <InputGroup>
                          <Form.Control
                            type="text"
                            placeholder="Search visit records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                          <Form.Select 
                            value={searchBy} 
                            onChange={(e) => setSearchBy(e.target.value)}
                            style={{ maxWidth: '150px', color: 'black' }}
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

              {/* All Visits Table */}
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
              {/* Filters Card */}
              <Card style={{ 
        backgroundColor: '#676767a7', 
        borderRadius: '12px', marginBottom: '20px', 
        borderLeft: '4px solid #FFD700', 
        borderRight: '4px solid #FFD700',}}>
                <Card.Header style={{backgroundColor: '#67676741'}}>
                  <div className="d-flex align-items-center">
                    <Filter size={18} className="me-2"  />
                    <h6 className="mb-0" style={{color: '#FFD700'}}>Filter Visit Records</h6>
                  </div>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{color: '#ffffff'}}>
                          <Calendar size={14} className="me-1" />
                          Start Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          style={{backgroundColor: 'white', color: 'black'}}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{color: '#ffffff'}}>
                          <Calendar size={14} className="me-1" />
                          End Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          style={{backgroundColor: 'white', color: 'black'}}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label style={{color: '#ffffff'}}>
                          <Search size={14} className="me-1" />
                          Search
                        </Form.Label>
                        <InputGroup>
                          <Form.Control
                            type="text"
                            placeholder="Search visit records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{backgroundColor: 'white'}}
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
              
              {renderVisitTable(filteredLogs)}
            </Tab>

            <Tab eventKey="guests" title={
              <span>
                <Users size={16} className="me-1" />
                Guests <Badge bg="secondary" className="ms-1">{counts.guests}</Badge>
              </span>
            }>
              {/* Filters Card */}
              <Card style={{ 
        backgroundColor: '#676767a7', 
        borderRadius: '12px', marginBottom: '20px', 
        borderLeft: '4px solid #FFD700', 
        borderRight: '4px solid #FFD700',}}>
                <Card.Header style={{backgroundColor: '#67676741'}}>
                  <div className="d-flex align-items-center">
                    <Filter size={18} className="me-2"  />
                    <h6 className="mb-0" style={{color: '#FFD700'}}>Filter Visit Records</h6>
                  </div>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{color: '#ffffff'}}>
                          <Calendar size={14} className="me-1" />
                          Start Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          style={{backgroundColor: 'white', color: 'black'}}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{color: '#ffffff'}}>
                          <Calendar size={14} className="me-1" />
                          End Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          style={{backgroundColor: 'white', color: 'black'}}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label style={{color: '#ffffff'}}>
                          <Search size={14} className="me-1" />
                          Search
                        </Form.Label>
                        <InputGroup>
                          <Form.Control
                            type="text"
                            placeholder="Search visit records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{backgroundColor: 'white'}}
                          />
                          <Form.Select 
                            value={searchBy} 
                            onChange={(e) => setSearchBy(e.target.value)}
                            style={{ maxWidth: '150px', backgroundColor: 'white' }}
                          >
                            {guestSearchOptions.map(option => (
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
              
              {renderVisitTable(filteredLogs)}
            </Tab>

            <Tab eventKey="violation-history" title={
              <span>
                <AlertTriangle size={16} className="me-1" />
                Violations <Badge bg="warning" className="ms-1 ">{violationHistory.length}</Badge>
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
              {/* Filters Card */}
              <Card style={{ 
        backgroundColor: '#676767a7', 
        borderRadius: '12px', marginBottom: '20px', 
        borderLeft: '4px solid #FFD700', 
        borderRight: '4px solid #FFD700',}}>
                <Card.Header style={{backgroundColor: '#67676741'}}>
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <Filter size={18} className="me-2" />
                      <h6 className="mb-0" style={{color: '#FFD700'}}>Filter Banned Records</h6>
                    </div>
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={clearBannedFilters}
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
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label style={{color: '#ffffff'}}>Person Type</Form.Label>
                        <Form.Select 
                          value={bannedFilter.personType} 
                          onChange={(e) => setBannedFilter({...bannedFilter, personType: e.target.value})}
                          style={{backgroundColor: 'white'}}
                        >
                          <option value="">All Types</option>
                          <option value="visitor">Visitor</option>
                          <option value="guest">Guest</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={7}>
                      <Form.Group>
                        <Form.Label style={{color: '#ffffff'}}>
                          <Search size={14} className="me-1" />
                          Search
                        </Form.Label>
                        <InputGroup>
                          <Form.Control
                            type="text"
                            placeholder="Search banned records..."
                            value={bannedFilter.searchQuery}
                            onChange={(e) => setBannedFilter({...bannedFilter, searchQuery: e.target.value})}
                            style={{backgroundColor: 'white'}}
                          />
                          <Form.Select 
                            value={bannedFilter.searchBy} 
                            onChange={(e) => setBannedFilter({...bannedFilter, searchBy: e.target.value})}
                            style={{ maxWidth: '150px', backgroundColor: 'white' }}
                          >
                            <option value="personName">Person Name</option>
                            <option value="personId">Person ID</option>
                            <option value="banReason">Ban Reason</option>
                          </Form.Select>
                        </InputGroup>
                      </Form.Group>
                    </Col>
                    <Col md={2} className="d-flex align-items-end">
                      <Button 
                        variant="primary" 
                        onClick={() => {}} 
                        className="w-100"
                        style={{
                          color: 'black',
                          backgroundColor: '#FFD700',
                          borderColor: '#FFD700'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#e15c5cd0'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#FFD700'}
                      >
                        <RefreshCw size={16} className="me-1" />
                        Apply
                      </Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
              
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

   {/* View Details Modal - Scrollable like PDLs */}
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

      {/* Add/Edit Violation Modal - REMOVED additional notes */}
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
            {/* REMOVED: Additional Notes field */}
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

      {/* NEW: Add/Edit Ban Modal with EXACT Inmate-Style Date Selection - SAME STYLING AS INMATES */}
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
              // Clear date fields if switching to permanent
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
          {/* EXACT COPY OF INMATE DATE SELECTION SYSTEM */}
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
                      // AUTO-CALCULATE DURATION WHEN BOTH DATES ARE SET (EXACTLY LIKE INMATES)
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
                      // AUTO-CALCULATE DURATION WHEN BOTH DATES ARE SET (EXACTLY LIKE INMATES)
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

          {/* AUTO-CALCULATED DURATION DISPLAY (EXACTLY LIKE INMATES) */}
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
              readOnly={!!(banForm.banStartDate && banForm.banEndDate)} // Read-only when auto-calculated
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

      {/* Delete Confirmation Modal */}
      <Modal 
        show={showDeleteModal} 
        onHide={() => setShowDeleteModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <Trash2 size={20} className="me-2 text-danger" />
            Delete Visit Record
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete this visit record?
          <br />
          <strong>Person:</strong> {selectedLog?.personName}
          <br />
          <strong>Date:</strong> {selectedLog ? formatDate(selectedLog.visitDate) : ''}
          <br />
          <span className="text-danger">
            This action cannot be undone.
          </span>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => handleDeleteLog(selectedLog?._id)}>
            Delete Record
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default RecordVisits;