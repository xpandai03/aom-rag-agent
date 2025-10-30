"use client";

import { X, Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UploadResult {
  success: boolean;
  file: {
    name: string;
    type: string;
    size: number;
    source: string;
  };
  stats: {
    articlesProcessed: number;
    chunksGenerated: number;
    vectorsUpserted: number;
    totalTokens: number;
    estimatedCost: number;
    durationSeconds: number;
  };
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [password, setPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset upload state when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setSelectedFile(null);
      setUploadResult(null);
      setUploadError("");
    }
  }, [isAuthenticated]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setError("");

    try {
      const response = await fetch("/api/validate-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsAuthenticated(true);
        setError("");
      } else {
        setError(data.error || "Invalid password");
        setPassword(""); // Clear password on error
      }
    } catch (err) {
      setError("Connection error. Please try again.");
      console.error("Password validation error:", err);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.name.endsWith(".csv")) {
      setUploadError("Only CSV files are supported");
      return;
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File size must be less than 50MB");
      return;
    }

    setSelectedFile(file);
    setUploadError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("source", "manual");

      const response = await fetch("/api/ingest/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadResult(data);
      } else {
        setUploadError(data.error || "Upload failed");
      }
    } catch (err) {
      setUploadError("Connection error. Please try again.");
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setUploadError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cream bg-opacity-90 backdrop-blur-md">
      {/* Modal Container */}
      <div className="relative bg-soft-white border-2 border-border-beige rounded-lg editorial-shadow p-8 max-w-md w-full mx-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-foreground hover:text-accent-red transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Upload Screen - After Authentication */}
        {isAuthenticated ? (
          uploadResult ? (
            // Success Result Screen
            <div className="py-6">
              <div className="text-center mb-6">
                <CheckCircle2 className="w-16 h-16 mx-auto text-accent-red mb-3" />
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                  Upload Successful
                </h2>
                <p className="text-foreground font-body text-sm">
                  {uploadResult.file.name}
                </p>
              </div>

              {/* Stats Display */}
              <div className="bg-light-beige border border-border-beige rounded-lg p-4 space-y-2 mb-6">
                <div className="flex justify-between text-sm font-body">
                  <span className="text-foreground/70">Articles Processed:</span>
                  <span className="font-semibold text-foreground">{uploadResult.stats.articlesProcessed}</span>
                </div>
                <div className="flex justify-between text-sm font-body">
                  <span className="text-foreground/70">Chunks Generated:</span>
                  <span className="font-semibold text-foreground">{uploadResult.stats.chunksGenerated}</span>
                </div>
                <div className="flex justify-between text-sm font-body">
                  <span className="text-foreground/70">Vectors Added:</span>
                  <span className="font-semibold text-foreground">{uploadResult.stats.vectorsUpserted}</span>
                </div>
                <div className="flex justify-between text-sm font-body">
                  <span className="text-foreground/70">Duration:</span>
                  <span className="font-semibold text-foreground">{uploadResult.stats.durationSeconds.toFixed(2)}s</span>
                </div>
                <div className="flex justify-between text-sm font-body">
                  <span className="text-foreground/70">Cost:</span>
                  <span className="font-semibold text-foreground">${uploadResult.stats.estimatedCost.toFixed(6)}</span>
                </div>
              </div>

              <button
                onClick={resetUpload}
                className="w-full px-4 py-3 bg-accent-red text-soft-white rounded-md
                         hover:bg-dark-red transition-colors editorial-shadow font-body font-medium"
              >
                Upload Another File
              </button>
            </div>
          ) : (
            // Upload File Screen
            <div className="py-2">
              <div className="mb-6">
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                  Upload Content
                </h2>
                <p className="text-foreground text-sm font-body">
                  Upload a CSV file to add content to the knowledge base
                </p>
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                           transition-colors ${
                             isDragging
                               ? "border-accent-red bg-accent-red/5"
                               : "border-border-beige hover:border-accent-red hover:bg-light-beige"
                           }`}
              >
                <Upload className="w-12 h-12 mx-auto mb-3 text-foreground/40" />
                <p className="text-foreground font-body mb-1">
                  {selectedFile ? selectedFile.name : "Drop CSV file here or click to browse"}
                </p>
                <p className="text-xs text-foreground/60 font-body">
                  Maximum file size: 50MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {/* Error Message */}
              {uploadError && (
                <div className="mt-4 p-3 bg-accent-red/10 border border-accent-red rounded-md flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-accent-red font-body">{uploadError}</p>
                </div>
              )}

              {/* Selected File Info */}
              {selectedFile && !uploadError && (
                <div className="mt-4 p-3 bg-light-beige border border-border-beige rounded-md flex items-center gap-3">
                  <FileText className="w-5 h-5 text-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground font-body truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-foreground/60 font-body">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="w-full mt-4 px-4 py-3 bg-accent-red text-soft-white rounded-md
                         hover:bg-dark-red transition-colors editorial-shadow
                         disabled:opacity-50 disabled:cursor-not-allowed font-body font-medium"
              >
                {isUploading ? "Uploading..." : "Upload File"}
              </button>
            </div>
          )
        ) : (
          <>
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                Upload New Content
              </h2>
              <p className="text-foreground text-sm font-body">
                Enter the admin password to continue
              </p>
            </div>

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground mb-2 font-body"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className={`w-full px-4 py-3 border-2 rounded-md
                         focus:outline-none bg-cream text-foreground font-body
                         ${error ? "border-accent-red focus:border-accent-red" : "border-border-beige focus:border-accent-red"}`}
              disabled={isAuthenticating}
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-accent-red font-medium font-body">
                {error}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!password || isAuthenticating}
            className="w-full px-4 py-3 bg-accent-red text-soft-white rounded-md
                       hover:bg-dark-red transition-colors editorial-shadow
                       disabled:opacity-50 disabled:cursor-not-allowed
                       font-medium font-body"
          >
            {isAuthenticating ? "Verifying..." : "Continue"}
          </button>
        </form>

            {/* Help Text */}
            <p className="mt-4 text-xs text-foreground/60 text-center font-body">
              This upload feature is restricted to authorized users only.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
