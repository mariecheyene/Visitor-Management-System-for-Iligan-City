import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, Row, Col, Container, Button, Alert, ProgressBar, Badge, Spinner } from "react-bootstrap";
import { 
  FaUsers, 
  FaUserFriends,
  FaUserCheck,
  FaChartBar, 
  FaVenus, 
  FaMars, 
  FaUserShield,
  FaUserTie,
  FaUser,
  FaUserClock,
  FaCalendarWeek,
  FaCalendarAlt,
  FaCalendarDay,
  FaHistory,
  FaExclamationTriangle,
  FaExclamationCircle,
  FaClock,
  FaHourglassHalf,
  FaHourglassEnd
} from "react-icons/fa";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import "bootstrap/dist/css/bootstrap.min.css";

const INMATES_API_URL = "http://localhost:5001/inmates";
const VISITORS_API_URL = "http://localhost:5001/visitors";
const GUESTS_API_URL = "http://localhost:5001/guests";
const USERS_API_URL = "http://localhost:5001/users";
const ACTIVE_TIMERS_URL = "http://localhost:5001/visit-logs/active-visitor-timers";
const VISIT_LOGS_URL = "http://localhost:5001/visit-logs";
const ALL_ACTIVE_TIMERS_URL = "http://localhost:5001/visit-logs"; // For all active timers

// Color palette - muted and professional
const COLORS = {
  primary: '#4ECDC4',       // Teal
  secondary: '#556CD6',     // Muted blue
  success: '#27AE60',       // Green
  warning: '#F39C12',       // Orange
  danger: '#E74C3C',        // Red
  info: '#3498DB',          // Blue
  purple: '#9B59B6',        // Purple
  dark: '#2C3E50',          // Dark blue
  light: '#ECF0F1',         // Light gray
  gray: '#95A5A6'           // Gray
};

const CHART_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.success,
  COLORS.warning,
  COLORS.danger,
  COLORS.info,
  COLORS.purple,
  COLORS.dark
];

// Helper function to safely validate dates
const isValidDate = (date) => {
  if (!date) return false;
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime());
};

// Helper function to safely get date string in YYYY-MM-DD format
const getSafeDateString = (date) => {
  if (!isValidDate(date)) return null;
  const dateObj = new Date(date);
  return dateObj.toISOString().split('T')[0];
};

// Helper to get day name from date
const getDayName = (date) => {
  return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [inmates, setInmates] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [guests, setGuests] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTimers, setActiveTimers] = useState([]);
  const [allActiveTimers, setAllActiveTimers] = useState([]); // NEW: All active timers including custom
  const [visitLogs, setVisitLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  // Helper function to get the correct navigation base path based on current URL
  const getBasePath = () => {
    const path = window.location.pathname;
    if (path.includes('/maleadmin')) return '/maleadmin';
    if (path.includes('/femaleadmin')) return '/femaleadmin';
    if (path.includes('/malestaff')) return '/malestaff';
    if (path.includes('/femalestaff')) return '/femalestaff';
    if (path.includes('/staff')) return '/staff';
    return '/admin';
  };

  // Helper function to navigate to male inmates page
  const navigateToMaleInmates = () => {
    const basePath = getBasePath();
    if (basePath === '/admin') {
      navigate(`${basePath}/inmates`, { state: { gender: 'Male' } });
    } else if (basePath === '/maleadmin') {
      navigate(`${basePath}/male-inmates`);
    } else {
      navigate(`${basePath}/inmates`, { state: { gender: 'Male' } });
    }
  };

  // Helper function to navigate to female inmates page
  const navigateToFemaleInmates = () => {
    const basePath = getBasePath();
    if (basePath === '/admin') {
      navigate(`${basePath}/inmates`, { state: { gender: 'Female' } });
    } else if (basePath === '/femaleadmin') {
      navigate(`${basePath}/inmates`);
    } else {
      navigate(`${basePath}/inmates`, { state: { gender: 'Female' } });
    }
  };

  // Helper function to navigate to visitors page
  const navigateToVisitors = () => {
    const basePath = getBasePath();
    if (basePath === '/maleadmin') {
      navigate(`${basePath}/visitor-male-division`);
    } else if (basePath === '/femaleadmin') {
      navigate(`${basePath}/visitors`);
    } else {
      navigate(`${basePath}/visitors`);
    }
  };

  // Helper function to navigate to guests page
  const navigateToGuests = () => {
    const basePath = getBasePath();
    navigate(`${basePath}/guest`);
  };

  // Helper function to navigate to user management page
  const navigateToUserManagement = () => {
    const basePath = getBasePath();
    navigate(`${basePath}/user-management`);
  };

  useEffect(() => {
    fetchDashboardData();
    
    const timerInterval = setInterval(() => {
      fetchActiveTimers();
      fetchAllActiveTimers(); // NEW: Fetch all timers
    }, 5001);

    const dataInterval = setInterval(() => {
      fetchDashboardData();
    }, 30000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(dataInterval);
    };
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setChartLoading(true);
    setError(null);
    try {
      const [inmatesRes, visitorsRes, guestsRes, usersRes, visitLogsRes] = await Promise.all([
        axios.get(INMATES_API_URL),
        axios.get(VISITORS_API_URL),
        axios.get(GUESTS_API_URL),
        axios.get(USERS_API_URL),
        axios.get(VISIT_LOGS_URL)
      ]);
      
      setInmates(inmatesRes.data || []);
      setVisitors(visitorsRes.data || []);
      setGuests(guestsRes.data || []);
      setUsers(usersRes.data || []);
      setVisitLogs(visitLogsRes.data || []);
      
      await fetchActiveTimers();
      await fetchAllActiveTimers(); // NEW: Fetch all timers
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setError("Failed to fetch dashboard data. Please check if the server is running.");
    }
    setLoading(false);
    setChartLoading(false);
  };

  const fetchActiveTimers = async () => {
    try {
      const response = await axios.get(ACTIVE_TIMERS_URL);
      console.log('🕒 Active timers response:', response.data);
      setActiveTimers(response.data || []);
    } catch (error) {
      console.error("❌ Error fetching active timers:", error);
    }
  };

  // NEW: Fetch ALL active timers including custom ones
  const fetchAllActiveTimers = async () => {
    try {
      // Get all visit logs that are in-progress and have active timers
      const response = await axios.get(VISIT_LOGS_URL);
      const allLogs = response.data || [];
      
      console.log('📋 All visit logs for timer analysis:', allLogs.length);
      
      // Filter for active timers (in-progress visits with timerEnd in future)
      const now = new Date();
      const activeTimersList = allLogs.filter(log => {
        // Must be in-progress and have a timer end time
        if (log.status !== 'in-progress' || !log.timerEnd) return false;
        
        // Timer end must be in the future
        const timerEnd = new Date(log.timerEnd);
        if (timerEnd <= now) return false;
        
        // Must not have timed out
        if (log.timeOut) return false;
        
        return true;
      });
      
      console.log('🕒 ALL Active timers found:', activeTimersList.length);
      
      // Enhance timer data with additional information
      const enhancedTimers = await Promise.all(
        activeTimersList.map(async (timer) => {
          try {
            // Calculate time remaining
            const timerEnd = new Date(timer.timerEnd);
            const timeRemaining = Math.max(0, timerEnd - now);
            const timeRemainingMinutes = Math.floor(timeRemaining / (1000 * 60));
            
            // Get person details
let personName = timer.personName || 'Unknown Visitor';
let personDetails = {};
let visitPurpose = timer.visitPurpose || 'General Visit';

if (timer.personType === 'visitor') {
  const visitorResponse = await axios.get(`${VISITORS_API_URL}/${timer.personId}`);
  personDetails = visitorResponse.data;
} else if (timer.personType === 'guest') {
  const guestResponse = await axios.get(`${GUESTS_API_URL}/${timer.personId}`);
  personDetails = guestResponse.data;
  // Get the actual visit purpose from guest data
  visitPurpose = personDetails.visitPurpose || 
                 personDetails.purpose || 
                 timer.visitPurpose || 
                 'General Visit';
}
            // Check if this is a custom timer (not 3 hours)
            const timerStart = new Date(timer.timerStart);
            const totalDurationMs = timerEnd - timerStart;
            const totalDurationMinutes = Math.floor(totalDurationMs / (1000 * 60));
            const isCustomTimer = totalDurationMinutes !== 180; // Not exactly 3 hours
            return {
  ...timer,
  timeRemaining,
  timeRemainingMinutes,
  personName: personDetails.fullName || personName,
  visitPurpose: visitPurpose, // Add this line
  isCustomTimer,
  totalDurationMinutes,
  customTimeSlot: personDetails.timeSlot,
  timerType: isCustomTimer ? 'custom' : 'standard'
};
          } catch (error) {
            console.error('Error enhancing timer data:', error);
            return {
              ...timer,
              timeRemaining: 0,
              timeRemainingMinutes: 0,
              isCustomTimer: false,
              timerType: 'standard'
            };
          }
        })
      );
      
      setAllActiveTimers(enhancedTimers);
      console.log('✅ Enhanced all active timers:', enhancedTimers);
      
    } catch (error) {
      console.error("❌ Error fetching all active timers:", error);
    }
  };

  // NEW: Separate timers by type (visitor vs guest)
  const getVisitorTimers = () => {
    return allActiveTimers.filter(timer => timer.personType === 'visitor');
  };

  const getGuestTimers = () => {
    return allActiveTimers.filter(timer => timer.personType === 'guest');
  };

  // NEW: Get urgent timers by type
  const getUrgentVisitorTimers = () => {
    return getVisitorTimers().filter(timer => 
      timer.timeRemainingMinutes !== null && 
      timer.timeRemainingMinutes !== undefined && 
      !isNaN(timer.timeRemainingMinutes) && 
      timer.timeRemainingMinutes < 30
    );
  };

  const getUrgentGuestTimers = () => {
    return getGuestTimers().filter(timer => 
      timer.timeRemainingMinutes !== null && 
      timer.timeRemainingMinutes !== undefined && 
      !isNaN(timer.timeRemainingMinutes) && 
      timer.timeRemainingMinutes < 30
    );
  };

  // NEW: Get critical timers by type
  const getCriticalVisitorTimers = () => {
    return getVisitorTimers().filter(timer => 
      timer.timeRemainingMinutes !== null && 
      timer.timeRemainingMinutes !== undefined && 
      !isNaN(timer.timeRemainingMinutes) && 
      timer.timeRemainingMinutes < 10
    );
  };

  const getCriticalGuestTimers = () => {
    return getGuestTimers().filter(timer => 
      timer.timeRemainingMinutes !== null && 
      timer.timeRemainingMinutes !== undefined && 
      !isNaN(timer.timeRemainingMinutes) && 
      timer.timeRemainingMinutes < 10
    );
  };

  // NEW: Get top urgent timers by type
  const getTopUrgentVisitorTimers = () => {
    return getVisitorTimers()
      .filter(timer => 
        timer.timeRemainingMinutes !== null && 
        timer.timeRemainingMinutes !== undefined && 
        !isNaN(timer.timeRemainingMinutes)
      )
      .sort((a, b) => a.timeRemainingMinutes - b.timeRemainingMinutes)
      .slice(0, 5);
  };

  const getTopUrgentGuestTimers = () => {
    return getGuestTimers()
      .filter(timer => 
        timer.timeRemainingMinutes !== null && 
        timer.timeRemainingMinutes !== undefined && 
        !isNaN(timer.timeRemainingMinutes)
      )
      .sort((a, b) => a.timeRemainingMinutes - b.timeRemainingMinutes)
      .slice(0, 5);
  };

  // Chart Data Preparation with REAL data from visitLogs
  const getWeeklyVisitData = () => {
    console.log('📊 Processing weekly data from visit logs:', visitLogs);
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData = days.map((day, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - today.getDay() + index);
      const dateString = getSafeDateString(date);
      
      // Count visits for this specific date
      const dayVisits = visitLogs.filter(log => {
        // Try different possible date fields
        const visitDate = log.visitDate || log.date || log.createdAt || log.timeIn;
        if (!isValidDate(visitDate)) return false;
        
        const logDateString = getSafeDateString(new Date(visitDate));
        return logDateString === dateString;
      }).length;

      return {
        name: day,
        visits: dayVisits,
        fullDate: dateString
      };
    });

    console.log('📈 Weekly visit data:', weekData);
    return weekData;
  };

  const getMonthlyVisitData = () => {
    console.log('📊 Processing monthly data from visit logs');
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    // Create 4 weeks for the current month
    const monthData = [];
    for (let week = 0; week < 4; week++) {
      const startDate = new Date(year, month, week * 7 + 1);
      const endDate = new Date(year, month, (week + 1) * 7);
      
      const weekVisits = visitLogs.filter(log => {
        const visitDate = log.visitDate || log.date || log.createdAt || log.timeIn;
        if (!isValidDate(visitDate)) return false;
        
        const logDate = new Date(visitDate);
        return logDate >= startDate && logDate <= endDate && 
               logDate.getMonth() === month && 
               logDate.getFullYear() === year;
      }).length;

      monthData.push({
        name: `Week ${week + 1}`,
        visits: weekVisits,
        range: `${startDate.getDate()}-${endDate.getDate()}`
      });
    }

    console.log('📈 Monthly visit data:', monthData);
    return monthData;
  };

  const getVisitTypeData = () => {
    console.log('📊 Processing visit type data');
    
    // Count based on actual data structure
    const totalVisits = visitLogs.length;
    const visitorVisits = visitors.length; // Total registered visitors
    const guestVisits = guests.length;     // Total registered guests
    
    // Alternative: Count from visit logs if type information exists
    const visitsFromLogs = {
      visitors: visitLogs.filter(log => log.visitType === 'visitor' || log.personType === 'visitor').length,
      guests: visitLogs.filter(log => log.visitType === 'guest' || log.personType === 'guest').length
    };

    const data = [
      { 
        name: 'Visitors', 
        value: visitsFromLogs.visitors > 0 ? visitsFromLogs.visitors : visitorVisits,
        count: visitsFromLogs.visitors > 0 ? visitsFromLogs.visitors : visitorVisits,
        color: '#FFEB3B' // Lighter shade of yellow
      },
      { 
        name: 'Guests', 
        value: visitsFromLogs.guests > 0 ? visitsFromLogs.guests : guestVisits,
        count: visitsFromLogs.guests > 0 ? visitsFromLogs.guests : guestVisits,
        color: '#f7ab2aff' // Darker shade of yellow
      }
    ];

    console.log('📈 Visit type data:', data);
    return data;
  };

  const getTimeOfDayData = () => {
    console.log('🕒 Processing time of day data from visit logs:', visitLogs);
    
    const timeSlots = [
      { name: 'Morning (6AM-12PM)', range: [6, 11], count: 0 },
      { name: 'Afternoon (12PM-6PM)', range: [12, 17], count: 0 },
      { name: 'Evening (6PM-12AM)', range: [18, 23], count: 0 },
      { name: 'Night (12AM-6AM)', range: [0, 5], count: 0 }
    ];

    let processedCount = 0;
    let errorCount = 0;

    // Debug: Show all available time fields in the first few logs
    if (visitLogs.length > 0) {
      console.log('🔍 Available time fields in first log:', Object.keys(visitLogs[0]).filter(key => 
        key.toLowerCase().includes('time') || 
        key.toLowerCase().includes('date') ||
        key === 'createdAt' || 
        key === 'updatedAt'
      ));
      
      // Show sample of time data
      visitLogs.slice(0, 3).forEach((log, index) => {
        console.log(`📋 Sample log ${index} time data:`, {
          timeIn: log.timeIn,
          visitTime: log.visitTime,
          checkInTime: log.checkInTime,
          createdAt: log.createdAt,
          timestamp: log.timestamp,
          visitDate: log.visitDate
        });
      });
    }

    visitLogs.forEach((log, index) => {
      // Try multiple possible time fields in order of likelihood
      const timeFields = [
        log.timeIn,
        log.checkInTime, 
        log.visitTime,
        log.timestamp,
        log.createdAt,
        log.visitDate // Fallback to date if no time field
      ];

      let hour = null;
      let usedField = null;

      for (const field of timeFields) {
        if (field && isValidDate(field)) {
          try {
            const date = new Date(field);
            hour = date.getHours();
            usedField = field;
            break;
          } catch (error) {
            continue;
          }
        }
      }

      // If we found a valid hour, assign to time slot
      if (hour !== null) {
        console.log(`✅ Log ${index}: ${usedField} -> hour=${hour}`);
        
        let slotFound = false;
        timeSlots.forEach(slot => {
          if (hour >= slot.range[0] && hour <= slot.range[1]) {
            slot.count++;
            slotFound = true;
            processedCount++;
          }
        });
        
        if (!slotFound) {
          console.log(`❌ Hour ${hour} didn't match any time slot ranges`);
        }
      } else {
        console.log(`❌ No valid time field found in log ${index}`);
        errorCount++;
      }
    });

    console.log('📊 Time of day processing summary:', {
      totalLogs: visitLogs.length,
      successfullyProcessed: processedCount,
      errors: errorCount,
      timeSlotDistribution: timeSlots.map(slot => ({ name: slot.name, count: slot.count }))
    });

    const data = timeSlots.map(slot => ({
      name: slot.name,
      visits: slot.count,
      timeSlot: slot.name
    }));

    return data;
  };

  // NEW: Get visitors by gender data
  const getVisitorsByGenderData = () => {
    console.log('🚻 Processing visitors by gender data');
    
    // Count male and female visitors
    const maleVisitors = visitors.filter(visitor => 
      visitor.gender === 'Male' || visitor.sex === 'Male'
    ).length;
    
    const femaleVisitors = visitors.filter(visitor => 
      visitor.gender === 'Female' || visitor.sex === 'Female'
    ).length;

    // Also count from visit logs if gender information exists there
    const maleVisitLogs = visitLogs.filter(log => 
      log.gender === 'Male' || log.sex === 'Male'
    ).length;
    
    const femaleVisitLogs = visitLogs.filter(log => 
      log.gender === 'Female' || log.sex === 'Female'
    ).length;

    // Use the larger count between registered visitors and visit logs
    const data = [
      { 
        name: 'Male', 
        value: Math.max(maleVisitors, maleVisitLogs),
        count: Math.max(maleVisitors, maleVisitLogs),
        color: '#f7ab2aff' // Darker shade of yellow for male
      },
      { 
        name: 'Female', 
        value: Math.max(femaleVisitors, femaleVisitLogs),
        count: Math.max(femaleVisitors, femaleVisitLogs),
        color: '#FFEB3B' // Lighter shade of yellow for female
      }
    ];

    console.log('📈 Visitors by gender data:', data);
    return data;
  };

  // Custom Tooltip for charts - FIXED VERSION
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip" style={{
          backgroundColor: 'white',
          padding: '10px',
          border: `1px solid ${COLORS.gray}`,
          borderRadius: '5px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <p className="label" style={{ margin: 0, fontWeight: 'bold', color: COLORS.dark }}>
            {`${label || payload[0]?.name || 'Data'}`}
          </p>
          {payload.map((entry, index) => (
            <p key={index} style={{ 
              margin: '5px 0 0 0', 
              color: entry.color || CHART_COLORS[index % CHART_COLORS.length],
              fontWeight: 'bold'
            }}>
              {`${entry.name || 'Visits'}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip specifically for Pie Charts
  const PieChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="custom-tooltip" style={{
          backgroundColor: 'white',
          padding: '10px',
          border: `1px solid ${COLORS.gray}`,
          borderRadius: '5px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: COLORS.dark }}>
            {data.name}
          </p>
          <p style={{ 
            margin: '5px 0 0 0', 
            color: data.color,
            fontWeight: 'bold'
          }}>
            {`Visits: ${data.value}`}
          </p>
          {data.payload.count && (
            <p style={{ 
              margin: '2px 0 0 0', 
              color: COLORS.gray,
              fontSize: '0.8rem'
            }}>
              {`Count: ${data.payload.count}`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Empty state component for charts
  const EmptyChartState = ({ message = "No data available" }) => (
    <div className="text-center py-4">
      <FaExclamationCircle size={32} className="text-muted mb-2" />
      <p className="text-muted mb-0">{message}</p>
    </div>
  );

  // Loading component for charts
  const ChartLoadingState = () => (
    <div className="text-center py-4">
      <Spinner animation="border" variant="primary" className="mb-2" />
      <p className="text-muted mb-0">Loading chart data...</p>
    </div>
  );

  // Check if we have any visit data for charts
  const hasVisitData = visitLogs.length > 0;

  // Helper functions for statistics
  const getTotalInmates = () => inmates.length;
  const getTotalVisitors = () => visitors.length;
  const getTotalGuests = () => guests.length;
  
  // Gender statistics for inmates
  const getMaleInmates = () => inmates.filter(i => i.sex === "Male" || i.gender === "Male").length;
  const getFemaleInmates = () => inmates.filter(i => i.sex === "Female" || i.gender === "Female").length;
  
  // NEW: Gender statistics for visitors
  const getMaleVisitors = () => visitors.filter(v => v.sex === "Male" || v.gender === "Male").length;
  const getFemaleVisitors = () => visitors.filter(v => v.sex === "Female" || v.gender === "Female").length;
  
  const getPendingVisitors = () => visitors.filter(v => v.status === "pending").length;
  const getApprovedVisitors = () => visitors.filter(v => v.status === "approved").length;
  const getRejectedVisitors = () => visitors.filter(v => v.status === "rejected").length;
  const getPendingGuests = () => guests.filter(g => g.status === "pending").length;
  const getApprovedGuests = () => guests.filter(g => g.status === "approved").length;
  const getRejectedGuests = () => guests.filter(g => g.status === "rejected").length;
  const getCompletedGuests = () => guests.filter(g => g.status === "completed").length;
  const getTotalUsers = () => users.length;
  const getTotalAdmins = () => users.filter(u => u.role && u.role.includes('Admin')).length;
  const getTotalStaff = () => users.filter(u => u.role && u.role.includes('Staff')).length;
  
  const getTotalRecordedVisits = () => visitLogs.length;

  const getVisitorsThisWeek = () => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    return visitLogs.filter(log => {
      const visitDate = log.visitDate || log.date || log.createdAt;
      if (!isValidDate(visitDate)) return false;
      const visitDateObj = new Date(visitDate);
      return visitDateObj >= startOfWeek;
    }).length;
  };

  const getVisitorsThisMonth = () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    return visitLogs.filter(log => {
      const visitDate = log.visitDate || log.date || log.createdAt;
      if (!isValidDate(visitDate)) return false;
      const visitDateObj = new Date(visitDate);
      return visitDateObj >= startOfMonth;
    }).length;
  };

  const getVisitorsThisYear = () => {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    
    return visitLogs.filter(log => {
      const visitDate = log.visitDate || log.date || log.createdAt;
      if (!isValidDate(visitDate)) return false;
      const visitDateObj = new Date(visitDate);
      return visitDateObj >= startOfYear;
    }).length;
  };

  const getUniqueVisitors = () => {
    const validLogs = visitLogs.filter(log => {
      const visitDate = log.visitDate || log.date || log.createdAt;
      return (log.personId || log.visitorId || log.guestId) && isValidDate(visitDate);
    });
    const uniqueVisitorIds = new Set(validLogs.map(log => log.personId || log.visitorId || log.guestId));
    return uniqueVisitorIds.size;
  };

  const getRepeatVisitors = () => {
    const visitorCounts = {};
    const validLogs = visitLogs.filter(log => {
      const visitDate = log.visitDate || log.date || log.createdAt;
      return (log.personId || log.visitorId || log.guestId) && isValidDate(visitDate);
    });
    
    validLogs.forEach(log => {
      const visitorId = log.personId || log.visitorId || log.guestId;
      visitorCounts[visitorId] = (visitorCounts[visitorId] || 0) + 1;
    });
    
    return Object.values(visitorCounts).filter(count => count > 1).length;
  };

  const getActiveGuestsNow = () => {
    const today = getSafeDateString(new Date());
    if (!today) return 0;

    return guests.filter(guest => {
      if (!guest.dailyVisits || !Array.isArray(guest.dailyVisits)) return false;
      
      return guest.dailyVisits.some(visit => {
        if (!visit || !visit.visitDate) return false;
        
        const visitDate = getSafeDateString(visit.visitDate);
        if (!visitDate) return false;
        
        return visitDate === today && visit.hasTimedIn && !visit.hasTimedOut;
      });
    }).length;
  };

  // Timer helper functions - UPDATED FOR ALL TIMERS
  const formatTimeRemaining = (minutes) => {
    if (minutes === null || minutes === undefined || isNaN(minutes)) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatTimeIn = (timeIn) => {
    console.log('🕒 Formatting timeIn:', timeIn);
    
    if (!timeIn) {
      console.log('❌ No timeIn provided');
      return 'N/A';
    }

    // If it's already a formatted time string (like "2:30 PM"), just return it
    if (typeof timeIn === 'string' && (timeIn.includes('AM') || timeIn.includes('PM'))) {
      console.log('✅ Already formatted time string:', timeIn);
      return timeIn;
    }

    // If it's a Date object or ISO string, format it
    if (isValidDate(timeIn)) {
      try {
        const date = new Date(timeIn);
        const formattedTime = date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
        console.log('✅ Formatted date to time:', timeIn, '->', formattedTime);
        return formattedTime;
      } catch (error) {
        console.error('❌ Error formatting date:', error);
        return 'N/A';
      }
    }

    // If it's a simple time string without AM/PM, try to parse it
    if (typeof timeIn === 'string' && timeIn.includes(':')) {
      try {
        const [hours, minutes] = timeIn.split(':');
        const hour = parseInt(hours);
        const minute = parseInt(minutes);
        
        if (!isNaN(hour) && !isNaN(minute)) {
          const period = hour >= 12 ? 'PM' : 'AM';
          const twelveHour = hour % 12 || 12;
          const formattedTime = `${twelveHour}:${minute.toString().padStart(2, '0')} ${period}`;
          console.log('✅ Parsed time string:', timeIn, '->', formattedTime);
          return formattedTime;
        }
      } catch (error) {
        console.error('❌ Error parsing time string:', error);
      }
    }

    console.log('❌ Could not format timeIn:', timeIn);
    return 'N/A';
  };

  const getTimerVariant = (minutes) => {
    if (minutes === null || minutes === undefined || isNaN(minutes)) return 'secondary';
    if (minutes > 120) return 'success';
    if (minutes > 30) return 'warning';
    return 'danger';
  };

  const getTimerProgress = (minutes, totalMinutes = 180) => {
    if (minutes === null || minutes === undefined || isNaN(minutes)) return 0;
    return Math.max(0, Math.min(100, (minutes / totalMinutes) * 100));
  };

  // NEW: Get custom timers count by type
  const getCustomVisitorTimers = () => {
    return getVisitorTimers().filter(timer => timer.isCustomTimer).length;
  };

  const getCustomGuestTimers = () => {
    return getGuestTimers().filter(timer => timer.isCustomTimer).length;
  };

  // NEW: Get standard timers count by type
  const getStandardVisitorTimers = () => {
    return getVisitorTimers().filter(timer => !timer.isCustomTimer).length;
  };

  const getStandardGuestTimers = () => {
    return getGuestTimers().filter(timer => !timer.isCustomTimer).length;
  };

  const getActiveVisitorsNow = () => {
    return allActiveTimers.length; // UPDATED: Use all timers
  };

  // NEW: Render timer type badge
  const renderTimerTypeBadge = (timer) => {
    if (timer.isCustomTimer) {
      return (
        <Badge bg="info" className="ms-1" style={{ fontSize: '0.6rem' }}>
          <FaClock className="me-1" />
          Custom: {timer.totalDurationMinutes}m
        </Badge>
      );
    }
    return (
      <Badge bg="secondary" className="ms-1" style={{ fontSize: '0.6rem' }}>
        <FaHourglassHalf className="me-1" />
        Standard: 3h
      </Badge>
    );
  };

  // NEW: Render custom time slot info
  const renderCustomTimeSlotInfo = (timer) => {
    if (!timer.isCustomTimer || !timer.customTimeSlot) return null;
    
    return (
      <div className="extra-small text-info mt-1">
        <strong>Custom Slot:</strong> {timer.customTimeSlot.startTime} - {timer.customTimeSlot.endTime}
      </div>
    );
  };

  // NEW: Render timer card for either visitors or guests
const renderTimerCard = (title, timers, urgentTimers, criticalTimers, topUrgentTimers, customCount, standardCount, type, icon, color) => {
  const hasUrgent = urgentTimers.length > 0;
  const hasCritical = criticalTimers.length > 0;
  const isGuest = type === "Guest"; // Check if this is a guest timer
  
  return (
    <Card className="shadow-sm border-0 h-100">
      <Card.Header 
        className={
          timers.length === 0 ? 'bg-secondary text-white' :
          hasCritical ? 'bg-danger text-white' : 
          hasUrgent ? 'bg-warning text-white' : 
          isGuest && timers.length > 0 ? 'text-white' :
          `bg-${color} text-white`
        }
        style={
          timers.length > 0 && !hasCritical && !hasUrgent && isGuest
            ? { backgroundColor: '#e66464ff', color: 'white' }
            : {}
        }
      >
        <h5 className="mb-0 d-flex align-items-center justify-content-between">
          <div>
            {icon}
            {title}
            <Badge bg="light" text="dark" className="ms-2">
              {timers.length} Active
            </Badge>
            {customCount > 0 && (
              <Badge bg="info" className="ms-2">
                <FaClock className="me-1" />
                {customCount} Custom
              </Badge>
            )}
            {standardCount > 0 && (
              <Badge bg="secondary" className="ms-2">
                <FaHourglassHalf className="me-1" />
                {standardCount} Standard
              </Badge>
            )}
            {hasUrgent && (
              <Badge bg="warning" text="dark" className="ms-2">
                <FaExclamationTriangle className="me-1" />
                {urgentTimers.length} Urgent
              </Badge>
            )}
          </div>
          <div>
            <small>Updates every 5 seconds</small>
          </div>
        </h5>
      </Card.Header>
      <Card.Body className="p-2">
        {timers.length > 0 ? (
          <>
            {topUrgentTimers.map((timer, index) => (
              <div 
                key={timer._id || index}
                className={`mb-2 p-2 border rounded ${
                  timer.timeRemainingMinutes < 10 
                    ? 'border-danger bg-danger bg-opacity-10' 
                    : timer.timeRemainingMinutes < 30 
                    ? 'border-warning bg-warning bg-opacity-10' 
                    : timer.isCustomTimer
                    ? 'border-info bg-info bg-opacity-10'
                    : 'border-success bg-success bg-opacity-10'
                }`}
              >
                <Row className="align-items-center">
                  <Col md={6}>
                    <div className="d-flex align-items-center">
                      <div className="me-2">
                        {timer.isCustomTimer ? (
                          <FaClock size={18} className={
                            timer.timeRemainingMinutes < 10 
                              ? 'text-danger' 
                              : timer.timeRemainingMinutes < 30 
                              ? 'text-warning' 
                              : 'text-info'
                          } />
                        ) : (
                          <FaUserClock size={18} className={
                            timer.timeRemainingMinutes < 10 
                              ? 'text-danger' 
                              : timer.timeRemainingMinutes < 30 
                              ? 'text-warning' 
                              : 'text-success'
                          } />
                        )}
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-bold small text-white">
                          {timer.personName || 'Unknown Visitor'}
                          {renderTimerTypeBadge(timer)}
                        </div>
                        <div className="text-white extra-small" style={{ opacity: 0.9 }}>
                          In: {formatTimeIn(timer.timeIn)}
                        </div>
                        <div className="extra-small text-white" style={{ opacity: 0.9 }}>
                          ID: {timer.personId || 'N/A'} • {type}
                        </div>
                        {renderCustomTimeSlotInfo(timer)}
                      </div>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="extra-small">
                      <div className="fw-bold text-white">
                        {isGuest ? 'Visit Purpose:' : 'PDL:'}
                      </div>
                      <div className="text-white" style={{ opacity: 0.9 }}>
                        {isGuest ? (timer.visitPurpose || 'General Visit') : (timer.inmateName || 'N/A')}
                      </div>
                      {timer.isCustomTimer && (
                        <div className="text-info mt-1">
                          <small>Total: {timer.totalDurationMinutes}m</small>
                        </div>
                      )}
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="text-center">
                      <Badge 
                        bg={getTimerVariant(timer.timeRemainingMinutes)} 
                        className="p-1 small"
                        style={{ fontSize: '0.75rem' }}
                      >
                        {formatTimeRemaining(timer.timeRemainingMinutes)}
                      </Badge>
                      <div className="mt-1" style={{ maxWidth: '80px', margin: '0 auto' }}>
                        <ProgressBar 
                          now={getTimerProgress(timer.timeRemainingMinutes, timer.totalDurationMinutes)} 
                          variant={getTimerVariant(timer.timeRemainingMinutes)}
                          animated={timer.timeRemainingMinutes < 30}
                          style={{ 
                            height: '6px',
                            backgroundColor: '#e9ecef'
                          }}
                        />
                      </div>
                      {timer.timeRemainingMinutes < 10 && (
                        <Badge bg="danger" className="p-1 small mt-1" style={{ fontSize: '0.7rem' }}>
                          <FaHourglassEnd className="me-1" />
                          Critical
                        </Badge>
                      )}
                      {timer.timeRemainingMinutes >= 10 && timer.timeRemainingMinutes < 30 && (
                        <Badge bg="warning" text="dark" className="p-1 small mt-1" style={{ fontSize: '0.7rem' }}>
                          <FaExclamationTriangle className="me-1" />
                          Urgent
                        </Badge>
                      )}
                    </div>
                  </Col>
                </Row>
              </div>
            ))}
            
            {timers.length > 5 && (
              <div className="text-center mt-2">
                <Alert variant="info" className="mb-0 py-2">
                  <strong>... and {timers.length - 5} more active {type.toLowerCase()} timers</strong>
                  <br />
                  <small>
                    Total {timers.length} {type.toLowerCase()}s with active timers 
                    ({standardCount} standard, {customCount} custom)
                  </small>
                </Alert>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-3">
            <FaUserClock size={32} style={{ color: '#ffffff92' }} className="mb-2" />
            <h6 style={{ color: '#ffffff92' }}>No Active {title}</h6>
            <p style={{ color: '#ffffff92' }} className="small mb-0">
              When {type.toLowerCase()}s check in and are approved, their timers (standard 3-hour or custom) will appear here.
            </p>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 style={{ 
          color: 'white', 
          fontWeight: "600",
          borderBottom: '2px solid #FFD700',
          paddingBottom: "10px",
          margin: 0
        }}>
          Visitor Management Dashboard
        </h2>
        <Button 
          variant="outline-info" 
          size="sm" 
          onClick={fetchDashboardData}
          disabled={loading}
          className="refresh-data-btn"
          style={{ 
            borderColor: '#FFD700', 
            color: '#FFD700',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FFD700';
            e.currentTarget.style.color = '#000000';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#FFD700';
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="mb-3">
          <FaExclamationCircle className="me-2" />
          {error}
        </Alert>
      )}

      {lastUpdate && (
        <div className="text-end mb-3">
          <small style={{ color: '#FFD700' }}>
            Last updated: {lastUpdate.toLocaleTimeString()}
          </small>
        </div>
      )}

      {/* Critical Alert Section - SEPARATED BY TYPE */}
      {(getCriticalVisitorTimers().length > 0 || getCriticalGuestTimers().length > 0) && (
        <Row className="mb-3">
          <Col>
            <Alert variant="danger" className="d-flex align-items-center">
              <FaExclamationTriangle size={24} className="me-3" />
              <div>
                <strong>CRITICAL ALERT:</strong> 
                {getCriticalVisitorTimers().length > 0 && ` ${getCriticalVisitorTimers().length} visitor(s)`}
                {getCriticalVisitorTimers().length > 0 && getCriticalGuestTimers().length > 0 && ' and'}
                {getCriticalGuestTimers().length > 0 && ` ${getCriticalGuestTimers().length} guest(s)`}
                {' have less than 10 minutes remaining!'}
                <br />
                <small>Please ensure they complete their visit before time expires.</small>
              </div>
            </Alert>
          </Col>
        </Row>
      )}

      {/* SEPARATED ACTIVE TIMERS Section - VISITORS vs GUESTS */}
      <Row className="mb-4">
        <Col md={6} className="mb-3">
          {renderTimerCard(
            " Active Visitor Timers",
            getVisitorTimers(),
            getUrgentVisitorTimers(),
            getCriticalVisitorTimers(),
            getTopUrgentVisitorTimers(),
            getCustomVisitorTimers(),
            getStandardVisitorTimers(),
            "Visitor",
            <FaUserFriends className="me-2" />,
            "success"
          )}
        </Col>
        <Col md={6} className="mb-3">
          {renderTimerCard(
            " Active Guest Timers",
            getGuestTimers(),
            getUrgentGuestTimers(),
            getCriticalGuestTimers(),
            getTopUrgentGuestTimers(),
            getCustomGuestTimers(),
            getStandardGuestTimers(),
            "Guest",
            <FaUserTie className="me-2" />,
            "warning"
          )}
        </Col>
      </Row>

      {/* Timer Summary Cards - SEPARATED BY TYPE */}
      <Row className="mb-4 g-3">
        <Col md={3}>
          <Card className="text-center h-100 shadow-sm" style={{ borderLeft: '2px solid #ffc107bf', backgroundColor: '#353434a7', borderRight: '2px solid #ffc107bf', borderTop: '6px solid #ffc107bf', borderBottom: '2px solid #ffc107bf', borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <FaUserFriends size={25} className="mb-2" style={{ color: COLORS.success }} />
              <Card.Title style={{ fontSize: "0.9rem", color: '#FFD700' }}>Active Visitors</Card.Title>
              <Card.Text style={{ fontSize: "1.5rem", fontWeight: "bold", color: 'white' }}>
                {getVisitorTimers().length}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                Visitors with active timers
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="text-center h-100 shadow-sm" style={{ borderLeft: '2px solid #ffc107bf', backgroundColor: '#353434a7', borderRight: '2px solid #ffc107bf', borderTop: '6px solid #ffc107bf', borderBottom: '2px solid #ffc107bf', borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <FaUserTie size={25} className="mb-2" style={{ color: COLORS.warning }} />
              <Card.Title style={{ fontSize: "0.9rem", color: '#FFD700' }}>Active Guests</Card.Title>
              <Card.Text style={{ fontSize: "1.5rem", fontWeight: "bold", color: 'white' }}>
                {getGuestTimers().length}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                Guests with active timers
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="text-center h-100 shadow-sm" style={{ borderLeft: '2px solid #ffc107bf', backgroundColor: '#353434a7', borderRight: '2px solid #ffc107bf', borderTop: '6px solid #ffc107bf', borderBottom: '2px solid #ffc107bf', borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <FaClock size={25} className="mb-2" style={{ color: COLORS.info }} />
              <Card.Title style={{ fontSize: "0.9rem", color: '#FFD700' }}>Custom Timers</Card.Title>
              <Card.Text style={{ fontSize: "1.5rem", fontWeight: "bold", color: 'white' }}>
                {getCustomVisitorTimers() + getCustomGuestTimers()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                Custom duration timers
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="text-center h-100 shadow-sm" style={{ borderLeft: '2px solid #ffc107bf', backgroundColor: '#353434a7', borderRight: '2px solid #ffc107bf', borderTop: '6px solid #ffc107bf', borderBottom: '2px solid #ffc107bf', borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <FaExclamationTriangle size={25} className="mb-2" style={{ color: COLORS.danger }} />
              <Card.Title style={{ fontSize: "0.9rem", color: '#FFD700' }}>Urgent Timers</Card.Title>
              <Card.Text style={{ fontSize: "1.5rem", fontWeight: "bold", color: 'white' }}>
                {getUrgentVisitorTimers().length + getUrgentGuestTimers().length}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                Less than 30 minutes
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Core Statistics */}
      <Row className="mb-4">
        <Col>
          <h5 className="mb-3" style={{ color: '#ffd900ff', borderBottom: "1px solid #dee2e6", paddingBottom: "8px" }}>
            <FaUsers className="me-2" />
            Core Statistics
          </h5>
        </Col>
      </Row>
      <Row className="mb-4 g-3">
        {/* Total Inmates Card */}
        <Col md={3}>
          <Card 
            className="text-center h-100 shadow-sm" 
            onClick={getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? navigateToMaleInmates : undefined}
            style={{ 
              cursor: getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? 'pointer' : 'default',
              transition: 'all 0.3s ease',
              borderLeft: '2px solid #ffc107bf',
              borderRight: '2px solid #ffc107bf',
              borderTop: '6px solid #ffc107bf',
              borderBottom: '2px solid #ffc107bf',
              backgroundColor: '#353434a7',
              borderRadius: '12px'
            }}
            onMouseEnter={getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? (e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            } : undefined}
            onMouseLeave={getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? (e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            } : undefined}
          >
            <Card.Body className="p-3">
              <FaUsers size={30} className="mb-2" style={{ color: COLORS.primary }} />
              <Card.Title style={{ fontSize: "1rem", color: '#ffd900ff'}}>Total PDLs</Card.Title>
              <Card.Text style={{ fontSize: "1.8rem", fontWeight: "bold", color: 'white' }}>
                {getTotalInmates()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                <FaMars className="text-info me-1" /> {getMaleInmates()} Male • 
                <FaVenus className="text-danger ms-2 me-1" /> {getFemaleInmates()} Female
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Total Visitors Card */}
        <Col md={3}>
          <Card 
            className="text-center h-100 shadow-sm"
            onClick={navigateToVisitors}
            style={{ 
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              borderLeft: '2px solid #ffc107bf',
              borderRight: '2px solid #ffc107bf',
              borderTop: '6px solid #ffc107bf',
              borderBottom: '2px solid #ffc107bf',
              backgroundColor: '#353434a7',
              borderRadius: '12px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <Card.Body className="p-3">
              <FaUserFriends size={30} className="mb-2" style={{ color: COLORS.success }} />
              <Card.Title style={{ fontSize: "1rem", color: '#ffd900ff'}}>Total Visitors</Card.Title>
              <Card.Text style={{ fontSize: "1.8rem", fontWeight: "bold", color: 'white'  }}>
                {getTotalVisitors()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                <FaMars className="text-info me-1" /> {getMaleVisitors()} Male • 
                <FaVenus className="text-danger ms-2 me-1" /> {getFemaleVisitors()} Female
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Total Male Inmates Card */}
        <Col md={3}>
          <Card 
            className="text-center h-100 shadow-sm"
            onClick={getBasePath() !== '/femaleadmin' && getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? navigateToMaleInmates : undefined}
            style={{ 
              cursor: getBasePath() !== '/femaleadmin' && getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? 'pointer' : 'default',
              transition: 'all 0.3s ease',
              borderLeft: '2px solid #ffc107bf',
              borderRight: '2px solid #ffc107bf',
              borderTop: '6px solid #ffc107bf',
              borderBottom: '2px solid #ffc107bf',
              backgroundColor: '#353434a7',
              borderRadius: '12px'
            }}
            onMouseEnter={getBasePath() !== '/femaleadmin' && getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? (e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            } : undefined}
            onMouseLeave={getBasePath() !== '/femaleadmin' && getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? (e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            } : undefined}
          >
            <Card.Body className="p-3">
              <FaMars size={30} className="mb-2" style={{ color: COLORS.info }} />
              <Card.Title style={{ fontSize: "1rem", color: '#ffd900ff'}}>Male PDLs</Card.Title>
              <Card.Text style={{ fontSize: "1.8rem", fontWeight: "bold", color: 'white' }}>
                {getMaleInmates()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                Total male PDL population
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Total Female Inmates Card */}
        <Col md={3}>
          <Card 
            className="text-center h-100 shadow-sm"
            onClick={getBasePath() !== '/maleadmin' && getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? navigateToFemaleInmates : undefined}
            style={{ 
              cursor: getBasePath() !== '/maleadmin' && getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? 'pointer' : 'default',
              transition: 'all 0.3s ease',
              borderLeft: '2px solid #ffc107bf',
              borderRight: '2px solid #ffc107bf',
              borderTop: '6px solid #ffc107bf',
              borderBottom: '2px solid #ffc107bf',
              backgroundColor: '#353434a7',
              borderRadius: '12px'
            }}
            onMouseEnter={getBasePath() !== '/maleadmin' && getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? (e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            } : undefined}
            onMouseLeave={getBasePath() !== '/maleadmin' && getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? (e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            } : undefined}
          >
            <Card.Body className="p-3">
              <FaVenus size={30} className="mb-2" style={{ color: COLORS.danger }} />
              <Card.Title style={{ fontSize: "1rem", color: '#ffd900ff'}}>Female PDLs</Card.Title>
              <Card.Text style={{ fontSize: "1.8rem", fontWeight: "bold", color: 'white' }}>
                {getFemaleInmates()}
              </Card.Text>
             <div className="small" style={{ color: '#ffd9009a' }}>
                Total female PDL population
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Additional Gender Statistics */}
      <Row className="mb-4 g-3">
        {/* Total Male Visitors Card */}
        <Col md={3}>
          <Card className="text-center h-100 shadow-sm" style={{ borderLeft: '2px solid #ffc107bf', backgroundColor: '#353434a7', borderRight: '2px solid #ffc107bf', borderTop: '6px solid #ffc107bf', borderBottom: '2px solid #ffc107bf', borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <FaMars size={30} className="mb-2" style={{ color: COLORS.info }} />
              <Card.Title style={{ fontSize: "1rem", color: '#ffd900ff'}}>Male Visitors</Card.Title>
              <Card.Text style={{ fontSize: "1.8rem", fontWeight: "bold", color: 'white'  }}>
                {getMaleVisitors()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                Total registered male visitors
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Total Female Visitors Card */}
        <Col md={3}>
          <Card className="text-center h-100 shadow-sm" style={{ borderLeft: '2px solid #ffc107bf', backgroundColor: '#353434a7', borderRight: '2px solid #ffc107bf', borderTop: '6px solid #ffc107bf', borderBottom: '2px solid #ffc107bf', borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <FaVenus size={30} className="mb-2" style={{ color: COLORS.danger }} />
              <Card.Title style={{ fontSize: "1rem", color: '#ffd900ff' }}>Female Visitors</Card.Title>
              <Card.Text style={{ fontSize: "1.8rem", fontWeight: "bold", color: 'white' }}>
                {getFemaleVisitors()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                Total registered female visitors
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Total Guests Card */}
        <Col md={3}>
          <Card 
            className="text-center h-100 shadow-sm"
            onClick={navigateToGuests}
            style={{ 
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              borderLeft: '2px solid #ffc107bf',
              borderRight: '2px solid #ffc107bf',
              borderTop: '6px solid #ffc107bf',
              backgroundColor: '#353434a7',
              borderBottom: '2px solid #ffc107bf',
              borderRadius: '12px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <Card.Body className="p-3">
              <FaUserFriends size={30} className="mb-2" style={{ color: COLORS.warning }} />
              <Card.Title style={{ fontSize: "1rem", color: '#ffd900ff' }}>Total Guests</Card.Title>
              <Card.Text style={{ fontSize: "1.8rem", fontWeight: "bold", color: 'white' }}>
                {getTotalGuests()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                <FaUserCheck className="text-success me-1" /> {getApprovedGuests()} Approved
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Total System Users Card */}
        <Col md={3}>
          <Card 
            className="text-center h-100 shadow-sm"
            onClick={getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? navigateToUserManagement : undefined}
            style={{ 
              cursor: getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? 'pointer' : 'default',
              transition: 'all 0.3s ease',
              borderLeft: '2px solid #ffc107bf',
              borderRight: '2px solid #ffc107bf',
              borderTop: '6px solid #ffc107bf',
              borderBottom: '2px solid #ffc107bf',
              backgroundColor: '#353434a7',
              borderRadius: '12px'
            }}
            onMouseEnter={getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? (e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            } : undefined}
            onMouseLeave={getBasePath() !== '/malestaff' && getBasePath() !== '/femalestaff' && getBasePath() !== '/staff' ? (e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            } : undefined}
          >
            <Card.Body className="p-3">
              <FaUser size={30} className="mb-2" style={{ color: COLORS.purple }} />
              <Card.Title style={{ fontSize: "1rem", color: '#ffd900ff'}}>Total System Users</Card.Title>
              <Card.Text style={{ fontSize: "1.8rem", fontWeight: "bold", color: 'white' }}>
                {getTotalUsers()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                <FaUserShield className="me-1" /> {getTotalAdmins()} Admin • 
                <FaUserTie className="ms-2 me-1" /> {getTotalStaff()} Staff
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Visit Statistics Charts */}
      <Row className="mb-4">
        <Col>
          <h5 className="mb-3" style={{ color: '#ffd900ff', borderBottom: "1px solid #dee2e6", paddingBottom: "8px" }}>
            <FaChartBar className="me-2" />
            Visit Statistics Charts
            {hasVisitData && (
              <span className="ms-2" style={{ 
                backgroundColor: 'white', 
                color: '#000000', 
                padding: '0.35em 0.65em',
                fontSize: '0.75em',
                borderRadius: '0.375rem',
                display: 'inline-block',
                lineHeight: '1'
              }}>
                {visitLogs.length} Records
              </span>
            )}
          </h5>
        </Col>
      </Row>

      {chartLoading ? (
        <Row className="mb-4">
          <Col>
            <Card className="text-center shadow-sm border-0">
              <Card.Body className="py-5">
                <ChartLoadingState />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      ) : !hasVisitData ? (
        <Row className="mb-4">
          <Col>
            <Card className="text-center shadow-sm border-0">
              <Card.Body className="py-5">
                <EmptyChartState message="No visit data available. Visit logs will appear here once visitors and guests start checking in." />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      ) : (
        <>
          <Row className="mb-4 g-3">
            {/* Weekly Visits Line Chart */}
            <Col md={6}>
              <Card className="shadow-sm border-0 h-100">
                <Card.Header style={{ backgroundColor: '#ffd900c5', color: '#ffd900ff'}}>
                  <h6 className="mb-0" style={{color: '#ffffffff'}}>Weekly Visit Trend</h6>
                </Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={getWeeklyVisitData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke={'#898989b7'} />
                      <XAxis dataKey="name" stroke={'white'} />
                      <YAxis stroke={'#898989b7'} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="visits" 
                        stroke={'#ffd900ff'} 
                        strokeWidth={2}
                        dot={{ fill: 'white', strokeWidth: 1, r: 4 }}
                        activeDot={{ r: 6, fill: 'red'}}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>

            {/* Visit Type Distribution Pie Chart */}
            <Col md={6}>
              <Card className="shadow-sm border-0 h-100">
                <Card.Header style={{ backgroundColor: '#ffd900c5', color: '#ffd900ff'}}>
                  <h6 className="mb-0" style={{color: 'white'}}>Visit Type Distribution</h6>
                </Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={getVisitTypeData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getVisitTypeData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieChartTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="mb-4 g-3">
            {/* Monthly Visits Bar Chart */}
            <Col md={6}>
              <Card className="shadow-sm border-0 h-100">
                <Card.Header style={{ backgroundColor: '#ffd900c5', color: '#ffd900ff'}}>
                  <h6 className="mb-0" style={{color: 'white'}}>Monthly Visit Distribution</h6>
                </Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={getMonthlyVisitData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke={'#898989b7'} />
                      <XAxis dataKey="name" stroke={'white'} />
                      <YAxis stroke={'#898989b7'} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="visits" fill={'#ffd500ff'} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>

            {/* Visitors by Gender Pie Chart */}
            <Col md={6}>
              <Card className="shadow-sm border-0 h-100">
                <Card.Header style={{ backgroundColor: '#ffd900c5', color: '#ffd900ff' }}>
                  <h6 className="mb-0" style={{color: 'white'}}>Visitors by Gender</h6>
                </Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={getVisitorsByGenderData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getVisitorsByGenderData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieChartTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Time of Day Chart - Full Width with Increased Height */}
          <Row className="mb-4">
            <Col md={12}>
              <Card className="shadow-sm border-0 h-100">
                <Card.Header style={{ backgroundColor: '#ffd900c5', color: '#ffd900ff' }}>
                  <h6 className="mb-0" style={{color: 'white'}}>Visits by Time of Day</h6>
                </Card.Header>
                <Card.Body>
                  {getTimeOfDayData().some(slot => slot.visits > 0) ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart 
                        data={getTimeOfDayData()}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={'#898989b7'} />
                        <XAxis 
                          dataKey="name" 
                          stroke={'white'}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          stroke={'#898989b7'}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar 
                          dataKey="visits" 
                          fill={'#ffc800ff'} 
                          radius={[4, 4, 0, 0]}
                          barSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChartState 
                      message={
                        visitLogs.length > 0 
                          ? "No time data found in visit logs. Check if time fields exist."
                          : "No visit data available"
                      } 
                    />
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Quick Stats Cards */}
      <Row className="mb-4">
        <Col>
          <h5 className="mb-3" style={{ color: '#ffd900ff', borderBottom: "1px solid #dee2e6", paddingBottom: "8px" }}>
            <FaChartBar className="me-2" />
            Visit Statistics Summary
          </h5>
        </Col>
      </Row>
      <Row className="mb-4 g-3">
        <Col md={4}>
          <Card className="text-center h-100 shadow-sm border-0" style={{ 
            background: `linear-gradient(135deg, ${COLORS.primary}20 0%, ${COLORS.secondary}20 100%)`,
            border: `1px solid ${COLORS.primary}30`
          }}>
            <Card.Body className="p-3">
              <FaCalendarWeek size={30} className="mb-2" style={{ color: COLORS.primary }} />
              <Card.Title style={{ fontSize: "1rem", color: '#ffd900ff'}}>Visits This Week</Card.Title>
              <Card.Text style={{ fontSize: "1.8rem", fontWeight: "bold", color: 'white' }}>
                {getVisitorsThisWeek()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                All check-ins this week
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="text-center h-100 shadow-sm border-0" style={{ 
            background: `linear-gradient(135deg, ${COLORS.info}20 0%, ${COLORS.purple}20 100%)`,
            border: `1px solid ${COLORS.info}30`
          }}>
            <Card.Body className="p-3">
              <FaCalendarAlt size={30} className="mb-2" style={{ color: COLORS.info }} />
              <Card.Title style={{ fontSize: "1rem", color: '#ffd900ff' }}>Visits This Month</Card.Title>
              <Card.Text style={{ fontSize: "1.8rem", fontWeight: "bold", color: 'white'  }}>
                {getVisitorsThisMonth()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                All check-ins this month
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="text-center h-100 shadow-sm border-0" style={{ 
            background: `linear-gradient(135deg, ${COLORS.success}20 0%, ${COLORS.warning}20 100%)`,
            border: `1px solid ${COLORS.success}30`
          }}>
            <Card.Body className="p-3">
              <FaCalendarDay size={30} className="mb-2" style={{ color: COLORS.success }} />
              <Card.Title style={{ fontSize: "1rem", color: '#ffd900ff'}}>Visits This Year</Card.Title>
              <Card.Text style={{ fontSize: "1.8rem", fontWeight: "bold", color: 'white'  }}>
                {getVisitorsThisYear()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                All check-ins this year
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Visitor Analytics */}
      <Row className="mb-4">
        <Col>
          <h5 className="mb-3" style={{ color: '#ffd900ff', borderBottom: "1px solid #dee2e6", paddingBottom: "8px" }}>
            <FaUserCheck className="me-2" />
            Visitor Analytics
          </h5>
        </Col>
      </Row>
      <Row className="mb-4 g-3">
        <Col md={3}>
          <Card className="text-center h-100 shadow-sm" style={{ borderLeft: '2px solid #ffc107bf', backgroundColor: '#353434a7', borderRight: '2px solid #ffc107bf', borderTop: '6px solid #ffc107bf', borderBottom: '2px solid #ffc107bf', borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <FaUserFriends size={25} className="mb-2" style={{ color: COLORS.primary }} />
              <Card.Title style={{ fontSize: "0.9rem", color: '#ffd900ff'}}>Unique Visitors</Card.Title>
              <Card.Text style={{ fontSize: "1.5rem", fontWeight: "bold", color: 'white'  }}>
                {getUniqueVisitors()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                Different people who visited
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="text-center h-100 shadow-sm" style={{ borderLeft: '2px solid #ffc107bf', backgroundColor: '#353434a7', borderRight: '2px solid #ffc107bf', borderTop: '6px solid #ffc107bf', borderBottom: '2px solid #ffc107bf', borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <FaUserCheck size={25} className="mb-2" style={{ color: COLORS.success }} />
              <Card.Title style={{ fontSize: "0.9rem", color: '#ffd900ff'}}>Repeat Visitors</Card.Title>
              <Card.Text style={{ fontSize: "1.5rem", fontWeight: "bold", color: 'white'  }}>
                {getRepeatVisitors()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                Visitors who came multiple times
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="text-center h-100 shadow-sm" style={{ borderLeft: '2px solid #ffc107bf', backgroundColor: '#353434a7', borderRight: '2px solid #ffc107bf', borderTop: '6px solid #ffc107bf', borderBottom: '2px solid #ffc107bf', borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <FaUserClock size={25} className="mb-2" style={{ color: COLORS.warning }} />
              <Card.Title style={{ fontSize: "0.9rem", color: '#ffd900ff'}}>Active Visitors</Card.Title>
              <Card.Text style={{ fontSize: "1.5rem", fontWeight: "bold", color: 'white' }}>
                {getActiveVisitorsNow()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                Visitors with active timers
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="text-center h-100 shadow-sm" style={{ borderLeft: '2px solid #ffc107bf', backgroundColor: '#353434a7', borderRight: '2px solid #ffc107bf', borderTop: '6px solid #ffc107bf', borderBottom: '2px solid #ffc107bf', borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <FaHistory size={25} className="mb-2" style={{ color: COLORS.info }} />
              <Card.Title style={{ fontSize: "0.9rem", color: '#ffd900ff'}}>Total Recorded Visits</Card.Title>
              <Card.Text style={{ fontSize: "1.5rem", fontWeight: "bold", color: 'white' }}>
                {getTotalRecordedVisits()}
              </Card.Text>
              <div className="small" style={{ color: '#ffd9009a' }}>
                All time visit records
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard;