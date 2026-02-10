import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Button, Spinner, Container, Row, Col, Card } from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import API_BASE_URL from "./config/api";
import "./ForgotPassword.css";

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Start countdown only when on OTP step
    if (step === 2) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 0) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [step]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error("Please enter a valid email");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/forgot-password`, {
        email: email.toLowerCase()
      });

      setUserId(response.data.userId);
      setStep(2);
      setCountdown(600); // Reset countdown
      
      // Check if email was actually sent or just generated
      if (response.data.emailSent === false) {
        toast.warning(response.data.message || "OTP generated. Check server console.", {
          autoClose: 5000
        });
      } else {
        toast.success(response.data.message || "OTP sent to your email");
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      const errorMsg = error.response?.data?.message || "Failed to send OTP. Please try again.";
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`).focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = pastedData.split("");
    while (newOtp.length < 6) newOtp.push("");
    setOtp(newOtp);

    // Focus last filled input
    const lastIndex = Math.min(pastedData.length, 5);
    document.getElementById(`otp-${lastIndex}`).focus();
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      toast.error("Please enter the complete 6-digit OTP");
      return;
    }

    setIsLoading(true);
    try {
      // Just verify OTP, don't reset password yet
      const response = await axios.post(`${API_BASE_URL}/verify-reset-otp`, {
        userId,
        otp: otpString
      });

      toast.success("OTP verified! Please set your new password.");
      setStep(3);
    } catch (error) {
      console.error("OTP verification error:", error);
      const errorMsg = error.response?.data?.message || "Invalid OTP. Please try again.";
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsResending(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/forgot-password`, {
        email: email.toLowerCase()
      });

      setCountdown(600); // Reset countdown
      toast.success("New OTP sent to your email");
    } catch (error) {
      console.error("Resend OTP error:", error);
      toast.error("Failed to resend OTP. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const validatePassword = (password) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) {
      return "Password must contain at least one special character";
    }
    return null;
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/reset-password`, {
        userId,
        otp: otp.join(""),
        newPassword
      });

      toast.success("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Password reset error:", error);
      const errorMsg = error.response?.data?.message || "Failed to reset password. Please try again.";
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="forgot-password-page"
      style={{
        backgroundImage: `url('/img/background.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        padding: "20px"
      }}
    >
      {/* Semi-transparent overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 1,
        }}
      ></div>

      <Container style={{ position: "relative", zIndex: 2 }}>
        <Row className="justify-content-center">
          <Col md={6} lg={5}>
            <Card className="shadow-lg border-0" style={{ borderRadius: "15px", backgroundColor: "#ffffffcc" }}>
              <Card.Body className="p-4">
                <div className="text-center mb-4">
                  <img
                    src="/img/logo.png"
                    alt="Logo"
                    style={{
                      width: "70px",
                      height: "70px",
                      borderRadius: "50%",
                      marginBottom: "15px",
                      border: "2px solid #2C3E50",
                    }}
                  />
                  <h4 style={{ color: "#000000ff", fontWeight: "600" }}>
                    {step === 1 && "Forgot Password"}
                    {step === 2 && "Verify OTP"}
                    {step === 3 && "Reset Password"}
                  </h4>
                  <p style={{ color: "#000000ab", fontSize: "0.9rem" }}>
                    {step === 1 && "Enter your email to receive a verification code"}
                    {step === 2 && "Enter the 6-digit code sent to your email"}
                    {step === 3 && "Create a new password for your account"}
                  </p>
                </div>

                {/* Step 1: Email Input */}
                {step === 1 && (
                  <Form onSubmit={handleEmailSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ color: "#000000ff", fontWeight: "500" }}>
                        Email Address
                      </Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="Enter your registered email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{
                          borderRadius: "8px",
                          border: "1px solid #BDC3C7",
                          padding: "12px",
                          fontSize: "0.95rem"
                        }}
                      />
                    </Form.Group>

                    <Button
                      variant="primary"
                      type="submit"
                      className="w-100 mb-3"
                      disabled={isLoading}
                      style={{
                        height: "48px",
                        fontSize: "1rem",
                        fontWeight: "600",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: "#5e4434ff"
                      }}
                    >
                      {isLoading ? <Spinner animation="border" size="sm" /> : "Send OTP"}
                    </Button>

                    <div className="text-center">
                      <Button
                        variant="link"
                        onClick={() => navigate("/")}
                        style={{
                          color: "#000000ab",
                          textDecoration: "none",
                          fontSize: "0.9rem"
                        }}
                      >
                        Back to Login
                      </Button>
                    </div>
                  </Form>
                )}

                {/* Step 2: OTP Verification */}
                {step === 2 && (
                  <Form onSubmit={handleVerifyOTP}>
                    <div className="mb-4">
                      <div className="d-flex justify-content-center gap-2 mb-3">
                        {otp.map((digit, index) => (
                          <input
                            key={index}
                            id={`otp-${index}`}
                            type="text"
                            maxLength="1"
                            value={digit}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            onPaste={index === 0 ? handlePaste : undefined}
                            style={{
                              width: "50px",
                              height: "50px",
                              textAlign: "center",
                              fontSize: "1.5rem",
                              fontWeight: "bold",
                              border: "2px solid #BDC3C7",
                              borderRadius: "8px",
                              outline: "none",
                              transition: "border-color 0.3s"
                            }}
                            className="otp-input"
                          />
                        ))}
                      </div>

                      <div className="text-center mb-3">
                        <small style={{ color: countdown > 0 ? "#27AE60" : "#E74C3C", fontWeight: "600" }}>
                          {countdown > 0 ? `Time remaining: ${formatTime(countdown)}` : "OTP Expired"}
                        </small>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      type="submit"
                      className="w-100 mb-2"
                      disabled={isLoading || countdown === 0}
                      style={{
                        height: "48px",
                        fontSize: "1rem",
                        fontWeight: "600",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: "#34495E"
                      }}
                    >
                      {isLoading ? <Spinner animation="border" size="sm" /> : "Verify OTP"}
                    </Button>

                    <div className="text-center">
                      <small style={{ color: "#7F8C8D" }}>Didn't receive the code? </small>
                      <Button
                        variant="link"
                        onClick={handleResendOTP}
                        disabled={isResending || countdown > 540} // Disable for first 60 seconds
                        style={{
                          padding: "0",
                          fontSize: "0.9rem",
                          textDecoration: "none",
                          color: countdown > 540 ? "#95A5A6" : "#3498DB"
                        }}
                      >
                        {isResending ? "Sending..." : "Resend OTP"}
                      </Button>
                    </div>

                    <div className="text-center mt-3">
                      <Button
                        variant="link"
                        onClick={() => {
                          setStep(1);
                          setOtp(["", "", "", "", "", ""]);
                        }}
                        style={{
                          color: "#7F8C8D",
                          textDecoration: "none",
                          fontSize: "0.9rem"
                        }}
                      >
                        Change Email
                      </Button>
                    </div>
                  </Form>
                )}

                {/* Step 3: New Password */}
                {step === 3 && (
                  <Form onSubmit={handleResetPassword}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ color: "#2C3E50", fontWeight: "500" }}>
                        New Password
                      </Form.Label>
                      <div className="position-relative">
                        <Form.Control
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          style={{
                            borderRadius: "8px",
                            border: "1px solid #BDC3C7",
                            padding: "12px",
                            paddingRight: "45px",
                            fontSize: "0.95rem"
                          }}
                        />
                        <i
                          className={`bx ${showNewPassword ? 'bx-hide' : 'bx-show'}`}
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          style={{
                            position: "absolute",
                            right: "15px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            color: "#7F8C8D"
                          }}
                        />
                      </div>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label style={{ color: "#2C3E50", fontWeight: "500" }}>
                        Confirm Password
                      </Form.Label>
                      <div className="position-relative">
                        <Form.Control
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Re-enter new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          style={{
                            borderRadius: "8px",
                            border: "1px solid #BDC3C7",
                            padding: "12px",
                            paddingRight: "45px",
                            fontSize: "0.95rem"
                          }}
                        />
                        <i
                          className={`bx ${showConfirmPassword ? 'bx-hide' : 'bx-show'}`}
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{
                            position: "absolute",
                            right: "15px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            color: "#7F8C8D"
                          }}
                        />
                      </div>
                    </Form.Group>

                    <div className="alert alert-info py-2 mb-3" style={{ fontSize: "0.85rem" }}>
                      <strong>Password Requirements:</strong>
                      <ul className="mb-0 mt-1" style={{ paddingLeft: "20px" }}>
                        <li>At least 8 characters</li>
                        <li>One uppercase letter</li>
                        <li>One lowercase letter</li>
                        <li>One number</li>
                        <li>One special character</li>
                      </ul>
                    </div>

                    <Button
                      variant="primary"
                      type="submit"
                      className="w-100"
                      disabled={isLoading}
                      style={{
                        height: "48px",
                        fontSize: "1rem",
                        fontWeight: "600",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: "#34495E"
                      }}
                    >
                      {isLoading ? <Spinner animation="border" size="sm" /> : "Reset Password"}
                    </Button>
                  </Form>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        style={{ top: "20px" }}
      />
    </div>
  );
};

export default ForgotPassword;
