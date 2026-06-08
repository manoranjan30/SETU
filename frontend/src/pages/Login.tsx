import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { KeyRound, Lock, Mail, User } from "lucide-react";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPasswordChangeMode, setIsPasswordChangeMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [tempProfile, setTempProfile] = useState<any>(null);
  const [otpChallenge, setOtpChallenge] = useState<any>(null);
  const [otp, setOtp] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const response = await api.post("/auth/login", { username, password });
      if (response.data?.otpRequired) {
        setOtpChallenge(response.data);
        setOtp("");
        return;
      }

      await completeLogin(response.data.access_token);
    } catch (err: any) {
      console.error("Login Failed:", err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError("Invalid credentials");
      }
    }
  };

  const completeLogin = async (token: string) => {
    const profileRes = await api.get("/auth/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (profileRes.data.isFirstLogin) {
      setTempToken(token);
      setTempProfile(profileRes.data);
      setIsPasswordChangeMode(true);
    } else {
      login(token, profileRes.data);
      navigate("/dashboard");
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const response = await api.post("/auth/login/verify-otp", {
        challengeId: otpChallenge?.challengeId,
        otp,
      });
      await completeLogin(response.data.access_token);
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      await api.put(
        "/users/me/password",
        {
          oldPassword: password,
          newPassword: newPassword,
        },
        {
          headers: { Authorization: `Bearer ${tempToken}` },
        },
      );
      // Proceed to login
      login(tempToken as string, { ...tempProfile, isFirstLogin: false });
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update password");
    }
  };

  if (isPasswordChangeMode) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-raised">
        <div className="px-8 py-6 mt-4 text-left bg-surface-card shadow-lg rounded-lg w-96">
          <h3 className="text-2xl font-bold text-center text-gray-800">
            Change Temporary Password
          </h3>
          <p className="text-sm text-text-muted mt-2 text-center">
            For security, please set a new password before continuing.
          </p>
          <form onSubmit={handlePasswordChange}>
            <div className="mt-4 space-y-4">
              <div className="flex items-center border-2 py-2 px-3 rounded-2xl">
                <Lock className="h-5 w-5 text-text-disabled" />
                <input
                  className="pl-2 outline-none border-none w-full"
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center border-2 py-2 px-3 rounded-2xl">
                <Lock className="h-5 w-5 text-text-disabled" />
                <input
                  className="pl-2 outline-none border-none w-full"
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            {error && <div className="text-error text-sm mt-2">{error}</div>}
            <div className="flex items-baseline justify-between mt-6">
              <button className="px-6 py-2 mt-4 text-white bg-secondary rounded-lg hover:bg-secondary-dark w-full font-bold">
                Update & Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (otpChallenge) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-raised">
        <div className="px-8 py-6 mt-4 text-left bg-surface-card shadow-lg rounded-lg w-96">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-info-muted text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <h3 className="text-2xl font-bold text-center text-gray-800">
            Verify Email OTP
          </h3>
          <p className="text-sm text-text-muted mt-2 text-center">
            Enter the OTP sent to {otpChallenge.destinationMasked}. It is valid
            for {Math.round((otpChallenge.expiresInSeconds || 300) / 60)} minutes.
          </p>
          <form onSubmit={handleOtpSubmit}>
            <div className="mt-5 flex items-center border-2 py-2 px-3 rounded-2xl">
              <KeyRound className="h-5 w-5 text-text-disabled" />
              <input
                className="pl-2 outline-none border-none w-full text-center tracking-[0.35em] font-mono"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
              />
            </div>
            {error && <div className="text-error text-sm mt-2">{error}</div>}
            <button className="px-6 py-2 mt-6 text-white bg-primary rounded-lg hover:bg-blue-900 w-full font-bold">
              Verify & Continue
            </button>
            <button
              type="button"
              onClick={() => {
                setOtpChallenge(null);
                setOtp("");
                setError("");
              }}
              className="mt-3 w-full text-sm font-medium text-text-muted hover:text-text-primary"
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-raised">
      <div className="px-8 py-6 mt-4 text-left bg-surface-card shadow-lg rounded-lg w-96">
        <h3 className="text-2xl font-bold text-center text-gray-800">
          Login to SETU
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="mt-4">
            <div className="flex items-center border-2 py-2 px-3 rounded-2xl mb-4">
              <User className="h-5 w-5 text-text-disabled" />
              <input
                className="pl-2 outline-none border-none w-full"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="flex items-center border-2 py-2 px-3 rounded-2xl">
              <Lock className="h-5 w-5 text-text-disabled" />
              <input
                className="pl-2 outline-none border-none w-full"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          {error && <div className="text-error text-sm mt-2">{error}</div>}
          <div className="flex items-baseline justify-between mt-6">
            <button className="px-6 py-2 mt-4 text-white bg-primary rounded-lg hover:bg-blue-900 w-full font-bold">
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
