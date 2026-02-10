import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Form, Button, Spinner, Container, Row, Col, Card } from "react-bootstrap";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import API_BASE_URL from "./config/api";
import "./OTPVerification.css";

const OTPVerification = () => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
  const navigate = useNavigate();
  const location = useLocation();
  
  const { userId, email } = location.state || {};

  useEffect(() => {
    // Redirect if no user data
    if (!userId || !email) {
      toast.error("Invalid access. Please login again.");
      navigate("/");
      return;
    }

    // Countdown timer
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
  }, [userId, email, navigate]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
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
      const response = await axios.post(`${API_BASE_URL}/verify-otp`, {
        userId,
        otp: otpString,
      });

      toast.success(response.data.message || "OTP verified successfully!");
      
      // Store user data
      localStorage.setItem("user", JSON.stringify(response.data.user));

      // Navigate based on role
      const role = response.data.user.role;
      const roleRoutes = {
        FullAdmin: "/admin",
        MaleAdmin: "/male-admin",
        FemaleAdmin: "/female-admin",
        FullStaff: "/staff",
        MaleStaff: "/male-staff",
        FemaleStaff: "/female-staff",
      };

      setTimeout(() => {
        navigate(roleRoutes[role] || "/");
      }, 1000);
    } catch (error) {
      console.error("OTP verification error:", error);
      toast.error(
        error.response?.data?.message || "OTP verification failed. Please try again."
      );
      // Clear OTP on error
      setOtp(["", "", "", "", "", ""]);
      document.getElementById("otp-0").focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsResending(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/resend-otp`, { userId });
      toast.success(response.data.message || "OTP resent successfully!");
      setCountdown(600); // Reset countdown
      setOtp(["", "", "", "", "", ""]); // Clear current OTP
      document.getElementById("otp-0").focus();
    } catch (error) {
      console.error("Resend OTP error:", error);
      toast.error(
        error.response?.data?.message || "Failed to resend OTP. Please try again."
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="otp-verification-page">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      
      <Container>
        <Row className="justify-content-center align-items-center min-vh-100">
          <Col md={6} lg={5}>
            <Card className="otp-card shadow-lg">
              <Card.Body className="p-5">
                <div className="text-center mb-4">
                  <div className="otp-icon mb-3">
                    <i className="bi bi-shield-lock" style={{ fontSize: "3rem", color: "#007bff" }}></i>
                  </div>
                  <h2 className="mb-2">OTP Verification</h2>
                  <p className="text-muted">
                    We've sent a 6-digit code to<br />
                    <strong>{email}</strong>
                  </p>
                </div>

                <Form onSubmit={handleVerifyOTP}>
                  <div className="otp-input-container mb-4">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        maxLength="1"
                        className="otp-input"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        disabled={isLoading}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  <div className="text-center mb-3">
                    <div className="countdown-timer mb-2">
                      {countdown > 0 ? (
                        <span>
                          Time remaining: <strong>{formatTime(countdown)}</strong>
                        </span>
                      ) : (
                        <span className="text-danger">OTP expired</span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    type="submit"
                    className="w-100 mb-3"
                    disabled={isLoading || countdown === 0}
                  >
                    {isLoading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Verifying...
                      </>
                    ) : (
                      "Verify OTP"
                    )}
                  </Button>

                  <div className="text-center">
                    <p className="mb-2">Didn't receive the code?</p>
                    <Button
                      variant="link"
                      onClick={handleResendOTP}
                      disabled={isResending || countdown > 540} // Allow resend after 1 minute
                      className="p-0"
                    >
                      {isResending ? "Resending..." : "Resend OTP"}
                    </Button>
                  </div>

                  <div className="text-center mt-3">
                    <Button
                      variant="link"
                      onClick={() => navigate("/")}
                      className="text-muted"
                    >
                      Back to Login
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default OTPVerification;
