import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Button, Spinner, InputGroup } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();

  const toggleLoginForm = () => {
    setShowLoginForm(!showLoginForm);
    setErrorMessage("");
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const validateForm = () => {
    if (!email || !password) {
      setErrorMessage("Please fill in both fields.");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrorMessage("Please enter a valid email.");
      return false;
    }
    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!validateForm()) return;

    setIsLoading(true);

    // Default admin credentials
    const defaultAdmin = {
      email: "admin@gmail.com",
      password: "Admin_0",
      role: "FullAdmin",
      name: "System Admin",
      _id: "default-admin-id"
    };

    // Default staff credentials
    const defaultStaff = {
      email: "staff@gmail.com",
      password: "Staff_0",
      role: "FullStaff",
      name: "System Staff",
      _id: "default-staff-id"
    };

    // Check if it's the default admin
    if (email.toLowerCase() === defaultAdmin.email && password === defaultAdmin.password) {
      localStorage.setItem("user", JSON.stringify({
        email: defaultAdmin.email,
        role: defaultAdmin.role,
        name: defaultAdmin.name,
        _id: defaultAdmin._id
      }));

      toast.success(`Welcome, ${defaultAdmin.name}!`, {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        className: "custom-toast",
      });

      setTimeout(() => {
        navigate("/admin/dashboard");
      }, 2000);

      setIsLoading(false);
      return;
    }

    // Check if it's the default staff
    if (email.toLowerCase() === defaultStaff.email && password === defaultStaff.password) {
      localStorage.setItem("user", JSON.stringify({
        email: defaultStaff.email,
        role: defaultStaff.role,
        name: defaultStaff.name,
        _id: defaultStaff._id
      }));

      toast.success(`Welcome, ${defaultStaff.name}!`, {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        className: "custom-toast",
      });

      setTimeout(() => {
        navigate("/staff/dashboard");
      }, 2000);

      setIsLoading(false);
      return;
    }

    // If not default accounts, try backend login
    try {
      const response = await axios.post("http://localhost:5001/login", {
        email: email.toLowerCase(),
        password,
      });

      // Check if OTP verification is required
      if (response.data.requireOTP) {
        toast.info(response.data.message || "Please verify your OTP", {
          position: "top-center",
          autoClose: 2000,
        });
        
        setTimeout(() => {
          navigate("/verify-otp", {
            state: {
              userId: response.data.userId,
              email: response.data.email
            }
          });
        }, 1000);
        
        setIsLoading(false);
        return;
      }

      if (!response.data.user) {
        throw new Error("Invalid response from server");
      }

      const { user } = response.data;
      
      localStorage.setItem("user", JSON.stringify({
        email: user.email,
        role: user.role,
        name: user.name,
        _id: user._id,
        isActive: user.isActive // Store active status
      }));

      toast.success(`Welcome, ${user.name}!`, {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        className: "custom-toast",
      });

      setTimeout(() => {
        const roleRoutes = {
          'FullAdmin': '/admin/dashboard',
          'MaleAdmin': '/maleadmin/dashboard',
          'FemaleAdmin': '/femaleadmin/dashboard',
          'FullStaff': '/staff/dashboard',
          'MaleStaff': '/malestaff/dashboard',
          'FemaleStaff': '/femalestaff/dashboard'
        };

        const route = roleRoutes[user.role];
        if (route) {
          navigate(route);
        } else {
          console.warn('Unknown role, defaulting to staff dashboard');
          navigate('/staff/dashboard');
        }
      }, 2000);
    } catch (error) {
      console.error("Login error:", error.response || error);
      
      // IMPROVED ERROR HANDLING - More specific checks
      const errorMsg = error.response?.data?.message || "";
      
      if (errorMsg.includes("inactive") && !errorMsg.includes("Invalid credentials")) {
        // Specific inactive account message (not mixed with wrong password)
        toast.error("Your account is inactive. Please contact an administrator.");
      } else if (errorMsg.includes("Invalid credentials or account is inactive")) {
        // This could be either wrong password OR inactive account
        // We need to check which one it is by making a separate API call
        try {
          // Check if the user exists and is active
          const usersResponse = await axios.get("http://localhost:5001/users");
          const user = usersResponse.data.find(u => u.email === email.toLowerCase());
          
          if (user && !user.isActive) {
            toast.error("Your account is inactive. Please contact an administrator.");
          } else {
            toast.error("Invalid credentials. Please check your email and password.");
          }
        } catch (userCheckError) {
          // If we can't check user status, show generic message
          toast.error("Invalid credentials or account is inactive. Please contact administrator.");
        }
      } else {
        // Generic error
        toast.error(errorMsg || "Invalid credentials. Please try again.");
      }
    }

    setIsLoading(false);
  };

  return (
    <div
      className="login-page"
      style={{
        backgroundImage: `url('/img/background.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
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

      {/* Right side button */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 2,
        }}
      >
        <div
          style={{
            color: "white",
            cursor: "pointer",
            fontSize: "1.1rem",
            fontWeight: "bold",
            padding: "10px 20px",
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            borderRadius: "25px",
            backdropFilter: "blur(5px)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
          }}
          onClick={toggleLoginForm}
        >
          Login
        </div>
      </div>

      {/* Logo and Welcome text (hidden when login form is visible) */}
      {!showLoginForm && (
        <div
          style={{
            position: "relative",
            zIndex: 2,
            textAlign: "center",
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            padding: "40px",
            borderRadius: "15px",
            backdropFilter: "blur(10px)",
            maxWidth: "600px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          <img
            src="/img/logo.png"
            alt="Iligan Jail Logo"
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              marginBottom: "25px",
              border: "3px solid rgba(255, 255, 255, 0.8)",
            }}
          />
          <h1
            style={{
              color: "white",
              textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)",
              fontSize: "2.5rem",
              fontWeight: "bold",
              marginBottom: "10px",
              lineHeight: "1.3",
            }}
          >
            Lanao Del Norte District Jail
            <br />
            <span style={{
              fontSize: "3rem",
              color: "#000",
              textShadow: "2px 2px 4px rgba(255, 255, 255, 0.8)",
              fontWeight: "800",
              display: "block",
              marginTop: "5px"
            }}>
              REGION 10
            </span>
          </h1>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.9)",
              fontSize: "1.1rem",
              textShadow: "1px 1px 2px rgba(0, 0, 0, 0.5)",
              marginTop: "15px",
            }}
          >
            Visitor Management System
          </p>
        </div>
      )}

      {/* Login form */}
      {showLoginForm && (
        <div className="login-container" style={{ zIndex: 2 }}>
          <div 
            className="login-box"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              borderRadius: "12px",
              padding: "30px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              backdropFilter: "blur(10px)",
              maxWidth: "400px",
              width: "100%",
            }}
          >
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
              <h4 className="login-title" style={{ 
                color: "#2C3E50", 
                fontWeight: "600",
                marginBottom: "5px"
              }}>
                System Login
              </h4>
              <p style={{ 
                color: "#7F8C8D", 
                fontSize: "0.9rem",
                margin: 0
              }}>
                Enter your credentials to access the system
              </p>
            </div>

            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3" controlId="formEmail">
                <Form.Label style={{ color: "#2C3E50", fontWeight: "500" }}>Email</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  isInvalid={errorMessage && !email}
                  required
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #BDC3C7",
                    padding: "12px",
                    fontSize: "0.95rem"
                  }}
                />
              </Form.Group>

              <Form.Group className="mb-4" controlId="formPassword">
                <Form.Label style={{ color: "#2C3E50", fontWeight: "500" }}>Password</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    isInvalid={errorMessage && !password}
                    required
                    style={{
                      borderRadius: "8px 0 0 8px",
                      border: "1px solid #BDC3C7",
                      borderRight: "none",
                      padding: "12px",
                      fontSize: "0.95rem"
                    }}
                  />
                  <InputGroup.Text 
                    onClick={togglePasswordVisibility}
                    style={{
                      backgroundColor: "white",
                      border: "1px solid #BDC3C7",
                      borderLeft: "none",
                      borderRadius: "0 8px 8px 0",
                      cursor: "pointer",
                      padding: "12px",
                      color: "#7F8C8D"
                    }}
                  >
                    <i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'}`} style={{ fontSize: "1.2rem" }}></i>
                  </InputGroup.Text>
                </InputGroup>
              </Form.Group>

              {errorMessage && (
                <div className="alert alert-danger py-2" role="alert" style={{ fontSize: "0.9rem" }}>
                  {errorMessage}
                </div>
              )}

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
                  backgroundColor: "#34495E",
                  marginBottom: "15px"
                }}
              >
                {isLoading ? <Spinner animation="border" size="sm" /> : "Login"}
              </Button>

              {/* Forgot Password Link */}
              <div className="text-center mb-3">
                <Button
                  variant="link"
                  onClick={() => navigate("/forgot-password")}
                  style={{
                    color: "#3498DB",
                    textDecoration: "none",
                    fontSize: "0.9rem",
                    padding: "0"
                  }}
                >
                  Forgot Password?
                </Button>
              </div>

              {/* Default Credentials Info */}
              <div className="mt-4 p-3 rounded" style={{ backgroundColor: "rgba(52, 73, 94, 0.05)" }}>
                <small style={{ color: "#7F8C8D" }}>
                  <strong style={{ color: "#2C3E50" }}>Default Credentials:</strong><br/>
                  Admin: admin@gmail.com / Admin_0<br/>
                  Staff: staff@gmail.com / Staff_0
                </small>
              </div>
            </Form>
          </div>
        </div>
      )}

      <ToastContainer
        position="top-center"
        autoClose={2000}
        hideProgressBar
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        style={{ top: "20px", textAlign: "center" }}
      />
    </div>
  );
};

export default Login;