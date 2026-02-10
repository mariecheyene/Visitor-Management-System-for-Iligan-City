const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const QRCode = require('qrcode');
const Papa = require('papaparse');
const bcrypt = require('bcrypt');
require("dotenv").config();
const archiver = require('archiver');
const { Parser } = require('json2csv');
const { generateOTP, sendOTPEmail, sendPasswordResetOTP } = require('./utils/emailService');
const app = express();
const PORT = process.env.PORT || 5001;


// MongoDB Connection
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI is not defined");
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("Connected to MongoDB Atlas"))
.catch((err) => console.error("MongoDB connection error:", err));



// Create uploads directory if not exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(express.json());
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true
}));
app.use('/uploads', express.static(uploadDir));


// Counter Schema for auto-increment IDs
const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

// Helper to generate auto-increment IDs
const autoIncrement = async (modelName) => {
  const counter = await Counter.findByIdAndUpdate(
    modelName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq.toString().padStart(3, '0');
};

// Generate QR Code
const generateQRCode = async (data) => {
  try {
    return await QRCode.toDataURL(JSON.stringify(data));
  } catch (err) {
    console.error('QR generation error:', err);
    return null;
  }
};

// Helper function to calculate duration between timeIn and timeOut
const calculateDuration = (timeIn, timeOut) => {
  if (!timeIn || !timeOut) return 'N/A';
  
  try {
    // Parse time strings (format: "HH:MM AM/PM")
    const parseTime = (timeStr) => {
      const [time, period] = timeStr.split(' ');
      const [hours, minutes] = time.split(':');
      let hour = parseInt(hours);
      
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      
      return new Date(0, 0, 0, hour, parseInt(minutes));
    };
    
    const start = parseTime(timeIn);
    const end = parseTime(timeOut);
    const diffMs = end - start;
    
    if (diffMs < 0) return 'Invalid';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  } catch (error) {
    console.error('Error calculating duration:', error);
    return 'Error';
  }
};

// NEW: Helper function to calculate duration between two time slots
const calculateTimeDuration = (startTime, endTime) => {
  try {
    const parseTime = (timeStr) => {
      const cleanTime = timeStr.trim().toUpperCase();
      const [time, period] = cleanTime.split(' ');
      const [hours, minutes] = time.split(':');
      
      let hour = parseInt(hours);
      const minute = parseInt(minutes);
      
      if (isNaN(hour) || isNaN(minute)) {
        throw new Error('Invalid time format');
      }
      
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error('Time out of valid range');
      }
      
      return new Date(0, 0, 0, hour, minute);
    };
    
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }
    
    const diffMs = end - start;
    
    if (diffMs < 0) {
      return 'Invalid time range';
    }
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  } catch (error) {
    console.error('Error calculating time duration:', error);
    return 'N/A';
  }
};

// NEW: Time slot validation function
const validateTimeSlot = (startTime, endTime) => {
  try {
    const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s*(AM|PM)$/i;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      throw new Error('Time format should be "HH:MM AM/PM" (e.g., "09:00 AM")');
    }

    const duration = calculateTimeDuration(startTime, endTime);
    
    if (duration === 'Invalid time range' || duration === 'N/A') {
      throw new Error('Invalid time range - end time must be after start time');
    }

    return true;
  } catch (error) {
    throw new Error(`Time slot validation failed: ${error.message}`);
  }
};

// NEW: Helper to parse time and create timer dates
const parseTimeToDate = (timeStr, baseDate) => {
  const [time, period] = timeStr.trim().toUpperCase().split(' ');
  const [hours, minutes] = time.split(':');
  
  let hour = parseInt(hours);
  const minute = parseInt(minutes);
  
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  
  const date = new Date(baseDate);
  date.setHours(hour, minute, 0, 0);
  return date;
};

// ======================
// SCHEMAS AND MODELS
// ======================

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    required: true, 
    enum: [
      'FullAdmin', 
      'MaleAdmin', 
      'FemaleAdmin', 
      'FullStaff', 
      'MaleStaff', 
      'FemaleStaff'
    ] 
  },
  isActive: { type: Boolean, default: true },
  otp: { type: String },
  otpExpiry: { type: Date },
  isFirstLogin: { type: Boolean, default: true },
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

// Crime Schema
const crimeSchema = new mongoose.Schema({
  crime: { type: String, required: true, unique: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });
const Crime = mongoose.model('Crime', crimeSchema);

// Inmate Schema
const inmateSchema = new mongoose.Schema({
  inmateCode: { type: String, required: true, unique: true },
  lastName: { type: String, required: true },
  firstName: { type: String, required: true },
  middleName: String,
  extension: String,
  sex: { type: String, required: true, enum: ['Male', 'Female'] },
  dateOfBirth: { type: Date, required: true },
  address: { type: String, required: true },
  maritalStatus: { 
    type: String, 
    enum: ['Single', 'Married', 'Divorced', 'Widowed', 'Separated', ''] 
  },
  eyeColor: String,
  complexion: String,
  cellId: { type: String, required: true },
  sentence: String,
  dateFrom: Date,
  dateTo: Date,
  crime: { type: String, required: true },
  emergencyName: String,
  emergencyContact: String,
  emergencyRelation: String,
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'released', 'transferred'], 
    default: 'active' 
  },
  frontImage: String,
  backImage: String,
  leftImage: String,
  rightImage: String,
}, { timestamps: true });

inmateSchema.virtual('fullName').get(function() {
  return `${this.lastName}, ${this.firstName} ${this.middleName || ''} ${this.extension || ''}`.trim();
});

const Inmate = mongoose.model('Inmate', inmateSchema);

// Pending Visitor Schema
const pendingVisitorSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  lastName: { type: String, required: true },
  firstName: { type: String, required: true },
  middleName: String,
  extension: String,
  
  // Visitor details
  photo: String,
  dateOfBirth: Date,
  age: Number,
  sex: { type: String, enum: ['Male', 'Female'] },
  address: String,
  contact: String,
  
  // Visitation details
  prisonerId: { type: String, required: true },
  prisonerName: String, 
  relationship: String,
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  rejectionReason: String,
  
  // System fields
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

pendingVisitorSchema.virtual('fullName').get(function() {
  return `${this.lastName}, ${this.firstName} ${this.middleName || ''} ${this.extension || ''}`.trim();
});

const PendingVisitor = mongoose.model('PendingVisitor', pendingVisitorSchema);

// Visitor Schema - ENHANCED WITH VISIT HISTORY AND COMPLETE BAN FIELDS
const visitorSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  lastName: { type: String, required: true },
  firstName: { type: String, required: true },
  middleName: String,
  extension: String,
  
  // Visitor details
  photo: String,
  dateOfBirth: Date,
  age: Number,
  sex: { type: String, enum: ['Male', 'Female'] },
  address: String,
  contact: String,
  
  // Visitation details
  prisonerId: { type: String, required: true, ref: 'Inmate' },
  prisonerName: { type: String, required: true },
  relationship: String,
  
  // Time tracking fields (for current session)
  dateVisited: { type: Date, default: null },
  timeIn: { type: String, default: null },
  timeOut: { type: String, default: null },
  hasTimedIn: { type: Boolean, default: false },
  hasTimedOut: { type: Boolean, default: false },
  lastVisitDate: { type: Date, default: null },
  lastActiveDate: { type: Date, default: null },

  // SIMPLE TIMER FIELDS
  timerStart: { type: Date, default: null },
  timerEnd: { type: Date, default: null },
  isTimerActive: { type: Boolean, default: false },
  visitApproved: { type: Boolean, default: false },
  
  // SIMPLE CUSTOM TIMER STORAGE (for display only)
  customTimer: {
    startTime: String,
    endTime: String, 
    duration: String
  },
  
  // Daily visit tracking
  dailyVisits: [{
    visitDate: { type: Date, required: true },
    timeIn: String,
    timeOut: String,
    hasTimedIn: { type: Boolean, default: false },
    hasTimedOut: { type: Boolean, default: false },
    timerStart: Date,
    timerEnd: Date,
    isTimerActive: { type: Boolean, default: false },
    visitLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'VisitLog' }
  }],
  
  // VISIT HISTORY - COMPLETE TRACKING
  visitHistory: [{
    visitDate: { type: Date, required: true },
    timeIn: { type: String, required: true },
    timeOut: { type: String, required: true },
    duration: String,
    prisonerId: { type: String, required: true },
    prisonerName: String,
    relationship: String,
    visitLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'VisitLog' },
    status: { 
      type: String, 
      enum: ['completed', 'in-progress', 'cancelled'], 
      default: 'completed' 
    },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Status and violations
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  violationType: String,
  violationDetails: String,
  
  // BAN MANAGEMENT FIELDS - ENHANCED WITH DATE-BASED SYSTEM (LIKE INMATE)
  isBanned: { type: Boolean, default: false },
  banReason: String,
  banDuration: String, // For backward compatibility (permanent, custom, etc.)
  
  // NEW: DATE-BASED BAN FIELDS (EXACTLY LIKE INMATE SENTENCE SYSTEM)
  banStartDate: Date,      // Like inmate dateFrom
  banEndDate: Date,        // Like inmate dateTo
  calculatedDuration: String, // Like inmate sentence field (auto-calculated)
  
  banNotes: String,
  
  // Statistics
  totalVisits: { type: Number, default: 0 },
  lastVisitDuration: String,
  averageVisitDuration: String,
  
  // System fields
  qrCode: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

visitorSchema.virtual('fullName').get(function() {
  return `${this.lastName}, ${this.firstName} ${this.middleName || ''} ${this.extension || ''}`.trim();
});

const Visitor = mongoose.model('Visitor', visitorSchema);

// Pending Guest Schema
const pendingGuestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  lastName: { type: String, required: true },
  firstName: { type: String, required: true },
  middleName: String,
  extension: String,
  
  // Guest details
  photo: String,
  dateOfBirth: Date,
  age: Number,
  sex: { type: String, enum: ['Male', 'Female'] },
  address: String,
  contact: String,
  
  // Visit details
  visitPurpose: { type: String, required: true },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  rejectionReason: String,
  
  // System fields
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

pendingGuestSchema.virtual('fullName').get(function() {
  return `${this.lastName}, ${this.firstName} ${this.middleName || ''} ${this.extension || ''}`.trim();
});

const PendingGuest = mongoose.model('PendingGuest', pendingGuestSchema);

// Guest Schema - ENHANCED WITH VISIT HISTORY AND COMPLETE BAN FIELDS
const guestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  lastName: { type: String, required: true },
  firstName: { type: String, required: true },
  middleName: String,
  extension: String,
  
  // Guest details
  photo: String,
  dateOfBirth: Date,
  age: Number,
  sex: { type: String, enum: ['Male', 'Female'] },
  address: String,
  contact: String,
  
  // Visit details
  visitPurpose: { type: String, required: true },
  dateVisited: { type: Date, default: null },
  timeIn: String,
  timeOut: String,
  hasTimedIn: { type: Boolean, default: false },
  hasTimedOut: { type: Boolean, default: false },
  lastVisitDate: Date,
  lastActiveDate: { type: Date, default: null },

  // SIMPLE TIMER FIELDS
  timerStart: { type: Date, default: null },
  timerEnd: { type: Date, default: null },
  isTimerActive: { type: Boolean, default: false },
  
  // SIMPLE CUSTOM TIMER STORAGE (for display only)
  customTimer: {
    startTime: String,
    endTime: String,
    duration: String
  },
  
  // Daily visit tracking
  dailyVisits: [{
    visitDate: { type: Date, required: true },
    timeIn: String,
    timeOut: String,
    hasTimedIn: { type: Boolean, default: false },
    hasTimedOut: { type: Boolean, default: false },
    visitLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'VisitLog' }
  }],
  
  // VISIT HISTORY - COMPLETE TRACKING
  visitHistory: [{
    visitDate: { type: Date, required: true },
    timeIn: { type: String, required: true },
    timeOut: { type: String, required: true },
    duration: String,
    visitPurpose: { type: String, required: true },
    visitLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'VisitLog' },
    status: { 
      type: String, 
      enum: ['completed', 'in-progress', 'cancelled'], 
      default: 'completed' 
    },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Violation fields
  violationType: String,
  violationDetails: String,
  
  // BAN MANAGEMENT FIELDS - ENHANCED WITH DATE-BASED SYSTEM (LIKE INMATE)
  isBanned: { type: Boolean, default: false },
  banReason: String,
  banDuration: String, // For backward compatibility (permanent, custom, etc.)
  
  // NEW: DATE-BASED BAN FIELDS (EXACTLY LIKE INMATE SENTENCE SYSTEM)
  banStartDate: Date,      // Like inmate dateFrom
  banEndDate: Date,        // Like inmate dateTo
  calculatedDuration: String, // Like inmate sentence field (auto-calculated)
  
  banNotes: String,
  
  // Statistics
  totalVisits: { type: Number, default: 0 },
  lastVisitDuration: String,
  averageVisitDuration: String,
  
  // Approval system
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'completed'], 
    default: 'pending' 
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectedAt: Date,
  
  // System fields
  qrCode: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
  
guestSchema.virtual('fullName').get(function() {
  return `${this.lastName}, ${this.firstName} ${this.middleName || ''} ${this.extension || ''}`.trim();
});

const Guest = mongoose.model('Guest', guestSchema);

// Visit Log Schema
const visitLogSchema = new mongoose.Schema({
  personId: { type: String, required: true },
  personName: { type: String, required: true },
  personType: { type: String, required: true, enum: ['visitor', 'guest'] },
  prisonerId: { type: String, default: null },
  inmateName: { type: String, default: null },
  visitDate: { type: Date, required: true },
  timeIn: { type: String, required: true },
  timeOut: { type: String, default: null },
  visitDuration: { type: String, default: null },
  status: { 
    type: String, 
    enum: ['in-progress', 'completed'], 
    default: 'in-progress' 
  },
  isTimerActive: { type: Boolean, default: false },
  timerStart: { type: Date, default: null },
  timerEnd: { type: Date, default: null }
}, { timestamps: true });

const VisitLog = mongoose.model('VisitLog', visitLogSchema);

// Log Schema
const logSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  module: { type: String, required: true },
  action: { type: String, required: true },
  user: { type: String, required: true },
  userId: { type: String, required: true },
  description: { type: String, required: true },
  ipAddress: String,
  status: { type: String, enum: ['success', 'error'], default: 'success' },
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const Log = mongoose.model('Log', logSchema);

// ======================
// BAN & VIOLATION HISTORY SCHEMAS
// ======================

// Ban History Schema - ENHANCED WITH DATE-BASED SYSTEM
const banHistorySchema = new mongoose.Schema({
  personId: { type: String, required: true },
  personName: { type: String, required: true },
  personType: { type: String, required: true, enum: ['visitor', 'guest'] },
  banReason: { type: String, required: true },
  banDuration: { type: String, required: true }, // permanent, custom, etc.
  
  // NEW: DATE-BASED BAN FIELDS (EXACTLY LIKE INMATE SENTENCE SYSTEM)
  banStartDate: Date,      // Like inmate dateFrom
  banEndDate: Date,        // Like inmate dateTo
  calculatedDuration: String, // Like inmate sentence field (auto-calculated)
  
  banNotes: String,
  bannedBy: String,
  bannedAt: { type: Date, default: Date.now },
  removedAt: Date,
  removedBy: String,
  removalReason: String,
  status: { type: String, enum: ['active', 'removed', 'expired'], default: 'active' }
}, { timestamps: true });

const BanHistory = mongoose.model('BanHistory', banHistorySchema);

// Violation History Schema
const violationHistorySchema = new mongoose.Schema({
  personId: { type: String, required: true },
  personName: { type: String, required: true },
  personType: { type: String, required: true, enum: ['visitor', 'guest'] },
  violationType: { type: String, required: true },
  violationDetails: String,
  recordedBy: String,
  recordedAt: { type: Date, default: Date.now },
  removedAt: Date,
  removedBy: String,
  status: { type: String, enum: ['active', 'removed'], default: 'active' }
}, { timestamps: true });

const ViolationHistory = mongoose.model('ViolationHistory', violationHistorySchema);

// ======================
// ENHANCED BAN MANAGEMENT UTILITIES
// ======================

// Add ban durations constant
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

// Enhanced calculate ban end date function with better logging
const calculateBanEndDate = (duration, customDate = '') => {
  const startDate = new Date();
  let endDate = new Date(startDate);
  
  console.log('🔄 CALCULATE_BAN_END_DATE DEBUG:', {
    duration,
    customDate,
    startDate: startDate.toISOString()
  });
  
  switch (duration) {
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
    case 'custom':
      if (customDate) {
        console.log('📅 CUSTOM DATE PARSING:', { customDate });
        endDate = new Date(customDate);
        // Validate that end date is in the future
        if (endDate <= startDate) {
          throw new Error('Custom ban end date must be in the future');
        }
      } else {
        throw new Error('Custom duration requires an end date');
      }
      break;
    case 'permanent':
      return null;
    default:
      throw new Error('Invalid ban duration');
  }
  
  console.log('✅ CALCULATED_END_DATE:', {
    endDate: endDate.toISOString(),
    duration,
    customDateUsed: customDate || 'N/A'
  });
  
  return endDate.toISOString();
};

// Enhanced ban time remaining calculation
const getBanTimeRemaining = (banDuration, banStartDate, banEndDate) => {
  if (banDuration === 'permanent') {
    return { expired: false, timeRemaining: 'Permanent', exactDuration: 'Permanent' };
  }
  
  const now = new Date();
  let endDate;
  
  if (banDuration === 'custom' && banEndDate) {
    endDate = new Date(banEndDate);
  } else {
    const startDate = new Date(banStartDate);
    endDate = new Date(startDate);
    
    switch (banDuration) {
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
        return { expired: true, timeRemaining: 'Expired', exactDuration: 'Unknown' };
    }
  }
  
  if (now >= endDate) {
    return { expired: true, timeRemaining: 'Expired', exactDuration: 'Expired' };
  }
  
  const timeDiff = endDate - now;
  const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  
  let exactDuration = '';
  if (daysLeft > 0) {
    exactDuration = `${daysLeft} day${daysLeft > 1 ? 's' : ''}`;
    if (hoursLeft > 0) exactDuration += ` ${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`;
  } else if (hoursLeft > 0) {
    exactDuration = `${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`;
    if (minutesLeft > 0) exactDuration += ` ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}`;
  } else {
    exactDuration = `${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}`;
  }
  
  return {
    expired: false,
    timeRemaining: `${daysLeft}d ${hoursLeft}h ${minutesLeft}m`,
    exactDuration: exactDuration.trim(),
    endDate: endDate
  };
};

// Helper function to check if ban has expired
const isBanExpired = (banDuration, banStartDate, banEndDate) => {
  if (banDuration === 'permanent') {
    return false;
  }
  
  const now = new Date();
  let endDate;
  
  if (banDuration === 'custom' && banEndDate) {
    endDate = new Date(banEndDate);
  } else {
    const startDate = new Date(banStartDate);
    endDate = new Date(startDate);
    
    switch (banDuration) {
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
  }
  
  return now >= endDate;
};

// ======================
// ENHANCED AUTO BAN REMOVAL FUNCTIONS
// ======================

// UPDATE AUTO-REMOVE FUNCTION TO USE NEW FIELDS
const autoRemoveExpiredBan = async (personId, personType) => {
  try {
    console.log(`🔄 Auto-removing expired ban for ${personId} (${personType})`);

    // Update ban history - mark as expired
    await BanHistory.findOneAndUpdate(
      { personId: personId, personType: personType, status: 'active' },
      { 
        status: 'expired',
        removedAt: new Date(),
        removedBy: 'System',
        removalReason: 'Ban duration expired automatically'
      }
    );

    // Remove ban from person and clear ALL ban fields
    if (personType === 'visitor') {
      await Visitor.findOneAndUpdate(
        { id: personId },
        { 
          isBanned: false,
          banReason: null,
          banDuration: null,
          banStartDate: null, // CLEAR NEW FIELD
          banEndDate: null,   // CLEAR NEW FIELD
          calculatedDuration: null, // CLEAR NEW FIELD
          banNotes: null,
          violationType: null,
          violationDetails: null
        }
      );
    } else {
      await Guest.findOneAndUpdate(
        { id: personId },
        { 
          isBanned: false,
          banReason: null,
          banDuration: null,
          banStartDate: null, // CLEAR NEW FIELD
          banEndDate: null,   // CLEAR NEW FIELD
          calculatedDuration: null, // CLEAR NEW FIELD
          banNotes: null,
          violationType: null,
          violationDetails: null
        }
      );
    }

    console.log(`✅ Auto-removed expired ban for ${personId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error auto-removing ban for ${personId}:`, error);
    return false;
  }
};

// Enhanced auto-expire bans and update status
const autoExpireBans = async () => {
  try {
    console.log('🔄 Checking for expired bans...');
    
    // Get all active bans
    const activeBans = await BanHistory.find({ status: 'active' });
    console.log(`📋 Found ${activeBans.length} active bans to check`);
    
    let expiredCount = 0;
    
    for (const ban of activeBans) {
      const isExpired = isBanExpired(ban.banDuration, ban.createdAt, ban.banEndDate);
      
      if (isExpired) {
        console.log(`🔄 Auto-expiring ban for ${ban.personName} (${ban.personId})`);
        
        // Use the auto-remove function
        const success = await autoRemoveExpiredBan(ban.personId, ban.personType);
        
        if (success) {
          expiredCount++;
          console.log(`✅ Auto-expired ban for ${ban.personName}`);
        }
      }
    }
    
    if (expiredCount > 0) {
      console.log(`🎯 Auto-expired ${expiredCount} bans`);
    } else {
      console.log('ℹ️ No bans to expire');
    }
    
    return expiredCount;
  } catch (error) {
    console.error('❌ Error in autoExpireBans:', error);
    return 0;
  }
};

// ======================
// ENHANCED BAN ENDPOINTS
// ======================

// ENHANCED BAN ENDPOINTS WITH DATE-BASED SYSTEM
app.put("/visitors/:id/ban", async (req, res) => {
  try {
    const { 
      reason, 
      duration, 
      notes, 
      isBanned = true, 
      bannedBy = 'System', 
      banStartDate, 
      banEndDate,
      calculatedDuration 
    } = req.body;
    
    console.log('🔄 Banning visitor:', req.params.id, { 
      reason, 
      duration, 
      banStartDate, 
      banEndDate,
      calculatedDuration 
    });
    
    const visitor = await Visitor.findOne({ id: req.params.id });
    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    let finalBanEndDate = banEndDate;
    let finalBanStartDate = banStartDate || new Date().toISOString();

    // For permanent bans, set end date to null
    if (duration === 'permanent') {
      finalBanEndDate = null;
      finalBanStartDate = new Date().toISOString(); // Permanent ban starts now
    }

    // Validate dates for custom/temporary bans
    if (duration === 'custom' && finalBanEndDate) {
      const start = new Date(finalBanStartDate);
      const end = new Date(finalBanEndDate);
      if (end <= start) {
        return res.status(400).json({ message: "Ban end date must be after start date" });
      }
    }

    // Record in ban history
    const banHistory = new BanHistory({
      personId: visitor.id,
      personName: visitor.fullName,
      personType: 'visitor',
      banReason: reason,
      banDuration: duration,
      banStartDate: finalBanStartDate,
      banEndDate: finalBanEndDate,
      calculatedDuration: calculatedDuration,
      banNotes: notes,
      bannedBy: bannedBy,
      status: 'active'
    });
    await banHistory.save();

    const updatedVisitor = await Visitor.findOneAndUpdate(
      { id: req.params.id },
      { 
        isBanned,
        banReason: reason,
        banDuration: duration,
        banStartDate: finalBanStartDate,
        banEndDate: finalBanEndDate,
        calculatedDuration: calculatedDuration,
        banNotes: notes,
        violationType: 'Banned',
        violationDetails: reason || 'Banned by administrator'
      },
      { new: true }
    );

    const visitorWithFullName = {
      ...updatedVisitor.toObject(),
      fullName: updatedVisitor.fullName
    };

    // Calculate time remaining for response
    const timeRemaining = getBanTimeRemaining(duration, finalBanStartDate, finalBanEndDate);

    console.log('✅ Visitor banned successfully:', req.params.id);

    res.json({ 
      message: "Visitor banned successfully",
      visitor: visitorWithFullName,
      banRecord: banHistory,
      banDetails: {
        startDate: finalBanStartDate,
        endDate: finalBanEndDate,
        duration: duration,
        calculatedDuration: calculatedDuration,
        timeRemaining: timeRemaining.timeRemaining,
        exactDuration: timeRemaining.exactDuration
      }
    });
  } catch (error) {
    console.error("❌ Error banning visitor:", error);
    res.status(500).json({ message: "Failed to ban visitor", error: error.message });
  }
});

// ENHANCED GUEST BAN ENDPOINT
app.put("/guests/:id/ban", async (req, res) => {
  try {
    const { 
      reason, 
      duration, 
      notes, 
      isBanned = true, 
      bannedBy = 'System', 
      banStartDate, 
      banEndDate,
      calculatedDuration 
    } = req.body;
    
    console.log('🔄 Banning guest:', req.params.id, { 
      reason, 
      duration, 
      banStartDate, 
      banEndDate,
      calculatedDuration 
    });
    
    const guest = await Guest.findOne({ id: req.params.id });
    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    let finalBanEndDate = banEndDate;
    let finalBanStartDate = banStartDate || new Date().toISOString();

    // For permanent bans, set end date to null
    if (duration === 'permanent') {
      finalBanEndDate = null;
      finalBanStartDate = new Date().toISOString(); // Permanent ban starts now
    }

    // Validate dates for custom/temporary bans
    if (duration === 'custom' && finalBanEndDate) {
      const start = new Date(finalBanStartDate);
      const end = new Date(finalBanEndDate);
      if (end <= start) {
        return res.status(400).json({ message: "Ban end date must be after start date" });
      }
    }

    // Record in ban history
    const banHistory = new BanHistory({
      personId: guest.id,
      personName: guest.fullName,
      personType: 'guest',
      banReason: reason,
      banDuration: duration,
      banStartDate: finalBanStartDate,
      banEndDate: finalBanEndDate,
      calculatedDuration: calculatedDuration,
      banNotes: notes,
      bannedBy: bannedBy,
      status: 'active'
    });
    await banHistory.save();

    const updatedGuest = await Guest.findOneAndUpdate(
      { id: req.params.id },
      { 
        isBanned,
        banReason: reason,
        banDuration: duration,
        banStartDate: finalBanStartDate,
        banEndDate: finalBanEndDate,
        calculatedDuration: calculatedDuration,
        banNotes: notes,
        violationType: 'Banned',
        violationDetails: reason || 'Banned by administrator'
      },
      { new: true }
    );

    const guestWithFullName = {
      ...updatedGuest.toObject(),
      fullName: updatedGuest.fullName
    };

    // Calculate time remaining for response
    const timeRemaining = getBanTimeRemaining(duration, finalBanStartDate, finalBanEndDate);

    console.log('✅ Guest banned successfully:', req.params.id);

    res.json({ 
      message: "Guest banned successfully",
      guest: guestWithFullName,
      banRecord: banHistory,
      banDetails: {
        startDate: finalBanStartDate,
        endDate: finalBanEndDate,
        duration: duration,
        calculatedDuration: calculatedDuration,
        timeRemaining: timeRemaining.timeRemaining,
        exactDuration: timeRemaining.exactDuration
      }
    });
  } catch (error) {
    console.error("❌ Error banning guest:", error);
    res.status(500).json({ message: "Failed to ban guest", error: error.message });
  }
});

// Enhanced: Get currently banned with proper time remaining calculation
app.get("/currently-banned", async (req, res) => {
  try {
    console.log('🔄 Fetching currently banned with time remaining...');
    
    // First auto-expire any bans
    await autoExpireBans();
    
    const [visitors, guests] = await Promise.all([
      Visitor.find({ isBanned: true }),
      Guest.find({ isBanned: true })
    ]);
    
    console.log(`📋 Found ${visitors.length} banned visitors and ${guests.length} banned guests`);
    
    const bannedWithTimeRemaining = [];
    
    // Process visitors
    for (const visitor of visitors) {
      const timeRemaining = getBanTimeRemaining(
        visitor.banDuration, 
        visitor.banStartDate || visitor.createdAt, 
        visitor.banEndDate
      );
      
      // Only include if not expired
      if (!timeRemaining.expired) {
        bannedWithTimeRemaining.push({
          ...visitor.toObject(),
          personType: 'visitor',
          personName: visitor.fullName,
          id: visitor.id,
          timeRemaining: timeRemaining.timeRemaining,
          exactDuration: timeRemaining.exactDuration,
          isExpired: timeRemaining.expired,
          banStatus: timeRemaining.expired ? 'Expired' : 'Active',
          banStartDate: visitor.banStartDate || visitor.createdAt,
          banEndDate: timeRemaining.endDate || visitor.banEndDate
        });
      }
    }
    
    // Process guests
    for (const guest of guests) {
      const timeRemaining = getBanTimeRemaining(
        guest.banDuration, 
        guest.banStartDate || guest.createdAt, 
        guest.banEndDate
      );
      
      // Only include if not expired
      if (!timeRemaining.expired) {
        bannedWithTimeRemaining.push({
          ...guest.toObject(),
          personType: 'guest',
          personName: guest.fullName,
          id: guest.id,
          timeRemaining: timeRemaining.timeRemaining,
          exactDuration: timeRemaining.exactDuration,
          isExpired: timeRemaining.expired,
          banStatus: timeRemaining.expired ? 'Expired' : 'Active',
          banStartDate: guest.banStartDate || guest.createdAt,
          banEndDate: timeRemaining.endDate || guest.banEndDate
        });
      }
    }
    
    console.log(`✅ Returning ${bannedWithTimeRemaining.length} currently banned persons`);
    
    res.json({
      currentlyBanned: bannedWithTimeRemaining,
      totalActive: bannedWithTimeRemaining.length
    });
    
  } catch (error) {
    console.error("❌ Error fetching currently banned:", error);
    res.status(500).json({ message: "Failed to fetch banned list", error: error.message });
  }
});

// ======================
// ENHANCED BAN STATUS & HISTORY ENDPOINTS
// ======================

// Enhanced: Get ban status for a specific person
app.get("/ban-status/:personType/:id", async (req, res) => {
  try {
    const { personType, id } = req.params;
    
    console.log('🔄 Fetching ban status for:', personType, id);
    
    let person;
    if (personType === 'visitor') {
      person = await Visitor.findOne({ id: id });
    } else if (personType === 'guest') {
      person = await Guest.findOne({ id: id });
    } else {
      return res.status(400).json({ message: "Invalid person type" });
    }
    
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }
    
    if (!person.isBanned) {
      return res.json({
        isBanned: false,
        message: "Person is not banned"
      });
    }
    
    const timeRemaining = getBanTimeRemaining(
      person.banDuration, 
      person.banStartDate || person.createdAt, 
      person.banEndDate
    );
    
    // Auto-remove if expired
    if (timeRemaining.expired) {
      console.log(`🔄 Auto-removing expired ban for ${id}`);
      await autoRemoveExpiredBan(id, personType);
      
      return res.json({
        isBanned: false,
        message: "Ban has expired and been automatically removed"
      });
    }
    
    res.json({
      isBanned: true,
      personId: person.id,
      personName: person.fullName,
      personType: personType,
      banReason: person.banReason,
      banDuration: person.banDuration,
      banStartDate: person.banStartDate || person.createdAt,
      banEndDate: timeRemaining.endDate || person.banEndDate,
      timeRemaining: timeRemaining.timeRemaining,
      exactDuration: timeRemaining.exactDuration,
      isExpired: timeRemaining.expired,
      banStatus: timeRemaining.expired ? 'Expired' : 'Active',
      durationDisplay: banDurations.find(d => d.value === person.banDuration)?.label || person.banDuration
    });
    
  } catch (error) {
    console.error("❌ Error fetching ban status:", error);
    res.status(500).json({ message: "Failed to fetch ban status", error: error.message });
  }
});

// Enhanced: Manual trigger to expire bans (for testing)
app.post("/bans/expire-check", async (req, res) => {
  try {
    console.log('🔄 Manual ban expiration check triggered');
    const expiredCount = await autoExpireBans();
    
    res.json({
      message: `Ban expiration check completed`,
      expiredCount: expiredCount,
      timestamp: new Date().toISOString(),
      details: `${expiredCount} bans were automatically expired and removed`
    });
    
  } catch (error) {
    console.error("❌ Error in expire check:", error);
    res.status(500).json({ message: "Failed to check ban expiration", error: error.message });
  }
});

// Enhanced: Update ban history to include end dates
app.get("/ban-history-with-details", async (req, res) => {
  try {
    const { personId, personType, status, startDate, endDate } = req.query;
    
    console.log('🔄 Fetching ban history with details:', { personId, personType, status });
    
    let filter = {};
    if (personId) filter.personId = personId;
    if (personType) filter.personType = personType;
    if (status) filter.status = status;
    
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    const banHistory = await BanHistory.find(filter).sort({ createdAt: -1 });
    
    // Add time remaining and status details
    const banHistoryWithDetails = banHistory.map(record => {
      const timeRemaining = getBanTimeRemaining(
        record.banDuration,
        record.createdAt,
        record.banEndDate
      );
      
      const durationDisplay = banDurations.find(d => d.value === record.banDuration)?.label || record.banDuration;
      
      return {
        ...record.toObject(),
        timeRemaining: timeRemaining.timeRemaining,
        exactDuration: timeRemaining.exactDuration,
        isExpired: timeRemaining.expired,
        calculatedEndDate: timeRemaining.endDate,
        durationDisplay: durationDisplay,
        statusDetails: {
          isActive: record.status === 'active' && !timeRemaining.expired,
          isExpired: timeRemaining.expired,
          isRemoved: record.status === 'removed',
          isPermanent: record.banDuration === 'permanent'
        }
      };
    });

    console.log(`✅ Returning ${banHistoryWithDetails.length} ban history records`);
    
    res.json(banHistoryWithDetails);
    
  } catch (error) {
    console.error("❌ Error fetching ban history with details:", error);
    res.status(500).json({ message: "Failed to fetch ban history", error: error.message });
  }
});

// Logging middleware 
const logActivity = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log successful operations
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const logData = {
        module: getModuleFromRoute(req.route.path),
        action: getActionFromMethod(req.method),
        user: req.user?.name || 'System',
        userId: req.user?._id || 'system',
        description: generateLogDescription(req),
        ipAddress: req.ip || req.connection.remoteAddress,
        status: 'success',
        metadata: {
          route: req.route.path,
          method: req.method,
          params: req.params,
          query: req.query
        }
      };
      
      // Don't await to avoid blocking response
      new Log(logData).save().catch(console.error);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// ======================
// VISIT HISTORY ENDPOINTS
// ======================

// Get visit history for a person
app.get("/:personType/:id/visit-history", async (req, res) => {
  try {
    const { personType, id } = req.params;
    const { limit = 50, page = 1 } = req.query;
    
    let Model;
    if (personType === 'visitor') {
      Model = Visitor;
    } else if (personType === 'guest') {
      Model = Guest;
    } else {
      return res.status(400).json({ message: "Invalid person type" });
    }

    const person = await Model.findOne({ id: id });
    if (!person) {
      return res.status(404).json({ message: `${personType} not found` });
    }

    const skip = (page - 1) * limit;
    const visitHistory = person.visitHistory
      .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
      .slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      visitHistory: visitHistory,
      totalVisits: person.visitHistory.length,
      totalPages: Math.ceil(person.visitHistory.length / limit),
      currentPage: parseInt(page),
      person: {
        id: person.id,
        fullName: person.fullName,
        totalVisits: person.totalVisits,
        lastVisitDate: person.lastVisitDate,
        averageVisitDuration: person.averageVisitDuration
      }
    });
  } catch (error) {
    console.error("Error fetching visit history:", error);
    res.status(500).json({ message: "Failed to fetch visit history", error: error.message });
  }
});

// Get visit statistics
app.get("/:personType/:id/visit-stats", async (req, res) => {
  try {
    const { personType, id } = req.params;
    
    let Model;
    if (personType === 'visitor') {
      Model = Visitor;
    } else if (personType === 'guest') {
      Model = Guest;
    } else {
      return res.status(400).json({ message: "Invalid person type" });
    }

    const person = await Model.findOne({ id: id });
    if (!person) {
      return res.status(404).json({ message: `${personType} not found` });
    }

    // Calculate statistics
    const totalVisits = person.visitHistory.length;
    const completedVisits = person.visitHistory.filter(v => v.status === 'completed').length;
    
    // Calculate average duration
    const durations = person.visitHistory
      .filter(v => v.duration && v.duration !== 'N/A' && v.duration !== 'Error')
      .map(v => {
        // Convert duration like "2h 30m" to minutes
        const match = v.duration.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
        if (match) {
          const hours = parseInt(match[1] || 0);
          const minutes = parseInt(match[2] || 0);
          return hours * 60 + minutes;
        }
        return 0;
      });
    
    const averageDurationMinutes = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    
    const averageDuration = averageDurationMinutes > 0
      ? `${Math.floor(averageDurationMinutes / 60)}h ${averageDurationMinutes % 60}m`
      : 'N/A';

    // Monthly visits
    const monthlyVisits = {};
    person.visitHistory.forEach(visit => {
      const monthYear = new Date(visit.visitDate).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      });
      monthlyVisits[monthYear] = (monthlyVisits[monthYear] || 0) + 1;
    });

    res.json({
      success: true,
      statistics: {
        totalVisits,
        completedVisits,
        averageVisitDuration: averageDuration,
        lastVisitDate: person.lastVisitDate,
        monthlyVisits: Object.entries(monthlyVisits)
          .map(([month, count]) => ({ month, count }))
          .sort((a, b) => new Date(b.month) - new Date(a.month))
          .slice(0, 12)
      },
      recentVisits: person.visitHistory
        .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
        .slice(0, 5)
    });
  } catch (error) {
    console.error("Error fetching visit statistics:", error);
    res.status(500).json({ message: "Failed to fetch visit statistics", error: error.message });
  }
});

// ======================
// SCAN PROCESSING ENDPOINTS - ENHANCED WITH VISIT HISTORY
// ======================

// SCAN PROCESSING - FIXED VERSION
app.post("/scan-process", async (req, res) => {
  try {
    const { qrData, personId, isGuest } = req.body;
    
    console.log('🔍 SCAN PROCESS STARTED:', { personId, isGuest });

    if (!personId) {
      return res.status(400).json({ message: "Person ID is required" });
    }

    let person;
    if (isGuest) {
      person = await Guest.findOne({ id: personId });
    } else {
      person = await Visitor.findOne({ id: personId });
    }

    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];
    const now = new Date();

    console.log('=== DEBUG INFORMATION ===');
    console.log('📅 SERVER TIME:', {
      currentTime: now.toString(),
      todayDateString: todayDateString,
      todayISO: today.toISOString(),
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    
    console.log('👤 PERSON DATA (BEFORE ANY CHANGES):', {
      id: person.id,
      name: person.fullName,
      hasTimedIn: person.hasTimedIn,
      hasTimedOut: person.hasTimedOut,
      timeIn: person.timeIn,
      timeOut: person.timeOut,
      dateVisited: person.dateVisited,
      lastVisitDate: person.lastVisitDate,
      lastActiveDate: person.lastActiveDate
    });

    // Convert dates to strings for comparison (USE ORIGINAL VALUES)
    const lastActiveDate = person.lastActiveDate ? new Date(person.lastActiveDate) : null;
    const lastActiveDateString = lastActiveDate ? lastActiveDate.toISOString().split('T')[0] : 'NO LAST ACTIVE DATE';
    
    const lastVisitDate = person.lastVisitDate ? new Date(person.lastVisitDate) : null;
    const lastVisitDateString = lastVisitDate ? lastVisitDate.toISOString().split('T')[0] : 'NO LAST VISIT DATE';
    
    const dateVisited = person.dateVisited ? new Date(person.dateVisited) : null;
    const dateVisitedString = dateVisited ? dateVisited.toISOString().split('T')[0] : 'NO DATE VISITED';

    console.log('📊 DATE COMPARISONS (ORIGINAL DATA):', {
      today: todayDateString,
      lastActiveDate: lastActiveDateString,
      lastVisitDate: lastVisitDateString,
      dateVisited: dateVisitedString,
      isSameDayAsLastActive: lastActiveDateString === todayDateString,
      isSameDayAsLastVisit: lastVisitDateString === todayDateString,
      isSameDayAsDateVisited: dateVisitedString === todayDateString
    });

    // STEP 1: Check if we need to reset for new day (USE ORIGINAL lastActiveDate)
    let shouldAutoReset = false;
    
    if (lastActiveDateString !== 'NO LAST ACTIVE DATE' && lastActiveDateString !== todayDateString) {
      console.log('🔄 NEW DAY DETECTED via lastActiveDate');
      shouldAutoReset = true;
    } else if (lastActiveDateString === 'NO LAST ACTIVE DATE') {
      console.log('ℹ️ No lastActiveDate found - first time scan?');
      shouldAutoReset = true; // Reset if no lastActiveDate exists
    } else {
      console.log('ℹ️ Same day as lastActiveDate - no reset needed');
    }

    console.log('🔄 AUTO-RESET DECISION:', { shouldAutoReset });

    // STEP 2: AUTO-RESET for new day
    if (shouldAutoReset) {
      console.log('🔄 PERFORMING AUTO-RESET FOR NEW DAY');
      
      const resetData = {
        hasTimedIn: false,
        hasTimedOut: false,
        timeIn: null,
        timeOut: null,
        dateVisited: null,
        dailyVisits: []
      };

      if (isGuest) {
        resetData.status = 'approved';
      } else {
        resetData.isTimerActive = false;
        resetData.timerStart = null;
        resetData.timerEnd = null;
        resetData.visitApproved = false;
      }

      console.log('📝 RESET DATA:', resetData);

      if (isGuest) {
        await Guest.findOneAndUpdate(
          { id: personId },
          { $set: resetData }
        );
      } else {
        await Visitor.findOneAndUpdate(
          { id: personId },
          { $set: resetData }
        );
      }

      // Refresh person data after reset
      if (isGuest) {
        person = await Guest.findOne({ id: personId });
      } else {
        person = await Visitor.findOne({ id: personId });
      }

      console.log('✅ AFTER RESET - PERSON DATA:', {
        hasTimedIn: person.hasTimedIn,
        hasTimedOut: person.hasTimedOut,
        timeIn: person.timeIn,
        timeOut: person.timeOut
      });
    }

    // STEP 3: Check current status (AFTER potential reset)
    let canTimeIn = true;
    let message = "";

    if (person.hasTimedOut) {
      canTimeIn = false;
      message = "✅ Visit already completed today";
    } else if (person.hasTimedIn && !person.hasTimedOut) {
      canTimeIn = false;
      message = "🕒 Active visit found - ready for time out";
    } else {
      canTimeIn = true;
      message = shouldAutoReset ? "🕒 New day - time in allowed" : "🕒 Ready for time in";
    }

    console.log('🎯 FINAL DECISION:', {
      canTimeIn: canTimeIn,
      message: message,
      hasTimedIn: person.hasTimedIn,
      hasTimedOut: person.hasTimedOut
    });

    let scanType, canProceed, requiresApproval;

    if (canTimeIn && !person.hasTimedIn) {
      scanType = 'time_in_pending';
      canProceed = true;
      requiresApproval = true;
    } else if (person.hasTimedIn && !person.hasTimedOut) {
      scanType = 'time_out_pending';
      canProceed = true;
      requiresApproval = true;
    } else {
      scanType = 'completed';
      canProceed = false;
      requiresApproval = false;
    }


    const scanResult = {
      person: {
        ...person.toObject(),
        fullName: person.fullName
      },
      scanType: scanType,
      message: message,
      canProceed: canProceed,
      requiresApproval: requiresApproval,
      resetPerformed: shouldAutoReset
    };

    console.log('🎉 FINAL SCAN RESULT:', scanType);
    console.log('=== DEBUG END ===\n');
    res.json(scanResult);

  } catch (error) {
    console.error('❌ Scan process error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
    
// APPROVE VISITOR TIME IN - SIMPLIFIED WITH CUSTOM TIMER
app.put("/visitors/:id/approve-time-in", async (req, res) => {
  try {
    const visitor = await Visitor.findOne({ id: req.params.id });
    if (!visitor) return res.status(404).json({ message: "Visitor not found" });

    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('en-US', { 
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    });

    // Check if already timed in today
    const alreadyTimedIn = visitor.dailyVisits.some(visit => {
      if (!visit.visitDate) return false;
      const visitDate = new Date(visit.visitDate).toISOString().split('T')[0];
      return visitDate === todayDateString && visit.hasTimedIn && !visit.hasTimedOut;
    });

    if (alreadyTimedIn) {
      return res.status(400).json({ message: "Visitor already timed in today" });
    }

    console.log('🔄 APPROVE TIME IN - Checking for custom timer:', {
      visitorId: visitor.id,
      hasCustomTimer: !!(visitor.timerStart && visitor.timerEnd),
      customTimer: visitor.customTimer
    });

    // SIMPLE TIMER LOGIC - Check if custom timer is set
    let timerStart, timerEnd;
    let timerMessage = "";
    let timerDuration = "";
    
    if (visitor.timerStart && visitor.timerEnd) {
      console.log('🕒 USING CUSTOM TIMER FOR VISITOR:', {
        timerStart: visitor.timerStart,
        timerEnd: visitor.timerEnd,
        customTimer: visitor.customTimer
      });
      
      timerStart = new Date(visitor.timerStart);
      timerEnd = new Date(visitor.timerEnd);
      
      // Validate timer doesn't end in the past
      const now = new Date();
      if (timerEnd <= now) {
        console.log('⚠️ Custom timer has ended, using default timer');
        // Fall back to default timer
        timerStart = new Date();
        timerEnd = new Date(timerStart.getTime() + (3 * 60 * 60 * 1000));
        timerDuration = "3h 0m";
        timerMessage = "Default 3-hour timer (custom timer expired)";
      } else {
        // Calculate duration for confirmation
        const diffMs = timerEnd - timerStart;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        timerDuration = `${hours}h ${minutes}m`;
        
        timerMessage = visitor.customTimer ? 
          `Custom timer: ${visitor.customTimer.startTime} - ${visitor.customTimer.endTime} (${timerDuration})` :
          `Custom timer: ${timerDuration}`;
      }
    } else {
      // Default 3-hour timer
      console.log('⏰ USING DEFAULT 3-HOUR TIMER FOR VISITOR - No custom timer found');
      timerStart = new Date();
      timerEnd = new Date(timerStart.getTime() + (3 * 60 * 60 * 1000));
      timerDuration = "3h 0m";
      timerMessage = "Default 3-hour timer";
    }

    // Get inmate name
    let inmateName = 'Unknown Inmate';
    try {
      const inmate = await Inmate.findOne({ inmateCode: visitor.prisonerId });
      if (inmate) inmateName = inmate.fullName;
    } catch (inmateError) {
      console.warn('Could not fetch inmate details:', inmateError);
    }

    // CREATE VISIT LOG
    const visitLog = new VisitLog({
      personId: visitor.id,
      personName: visitor.fullName,
      personType: 'visitor',
      prisonerId: visitor.prisonerId,
      inmateName: inmateName,
      visitDate: today,
      timeIn: currentTime,
      timerStart: timerStart,
      timerEnd: timerEnd,
      isTimerActive: true,
      status: 'in-progress'
    });

    await visitLog.save();

    // Create new daily visit
    const newVisit = {
      visitDate: today,
      timeIn: currentTime,
      timeOut: null,
      hasTimedIn: true,
      hasTimedOut: false,
      timerStart: timerStart,
      timerEnd: timerEnd,
      isTimerActive: true,
      visitLogId: visitLog._id
    };

    // UPDATE VISITOR
    const updatedVisitor = await Visitor.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          hasTimedIn: true,
          hasTimedOut: false,
          timeIn: currentTime,
          timeOut: null,
          isTimerActive: true,
          timerStart: timerStart,
          timerEnd: timerEnd,
          dateVisited: today,
          lastActiveDate: today,
          lastVisitDate: today
        },
        $push: { dailyVisits: newVisit }
      },
      { new: true }
    );

    const visitorWithFullName = {
      ...updatedVisitor.toObject(),
      fullName: updatedVisitor.fullName
    };

    console.log('✅ VISITOR TIME IN APPROVED SUCCESSFULLY:', {
      message: timerMessage,
      timerStart: timerStart.toLocaleString(),
      timerEnd: timerEnd.toLocaleString(),
      duration: timerDuration
    });

    res.json({ 
      message: timerMessage,
      visitor: visitorWithFullName,
      visitLog: visitLog,
      timerMessage: timerMessage,
      timerDuration: timerDuration,
      timerStart: timerStart,
      timerEnd: timerEnd
    });

  } catch (error) {
    console.error("❌ Error approving visitor time in:", error);
    res.status(500).json({ message: "Failed to approve time in", error: error.message });
  }
});

// APPROVE VISITOR TIME OUT - ENHANCED WITH VISIT HISTORY
app.put("/visitors/:id/approve-time-out", async (req, res) => {
  try {
    const visitor = await Visitor.findOne({ id: req.params.id });
    if (!visitor) return res.status(404).json({ message: "Visitor not found" });

    const currentTime = new Date().toLocaleTimeString('en-US', { 
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    });
    const today = new Date();

    // SIMPLE CHECK
    if (!visitor.hasTimedIn || visitor.hasTimedOut) {
      return res.status(400).json({ message: "Visitor has not timed in or already timed out" });
    }

    // UPDATE VISIT LOG
    const activeVisitLog = await VisitLog.findOne({
      personId: visitor.id,
      personType: 'visitor',
      timeOut: null,
      status: 'in-progress'
    });

    let visitDuration = 'N/A';
    if (activeVisitLog) {
      visitDuration = calculateDuration(visitor.timeIn, currentTime);
      await VisitLog.findByIdAndUpdate(
        activeVisitLog._id,
        {
          timeOut: currentTime,
          visitDuration: visitDuration,
          isTimerActive: false,
          status: 'completed'
        }
      );
    }

    // Get inmate name for history
    let inmateName = 'Unknown Inmate';
    try {
      const inmate = await Inmate.findOne({ inmateCode: visitor.prisonerId });
      if (inmate) inmateName = inmate.fullName;
    } catch (inmateError) {
      console.warn('Could not fetch inmate details:', inmateError);
    }

    // ADD TO VISIT HISTORY
    const visitHistoryEntry = {
      visitDate: today,
      timeIn: visitor.timeIn,
      timeOut: currentTime,
      duration: visitDuration,
      prisonerId: visitor.prisonerId,
      prisonerName: inmateName,
      relationship: visitor.relationship,
      visitLogId: activeVisitLog?._id,
      status: 'completed'
    };

    // UPDATE VISITOR - Add to history and update statistics
    const updatedVisitor = await Visitor.findOneAndUpdate(
  { id: req.params.id },
  {
    $set: {
      hasTimedOut: true,
      timeOut: currentTime,
      isTimerActive: false,
      lastVisitDate: today,
      lastVisitDuration: visitDuration,
      lastActiveDate: today // ✅ ADD THIS LINE
    },
    $push: { visitHistory: visitHistoryEntry },
    $inc: { totalVisits: 1 }
  },
  { new: true }
);

    // Calculate average duration
    if (updatedVisitor.visitHistory && updatedVisitor.visitHistory.length > 0) {
      const durations = updatedVisitor.visitHistory
        .filter(v => v.duration && v.duration !== 'N/A' && v.duration !== 'Error')
        .map(v => {
          const match = v.duration.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
          if (match) {
            const hours = parseInt(match[1] || 0);
            const minutes = parseInt(match[2] || 0);
            return hours * 60 + minutes;
          }
          return 0;
        });
      
      if (durations.length > 0) {
        const averageMinutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        const averageDuration = `${Math.floor(averageMinutes / 60)}h ${averageMinutes % 60}m`;
        
        await Visitor.findOneAndUpdate(
          { id: req.params.id },
          { $set: { averageVisitDuration: averageDuration } }
        );
      }
    }

    const finalVisitor = await Visitor.findOne({ id: req.params.id });
    const visitorWithFullName = {
      ...finalVisitor.toObject(),
      fullName: finalVisitor.fullName
    };

    res.json({ 
      message: "Time out approved and visit completed",
      visitor: visitorWithFullName,
      visitHistory: visitHistoryEntry
    });

  } catch (error) {
    console.error("Error approving time out:", error);
    res.status(500).json({ message: "Failed to approve time out", error: error.message });
  }
});

// APPROVE GUEST TIME IN - SIMPLIFIED WITH CUSTOM TIMER
app.put("/guests/:id/approve-time-in", async (req, res) => {
  try {
    console.log('🔄 GUEST TIME-IN STARTED:', req.params.id);
    
    const guest = await Guest.findOne({ id: req.params.id });
    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('en-US', { 
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    });

    console.log('⏰ Guest time in at:', currentTime, 'Date:', todayDateString);

    // Check if already timed in today
    const alreadyTimedIn = guest.dailyVisits.some(visit => {
      if (!visit.visitDate) return false;
      const visitDate = new Date(visit.visitDate).toISOString().split('T')[0];
      return visitDate === todayDateString && visit.hasTimedIn && !visit.hasTimedOut;
    });

    if (alreadyTimedIn) {
      return res.status(400).json({ message: "Guest already timed in today" });
    }

    // SIMPLE TIMER LOGIC - Check if custom timer is set
    let timerStart, timerEnd;
    let timerMessage = "";
    let timerDuration = "";
    
    if (guest.timerStart && guest.timerEnd) {
      console.log('🕒 USING CUSTOM TIMER FOR GUEST:', {
        timerStart: guest.timerStart,
        timerEnd: guest.timerEnd,
        customTimer: guest.customTimer
      });
      
      timerStart = new Date(guest.timerStart);
      timerEnd = new Date(guest.timerEnd);
      
      // Validate timer doesn't end in the past
      const now = new Date();
      if (timerEnd <= now) {
        console.log('⚠️ Custom timer has ended, using default timer');
        // Fall back to default timer
        timerStart = new Date();
        timerEnd = new Date(timerStart.getTime() + (3 * 60 * 60 * 1000));
        timerDuration = "3h 0m";
        timerMessage = "Default 3-hour timer (custom timer expired)";
      } else {
        // Calculate duration for confirmation
        const diffMs = timerEnd - timerStart;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        timerDuration = `${hours}h ${minutes}m`;
        
        timerMessage = guest.customTimer ? 
          `Custom timer: ${guest.customTimer.startTime} - ${guest.customTimer.endTime} (${timerDuration})` :
          `Custom timer: ${timerDuration}`;
      }
    } else {
      // Default 3-hour timer
      console.log('⏰ USING DEFAULT 3-HOUR TIMER FOR GUEST - No custom timer found');
      timerStart = new Date();
      timerEnd = new Date(timerStart.getTime() + (3 * 60 * 60 * 1000));
      timerDuration = "3h 0m";
      timerMessage = "Default 3-hour timer";
    }

    // CREATE VISIT LOG FOR GUEST
    const visitLog = new VisitLog({
      personId: guest.id,
      personName: guest.fullName,
      personType: 'guest',
      visitDate: today,
      timeIn: currentTime,
      timerStart: timerStart,
      timerEnd: timerEnd,
      isTimerActive: true,
      status: 'in-progress'
    });

    await visitLog.save();
    console.log('✅ Guest visit log created:', visitLog._id);

    // CREATE NEW DAILY VISIT OBJECT FOR GUEST
    const newVisit = {
      visitDate: today,
      timeIn: currentTime,
      timeOut: null,
      hasTimedIn: true,
      hasTimedOut: false,
      timerStart: timerStart,
      timerEnd: timerEnd,
      isTimerActive: true,
      visitLogId: visitLog._id
    };

    // UPDATE GUEST - Clear existing daily visits for today first
    await Guest.findOneAndUpdate(
      { id: req.params.id },
      {
        $pull: {
          dailyVisits: {
            visitDate: {
              $gte: new Date(todayDateString + 'T00:00:00.000Z'),
              $lt: new Date(todayDateString + 'T23:59:59.999Z')
            }
          }
        }
      }
    );

    // Then add the new visit with timer
    const updatedGuest = await Guest.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          hasTimedIn: true,
          hasTimedOut: false,
          timeIn: currentTime,
          timeOut: null,
          isTimerActive: true,
          timerStart: timerStart,
          timerEnd: timerEnd,
          dateVisited: today,
          lastActiveDate: today,
          lastVisitDate: today,
          status: 'approved'
        },
        $push: { 
          dailyVisits: newVisit 
        }
      },
      { new: true }
    );

    console.log('✅ Guest updated successfully with timer');

    const guestWithFullName = {
      ...updatedGuest.toObject(),
      fullName: updatedGuest.fullName
    };

    res.json({ 
      message: timerMessage,
      guest: guestWithFullName,
      visitLog: visitLog,
      timerMessage: timerMessage,
      timerDuration: timerDuration,
      timerStart: timerStart,
      timerEnd: timerEnd
    });

  } catch (error) {
    console.error("❌ GUEST TIME-IN ERROR:", error);
    res.status(500).json({ 
      message: "Failed to approve time in", 
      error: error.message,
      stack: error.stack
    });
  }
});

// APPROVE GUEST TIME OUT - ENHANCED WITH VISIT HISTORY
app.put("/guests/:id/approve-time-out", async (req, res) => {
  try {
    console.log('🔄 GUEST TIME-OUT STARTED:', req.params.id);
    
    const guest = await Guest.findOne({ id: req.params.id });
    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    const currentTime = new Date().toLocaleTimeString('en-US', { 
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    });
    const today = new Date();

    console.log('⏰ Time out at:', currentTime);

    // SIMPLE CHECK: Use main fields
    if (!guest.hasTimedIn || guest.hasTimedOut) {
      return res.status(400).json({ message: "Guest has not timed in or already timed out" });
    }

    // FIND ACTIVE VISIT LOG
    const activeVisitLog = await VisitLog.findOne({
      personId: guest.id,
      personType: 'guest', 
      timeOut: null,
      status: 'in-progress'
    });

    let visitDuration = 'N/A';
    if (activeVisitLog) {
      visitDuration = calculateDuration(guest.timeIn, currentTime);
      await VisitLog.findByIdAndUpdate(
        activeVisitLog._id,
        {
          timeOut: currentTime,
          visitDuration: visitDuration,
          status: 'completed'
        }
      );
      console.log('✅ Visit log updated');
    }

    // ADD TO VISIT HISTORY
    const visitHistoryEntry = {
      visitDate: today,
      timeIn: guest.timeIn,
      timeOut: currentTime,
      duration: visitDuration,
      visitPurpose: guest.visitPurpose,
      visitLogId: activeVisitLog?._id,
      status: 'completed'
    };

    // UPDATE GUEST - Add to history and update statistics
    const updatedGuest = await Guest.findOneAndUpdate(
  { id: req.params.id },
  {
    $set: {
      hasTimedOut: true,
      timeOut: currentTime,
      status: 'completed',
      lastVisitDate: today,
      lastVisitDuration: visitDuration,
      lastActiveDate: today // ✅ ADD THIS LINE
    },
    $push: { visitHistory: visitHistoryEntry },
    $inc: { totalVisits: 1 }
  },
  { new: true }
);

    // Calculate average duration
    if (updatedGuest.visitHistory && updatedGuest.visitHistory.length > 0) {
      const durations = updatedGuest.visitHistory
        .filter(v => v.duration && v.duration !== 'N/A' && v.duration !== 'Error')
        .map(v => {
          const match = v.duration.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
          if (match) {
            const hours = parseInt(match[1] || 0);
            const minutes = parseInt(match[2] || 0);
            return hours * 60 + minutes;
          }
          return 0;
        });
      
      if (durations.length > 0) {
        const averageMinutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        const averageDuration = `${Math.floor(averageMinutes / 60)}h ${averageMinutes % 60}m`;
        
        await Guest.findOneAndUpdate(
          { id: req.params.id },
          { $set: { averageVisitDuration: averageDuration } }
        );
      }
    }

    const finalGuest = await Guest.findOne({ id: req.params.id });
    console.log('✅ Guest time out completed');

    const guestWithFullName = {
      ...finalGuest.toObject(),
      fullName: finalGuest.fullName
    };

    res.json({ 
      message: "Guest time out approved successfully",
      guest: guestWithFullName,
      visitHistory: visitHistoryEntry
    });

  } catch (error) {
    console.error("❌ GUEST TIME-OUT ERROR:", error);
    res.status(500).json({ 
      message: "Failed to approve time out", 
      error: error.message 
    });
  }
});

// ======================
// VIOLATION & BAN MANAGEMENT ENDPOINTS
// ======================

// Add violation to visitor - UPDATED WITH HISTORY
app.put("/visitors/:id/violation", async (req, res) => {
  try {
    const { violationType, violationDetails, recordedBy = 'System' } = req.body;
    
    const visitor = await Visitor.findOne({ id: req.params.id });
    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    // Record in violation history
    const violationHistory = new ViolationHistory({
      personId: visitor.id,
      personName: visitor.fullName,
      personType: 'visitor',
      violationType: violationType,
      violationDetails: violationDetails,
      recordedBy: recordedBy,
      status: 'active'
    });
    await violationHistory.save();

    const updatedVisitor = await Visitor.findOneAndUpdate(
      { id: req.params.id },
      { 
        violationType,
        violationDetails,
        status: 'approved'
      },
      { new: true }
    );

    res.json({ 
      message: "Violation added to visitor",
      visitor: updatedVisitor,
      violationRecord: violationHistory
    });
  } catch (error) {
    console.error("Error adding violation to visitor:", error);
    res.status(500).json({ message: "Failed to add violation", error: error.message });
  }
});

// Add violation to guest - UPDATED WITH HISTORY
app.put("/guests/:id/violation", async (req, res) => {
  try {
    const { violationType, violationDetails, recordedBy = 'System' } = req.body;
    
    const guest = await Guest.findOne({ id: req.params.id });
    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    // Record in violation history
    const violationHistory = new ViolationHistory({
      personId: guest.id,
      personName: guest.fullName,
      personType: 'guest',
      violationType: violationType,
      violationDetails: violationDetails,
      recordedBy: recordedBy,
      status: 'active'
    });
    await violationHistory.save();

    const updatedGuest = await Guest.findOneAndUpdate(
      { id: req.params.id },
      { 
        violationType,
        violationDetails,
        status: 'approved'
      },
      { new: true }
    );

    res.json({ 
      message: "Violation added to guest",
      guest: updatedGuest,
      violationRecord: violationHistory
    });
  } catch (error) {
    console.error("Error adding violation to guest:", error);
    res.status(500).json({ message: "Failed to add violation", error: error.message });
  }
});

// Remove violation from visitor - FIXED
app.put("/visitors/:id/remove-violation", async (req, res) => {
  try {
    const { removedBy = 'System', removalReason = 'Administrative removal' } = req.body;

    console.log(`🔄 Removing violation from visitor: ${req.params.id}`);

    // Find the MOST RECENT active violation history record
    const activeViolation = await ViolationHistory.findOne({ 
      personId: req.params.id, 
      personType: 'visitor', 
      status: 'active' 
    }).sort({ createdAt: -1 }); // Get the most recent one

    if (activeViolation) {
      console.log(`✅ Found active violation record: ${activeViolation._id}`);
      // UPDATE the specific record with removal info
      await ViolationHistory.findByIdAndUpdate(
        activeViolation._id,
        { 
          status: 'removed',
          removedAt: new Date(),
          removedBy: removedBy,
          removalReason: removalReason
        }
      );
      console.log(`✅ Updated violation history with removal info`);
    } else {
      console.log(`⚠️ No active violation history record found for ${req.params.id}`);
      // Create a removed record for audit trail
      const visitor = await Visitor.findOne({ id: req.params.id });
      if (visitor) {
        const violationHistory = new ViolationHistory({
          personId: req.params.id,
          personName: visitor.fullName,
          personType: 'visitor',
          violationType: 'Unknown (Removed)',
          violationDetails: 'Violation was removed without active history record',
          status: 'removed',
          recordedBy: 'System',
          removedAt: new Date(),
          removedBy: removedBy,
          removalReason: removalReason
        });
        await violationHistory.save();
        console.log(`✅ Created removal record for audit trail`);
      }
    }

    // Update the visitor to remove violation
    const updatedVisitor = await Visitor.findOneAndUpdate(
      { id: req.params.id },
      { 
        violationType: null,
        violationDetails: null
      },
      { new: true }
    );

    if (!updatedVisitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    console.log(`✅ Violation removed from visitor: ${req.params.id}`);
    
    res.json({ 
      message: "Violation removed from visitor",
      visitor: updatedVisitor
    });
  } catch (error) {
    console.error("❌ Error removing violation from visitor:", error);
    res.status(500).json({ message: "Failed to remove violation", error: error.message });
  }
});

// Remove violation from guest - FIXED
app.put("/guests/:id/remove-violation", async (req, res) => {
  try {
    const { removedBy = 'System', removalReason = 'Administrative removal' } = req.body;

    console.log(`🔄 Removing violation from guest: ${req.params.id}`);

    // Find the MOST RECENT active violation history record
    const activeViolation = await ViolationHistory.findOne({ 
      personId: req.params.id, 
      personType: 'guest', 
      status: 'active' 
    }).sort({ createdAt: -1 }); // Get the most recent one

    if (activeViolation) {
      console.log(`✅ Found active violation record: ${activeViolation._id}`);
      // UPDATE the specific record with removal info
      await ViolationHistory.findByIdAndUpdate(
        activeViolation._id,
        { 
          status: 'removed',
          removedAt: new Date(),
          removedBy: removedBy,
          removalReason: removalReason
        }
      );
      console.log(`✅ Updated violation history with removal info`);
    } else {
      console.log(`⚠️ No active violation history record found for ${req.params.id}`);
      // Create a removed record for audit trail
      const guest = await Guest.findOne({ id: req.params.id });
      if (guest) {
        const violationHistory = new ViolationHistory({
          personId: req.params.id,
          personName: guest.fullName,
          personType: 'guest',
          violationType: 'Unknown (Removed)',
          violationDetails: 'Violation was removed without active history record',
          status: 'removed',
          recordedBy: 'System',
          removedAt: new Date(),
          removedBy: removedBy,
          removalReason: removalReason
        });
        await violationHistory.save();
        console.log(`✅ Created removal record for audit trail`);
      }
    }

    const updatedGuest = await Guest.findOneAndUpdate(
      { id: req.params.id },
      { 
        violationType: null,
        violationDetails: null
      },
      { new: true }
    );

    if (!updatedGuest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    console.log(`✅ Violation removed from guest: ${req.params.id}`);
    
    res.json({ 
      message: "Violation removed from guest",
      guest: updatedGuest
    });
  } catch (error) {
    console.error("❌ Error removing violation from guest:", error);
    res.status(500).json({ message: "Failed to remove violation", error: error.message });
  }
});

// Ban visitor - UPDATED WITH DURATION CALCULATION
app.put("/visitors/:id/ban", async (req, res) => {
  try {
    const { reason, duration, notes, isBanned = true, bannedBy = 'System', customDuration } = req.body;
    
    const visitor = await Visitor.findOne({ id: req.params.id });
    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    // Calculate ban end date
    const banEndDate = calculateBanEndDate(duration, customDuration);
    const banStartDate = new Date().toISOString();

    // Record in ban history
    const banHistory = new BanHistory({
      personId: visitor.id,
      personName: visitor.fullName,
      personType: 'visitor',
      banReason: reason,
      banDuration: duration,
      banEndDate: banEndDate,
      banNotes: notes,
      bannedBy: bannedBy,
      status: 'active',
      createdAt: banStartDate
    });
    await banHistory.save();

    const updatedVisitor = await Visitor.findOneAndUpdate(
      { id: req.params.id },
      { 
        isBanned,
        banReason: reason,
        banDuration: duration,
        banEndDate: banEndDate,
        banStartDate: banStartDate,
        banNotes: notes,
        violationType: 'Banned',
        violationDetails: reason || 'Banned by administrator'
      },
      { new: true }
    );

    const visitorWithFullName = {
      ...updatedVisitor.toObject(),
      fullName: updatedVisitor.fullName
    };

    res.json({ 
      message: "Visitor banned successfully",
      visitor: visitorWithFullName,
      banRecord: banHistory,
      banDetails: {
        startDate: banStartDate,
        endDate: banEndDate,
        duration: duration
      }
    });
  } catch (error) {
    console.error("Error banning visitor:", error);
    res.status(500).json({ message: "Failed to ban visitor", error: error.message });
  }
});

// Ban guest - UPDATED WITH DURATION CALCULATION
app.put("/guests/:id/ban", async (req, res) => {
  try {
    const { reason, duration, notes, isBanned = true, bannedBy = 'System', customDuration } = req.body;
    
    const guest = await Guest.findOne({ id: req.params.id });
    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    // Calculate ban end date
    const banEndDate = calculateBanEndDate(duration, customDuration);
    const banStartDate = new Date().toISOString();

    // Record in ban history
    const banHistory = new BanHistory({
      personId: guest.id,
      personName: guest.fullName,
      personType: 'guest',
      banReason: reason,
      banDuration: duration,
      banEndDate: banEndDate,
      banNotes: notes,
      bannedBy: bannedBy,
      status: 'active',
      createdAt: banStartDate
    });
    await banHistory.save();

    const updatedGuest = await Guest.findOneAndUpdate(
      { id: req.params.id },
      { 
        isBanned,
        banReason: reason,
        banDuration: duration,
        banEndDate: banEndDate,
        banStartDate: banStartDate,
        banNotes: notes,
        violationType: 'Banned',
        violationDetails: reason || 'Banned by administrator'
      },
      { new: true }
    );

    const guestWithFullName = {
      ...updatedGuest.toObject(),
      fullName: updatedGuest.fullName
    };

    res.json({ 
      message: "Guest banned successfully",
      guest: guestWithFullName,
      banRecord: banHistory,
      banDetails: {
        startDate: banStartDate,
        endDate: banEndDate,
        duration: duration
      }
    });
  } catch (error) {
    console.error("Error banning guest:", error);
    res.status(500).json({ message: "Failed to ban guest", error: error.message });
  }
});

// UPDATE REMOVE BAN ENDPOINTS
// Remove ban from visitor - FIXED
app.put("/visitors/:id/remove-ban", async (req, res) => {
  try {
    const { removedBy = 'System', removalReason = 'Administrative removal' } = req.body;

    console.log(`🔄 Removing ban from visitor: ${req.params.id}`);

    const visitor = await Visitor.findOne({ id: req.params.id });
    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    // Find the MOST RECENT active ban history record
    const activeBan = await BanHistory.findOne({ 
      personId: req.params.id, 
      personType: 'visitor', 
      status: 'active' 
    }).sort({ createdAt: -1 }); // Get the most recent one

    if (activeBan) {
      console.log(`✅ Found active ban record: ${activeBan._id}`);
      // UPDATE the specific record with removal info
      await BanHistory.findByIdAndUpdate(
        activeBan._id,
        { 
          status: 'removed',
          removedAt: new Date(),
          removedBy: removedBy,
          removalReason: removalReason
        }
      );
      console.log(`✅ Updated ban history with removal info`);
    } else {
      console.log(`⚠️ No active ban history record found for ${req.params.id}`);
      // Create a removed record for audit trail
      const banHistory = new BanHistory({
        personId: req.params.id,
        personName: visitor.fullName,
        personType: 'visitor',
        banReason: visitor.banReason || 'Unknown (Removed)',
        banDuration: visitor.banDuration || 'permanent',
        banNotes: visitor.banNotes,
        banStartDate: visitor.banStartDate,
        banEndDate: visitor.banEndDate,
        calculatedDuration: visitor.calculatedDuration,
        status: 'removed',
        bannedBy: 'System',
        removedAt: new Date(),
        removedBy: removedBy,
        removalReason: removalReason
      });
      await banHistory.save();
      console.log(`✅ Created removal record for audit trail`);
    }

    // Remove ban from visitor and clear ALL ban fields
    const updatedVisitor = await Visitor.findOneAndUpdate(
      { id: req.params.id },
      { 
        isBanned: false,
        banReason: null,
        banDuration: null,
        banStartDate: null,
        banEndDate: null,
        calculatedDuration: null,
        banNotes: null,
        violationType: null,
        violationDetails: null
      },
      { new: true }
    );

    const visitorWithFullName = {
      ...updatedVisitor.toObject(),
      fullName: updatedVisitor.fullName
    };

    console.log(`✅ Ban removed from visitor: ${req.params.id}`);
    
    res.json({ 
      message: "Ban removed from visitor successfully",
      visitor: visitorWithFullName,
      removalDetails: {
        removedAt: new Date(),
        removedBy: removedBy,
        removalReason: removalReason
      }
    });
  } catch (error) {
    console.error("❌ Error removing ban from visitor:", error);
    res.status(500).json({ message: "Failed to remove ban", error: error.message });
  }
});

// Remove ban from guest - FIXED
app.put("/guests/:id/remove-ban", async (req, res) => {
  try {
    const { removedBy = 'System', removalReason = 'Administrative removal' } = req.body;

    console.log(`🔄 Removing ban from guest: ${req.params.id}`);

    const guest = await Guest.findOne({ id: req.params.id });
    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    // Find the MOST RECENT active ban history record
    const activeBan = await BanHistory.findOne({ 
      personId: req.params.id, 
      personType: 'guest', 
      status: 'active' 
    }).sort({ createdAt: -1 }); // Get the most recent one

    if (activeBan) {
      console.log(`✅ Found active ban record: ${activeBan._id}`);
      // UPDATE the specific record with removal info
      await BanHistory.findByIdAndUpdate(
        activeBan._id,
        { 
          status: 'removed',
          removedAt: new Date(),
          removedBy: removedBy,
          removalReason: removalReason
        }
      );
      console.log(`✅ Updated ban history with removal info`);
    } else {
      console.log(`⚠️ No active ban history record found for ${req.params.id}`);
      // Create a removed record for audit trail
      const banHistory = new BanHistory({
        personId: req.params.id,
        personName: guest.fullName,
        personType: 'guest',
        banReason: guest.banReason || 'Unknown (Removed)',
        banDuration: guest.banDuration || 'permanent',
        banNotes: guest.banNotes,
        banStartDate: guest.banStartDate,
        banEndDate: guest.banEndDate,
        calculatedDuration: guest.calculatedDuration,
        status: 'removed',
        bannedBy: 'System',
        removedAt: new Date(),
        removedBy: removedBy,
        removalReason: removalReason
      });
      await banHistory.save();
      console.log(`✅ Created removal record for audit trail`);
    }

    // Remove ban from guest and clear ALL ban fields
    const updatedGuest = await Guest.findOneAndUpdate(
      { id: req.params.id },
      { 
        isBanned: false,
        banReason: null,
        banDuration: null,
        banStartDate: null,
        banEndDate: null,
        calculatedDuration: null,
        banNotes: null,
        violationType: null,
        violationDetails: null
      },
      { new: true }
    );

    const guestWithFullName = {
      ...updatedGuest.toObject(),
      fullName: updatedGuest.fullName
    };

    console.log(`✅ Ban removed from guest: ${req.params.id}`);
    
    res.json({ 
      message: "Ban removed from guest successfully",
      guest: guestWithFullName,
      removalDetails: {
        removedAt: new Date(),
        removedBy: removedBy,
        removalReason: removalReason
      }
    });
  } catch (error) {
    console.error("❌ Error removing ban from guest:", error);
    res.status(500).json({ message: "Failed to remove ban", error: error.message });
  }
});



// ======================
// NEW BAN MANAGEMENT ENDPOINTS 
// ======================

// Get currently banned with time remaining
app.get("/currently-banned", async (req, res) => {
  try {
    // First auto-expire any bans
    await autoExpireBans();
    
    const [visitors, guests] = await Promise.all([
      Visitor.find({ isBanned: true }),
      Guest.find({ isBanned: true })
    ]);
    
    const bannedWithTimeRemaining = [];
    
    // Process visitors
    for (const visitor of visitors) {
      const timeRemaining = getBanTimeRemaining(
        visitor.banDuration, 
        visitor.banStartDate || visitor.createdAt, 
        visitor.banEndDate
      );
      
      bannedWithTimeRemaining.push({
        ...visitor.toObject(),
        personType: 'visitor',
        personName: visitor.fullName,
        id: visitor.id,
        timeRemaining: timeRemaining.timeRemaining,
        exactDuration: timeRemaining.exactDuration,
        isExpired: timeRemaining.expired,
        banStatus: timeRemaining.expired ? 'Expired' : 'Active',
        banStartDate: visitor.banStartDate || visitor.createdAt,
        banEndDate: timeRemaining.endDate || visitor.banEndDate
      });
    }
    
    // Process guests
    for (const guest of guests) {
      const timeRemaining = getBanTimeRemaining(
        guest.banDuration, 
        guest.banStartDate || guest.createdAt, 
        guest.banEndDate
      );
      
      bannedWithTimeRemaining.push({
        ...guest.toObject(),
        personType: 'guest',
        personName: guest.fullName,
        id: guest.id,
        timeRemaining: timeRemaining.timeRemaining,
        exactDuration: timeRemaining.exactDuration,
        isExpired: timeRemaining.expired,
        banStatus: timeRemaining.expired ? 'Expired' : 'Active',
        banStartDate: guest.banStartDate || guest.createdAt,
        banEndDate: timeRemaining.endDate || guest.banEndDate
      });
    }
    
    // Filter out expired bans from current banned list
    const currentlyBanned = bannedWithTimeRemaining.filter(person => !person.isExpired);
    
    res.json({
      currentlyBanned: currentlyBanned,
      expiredBans: bannedWithTimeRemaining.filter(person => person.isExpired),
      totalActive: currentlyBanned.length,
      totalExpired: bannedWithTimeRemaining.filter(person => person.isExpired).length
    });
    
  } catch (error) {
    console.error("Error fetching currently banned:", error);
    res.status(500).json({ message: "Failed to fetch banned list", error: error.message });
  }
});

// Get ban status for a specific person
app.get("/ban-status/:personType/:id", async (req, res) => {
  try {
    const { personType, id } = req.params;
    
    let person;
    if (personType === 'visitor') {
      person = await Visitor.findOne({ id: id });
    } else if (personType === 'guest') {
      person = await Guest.findOne({ id: id });
    } else {
      return res.status(400).json({ message: "Invalid person type" });
    }
    
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }
    
    if (!person.isBanned) {
      return res.json({
        isBanned: false,
        message: "Person is not banned"
      });
    }
    
    const timeRemaining = getBanTimeRemaining(
      person.banDuration, 
      person.banStartDate || person.createdAt, 
      person.banEndDate
    );
    
    res.json({
      isBanned: true,
      personId: person.id,
      personName: person.fullName,
      personType: personType,
      banReason: person.banReason,
      banDuration: person.banDuration,
      banStartDate: person.banStartDate || person.createdAt,
      banEndDate: timeRemaining.endDate || person.banEndDate,
      timeRemaining: timeRemaining.timeRemaining,
      exactDuration: timeRemaining.exactDuration,
      isExpired: timeRemaining.expired,
      banStatus: timeRemaining.expired ? 'Expired' : 'Active'
    });
    
  } catch (error) {
    console.error("Error fetching ban status:", error);
    res.status(500).json({ message: "Failed to fetch ban status", error: error.message });
  }
});

// Manual trigger to expire bans (for testing)
app.post("/bans/expire-check", async (req, res) => {
  try {
    const expiredCount = await autoExpireBans();
    res.json({
      message: `Ban expiration check completed`,
      expiredCount: expiredCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in expire check:", error);
    res.status(500).json({ message: "Failed to check ban expiration", error: error.message });
  }
});

// Update ban history to include end dates
app.get("/ban-history-with-details", async (req, res) => {
  try {
    const { personId, personType, status, startDate, endDate } = req.query;
    
    let filter = {};
    if (personId) filter.personId = personId;
    if (personType) filter.personType = personType;
    if (status) filter.status = status;
    
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    const banHistory = await BanHistory.find(filter).sort({ createdAt: -1 });
    
    // Add time remaining and status details
    const banHistoryWithDetails = banHistory.map(record => {
      const timeRemaining = getBanTimeRemaining(
        record.banDuration,
        record.createdAt,
        record.banEndDate
      );
      
      return {
        ...record.toObject(),
        timeRemaining: timeRemaining.timeRemaining,
        exactDuration: timeRemaining.exactDuration,
        isExpired: timeRemaining.expired,
        calculatedEndDate: timeRemaining.endDate
      };
    });

    res.json(banHistoryWithDetails);
  } catch (error) {
    console.error("Error fetching ban history with details:", error);
    res.status(500).json({ message: "Failed to fetch ban history", error: error.message });
  }
});

// ======================
// BAN & VIOLATION HISTORY ENDPOINTS
// ======================

// Get all ban history
app.get("/ban-history", async (req, res) => {
  try {
    const { personId, personType, status, startDate, endDate, search } = req.query;
    
    let filter = {};
    if (personId) filter.personId = personId;
    if (personType) filter.personType = personType;
    if (status) filter.status = status;
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { personName: { $regex: search, $options: 'i' } },
        { personId: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    const banHistory = await BanHistory.find(filter).sort({ createdAt: -1 });
    res.json(banHistory);
  } catch (error) {
    console.error("Error fetching ban history:", error);
    res.status(500).json({ message: "Failed to fetch ban history", error: error.message });
  }
});

// Get all violation history
app.get("/violation-history", async (req, res) => {
  try {
    const { personId, personType, status, startDate, endDate, search } = req.query;
    
    let filter = {};
    if (personId) filter.personId = personId;
    if (personType) filter.personType = personType;
    if (status) filter.status = status;
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { personName: { $regex: search, $options: 'i' } },
        { personId: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    const violationHistory = await ViolationHistory.find(filter).sort({ createdAt: -1 });
    res.json(violationHistory);
  } catch (error) {
    console.error("Error fetching violation history:", error);
    res.status(500).json({ message: "Failed to fetch violation history", error: error.message });
  }
});

// Get ban history statistics
app.get("/ban-history/stats", async (req, res) => {
  try {
    const totalBans = await BanHistory.countDocuments();
    const activeBans = await BanHistory.countDocuments({ status: 'active' });
    const removedBans = await BanHistory.countDocuments({ status: 'removed' });
    
    // Monthly ban statistics
    const monthlyBans = await BanHistory.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 }
    ]);

    res.json({
      totalBans,
      activeBans,
      removedBans,
      monthlyBans: monthlyBans.map(item => ({
        month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
        count: item.count
      }))
    });
  } catch (error) {
    console.error("Error fetching ban history stats:", error);
    res.status(500).json({ message: "Failed to fetch ban history statistics", error: error.message });
  }
});

// Get violation history statistics
app.get("/violation-history/stats", async (req, res) => {
  try {
    const totalViolations = await ViolationHistory.countDocuments();
    const activeViolations = await ViolationHistory.countDocuments({ status: 'active' });
    const removedViolations = await ViolationHistory.countDocuments({ status: 'removed' });
    
    // Violation type distribution
    const violationTypes = await ViolationHistory.aggregate([
      {
        $group: {
          _id: "$violationType",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      totalViolations,
      activeViolations,
      removedViolations,
      violationTypes
    });
  } catch (error) {
    console.error("Error fetching violation history stats:", error);
    res.status(500).json({ message: "Failed to fetch violation history statistics", error: error.message });
  }
});

// Delete ban history record
app.delete("/ban-history/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔄 Deleting ban history record: ${id}`);
    
    const deletedRecord = await BanHistory.findByIdAndDelete(id);
    
    if (!deletedRecord) {
      return res.status(404).json({ message: "Ban history record not found" });
    }
    
    console.log(`✅ Ban history record deleted: ${id}`);
    res.json({ 
      message: "Ban history record deleted successfully",
      deletedRecord: deletedRecord
    });
    
  } catch (error) {
    console.error("❌ Error deleting ban history record:", error);
    res.status(500).json({ message: "Failed to delete ban history record", error: error.message });
  }
});

// Delete violation history record
app.delete("/violation-history/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔄 Deleting violation history record: ${id}`);
    
    const deletedRecord = await ViolationHistory.findByIdAndDelete(id);
    
    if (!deletedRecord) {
      return res.status(404).json({ message: "Violation history record not found" });
    }
    
    console.log(`✅ Violation history record deleted: ${id}`);
    res.json({ 
      message: "Violation history record deleted successfully",
      deletedRecord: deletedRecord
    });
    
  } catch (error) {
    console.error("❌ Error deleting violation history record:", error);
    res.status(500).json({ message: "Failed to delete violation history record", error: error.message });
  }
});

// ======================
// RESET ENDPOINTS (FOR TESTING ONLY)
// ======================

// RESET PERSON - FOR TESTING
app.put("/reset-person/:personId", async (req, res) => {
  try {
    const { personId } = req.params;
    const { personType } = req.body;

    if (!personType) {
      return res.status(400).json({ message: "Person type is required" });
    }

    let person;
    if (personType === 'visitor') {
      person = await Visitor.findOne({ id: personId });
    } else if (personType === 'guest') {
      person = await Guest.findOne({ id: personId });
    } else {
      return res.status(400).json({ message: "Invalid person type" });
    }

    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    // Reset all time fields but preserve visit history
    const updateData = {
      hasTimedIn: false,
      hasTimedOut: false,
      timeIn: null,
      timeOut: null,
      isTimerActive: false,
      timerStart: null,
      timerEnd: null,
      // Preserve lastVisitDate and dateVisited for historical tracking
      lastVisitDate: person.lastVisitDate,
      dateVisited: person.dateVisited,
      dailyVisits: []
    };

    let updatedPerson;
    if (personType === 'visitor') {
      updatedPerson = await Visitor.findOneAndUpdate(
        { id: personId },
        updateData,
        { new: true }
      );
    } else {
      updateData.status = 'approved';
      updatedPerson = await Guest.findOneAndUpdate(
        { id: personId },
        updateData,
        { new: true }
      );
    }

    res.json({ 
      message: `Person has been reset and can start fresh. Visit history preserved.`,
      person: updatedPerson
    });

  } catch (error) {
    console.error("Error resetting person:", error);
    res.status(500).json({ 
      message: "Failed to reset person", 
      error: error.message 
    });
  }
});

// MANUAL RESET FOR TESTING - Clears time records for a person but preserves history
app.put("/reset-person-time/:personId", async (req, res) => {
  try {
    const { personId } = req.params;
    const { personType } = req.body;

    console.log('🔄 MANUAL TIME RESET:', { personId, personType });

    if (!personType) {
      return res.status(400).json({ message: "Person type is required" });
    }

    let person;
    if (personType === 'visitor') {
      person = await Visitor.findOne({ id: personId });
    } else if (personType === 'guest') {
      person = await Guest.findOne({ id: personId });
    } else {
      return res.status(400).json({ message: "Invalid person type" });
    }

    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    // Reset all time fields but preserve visit history and last visit dates
    const updateData = {
      hasTimedIn: false,
      hasTimedOut: false,
      timeIn: null,
      timeOut: null,
      dailyVisits: []
    };

    // Add visitor-specific fields
    if (personType === 'visitor') {
      updateData.isTimerActive = false;
      updateData.timerStart = null;
      updateData.timerEnd = null;
      updateData.visitApproved = false;
    }

    // Add guest-specific fields
    if (personType === 'guest') {
      updateData.status = 'approved';
    }

    let updatedPerson;
    if (personType === 'visitor') {
      updatedPerson = await Visitor.findOneAndUpdate(
        { id: personId },
        updateData,
        { new: true }
      );
    } else {
      updatedPerson = await Guest.findOneAndUpdate(
        { id: personId },
        updateData,
        { new: true }
      );
    }

    // Also clear any active visit logs
    await VisitLog.updateMany(
      { 
        personId: personId, 
        timeOut: null 
      },
      {
        timeOut: new Date().toLocaleTimeString('en-US', { 
          hour12: true,
          hour: '2-digit',
          minute: '2-digit'
        }),
        status: 'completed'
      }
    );

    res.json({ 
      message: `Time records reset for ${updatedPerson.fullName}. Visit history preserved. They can now scan again.`,
      success: true,
      person: updatedPerson
    });

  } catch (error) {
    console.error("❌ Manual reset error:", error);
    res.status(500).json({ 
      message: "Failed to reset time records", 
      error: error.message 
    });
  }
});

// ======================
// VISIT LOG ENDPOINTS
// ======================

// Get all visit logs with filtering
app.get("/visit-logs", async (req, res) => {
  try {
    const { startDate, endDate, personType, personId } = req.query;
    
    let filter = {};
    
    if (startDate && endDate) {
      filter.visitDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }
    
    if (personType) filter.personType = personType;
    if (personId) filter.personId = personId;

    const visitLogs = await VisitLog.find(filter).sort({ visitDate: -1, timeIn: -1 });
    res.json(visitLogs);
  } catch (error) {
    console.error("Error fetching visit logs:", error);
    res.status(500).json({ message: "Failed to fetch visit logs", error: error.message });
  }
});

// Get active visitor timers for dashboard
app.get("/visit-logs/active-visitor-timers", async (req, res) => {
  try {
    const activeVisitLogs = await VisitLog.find({
      personType: 'visitor',
      isTimerActive: true,
      timerEnd: { $gt: new Date() },
      status: 'in-progress',
      timeOut: null
    });

    const activeTimersWithDetails = await Promise.all(
      activeVisitLogs.map(async (log) => {
        const timeRemaining = Math.max(0, new Date(log.timerEnd) - new Date());
        const timeRemainingMinutes = Math.floor(timeRemaining / (1000 * 60));
        
        return {
          ...log.toObject(),
          fullName: log.personName,
          timeRemaining: timeRemaining,
          timeRemainingMinutes: timeRemainingMinutes,
          prisonerId: log.prisonerId,
          inmateName: log.inmateName,
          timeIn: log.timeIn
        };
      })
    );

    const sortedTimers = activeTimersWithDetails.sort((a, b) => a.timeRemainingMinutes - b.timeRemainingMinutes);
    res.json(sortedTimers);
  } catch (error) {
    console.error("Error fetching active visitor timers:", error);
    res.status(500).json({ 
      message: "Failed to fetch active visitor timers", 
      error: error.message 
    });
  }
});

// Delete visit log
app.delete("/visit-logs/:id", async (req, res) => {
  try {
    const deletedLog = await VisitLog.findByIdAndDelete(req.params.id);
    
    if (!deletedLog) {
      return res.status(404).json({ message: "Visit log not found" });
    }
    
    res.json({ message: "Visit log deleted successfully" });
  } catch (error) {
    console.error("Error deleting visit log:", error);
    res.status(500).json({ message: "Failed to delete visit log", error: error.message });
  }
});

// ======================
// USER ENDPOINTS - FULL CRUD
// ======================

// CREATE USER
app.post("/users", async (req, res) => {
  const { name, email, password, role } = req.body;
  
  if (!name || !email || !password || !role) {
    return res.status(400).json({ 
      message: "All fields are required: name, email, password, role" 
    });
  }

  const validRoles = ['FullAdmin', 'MaleAdmin', 'FemaleAdmin', 'FullStaff', 'MaleStaff', 'FemaleStaff'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ 
      message: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
    });
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ 
        message: "User with this email already exists" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP for first-time login
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role,
      otp: otp,
      otpExpiry: otpExpiry,
      isFirstLogin: true
    });

    await user.save();
    
    // Send OTP via email
    const emailResult = await sendOTPEmail(user.email, otp, user.name);
    
    if (!emailResult.success) {
      console.error('Failed to send OTP email:', emailResult.error);
      // Note: We still create the user even if email fails
    }
    
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isFirstLogin: user.isFirstLogin,
      createdAt: user.createdAt
    };
    
    res.status(201).json({ 
      message: emailResult.success 
        ? "User created successfully. OTP has been sent to the email." 
        : "User created successfully. However, failed to send OTP email. Please contact administrator.",
      user: userResponse,
      emailSent: emailResult.success
    });
  } catch (error) {
    console.error("User creation error:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: "Validation error", 
        error: error.message 
      });
    }
    
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: "Email already exists" 
      });
    }
    
    res.status(500).json({ 
      message: "Failed to create user", 
      error: error.message 
    });
  }
});

// GET ALL USERS
app.get("/users", async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ 
      message: "Failed to fetch users", 
      error: error.message 
    });
  }
});

// GET SINGLE USER
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ 
      message: "Failed to fetch user", 
      error: error.message 
    });
  }
});

// UPDATE USER
app.put("/users/:id", async (req, res) => {
  try {
    const { name, email, role, password, isActive } = req.body;
    
    const updateData = { name, email, role, isActive };
    
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ 
      message: "User updated successfully", 
      user: updatedUser 
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ 
      message: "Failed to update user", 
      error: error.message 
    });
  }
});

// UPDATE USER PROFILE (name and email only)
app.put("/users/:id/profile", async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    
    // Check if email is already taken by another user
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(),
      _id: { $ne: req.params.id }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use by another user" });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { 
        name: name.trim(),
        email: email.toLowerCase().trim()
      },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({ 
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ 
      error: "Failed to update profile", 
      details: error.message 
    });
  }
});

// CHANGE USER PASSWORD
app.put("/users/:id/password", async (req, res) => {
  try {
    console.log('Password change request for user ID:', req.params.id);
    const { currentPassword, newPassword } = req.body;
    
    console.log('Request body received:', { 
      hasCurrentPassword: !!currentPassword, 
      hasNewPassword: !!newPassword,
      newPasswordLength: newPassword?.length 
    });
    
    if (!currentPassword || !newPassword) {
      console.log('Missing password fields');
      return res.status(400).json({ error: "Current password and new password are required" });
    }
    
    if (newPassword.length < 6) {
      console.log('New password too short');
      return res.status(400).json({ error: "New password must be at least 6 characters long" });
    }
    
    const user = await User.findById(req.params.id);
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('User not found with ID:', req.params.id);
      return res.status(404).json({ error: "User not found" });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    console.log('Current password match:', isMatch);
    
    if (!isMatch) {
      console.log('Current password incorrect');
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    
    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      console.log('New password same as current');
      return res.status(400).json({ error: "New password must be different from current password" });
    }
    
    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    
    console.log('Password changed successfully for user:', user.email);
    res.json({ 
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error("Error changing password:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      error: "Failed to change password", 
      details: error.message 
    });
  }
});

// DELETE USER
app.delete("/users/:id", async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json({ 
      message: "User deleted successfully",
      user: {
        name: deletedUser.name,
        email: deletedUser.email,
        role: deletedUser.role
      }
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ 
      message: "Failed to delete user", 
      error: error.message 
    });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isActive: true 
    });
    
    if (!user) {
      return res.status(400).json({ message: "User not found or inactive" });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    
    // Check if this is first-time login requiring OTP
    if (user.isFirstLogin) {
      return res.json({ 
        requireOTP: true,
        userId: user._id,
        email: user.email,
        message: "Please enter the OTP sent to your email"
      });
    }
    
    const userResponse = {
      _id: user._id,
      email: user.email, 
      role: user.role,
      name: user.name,
      isActive: user.isActive
    };
    
    res.json({ 
      requireOTP: false,
      user: userResponse 
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      message: "Login failed", 
      error: error.message 
    });
  }
});

// VERIFY OTP
app.post("/verify-otp", async (req, res) => {
  const { userId, otp } = req.body;
  
  if (!userId || !otp) {
    return res.status(400).json({ 
      message: "User ID and OTP are required" 
    });
  }
  
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (!user.isFirstLogin) {
      return res.status(400).json({ 
        message: "OTP verification not required for this user" 
      });
    }
    
    // Check if OTP matches
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    
    // Check if OTP has expired
    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ 
        message: "OTP has expired. Please request a new one." 
      });
    }
    
    // Mark user as verified
    user.isFirstLogin = false;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();
    
    const userResponse = {
      _id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      isActive: user.isActive
    };
    
    res.json({ 
      message: "OTP verified successfully",
      user: userResponse 
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ 
      message: "OTP verification failed", 
      error: error.message 
    });
  }
});

// RESEND OTP
app.post("/resend-otp", async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }
  
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (!user.isFirstLogin) {
      return res.status(400).json({ 
        message: "OTP not required for this user" 
      });
    }
    
    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();
    
    // Send OTP via email
    const emailResult = await sendOTPEmail(user.email, otp, user.name);
    
    if (!emailResult.success) {
      return res.status(500).json({ 
        message: "Failed to send OTP email",
        error: emailResult.error 
      });
    }
    
    res.json({ 
      message: "OTP has been resent to your email" 
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ 
      message: "Failed to resend OTP", 
      error: error.message 
    });
  }
});

// FORGOT PASSWORD - Send OTP
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  
  try {
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isActive: true 
    });
    
    if (!user) {
      return res.status(404).json({ 
        message: "No account found with this email address" 
      });
    }
    
    // Generate OTP for password reset
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();
    
    // Log OTP in console for development/testing
    console.log('🔐 Password Reset OTP for', user.email, ':', otp);
    console.log('📧 Attempting to send OTP email...');
    
    // Send password reset OTP via email
    const emailResult = await sendPasswordResetOTP(user.email, otp, user.name);
    
    if (!emailResult.success) {
      console.error('❌ Email sending failed:', emailResult.error);
      // Still return success but with a warning - OTP is logged in console
      return res.json({ 
        message: "OTP generated (check server console). Email service temporarily unavailable.",
        userId: user._id,
        emailSent: false,
        devNote: "OTP logged in server console"
      });
    }
    
    console.log('✅ Password reset OTP email sent successfully');
    res.json({ 
      message: "OTP sent to your email",
      userId: user._id,
      emailSent: true
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ 
      message: "Failed to process forgot password request", 
      error: error.message 
    });
  }
});

// VERIFY RESET OTP (for forgot password flow)
app.post("/verify-reset-otp", async (req, res) => {
  const { userId, otp } = req.body;
  
  if (!userId || !otp) {
    return res.status(400).json({ 
      message: "User ID and OTP are required" 
    });
  }
  
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if OTP matches
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    
    // Check if OTP has expired
    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ 
        message: "OTP has expired. Please request a new one." 
      });
    }
    
    // Don't clear OTP yet - we need it for the reset password step
    res.json({ 
      message: "OTP verified successfully"
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ 
      message: "OTP verification failed", 
      error: error.message 
    });
  }
});

// RESET PASSWORD (final step of forgot password)
app.post("/reset-password", async (req, res) => {
  const { userId, otp, newPassword } = req.body;
  
  if (!userId || !otp || !newPassword) {
    return res.status(400).json({ 
      message: "User ID, OTP, and new password are required" 
    });
  }
  
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Verify OTP again
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    
    // Check if OTP has expired
    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ 
        message: "OTP has expired. Please request a new one." 
      });
    }
    
    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        message: "Password must be at least 8 characters long" 
      });
    }
    
    // Check password complexity
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_\-]/.test(newPassword);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return res.status(400).json({ 
        message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character" 
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password and clear OTP
    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.isFirstLogin = false; // Ensure they don't need OTP on next login
    await user.save();
    
    console.log('Password reset successfully for user:', user.email);
    res.json({ 
      message: "Password reset successfully"
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ 
      message: "Failed to reset password", 
      error: error.message 
    });
  }
});

// ======================
// CRIME ENDPOINTS - FULL CRUD
// ======================

// CREATE CRIME
app.post("/crimes", async (req, res) => {
  try {
    const { crime, status = 'active' } = req.body;
    
    if (!crime || !crime.trim()) {
      return res.status(400).json({ message: "Crime name is required" });
    }

    const existingCrime = await Crime.findOne({ 
      crime: { $regex: new RegExp(`^${crime.trim()}$`, 'i') } 
    });
    
    if (existingCrime) {
      return res.status(409).json({ message: "Crime already exists" });
    }

    const newCrime = new Crime({ 
      crime: crime.trim(), 
      status 
    });
    
    await newCrime.save();
    
    res.status(201).json({ 
      message: "Crime created successfully", 
      crime: newCrime 
    });
  } catch (error) {
    console.error("Crime creation error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ message: "Crime already exists" });
    }
    res.status(500).json({ 
      message: "Failed to create crime", 
      error: error.message 
    });
  }
});

// GET ALL CRIMES
app.get("/crimes", async (req, res) => {
  try {
    const crimes = await Crime.find().sort({ createdAt: -1 });
    res.json(crimes);
  } catch (error) {
    console.error("Error fetching crimes:", error);
    res.status(500).json({ 
      message: "Failed to fetch crimes", 
      error: error.message 
    });
  }
});

// GET SINGLE CRIME
app.get("/crimes/:id", async (req, res) => {
  try {
    const crime = await Crime.findById(req.params.id);
    if (!crime) {
      return res.status(404).json({ message: "Crime not found" });
    }
    res.json(crime);
  } catch (error) {
    console.error("Error fetching crime:", error);
    res.status(500).json({ 
      message: "Failed to fetch crime", 
      error: error.message 
    });
  }
});

// UPDATE CRIME
app.put("/crimes/:id", async (req, res) => {
  try {
    const { crime, status } = req.body;
    
    const updatedCrime = await Crime.findByIdAndUpdate(
      req.params.id,
      { crime, status },
      { new: true, runValidators: true }
    );
    
    if (!updatedCrime) {
      return res.status(404).json({ message: "Crime not found" });
    }
    
    res.json({ 
      message: "Crime updated successfully",
      crime: updatedCrime 
    });
  } catch (error) {
    console.error("Error updating crime:", error);
    res.status(500).json({ 
      message: "Failed to update crime", 
      error: error.message 
    });
  }
});

// DELETE CRIME
app.delete("/crimes/:id", async (req, res) => {
  try {
    const deletedCrime = await Crime.findByIdAndDelete(req.params.id);
    
    if (!deletedCrime) {
      return res.status(404).json({ message: "Crime not found" });
    }
    
    res.json({ 
      message: "Crime deleted successfully", 
      crime: deletedCrime 
    });
  } catch (error) {
    console.error("Error deleting crime:", error);
    res.status(500).json({ 
      message: "Failed to delete crime", 
      error: error.message 
    });
  }
});

// ======================
// INMATE ENDPOINTS - FULL CRUD
// ======================

// CREATE INMATE
app.post("/inmates", 
  upload.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 },
    { name: 'leftImage', maxCount: 1 },
    { name: 'rightImage', maxCount: 1 }
  ]), 
  async (req, res) => {
    try {
      const seq = await autoIncrement('inmateCode');
      const inmateCode = `INM${seq}`;
      
      const frontImage = req.files && req.files['frontImage'] ? req.files['frontImage'][0].filename : null;
      const backImage = req.files && req.files['backImage'] ? req.files['backImage'][0].filename : null;
      const leftImage = req.files && req.files['leftImage'] ? req.files['leftImage'][0].filename : null;
      const rightImage = req.files && req.files['rightImage'] ? req.files['rightImage'][0].filename : null;

      const inmateData = {
        ...req.body,
        inmateCode,
        frontImage,
        backImage,
        leftImage,
        rightImage
      };

      const inmate = new Inmate(inmateData);
      await inmate.save();
      
      res.status(201).json({ message: "Inmate created", inmate });
    } catch (error) {
      console.error("Inmate creation error:", error);
      res.status(500).json({ 
        message: "Create failed", 
        error: error.message
      });
    }
  }
);

// GET ALL INMATES
app.get("/inmates", async (req, res) => {
  try {
    const inmates = await Inmate.find();
    const inmatesWithFullName = inmates.map(inmate => ({
      ...inmate.toObject(),
      fullName: inmate.fullName
    }));
    res.json(inmatesWithFullName);
  } catch (error) {
    res.status(500).json({ message: "Fetch failed", error: error.message });
  }
});

// GET SINGLE INMATE
app.get("/inmates/:code", async (req, res) => {
  try {
    const inmate = await Inmate.findOne({ inmateCode: req.params.code });
    if (!inmate) return res.status(404).json({ message: "Not found" });
    
    const inmateWithFullName = {
      ...inmate.toObject(),
      fullName: inmate.fullName
    };
    res.json(inmateWithFullName);
  } catch (error) {
    res.status(500).json({ message: "Fetch failed", error: error.message });
  }
});

// UPDATE INMATE
app.put("/inmates/:code", 
  upload.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 },
    { name: 'leftImage', maxCount: 1 },
    { name: 'rightImage', maxCount: 1 }
  ]), 
  async (req, res) => {
    try {
      const updateData = { ...req.body };
      
      if (req.files['frontImage']) 
        updateData.frontImage = req.files['frontImage'][0].filename;
      if (req.files['backImage']) 
        updateData.backImage = req.files['backImage'][0].filename;
      if (req.files['leftImage']) 
        updateData.leftImage = req.files['leftImage'][0].filename;
      if (req.files['rightImage']) 
        updateData.rightImage = req.files['rightImage'][0].filename;

      const updatedInmate = await Inmate.findOneAndUpdate(
        { inmateCode: req.params.code },
        updateData,
        { new: true }
      );
      
      if (!updatedInmate) return res.status(404).json({ message: "Not found" });
      
      const inmateWithFullName = {
        ...updatedInmate.toObject(),
        fullName: updatedInmate.fullName
      };
      res.json(inmateWithFullName);
    } catch (error) {
      res.status(500).json({ message: "Update failed", error: error.message });
    }
  }
);

// DELETE INMATE
app.delete("/inmates/:code", async (req, res) => {
  try {
    const deletedInmate = await Inmate.findOneAndDelete({ inmateCode: req.params.code });
    if (!deletedInmate) return res.status(404).json({ message: "Not found" });
    
    // Delete associated images
    ['frontImage', 'backImage', 'leftImage', 'rightImage'].forEach(imageField => {
      if (deletedInmate[imageField]) {
        const imagePath = path.join(uploadDir, deletedInmate[imageField]);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }
    });
    
    res.json({ message: "Inmate deleted" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed", error: error.message });
  }
});

// ======================
// VISITOR ENDPOINTS - FULL CRUD WITH VISIT HISTORY
// ======================

// CREATE VISITOR
app.post("/visitors", 
  upload.single('photo'),
  async (req, res) => {
    try {
      // Validate prisonerId exists and get prisoner name
      let prisonerName = 'Unknown';
      if (req.body.prisonerId) {
        const inmate = await Inmate.findOne({ inmateCode: req.body.prisonerId });
        if (inmate) {
          prisonerName = inmate.fullName;
        } else {
          return res.status(400).json({ 
            message: `Prisoner with ID ${req.body.prisonerId} not found` 
          });
        }

        // Check visitor limit - count approved visitors for this inmate
        const approvedVisitorCount = await Visitor.countDocuments({ 
          prisonerId: req.body.prisonerId,
          status: 'approved'
        });

        if (approvedVisitorCount >= 10) {
          return res.status(400).json({ 
            message: `Visitor limit reached. This inmate already has ${approvedVisitorCount} approved visitors. Maximum allowed is 10 visitors per inmate.` 
          });
        }
      } else {
        return res.status(400).json({ 
          message: "Prisoner ID is required" 
        });
      }

      const seq = await autoIncrement('visitorId');
      const id = `VIS${seq}`;

      const visitorData = {
        ...req.body,
        id,
        prisonerName: prisonerName, // Store prisoner name
        dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null,
        hasTimedIn: false,
        hasTimedOut: false,
        timeIn: null,
        timeOut: null,
        dateVisited: null,
        lastVisitDate: null,
        isTimerActive: false,
        visitApproved: false,
        status: req.body.status || 'approved',
        dailyVisits: [],
        visitHistory: [],
        totalVisits: 0
      };

      if (req.file) {
        visitorData.photo = req.file.filename;
      }

      const qrData = {
        id,
        lastName: visitorData.lastName,
        firstName: visitorData.firstName,
        middleName: visitorData.middleName,
        extension: visitorData.extension,
        prisonerId: visitorData.prisonerId,
        prisonerName: prisonerName
      };
      visitorData.qrCode = await generateQRCode(qrData);

      const visitor = new Visitor(visitorData);
      await visitor.save();

      const visitorWithFullName = {
        ...visitor.toObject(),
        fullName: visitor.fullName
      };

      res.status(201).json({ 
        message: "Visitor created successfully", 
        visitor: visitorWithFullName 
      });
    } catch (error) {
      console.error("Visitor creation error:", error);
      
      if (error.code === 11000) {
        return res.status(409).json({ message: "Visitor ID already exists" });
      }
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: "Validation error", error: error.message });
      }
      
      res.status(500).json({ message: "Failed to create visitor", error: error.message });
    }
  }
);

// GET ALL VISITORS
app.get("/visitors", async (req, res) => {
  try {
    // Auto-expire bans before fetching to ensure fresh data
    await autoExpireBans();
    
    const visitors = await Visitor.find();
    const visitorsWithFullName = visitors.map(visitor => ({
      ...visitor.toObject(),
      fullName: visitor.fullName
    }));
    res.json(visitorsWithFullName);
  } catch (error) {
    res.status(500).json({ message: "Fetch failed", error: error.message });
  }
});


// GET SINGLE VISITOR
app.get("/visitors/:id", async (req, res) => {
  try {
    const visitor = await Visitor.findOne({ id: req.params.id });
    if (!visitor) return res.status(404).json({ message: "Visitor not found" });
    
    const visitorWithFullName = {
      ...visitor.toObject(),
      fullName: visitor.fullName
    };
    res.json(visitorWithFullName);
  } catch (error) {
    res.status(500).json({ message: "Fetch failed", error: error.message });
  }
});

// UPDATE VISITOR
app.put("/visitors/:id", 
  upload.single('photo'),
  async (req, res) => {
    try {
      const updateData = { ...req.body };

      // If prisonerId is being updated, get the new prisoner name
      if (updateData.prisonerId) {
        const inmate = await Inmate.findOne({ inmateCode: updateData.prisonerId });
        if (inmate) {
          updateData.prisonerName = inmate.fullName;
        } else {
          return res.status(400).json({ 
            message: `Prisoner with ID ${updateData.prisonerId} not found` 
          });
        }
      }

      if (req.file) {
        updateData.photo = req.file.filename;
      }

      const visitor = await Visitor.findOne({ id: req.params.id });
      if (!visitor) return res.status(404).json({ message: "Visitor not found" });

      const updatedVisitor = await Visitor.findOneAndUpdate(
        { id: req.params.id },
        updateData,
        { new: true, runValidators: true }
      );
      
      const visitorWithFullName = {
        ...updatedVisitor.toObject(),
        fullName: updatedVisitor.fullName
      };
      res.json(visitorWithFullName);
    } catch (error) {
      console.error("Error updating visitor:", error);
      res.status(500).json({ message: "Update failed", error: error.message });
    }
  }
);

// DELETE VISITOR
app.delete("/visitors/:id", async (req, res) => {
  try {
    const deletedVisitor = await Visitor.findOneAndDelete({ id: req.params.id });
    if (!deletedVisitor) return res.status(404).json({ message: "Not found" });
    
    if (deletedVisitor.photo) {
      const photoPath = path.join(uploadDir, deletedVisitor.photo);
      if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    }
    
    res.json({ message: "Visitor deleted" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed", error: error.message });
  }
});

// GET VISITORS BY INMATE
app.get("/inmates/:inmateCode/visitors", async (req, res) => {
  try {
    const visitors = await Visitor.find({ prisonerId: req.params.inmateCode });
    const visitorsWithFullName = visitors.map(visitor => ({
      ...visitor.toObject(),
      fullName: visitor.fullName
    }));
    res.json(visitorsWithFullName);
  } catch (error) {
    res.status(500).json({ message: "Fetch failed", error: error.message });
  }
});

// CHECK VISITOR LIMIT FOR INMATE
app.get("/inmates/:inmateCode/visitor-limit", async (req, res) => {
  try {
    const approvedVisitorCount = await Visitor.countDocuments({ 
      prisonerId: req.params.inmateCode,
      status: 'approved'
    });
    
    const limit = 10;
    const available = limit - approvedVisitorCount;
    
    res.json({
      inmateCode: req.params.inmateCode,
      currentVisitors: approvedVisitorCount,
      limit: limit,
      available: available > 0 ? available : 0,
      canAddMore: approvedVisitorCount < limit
    });
  } catch (error) {
    res.status(500).json({ message: "Fetch failed", error: error.message });
  }
});

// ======================
// GUEST ENDPOINTS - FULL CRUD WITH VISIT HISTORY
// ======================

// CREATE GUEST
app.post("/guests", 
  upload.single('photo'),
  async (req, res) => {
    try {
      console.log("📝 Creating guest with data:", req.body);
      console.log("📸 Photo file:", req.file ? req.file.filename : 'No photo');
      
      const seq = await autoIncrement('guestId');
      const id = `GST${seq}`;

      const guestData = {
        ...req.body,
        id,
        dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null,
        hasTimedIn: false,
        hasTimedOut: false,
        timeIn: null,
        timeOut: null,
        dateVisited: null,
        lastVisitDate: null,
        status: req.body.status || 'pending',
        dailyVisits: [],
        visitHistory: [],
        totalVisits: 0
      };

      if (req.file) {
        guestData.photo = req.file.filename;
      }

      const qrData = {
        id,
        lastName: guestData.lastName,
        firstName: guestData.firstName,
        middleName: guestData.middleName,
        extension: guestData.extension,
        visitPurpose: guestData.visitPurpose,
        type: 'guest'
      };
      guestData.qrCode = await generateQRCode(qrData);

      const guest = new Guest(guestData);
      await guest.save();

      const guestWithFullName = {
        ...guest.toObject(),
        fullName: guest.fullName
      };

      console.log("✅ Guest created successfully:", id);
      res.status(201).json({ 
        message: "Guest created successfully", 
        guest: guestWithFullName 
      });
    } catch (error) {
      console.error("❌ Guest creation error:", error);
      console.error("Error details:", error.message);
      
      if (error.code === 11000) {
        return res.status(409).json({ message: "Guest ID already exists" });
      }
      
      if (error.name === 'ValidationError') {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ message: "Validation error", error: error.message });
      }
      
      res.status(500).json({ message: "Failed to create guest", error: error.message });
    }
  }
);

// GET ALL GUESTS
app.get("/guests", async (req, res) => {
  try {
    // Auto-expire bans before fetching to ensure fresh data
    await autoExpireBans();
    
    const guests = await Guest.find();
    const guestsWithFullName = guests.map(guest => ({
      ...guest.toObject(),
      fullName: guest.fullName
    }));
    res.json(guestsWithFullName);
  } catch (error) {
    res.status(500).json({ message: "Fetch failed", error: error.message });
  }
});

// GET SINGLE GUEST
app.get("/guests/:id", async (req, res) => {
  try {
    const guest = await Guest.findOne({ id: req.params.id });
    if (!guest) return res.status(404).json({ message: "Guest not found" });
    
    const guestWithFullName = {
      ...guest.toObject(),
      fullName: guest.fullName
    };
    res.json(guestWithFullName);
  } catch (error) {
    res.status(500).json({ message: "Fetch failed", error: error.message });
  }
});

// UPDATE GUEST
app.put("/guests/:id", 
  upload.single('photo'),
  async (req, res) => {
    try {
      const updateData = { ...req.body };
      if (req.file) updateData.photo = req.file.filename;

      const guest = await Guest.findOne({ id: req.params.id });
      if (!guest) return res.status(404).json({ message: "Guest not found" });

      const updatedGuest = await Guest.findOneAndUpdate(
        { id: req.params.id },
        updateData,
        { new: true, runValidators: true }
      );
      
      const guestWithFullName = {
        ...updatedGuest.toObject(),
        fullName: updatedGuest.fullName
      };
      res.json(guestWithFullName);
    } catch (error) {
      console.error("Error updating guest:", error);
      res.status(500).json({ message: "Update failed", error: error.message });
    }
  }
);

// DELETE GUEST
app.delete("/guests/:id", async (req, res) => {
  try {
    const deletedGuest = await Guest.findOneAndDelete({ id: req.params.id });
    if (!deletedGuest) return res.status(404).json({ message: "Not found" });
    
    if (deletedGuest.photo) {
      const photoPath = path.join(uploadDir, deletedGuest.photo);
      if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    }
    
    res.json({ message: "Guest deleted" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed", error: error.message });
  }
});



// ======================
// VISITORS IMPORT ENDPOINTS 
// ======================

// Import visitors from CSV - WITH GENDER TO SEX MAPPING
app.post("/visitors/upload-csv", upload.single('csvFile'), async (req, res) => {
  try {
    console.log('🔄 Starting visitor CSV import process...');
    
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    console.log('📁 File received:', req.file.originalname);

    const visitors = [];
    const errors = [];

    // Read and parse CSV file
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    console.log('📄 File content length:', fileContent.length);

    const results = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        console.log('✅ CSV parsing completed, rows:', results.data.length);
      },
      error: (error) => {
        console.error('❌ CSV parsing error:', error);
      }
    });

    if (results.errors && results.errors.length > 0) {
      console.error('CSV parsing errors:', results.errors);
      return res.status(400).json({ 
        message: 'Invalid CSV format', 
        errors: results.errors 
      });
    }

    console.log('🔍 Processing CSV rows...');
    
    for (const [index, row] of results.data.entries()) {
      try {
        console.log(`📝 Processing row ${index + 1}:`, row);

        // Map CSV headers to database fields - FLEXIBLE HEADER HANDLING
        const fieldMap = {
          // Support multiple possible header names
          'Last Name': 'lastName',
          'LastName': 'lastName',
          'Last_Name': 'lastName',
          'lastName': 'lastName',
          
          'First Name': 'firstName', 
          'FirstName': 'firstName',
          'First_Name': 'firstName',
          'firstName': 'firstName',
          
          'Middle Name': 'middleName',
          'MiddleName': 'middleName', 
          'Middle_Name': 'middleName',
          'middleName': 'middleName',
          
          'Extension': 'extension',
          'extension': 'extension',
          
          'Date of Birth': 'dateOfBirth',
          'DateOfBirth': 'dateOfBirth',
          'Date_of_Birth': 'dateOfBirth',
          'DOB': 'dateOfBirth',
          'dateOfBirth': 'dateOfBirth',
          
          // GENDER FIELD - Accept multiple header names but store as 'sex'
          'Gender': 'sex',
          'gender': 'sex', 
          'Sex': 'sex',
          'sex': 'sex',
          
          'Address': 'address',
          'address': 'address',
          
          'Contact': 'contact',
          'Contact Number': 'contact',
          'ContactNumber': 'contact',
          'Phone': 'contact',
          'contact': 'contact',
          
          'Inmate ID': 'prisonerId',
          'InmateID': 'prisonerId',
          'Inmate_ID': 'prisonerId',
          'Prisoner ID': 'prisonerId',
          'PrisonerID': 'prisonerId',
          'prisonerId': 'prisonerId',
          
          'Inmate Name': 'prisonerName',
          'InmateName': 'prisonerName',
          'Inmate_Name': 'prisonerName',
          'Prisoner Name': 'prisonerName',
          'PrisonerName': 'prisonerName',
          'prisonerName': 'prisonerName',
          
          'Relationship': 'relationship',
          'relationship': 'relationship'
        };

        // Extract data using field mapping
        const extractField = (possibleHeaders) => {
          for (const header of possibleHeaders) {
            if (row[header] !== undefined && row[header] !== null && row[header].toString().trim() !== '') {
              return row[header].toString().trim();
            }
          }
          return '';
        };

        const lastName = extractField(['Last Name', 'LastName', 'Last_Name', 'lastName']);
        const firstName = extractField(['First Name', 'FirstName', 'First_Name', 'firstName']);
        const middleName = extractField(['Middle Name', 'MiddleName', 'Middle_Name', 'middleName']);
        const extension = extractField(['Extension', 'extension']);
        const dateOfBirthStr = extractField(['Date of Birth', 'DateOfBirth', 'Date_of_Birth', 'DOB', 'dateOfBirth']);
        const gender = extractField(['Gender', 'gender', 'Sex', 'sex']);
        const address = extractField(['Address', 'address']);
        const contact = extractField(['Contact', 'Contact Number', 'ContactNumber', 'Phone', 'contact']);
        const prisonerId = extractField(['Inmate ID', 'InmateID', 'Inmate_ID', 'Prisoner ID', 'PrisonerID', 'prisonerId']);
        const prisonerName = extractField(['Inmate Name', 'InmateName', 'Inmate_Name', 'Prisoner Name', 'PrisonerName', 'prisonerName']);
        const relationship = extractField(['Relationship', 'relationship']);

        // Validate required fields
        const requiredFields = [
          { field: lastName, name: 'Last Name' },
          { field: firstName, name: 'First Name' },
          { field: gender, name: 'Gender' },
          { field: dateOfBirthStr, name: 'Date of Birth' },
          { field: address, name: 'Address' },
          { field: contact, name: 'Contact' },
          { field: prisonerId, name: 'Inmate ID' },
          { field: relationship, name: 'Relationship' }
        ];

        const missingFields = requiredFields.filter(item => !item.field).map(item => item.name);
        
        if (missingFields.length > 0) {
          errors.push({
            row: index + 2,
            error: `Missing required fields: ${missingFields.join(', ')}`,
            data: row
          });
          console.log(`❌ Row ${index + 2} missing fields:`, missingFields);
          continue;
        }

        // Validate gender/sex
        if (!['Male', 'Female'].includes(gender)) {
          errors.push({
            row: index + 2,
            error: `Invalid gender: "${gender}". Must be "Male" or "Female"`,
            data: row
          });
          console.log(`❌ Row ${index + 2} invalid gender:`, gender);
          continue;
        }

        // Parse date with multiple format support
        let dateOfBirth;
        try {
          dateOfBirth = new Date(dateOfBirthStr);
          if (isNaN(dateOfBirth.getTime())) {
            // Try MM/DD/YYYY format
            const parts = dateOfBirthStr.split('/');
            if (parts.length === 3) {
              dateOfBirth = new Date(parts[2], parts[0] - 1, parts[1]);
            }
            if (isNaN(dateOfBirth.getTime())) {
              // Try DD-MM-YYYY format
              const parts2 = dateOfBirthStr.split('-');
              if (parts2.length === 3) {
                dateOfBirth = new Date(parts2[2], parts2[1] - 1, parts2[0]);
              }
              if (isNaN(dateOfBirth.getTime())) {
                throw new Error('Invalid date format');
              }
            }
          }
        } catch (dateError) {
          errors.push({
            row: index + 2,
            error: `Invalid date format: "${dateOfBirthStr}". Use YYYY-MM-DD, MM/DD/YYYY, or DD-MM-YYYY`,
            data: row
          });
          console.log(`❌ Row ${index + 2} date error:`, dateOfBirthStr);
          continue;
        }

        // Calculate age
        const today = new Date();
        let age = today.getFullYear() - dateOfBirth.getFullYear();
        const monthDiff = today.getMonth() - dateOfBirth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
          age--;
        }

        // Verify prisoner exists and get prisoner name if not provided
        let finalPrisonerName = prisonerName;
        if (!finalPrisonerName) {
          const inmate = await Inmate.findOne({ inmateCode: prisonerId });
          if (inmate) {
            finalPrisonerName = inmate.fullName;
            console.log(`ℹ️ Row ${index + 2}: Looked up inmate name: ${finalPrisonerName}`);
          } else {
            errors.push({
              row: index + 2,
              error: `Prisoner with ID "${prisonerId}" not found and no inmate name provided`,
              data: row
            });
            console.log(`❌ Row ${index + 2} prisoner not found:`, prisonerId);
            continue;
          }
        }

        const visitorData = {
          lastName: lastName,
          firstName: firstName,
          middleName: middleName,
          extension: extension,
          dateOfBirth: dateOfBirth,
          age: age.toString(),
          sex: gender, // ✅ MAPPED FROM CSV "Gender" TO DATABASE "sex"
          address: address,
          contact: contact,
          prisonerId: prisonerId,
          prisonerName: finalPrisonerName,
          relationship: relationship,
          status: 'approved'
        };

        console.log(`✅ Row ${index + 2} processed successfully:`, visitorData.firstName, visitorData.lastName, `Gender: ${gender} → Sex: ${visitorData.sex}`);
        visitors.push(visitorData);
      } catch (rowError) {
        console.error(`❌ Error processing row ${index + 2}:`, rowError);
        errors.push({
          row: index + 2,
          error: rowError.message,
          data: row
        });
      }
    }

    console.log(`📊 Processing complete: ${visitors.length} valid, ${errors.length} errors`);

    // Insert visitors into database
    const importedVisitors = [];
    for (const visitorData of visitors) {
      try {
        // Generate unique visitor ID
        const visitorSeq = await autoIncrement('visitorId');
        const visitorId = `VIS${visitorSeq}`;

        // Generate QR code
        const qrData = {
          id: visitorId,
          lastName: visitorData.lastName,
          firstName: visitorData.firstName,
          middleName: visitorData.middleName,
          extension: visitorData.extension,
          prisonerId: visitorData.prisonerId,
          prisonerName: visitorData.prisonerName,
          type: 'visitor'
        };
        const qrCode = await generateQRCode(qrData);

        const visitor = new Visitor({
          ...visitorData,
          id: visitorId,
          qrCode: qrCode,
          hasTimedIn: false,
          hasTimedOut: false,
          timeIn: null,
          timeOut: null,
          dateVisited: null,
          lastVisitDate: null,
          isTimerActive: false,
          visitApproved: false,
          dailyVisits: [],
          visitHistory: [],
          totalVisits: 0
        });

        const savedVisitor = await visitor.save();
        importedVisitors.push(savedVisitor);
        console.log(`✅ Saved visitor: ${visitorId} - ${visitorData.firstName} ${visitorData.lastName} (Sex: ${visitorData.sex})`);
      } catch (error) {
        console.error(`❌ Error saving visitor ${visitorData.firstName} ${visitorData.lastName}:`, error);
        errors.push({
          visitor: visitorData,
          error: error.message
        });
      }
    }

    // Clean up uploaded file
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('🧹 Cleaned up uploaded file');
      }
    } catch (cleanupError) {
      console.warn('Could not clean up file:', cleanupError);
    }

    const result = {
      message: 'Import completed',
      imported: importedVisitors.length,
      errors: errors,
      totalProcessed: visitors.length
    };

    console.log('🎉 Import final result:', result);
    res.json(result);

  } catch (error) {
    console.error('❌ Import process error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Could not clean up file on error:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      message: 'Failed to import visitors', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ======================
// INMATES IMPORT ENDPOINTS
// ======================

// Import inmates from CSV - WITH GENDER TO SEX MAPPING AND AUTO-CALCULATION
app.post("/inmates/upload-csv", upload.single('csvFile'), async (req, res) => {
  try {
    console.log('🔄 Starting inmate CSV import process...');
    
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    console.log('📁 File received:', req.file.originalname);

    const inmates = [];
    const errors = [];

    // Calculate sentence duration from dates function
    const calculateSentenceDuration = (dateFrom, dateTo) => {
      if (!dateFrom || !dateTo) return '';
      
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      
      // Check if dateTo is after dateFrom
      if (to <= from) return 'Invalid dates';
      
      const diffTime = Math.abs(to - from);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const diffYears = Math.floor(diffDays / 365);
      const diffMonths = Math.floor((diffDays % 365) / 30);
      const remainingDays = diffDays % 30;

      let sentenceParts = [];
      if (diffYears > 0) sentenceParts.push(`${diffYears} year${diffYears > 1 ? 's' : ''}`);
      if (diffMonths > 0) sentenceParts.push(`${diffMonths} month${diffMonths > 1 ? 's' : ''}`);
      if (remainingDays > 0) sentenceParts.push(`${remainingDays} day${remainingDays > 1 ? 's' : ''}`);
      
      return sentenceParts.length > 0 ? `${sentenceParts.join(' ')} imprisonment` : '';
    };

    // Read and parse CSV file
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    console.log('📄 File content length:', fileContent.length);

    const results = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        console.log('✅ CSV parsing completed, rows:', results.data.length);
      },
      error: (error) => {
        console.error('❌ CSV parsing error:', error);
      }
    });

    if (results.errors && results.errors.length > 0) {
      console.error('CSV parsing errors:', results.errors);
      return res.status(400).json({ 
        message: 'Invalid CSV format', 
        errors: results.errors 
      });
    }

    console.log('🔍 Processing CSV rows...');
    
    for (const [index, row] of results.data.entries()) {
      try {
        console.log(`📝 Processing row ${index + 1}:`, row);

        // Map CSV headers to database fields - FLEXIBLE HEADER HANDLING
        const fieldMap = {
          // Support multiple possible header names
          'Last Name': 'lastName',
          'LastName': 'lastName',
          'Last_Name': 'lastName',
          'lastName': 'lastName',
          
          'First Name': 'firstName', 
          'FirstName': 'firstName',
          'First_Name': 'firstName',
          'firstName': 'firstName',
          
          'Middle Name': 'middleName',
          'MiddleName': 'middleName', 
          'Middle_Name': 'middleName',
          'middleName': 'middleName',
          
          'Extension': 'extension',
          'extension': 'extension',
          
          'Date of Birth': 'dateOfBirth',
          'DateOfBirth': 'dateOfBirth',
          'Date_of_Birth': 'dateOfBirth',
          'DOB': 'dateOfBirth',
          'dateOfBirth': 'dateOfBirth',
          
          // GENDER FIELD - Accept multiple header names but store as 'sex'
          'Gender': 'sex',
          'gender': 'sex', 
          'Sex': 'sex',
          'sex': 'sex',
          
          'Address': 'address',
          'address': 'address',
          
          'Marital Status': 'maritalStatus',
          'MaritalStatus': 'maritalStatus',
          'Marital_Status': 'maritalStatus',
          'maritalStatus': 'maritalStatus',
          
          'Eye Color': 'eyeColor',
          'EyeColor': 'eyeColor',
          'Eye_Color': 'eyeColor',
          'eyeColor': 'eyeColor',
          
          'Complexion': 'complexion',
          'complexion': 'complexion',
          
          'Cell ID': 'cellId',
          'CellID': 'cellId',
          'Cell_ID': 'cellId',
          'cellId': 'cellId',
          
          'Sentence': 'sentence',
          'sentence': 'sentence',
          
          'Date From': 'dateFrom',
          'DateFrom': 'dateFrom',
          'Date_From': 'dateFrom',
          'dateFrom': 'dateFrom',
          
          'Date To': 'dateTo',
          'DateTo': 'dateTo',
          'Date_To': 'dateTo',
          'dateTo': 'dateTo',
          
          'Crime': 'crime',
          'crime': 'crime',
          
          'Emergency Name': 'emergencyName',
          'EmergencyName': 'emergencyName',
          'Emergency_Name': 'emergencyName',
          'emergencyName': 'emergencyName',
          
          'Emergency Contact': 'emergencyContact',
          'EmergencyContact': 'emergencyContact',
          'Emergency_Contact': 'emergencyContact',
          'emergencyContact': 'emergencyContact',
          
          'Emergency Relation': 'emergencyRelation',
          'EmergencyRelation': 'emergencyRelation',
          'Emergency_Relation': 'emergencyRelation',
          'emergencyRelation': 'emergencyRelation',
          
          'Status': 'status',
          'status': 'status'
        };

        // Extract data using field mapping
        const extractField = (possibleHeaders) => {
          for (const header of possibleHeaders) {
            if (row[header] !== undefined && row[header] !== null && row[header].toString().trim() !== '') {
              return row[header].toString().trim();
            }
          }
          return '';
        };

        const lastName = extractField(['Last Name', 'LastName', 'Last_Name', 'lastName']);
        const firstName = extractField(['First Name', 'FirstName', 'First_Name', 'firstName']);
        const middleName = extractField(['Middle Name', 'MiddleName', 'Middle_Name', 'middleName']);
        const extension = extractField(['Extension', 'extension']);
        const dateOfBirthStr = extractField(['Date of Birth', 'DateOfBirth', 'Date_of_Birth', 'DOB', 'dateOfBirth']);
        const gender = extractField(['Gender', 'gender', 'Sex', 'sex']);
        const address = extractField(['Address', 'address']);
        const maritalStatus = extractField(['Marital Status', 'MaritalStatus', 'Marital_Status', 'maritalStatus']);
        const eyeColor = extractField(['Eye Color', 'EyeColor', 'Eye_Color', 'eyeColor']);
        const complexion = extractField(['Complexion', 'complexion']);
        const cellId = extractField(['Cell ID', 'CellID', 'Cell_ID', 'cellId']);
        const sentence = extractField(['Sentence', 'sentence']);
        const dateFromStr = extractField(['Date From', 'DateFrom', 'Date_From', 'dateFrom']);
        const dateToStr = extractField(['Date To', 'DateTo', 'Date_To', 'dateTo']);
        const crime = extractField(['Crime', 'crime']);
        const emergencyName = extractField(['Emergency Name', 'EmergencyName', 'Emergency_Name', 'emergencyName']);
        const emergencyContact = extractField(['Emergency Contact', 'EmergencyContact', 'Emergency_Contact', 'emergencyContact']);
        const emergencyRelation = extractField(['Emergency Relation', 'EmergencyRelation', 'Emergency_Relation', 'emergencyRelation']);
        const status = extractField(['Status', 'status']);

        // Validate required fields
        const requiredFields = [
          { field: lastName, name: 'Last Name' },
          { field: firstName, name: 'First Name' },
          { field: gender, name: 'Gender' },
          { field: dateOfBirthStr, name: 'Date of Birth' },
          { field: address, name: 'Address' },
          { field: cellId, name: 'Cell ID' },
          { field: crime, name: 'Crime' }
        ];

        const missingFields = requiredFields.filter(item => !item.field).map(item => item.name);
        
        if (missingFields.length > 0) {
          errors.push({
            row: index + 2,
            error: `Missing required fields: ${missingFields.join(', ')}`,
            data: row
          });
          console.log(`❌ Row ${index + 2} missing fields:`, missingFields);
          continue;
        }

        // Validate gender/sex
        if (!['Male', 'Female'].includes(gender)) {
          errors.push({
            row: index + 2,
            error: `Invalid gender: "${gender}". Must be "Male" or "Female"`,
            data: row
          });
          console.log(`❌ Row ${index + 2} invalid gender:`, gender);
          continue;
        }

        // Parse date with multiple format support
        const parseDate = (dateStr) => {
          if (!dateStr) return null;
          
          let date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            // Try MM/DD/YYYY format
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              date = new Date(parts[2], parts[0] - 1, parts[1]);
            }
            if (isNaN(date.getTime())) {
              // Try DD-MM-YYYY format
              const parts2 = dateStr.split('-');
              if (parts2.length === 3) {
                date = new Date(parts2[2], parts2[1] - 1, parts2[0]);
              }
              if (isNaN(date.getTime())) {
                throw new Error('Invalid date format');
              }
            }
          }
          return date;
        };

        let dateOfBirth, dateFrom, dateTo;
        
        try {
          dateOfBirth = parseDate(dateOfBirthStr);
          if (isNaN(dateOfBirth.getTime())) {
            throw new Error('Invalid date format');
          }
        } catch (dateError) {
          errors.push({
            row: index + 2,
            error: `Invalid date of birth format: "${dateOfBirthStr}". Use YYYY-MM-DD, MM/DD/YYYY, or DD-MM-YYYY`,
            data: row
          });
          console.log(`❌ Row ${index + 2} date error:`, dateOfBirthStr);
          continue;
        }

        // Parse optional dates
        try {
          dateFrom = dateFromStr ? parseDate(dateFromStr) : null;
          if (dateFromStr && isNaN(dateFrom.getTime())) {
            throw new Error('Invalid date format');
          }
        } catch (dateError) {
          errors.push({
            row: index + 2,
            error: `Invalid date from format: "${dateFromStr}". Use YYYY-MM-DD, MM/DD/YYYY, or DD-MM-YYYY`,
            data: row
          });
          continue;
        }

        try {
          dateTo = dateToStr ? parseDate(dateToStr) : null;
          if (dateToStr && isNaN(dateTo.getTime())) {
            throw new Error('Invalid date format');
          }
        } catch (dateError) {
          errors.push({
            row: index + 2,
            error: `Invalid date to format: "${dateToStr}". Use YYYY-MM-DD, MM/DD/YYYY, or DD-MM-YYYY`,
            data: row
          });
          continue;
        }

        // Validate dates relationship
        if (dateFrom && dateTo && dateTo <= dateFrom) {
          errors.push({
            row: index + 2,
            error: `Date To (${dateToStr}) must be after Date From (${dateFromStr})`,
            data: row
          });
          console.log(`❌ Row ${index + 2} invalid date range:`, dateFromStr, dateToStr);
          continue;
        }

        // Validate status
        const validStatus = status && ['active', 'inactive', 'released', 'transferred'].includes(status.toLowerCase()) 
          ? status.toLowerCase() 
          : 'active';

        // AUTO-CALCULATE SENTENCE IF NOT PROVIDED BUT DATES ARE AVAILABLE
        let finalSentence = sentence;
        if (!sentence && dateFrom && dateTo) {
          finalSentence = calculateSentenceDuration(dateFrom, dateTo);
          console.log(`🔢 Row ${index + 2} auto-calculated sentence:`, finalSentence);
        }

        const inmateData = {
          lastName: lastName,
          firstName: firstName,
          middleName: middleName,
          extension: extension,
          dateOfBirth: dateOfBirth,
          sex: gender, // ✅ MAPPED FROM CSV "Gender" TO DATABASE "sex"
          address: address,
          maritalStatus: maritalStatus,
          eyeColor: eyeColor,
          complexion: complexion,
          cellId: cellId,
          sentence: finalSentence, // ✅ Uses provided sentence OR auto-calculated
          dateFrom: dateFrom,
          dateTo: dateTo,
          crime: crime,
          emergencyName: emergencyName,
          emergencyContact: emergencyContact,
          emergencyRelation: emergencyRelation,
          status: validStatus
        };

        console.log(`✅ Row ${index + 2} processed successfully:`, 
          inmateData.firstName, inmateData.lastName, 
          `Gender: ${gender} → Sex: ${inmateData.sex}`,
          `Sentence: "${finalSentence || 'Not provided'}"`
        );
        inmates.push(inmateData);
      } catch (rowError) {
        console.error(`❌ Error processing row ${index + 2}:`, rowError);
        errors.push({
          row: index + 2,
          error: rowError.message,
          data: row
        });
      }
    }

    console.log(`📊 Processing complete: ${inmates.length} valid, ${errors.length} errors`);

    // Insert inmates into database
    const importedInmates = [];
    for (const inmateData of inmates) {
      try {
        // Generate unique inmate code
        const inmateSeq = await autoIncrement('inmateCode');
        const inmateCode = `INM${inmateSeq}`;

        const inmate = new Inmate({
          ...inmateData,
          inmateCode: inmateCode
        });

        const savedInmate = await inmate.save();
        importedInmates.push(savedInmate);
        console.log(`✅ Saved inmate: ${inmateCode} - ${inmateData.firstName} ${inmateData.lastName} (Sex: ${inmateData.sex}, Sentence: "${inmateData.sentence || 'None'}")`);
      } catch (error) {
        console.error(`❌ Error saving inmate ${inmateData.firstName} ${inmateData.lastName}:`, error);
        errors.push({
          inmate: inmateData,
          error: error.message
        });
      }
    }

    // Clean up uploaded file
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('🧹 Cleaned up uploaded file');
      }
    } catch (cleanupError) {
      console.warn('Could not clean up file:', cleanupError);
    }

    const result = {
      message: 'Import completed',
      imported: importedInmates.length,
      errors: errors,
      totalProcessed: inmates.length
    };

    console.log('🎉 Import final result:', result);
    res.json(result);

  } catch (error) {
    console.error('❌ Import process error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Could not clean up file on error:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      message: 'Failed to import inmates', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ======================
// GUESTS IMPORT ENDPOINTS 
// ======================

// Import guests from CSV - WITH GENDER TO SEX MAPPING AND AUTO-AGE CALCULATION
app.post("/guests/import", upload.single('csvFile'), async (req, res) => {
  try {
    console.log('🔄 Starting guest CSV import process...');
    
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    console.log('📁 File received:', req.file.originalname);

    const guests = [];
    const errors = [];

    // Read and parse CSV file
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    console.log('📄 File content length:', fileContent.length);

    const results = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        console.log('✅ CSV parsing completed, rows:', results.data.length);
      },
      error: (error) => {
        console.error('❌ CSV parsing error:', error);
      }
    });

    if (results.errors && results.errors.length > 0) {
      console.error('CSV parsing errors:', results.errors);
      return res.status(400).json({ 
        message: 'Invalid CSV format', 
        errors: results.errors 
      });
    }

    console.log('🔍 Processing CSV rows...');
    
    for (const [index, row] of results.data.entries()) {
      try {
        console.log(`📝 Processing row ${index + 1}:`, row);

        // Extract data using flexible header mapping
        const extractField = (possibleHeaders) => {
          for (const header of possibleHeaders) {
            if (row[header] !== undefined && row[header] !== null && row[header].toString().trim() !== '') {
              return row[header].toString().trim();
            }
          }
          return '';
        };

        const lastName = extractField(['Last Name', 'LastName', 'Last_Name', 'lastName']);
        const firstName = extractField(['First Name', 'FirstName', 'First_Name', 'firstName']);
        const middleName = extractField(['Middle Name', 'MiddleName', 'Middle_Name', 'middleName']);
        const extension = extractField(['Extension', 'extension']);
        const dateOfBirthStr = extractField(['Date of Birth', 'DateOfBirth', 'Date_of_Birth', 'DOB', 'dateOfBirth']);
        const gender = extractField(['Gender', 'gender', 'Sex', 'sex']);
        const address = extractField(['Address', 'address']);
        const contact = extractField(['Contact', 'Contact Number', 'ContactNumber', 'Phone', 'contact']);
        const visitPurpose = extractField(['Visit Purpose', 'VisitPurpose', 'Visit_Purpose', 'Purpose', 'purpose', 'visitPurpose']);

        // Validate required fields
        const requiredFields = [
          { field: lastName, name: 'Last Name' },
          { field: firstName, name: 'First Name' },
          { field: gender, name: 'Gender' },
          { field: dateOfBirthStr, name: 'Date of Birth' },
          { field: address, name: 'Address' },
          { field: contact, name: 'Contact' },
          { field: visitPurpose, name: 'Visit Purpose' }
        ];

        const missingFields = requiredFields.filter(item => !item.field).map(item => item.name);
        
        if (missingFields.length > 0) {
          errors.push({
            row: index + 2,
            error: `Missing required fields: ${missingFields.join(', ')}`,
            data: row
          });
          console.log(`❌ Row ${index + 2} missing fields:`, missingFields);
          continue;
        }

        // Validate gender/sex
        if (!['Male', 'Female'].includes(gender)) {
          errors.push({
            row: index + 2,
            error: `Invalid gender: "${gender}". Must be "Male" or "Female"`,
            data: row
          });
          console.log(`❌ Row ${index + 2} invalid gender:`, gender);
          continue;
        }

        // Parse date with multiple format support
        let dateOfBirth;
        try {
          dateOfBirth = new Date(dateOfBirthStr);
          if (isNaN(dateOfBirth.getTime())) {
            // Try MM/DD/YYYY format
            const parts = dateOfBirthStr.split('/');
            if (parts.length === 3) {
              dateOfBirth = new Date(parts[2], parts[0] - 1, parts[1]);
            }
            if (isNaN(dateOfBirth.getTime())) {
              // Try DD-MM-YYYY format
              const parts2 = dateOfBirthStr.split('-');
              if (parts2.length === 3) {
                dateOfBirth = new Date(parts2[2], parts2[1] - 1, parts2[0]);
              }
              if (isNaN(dateOfBirth.getTime())) {
                throw new Error('Invalid date format');
              }
            }
          }
        } catch (dateError) {
          errors.push({
            row: index + 2,
            error: `Invalid date format: "${dateOfBirthStr}". Use YYYY-MM-DD, MM/DD/YYYY, or DD-MM-YYYY`,
            data: row
          });
          console.log(`❌ Row ${index + 2} date error:`, dateOfBirthStr);
          continue;
        }

        // Calculate age automatically
        const today = new Date();
        let age = today.getFullYear() - dateOfBirth.getFullYear();
        const monthDiff = today.getMonth() - dateOfBirth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
          age--;
        }

        const guestData = {
          lastName: lastName,
          firstName: firstName,
          middleName: middleName,
          extension: extension,
          dateOfBirth: dateOfBirth,
          age: age.toString(), // Auto-calculated
          sex: gender, // ✅ MAPPED FROM CSV "Gender" TO DATABASE "sex"
          address: address,
          contact: contact,
          visitPurpose: visitPurpose,
          status: 'approved'
        };

        console.log(`✅ Row ${index + 2} processed successfully:`, 
          guestData.firstName, guestData.lastName, 
          `Gender: ${gender} → Sex: ${guestData.sex}`,
          `Age: ${age}`,
          `Visit Purpose: ${visitPurpose}`
        );
        guests.push(guestData);
      } catch (rowError) {
        console.error(`❌ Error processing row ${index + 2}:`, rowError);
        errors.push({
          row: index + 2,
          error: rowError.message,
          data: row
        });
      }
    }

    console.log(`📊 Processing complete: ${guests.length} valid, ${errors.length} errors`);

    // Insert guests into database
    const importedGuests = [];
    for (const guestData of guests) {
      try {
        // Generate unique guest ID
        const guestSeq = await autoIncrement('guestId');
        const guestId = `GST${guestSeq}`;

        // Generate QR code
        const qrData = {
          id: guestId,
          lastName: guestData.lastName,
          firstName: guestData.firstName,
          middleName: guestData.middleName,
          extension: guestData.extension,
          visitPurpose: guestData.visitPurpose,
          type: 'guest'
        };
        const qrCode = await generateQRCode(qrData);

        const guest = new Guest({
          ...guestData,
          id: guestId,
          qrCode: qrCode,
          hasTimedIn: false,
          hasTimedOut: false,
          timeIn: null,
          timeOut: null,
          dateVisited: null,
          lastVisitDate: null,
          isTimerActive: false,
          visitApproved: false,
          dailyVisits: [],
          visitHistory: [],
          totalVisits: 0
        });

        const savedGuest = await guest.save();
        importedGuests.push(savedGuest);
        console.log(`✅ Saved guest: ${guestId} - ${guestData.firstName} ${guestData.lastName} (Sex: ${guestData.sex}, Age: ${guestData.age})`);
      } catch (error) {
        console.error(`❌ Error saving guest ${guestData.firstName} ${guestData.lastName}:`, error);
        errors.push({
          guest: guestData,
          error: error.message
        });
      }
    }

    // Clean up uploaded file
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('🧹 Cleaned up uploaded file');
      }
    } catch (cleanupError) {
      console.warn('Could not clean up file:', cleanupError);
    }

    const result = {
      message: 'Import completed',
      imported: importedGuests.length,
      errors: errors,
      totalProcessed: guests.length
    };

    console.log('🎉 Import final result:', result);
    res.json(result);

  } catch (error) {
    console.error('❌ Import process error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Could not clean up file on error:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      message: 'Failed to import guests', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// CSV Upload for Inmates (legacy endpoint - matches your frontend call)
app.post("/inmates/upload-csv", upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    const inmates = [];
    const errors = [];

    // Read and parse CSV file
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const results = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim()
    });

    if (results.errors.length > 0) {
      return res.status(400).json({ 
        message: 'Invalid CSV format', 
        errors: results.errors 
      });
    }

    for (const [index, row] of results.data.entries()) {
      try {
        // Validate required fields
        if (!row.lastName || !row.firstName || !row.sex || !row.dateOfBirth || 
            !row.address || !row.cellId || !row.crime) {
          errors.push({
            row: index + 2,
            error: 'Missing required fields',
            data: row
          });
          continue;
        }

        // Process inmate data (same logic as above)
        const dateOfBirth = new Date(row.dateOfBirth);
        if (isNaN(dateOfBirth.getTime())) {
          errors.push({
            row: index + 2,
            error: 'Invalid date format',
            data: row
          });
          continue;
        }

        const inmateData = {
          lastName: row.lastName.trim(),
          firstName: row.firstName.trim(),
          middleName: row.middleName ? row.middleName.trim() : '',
          extension: row.extension ? row.extension.trim() : '',
          sex: row.sex,
          dateOfBirth: dateOfBirth,
          address: row.address.trim(),
          maritalStatus: row.maritalStatus || '',
          eyeColor: row.eyeColor || '',
          complexion: row.complexion || '',
          cellId: row.cellId.trim(),
          sentence: row.sentence || '',
          dateFrom: row.dateFrom ? new Date(row.dateFrom) : null,
          dateTo: row.dateTo ? new Date(row.dateTo) : null,
          crime: row.crime.trim(),
          emergencyName: row.emergencyName || '',
          emergencyContact: row.emergencyContact || '',
          emergencyRelation: row.emergencyRelation || '',
          status: row.status || 'active'
        };

        inmates.push(inmateData);
      } catch (rowError) {
        errors.push({
          row: index + 2,
          error: rowError.message,
          data: row
        });
      }
    }

    // Insert into database
    const importedInmates = [];
    for (const inmateData of inmates) {
      try {
        const inmateSeq = await autoIncrement('inmateCode');
        const inmateCode = `INM${inmateSeq}`;

        const inmate = new Inmate({
          ...inmateData,
          inmateCode: inmateCode
        });

        const savedInmate = await inmate.save();
        importedInmates.push(savedInmate);
      } catch (error) {
        errors.push({
          inmate: inmateData,
          error: error.message
        });
      }
    }

    // Clean up
    fs.unlinkSync(req.file.path);

    res.json({
      message: `Successfully imported ${importedInmates.length} inmates`,
      imported: importedInmates.length,
      errors: errors
    });

  } catch (error) {
    console.error('CSV upload error:', error);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      message: 'Failed to upload CSV', 
      error: error.message 
    });
  }
});

// ======================
// PENDING VISITOR ENDPOINTS
// ======================

// CREATE PENDING VISITOR
app.post("/pending-visitors", 
  upload.single('photo'),
  async (req, res) => {
    try {
      // Check if prisoner exists and get name
      let prisonerName = '';
      if (req.body.prisonerId) {
        const inmate = await Inmate.findOne({ inmateCode: req.body.prisonerId });
        if (inmate) {
          prisonerName = inmate.fullName;
        } else {
          return res.status(400).json({ 
            message: `Prisoner with ID ${req.body.prisonerId} not found` 
          });
        }

        // Check visitor limit - count approved visitors for this inmate
        const approvedVisitorCount = await Visitor.countDocuments({ 
          prisonerId: req.body.prisonerId,
          status: 'approved'
        });

        if (approvedVisitorCount >= 10) {
          return res.status(400).json({ 
            message: `Visitor limit reached. This inmate already has ${approvedVisitorCount} approved visitors. Maximum allowed is 10 visitors per inmate.` 
          });
        }
      } else {
        return res.status(400).json({ 
          message: "Prisoner ID is required" 
        });
      }

      const seq = await autoIncrement('pendingVisitorId');
      const id = `PEN${seq}`;

      const pendingVisitorData = {
        ...req.body,
        id,
        prisonerName, // Store prisoner name in pending visitor
        dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null,
        status: 'pending'
      };

      if (req.file) {
        pendingVisitorData.photo = req.file.filename;
      }

      const pendingVisitor = new PendingVisitor(pendingVisitorData);
      await pendingVisitor.save();

      const pendingVisitorWithFullName = {
        ...pendingVisitor.toObject(),
        fullName: pendingVisitor.fullName
      };

      res.status(201).json({ 
        message: "Visitor request submitted for approval", 
        pendingVisitor: pendingVisitorWithFullName 
      });
    } catch (error) {
      console.error("Pending visitor creation error:", error);
      res.status(500).json({ message: "Failed to create pending visitor", error: error.message });
    }
  }
);

// GET PENDING VISITORS (with optional status filter)
app.get("/pending-visitors", async (req, res) => {
  try {
    const { status } = req.query;
    console.log('🔍 Fetching pending visitors with status:', status);
    
    const filter = status ? { status } : { status: 'pending' };
    console.log('📋 Filter being used:', filter);
    
    const pendingVisitors = await PendingVisitor.find(filter).sort({ createdAt: -1 });
    console.log('✅ Found visitors:', pendingVisitors.length);
    
    const pendingVisitorsWithFullName = pendingVisitors.map(pendingVisitor => ({
      ...pendingVisitor.toObject(),
      fullName: pendingVisitor.fullName
    }));
    
    res.json(pendingVisitorsWithFullName);
  } catch (error) {
    console.error('❌ Error fetching pending visitors:', error);
    res.status(500).json({ message: "Fetch failed", error: error.message });
  }
});

// GET PENDING VISITORS WITH PRISONER NAMES
app.get("/pending-visitors-with-details", async (req, res) => {
  try {
    const pendingVisitors = await PendingVisitor.find({ status: 'pending' }).sort({ createdAt: -1 });
    
    // You can optionally enrich with additional inmate data if needed
    const pendingVisitorsWithDetails = await Promise.all(
      pendingVisitors.map(async (pendingVisitor) => {
        const visitorObj = pendingVisitor.toObject();
        
        // If you want to include additional inmate details
        if (pendingVisitor.prisonerId) {
          const inmate = await Inmate.findOne({ inmateCode: pendingVisitor.prisonerId });
          if (inmate) {
            visitorObj.inmateDetails = {
              fullName: inmate.fullName,
              // include other inmate fields if needed
            };
          }
        }
        
        return visitorObj;
      })
    );
    
    res.json(pendingVisitorsWithDetails);
  } catch (error) {
    console.error('Error fetching pending visitors with details:', error);
    res.status(500).json({ message: "Fetch failed", error: error.message });
  }
});

// UPDATE APPROVE PENDING VISITOR ENDPOINT
app.post("/pending-visitors/:id/approve", async (req, res) => {
  try {
    console.log('🔄 Approving pending visitor:', req.params.id);
    
    const pendingVisitor = await PendingVisitor.findOne({ id: req.params.id });
    if (!pendingVisitor) {
      return res.status(404).json({ message: "Pending visitor not found" });
    }

    // Check visitor limit before approving
    if (pendingVisitor.prisonerId) {
      const approvedVisitorCount = await Visitor.countDocuments({ 
        prisonerId: pendingVisitor.prisonerId,
        status: 'approved'
      });

      if (approvedVisitorCount >= 10) {
        return res.status(400).json({ 
          message: `Cannot approve visitor. This inmate already has ${approvedVisitorCount} approved visitors. Maximum allowed is 10 visitors per inmate.` 
        });
      }
    }

    // Use the prisonerName from pending visitor, or look it up if not present
    let prisonerName = pendingVisitor.prisonerName;
    if (!prisonerName && pendingVisitor.prisonerId) {
      const inmate = await Inmate.findOne({ inmateCode: pendingVisitor.prisonerId });
      if (inmate) {
        prisonerName = inmate.fullName;
      }
    }

    // Generate QR code for the approved visitor
    const visitorSeq = await autoIncrement('visitorId');
    const visitorId = `VIS${visitorSeq}`;

    const qrData = {
      id: visitorId,
      lastName: pendingVisitor.lastName,
      firstName: pendingVisitor.firstName,
      middleName: pendingVisitor.middleName,
      extension: pendingVisitor.extension,
      prisonerId: pendingVisitor.prisonerId
    };
    const qrCode = await generateQRCode(qrData);

    // Create the actual visitor
    const visitorData = {
      id: visitorId,
      lastName: pendingVisitor.lastName,
      firstName: pendingVisitor.firstName,
      middleName: pendingVisitor.middleName,
      extension: pendingVisitor.extension,
      photo: pendingVisitor.photo,
      dateOfBirth: pendingVisitor.dateOfBirth,
      age: pendingVisitor.age,
      sex: pendingVisitor.sex,
      address: pendingVisitor.address,
      contact: pendingVisitor.contact,
      prisonerId: pendingVisitor.prisonerId,
      prisonerName: prisonerName, // Use the prisoner name
      relationship: pendingVisitor.relationship,
      qrCode: qrCode,
      status: 'approved',
      hasTimedIn: false,
      hasTimedOut: false,
      timeIn: null,
      timeOut: null,
      dateVisited: null,
      lastVisitDate: null,
      isTimerActive: false,
      visitApproved: false,
      dailyVisits: [],
      visitHistory: [],
      totalVisits: 0
    };

    const visitor = new Visitor(visitorData);
    await visitor.save();

    // Update pending visitor status to approved
    await PendingVisitor.findOneAndUpdate(
      { id: req.params.id },
      { status: 'approved' }
    );

    const visitorWithFullName = {
      ...visitor.toObject(),
      fullName: visitor.fullName
    };

    console.log('✅ Visitor approved successfully:', visitorId);

    res.json({ 
      message: "Visitor approved successfully", 
      visitor: visitorWithFullName 
    });

  } catch (error) {
    console.error("❌ Error approving pending visitor:", error);
    res.status(500).json({ message: "Failed to approve visitor", error: error.message });
  }
});

// REJECT PENDING VISITOR
app.post("/pending-visitors/:id/reject", async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    console.log('🔄 Rejecting pending visitor:', req.params.id, 'Reason:', rejectionReason);
    
    const pendingVisitor = await PendingVisitor.findOneAndUpdate(
      { id: req.params.id },
      { 
        status: 'rejected',
        rejectionReason: rejectionReason || 'Rejected by administrator',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!pendingVisitor) {
      return res.status(404).json({ message: "Pending visitor not found" });
    }

    console.log('✅ Visitor rejected successfully:', req.params.id);

    res.json({ 
      message: "Visitor rejected successfully", 
      pendingVisitor: pendingVisitor 
    });

  } catch (error) {
    console.error("❌ Error rejecting pending visitor:", error);
    res.status(500).json({ message: "Failed to reject visitor", error: error.message });
  }
});

// DELETE PENDING VISITOR
app.delete("/pending-visitors/:id", async (req, res) => {
  try {
    const deletedVisitor = await PendingVisitor.findOneAndDelete({ id: req.params.id });
    if (!deletedVisitor) {
      return res.status(404).json({ message: "Pending visitor not found" });
    }

    // Delete associated photo
    if (deletedVisitor.photo) {
      const photoPath = path.join(uploadDir, deletedVisitor.photo);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    res.json({ 
      message: "Pending visitor deleted successfully",
      visitor: deletedVisitor 
    });
  } catch (error) {
    console.error("Error deleting pending visitor:", error);
    res.status(500).json({ message: "Failed to delete pending visitor", error: error.message });
  }
});

// GET PENDING VISITOR STATS
app.get("/pending-visitors/stats", async (req, res) => {
  try {
    const totalPending = await PendingVisitor.countDocuments({ status: 'pending' });
    const totalApproved = await PendingVisitor.countDocuments({ status: 'approved' });
    const totalRejected = await PendingVisitor.countDocuments({ status: 'rejected' });

    console.log('📊 Pending Visitor Stats:', { pending: totalPending, approved: totalApproved, rejected: totalRejected });

    res.json({
      pending: totalPending,
      approved: totalApproved,
      rejected: totalRejected,
      total: totalPending + totalApproved + totalRejected
    });
  } catch (error) {
    console.error('❌ Error fetching pending visitor stats:', error);
    res.status(500).json({ message: "Failed to fetch stats", error: error.message });
  }
});

// ======================
// PENDING GUEST ENDPOINTS
// ======================

// CREATE PENDING GUEST
app.post("/pending-guests", 
  upload.single('photo'),
  async (req, res) => {
  try {
    const seq = await autoIncrement('pendingGuestId');
    const id = `PENG${seq}`;

    const pendingGuestData = {
      ...req.body,
      id,
      dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null,
      status: 'pending'
    };

    if (req.file) {
      pendingGuestData.photo = req.file.filename;
    }

    const pendingGuest = new PendingGuest(pendingGuestData);
    await pendingGuest.save();

    const pendingGuestWithFullName = {
      ...pendingGuest.toObject(),
      fullName: pendingGuest.fullName
    };

    res.status(201).json({ 
      message: "Guest request submitted for approval", 
      pendingGuest: pendingGuestWithFullName 
    });
  } catch (error) {
    console.error("Pending guest creation error:", error);
    res.status(500).json({ message: "Failed to create pending guest", error: error.message });
  }
});

// GET PENDING GUESTS (with optional status filter)
app.get("/pending-guests", async (req, res) => {
  try {
    const { status } = req.query;
    console.log('🔍 Fetching pending guests with status:', status);
    
    const filter = status ? { status } : { status: 'pending' };
    console.log('📋 Filter being used:', filter);
    
    const pendingGuests = await PendingGuest.find(filter).sort({ createdAt: -1 });
    console.log('✅ Found guests:', pendingGuests.length);
    
    const pendingGuestsWithFullName = pendingGuests.map(pendingGuest => ({
      ...pendingGuest.toObject(),
      fullName: pendingGuest.fullName
    }));
    
    res.json(pendingGuestsWithFullName);
  } catch (error) {
    console.error('❌ Error fetching pending guests:', error);
    res.status(500).json({ message: "Fetch failed", error: error.message });
  }
});

// GET SINGLE PENDING GUEST
app.get("/pending-guests/:id", async (req, res) => {
  try {
    const pendingGuest = await PendingGuest.findOne({ id: req.params.id });
    if (!pendingGuest) {
      return res.status(404).json({ message: "Pending guest not found" });
    }
    
    const pendingGuestWithFullName = {
      ...pendingGuest.toObject(),
      fullName: pendingGuest.fullName
    };
    
    res.json(pendingGuestWithFullName);
  } catch (error) {
    console.error("Error fetching pending guest:", error);
    res.status(500).json({ message: "Fetch failed", error: error.message });
  }
});

// APPROVE PENDING GUEST
app.post("/pending-guests/:id/approve", async (req, res) => {
  try {
    console.log('🔄 Approving pending guest:', req.params.id);
    
    const pendingGuest = await PendingGuest.findOne({ id: req.params.id });
    if (!pendingGuest) {
      return res.status(404).json({ message: "Pending guest not found" });
    }

    // Generate QR code for the approved guest
    const guestSeq = await autoIncrement('guestId');
    const guestId = `GST${guestSeq}`;

    const qrData = {
      id: guestId,
      lastName: pendingGuest.lastName,
      firstName: pendingGuest.firstName,
      middleName: pendingGuest.middleName,
      extension: pendingGuest.extension,
      visitPurpose: pendingGuest.visitPurpose,
      type: 'guest'
    };
    const qrCode = await generateQRCode(qrData);

    // Create the actual guest
    const guestData = {
      id: guestId,
      lastName: pendingGuest.lastName,
      firstName: pendingGuest.firstName,
      middleName: pendingGuest.middleName,
      extension: pendingGuest.extension,
      photo: pendingGuest.photo,
      dateOfBirth: pendingGuest.dateOfBirth,
      age: pendingGuest.age,
      sex: pendingGuest.sex,
      address: pendingGuest.address,
      contact: pendingGuest.contact,
      visitPurpose: pendingGuest.visitPurpose,
      qrCode: qrCode,
      status: 'approved',
      hasTimedIn: false,
      hasTimedOut: false,
      timeIn: null,
      timeOut: null,
      dateVisited: null,
      lastVisitDate: null,
      dailyVisits: [],
      visitHistory: [],
      totalVisits: 0
    };

    const guest = new Guest(guestData);
    await guest.save();

    // Update pending guest status to approved
    await PendingGuest.findOneAndUpdate(
      { id: req.params.id },
      { status: 'approved' }
    );

    const guestWithFullName = {
      ...guest.toObject(),
      fullName: guest.fullName
    };

    console.log('✅ Guest approved successfully:', guestId);

    res.json({ 
      message: "Guest approved successfully", 
      guest: guestWithFullName 
    });

  } catch (error) {
    console.error("❌ Error approving pending guest:", error);
    res.status(500).json({ message: "Failed to approve guest", error: error.message });
  }
});

// REJECT PENDING GUEST
app.post("/pending-guests/:id/reject", async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    console.log('🔄 Rejecting pending guest:', req.params.id, 'Reason:', rejectionReason);
    
    const pendingGuest = await PendingGuest.findOneAndUpdate(
      { id: req.params.id },
      { 
        status: 'rejected',
        rejectionReason: rejectionReason || 'Rejected by administrator',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!pendingGuest) {
      return res.status(404).json({ message: "Pending guest not found" });
    }

    console.log('✅ Guest rejected successfully:', req.params.id);

    res.json({ 
      message: "Guest rejected successfully", 
      pendingGuest: pendingGuest 
    });

  } catch (error) {
    console.error("❌ Error rejecting pending guest:", error);
    res.status(500).json({ message: "Failed to reject guest", error: error.message });
  }
});

// DELETE PENDING GUEST
app.delete("/pending-guests/:id", async (req, res) => {
  try {
    const deletedGuest = await PendingGuest.findOneAndDelete({ id: req.params.id });
    if (!deletedGuest) {
      return res.status(404).json({ message: "Pending guest not found" });
    }

    // Delete associated photo
    if (deletedGuest.photo) {
      const photoPath = path.join(uploadDir, deletedGuest.photo);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    res.json({ 
      message: "Pending guest deleted successfully",
      guest: deletedGuest 
    });
  } catch (error) {
    console.error("Error deleting pending guest:", error);
    res.status(500).json({ message: "Failed to delete pending guest", error: error.message });
  }
});

// GET PENDING GUEST STATS
app.get("/pending-guests/stats", async (req, res) => {
  try {
    const totalPending = await PendingGuest.countDocuments({ status: 'pending' });
    const totalApproved = await PendingGuest.countDocuments({ status: 'approved' });
    const totalRejected = await PendingGuest.countDocuments({ status: 'rejected' });

    console.log('📊 Pending Guest Stats:', { pending: totalPending, approved: totalApproved, rejected: totalRejected });

    res.json({
      pending: totalPending,
      approved: totalApproved,
      rejected: totalRejected,
      total: totalPending + totalApproved + totalRejected
    });
  } catch (error) {
    console.error('❌ Error fetching pending guest stats:', error);
    res.status(500).json({ message: "Failed to fetch stats", error: error.message });
  }
});

// ======================
// BULK OPERATIONS
// ======================

// BULK APPROVE PENDING REQUESTS
app.post("/pending-requests/bulk-approve", async (req, res) => {
  try {
    const { ids, type } = req.body; // type: 'visitors' or 'guests'
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided for bulk approval" });
    }

    if (!type || !['visitors', 'guests'].includes(type)) {
      return res.status(400).json({ message: "Invalid type. Must be 'visitors' or 'guests'" });
    }

    let results = {
      approved: 0,
      failed: 0,
      details: []
    };

    for (const id of ids) {
      try {
        if (type === 'visitors') {
          await axios.post(`http://localhost:5001/pending-visitors/${id}/approve`);
        } else {
          await axios.post(`http://localhost:5001/pending-guests/${id}/approve`);
        }
        results.approved++;
        results.details.push({ id, status: 'approved' });
      } catch (error) {
        results.failed++;
        results.details.push({ id, status: 'failed', error: error.message });
      }
    }

    res.json({
      message: `Bulk approval completed for ${type}`,
      results: results
    });

  } catch (error) {
    console.error("Bulk approval error:", error);
    res.status(500).json({ message: "Bulk approval failed", error: error.message });
  }
});

// BULK REJECT PENDING REQUESTS
app.post("/pending-requests/bulk-reject", async (req, res) => {
  try {
    const { ids, type, rejectionReason } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided for bulk rejection" });
    }

    if (!type || !['visitors', 'guests'].includes(type)) {
      return res.status(400).json({ message: "Invalid type. Must be 'visitors' or 'guests'" });
    }

    let results = {
      rejected: 0,
      failed: 0,
      details: []
    };

    for (const id of ids) {
      try {
        if (type === 'visitors') {
          await axios.post(`http://localhost:5001/pending-visitors/${id}/reject`, {
            rejectionReason
          });
        } else {
          await axios.post(`http://localhost:5001/pending-guests/${id}/reject`, {
            rejectionReason
          });
        }
        results.rejected++;
        results.details.push({ id, status: 'rejected' });
      } catch (error) {
        results.failed++;
        results.details.push({ id, status: 'failed', error: error.message });
      }
    }

    res.json({
      message: `Bulk rejection completed for ${type}`,
      results: results
    });

  } catch (error) {
    console.error("Bulk rejection error:", error);
    res.status(500).json({ message: "Bulk rejection failed", error: error.message });
  }
});

// ======================
// BACKUP & MAINTENANCE ENDPOINTS
// ======================

// Create backups directory if not exists
const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// Helper function to get database stats
const getDatabaseStats = async () => {
  try {
    const [
      usersCount,
      inmatesCount,
      visitorsCount,
      guestsCount,
      crimesCount,
      visitLogsCount,
      activeTimersCount
    ] = await Promise.all([
      User.countDocuments(),
      Inmate.countDocuments(),
      Visitor.countDocuments(),
      Guest.countDocuments(),
      Crime.countDocuments(),
      VisitLog.countDocuments(),
      VisitLog.countDocuments({ 
        isTimerActive: true, 
        timerEnd: { $gt: new Date() } 
      })
    ]);

    const totalRecords = usersCount + inmatesCount + visitorsCount + guestsCount + crimesCount + visitLogsCount;
    
    // Calculate approximate storage usage (mock calculation)
    const storageUsage = Math.min(95, Math.round((totalRecords / 5001) * 100));

    return {
      totalRecords,
      storageUsage,
      collectionsCount: 6,
      lastBackup: await getLastBackupDate(),
      collectionStats: {
        Users: usersCount,
        Inmates: inmatesCount,
        Visitors: visitorsCount,
        Guests: guestsCount,
        Crimes: crimesCount,
        'Visit Logs': visitLogsCount,
        'Active Timers': activeTimersCount
      }
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    return {};
  }
};

// Helper function to get last backup date
const getLastBackupDate = async () => {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(file => file.endsWith('.json') || file.endsWith('.zip'))
      .map(file => {
        const filePath = path.join(backupsDir, file);
        const stats = fs.statSync(filePath);
        return stats.mtime;
      })
      .sort((a, b) => b - a);
    
    return files.length > 0 ? files[0] : null;
  } catch (error) {
    return null;
  }
};

// Get all backups
app.get("/backups", async (req, res) => {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(file => file.endsWith('.json') || file.endsWith('.zip'))
      .map(file => {
        const filePath = path.join(backupsDir, file);
        const stats = fs.statSync(filePath);
        const format = file.endsWith('.json') ? 'json' : 'zip';
        
        return {
          filename: file,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          size: stats.size,
          format: format,
          type: file.includes('quick-') ? 'quick' : file.includes('auto-') ? 'auto' : 'manual'
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const stats = await getDatabaseStats();
    
    res.json({
      backups: files,
      stats: stats,
      totalBackups: files.length
    });
  } catch (error) {
    console.error('Error fetching backups:', error);
    res.status(500).json({ 
      message: "Failed to fetch backups", 
      error: error.message 
    });
  }
});

// Create backup - FIXED CSV VERSION
app.post("/backups/create", async (req, res) => {
  try {
    const { format = 'json' } = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.${format === 'csv' ? 'zip' : 'json'}`;
    const filePath = path.join(backupsDir, filename);

    console.log(`🔄 Creating backup: ${filename}, format: ${format}`);

    // Fetch all data from collections
    const [users, inmates, visitors, guests, crimes, visitLogs] = await Promise.all([
      User.find().lean(),
      Inmate.find().lean(),
      Visitor.find().lean(),
      Guest.find().lean(),
      Crime.find().lean(),
      VisitLog.find().lean()
    ]);

    const backupData = {
      metadata: {
        version: '1.0',
        created: new Date().toISOString(),
        collections: 6,
        totalRecords: users.length + inmates.length + visitors.length + guests.length + crimes.length + visitLogs.length,
        format: format
      },
      collections: {
        users,
        inmates,
        visitors,
        guests,
        crimes,
        visitLogs
      }
    };

    if (format === 'json') {
      // Save as JSON
      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
      
      console.log(`✅ JSON backup created: ${filename}`);
      
      res.json({
        message: "JSON backup created successfully",
        filename: filename,
        size: fs.statSync(filePath).size,
        collections: Object.keys(backupData.collections).length,
        totalRecords: backupData.metadata.totalRecords
      });
      
    } else if (format === 'csv') {
      // Save as CSV files in a zip
      const output = fs.createWriteStream(filePath);
      const archive = archiver('zip', { 
        zlib: { level: 9 } 
      });

      output.on('close', () => {
        console.log(`✅ CSV backup created: ${filename}, size: ${archive.pointer()} bytes`);
        res.json({
          message: "CSV backup created successfully",
          filename: filename,
          size: archive.pointer(),
          collections: Object.keys(backupData.collections).length,
          totalRecords: backupData.metadata.totalRecords
        });
      });

      archive.on('error', (err) => {
        console.error('Archive error:', err);
        res.status(500).json({ 
          message: "CSV backup failed", 
          error: err.message 
        });
      });

      archive.pipe(output);

      // Add metadata
      archive.append(JSON.stringify(backupData.metadata, null, 2), { 
        name: 'metadata.json' 
      });

      // Helper function to convert MongoDB data to CSV-friendly format
      const convertForCSV = (data) => {
        return data.map(item => {
          const converted = {};
          
          for (const [key, value] of Object.entries(item)) {
            if (value === null || value === undefined) {
              converted[key] = '';
            } else if (typeof value === 'object') {
              // Handle MongoDB ObjectId
              if (value._id && typeof value._id === 'object' && value._id.toString) {
                converted[key] = value._id.toString();
              }
              // Handle Date objects
              else if (value instanceof Date) {
                converted[key] = value.toISOString();
              }
              // Handle nested objects (convert to JSON string)
              else if (typeof value === 'object' && !Array.isArray(value)) {
                converted[key] = JSON.stringify(value);
              }
              // Handle arrays (convert to JSON string)
              else if (Array.isArray(value)) {
                converted[key] = JSON.stringify(value);
              }
              // Handle Buffer objects (like _id)
              else if (Buffer.isBuffer(value)) {
                converted[key] = value.toString('hex');
              }
              else {
                converted[key] = String(value);
              }
            } else if (typeof value === 'boolean') {
              converted[key] = value ? 'true' : 'false';
            } else {
              converted[key] = String(value);
            }
          }
          
          return converted;
        });
      };

      // Convert each collection to CSV
      const collections = [
        { name: 'users', data: users },
        { name: 'inmates', data: inmates },
        { name: 'visitors', data: visitors },
        { name: 'guests', data: guests },
        { name: 'crimes', data: crimes },
        { name: 'visit_logs', data: visitLogs }
      ];

      for (const collection of collections) {
        if (collection.data && collection.data.length > 0) {
          try {
            // Convert data to CSV-friendly format
            const csvData = convertForCSV(collection.data);
            
            // Use json2csv for conversion
            const parser = new Parser();
            const csv = parser.parse(csvData);
            
            archive.append(csv, { name: `${collection.name}.csv` });
            console.log(`✅ Added ${collection.name}.csv with ${collection.data.length} records`);
            
          } catch (error) {
            console.warn(`⚠️ Could not convert ${collection.name} to CSV:`, error);
            // Add error information
            archive.append(
              `Error converting ${collection.name} to CSV: ${error.message}\n\nFirst record sample: ${JSON.stringify(collection.data[0], null, 2)}`,
              { name: `${collection.name}_ERROR.txt` }
            );
          }
        } else {
          console.log(`ℹ️ No data for ${collection.name}, skipping CSV`);
          archive.append('No data available for this collection', { 
            name: `${collection.name}_EMPTY.txt` 
          });
        }
      }

      // Add a README file explaining the CSV format
      const readmeContent = `CSV Backup Files - Format Explanation

Each CSV file contains data from the corresponding MongoDB collection.

Special Formatting:
- MongoDB ObjectId fields are converted to string format
- Date fields are converted to ISO string format (YYYY-MM-DDTHH:mm:ss.sssZ)
- Nested objects are converted to JSON strings
- Arrays are converted to JSON strings
- Boolean values are converted to 'true'/'false' strings
- Buffer objects are converted to hex strings

Files included:
- users.csv: System users data
- inmates.csv: Inmate records
- visitors.csv: Visitor records  
- guests.csv: Guest records
- crimes.csv: Crime definitions
- visit_logs.csv: Visit history logs

Backup created: ${new Date().toISOString()}
`;
      
      archive.append(readmeContent, { name: 'README.txt' });

      // Finalize the archive
      archive.finalize();

    } else {
      res.status(400).json({ 
        message: "Invalid format. Use 'json' or 'csv'" 
      });
    }

  } catch (error) {
    console.error('Backup creation error:', error);
    res.status(500).json({ 
      message: "Backup creation failed", 
      error: error.message 
    });
  }
});

// Simple CSV backup endpoint
app.post("/backups/create-csv-simple", async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `csv-simple-backup-${timestamp}.zip`;
    const filePath = path.join(backupsDir, filename);

    console.log(`🔄 Creating simple CSV backup: ${filename}`);

    // Fetch only users for testing (simplest collection)
    const users = await User.find().select('-password').lean();

    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.json({
        message: "Simple CSV backup created successfully",
        filename: filename,
        size: archive.pointer(),
        records: users.length
      });
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);

    // Simple CSV conversion
    if (users.length > 0) {
      const csv = Papa.unparse(users);
      archive.append(csv, { name: 'users.csv' });
    }

    // Add a readme file
    archive.append(
      'This is a simple CSV backup containing user data only.\nCreated: ' + new Date().toISOString(),
      { name: 'README.txt' }
    );

    archive.finalize();

  } catch (error) {
    console.error('Simple CSV backup error:', error);
    res.status(500).json({ 
      message: "Simple CSV backup failed", 
      error: error.message 
    });
  }
});

// Quick backup
app.post("/backups/quick", async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `quick-backup-${timestamp}.json`;
    const filePath = path.join(backupsDir, filename);

    console.log(`⚡ Creating quick backup: ${filename}`);

    // Fetch only essential data for quick backup
    const [users, inmates, visitors, guests] = await Promise.all([
      User.find().select('-password').lean(),
      Inmate.find().select('inmateCode lastName firstName status cellId crime').lean(),
      Visitor.find().select('id lastName firstName status prisonerId totalVisits lastVisitDate').lean(),
      Guest.find().select('id lastName firstName status visitPurpose totalVisits lastVisitDate').lean()
    ]);

    const quickBackupData = {
      metadata: {
        version: '1.0',
        created: new Date().toISOString(),
        type: 'quick',
        collections: 4,
        totalRecords: users.length + inmates.length + visitors.length + guests.length
      },
      collections: {
        users,
        inmates,
        visitors,
        guests
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(quickBackupData, null, 2));

    res.json({
      message: "Quick backup created successfully",
      filename: filename,
      size: fs.statSync(filePath).size,
      type: 'quick'
    });

  } catch (error) {
    console.error('Quick backup error:', error);
    res.status(500).json({ 
      message: "Quick backup failed", 
      error: error.message 
    });
  }
});

// Download backup
app.get("/backups/download/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(backupsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Backup file not found" });
    }

    // Security check - prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ message: "Invalid filename" });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    if (filename.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    } else if (filename.endsWith('.zip')) {
      res.setHeader('Content-Type', 'application/zip');
    }

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      message: "Download failed", 
      error: error.message 
    });
  }
});

// Delete backup
app.delete("/backups/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(backupsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Backup file not found" });
    }

    // Security check
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ message: "Invalid filename" });
    }

    fs.unlinkSync(filePath);

    res.json({ 
      message: "Backup deleted successfully",
      filename: filename
    });

  } catch (error) {
    console.error('Delete backup error:', error);
    res.status(500).json({ 
      message: "Failed to delete backup", 
      error: error.message 
    });
  }
});

// Restore backup
app.post("/backups/restore/:filename", async (req, res) => {
  let session = null;
  try {
    const filename = req.params.filename;
    const filePath = path.join(backupsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Backup file not found" });
    }

    console.log(`🔄 Restoring from backup: ${filename}`);

    // Start MongoDB transaction for atomic restore
    session = await mongoose.startSession();
    session.startTransaction();

    let backupData;
    
    if (filename.endsWith('.json')) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      backupData = JSON.parse(fileContent);
    } else {
      return res.status(400).json({ message: "Only JSON backups can be restored currently" });
    }

    const results = {
      restored: {},
      errors: {},
      totalRestored: 0
    };

    // Restore each collection
    const collections = {
      users: User,
      inmates: Inmate,
      visitors: Visitor,
      guests: Guest,
      crimes: Crime,
      visitLogs: VisitLog
    };

    for (const [collectionName, Model] of Object.entries(collections)) {
      if (backupData.collections[collectionName]) {
        try {
          // Delete existing data
          await Model.deleteMany({}, { session });
          
          // Insert backup data
          if (backupData.collections[collectionName].length > 0) {
            const inserted = await Model.insertMany(backupData.collections[collectionName], { 
              session,
              ordered: false 
            });
            results.restored[collectionName] = inserted.length;
            results.totalRestored += inserted.length;
          } else {
            results.restored[collectionName] = 0;
          }
        } catch (error) {
          results.errors[collectionName] = error.message;
          console.error(`Error restoring ${collectionName}:`, error);
        }
      }
    }

    // Commit transaction
    await session.commitTransaction();
    
    res.json({
      message: "Backup restored successfully",
      results: results,
      backup: {
        filename: filename,
        created: backupData.metadata?.created,
        collections: Object.keys(results.restored).length
      }
    });

  } catch (error) {
    // Abort transaction on error
    if (session) {
      await session.abortTransaction();
    }
    console.error('Restore error:', error);
    res.status(500).json({ 
      message: "Restore failed", 
      error: error.message 
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
});

// Database statistics endpoint
app.get("/database/stats", async (req, res) => {
  try {
    const stats = await getDatabaseStats();
    res.json(stats);
  } catch (error) {
    console.error('Database stats error:', error);
    res.status(500).json({ 
      message: "Failed to fetch database stats", 
      error: error.message 
    });
  }
});

// System health check endpoint
app.get("/health", async (req, res) => {
  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    const database = dbState === 1 ? 'connected' : 'disconnected';

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsed = `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`;

    // Get uptime
    const uptime = process.uptime();

    // Get backup count
    const backupFiles = fs.readdirSync(backupsDir).filter(file => 
      file.endsWith('.json') || file.endsWith('.zip')
    );

    // Get active connections/collections stats
    const [usersCount, activeTimers] = await Promise.all([
      User.countDocuments(),
      VisitLog.countDocuments({ 
        isTimerActive: true, 
        timerEnd: { $gt: new Date() } 
      })
    ]);

    res.json({
      status: 'healthy',
      database: database,
      uptime: Math.floor(uptime),
      memory: {
        used: memoryUsed,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
      },
      backups: {
        count: backupFiles.length,
        lastBackup: await getLastBackupDate()
      },
      active: {
        users: usersCount,
        timers: activeTimers
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      database: 'error',
      uptime: process.uptime(),
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Auto-backup endpoint (can be called by cron job)
app.post("/backups/auto", async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `auto-backup-${timestamp}.json`;
    const filePath = path.join(backupsDir, filename);

    console.log(`🤖 Creating auto backup: ${filename}`);

    // Simple auto backup - just essential collections
    const [inmates, visitors, guests] = await Promise.all([
      Inmate.find().select('inmateCode lastName firstName status cellId crime').lean(),
      Visitor.find().select('id lastName firstName status prisonerId totalVisits lastVisitDate').lean(),
      Guest.find().select('id lastName firstName status visitPurpose totalVisits lastVisitDate').lean()
    ]);

    const autoBackupData = {
      metadata: {
        version: '1.0',
        created: new Date().toISOString(),
        type: 'auto',
        collections: 3,
        totalRecords: inmates.length + visitors.length + guests.length
      },
      collections: {
        inmates,
        visitors,
        guests
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(autoBackupData, null, 2));

    // Cleanup old auto backups (keep last 10)
    const autoBackups = fs.readdirSync(backupsDir)
      .filter(file => file.startsWith('auto-backup-') && file.endsWith('.json'))
      .sort()
      .reverse();

    if (autoBackups.length > 10) {
      const toDelete = autoBackups.slice(10);
      toDelete.forEach(file => {
        fs.unlinkSync(path.join(backupsDir, file));
        console.log(`🧹 Deleted old auto backup: ${file}`);
      });
    }

    res.json({
      message: "Auto backup created successfully",
      filename: filename,
      size: fs.statSync(filePath).size,
      type: 'auto',
      cleanup: {
        deleted: autoBackups.length > 10 ? autoBackups.length - 10 : 0
      }
    });

  } catch (error) {
    console.error('Auto backup error:', error);
    res.status(500).json({ 
      message: "Auto backup failed", 
      error: error.message 
    });
  }
});

// Cleanup old backups endpoint
app.post("/backups/cleanup", async (req, res) => {
  try {
    const { keepLast = 20 } = req.body;

    const allBackups = fs.readdirSync(backupsDir)
      .filter(file => file.endsWith('.json') || file.endsWith('.zip'))
      .map(file => {
        const filePath = path.join(backupsDir, file);
        return {
          filename: file,
          path: filePath,
          mtime: fs.statSync(filePath).mtime
        };
      })
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

    const toDelete = allBackups.slice(keepLast);
    let deletedCount = 0;

    toDelete.forEach(backup => {
      try {
        fs.unlinkSync(backup.path);
        deletedCount++;
        console.log(`🧹 Deleted old backup: ${backup.filename}`);
      } catch (error) {
        console.error(`Error deleting ${backup.filename}:`, error);
      }
    });

    res.json({
      message: "Cleanup completed",
      totalBackups: allBackups.length,
      kept: allBackups.length - toDelete.length,
      deleted: deletedCount,
      details: {
        before: allBackups.length,
        after: allBackups.length - deletedCount
      }
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ 
      message: "Cleanup failed", 
      error: error.message 
    });
  }
});

// ======================
// ANALYTICS & REPORTS ENDPOINTS
// ======================

// Get analytics and reports data
app.get("/analytics/reports", async (req, res) => {
  try {
    const { startDate, endDate, reportType = 'daily' } = req.query;
    
    console.log('📊 Generating analytics report:', { startDate, endDate, reportType });

    // Parse dates with proper validation
    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();
    
    // Get counts for raw data
    const [visitorsCount, guestsCount, inmatesCount, visitLogsCount] = await Promise.all([
      Visitor.countDocuments(),
      Guest.countDocuments(),
      Inmate.countDocuments(),
      VisitLog.countDocuments({
        visitDate: { $gte: start, $lte: end }
      })
    ]);

    const rawData = {
      visitors: visitorsCount,
      guests: guestsCount,
      inmates: inmatesCount,
      visitLogs: visitLogsCount
    };

    let chartData = [];
    let summaryData = {};

    // Generate different analytics based on report type
    switch (reportType) {
      case 'daily':
        ({ chartData, summaryData } = await generateDailyAnalytics(start, end));
        break;
      case 'weekly':
        ({ chartData, summaryData } = await generateWeeklyAnalytics(start, end));
        break;
      case 'monthly':
        ({ chartData, summaryData } = await generateMonthlyAnalytics(start, end));
        break;
      case 'yearly':
        ({ chartData, summaryData } = await generateYearlyAnalytics(start, end));
        break;
      case 'demographic':
        ({ chartData, summaryData } = await generateDemographicAnalytics());
        break;
      case 'performance':
        ({ chartData, summaryData } = await generatePerformanceAnalytics(start, end));
        break;
      default:
        ({ chartData, summaryData } = await generateDailyAnalytics(start, end));
    }

    // Add system statistics to summary
    summaryData.totalVisitors = visitorsCount;
    summaryData.totalGuests = guestsCount;
    summaryData.totalInmates = inmatesCount;
    summaryData.totalVisitLogs = visitLogsCount;

    res.json({
      success: true,
      chartData,
      summaryData,
      rawData,
      reportType,
      dateRange: { startDate: start, endDate: end }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate analytics report",
      error: error.message
    });
  }
});

// Helper function for daily analytics
const generateDailyAnalytics = async (start, end) => {
  const visitLogs = await VisitLog.find({
    visitDate: { $gte: start, $lte: end }
  }).sort({ visitDate: 1 });

  // Group by date
  const dailyData = {};
  visitLogs.forEach(log => {
    const dateStr = log.visitDate.toISOString().split('T')[0];
    if (!dailyData[dateStr]) {
      dailyData[dateStr] = { visitors: 0, guests: 0, total: 0 };
    }
    
    if (log.personType === 'visitor') {
      dailyData[dateStr].visitors++;
    } else {
      dailyData[dateStr].guests++;
    }
    dailyData[dateStr].total++;
  });

  // Convert to chart format
  const chartData = Object.entries(dailyData).map(([date, data]) => ({
    name: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    visitors: data.visitors,
    guests: data.guests,
    total: data.total,
    date: date
  }));

  // Calculate summary
  const totalVisits = visitLogs.length;
  const totalVisitors = visitLogs.filter(log => log.personType === 'visitor').length;
  const totalGuests = visitLogs.filter(log => log.personType === 'guest').length;
  const avgDailyVisits = totalVisits / Math.max(1, Object.keys(dailyData).length);

  const summaryData = {
    totalVisits,
    totalVisitors,
    totalGuests,
    avgDailyVisits: Math.round(avgDailyVisits * 10) / 10,
    dateRange: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
    daysWithVisits: Object.keys(dailyData).length
  };

  return { chartData, summaryData };
};

// Helper function for weekly analytics
const generateWeeklyAnalytics = async (start, end) => {
  const visitLogs = await VisitLog.find({
    visitDate: { $gte: start, $lte: end }
  });

  // Group by week
  const weeklyData = {};
  visitLogs.forEach(log => {
    const weekStart = getWeekStartDate(log.visitDate);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { visitors: 0, guests: 0, total: 0 };
    }
    
    if (log.personType === 'visitor') {
      weeklyData[weekKey].visitors++;
    } else {
      weeklyData[weekKey].guests++;
    }
    weeklyData[weekKey].total++;
  });

  const chartData = Object.entries(weeklyData).map(([weekStart, data]) => ({
    name: `Week ${new Date(weekStart).getDate()}/${new Date(weekStart).getMonth() + 1}`,
    visitors: data.visitors,
    guests: data.guests,
    total: data.total,
    weekStart: weekStart
  }));

  const totalVisits = visitLogs.length;
  const summaryData = {
    totalVisits,
    weeklyAverage: Math.round(totalVisits / Math.max(1, Object.keys(weeklyData).length)),
    weeksAnalyzed: Object.keys(weeklyData).length,
    peakWeek: Math.max(...Object.values(weeklyData).map(w => w.total))
  };

  return { chartData, summaryData };
};

// Helper function for monthly analytics
const generateMonthlyAnalytics = async (start, end) => {
  const visitLogs = await VisitLog.find({
    visitDate: { $gte: start, $lte: end }
  });

  const monthlyData = {};
  visitLogs.forEach(log => {
    const monthKey = log.visitDate.toISOString().substring(0, 7); // YYYY-MM
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { visitors: 0, guests: 0, total: 0 };
    }
    
    if (log.personType === 'visitor') {
      monthlyData[monthKey].visitors++;
    } else {
      monthlyData[monthKey].guests++;
    }
    monthlyData[monthKey].total++;
  });

  const chartData = Object.entries(monthlyData).map(([month, data]) => ({
    name: new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    visitors: data.visitors,
    guests: data.guests,
    total: data.total,
    month: month
  }));

  const totalVisits = visitLogs.length;
  const summaryData = {
    totalVisits,
    monthlyAverage: Math.round(totalVisits / Math.max(1, Object.keys(monthlyData).length)),
    monthsAnalyzed: Object.keys(monthlyData).length,
    peakMonth: Math.max(...Object.values(monthlyData).map(m => m.total))
  };

  return { chartData, summaryData };
};

// Helper function for yearly analytics
const generateYearlyAnalytics = async (start, end) => {
  const visitLogs = await VisitLog.find({
    visitDate: { $gte: start, $lte: end }
  });

  const yearlyData = {};
  visitLogs.forEach(log => {
    const yearKey = log.visitDate.getFullYear().toString();
    
    if (!yearlyData[yearKey]) {
      yearlyData[yearKey] = { visitors: 0, guests: 0, total: 0 };
    }
    
    if (log.personType === 'visitor') {
      yearlyData[yearKey].visitors++;
    } else {
      yearlyData[yearKey].guests++;
    }
    yearlyData[yearKey].total++;
  });

  const chartData = Object.entries(yearlyData).map(([year, data]) => ({
    name: year,
    visitors: data.visitors,
    guests: data.guests,
    total: data.total,
    year: year
  }));

  const totalVisits = visitLogs.length;
  const summaryData = {
    totalVisits,
    yearlyAverage: Math.round(totalVisits / Math.max(1, Object.keys(yearlyData).length)),
    yearsAnalyzed: Object.keys(yearlyData).length,
    peakYear: Math.max(...Object.values(yearlyData).map(y => y.total))
  };

  return { chartData, summaryData };
};

// Helper function for demographic analytics
const generateDemographicAnalytics = async () => {
  const [visitors, guests, inmates] = await Promise.all([
    Visitor.find().select('sex age').lean(),
    Guest.find().select('sex age').lean(),
    Inmate.find().select('sex').lean()
  ]);

  // Gender distribution
  const genderData = {
    male: 0,
    female: 0
  };

  [...visitors, ...guests, ...inmates].forEach(person => {
    if (person.sex === 'Male') genderData.male++;
    else if (person.sex === 'Female') genderData.female++;
  });

  const chartData = [
    { name: 'Male', value: genderData.male },
    { name: 'Female', value: genderData.female }
  ];

  const summaryData = {
    totalPeople: visitors.length + guests.length + inmates.length,
    maleCount: genderData.male,
    femaleCount: genderData.female,
    genderRatio: `${Math.round((genderData.male / (genderData.male + genderData.female)) * 100)}% Male`
  };

  return { chartData, summaryData };
};

// Helper function for performance analytics
const generatePerformanceAnalytics = async (start, end) => {
  const visitLogs = await VisitLog.find({
    visitDate: { $gte: start, $lte: end },
    timeOut: { $ne: null }
  });

  // Calculate average duration and visits per day
    const dailyPerformance = {};
    visitLogs.forEach(log => {
      const dateStr = log.visitDate.toISOString().split('T')[0];
      if (!dailyPerformance[dateStr]) {
        dailyPerformance[dateStr] = { visits: 0, totalDuration: 0 };
      }
      dailyPerformance[dateStr].visits++;
      
      // Simple duration calculation (you can enhance this)
      if (log.timeIn && log.timeOut) {
        // Mock duration calculation - in real scenario, calculate actual duration
        dailyPerformance[dateStr].totalDuration += 60; // 60 minutes average
      }
    });

    const chartData = Object.entries(dailyPerformance).map(([date, data]) => ({
      name: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      visits: data.visits,
      avgDuration: Math.round(data.totalDuration / data.visits),
      date: date
    }));

    const totalVisits = visitLogs.length;
    const avgDuration = totalVisits > 0 ? 
      Math.round(Object.values(dailyPerformance).reduce((sum, day) => sum + day.totalDuration, 0) / totalVisits) : 0;

    const summaryData = {
      totalCompletedVisits: totalVisits,
      averageDuration: avgDuration + ' mins',
      busiestDay: Math.max(...Object.values(dailyPerformance).map(d => d.visits)),
      efficiencyScore: Math.round((totalVisits / Math.max(1, Object.keys(dailyPerformance).length)) * 10) / 10
    };

    return { chartData, summaryData };
};

// Helper function to get week start date (Monday)
const getWeekStartDate = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
};

// Get real-time dashboard statistics
app.get("/analytics/dashboard-stats", async (req, res) => {
  try {
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));

    const [
      totalVisitors,
      totalGuests,
      totalInmates,
      todayVisits,
      activeTimers,
      pendingApprovals
    ] = await Promise.all([
      Visitor.countDocuments(),
      Guest.countDocuments(),
      Inmate.countDocuments(),
      VisitLog.countDocuments({
        visitDate: { $gte: todayStart, $lte: todayEnd }
      }),
      VisitLog.countDocuments({
        isTimerActive: true,
        timerEnd: { $gt: new Date() }
      }),
      Visitor.countDocuments({ status: 'pending' }) + Guest.countDocuments({ status: 'pending' })
    ]);

    // Weekly trend
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 7);
    const lastWeekVisits = await VisitLog.countDocuments({
      visitDate: { $gte: weekStart, $lte: todayEnd }
    });

    res.json({
      success: true,
      stats: {
        totalVisitors,
        totalGuests,
        totalInmates,
        todayVisits,
        activeTimers,
        pendingApprovals,
        lastWeekVisits
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message
    });
  }
});


// Debug endpoint to check exact database state
app.get("/debug-find-visitor/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 DEBUG FIND VISITOR:', id);
    
    const visitor = await Visitor.findOne({ id: id });
    if (!visitor) {
      return res.status(404).json({ 
        found: false,
        message: "Visitor not found in database" 
      });
    }
    
    // Convert to plain object to see all fields
    const visitorData = visitor.toObject();
    
    console.log('📊 FULL VISITOR DATA FROM DATABASE:', JSON.stringify(visitorData, null, 2));
    
    res.json({
      found: true,
      visitor: visitorData,
      timeSlotInfo: {
        hasTimeSlot: !!visitorData.timeSlot,
        timeSlot: visitorData.timeSlot,
        timeSlotRequested: visitorData.timeSlotRequested,
        timeSlotApproved: visitorData.timeSlotApproved,
        rawTimeSlotField: visitorData.timeSlot
      },
      message: "Visitor found in database"
    });
    
  } catch (error) {
    console.error('❌ Debug find error:', error);
    res.status(500).json({ 
      found: false,
      message: "Debug lookup failed", 
      error: error.message 
    });
  }
});

// Debug endpoint to check exact guest database state
app.get("/debug-find-guest/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 DEBUG FIND GUEST:', id);
    
    const guest = await Guest.findOne({ id: id });
    if (!guest) {
      return res.status(404).json({ 
        found: false,
        message: "Guest not found in database" 
      });
    }
    
    // Convert to plain object to see all fields
    const guestData = guest.toObject();
    
    console.log('📊 FULL GUEST DATA FROM DATABASE:', JSON.stringify(guestData, null, 2));
    
    res.json({
      found: true,
      guest: guestData,
      timeSlotInfo: {
        hasTimeSlot: !!guestData.timeSlot,
        timeSlot: guestData.timeSlot,
        timeSlotRequested: guestData.timeSlotRequested,
        timeSlotApproved: guestData.timeSlotApproved,
        rawTimeSlotField: guestData.timeSlot
      },
      message: "Guest found in database"
    });
    
  } catch (error) {
    console.error('❌ Debug find guest error:', error);
    res.status(500).json({ 
      found: false,
      message: "Debug guest lookup failed", 
      error: error.message 
    });
  }
});

// Check active timers for a visitor
app.get("/active-timer/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check visitor's current timer status
    const visitor = await Visitor.findOne({ id: id });
    if (!visitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }
    
    // Check if there's an active visit log with timer
    const activeVisitLog = await VisitLog.findOne({
      personId: id,
      timeOut: null,
      isTimerActive: true,
      timerEnd: { $gt: new Date() }
    });
    
    const hasActiveTimer = !!(activeVisitLog && visitor.isTimerActive);
    let timeRemaining = null;
    
    if (hasActiveTimer && activeVisitLog.timerEnd) {
      const now = new Date();
      const end = new Date(activeVisitLog.timerEnd);
      timeRemaining = Math.max(0, end - now);
      
      // Convert to readable format
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      timeRemaining = `${hours}h ${minutes}m`;
    }
    
    res.json({
      hasActiveTimer: hasActiveTimer,
      timeSlot: visitor.timeSlot,
      timeSlotApproved: visitor.timeSlotApproved,
      isTimerActive: visitor.isTimerActive,
      timerStart: visitor.timerStart,
      timerEnd: visitor.timerEnd,
      timeRemaining: timeRemaining,
      activeVisitLog: activeVisitLog ? {
        timerStart: activeVisitLog.timerStart,
        timerEnd: activeVisitLog.timerEnd,
        timeIn: activeVisitLog.timeIn
      } : null,
      message: hasActiveTimer ? 
        `Active timer: ${timeRemaining} remaining` :
        'No active timer'
    });
    
  } catch (error) {
    console.error('Active timer check error:', error);
    res.status(500).json({ message: "Timer check failed", error: error.message });
  }
});

// Debug endpoint to check exact database state
app.get("/debug-find-visitor/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 DEBUG FIND VISITOR:', id);
    
    const visitor = await Visitor.findOne({ id: id });
    if (!visitor) {
      return res.status(404).json({ 
        found: false,
        message: "Visitor not found in database" 
      });
    }
    
    // Convert to plain object to see all fields
    const visitorData = visitor.toObject();
    
    console.log('📊 FULL VISITOR DATA FROM DATABASE:', JSON.stringify(visitorData, null, 2));
    
    res.json({
      found: true,
      visitor: visitorData,
      timeSlotInfo: {
        hasTimeSlot: !!visitorData.timeSlot,
        timeSlot: visitorData.timeSlot,
        timeSlotRequested: visitorData.timeSlotRequested,
        timeSlotApproved: visitorData.timeSlotApproved,
        rawTimeSlotField: visitorData.timeSlot
      },
      message: "Visitor found in database"
    });
    
  } catch (error) {
    console.error('❌ Debug find error:', error);
    res.status(500).json({ 
      found: false,
      message: "Debug lookup failed", 
      error: error.message 
    });
  }
});

// ======================
// SIMPLE TIMER SETTING ENDPOINTS
// ======================

// Set custom timer for visitor - SIMPLE VERSION
app.put("/visitors/:id/set-custom-timer", async (req, res) => {
  try {
    const { startTime, endTime, duration } = req.body;
    console.log('🔄 SETTING CUSTOM TIMER FOR VISITOR:', req.params.id, { startTime, endTime, duration });
    
    if (!startTime || !endTime) {
      return res.status(400).json({ message: "Start time and end time are required" });
    }

    // Parse the times and calculate timer dates (like your 3-hour timer does)
    const today = new Date();
    
    const parseTimeToDate = (timeStr, baseDate) => {
      const [time, period] = timeStr.trim().toUpperCase().split(' ');
      const [hours, minutes] = time.split(':');
      
      let hour = parseInt(hours);
      const minute = parseInt(minutes);
      
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      
      const date = new Date(baseDate);
      date.setHours(hour, minute, 0, 0);
      return date;
    };

    // Calculate timer start and end (EXACTLY like your 3-hour timer logic)
    const timerStart = parseTimeToDate(startTime, today);
    const timerEnd = parseTimeToDate(endTime, today);
    
    // If end time is earlier than start time, assume it's next day
    if (timerEnd <= timerStart) {
      timerEnd.setDate(timerEnd.getDate() + 1);
    }

    console.log('⏰ CALCULATED TIMER:', {
      timerStart: timerStart.toLocaleString(),
      timerEnd: timerEnd.toLocaleString(),
      duration: duration
    });

    // Update visitor with timer (EXACTLY like your 3-hour timer update)
    const updatedVisitor = await Visitor.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          timerStart: timerStart,
          timerEnd: timerEnd,
          isTimerActive: false, // Will be activated when they time in
          // Store the custom time info for display purposes only
          customTimer: {
            startTime: startTime,
            endTime: endTime,
            duration: duration
          }
        }
      },
      { 
        new: true,
        runValidators: true 
      }
    );

    if (!updatedVisitor) {
      return res.status(404).json({ message: "Visitor not found" });
    }

    console.log('✅ CUSTOM TIMER SET SUCCESSFULLY:', {
      id: updatedVisitor.id,
      timerStart: updatedVisitor.timerStart,
      timerEnd: updatedVisitor.timerEnd
    });

    res.json({
      message: `Custom timer set: ${startTime} - ${endTime} (${duration})`,
      timerStart: timerStart,
      timerEnd: timerEnd,
      duration: duration
    });

  } catch (error) {
    console.error("❌ Error setting custom timer:", error);
    res.status(500).json({ message: "Failed to set custom timer", error: error.message });
  }
});

// Set custom timer for guest - SIMPLE VERSION
app.put("/guests/:id/set-custom-timer", async (req, res) => {
  try {
    const { startTime, endTime, duration } = req.body;
    console.log('🔄 SETTING CUSTOM TIMER FOR GUEST:', req.params.id, { startTime, endTime, duration });
    
    if (!startTime || !endTime) {
      return res.status(400).json({ message: "Start time and end time are required" });
    }

    // Same timer calculation logic as above
    const today = new Date();
    
    const parseTimeToDate = (timeStr, baseDate) => {
      const [time, period] = timeStr.trim().toUpperCase().split(' ');
      const [hours, minutes] = time.split(':');
      
      let hour = parseInt(hours);
      const minute = parseInt(minutes);
      
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      
      const date = new Date(baseDate);
      date.setHours(hour, minute, 0, 0);
      return date;
    };

    const timerStart = parseTimeToDate(startTime, today);
    const timerEnd = parseTimeToDate(endTime, today);
    
    if (timerEnd <= timerStart) {
      timerEnd.setDate(timerEnd.getDate() + 1);
    }

    const updatedGuest = await Guest.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          timerStart: timerStart,
          timerEnd: timerEnd,
          isTimerActive: false,
          customTimer: {
            startTime: startTime,
            endTime: endTime,
            duration: duration
          }
        }
      },
      { 
        new: true,
        runValidators: true 
      }
    );

    if (!updatedGuest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    console.log('✅ GUEST CUSTOM TIMER SET SUCCESSFULLY');

    res.json({
      message: `Custom timer set: ${startTime} - ${endTime} (${duration})`,
      timerStart: timerStart,
      timerEnd: timerEnd,
      duration: duration
    });

  } catch (error) {
    console.error("❌ Error setting custom timer for guest:", error);
    res.status(500).json({ message: "Failed to set custom timer", error: error.message });
  }
});

// Simple timer verification
app.get("/verify-custom-timer/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 VERIFYING CUSTOM TIMER FOR:', id);
    
    const visitor = await Visitor.findOne({ id: id });
    if (!visitor) {
      return res.status(404).json({ 
        hasCustomTimer: false,
        message: "Visitor not found" 
      });
    }
    
    const hasCustomTimer = !!(visitor.timerStart && visitor.timerEnd);
    
    console.log('✅ TIMER VERIFICATION:', {
      hasCustomTimer: hasCustomTimer,
      timerStart: visitor.timerStart,
      timerEnd: visitor.timerEnd,
      customTimer: visitor.customTimer
    });
    
    res.json({
      hasCustomTimer: hasCustomTimer,
      timerStart: visitor.timerStart,
      timerEnd: visitor.timerEnd,
      customTimer: visitor.customTimer,
      message: hasCustomTimer ? 
        `Custom timer set: ${visitor.customTimer?.startTime} - ${visitor.customTimer?.endTime}` :
        'No custom timer set'
    });
    
  } catch (error) {
    console.error('❌ Timer verification error:', error);
    res.status(500).json({ 
      hasCustomTimer: false,
      message: "Verification failed", 
      error: error.message 
    });
  }
});

// Simple timer verification for guest
app.get("/verify-custom-timer-guest/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 VERIFYING CUSTOM TIMER FOR GUEST:', id);
    
    const guest = await Guest.findOne({ id: id });
    if (!guest) {
      return res.status(404).json({ 
        hasCustomTimer: false,
        message: "Guest not found" 
      });
    }
    
    const hasCustomTimer = !!(guest.timerStart && guest.timerEnd);
    
    console.log('✅ GUEST TIMER VERIFICATION:', {
      hasCustomTimer: hasCustomTimer,
      timerStart: guest.timerStart,
      timerEnd: guest.timerEnd,
      customTimer: guest.customTimer
    });
    
    res.json({
      hasCustomTimer: hasCustomTimer,
      timerStart: guest.timerStart,
      timerEnd: guest.timerEnd,
      customTimer: guest.customTimer,
      message: hasCustomTimer ? 
        `Custom timer set: ${guest.customTimer?.startTime} - ${guest.customTimer?.endTime}` :
        'No custom timer set'
    });
    
  } catch (error) {
    console.error('❌ Guest timer verification error:', error);
    res.status(500).json({ 
      hasCustomTimer: false,
      message: "Guest verification failed", 
      error: error.message 
    });
  }
});

// ======================
// SERVER STARTUP BAN MANAGEMENT
// ======================

// Check for expired bans when server starts
app.on('listening', async () => {
  console.log('🔍 Checking for expired bans on startup...');
  await autoExpireBans();
});

// Set up periodic ban expiration check (every 5 minutes)
setInterval(async () => {
  console.log('🔄 Running periodic ban expiration check...');
  await autoExpireBans();
}, 5 * 60 * 1000); // 5 minutes

// ======================
// HEALTH CHECK
// ======================

app.get("/", (req, res) => {
  res.json({ 
    message: "Prison Management System API", 
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
  console.log(`🖼️ Access images at: http://localhost:${PORT}/uploads/filename`);
  console.log(`⏰ Timer system: ACTIVE - 3-hour visit duration`);
  console.log(`🔍 Smart scanning: ENABLED - Daily visit limits enforced`);
  console.log(`📊 Visit History: ENABLED - Complete visit tracking with statistics`);
});