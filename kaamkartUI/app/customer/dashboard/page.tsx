"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, API_URL } from "@/lib/api";
import { SessionStorage } from "@/lib/session";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { getLocationFromPinCode } from "@/lib/indianLocationValidation";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Chatbot from "@/components/Chatbot";
import { logger } from "@/lib/logger";

interface Request {
  id: string;
  workerTypes: string[];
  workerTypeRequirements?: Array<{
    laborType: string;
    numberOfWorkers: number;
  }>;
  workType: string;
  numberOfWorkers: number;
  status: string;
  startDate?: string;
  endDate?: string;
  confirmedWorkers: any[];
  deployedWorkers: any[];
  location: {
    latitude: number;
    longitude: number;
    address: string;
    landmark?: string;
  };
  createdAt: string;
  completedAt?: string;
}

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  rating?: number;
  totalRatings?: number;
}

interface PostOfficeAddress {
  Name: string;
  District: string;
  State: string;
  Pincode: string;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"requests" | "concerns">(
    "requests"
  );
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showConcernModal, setShowConcernModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [selectedRequestForConcern, setSelectedRequestForConcern] =
    useState<Request | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [myConcerns, setMyConcerns] = useState<any[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ratedRequests, setRatedRequests] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConcerns, setIsLoadingConcerns] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExtendDateModal, setShowExtendDateModal] = useState(false);
  const [selectedWorkerForExtend, setSelectedWorkerForExtend] = useState<{
    requestId: string;
    workerId: string;
    workerName: string;
    currentEndDate: string;
  } | null>(null);
  const [newEndDate, setNewEndDate] = useState("");
  const [isExtending, setIsExtending] = useState(false);
  // Search and sort state for customer dashboard
  const [requestsSearch, setRequestsSearch] = useState("");
  const [requestsSortBy, setRequestsSortBy] = useState("date");
  const [requestsSortOrder, setRequestsSortOrder] = useState("desc");
  const [concernsSearch, setConcernsSearch] = useState("");
  const [concernsSortBy, setConcernsSortBy] = useState("date");
  const [concernsSortOrder, setConcernsSortOrder] = useState("desc");
  const [dataLoaded, setDataLoaded] = useState({
    requests: false,
    concerns: false,
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workerTypes, setLaborTypes] = useState<any[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [pinAddresses, setPinAddresses] = useState<PostOfficeAddress[]>([]);
  const formatPostOfficeAddress = (po: PostOfficeAddress): string => {
    return `${po.Name}, ${po.District}, ${po.District}, ${po.State}, ${po.Pincode}`;
  };
  const [formData, setFormData] = useState({
    workerTypeRequirements: [] as Array<{
      laborType: string;
      numberOfWorkers: number;
    }>,
    workType: "",
    startDate: "",
    endDate: "",
    location: {
      latitude: null as number | null,
      longitude: null as number | null,
      address: "",
      landmark: "",
      state: "",
      city: "",
      pinCode: "",
      area: "",
    },
  });
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    secondaryPhone: "",
    location: {
      latitude: 0,
      longitude: 0,
      address: "",
    },
  });
  const [ratingData, setRatingData] = useState({
    rating: 5,
    comment: "",
  });
  const [concernData, setConcernData] = useState({
    requestId: "",
    relatedToUserId: "",
    description: "",
    type: "OTHER" as
      | "WORK_QUALITY"
      | "PAYMENT_ISSUE"
      | "BEHAVIOR"
      | "SAFETY"
      | "OTHER",
  });
  const [isSubmittingConcern, setIsSubmittingConcern] = useState(false);
  const [isUpdatingConcernStatus, setIsUpdatingConcernStatus] = useState(false);
  const [editingConcern, setEditingConcern] = useState<{
    id: string;
    status: string;
    message: string;
  } | null>(null);
  const [concernMessages, setConcernMessages] = useState<{
    [key: string]: any[];
  }>({});
  const [isLoadingMessages, setIsLoadingMessages] = useState<{
    [key: string]: boolean;
  }>({});
  // Removed nearest cities modal state - no longer needed
  const [userMessage, setUserMessage] = useState("");
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);

  // Auto-logout after 30 minutes of inactivity
  useAutoLogout();

  useEffect(() => {
    const token = SessionStorage.getToken();
    const userData = SessionStorage.getUser();

    if (!token || !userData) {
      router.push("/");
      return;
    }

    const userObj = userData as User;
    setUser(userObj);
    fetchRequests();
    fetchProfile();
    fetchLaborTypes();

    // Check if coming from chatbot with pre-filled data
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const action = urlParams.get("action");

      if (action === "createRequest") {
        const chatbotData = sessionStorage.getItem("chatbotRequestData");
        if (chatbotData) {
          try {
            const data = JSON.parse(chatbotData);
            // Pre-fill form with chatbot data
            setFormData((prev) => ({
              ...prev,
              workType: data.workType || prev.workType,
              workerTypeRequirements: data.workerTypes
                ? data.workerTypes.map((type: string) => ({
                    laborType: type.toUpperCase(),
                    numberOfWorkers: 1,
                  }))
                : prev.workerTypeRequirements,
              startDate: data.startDate || prev.startDate,
              endDate: data.endDate || prev.endDate,
              location: {
                ...prev.location,
                address: data.location || data.address || prev.location.address,
                landmark: data.landmark || prev.location.landmark,
                area: data.area || prev.location.area,
                state: data.state || prev.location.state,
                city: data.city || prev.location.city,
                pinCode: data.pinCode || prev.location.pinCode,
                latitude: data.useCurrentLocation ? prev.location.latitude : 0,
                longitude: data.useCurrentLocation
                  ? prev.location.longitude
                  : 0,
              },
            }));
            // Show request form
            setShowRequestForm(true);
            toast.success(
              t("customer.chatbotDataLoaded") ||
                "Request details loaded from chat!"
            );
            // Clear chatbot data
            sessionStorage.removeItem("chatbotRequestData");
            // Remove action from URL
            window.history.replaceState({}, "", "/customer/dashboard");
          } catch (error) {
            logger.error("Error parsing chatbot data:", error);
          }
        }
      } else if (action === "raiseConcern") {
        const chatbotData = sessionStorage.getItem("chatbotConcernData");
        if (chatbotData) {
          try {
            const data = JSON.parse(chatbotData);
            setConcernData({
              ...concernData,
              type: data.type || "OTHER",
              description: data.description || "",
            });
            setShowConcernModal(true);
            toast.success(
              t("customer.chatbotConcernLoaded") ||
                "Concern details loaded from chat!"
            );
            sessionStorage.removeItem("chatbotConcernData");
            window.history.replaceState({}, "", "/customer/dashboard");
          } catch (error) {
            logger.error("Error parsing chatbot concern data:", error);
          }
        }
      }
    }
    // Location will only be detected when user clicks "Detect Current Location" button
  }, []);

  const fetchLaborTypes = async () => {
    try {
      const response = await apiClient.get("/public/worker-types");
      setLaborTypes(response.data);
    } catch (error) {
      logger.error("Error fetching labor types:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "concerns") {
      fetchMyConcerns();
    }
  }, [activeTab]);

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get("/profile");
      setProfile(response.data);
      setProfileData({
        name: response.data.name,
        email: response.data.email,
        phone: response.data.phone,
        secondaryPhone: response.data.secondaryPhone || "",
        location: response.data.location || {
          latitude: 0,
          longitude: 0,
          address: "",
        },
      });
    } catch (error) {
      logger.error("Error fetching profile:", error);
    }
  };

  // Reverse geocode coordinates to get address, state, and city
  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      // Using OpenStreetMap Nominatim API (free, no API key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          headers: {
            "User-Agent": "KaamKart-App", // Required by Nominatim
          },
        }
      );
      const data = await response.json();

      if (data && data.address) {
        const address = data.address;
        let state = address.state || address.region || address.province || "";
        let city =
          address.city ||
          address.town ||
          address.village ||
          address.county ||
          address.district ||
          "";
        const pinCode = address.postcode || "";
        const fullAddress = data.display_name || "";

        // Just set the detected location without validation
        setFormData({
          ...formData,
          location: {
            ...formData.location,
            latitude,
            longitude,
            state: state,
            city: city,
            pinCode: pinCode,
            address: fullAddress,
          },
        });

        if (state && city) {
          toast.success(
            t("customer.locationDetected") || "Location detected successfully!"
          );
        }
      }
    } catch (error) {
      logger.error("Reverse geocoding error:", error);
      // Still set coordinates even if reverse geocoding fails
      setFormData({
        ...formData,
        location: {
          ...formData.location,
          latitude,
          longitude,
        },
      });
    }
  };

  // Removed local function - using library function that returns address too

  const getLocation = () => {
    if (navigator.geolocation) {
      toast.loading(
        t("customer.gettingLocation") || "Getting your location..."
      );
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          // Set coordinates first
          setFormData({
            ...formData,
            location: {
              ...formData.location,
              latitude: lat,
              longitude: lon,
            },
          });

          // Then reverse geocode to get state, city, and pin code
          await reverseGeocode(lat, lon);
          toast.dismiss();
        },
        () => {
          toast.dismiss();
          toast.error(
            t("customer.geolocationError") ||
              "Geolocation is not supported or permission denied. Please fill in address fields."
          );
        }
      );
    } else {
      toast.error(
        t("customer.geolocationNotSupported") ||
          "Geolocation is not supported by your browser. Please fill in address fields."
      );
    }
  };

  const clearLocation = () => {
    setFormData({
      ...formData,
      location: {
        ...formData.location,
        latitude: 0,
        longitude: 0,
        address: formData.location.address, // Keep the address if user entered it
      },
    });
  };

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const token = SessionStorage.getToken();
      if (!token) {
        toast.error(t("common.error"));
        router.push("/login");
        setDataLoaded((prev) => ({ ...prev, requests: true }));
        return;
      }

      try {
        await apiClient.get("/auth/health", { timeout: 5000 });
      } catch (healthError: any) {
        if (
          healthError.code === "ECONNREFUSED" ||
          healthError.code === "ERR_NETWORK"
        ) {
          toast.error(
            "Cannot connect to server. Please check if API is running on port 8585."
          );
        }
        setDataLoaded((prev) => ({ ...prev, requests: true }));
        return;
      }

      const response = await apiClient.get("/requests/my-requests", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });
      setRequests(response.data);

      // Check which completed requests have been rated
      const ratedSet = new Set<string>();
      for (const request of response.data) {
        if (request.status === "COMPLETED") {
          try {
            const ratingCheck = await apiClient.get(
              `/ratings/check/${request.id}`,
              {}
            );
            if (ratingCheck.data.hasRated) {
              ratedSet.add(request.id);
            }
          } catch (error) {
            // Ignore errors for rating check
            logger.error("Error checking rating:", error);
          }
        }
      }
      setRatedRequests(ratedSet);
      setDataLoaded((prev) => ({ ...prev, requests: true }));
    } catch (error: any) {
      if (
        error.code === "ERR_NETWORK" ||
        error.code === "ECONNREFUSED" ||
        !error.response
      ) {
        toast.error(
          "Cannot connect to server. Please check if API is running on port 8585."
        );
      } else if (
        error.response?.status === 401 ||
        error.response?.status === 403
      ) {
        toast.error("Session expired. Please login again.");
        setDataLoaded((prev) => ({ ...prev, requests: true }));
        SessionStorage.clear();
        router.push("/login");
      } else {
        toast.error(
          error.response?.data?.message || "Failed to fetch requests"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.workerTypeRequirements.length === 0) {
      toast.error(t("customer.addRequirement"));
      return;
    }

    // Validate all requirements have labor type selected
    console.log(
      "Form data before validation:",
      formData.workerTypeRequirements
    );
    const invalidRequirements = formData.workerTypeRequirements.filter(
      (req, idx) => {
        const isEmpty =
          !req.laborType ||
          req.laborType === "" ||
          req.laborType.trim() === "" ||
          req.laborType === "Select Worker Type";
        if (isEmpty) {
          logger.log(`Requirement ${idx + 1} is invalid:`, req);
        }
        return isEmpty;
      }
    );

    if (invalidRequirements.length > 0) {
      const invalidIndices = invalidRequirements.map((_, idx) => {
        const actualIdx = formData.workerTypeRequirements.findIndex(
          (r) => r === invalidRequirements[idx]
        );
        return actualIdx + 1;
      });
      toast.error(t("customer.selectWorkerType"));
      return;
    }

    // Validate all requirements have number of workers > 0
    const invalidWorkerCounts = formData.workerTypeRequirements.filter(
      (req) =>
        !req.numberOfWorkers ||
        req.numberOfWorkers < 1 ||
        isNaN(req.numberOfWorkers)
    );
    if (invalidWorkerCounts.length > 0) {
      toast.error(t("customer.numberOfWorkers"));
      return;
    }

    // Validate dates only if provided (dates are optional)
    if (formData.startDate && formData.endDate) {
      if (new Date(formData.endDate) < new Date(formData.startDate)) {
        toast.error("End date must be after start date");
        return;
      }
    } else if (formData.startDate && !formData.endDate) {
      toast.error("Please select end date if start date is provided");
      return;
    } else if (!formData.startDate && formData.endDate) {
      toast.error("Please select start date if end date is provided");
      return;
    }

    // Validate location: either current location (lat/long) OR pin code required
    const hasCurrentLocation =
      formData.location.latitude !== 0 && formData.location.longitude !== 0;
    const hasPinCode =
      formData.location.pinCode &&
      formData.location.pinCode.trim().length === 6;

    if (!hasCurrentLocation && !hasPinCode) {
      toast.error(
        t("customer.locationRequired") ||
          "Please either use current location or enter Pin Code"
      );
      return;
    }

    // If using pin code (not GPS), validate pin code and ensure state/city are detected
    if (!hasCurrentLocation && hasPinCode) {
      // Validate pin code format
      const pinCodeRegex = /^\d{6}$/;
      if (!pinCodeRegex.test(formData.location.pinCode.trim())) {
        toast.error(
          t("customer.invalidPinCode") || "Pin Code must be exactly 6 digits"
        );
        return;
      }

      // Ensure state and city are detected from pin code
      if (!formData.location.state || !formData.location.city) {
        toast.error(
          t("customer.stateCityNotDetected") ||
            "State and City could not be detected from Pin Code. Please enter a valid 6-digit pin code."
        );
        return;
      }
    }

    // Basic format validation only (no list validation)
    if (formData.location.state || formData.location.city) {
      // Validate State format if present
      if (formData.location.state) {
        const stateRegex = /^[a-zA-Z\s'\-\.]+$/;
        const stateValue = formData.location.state.trim();
        if (!stateRegex.test(stateValue)) {
          toast.error(
            t("customer.invalidState") ||
              "State should contain only letters, spaces, hyphens, and apostrophes"
          );
          return;
        }
        if (stateValue.length < 2) {
          toast.error(
            t("customer.stateMinLength") ||
              "State must be at least 2 characters long"
          );
          return;
        }
      }

      // Validate City format if present
      if (formData.location.city) {
        const cityRegex = /^[a-zA-Z\s'\-\.]+$/;
        const cityValue = formData.location.city.trim();
        if (!cityRegex.test(cityValue)) {
          toast.error(
            t("customer.invalidCity") ||
              "City should contain only letters, spaces, hyphens, and apostrophes"
          );
          return;
        }
        if (cityValue.length < 2) {
          toast.error(
            t("customer.cityMinLength") ||
              "City must be at least 2 characters long"
          );
          return;
        }
      }

      // Validate Pin Code format if present
      if (formData.location.pinCode) {
        const pinCodeRegex = /^\d{6}$/;
        if (!pinCodeRegex.test(formData.location.pinCode.trim())) {
          toast.error(
            t("customer.invalidPinCode") || "Pin Code must be exactly 6 digits"
          );
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const token = SessionStorage.getToken();
      const requestData = {
        workerTypeRequirements: formData.workerTypeRequirements.map((req) => ({
          workerType: req.laborType.toUpperCase(), // Backend expects 'workerType', not 'laborType'
          numberOfWorkers: req.numberOfWorkers,
        })),
        workType: formData.workType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        location: {
          latitude: formData.location.latitude,
          longitude: formData.location.longitude,
          address: formData.location.address,
          landmark: formData.location.landmark || null,
          state: formData.location.state || null,
          city: formData.location.city || null,
          pinCode: formData.location.pinCode || null,
          area: formData.location.area || null,
        },
      };
      logger.log("Sending request data:", JSON.stringify(requestData, null, 2));
      const response = await apiClient.post("/requests", requestData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      logger.log("Request created successfully:", response.data);
      toast.success(t("customer.requestCreated"));
      setShowRequestForm(false);
      setFormData({
        workerTypeRequirements: [],
        workType: "",
        startDate: "",
        endDate: "",
        location: {
          latitude: 0,
          longitude: 0,
          address: "",
          landmark: "",
          state: "",
          city: "",
          pinCode: "",
          area: "",
        },
      });
      fetchRequests();
    } catch (error: any) {
      logger.error("Error creating request:", error);
      logger.error("Error response:", error.response);
      logger.error("Error response data:", error.response?.data);

      let errorMessage = "Failed to create request";

      if (error.response?.data) {
        // Handle validation errors
        if (error.response.data.errors) {
          const errors = error.response.data.errors;
          errorMessage = Object.entries(errors)
            .map(([field, msg]) => `${field}: ${msg}`)
            .join(", ");
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const token = SessionStorage.getToken();
      const response = await apiClient.put("/profile", profileData, {});
      toast.success(t("customer.profileUpdated"));
      setShowProfileModal(false);
      fetchProfile();
      // Update user in localStorage
      const updatedUser = { ...user, ...response.data.user };
      SessionStorage.setUser(updatedUser);
      setUser(updatedUser);
    } catch (error: any) {
      toast.error(error.response?.data?.message || t("customer.profileError"));
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleCompleteRequest = async (requestId: string) => {
    try {
      const token = SessionStorage.getToken();
      await apiClient.post(`/requests/${requestId}/complete`, {}, {});
      toast.success(t("dashboard.completed"));
      fetchRequests();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to complete request"
      );
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setIsSubmittingRating(true);
    try {
      const token = SessionStorage.getToken();
      const deployedWorkers = selectedRequest.deployedWorkers || [];

      // Rate each deployed worker
      for (const dw of deployedWorkers) {
        const workerId = dw.worker?.id || dw.workerId;
        if (workerId) {
          await apiClient.post(
            "/ratings",
            {
              requestId: selectedRequest.id,
              ratedUserId: workerId,
              rating: ratingData.rating,
              comment: ratingData.comment,
            },
            {}
          );
        }
      }

      toast.success("Rating submitted successfully!");
      setShowRatingModal(false);
      if (selectedRequest) {
        setRatedRequests(
          new Set(Array.from(ratedRequests).concat(selectedRequest.id))
        );
      }
      setSelectedRequest(null);
      setRatingData({ rating: 5, comment: "" });
      fetchRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to submit rating");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleSubmitConcern = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate description is not blank
    if (!concernData.description || !concernData.description.trim()) {
      toast.error(
        t("customer.concernDescriptionRequired") ||
          "Please enter a description for your concern"
      );
      return;
    }

    setIsSubmittingConcern(true);
    try {
      const token = SessionStorage.getToken();
      const data: any = {
        description: concernData.description.trim(),
        type: concernData.type,
      };

      if (concernData.requestId) {
        data.requestId = parseInt(concernData.requestId);
      }

      if (concernData.relatedToUserId) {
        data.relatedToUserId = parseInt(concernData.relatedToUserId);
      }

      await apiClient.post("/concerns", data, {});

      toast.success("Concern submitted successfully! Admin will review it.");
      setShowConcernModal(false);
      setSelectedRequestForConcern(null);
      setConcernData({
        requestId: "",
        relatedToUserId: "",
        description: "",
        type: "OTHER",
      });
      // Refresh concerns list if on concerns tab
      if (activeTab === "concerns") {
        fetchMyConcerns();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t("customer.concernError"));
    } finally {
      setIsSubmittingConcern(false);
    }
  };

  const fetchMyConcerns = async () => {
    setIsLoadingConcerns(true);
    try {
      const token = SessionStorage.getToken();
      const response = await apiClient.get("/concerns/my-concerns", {});
      setMyConcerns(response.data);
      setDataLoaded((prev) => ({ ...prev, concerns: true }));
      // Fetch messages for all concerns
      response.data.forEach((concern: any) => {
        fetchConcernMessages(concern.id);
      });
    } catch (error) {
      logger.error("Error fetching concerns:", error);
      toast.error(t("customer.error"));
      setDataLoaded((prev) => ({ ...prev, concerns: true }));
    } finally {
      setIsLoadingConcerns(false);
    }
  };

  const fetchConcernMessages = async (concernId: string) => {
    setIsLoadingMessages({ ...isLoadingMessages, [concernId]: true });
    try {
      const token = SessionStorage.getToken();
      const response = await apiClient.get(
        `/concerns/${concernId}/messages`,
        {}
      );
      setConcernMessages({ ...concernMessages, [concernId]: response.data });
    } catch (error) {
      logger.error("Error fetching messages:", error);
    } finally {
      setIsLoadingMessages({ ...isLoadingMessages, [concernId]: false });
    }
  };

  const handleLogout = () => {
    SessionStorage.clear();
    router.push("/");
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: {
      [key: string]: { bg: string; text: string; icon: string };
    } = {
      PENDING: { bg: "bg-gray-100", text: "text-gray-800", icon: "⏳" },
      PENDING_ADMIN_APPROVAL: {
        bg: "bg-orange-100",
        text: "text-orange-800",
        icon: "📝",
      },
      ADMIN_APPROVED: { bg: "bg-blue-100", text: "text-blue-800", icon: "👍" },
      NOTIFIED: { bg: "bg-yellow-100", text: "text-yellow-800", icon: "🔔" },
      CONFIRMED: { bg: "bg-indigo-100", text: "text-indigo-800", icon: "✅" },
      DEPLOYED: { bg: "bg-green-100", text: "text-green-800", icon: "🚀" },
      COMPLETED: { bg: "bg-purple-100", text: "text-purple-800", icon: "🎉" },
      CANCELLED: { bg: "bg-red-100", text: "text-red-800", icon: "❌" },
      REJECTED: { bg: "bg-red-100", text: "text-red-800", icon: "🚫" },
    };
    const config = statusConfig[status] || statusConfig["PENDING"];
    const statusKey = `status${status.toLowerCase().replace(/_/g, "")}`;
    const statusText = t(`customer.${statusKey}`) || status.replace(/_/g, " ");
    return (
      <span
        className={`px-4 py-2 rounded-full text-sm font-medium ${config.bg} ${config.text} flex items-center gap-2`}
        lang={language}
      >
        <span>{config.icon}</span>
        {statusText}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <nav className="bg-white/90 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 md:h-16 items-center">
            <Link
              href="/"
              className="text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent hover:scale-105 transition-transform truncate"
            >
              KaamKart
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-4">
              <LanguageSwitcher />
              <button
                onClick={() => setShowProfileModal(true)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200 flex items-center gap-2"
                lang={language}
              >
                <span>⚙️</span>
                {t("customer.profile")}
              </button>
              <button
                onClick={() => {
                  setSelectedRequestForConcern(null);
                  setShowConcernModal(true);
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 flex items-center gap-2"
                lang={language}
              >
                <span>📢</span>
                {t("customer.raiseConcern")}
              </button>
              <div className="flex items-center gap-3 bg-primary-50 px-4 py-2 rounded-full">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">👤</span>
                  <span className="text-gray-700 font-medium">
                    {user?.name}
                  </span>
                </div>
                {user?.rating !== undefined && user.rating > 0 && (
                  <div className="flex items-center gap-1 border-l border-primary-200 pl-3">
                    <span className="text-yellow-500 text-sm">⭐</span>
                    <span className="text-xs text-gray-700 font-semibold">
                      {user.rating.toFixed(1)}
                      {user.totalRatings && user.totalRatings > 0 && (
                        <span className="text-gray-500 ml-1">
                          ({user.totalRatings})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                lang={language}
              >
                {t("customer.logout")}
              </button>
            </div>

            {/* Mobile Navigation - Language Switcher and Hamburger */}
            <div className="lg:hidden flex items-center gap-2">
              <LanguageSwitcher />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200"
                aria-label="Toggle menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-gray-200 py-4 space-y-2 animate-slide-down">
              <div className="px-4 py-2">
                <LanguageSwitcher />
              </div>
              <button
                onClick={() => {
                  setShowProfileModal(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200 flex items-center gap-2"
              >
                <span>⚙️</span>
                {t("customer.profile")}
              </button>
              <button
                onClick={() => {
                  setSelectedRequestForConcern(null);
                  setShowConcernModal(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 flex items-center gap-2"
                lang={language}
              >
                <span>📢</span>
                {t("customer.raiseConcern")}
              </button>
              <div className="px-4 py-3 bg-primary-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-700">👤</span>
                  <span className="text-sm text-gray-700 font-medium">
                    {user?.name}
                  </span>
                </div>
                {user?.rating !== undefined && user.rating > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500 text-sm">⭐</span>
                    <span className="text-xs text-gray-700 font-semibold">
                      {user.rating.toFixed(1)}
                      {user.totalRatings && user.totalRatings > 0 && (
                        <span className="text-gray-500 ml-1">
                          ({user.totalRatings})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                lang={language}
              >
                {t("customer.logout")}
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex-1 min-w-0">
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 truncate"
              lang={language}
            >
              {t("customer.title")}
            </h2>
            <p
              className="text-sm sm:text-base text-gray-600 truncate"
              lang={language}
            >
              {t("dashboard.welcome")}
            </p>
          </div>
          {activeTab === "requests" && (
            <button
              onClick={() => setShowRequestForm(true)}
              className="w-full sm:w-auto flex-shrink-0 px-3 sm:px-4 md:px-6 py-2 sm:py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 transform flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base whitespace-nowrap"
              lang={language}
            >
              <span className="text-lg sm:text-xl">+</span>
              <span>{t("customer.createRequest")}</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max md:min-w-0">
            <button
              onClick={() => setActiveTab("requests")}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === "requests"
                  ? "bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              lang={language}
            >
              <span className="hidden sm:inline">📋 </span>
              {t("customer.myRequests")}
              {dataLoaded.requests && ` (${requests.length})`}
            </button>
            <button
              onClick={() => setActiveTab("concerns")}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === "concerns"
                  ? "bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              lang={language}
            >
              <span className="hidden sm:inline">📢 </span>
              {t("customer.concerns")}
              {dataLoaded.concerns &&
                ` (${
                  myConcerns.filter((c: any) => c.status === "PENDING").length >
                  0
                    ? myConcerns.filter((c: any) => c.status === "PENDING")
                        .length
                    : myConcerns.length
                })`}
            </button>
          </div>
        </div>

        {/* Request Form Modal */}
        {showRequestForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 w-full max-w-lg relative my-auto max-h-[95vh] overflow-y-auto">
              <h3
                className="text-2xl font-bold text-gray-900 mb-6"
                lang={language}
              >
                {t("customer.createRequest")}
              </h3>
              <button
                onClick={() => setShowRequestForm(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Section 1: Work Details */}
                <div className="border-b-2 border-gray-200 pb-4">
                  <h4
                    className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"
                    lang={language}
                  >
                    <span>📝</span> {t("customer.workDetails")}
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="workType"
                        className="block text-sm font-medium text-gray-700 mb-1"
                        lang={language}
                      >
                        {t("customer.workType")}{" "}
                        <span className="text-gray-400 text-xs">
                          ({t("customer.optional") || "Optional"})
                        </span>
                      </label>
                      <input
                        type="text"
                        id="workType"
                        value={formData.workType}
                        onChange={(e) =>
                          setFormData({ ...formData, workType: e.target.value })
                        }
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        placeholder={t("customer.workTypePlaceholder")}
                        lang={language}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Worker Requirements */}
                <div className="border-b-2 border-gray-200 pb-4">
                  <h4
                    className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"
                    lang={language}
                  >
                    <span>👷</span> {t("customer.workerRequirements")}{" "}
                    <span className="text-red-500">*</span>
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto p-3 border-2 border-gray-300 rounded-lg bg-gray-50">
                    {formData.workerTypeRequirements.map((req, index) => (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 p-3 bg-white rounded-lg border border-primary-200 shadow-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <label
                            className="block text-xs text-gray-600 mb-1 sm:hidden"
                            lang={language}
                          >
                            {t("customer.workerType")}
                          </label>
                          <select
                            value={req.laborType || ""}
                            onChange={(e) => {
                              const updated = [
                                ...formData.workerTypeRequirements,
                              ];
                              updated[index] = {
                                ...updated[index],
                                laborType: e.target.value,
                              };
                              setFormData({
                                ...formData,
                                workerTypeRequirements: updated,
                              });
                              console.log(
                                "Updated requirement:",
                                updated[index]
                              );
                            }}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base"
                            required
                            lang={language}
                          >
                            <option value="">
                              {t("customer.selectWorkerType")}
                            </option>
                            {workerTypes
                              .filter((lt) => lt.isActive)
                              .filter(
                                (lt) =>
                                  !formData.workerTypeRequirements.some(
                                    (r, i) =>
                                      i !== index && r.laborType === lt.name
                                  )
                              )
                              .sort(
                                (a, b) =>
                                  (a.displayOrder || 0) - (b.displayOrder || 0)
                              )
                              .map((type) => (
                                <option key={type.name} value={type.name}>
                                  {type.icon || "🔧"}{" "}
                                  {type.displayName || type.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="w-full sm:w-24 flex-shrink-0">
                          <label
                            className="block text-xs text-gray-600 mb-1 sm:hidden"
                            lang={language}
                          >
                            {t("customer.numberOfWorkers")}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="999"
                            step="1"
                            value={
                              req.numberOfWorkers > 0 ? req.numberOfWorkers : ""
                            }
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              // Allow empty string during typing - don't set to 1 immediately
                              if (inputValue === "") {
                                const updated = [
                                  ...formData.workerTypeRequirements,
                                ];
                                updated[index] = {
                                  ...updated[index],
                                  numberOfWorkers: 0, // Use 0 as placeholder, will be validated on blur
                                };
                                setFormData({
                                  ...formData,
                                  workerTypeRequirements: updated,
                                });
                                return;
                              }
                              const parsedValue = parseInt(inputValue, 10);
                              if (!isNaN(parsedValue)) {
                                const numValue = Math.max(
                                  1,
                                  Math.min(999, parsedValue)
                                );
                                const updated = [
                                  ...formData.workerTypeRequirements,
                                ];
                                updated[index] = {
                                  ...updated[index],
                                  numberOfWorkers: numValue,
                                };
                                setFormData({
                                  ...formData,
                                  workerTypeRequirements: updated,
                                });
                              }
                            }}
                            onBlur={(e) => {
                              // Ensure value is at least 1 on blur
                              const value = parseInt(e.target.value, 10);
                              if (isNaN(value) || value < 1) {
                                const updated = [
                                  ...formData.workerTypeRequirements,
                                ];
                                updated[index] = {
                                  ...updated[index],
                                  numberOfWorkers: 1,
                                };
                                setFormData({
                                  ...formData,
                                  workerTypeRequirements: updated,
                                });
                              }
                            }}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
                            style={{
                              WebkitAppearance: "textfield",
                              MozAppearance: "textfield",
                            }}
                            placeholder={t(
                              "customer.numberOfWorkersPlaceholder"
                            )}
                            required
                            lang={language}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated =
                              formData.workerTypeRequirements.filter(
                                (_, i) => i !== index
                              );
                            setFormData({
                              ...formData,
                              workerTypeRequirements: updated,
                            });
                          }}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm sm:text-base flex-shrink-0"
                          title={t("customer.removeRequirement")}
                          lang={language}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          workerTypeRequirements: [
                            ...formData.workerTypeRequirements,
                            { laborType: "", numberOfWorkers: 1 },
                          ],
                        });
                      }}
                      className="w-full px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors font-medium border-2 border-dashed border-primary-300"
                    >
                      + {t("customer.addRequirement")}
                    </button>
                  </div>
                  {formData.workerTypeRequirements.length === 0 && (
                    <p className="text-xs text-red-500 mt-2" lang={language}>
                      {t("customer.addRequirementError")}
                    </p>
                  )}
                  {formData.workerTypeRequirements.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p
                        className="text-sm text-blue-800 font-semibold"
                        lang={language}
                      >
                        {t("customer.totalWorkersRequired")}:{" "}
                        {formData.workerTypeRequirements.reduce(
                          (sum, req) => sum + (req.numberOfWorkers || 0),
                          0
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Section 3: Schedule */}
                <div className="border-b-2 border-gray-200 pb-4">
                  <h4
                    className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"
                    lang={language}
                  >
                    <span>📅</span> {t("customer.schedule")}{" "}
                    <span className="text-red-500">*</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="startDate"
                        className="block text-sm font-medium text-gray-700 mb-1"
                        lang={language}
                      >
                        {t("customer.startDate")}{" "}
                        <span className="text-gray-400 text-xs">
                          ({t("customer.optional") || "Optional"})
                        </span>
                      </label>
                      <input
                        type="date"
                        id="startDate"
                        value={formData.startDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startDate: e.target.value,
                          })
                        }
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="endDate"
                        className="block text-sm font-medium text-gray-700 mb-1"
                        lang={language}
                      >
                        {t("customer.endDate")}{" "}
                        <span className="text-gray-400 text-xs">
                          ({t("customer.optional") || "Optional"})
                        </span>
                      </label>
                      <input
                        type="date"
                        id="endDate"
                        value={formData.endDate}
                        min={
                          formData.startDate ||
                          new Date().toISOString().split("T")[0]
                        }
                        onChange={(e) =>
                          setFormData({ ...formData, endDate: e.target.value })
                        }
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      />
                    </div>
                  </div>
                  {formData.startDate &&
                    formData.endDate &&
                    new Date(formData.endDate) <
                      new Date(formData.startDate) && (
                      <p className="text-xs text-red-500 mt-2" lang={language}>
                        ⚠️ {t("customer.endDateError")}
                      </p>
                    )}
                  {formData.startDate &&
                    formData.endDate &&
                    new Date(formData.endDate) >=
                      new Date(formData.startDate) && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800" lang={language}>
                          <span className="font-semibold">
                            {t("customer.duration")}:
                          </span>{" "}
                          {Math.ceil(
                            (new Date(formData.endDate).getTime() -
                              new Date(formData.startDate).getTime()) /
                              (1000 * 60 * 60 * 24)
                          ) + 1}{" "}
                          {t("customer.days")}
                        </p>
                      </div>
                    )}
                </div>

                {/* Section 4: Location */}
                <div>
                  <h4
                    className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"
                    lang={language}
                  >
                    <span>📍</span> {t("customer.location")}{" "}
                    <span className="text-red-500">*</span>
                  </h4>

                  {/* Current Location Toggle Button */}
                  {/* <div className="mb-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={formData.location.latitude !== 0 && formData.location.longitude !== 0 ? clearLocation : getLocation}
                        className={`px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-2 text-sm ${
                          formData.location.latitude !== 0 && formData.location.longitude !== 0
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        <span>📍</span>
                        <span lang={language}>{formData.location.latitude !== 0 && formData.location.longitude !== 0 
                          ? t('customer.usingCurrentLocation') 
                          : t('customer.useCurrentLocation')}</span>
                      </button>
                      {formData.location.latitude !== 0 && formData.location.longitude !== 0 && (
                        <span className="text-xs text-green-600 font-medium" lang={language}>✓ {t('customer.locationDetected')}</span>
                      )}
                    </div>
                  </div> */}

                  {/* Location Details First */}
                  <div className="space-y-4">
                    {/* Only show location details if current location is NOT detected */}
                    {formData.location.latitude === 0 ||
                    formData.location.longitude === 0 ? (
                      <div>
                        <p
                          className="text-xs font-medium text-gray-700 mb-2"
                          lang={language}
                        >
                          {t("customer.addressDetails")}{" "}
                          <span className="text-red-500">*</span>
                        </p>
                        <div className="space-y-3">
                          {/* Pin Code First */}
                          <div>
                            <label
                              htmlFor="pinCode"
                              className="block text-xs font-medium text-gray-700 mb-1"
                              lang={language}
                            >
                              {t("customer.pinCode")}{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              id="pinCode"
                              required
                              value={formData.location.pinCode || ""}
                              onChange={async (e) => {
                                const value = e.target.value.replace(/\D/g, ""); // Only digits
                                if (value.length <= 6) {
                                  setFormData({
                                    ...formData,
                                    location: {
                                      ...formData.location,
                                      pinCode: value,
                                    },
                                  });

                                  const getUserCoordinates = (): Promise<{
                                    latitude: number;
                                    longitude: number;
                                  }> => {
                                    return new Promise((resolve, reject) => {
                                      if (!navigator.geolocation) {
                                        reject("Geolocation not supported");
                                        return;
                                      }

                                      navigator.geolocation.getCurrentPosition(
                                        (position) => {
                                          resolve({
                                            latitude: position.coords.latitude,
                                            longitude:
                                              position.coords.longitude,
                                          });
                                        },
                                        (error) => reject(error)
                                      );
                                    });
                                  };

                                  // Auto-detect state, city, and address when 6 digits are entered
                                  if (value.length === 6) {
                                    try {
                                      const [location, coords] =
                                        await Promise.all([
                                          getLocationFromPinCode(value),
                                          getUserCoordinates().catch(
                                            () => null
                                          ), // optional
                                        ]);
                                      if (location) {
                                        setFormData((prev) => ({
                                          ...prev,
                                          location: {
                                            ...prev.location,
                                            pinCode: value,
                                            state:
                                              location.state ||
                                              prev.location.state,
                                            city:
                                              location.city ||
                                              prev.location.city,
                                            address:
                                              location.address ||
                                              prev.location.address,
                                            addresses: location.addresses,
                                            latitude:
                                              coords?.latitude != null
                                                ? Number(
                                                    coords.latitude.toFixed(4)
                                                  )
                                                : prev.location.latitude,
                                            longitude:
                                              coords?.longitude != null
                                                ? Number(
                                                    coords.longitude.toFixed(4)
                                                  )
                                                : prev.location.longitude,
                                          },
                                        }));
                                        toast.success(
                                          t(
                                            "customer.pinCodeDetectedSuccess"
                                          ) ||
                                            "Location detected from Pin Code!",
                                          { id: "pin-code-detected" }
                                        );
                                      } else {
                                        toast.error(
                                          t("customer.pinCodeNotFound") ||
                                            "Pin Code not found. Please enter a valid 6-digit pin code.",
                                          { id: "pin-code-not-found" }
                                        );
                                      }
                                    } catch (error) {
                                      logger.error(
                                        "Error fetching location from pin code:",
                                        error
                                      );
                                      toast.error(
                                        t("customer.pinCodeError") ||
                                          "Error detecting location from Pin Code. Please try again.",
                                        { id: "pin-code-error" }
                                      );
                                    }
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (value && !/^\d{6}$/.test(value)) {
                                  toast.error(
                                    t("customer.invalidPinCode") ||
                                      "Pin Code must be exactly 6 digits"
                                  );
                                } else if (value && value.length === 6) {
                                  // Try to get location if not already set
                                  if (
                                    !formData.location.state ||
                                    !formData.location.city
                                  ) {
                                    getLocationFromPinCode(value);
                                  }
                                }
                              }}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder={
                                t("customer.pinCode") ||
                                "Enter 6-digit Pin Code"
                              }
                              pattern="\d{6}"
                              title={
                                t("customer.pinCodeValidation") ||
                                "Pin Code must be exactly 6 digits"
                              }
                              maxLength={6}
                              lang={language}
                            />
                            <p
                              className="text-xs text-gray-500 mt-1"
                              lang={language}
                            >
                              {t("customer.pinCodeHelp") ||
                                "Enter your pin code and state/city will be auto-detected"}
                            </p>
                          </div>

                          {/* State - Read Only */}
                          <div>
                            <label
                              htmlFor="state"
                              className="block text-xs font-medium text-gray-700 mb-1"
                              lang={language}
                            >
                              {t("customer.state")}{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              id="state"
                              required
                              readOnly
                              value={formData.location.state || ""}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 text-sm cursor-not-allowed"
                              placeholder={
                                t("customer.stateAutoDetected") ||
                                "Will be auto-detected from Pin Code"
                              }
                              lang={language}
                            />
                          </div>

                          {/* City - Read Only */}
                          <div>
                            <label
                              htmlFor="city"
                              className="block text-xs font-medium text-gray-700 mb-1"
                              lang={language}
                            >
                              {t("customer.city")}{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              id="city"
                              required
                              readOnly
                              value={formData.location.city || ""}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 text-sm cursor-not-allowed"
                              placeholder={
                                t("customer.cityAutoDetected") ||
                                "Will be auto-detected from Pin Code"
                              }
                              lang={language}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label
                              htmlFor="area"
                              className="block text-xs font-medium text-gray-700 mb-1"
                              lang={language}
                            >
                              {t("customer.area")}
                            </label>
                            <input
                              type="text"
                              id="area"
                              value={formData.location.area || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  location: {
                                    ...formData.location,
                                    area: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder={t("customer.area")}
                              lang={language}
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Address Field - After Location Details */}
                    <div>
                      <label
                        htmlFor="address"
                        className="block text-sm font-medium text-gray-700 mb-1"
                        lang={language}
                      >
                        {t("customer.fullAddress")}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="address"
                        required
                        value={formData.location.address}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            location: {
                              ...formData.location,
                              address: e.target.value,
                            },
                          })
                        }
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none"
                        placeholder={
                          t("customer.addressPlaceholder") ||
                          "Enter your full address (auto-filled from Pin Code, but you can edit)"
                        }
                        rows={3}
                        lang={language}
                      />
                      <p className="text-xs text-gray-500 mt-1" lang={language}>
                        {t("customer.addressHelp") ||
                          "Address will be auto-filled when you enter pin code, but you can edit it if needed"}
                      </p>
                    </div>

                    {/* Landmark Field */}
                    <div>
                      <label
                        htmlFor="landmark"
                        className="block text-sm font-medium text-gray-700 mb-1"
                        lang={language}
                      >
                        {t("customer.landmark")}
                      </label>
                      <input
                        type="text"
                        id="landmark"
                        value={formData.location.landmark || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            location: {
                              ...formData.location,
                              landmark: e.target.value,
                            },
                          })
                        }
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        placeholder={t("customer.landmarkPlaceholder")}
                        lang={language}
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSubmitting ? t("common.loading") : t("common.submit")}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 w-full max-w-lg relative my-auto max-h-[95vh] overflow-y-auto">
              <h3
                className="text-2xl font-bold text-gray-900 mb-6"
                lang={language}
              >
                {t("customer.updateProfile")}
              </h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    lang={language}
                  >
                    {t("customer.name")}
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      const nameRegex = /^[a-zA-Z\s'\-\.]*$/;
                      if (nameRegex.test(value) || value === "") {
                        setProfileData({ ...profileData, name: value });
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && /\d/.test(value)) {
                        toast.error(
                          t("login.nameNoNumbers") ||
                            "Name cannot contain numbers"
                        );
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                    pattern="[a-zA-Z\s'\-\.]+"
                    title={
                      t("login.nameNoNumbers") ||
                      "Name should only contain letters, spaces, apostrophes, hyphens, and dots"
                    }
                    lang={language}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    lang={language}
                  >
                    {t("customer.email")}
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    readOnly
                    disabled
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    lang={language}
                  />
                  <p className="text-xs text-gray-500 mt-1" lang={language}>
                    {t("customer.emailCannotBeChanged") ||
                      "Email cannot be changed"}
                  </p>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    lang={language}
                  >
                    {t("customer.phone")}
                  </label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, "");
                      if (cleaned.length <= 15) {
                        setProfileData({ ...profileData, phone: cleaned });
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && (value.length < 10 || value.length > 15)) {
                        toast.error(
                          t("login.invalidPhone") ||
                            "Please enter a valid phone number (10-15 digits)"
                        );
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                    minLength={10}
                    maxLength={15}
                    pattern="[0-9]{10,15}"
                    title={
                      t("login.invalidPhone") ||
                      "Please enter a valid phone number (10-15 digits)"
                    }
                    lang={language}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    lang={language}
                  >
                    {t("customer.secondaryPhone")}
                  </label>
                  <input
                    type="tel"
                    value={profileData.secondaryPhone}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, "");
                      if (cleaned.length <= 15) {
                        setProfileData({
                          ...profileData,
                          secondaryPhone: cleaned,
                        });
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    pattern="[0-9]{10,15}"
                    title={
                      t("login.invalidPhone") ||
                      "Please enter a valid phone number (10-15 digits)"
                    }
                    lang={language}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                  lang={language}
                >
                  {isUpdatingProfile
                    ? t("customer.updating")
                    : t("customer.updateProfile")}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Rating Modal */}
        {showRatingModal && selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 w-full max-w-lg relative my-auto max-h-[95vh] overflow-y-auto">
              <h3
                className="text-2xl font-bold text-gray-900 mb-6"
                lang={language}
              >
                {t("customer.rateWorkers")}
              </h3>
              <button
                onClick={() => {
                  setShowRatingModal(false);
                  setSelectedRequest(null);
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>
              <form onSubmit={handleSubmitRating} className="space-y-5">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("customer.ratingLabel")}
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setRatingData({ ...ratingData, rating: star })
                        }
                        className={`text-4xl ${
                          star <= ratingData.rating
                            ? "text-yellow-400"
                            : "text-gray-300"
                        } hover:text-yellow-400 transition-colors`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 mt-2" lang={language}>
                    {t("customer.selectedRating")}: {ratingData.rating}{" "}
                    {t("customer.stars")}
                  </p>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    lang={language}
                  >
                    {t("customer.comment")}
                  </label>
                  <textarea
                    value={ratingData.comment}
                    onChange={(e) =>
                      setRatingData({ ...ratingData, comment: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={4}
                    placeholder={t("customer.commentPlaceholder")}
                    lang={language}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingRating}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                  lang={language}
                >
                  {isSubmittingRating
                    ? t("customer.submitting")
                    : t("customer.submitRating")}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Concern Modal */}
        {showConcernModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
              <h3
                className="text-2xl font-bold text-gray-900 mb-6"
                lang={language}
              >
                {t("customer.raiseConcern")}
              </h3>
              <button
                onClick={() => {
                  setShowConcernModal(false);
                  setSelectedRequestForConcern(null);
                  setConcernData({
                    requestId: "",
                    relatedToUserId: "",
                    description: "",
                    type: "OTHER",
                  });
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>
              <form onSubmit={handleSubmitConcern} className="space-y-5">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    lang={language}
                  >
                    {t("customer.concernType")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={concernData.type}
                    onChange={(e) =>
                      setConcernData({
                        ...concernData,
                        type: e.target.value as any,
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                    lang={language}
                  >
                    <option value="WORK_QUALITY">
                      {t("customer.workQuality")}
                    </option>
                    <option value="PAYMENT_ISSUE">
                      {t("customer.paymentIssue")}
                    </option>
                    <option value="BEHAVIOR">{t("customer.behavior")}</option>
                    <option value="SAFETY">{t("customer.safety")}</option>
                    <option value="OTHER">{t("customer.other")}</option>
                  </select>
                </div>
                {requests.length > 0 && (
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      lang={language}
                    >
                      {t("customer.relatedRequest")}
                    </label>
                    <select
                      value={concernData.requestId}
                      onChange={(e) =>
                        setConcernData({
                          ...concernData,
                          requestId: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      lang={language}
                    >
                      <option value="">{t("customer.none")}</option>
                      {requests.map((req) => (
                        <option key={req.id} value={req.id}>
                          {req.workType} -{" "}
                          {t(
                            `customer.status${req.status
                              .toLowerCase()
                              .replace(/_/g, "")}`
                          ) || req.status}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-1"
                    lang={language}
                  >
                    {t("customer.description")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={concernData.description}
                    onChange={(e) =>
                      setConcernData({
                        ...concernData,
                        description: e.target.value,
                      })
                    }
                    onBlur={(e) => {
                      if (!e.target.value.trim()) {
                        toast.error(
                          t("customer.concernDescriptionRequired") ||
                            "Please enter a description for your concern"
                        );
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={6}
                    placeholder={t("customer.concernDescriptionPlaceholder")}
                    required
                    minLength={10}
                    title={
                      t("customer.concernDescriptionRequired") ||
                      "Please enter at least 10 characters describing your concern"
                    }
                    lang={language}
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    isSubmittingConcern || !concernData.description?.trim()
                  }
                  className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                  lang={language}
                >
                  {isSubmittingConcern
                    ? t("customer.submitting")
                    : t("customer.submitConcern")}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === "concerns" ? (
          <>
            {/* Search and Sort for Concerns */}
            <div className="bg-gray-50 rounded-xl shadow-md p-4 md:p-6 mb-4 md:mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔍 Search
                  </label>
                  <input
                    type="text"
                    value={concernsSearch}
                    onChange={(e) => setConcernsSearch(e.target.value)}
                    placeholder="Search by type, description, request..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <select
                    value={concernsSortBy}
                    onChange={(e) => setConcernsSortBy(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="date">Date</option>
                    <option value="type">Type</option>
                    <option value="status">Status</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order
                  </label>
                  <select
                    value={concernsSortOrder}
                    onChange={(e) => setConcernsSortOrder(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              {isLoadingConcerns ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                (() => {
                  // Filter and sort concerns
                  let filtered = myConcerns.filter((concern: any) => {
                    const searchLower = concernsSearch.toLowerCase();
                    return (
                      !concernsSearch ||
                      concern.type?.toLowerCase().includes(searchLower) ||
                      concern.description
                        ?.toLowerCase()
                        .includes(searchLower) ||
                      concern.request?.workType
                        ?.toLowerCase()
                        .includes(searchLower) ||
                      concern.status?.toLowerCase().includes(searchLower)
                    );
                  });

                  filtered.sort((a: any, b: any) => {
                    let aVal: any, bVal: any;
                    if (concernsSortBy === "date") {
                      aVal = new Date(a.createdAt || 0).getTime();
                      bVal = new Date(b.createdAt || 0).getTime();
                    } else if (concernsSortBy === "type") {
                      aVal = (a.type || "").toLowerCase();
                      bVal = (b.type || "").toLowerCase();
                    } else if (concernsSortBy === "status") {
                      aVal = (a.status || "").toLowerCase();
                      bVal = (b.status || "").toLowerCase();
                    } else {
                      return 0;
                    }

                    if (concernsSortOrder === "asc") {
                      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                    } else {
                      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                    }
                  });

                  return filtered.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center border-2 border-dashed border-gray-300">
                      <div className="text-6xl mb-4">📢</div>
                      <p className="text-xl text-gray-500 mb-2" lang={language}>
                        {concernsSearch
                          ? "No concerns match your search"
                          : t("customer.noConcerns")}
                      </p>
                      <p className="text-gray-400" lang={language}>
                        {t("customer.raiseConcern")}
                      </p>
                    </div>
                  ) : (
                    filtered.map((concern: any) => (
                      <div
                        key={concern.id}
                        className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 transform border-l-4 border-red-500"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-gray-900">
                                Concern #{concern.id}
                              </h3>
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  concern.type === "WORK_QUALITY"
                                    ? "bg-blue-100 text-blue-800"
                                    : concern.type === "PAYMENT_ISSUE"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : concern.type === "BEHAVIOR"
                                    ? "bg-red-100 text-red-800"
                                    : concern.type === "SAFETY"
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {concern.type.replace(/_/g, " ")}
                              </span>
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  concern.status === "PENDING"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : concern.status === "IN_REVIEW"
                                    ? "bg-blue-100 text-blue-800"
                                    : concern.status === "RESOLVED"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {concern.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="space-y-2 text-sm text-gray-600 mb-4">
                              {concern.request && (
                                <p lang={language}>
                                  <span className="font-semibold">
                                    {t("customer.relatedRequest")}:
                                  </span>{" "}
                                  {concern.request.workType} ({t("admin.id")}:{" "}
                                  {concern.request.id})
                                </p>
                              )}
                              <p>
                                <span className="font-semibold">Created:</span>{" "}
                                {new Date(concern.createdAt).toLocaleString()}
                              </p>
                              {concern.resolvedAt && (
                                <p>
                                  <span className="font-semibold">
                                    Resolved:
                                  </span>{" "}
                                  {new Date(
                                    concern.resolvedAt
                                  ).toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                              <p className="font-semibold text-gray-900 mb-2">
                                Description:
                              </p>
                              <p className="text-gray-700">
                                {concern.description}
                              </p>
                            </div>

                            {/* Conversation Thread */}
                            <div className="mb-4">
                              <p className="font-semibold text-gray-900 mb-3">
                                Conversation:
                              </p>
                              {isLoadingMessages[concern.id] ? (
                                <div className="flex justify-center py-4">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                                </div>
                              ) : concernMessages[concern.id] &&
                                concernMessages[concern.id].length > 0 ? (
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                  {concernMessages[concern.id].map(
                                    (msg: any) => {
                                      const isUser =
                                        msg.sentBy?.id === concern.raisedBy?.id;
                                      const isAdmin =
                                        msg.sentBy?.role === "ADMIN";
                                      return (
                                        <div
                                          key={msg.id}
                                          className={`p-3 rounded-lg ${
                                            isAdmin
                                              ? "bg-blue-50 border-l-4 border-blue-500"
                                              : isUser
                                              ? "bg-green-50 border-l-4 border-green-500"
                                              : "bg-gray-50 border-l-4 border-gray-400"
                                          }`}
                                        >
                                          <div className="flex justify-between items-start mb-1">
                                            <p
                                              className={`font-semibold text-sm ${
                                                isAdmin
                                                  ? "text-blue-900"
                                                  : isUser
                                                  ? "text-green-900"
                                                  : "text-gray-900"
                                              }`}
                                            >
                                              {msg.sentBy?.name || "Unknown"}
                                              {isAdmin && (
                                                <span className="ml-2 text-xs">
                                                  (Admin)
                                                </span>
                                              )}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                              {new Date(
                                                msg.createdAt
                                              ).toLocaleString()}
                                            </p>
                                          </div>
                                          <p
                                            className={`text-sm ${
                                              isAdmin
                                                ? "text-blue-700"
                                                : isUser
                                                ? "text-green-700"
                                                : "text-gray-700"
                                            }`}
                                          >
                                            {msg.message}
                                          </p>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              ) : (
                                <p className="text-gray-500 text-sm italic">
                                  No messages yet. Start the conversation by
                                  updating the concern.
                                </p>
                              )}
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              {concern.status === "RESOLVED" ? (
                                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                                  <p className="text-green-800 font-semibold flex items-center gap-2">
                                    <span>✓</span>
                                    This concern has been resolved and cannot be
                                    edited.
                                  </p>
                                </div>
                              ) : editingConcern &&
                                editingConcern.id === concern.id ? (
                                <>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t("customer.updateStatus") ||
                                      "Update Status:"}
                                  </label>
                                  <select
                                    value={
                                      editingConcern.status === "IN_REVIEW"
                                        ? "PENDING"
                                        : editingConcern.status
                                    }
                                    onChange={(e) => {
                                      if (editingConcern) {
                                        setEditingConcern({
                                          ...editingConcern,
                                          status: e.target.value,
                                        });
                                      }
                                    }}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-3"
                                  >
                                    <option value="PENDING">Pending</option>
                                    <option value="RESOLVED">Resolved</option>
                                  </select>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Message (Optional):
                                  </label>
                                  <textarea
                                    value={editingConcern.message || ""}
                                    onChange={(e) => {
                                      if (editingConcern) {
                                        setEditingConcern({
                                          ...editingConcern,
                                          message: e.target.value,
                                        });
                                      }
                                    }}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-3"
                                    rows={3}
                                    placeholder="Add a message or update about this concern (optional)..."
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={async () => {
                                        if (!editingConcern) return;
                                        setIsUpdatingConcernStatus(true);
                                        try {
                                          const token =
                                            SessionStorage.getToken();
                                          const payload: any = {
                                            status:
                                              editingConcern.status ===
                                              "IN_REVIEW"
                                                ? "PENDING"
                                                : editingConcern.status,
                                          };
                                          // Only include message if it's not empty
                                          if (
                                            editingConcern.message &&
                                            editingConcern.message.trim()
                                          ) {
                                            payload.message =
                                              editingConcern.message.trim();
                                          }
                                          await apiClient.put(
                                            `/concerns/${concern.id}/status`,
                                            payload,
                                            {}
                                          );
                                          toast.success(
                                            "Concern updated successfully!"
                                          );
                                          setEditingConcern(null);
                                          fetchMyConcerns();
                                          // Refresh messages for this concern
                                          fetchConcernMessages(concern.id);
                                        } catch (error: any) {
                                          toast.error(
                                            error.response?.data?.message ||
                                              "Failed to update concern"
                                          );
                                        } finally {
                                          setIsUpdatingConcernStatus(false);
                                        }
                                      }}
                                      disabled={isUpdatingConcernStatus}
                                      className="flex-1 bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-2 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                                    >
                                      {isUpdatingConcernStatus
                                        ? "Saving..."
                                        : "Save"}
                                    </button>
                                    <button
                                      onClick={() => setEditingConcern(null)}
                                      disabled={isUpdatingConcernStatus}
                                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-2">
                                    You can update the status (Pending/Resolved)
                                    and optionally add a message
                                  </p>
                                </>
                              ) : (
                                <button
                                  onClick={() =>
                                    setEditingConcern({
                                      id: concern.id,
                                      status:
                                        concern.status === "IN_REVIEW"
                                          ? "PENDING"
                                          : concern.status,
                                      message: "",
                                    })
                                  }
                                  className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-2 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform"
                                >
                                  Update Concern
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  );
                })()
              )}
            </div>
          </>
        ) : (
          <>
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <>
                {/* Search and Sort for Requests */}
                <div className="bg-gray-50 rounded-xl shadow-md p-4 md:p-6 mb-4 md:mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        🔍 Search
                      </label>
                      <input
                        type="text"
                        value={requestsSearch}
                        onChange={(e) => setRequestsSearch(e.target.value)}
                        placeholder="Search by work type, location, status..."
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sort By
                      </label>
                      <select
                        value={requestsSortBy}
                        onChange={(e) => setRequestsSortBy(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="date">Date</option>
                        <option value="workType">Work Type</option>
                        <option value="status">Status</option>
                        <option value="startDate">Start Date</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Order
                      </label>
                      <select
                        value={requestsSortOrder}
                        onChange={(e) => setRequestsSortOrder(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="desc">Newest First</option>
                        <option value="asc">Oldest First</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-start overflow-x-hidden">
                  {(() => {
                    // Filter and sort requests
                    let filtered = requests.filter((request: any) => {
                      const searchLower = requestsSearch.toLowerCase();
                      return (
                        !requestsSearch ||
                        request.workType?.toLowerCase().includes(searchLower) ||
                        request.location?.address
                          ?.toLowerCase()
                          .includes(searchLower) ||
                        request.status?.toLowerCase().includes(searchLower) ||
                        request.workerTypes?.some((type: string) =>
                          type.toLowerCase().includes(searchLower)
                        )
                      );
                    });

                    filtered.sort((a: any, b: any) => {
                      let aVal: any, bVal: any;
                      if (requestsSortBy === "date") {
                        aVal = new Date(a.createdAt || 0).getTime();
                        bVal = new Date(b.createdAt || 0).getTime();
                      } else if (requestsSortBy === "workType") {
                        aVal = (a.workType || "").toLowerCase();
                        bVal = (b.workType || "").toLowerCase();
                      } else if (requestsSortBy === "status") {
                        aVal = (a.status || "").toLowerCase();
                        bVal = (b.status || "").toLowerCase();
                      } else if (requestsSortBy === "startDate") {
                        aVal = new Date(a.startDate || 0).getTime();
                        bVal = new Date(b.startDate || 0).getTime();
                      } else {
                        return 0;
                      }

                      if (requestsSortOrder === "asc") {
                        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                      } else {
                        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                      }
                    });

                    return filtered.length === 0 ? (
                      <div className="col-span-full bg-white rounded-xl shadow-lg p-12 text-center border-2 border-dashed border-gray-300">
                        <div className="text-6xl mb-4">📝</div>
                        <p
                          className="text-xl text-gray-500 mb-2"
                          lang={language}
                        >
                          {requestsSearch
                            ? "No requests match your search"
                            : t("customer.noRequests")}
                        </p>
                        <p className="text-gray-400" lang={language}>
                          {t("customer.createRequest")}
                        </p>
                      </div>
                    ) : (
                      filtered.map((request) => (
                        <div
                          key={request.id}
                          className="bg-white rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-t-4 border-primary-500 h-full flex flex-col min-w-0"
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-3 mb-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <h3 className="text-lg sm:text-xl font-bold capitalize text-gray-900 break-words flex-1 min-w-0">
                                  {request.workType}
                                </h3>
                                <div className="flex-shrink-0">
                                  {getStatusBadge(request.status)}
                                </div>
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-start gap-2 text-gray-600 flex-wrap">
                                  <span className="flex-shrink-0">⚡</span>
                                  {request.workerTypes &&
                                  request.workerTypes.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 min-w-0">
                                      {request.workerTypes.map(
                                        (type: string, idx: number) => (
                                          <span
                                            key={idx}
                                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs capitalize break-words min-w-0"
                                          >
                                            {type.toLowerCase()}
                                          </span>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <span className="capitalize text-gray-500">
                                      N/A
                                    </span>
                                  )}
                                </div>
                                {request.startDate && request.endDate && (
                                  <div className="flex items-center gap-2 text-gray-600 flex-wrap">
                                    <span className="flex-shrink-0">📅</span>
                                    <span className="break-words min-w-0">
                                      {new Date(
                                        request.startDate
                                      ).toLocaleDateString()}{" "}
                                      -{" "}
                                      {new Date(
                                        request.endDate
                                      ).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-gray-600 flex-wrap">
                                  <span className="flex-shrink-0">👥</span>
                                  <span className="break-words min-w-0">
                                    {request.numberOfWorkers} worker
                                    {request.numberOfWorkers > 1
                                      ? "s"
                                      : ""}{" "}
                                    needed
                                  </span>
                                </div>
                                <div className="flex items-start gap-2 text-gray-600">
                                  <span className="flex-shrink-0">📍</span>
                                  <span className="break-words min-w-0">
                                    {request.location?.address || "N/A"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600 flex-wrap">
                                  <span className="flex-shrink-0">🕒</span>
                                  <span className="break-words min-w-0">
                                    {new Date(
                                      request.createdAt
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {request.status === "DEPLOYED" && (
                            <button
                              onClick={() => handleCompleteRequest(request.id)}
                              className="w-full mt-4 bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors"
                            >
                              {t("dashboard.completed")}
                            </button>
                          )}

                          {request.status === "COMPLETED" &&
                            request.deployedWorkers &&
                            request.deployedWorkers.length > 0 && (
                              <div className="flex gap-2 mt-4">
                                {!ratedRequests.has(request.id) ? (
                                  <button
                                    onClick={() => {
                                      setSelectedRequest(request);
                                      setShowRatingModal(true);
                                    }}
                                    className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
                                  >
                                    ⭐ {t("customer.rateWorkers")}
                                  </button>
                                ) : (
                                  <div className="flex-1 bg-green-50 border-2 border-green-200 text-green-800 py-2 rounded-lg font-semibold text-center">
                                    ✓ {t("customer.rated") || "Rated"}
                                  </div>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedRequestForConcern(request);
                                    setConcernData({
                                      ...concernData,
                                      requestId: request.id,
                                    });
                                    setShowConcernModal(true);
                                  }}
                                  className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
                                >
                                  📢 {t("customer.concerns")}
                                </button>
                              </div>
                            )}
                          {request.status !== "COMPLETED" && (
                            <button
                              onClick={() => {
                                setSelectedRequestForConcern(request);
                                setConcernData({
                                  ...concernData,
                                  requestId: request.id,
                                });
                                setShowConcernModal(true);
                              }}
                              className="w-full mt-4 bg-gradient-to-r from-red-500 to-pink-500 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
                            >
                              📢 {t("customer.raiseConcern")}
                            </button>
                          )}

                          {request.deployedWorkers &&
                            request.deployedWorkers.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-green-200">
                                <p className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                                  <span>🚀</span>
                                  {t("dashboard.workers")} (
                                  {request.deployedWorkers.length})
                                </p>
                                <div className="space-y-2">
                                  {request.deployedWorkers.map(
                                    (dw: any, idx: number) => {
                                      const workerName =
                                        dw.worker?.name ||
                                        dw.workerId?.name ||
                                        "Worker";
                                      const workerPhone =
                                        dw.worker?.phone ||
                                        dw.workerId?.phone ||
                                        "N/A";
                                      // Get rating from workerRating field (set by API)
                                      const workerRating =
                                        dw.workerRating !== undefined &&
                                        dw.workerRating !== null
                                          ? dw.workerRating
                                          : 0.0;
                                      const ratingValue =
                                        typeof workerRating === "number"
                                          ? workerRating
                                          : parseFloat(String(workerRating)) ||
                                            0.0;
                                      const numStars = Math.max(
                                        1,
                                        Math.min(5, Math.round(ratingValue))
                                      );
                                      const ratingStars = "⭐".repeat(numStars);

                                      return (
                                        <div
                                          key={idx}
                                          className="bg-green-50 p-3 rounded-lg border-2 border-green-200"
                                        >
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <p className="font-bold text-green-900">
                                                {workerName}
                                              </p>
                                              <p className="text-sm text-green-700">
                                                {workerPhone}
                                              </p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-xs text-green-600 font-semibold">
                                                Rating
                                              </p>
                                              <div className="flex items-center gap-1">
                                                <span className="text-yellow-500 text-sm">
                                                  {ratingStars}
                                                </span>
                                                <span className="text-xs text-green-700 font-semibold">
                                                  ({ratingValue.toFixed(1)})
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      ))
                    );
                  })()}
                </div>
              </>
            )}
          </>
        )}
      </div>
      {/* ➕ ADDRESS SELECTION MODAL */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Select Your Address</h3>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {pinAddresses.map((po, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setFormData((prev: any) => ({
                      ...prev,
                      address: formatPostOfficeAddress(po),
                    }));
                    setShowAddressModal(false);
                  }}
                  className="w-full text-left px-4 py-3 border rounded-lg hover:bg-primary-50 hover:border-primary-500 transition"
                >
                  {formatPostOfficeAddress(po)}
                </button>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowAddressModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Extend End Date Modal */}
      {showExtendDateModal && selectedWorkerForExtend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-md">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Extend End Date
            </h3>
            <p className="text-gray-600 mb-4">
              Extend the end date for{" "}
              <strong>{selectedWorkerForExtend.workerName}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Current end date:{" "}
              <strong>
                {new Date(
                  selectedWorkerForExtend.currentEndDate
                ).toLocaleDateString()}
              </strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New End Date
              </label>
              <input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                min={(() => {
                  const currentEnd = new Date(
                    selectedWorkerForExtend.currentEndDate
                  );
                  currentEnd.setDate(currentEnd.getDate() + 1);
                  return currentEnd.toISOString().split("T")[0];
                })()}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!newEndDate) {
                    toast.error("Please select a new end date");
                    return;
                  }
                  const currentEnd = new Date(
                    selectedWorkerForExtend.currentEndDate
                  );
                  const newEnd = new Date(newEndDate);
                  if (newEnd <= currentEnd) {
                    toast.error(
                      "New end date must be after the current end date"
                    );
                    return;
                  }
                  setIsExtending(true);
                  try {
                    const token = SessionStorage.getToken();
                    await apiClient.put(
                      `/requests/${selectedWorkerForExtend.requestId}/extend-end-date`,
                      {
                        workerId: selectedWorkerForExtend.workerId,
                        newEndDate: newEndDate,
                      },
                      {
                        headers: { Authorization: `Bearer ${token}` },
                      }
                    );
                    toast.success("End date extended successfully!");
                    setShowExtendDateModal(false);
                    setSelectedWorkerForExtend(null);
                    setNewEndDate("");
                    // Refresh requests
                    const response = await apiClient.get(
                      "/requests/my-requests",
                      {
                        headers: { Authorization: `Bearer ${token}` },
                      }
                    );
                    setRequests(response.data);
                  } catch (error: any) {
                    logger.error("Error extending end date:", error);
                    toast.error(
                      error.response?.data?.message ||
                        "Failed to extend end date"
                    );
                  } finally {
                    setIsExtending(false);
                  }
                }}
                disabled={isExtending}
                className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isExtending ? "Extending..." : "Extend"}
              </button>
              <button
                onClick={() => {
                  setShowExtendDateModal(false);
                  setSelectedWorkerForExtend(null);
                  setNewEndDate("");
                }}
                disabled={isExtending}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chatbot */}
      <Chatbot user={user} />
    </div>
  );
}
