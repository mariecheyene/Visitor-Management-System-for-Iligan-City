import React, { useState, useEffect } from "react";
import { NavLink, Routes, Route, useLocation, Navigate } from "react-router-dom";
import "./css/Style.css";
import "boxicons/css/boxicons.min.css";
import "bootstrap/dist/css/bootstrap.min.css";
import DashboardHome from "./Components/Dashboard";
import RecordVisits from "./Components/Admin/RecordVisits";
import VisitorMaleDivision from "./Components/Admin/VisitorMaleDivision";
import MaleInmates from "./Components/Admin/MaleInmates";
import Crimes from "./Components/Admin/Crimes";
import ReportsAnalytics from "./Components/Admin/ReportsAnalytics";
import UserManagement from "./Components/Admin/UserManagement";
import Logs from "./Components/Admin/Logs";
import Guest from "./Components/Admin/Guest";
import ScanQR from "./Components/Admin/ScanQr";
import PendingRequests from "./Components/Admin/PendingRequests";
import ProfileModal from "./Components/Admin/ProfileModal";
import { Badge, Dropdown, Button, Modal } from "react-bootstrap";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BsQrCodeScan } from 'react-icons/bs';

const MaleAdmin = () => {
  const [isSidebarClosed, setIsSidebarClosed] = useState(false);
  const [user, setUser] = useState(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const location = useLocation();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    setUser(userData);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsSidebarClosed(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <div className="dashboard">
      <div className={`sidebar ${isSidebarClosed ? "close" : ""}`}>
        <NavLink to="/maleadmin/dashboard" className="logo">
          <div className="logo-content">
            <div className="logo-img">
              <img src="/img/logo.png" alt="LANAO DEL NORTE DISTRICT JAIL REGION 10 Logo" />
            </div>
            <div className="logo-text">
              <div className="logo-main">LANAO DEL NORTE DISTRICT JAIL</div>
              <div className="logo-subtitle">REGION 10 </div>
            </div>
          </div>
        </NavLink>
        
        <ul className="side-menu">
          {[
            { name: "Dashboard", icon: "bx bxs-dashboard", path: "/maleadmin/dashboard" },
            { name: "Recorded Visits", icon: "bx bxs-calendar-check", path: "/maleadmin/record-visits" },
            { name: "Visitors", icon: "bx bxs-user-voice", path: "/maleadmin/visitor-male-division" },
            { name: "Guests", icon: "bx bxs-user-badge", path: "/maleadmin/guest" },
            { name: "Male PDLs", icon: "bx bxs-user-account", path: "/maleadmin/male-inmates" },
            { name: "Crime List", icon: "bx bxs-error", path: "/maleadmin/crimes" },
            { name: "Reports", icon: "bx bxs-report", path: "/maleadmin/reports-analytics" },
            { name: "Pending Visitors", icon: "bx bxs-time-five", path: "/maleadmin/pending-requests" },
            { name: "User Management", icon: "bx bxs-user-detail", path: "/maleadmin/user-management" },
            { name: "System Logs", icon: "bx bxs-notepad", path: "/maleadmin/logs" },
          ].map((link, index) => (
            <li key={index}>
              <NavLink
                to={link.path}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <i className={link.icon}></i>
                <span>{link.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        
        <ul className="side-menu">
          <li>
            <a href="#" className="logout" onClick={(e) => { e.preventDefault(); setShowLogoutConfirm(true); }}>
              <i className="bx bx-log-out-circle"></i>
              <span>Logout</span>
            </a>
          </li>
        </ul>
      </div>

      <div className="content">
        {/* FIXED: Added fixed-nav class */}
        <nav className="fixed-nav">
          <i 
            className="bx bx-menu toggle-sidebar" 
            onClick={() => setIsSidebarClosed(!isSidebarClosed)}
          ></i>
          
          <div className="nav-title">
            <h5 className="mb-0"></h5>
            <div className="real-time-clock">
              {formatTime(currentTime)} | {formatDate(currentTime)}
            </div>
          </div>
          
          <Button 
            variant="warning" 
            onClick={() => setShowScanModal(true)}
            className="me-3"
            size="sm"
            style={{ backgroundColor: '#FFD700', color: '#000000', fontWeight: '600', boxShadow: '0 0 15px rgba(229, 255, 0, 0.74)'  }}>
            <svg className="me-1" width="16" height="16" viewBox="0 0 24 24" fill="#000000">
              <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm8-12v8h8V3h-8zm6 6h-4V5h4v4z"/>
              <path d="M19 19h2v2h-2zM15 15h2v2h-2zM15 19h2v2h-2zM11 11h2v2h-2zM7 15h2v2H7zM11 15h2v2h-2zM11 19h2v2h-2z"/>
            </svg>
            Scan QR
          </Button>
          
          <Dropdown className="profile-dropdown">
            <Dropdown.Toggle variant="link" id="dropdown-profile">
              <div className="profile">
                <img src="/img/admin.png" alt="Profile" />
                <span className="profile-info">
                  <strong>{user?.name || 'Male Admin'}</strong>
                  <small>MALE ADMIN</small>
                </span>
              </div>
            </Dropdown.Toggle>

            <Dropdown.Menu align="end">
              <Dropdown.Header>
                Signed in as {user?.name}
              </Dropdown.Header>
              <Dropdown.Item onClick={() => setShowProfileModal(true)}>
                <i className="bx bx-user me-2"></i>
                Profile
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => setShowLogoutConfirm(true)}>
                <i className="bx bx-log-out me-2"></i>
                Logout
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </nav>

        {/* FIXED: Added main-content class */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/maleadmin/dashboard" />} />
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/record-visits" element={<RecordVisits />} />
            <Route path="/visitor-male-division" element={<VisitorMaleDivision />} />
            <Route path="/guest" element={<Guest />} />
            <Route path="/male-inmates" element={<MaleInmates />} />
            <Route path="/crimes" element={<Crimes />} />
            <Route path="/reports-analytics" element={<ReportsAnalytics />} />
            <Route path="/pending-requests" element={<PendingRequests />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </main>
      </div>

      <ScanQR 
        show={showScanModal} 
        onHide={() => setShowScanModal(false)} 
      />

      <ProfileModal 
        show={showProfileModal} 
        onHide={() => setShowProfileModal(false)}
        user={user}
        onUserUpdate={handleUserUpdate}
      />

      <ToastContainer 
        position="bottom-right"
        autoClose={5001}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      <Modal show={showLogoutConfirm} onHide={() => setShowLogoutConfirm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Logout</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to logout?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleLogout}>
            Logout
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MaleAdmin;