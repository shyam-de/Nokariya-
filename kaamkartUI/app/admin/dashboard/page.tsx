"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, API_URL } from "@/lib/api";
import { SessionStorage } from "@/lib/session";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import axios from "axios";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Chatbot from "@/components/Chatbot";
import { logger } from "@/lib/logger";
import { getLocationFromPinCode } from "@/lib/indianLocationValidation";

interface Request {
  id: string;
  workerTypes: string[];
  startDate?: string;
  endDate?: string;
  workType: string;
  numberOfWorkers: number;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  status: string;
  createdAt: string;
  completedAt?: string;
  deployedWorkers?: any[];
  confirmedWorkers?: any[];
}

interface PostOfficeAddress {
  Name: string;
  District: string;
  State: string;
  Pincode: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<
    | "pending"
    | "active"
    | "history"
    | "concerns"
    | "workers"
    | "customers"
    | "systemUsers"
    | "successStories"
    | "advertisements"
    | "workerTypes"
  >("pending");
  const [requests, setRequests] = useState<Request[]>([]);
  const [activeRequests, setActiveRequests] = useState<Request[]>([]);
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [concerns, setConcerns] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingActive, setIsLoadingActive] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingConcerns, setIsLoadingConcerns] = useState(false);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingSystemUsers, setIsLoadingSystemUsers] = useState(false);
  const [selectedConcern, setSelectedConcern] = useState<any | null>(null);
  const [isUpdatingConcern, setIsUpdatingConcern] = useState(false);
  const [concernMessages, setConcernMessages] = useState<{
    [key: string]: any[];
  }>({});
  const [isLoadingMessages, setIsLoadingMessages] = useState<{
    [key: string]: boolean;
  }>({});
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingSystemUser, setEditingSystemUser] = useState<any | null>(null);
  const [editingUserPassword, setEditingUserPassword] = useState<any | null>(
    null
  );
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingSystemUser, setIsUpdatingSystemUser] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // Location filter for pending, active, and concerns tabs (super admin only)
  const [pendingLocationFilter, setPendingLocationFilter] = useState(false);
  const [activeLocationFilter, setActiveLocationFilter] = useState(false);
  const [concernsLocationFilter, setConcernsLocationFilter] = useState(false);
  // Search, sort, and location filter for workers, customers, and system users
  const [workersSearch, setWorkersSearch] = useState("");
  const [workersSortBy, setWorkersSortBy] = useState("date");
  const [workersSortOrder, setWorkersSortOrder] = useState("desc");
  const [workersLocationFilter, setWorkersLocationFilter] = useState(false);
  const [customersSearch, setCustomersSearch] = useState("");
  const [customersSortBy, setCustomersSortBy] = useState("date");
  const [customersSortOrder, setCustomersSortOrder] = useState("desc");
  const [customersLocationFilter, setCustomersLocationFilter] = useState(false);
  const [systemUsersSearch, setSystemUsersSearch] = useState("");
  const [systemUsersSortBy, setSystemUsersSortBy] = useState("date");
  const [systemUsersSortOrder, setSystemUsersSortOrder] = useState("desc");
  const [systemUsersLocationFilter, setSystemUsersLocationFilter] =
    useState(false);
  // Search and sort for success stories, advertisements, and worker types
  const [successStoriesSearch, setSuccessStoriesSearch] = useState("");
  const [successStoriesSortBy, setSuccessStoriesSortBy] = useState("date");
  const [successStoriesSortOrder, setSuccessStoriesSortOrder] =
    useState("desc");
  const [advertisementsSearch, setAdvertisementsSearch] = useState("");
  const [advertisementsSortBy, setAdvertisementsSortBy] = useState("date");
  const [advertisementsSortOrder, setAdvertisementsSortOrder] =
    useState("desc");
  const [workerTypesSearch, setWorkerTypesSearch] = useState("");
  const [workerTypesSortBy, setWorkerTypesSortBy] = useState("displayOrder");
  const [workerTypesSortOrder, setWorkerTypesSortOrder] = useState("asc");
  // Pagination state for all tabs (default 10 items per page)
  const [pendingPage, setPendingPage] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [concernsPage, setConcernsPage] = useState(1);
  const [workersPage, setWorkersPage] = useState(1);
  const [customersPage, setCustomersPage] = useState(1);
  const [systemUsersPage, setSystemUsersPage] = useState(1);
  const [successStoriesPage, setSuccessStoriesPage] = useState(1);
  const [advertisementsPage, setAdvertisementsPage] = useState(1);
  const [workerTypesPage, setWorkerTypesPage] = useState(1);
  const itemsPerPage = 10;
  const [confirmationStatus, setConfirmationStatus] = useState<{
    [key: string]: any;
  }>({});
  const [isLoadingConfirmation, setIsLoadingConfirmation] = useState<{
    [key: string]: boolean;
  }>({});
  const [isDeploying, setIsDeploying] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [showDeployModal, setShowDeployModal] = useState<{
    show: boolean;
    requestId: string | null;
  }>({ show: false, requestId: null });
  const [showApproveModal, setShowApproveModal] = useState<{
    show: boolean;
    requestId: string | null;
  }>({ show: false, requestId: null });
  // Success Stories and Advertisements
  const [successStories, setSuccessStories] = useState<any[]>([]);
  const [advertisements, setAdvertisements] = useState<any[]>([]);
  const [isLoadingStories, setIsLoadingStories] = useState(false);
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [showAdForm, setShowAdForm] = useState(false);
  const [editingStory, setEditingStory] = useState<any>(null);
  const [editingAd, setEditingAd] = useState<any>(null);
  // Worker Types
  const [workerTypes, setWorkerTypes] = useState<any[]>([]);
  const [isLoadingWorkerTypes, setIsLoadingWorkerTypes] = useState(false);
  const [showWorkerTypeForm, setShowWorkerTypeForm] = useState(false);
  const [editingWorkerType, setEditingWorkerType] = useState<any>(null);
  const [dataLoaded, setDataLoaded] = useState({
    pendingRequests: false,
    activeRequests: false,
    allRequests: false,
    concerns: false,
    workers: false,
    customers: false,
    systemUsers: false,
    successStories: false,
    advertisements: false,
    workerTypes: false,
  });
  const [workerTypeFormData, setWorkerTypeFormData] = useState({
    name: "",
    displayName: "",
    icon: "",
    description: "",
    isActive: true,
    displayOrder: 0,
  });
  const [storyFormData, setStoryFormData] = useState({
    title: "",
    description: "",
    storyType: "customer" as "customer" | "worker", // 'customer' or 'worker'
    name: "", // Single name field (either customer or worker name)
    workerType: "",
    rating: 5,
    imageUrl: "",
    isActive: true,
    displayOrder: 0,
  });
  const [adFormData, setAdFormData] = useState({
    title: "",
    text: "",
    imageUrl: "",
    linkUrl: "",
    linkText: "",
    isActive: true,
    displayOrder: 0,
    startDate: "",
    endDate: "",
  });
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [pinAddresses, setPinAddresses] = useState<PostOfficeAddress[]>([]);
  const formatPostOfficeAddress = (po: PostOfficeAddress): string => {
    return `${po.Name}, ${po.District}, ${po.District}, ${po.State}, ${po.Pincode}`;
  };
  const [userFormData, setUserFormData] = useState({
    name: "",
    email: "",
    phone: "",
    secondaryPhone: "",
    password: "",
    role: "customer" as "customer" | "worker" | "admin",
    workerType: "" as string, // Single labor type for worker
    isSuperAdmin: false,
    pinCode: "", // Pin code for location
    state: "",
    city: "",
    address: "",
  });

  // Auto-logout after 30 minutes of inactivity
  useAutoLogout();

  useEffect(() => {
    // Guard for SSR
    if (typeof window === "undefined") return;

    const token = SessionStorage.getToken();
    const userData = SessionStorage.getUser();

    if (!token || !userData) {
      router.push("/");
      return;
    }

    try {
      // Handle both string and object cases
      const userObj =
        typeof userData === "string" ? JSON.parse(userData) : userData;
      setUser(userObj);

      if (userObj.role?.toLowerCase() !== "admin") {
        toast.error("Access denied. Admin only.");
        router.push("/");
        return;
      }

      // Debug: Log user object to check superAdmin field (dev only)
      if (process.env.NODE_ENV === "development") {
        console.log("Admin user object:", userObj);
        console.log("SuperAdmin flag:", userObj.superAdmin);
      }

      fetchPendingRequests();
    } catch (error) {
      logger.error("Error parsing user data:", error);
      // Clear invalid data and redirect
      SessionStorage.clear();
      router.push("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateSystemUser = async (
    newSuperAdmin: boolean,
    updatedPassword?: string
  ) => {
    if (!editingSystemUser) {
      toast.error("No system user selected for update");
      return;
    }

    setIsUpdatingSystemUser(true);
    try {
      const token = SessionStorage.getToken();

      const payload: any = { ...userFormData };

      // Always update superAdmin explicitly
      payload.superAdmin = newSuperAdmin;

      // Only include password if provided
      if (updatedPassword && updatedPassword.trim()) {
        payload.password = updatedPassword;
      }

      await axios.put(
        `${API_URL}/admin/system-users/${editingSystemUser.id}`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("System user updated successfully");
      setEditingSystemUser(null);
      fetchSystemUsers();
    } catch (error: any) {
      logger.error("Error updating system user:", error);
      toast.error(
        error.response?.data?.message || "Failed to update system user"
      );
    } finally {
      setIsUpdatingSystemUser(false);
    }
  };

  const handleUpdateUserPassword = async () => {
    if (!editingUserPassword) {
      toast.error("No user selected for password update");
      return;
    }

    if (!newPassword || newPassword.trim().length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const token = SessionStorage.getToken();
      await axios.put(
        `${API_URL}/admin/system-users/${editingUserPassword.id}/password`,
        { password: newPassword },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Password updated successfully");
      setEditingUserPassword(null);
      setNewPassword("");
      setShowNewPassword(false);

      // Refresh system users list so UI reflects changes
      fetchSystemUsers();
    } catch (error: any) {
      logger.error("Error updating user password:", error);
      toast.error(error.response?.data?.message || "Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const fetchSuccessStories = async () => {
    if (!user || (user.superAdmin !== true && user.superAdmin !== "true"))
      return;
    setIsLoadingStories(true);
    try {
      const token = SessionStorage.getToken();
      const response = await axios.get(`${API_URL}/admin/success-stories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let stories = response.data || [];

      // Apply search filter
      if (successStoriesSearch && successStoriesSearch.trim()) {
        const searchLower = successStoriesSearch.toLowerCase();
        stories = stories.filter(
          (story: any) =>
            (story.title && story.title.toLowerCase().includes(searchLower)) ||
            (story.description &&
              story.description.toLowerCase().includes(searchLower)) ||
            (story.name && story.name.toLowerCase().includes(searchLower)) ||
            (story.storyType &&
              story.storyType.toLowerCase().includes(searchLower))
        );
      }

      // Apply sorting
      if (successStoriesSortBy) {
        stories = [...stories].sort((a: any, b: any) => {
          let comparison = 0;
          switch (successStoriesSortBy) {
            case "date":
              comparison =
                new Date(a.createdAt || 0).getTime() -
                new Date(b.createdAt || 0).getTime();
              break;
            case "title":
              comparison = (a.title || "").localeCompare(b.title || "");
              break;
            case "displayOrder":
              comparison = (a.displayOrder || 0) - (b.displayOrder || 0);
              break;
            default:
              comparison =
                new Date(a.createdAt || 0).getTime() -
                new Date(b.createdAt || 0).getTime();
          }
          return successStoriesSortOrder === "desc" ? -comparison : comparison;
        });
      }

      setSuccessStories(stories);
      setDataLoaded((prev) => ({ ...prev, successStories: true }));
    } catch (error: any) {
      logger.error("Error fetching success stories:", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch success stories"
      );
      setDataLoaded((prev) => ({ ...prev, successStories: true }));
    } finally {
      setIsLoadingStories(false);
    }
  };

  const fetchAdvertisements = async () => {
    if (!user || (user.superAdmin !== true && user.superAdmin !== "true"))
      return;
    setIsLoadingAds(true);
    try {
      const token = SessionStorage.getToken();
      const response = await axios.get(`${API_URL}/admin/advertisements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let ads = response.data || [];

      // Apply search filter
      if (advertisementsSearch && advertisementsSearch.trim()) {
        const searchLower = advertisementsSearch.toLowerCase();
        ads = ads.filter(
          (ad: any) =>
            (ad.title && ad.title.toLowerCase().includes(searchLower)) ||
            (ad.text && ad.text.toLowerCase().includes(searchLower)) ||
            (ad.linkText && ad.linkText.toLowerCase().includes(searchLower))
        );
      }

      // Apply sorting
      if (advertisementsSortBy) {
        ads = [...ads].sort((a: any, b: any) => {
          let comparison = 0;
          switch (advertisementsSortBy) {
            case "date":
              comparison =
                new Date(a.createdAt || 0).getTime() -
                new Date(b.createdAt || 0).getTime();
              break;
            case "title":
              comparison = (a.title || "").localeCompare(b.title || "");
              break;
            case "displayOrder":
              comparison = (a.displayOrder || 0) - (b.displayOrder || 0);
              break;
            default:
              comparison =
                new Date(a.createdAt || 0).getTime() -
                new Date(b.createdAt || 0).getTime();
          }
          return advertisementsSortOrder === "desc" ? -comparison : comparison;
        });
      }

      setAdvertisements(ads);
      setDataLoaded((prev) => ({ ...prev, advertisements: true }));
    } catch (error: any) {
      logger.error("Error fetching advertisements:", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch advertisements"
      );
      setDataLoaded((prev) => ({ ...prev, advertisements: true }));
    } finally {
      setIsLoadingAds(false);
    }
  };

  const fetchWorkerTypes = async () => {
    if (!user || (user.superAdmin !== true && user.superAdmin !== "true"))
      return;
    setIsLoadingWorkerTypes(true);
    try {
      const token = SessionStorage.getToken();
      const response = await axios.get(`${API_URL}/admin/worker-types`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let types = response.data || [];

      // Apply search filter
      if (workerTypesSearch && workerTypesSearch.trim()) {
        const searchLower = workerTypesSearch.toLowerCase();
        types = types.filter(
          (type: any) =>
            (type.name && type.name.toLowerCase().includes(searchLower)) ||
            (type.displayName &&
              type.displayName.toLowerCase().includes(searchLower)) ||
            (type.description &&
              type.description.toLowerCase().includes(searchLower))
        );
      }

      // Apply sorting
      if (workerTypesSortBy) {
        types = [...types].sort((a: any, b: any) => {
          let comparison = 0;
          switch (workerTypesSortBy) {
            case "name":
              comparison = (a.name || "").localeCompare(b.name || "");
              break;
            case "displayName":
              comparison = (a.displayName || "").localeCompare(
                b.displayName || ""
              );
              break;
            case "displayOrder":
              comparison = (a.displayOrder || 0) - (b.displayOrder || 0);
              break;
            case "isActive":
              comparison = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
              break;
            default:
              comparison = (a.displayOrder || 0) - (b.displayOrder || 0);
          }
          return workerTypesSortOrder === "desc" ? -comparison : comparison;
        });
      }

      setWorkerTypes(types);
      setDataLoaded((prev) => ({ ...prev, workerTypes: true }));
    } catch (error: any) {
      logger.error("Error fetching worker types:", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch worker types"
      );
      setDataLoaded((prev) => ({ ...prev, workerTypes: true }));
    } finally {
      setIsLoadingWorkerTypes(false);
    }
  };

  // Fetch worker types for user creation (uses public endpoint, works for all admins)
  const fetchWorkerTypesForUserCreation = async () => {
    setIsLoadingWorkerTypes(true);
    try {
      const response = await axios.get(`${API_URL}/public/worker-types`);
      setWorkerTypes(response.data);
    } catch (error: any) {
      logger.error("Error fetching worker types:", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch worker types"
      );
    } finally {
      setIsLoadingWorkerTypes(false);
    }
  };

  const handleCreateWorkerType = async () => {
    if (!workerTypeFormData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      const token = SessionStorage.getToken();
      await axios.post(`${API_URL}/admin/worker-types`, workerTypeFormData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Worker type created successfully");
      setShowWorkerTypeForm(false);
      setWorkerTypeFormData({
        name: "",
        displayName: "",
        icon: "",
        description: "",
        isActive: true,
        displayOrder: 0,
      });
      fetchWorkerTypes();
    } catch (error: any) {
      logger.error("Error creating worker type:", error);
      toast.error(
        error.response?.data?.message || "Failed to create worker type"
      );
    }
  };

  const handleUpdateWorkerType = async () => {
    if (!workerTypeFormData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      const token = SessionStorage.getToken();
      await axios.put(
        `${API_URL}/admin/worker-types/${editingWorkerType.id}`,
        workerTypeFormData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Worker type updated successfully");
      setShowWorkerTypeForm(false);
      setEditingWorkerType(null);
      setWorkerTypeFormData({
        name: "",
        displayName: "",
        icon: "",
        description: "",
        isActive: true,
        displayOrder: 0,
      });
      fetchWorkerTypes();
    } catch (error: any) {
      logger.error("Error updating worker type:", error);
      toast.error(
        error.response?.data?.message || "Failed to update worker type"
      );
    }
  };

  const handleDeleteWorkerType = async (id: number) => {
    if (!confirm("Are you sure you want to delete this worker type?")) return;
    try {
      const token = SessionStorage.getToken();
      await axios.delete(`${API_URL}/admin/worker-types/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Worker type deleted successfully");
      fetchWorkerTypes();
    } catch (error: any) {
      logger.error("Error deleting worker type:", error);
      toast.error(
        error.response?.data?.message || "Failed to delete worker type"
      );
    }
  };

  const handleToggleWorkerTypeActive = async (id: number) => {
    try {
      const token = SessionStorage.getToken();
      await axios.post(
        `${API_URL}/admin/worker-types/${id}/toggle-active`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Worker type status updated");
      fetchWorkerTypes();
    } catch (error: any) {
      logger.error("Error toggling worker type status:", error);
      toast.error(
        error.response?.data?.message || "Failed to update worker type status"
      );
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchAllRequests();
    } else if (activeTab === "active") {
      fetchActiveRequests();
    } else if (activeTab === "concerns") {
      fetchConcerns();
    } else if (activeTab === "workers") {
      fetchWorkers();
    } else if (activeTab === "customers") {
      fetchCustomers();
    } else if (activeTab === "systemUsers") {
      fetchSystemUsers();
    } else if (activeTab === "pending") {
      fetchPendingRequests();
    } else if (activeTab === "successStories") {
      fetchSuccessStories();
    } else if (activeTab === "advertisements") {
      fetchAdvertisements();
    } else if (activeTab === "workerTypes") {
      fetchWorkerTypes();
    }
  }, [
    activeTab,
    searchQuery,
    sortBy,
    sortOrder,
    statusFilter,
    workersSearch,
    workersSortBy,
    workersSortOrder,
    workersLocationFilter,
    customersSearch,
    customersSortBy,
    customersSortOrder,
    customersLocationFilter,
    systemUsersSearch,
    systemUsersSortBy,
    systemUsersSortOrder,
    systemUsersLocationFilter,
    pendingLocationFilter,
    activeLocationFilter,
    concernsLocationFilter,
    successStoriesSearch,
    successStoriesSortBy,
    successStoriesSortOrder,
    advertisementsSearch,
    advertisementsSortBy,
    advertisementsSortOrder,
    workerTypesSearch,
    workerTypesSortBy,
    workerTypesSortOrder,
    user,
  ]);

  // Fetch confirmation status only when tab is first loaded or when user manually refreshes
  // Removed automatic interval to prevent unnecessary API calls

  const fetchPendingRequests = async () => {
    setIsLoading(true);
    try {
      const token = SessionStorage.getToken();
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (sortBy) params.append("sortBy", sortBy);
      if (sortOrder) params.append("sortOrder", sortOrder);
      // Add location filter for super admin only
      if (
        (user?.superAdmin === true || user?.superAdmin === "true") &&
        pendingLocationFilter
      ) {
        params.append("locationFilter", "true");
      } else if (!(user?.superAdmin === true || user?.superAdmin === "true")) {
        // Regular admins always see requests within 20km radius
        params.append("locationFilter", "true");
      }

      const response = await axios.get(
        `${API_URL}/admin/requests/pending?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setRequests(response.data);
      setDataLoaded((prev) => ({ ...prev, pendingRequests: true }));
    } catch (error: any) {
      logger.error("Error fetching requests:", error);
      toast.error(error.response?.data?.message || "Failed to fetch requests");
      setDataLoaded((prev) => ({ ...prev, pendingRequests: true }));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveRequests = async () => {
    setIsLoadingActive(true);
    try {
      const token = SessionStorage.getToken();
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (sortBy) params.append("sortBy", sortBy);
      if (sortOrder) params.append("sortOrder", sortOrder);
      // Add location filter for super admin only
      if (
        (user?.superAdmin === true || user?.superAdmin === "true") &&
        activeLocationFilter
      ) {
        params.append("locationFilter", "true");
      } else if (!(user?.superAdmin === true || user?.superAdmin === "true")) {
        // Regular admins always see requests within 20km radius
        params.append("locationFilter", "true");
      }

      const response = await axios.get(
        `${API_URL}/admin/requests/active?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setActiveRequests(response.data);
      setDataLoaded((prev) => ({ ...prev, activeRequests: true }));

      // Auto-fetch confirmation status for all active requests
      response.data.forEach((request: Request) => {
        if (request.status === "NOTIFIED" || request.status === "CONFIRMED") {
          fetchConfirmationStatus(request.id);
        }
      });
    } catch (error: any) {
      logger.error("Error fetching active requests:", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch active requests"
      );
      setDataLoaded((prev) => ({ ...prev, activeRequests: true }));
    } finally {
      setIsLoadingActive(false);
    }
  };

  const fetchAllRequests = async () => {
    setIsLoadingHistory(true);
    try {
      const token = SessionStorage.getToken();
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (sortBy) params.append("sortBy", sortBy);
      if (sortOrder) params.append("sortOrder", sortOrder);

      const response = await axios.get(
        `${API_URL}/admin/requests/all?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      let filtered = response.data;

      // Apply status filter
      if (statusFilter !== "all") {
        filtered = filtered.filter((r: Request) => r.status === statusFilter);
      }

      setAllRequests(filtered);
      setDataLoaded((prev) => ({ ...prev, allRequests: true }));
    } catch (error: any) {
      logger.error("Error fetching all requests:", error);
      toast.error(error.response?.data?.message || "Failed to fetch requests");
      setDataLoaded((prev) => ({ ...prev, allRequests: true }));
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      const token = SessionStorage.getToken();
      await axios.post(
        `${API_URL}/admin/requests/${requestId}/approve`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Request approved! Workers have been notified.", {
        id: `approve-${requestId}`,
      });
      setShowApproveModal({ show: false, requestId: null });
      fetchPendingRequests();
      // Refresh active requests to show the newly approved request
      fetchActiveRequests();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to approve request",
        { id: `approve-error-${requestId}` }
      );
    }
  };

  const handleReject = async (requestId: string) => {
    if (!confirm("Are you sure you want to reject this request?")) {
      return;
    }
    try {
      const token = SessionStorage.getToken();
      await axios.post(
        `${API_URL}/admin/requests/${requestId}/reject`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Request rejected.");
      fetchPendingRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to reject request");
    }
  };

  const fetchConfirmationStatus = async (requestId: string) => {
    setIsLoadingConfirmation({ ...isLoadingConfirmation, [requestId]: true });
    try {
      const token = SessionStorage.getToken();
      const response = await axios.get(
        `${API_URL}/admin/requests/${requestId}/confirmation-status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setConfirmationStatus({
        ...confirmationStatus,
        [requestId]: response.data,
      });
    } catch (error: any) {
      logger.error("Error fetching confirmation status:", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch confirmation status"
      );
    } finally {
      setIsLoadingConfirmation({
        ...isLoadingConfirmation,
        [requestId]: false,
      });
    }
  };

  const handleDeploy = async (requestId: string) => {
    setIsDeploying({ ...isDeploying, [requestId]: true });
    try {
      const token = SessionStorage.getToken();
      await axios.post(
        `${API_URL}/admin/requests/${requestId}/deploy`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Workers deployed successfully!", {
        id: `deploy-${requestId}`,
      });
      setShowDeployModal({ show: false, requestId: null });
      fetchPendingRequests();
      fetchAllRequests();
      // Refresh confirmation status
      delete confirmationStatus[requestId];
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to deploy workers", {
        id: `deploy-error-${requestId}`,
      });
    } finally {
      setIsDeploying({ ...isDeploying, [requestId]: false });
    }
  };

  const fetchConcerns = async () => {
    setIsLoadingConcerns(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (sortBy) params.append("sortBy", sortBy);
      if (sortOrder) params.append("sortOrder", sortOrder);
      // Add location filter for super admin only
      if (
        (user?.superAdmin === true || user?.superAdmin === "true") &&
        concernsLocationFilter
      ) {
        params.append("locationFilter", "true");
      } else if (!(user?.superAdmin === true || user?.superAdmin === "true")) {
        // Regular admins always see concerns within 20km radius
        params.append("locationFilter", "true");
      }

      const response = await apiClient.get(
        `/admin/concerns?${params.toString()}`
      );
      // Filter out RESOLVED concerns - admin only sees active concerns
      const activeConcerns = response.data.filter(
        (concern: any) => concern.status !== "RESOLVED"
      );
      setConcerns(activeConcerns);

      // Fetch messages for all concerns
      activeConcerns.forEach((concern: any) => {
        fetchConcernMessages(concern.id);
      });

      // If a concern modal is open, update the selected concern with latest data
      if (selectedConcern) {
        const updatedSelected = activeConcerns.find(
          (c: any) => c.id === selectedConcern.id
        );
        if (updatedSelected) {
          setSelectedConcern(updatedSelected);
          fetchConcernMessages(updatedSelected.id);
        }
      }
      setDataLoaded((prev) => ({ ...prev, concerns: true }));
    } catch (error: any) {
      logger.error("Error fetching concerns:", error);
      toast.error(error.response?.data?.message || "Failed to fetch concerns");
      setDataLoaded((prev) => ({ ...prev, concerns: true }));
    } finally {
      setIsLoadingConcerns(false);
    }
  };

  const fetchWorkers = async () => {
    setIsLoadingWorkers(true);
    try {
      const token = SessionStorage.getToken();
      const params = new URLSearchParams();
      if (workersSearch) params.append("search", workersSearch);
      if (workersSortBy) params.append("sortBy", workersSortBy);
      if (workersSortOrder) params.append("sortOrder", workersSortOrder);

      // For non-super admins, always apply location filter (20km radius)
      // For super admins, use the checkbox value
      const isSuperAdmin =
        user?.superAdmin === true || user?.superAdmin === "true";
      if (isSuperAdmin) {
        if (workersLocationFilter) params.append("locationFilter", "true");
      } else {
        // Regular admins always see workers within 20km radius
        params.append("locationFilter", "true");
      }

      const response = await axios.get(
        `${API_URL}/admin/workers?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setWorkers(response.data);
      setDataLoaded((prev) => ({ ...prev, workers: true }));
    } catch (error: any) {
      logger.error("Error fetching workers:", error);
      toast.error(error.response?.data?.message || "Failed to fetch workers");
      setDataLoaded((prev) => ({ ...prev, workers: true }));
    } finally {
      setIsLoadingWorkers(false);
    }
  };

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const token = SessionStorage.getToken();
      const params = new URLSearchParams();
      if (customersSearch) params.append("search", customersSearch);
      if (customersSortBy) params.append("sortBy", customersSortBy);
      if (customersSortOrder) params.append("sortOrder", customersSortOrder);

      // For non-super admins, always apply location filter (20km radius)
      // For super admins, use the checkbox value
      const isSuperAdmin =
        user?.superAdmin === true || user?.superAdmin === "true";
      if (isSuperAdmin) {
        if (customersLocationFilter) params.append("locationFilter", "true");
      } else {
        // Regular admins always see customers within 20km radius
        params.append("locationFilter", "true");
      }

      const response = await axios.get(
        `${API_URL}/admin/customers?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setCustomers(response.data);
      setDataLoaded((prev) => ({ ...prev, customers: true }));
    } catch (error: any) {
      logger.error("Error fetching customers:", error);
      toast.error(error.response?.data?.message || "Failed to fetch customers");
      setDataLoaded((prev) => ({ ...prev, customers: true }));
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const fetchSystemUsers = async () => {
    setIsLoadingSystemUsers(true);
    try {
      const token = SessionStorage.getToken();
      const params = new URLSearchParams();
      if (systemUsersSearch) params.append("search", systemUsersSearch);
      if (systemUsersSortBy) params.append("sortBy", systemUsersSortBy);
      if (systemUsersSortOrder)
        params.append("sortOrder", systemUsersSortOrder);
      if (systemUsersLocationFilter) params.append("locationFilter", "true");

      const response = await axios.get(
        `${API_URL}/admin/system-users?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSystemUsers(response.data);
      setDataLoaded((prev) => ({ ...prev, systemUsers: true }));
    } catch (error: any) {
      logger.error("Error fetching system users:", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch system users"
      );
      setDataLoaded((prev) => ({ ...prev, systemUsers: true }));
    } finally {
      setIsLoadingSystemUsers(false);
    }
  };

  const handleToggleVerification = async (workerId: string) => {
    try {
      const token = SessionStorage.getToken();
      await axios.post(
        `${API_URL}/admin/workers/${workerId}/toggle-verification`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Worker verification status updated");
      fetchWorkers();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to update verification status"
      );
    }
  };

  const handleToggleBlock = async (userId: string) => {
    try {
      const token = SessionStorage.getToken();
      const response = await axios.post(
        `${API_URL}/admin/users/${userId}/toggle-block`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success(
        response.data.blocked
          ? "User blocked successfully"
          : "User unblocked successfully"
      );
      if (activeTab === "workers") {
        fetchWorkers();
      } else if (activeTab === "customers") {
        fetchCustomers();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to update block status"
      );
    }
  };

  const fetchConcernMessages = async (concernId: string) => {
    setIsLoadingMessages({ ...isLoadingMessages, [concernId]: true });
    try {
      const response = await apiClient.get(`/concerns/${concernId}/messages`);
      setConcernMessages({ ...concernMessages, [concernId]: response.data });
    } catch (error) {
      logger.error("Error fetching messages:", error);
    } finally {
      setIsLoadingMessages({ ...isLoadingMessages, [concernId]: false });
    }
  };

  const handleUpdateConcernStatus = async (
    concernId: string,
    status: string
  ) => {
    setIsUpdatingConcern(true);
    try {
      const payload: any = {
        status: status,
      };

      const response = await apiClient.post(
        `/admin/concerns/${concernId}/update-status`,
        payload
      );

      toast.success("Concern status updated successfully!");

      // Update the selected concern with the response data
      if (response.data && response.data.concern) {
        setSelectedConcern(response.data.concern);
      }

      // Refresh concerns list
      fetchConcerns();

      // Refresh messages for this concern
      fetchConcernMessages(concernId);

      // Clear form fields
      setNewMessage("");
    } catch (error: any) {
      toast.error(
        error.message ||
          error.response?.data?.message ||
          "Failed to update concern status"
      );
    } finally {
      setIsUpdatingConcern(false);
    }
  };

  const handleAddMessage = async (concernId: string) => {
    if (!newMessage || !newMessage.trim()) {
      toast.error(t("admin.pleaseEnterMessage") || "Please enter a message", {
        id: "please-enter-message",
      });
      return;
    }

    // Check if user is a system user (negative ID) - they cannot add messages
    if (user && user.id && user.id < 0) {
      toast.error(
        "System admins cannot add messages to concern thread. Use admin response field when updating status."
      );
      return;
    }

    setIsUpdatingConcern(true);
    try {
      await apiClient.post(`/admin/concerns/${concernId}/message`, {
        message: newMessage.trim(),
      });
      toast.success("Message added successfully!");
      setNewMessage("");
      fetchConcernMessages(concernId);
      // Refresh the selected concern to show new message
      if (selectedConcern) {
        const concernsResponse = await apiClient.get("/admin/concerns");
        const updatedConcern = concernsResponse.data.find(
          (c: any) => c.id === selectedConcern.id
        );
        if (updatedConcern) {
          setSelectedConcern(updatedConcern);
        }
      }
    } catch (error: any) {
      toast.error(
        error.message ||
          error.response?.data?.message ||
          "Failed to add message"
      );
    } finally {
      setIsUpdatingConcern(false);
    }
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
    const config = statusConfig[status] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
      icon: "📋",
    };

    // Get translated status text
    const statusKey = `admin.status${status.toLowerCase().replace(/_/g, "")}`;
    const statusText = t(statusKey) || status.replace(/_/g, " ");

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} flex items-center gap-1`}
        lang={language}
      >
        <span>{config.icon}</span>
        {statusText}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    try {
      const token = SessionStorage.getToken();

      // Validate worker has a labor type selected
      if (userFormData.role === "worker" && !userFormData.workerType) {
        toast.error("Please select a labor type for the worker");
        setIsCreatingUser(false);
        return;
      }

      // Validate pin code
      if (!userFormData.pinCode || userFormData.pinCode.length !== 6) {
        toast.error("Pin Code is required and must be exactly 6 digits");
        setIsCreatingUser(false);
        return;
      }

      const data = {
        ...userFormData,
        role: userFormData.role.toUpperCase(),
        workerTypes:
          userFormData.role === "worker" && userFormData.workerType
            ? [userFormData.workerType.toUpperCase()]
            : [],
        location: {
          pinCode: userFormData.pinCode,
          state: userFormData.state,
          city: userFormData.city,
          address:
            userFormData.address ||
            (userFormData.city && userFormData.state
              ? `${userFormData.city}, ${userFormData.state} ${userFormData.pinCode}`
              : `Pin Code: ${userFormData.pinCode}`),
        },
      };

      // Remove pinCode from top level since it's in location
      const { pinCode, ...dataWithoutPinCode } = data;

      await axios.post(`${API_URL}/admin/users/create`, dataWithoutPinCode, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("User created successfully!");
      setShowCreateUser(false);
      setUserFormData({
        name: "",
        email: "",
        phone: "",
        secondaryPhone: "",
        password: "",
        role: "customer",
        workerType: "",
        isSuperAdmin: false,
        pinCode: "",
        state: "",
        city: "",
        address: "",
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create user");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const displayedRequests =
    activeTab === "pending"
      ? requests
      : activeTab === "active"
      ? activeRequests
      : allRequests;
  const isCurrentlyLoading =
    activeTab === "pending"
      ? isLoading
      : activeTab === "active"
      ? isLoadingActive
      : activeTab === "history"
      ? isLoadingHistory
      : isLoadingConcerns;

  // Pagination helper function
  const paginate = <T,>(items: T[], page: number, perPage: number) => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return {
      paginatedItems: items.slice(startIndex, endIndex),
      totalPages: Math.ceil(items.length / perPage),
      currentPage: page,
      totalItems: items.length,
    };
  };

  // Get paginated data for each tab
  const pendingPagination = paginate(requests, pendingPage, itemsPerPage);
  const activePagination = paginate(activeRequests, activePage, itemsPerPage);
  const historyPagination = paginate(allRequests, historyPage, itemsPerPage);
  const concernsPagination = paginate(concerns, concernsPage, itemsPerPage);
  const workersPagination = paginate(workers, workersPage, itemsPerPage);
  const customersPagination = paginate(customers, customersPage, itemsPerPage);
  const systemUsersPagination = paginate(
    systemUsers,
    systemUsersPage,
    itemsPerPage
  );
  const successStoriesPagination = paginate(
    successStories,
    successStoriesPage,
    itemsPerPage
  );
  const advertisementsPagination = paginate(
    advertisements,
    advertisementsPage,
    itemsPerPage
  );
  const workerTypesPagination = paginate(
    workerTypes,
    workerTypesPage,
    itemsPerPage
  );

  // Pagination component
  const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
  }) => {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages: (number | string)[] = [];
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        if (currentPage > 3) pages.push("...");
        for (
          let i = Math.max(2, currentPage - 1);
          i <= Math.min(totalPages - 1, currentPage + 1);
          i++
        ) {
          pages.push(i);
        }
        if (currentPage < totalPages - 2) pages.push("...");
        pages.push(totalPages);
      }
      return pages;
    };

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{" "}
          results
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              currentPage === 1
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Previous
          </button>
          <div className="flex gap-1">
            {getPageNumbers().map((page, index) =>
              page === "..." ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 py-2 text-gray-400"
                >
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page as number)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    currentPage === page
                      ? "bg-red-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {page}
                </button>
              )
            )}
          </div>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              currentPage === totalPages
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50 to-orange-50">
      <nav className="bg-white/90 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 md:h-16 items-center">
            <Link
              href="/"
              className="text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent hover:scale-105 transition-transform truncate"
            >
              KaamKart <span className="hidden sm:inline">(Admin)</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-4">
              <LanguageSwitcher />
              <div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-full">
                <span className="text-sm text-red-700">👑</span>
                <span className="text-sm text-red-700 font-medium">
                  {user?.name}
                </span>
              </div>
              <button
                onClick={() => {
                  SessionStorage.clear();
                  router.push("/");
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                lang={language}
              >
                {t("admin.logout")}
              </button>
            </div>

            {/* Mobile Navigation - Language Switcher and Hamburger */}
            <div className="lg:hidden flex items-center gap-2">
              <LanguageSwitcher />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
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
              <div className="px-4 py-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-700">👑</span>
                  <span className="text-sm text-red-700 font-medium">
                    {user?.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  SessionStorage.clear();
                  router.push("/");
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-4 md:mb-6 border-l-4 border-red-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1
                className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 md:mb-2"
                lang={language}
              >
                {t("admin.title")}
              </h1>
              <p className="text-sm md:text-base text-gray-600" lang={language}>
                {t("admin.subtitle")}
              </p>
            </div>
            <button
              onClick={() => {
                const newState = !showCreateUser;
                setShowCreateUser(newState);
                if (newState) {
                  // Fetch worker types when opening the form
                  fetchWorkerTypesForUserCreation();
                }
              }}
              className="px-4 py-2 md:px-6 md:py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg text-sm md:text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 transform flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <span className="text-lg md:text-xl">
                {showCreateUser ? "✕" : "+"}
              </span>
              <span lang={language}>
                {showCreateUser ? t("admin.cancel") : t("admin.createUser")}
              </span>
            </button>
          </div>
        </div>

        {/* Create User Form */}
        {showCreateUser && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 mb-8 border-2 border-green-200 relative z-10">
            <h2
              className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6"
              lang={language}
            >
              {t("admin.createNewUser")}
            </h2>
            <form
              onSubmit={handleCreateUser}
              className="space-y-4 sm:space-y-5 max-h-[85vh] overflow-y-auto pr-2 pb-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.name")}
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormData.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      const nameRegex = /^[a-zA-Z\s'\-\.]*$/;
                      if (nameRegex.test(value) || value === "") {
                        setUserFormData({ ...userFormData, name: value });
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
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder={t("admin.namePlaceholder")}
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
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.email")}
                  </label>
                  <input
                    type="email"
                    required
                    value={userFormData.email}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder={t("admin.emailPlaceholder")}
                    pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                    title={
                      t("login.invalidEmail") ||
                      "Please enter a valid email address"
                    }
                    lang={language}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.phone")}
                  </label>
                  <input
                    type="tel"
                    required
                    value={userFormData.phone}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, "");
                      if (cleaned.length <= 15) {
                        setUserFormData({ ...userFormData, phone: cleaned });
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder={t("admin.phonePlaceholder")}
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
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.password")}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={userFormData.password}
                      onChange={(e) =>
                        setUserFormData({
                          ...userFormData,
                          password: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder={t("admin.passwordPlaceholder")}
                      lang={language}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1" lang={language}>
                    {t("admin.passwordVisibleNote") ||
                      "Password is visible for your reference. Save it securely."}
                  </p>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.role")}
                  </label>
                  <select
                    required
                    value={userFormData.role}
                    onChange={(e) => {
                      const newRole = e.target.value as any;
                      setUserFormData({
                        ...userFormData,
                        role: newRole,
                        workerType: "",
                        isSuperAdmin: false,
                      });
                      // Fetch worker types when role changes to worker
                      if (newRole === "worker" && workerTypes.length === 0) {
                        fetchWorkerTypesForUserCreation();
                      }
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    lang={language}
                  >
                    <option value="customer">{t("admin.roleCustomer")}</option>
                    <option value="worker">{t("admin.roleWorker")}</option>
                    {(user?.superAdmin === true ||
                      user?.superAdmin === "true") && (
                      <option value="admin">{t("admin.roleAdmin")}</option>
                    )}
                  </select>
                  {!(
                    user?.superAdmin === true || user?.superAdmin === "true"
                  ) && (
                    <p className="text-xs text-gray-500 mt-1">
                      Only super admin can create admin users.
                      {user?.email === "admin@kaamkart.com" &&
                        " Please log out and log back in to refresh your permissions."}
                    </p>
                  )}
                  {userFormData.role === "admin" &&
                    (user?.superAdmin === true ||
                      user?.superAdmin === "true") && (
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isSuperAdmin"
                          checked={userFormData.isSuperAdmin}
                          onChange={(e) =>
                            setUserFormData({
                              ...userFormData,
                              isSuperAdmin: e.target.checked,
                            })
                          }
                          className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                        />
                        <label
                          htmlFor="isSuperAdmin"
                          className="text-sm font-medium text-gray-700 cursor-pointer"
                          lang={language}
                        >
                          ⭐ Make this admin a Super Admin
                        </label>
                      </div>
                    )}
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("login.pinCode") || "Pin Code"}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={userFormData.pinCode}
                    onChange={async (e) => {
                      const value = e.target.value.replace(/\D/g, ""); // Only digits
                      if (value.length <= 6) {
                        setUserFormData({ ...userFormData, pinCode: value });

                        // Auto-fill state, city, and address when pin code is complete
                        if (value.length === 6) {
                          try {
                            const location = await getLocationFromPinCode(
                              value
                            );
                            if (location) {
                              setUserFormData((prev) => ({
                                ...prev,
                                pinCode: value,
                                state: location.state || prev.state,
                                city: location.city || prev.city,
                                address: location.address || prev.address,
                              }));
                              setPinAddresses(location.addresses);
                              setShowAddressModal(true);
                              toast.success(
                                t("login.pinCodeDetected") ||
                                  "Location detected from Pin Code!",
                                { id: "admin-pin-code-detected" }
                              );
                            } else {
                              toast.error(
                                t("login.pinCodeNotFound") ||
                                  "Pin Code not found. Please enter a valid 6-digit pin code.",
                                { id: "admin-pin-code-not-found" }
                              );
                            }
                          } catch (error) {
                            logger.error(
                              "Error fetching location from pin code:",
                              error
                            );
                            toast.error(
                              t("login.pinCodeError") ||
                                "Error detecting location from Pin Code. Please try again.",
                              { id: "admin-pin-code-error" }
                            );
                          }
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && value.length !== 6) {
                        toast.error(
                          t("login.invalidPinCode") ||
                            "Pin Code must be exactly 6 digits"
                        );
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder={
                      t("login.pinCodePlaceholder") || "Enter 6-digit pin code"
                    }
                    pattern="[0-9]{6}"
                    title={
                      t("login.pinCodeValidation") ||
                      "Pin Code must be exactly 6 digits"
                    }
                    lang={language}
                  />
                  {userFormData.pinCode.length === 6 &&
                    (userFormData.state || userFormData.city) && (
                      <p
                        className="text-xs text-green-600 mt-1"
                        lang={language}
                      >
                        ✓ {t("login.autoDetected") || "Auto-detected"}:{" "}
                        {userFormData.city && userFormData.state
                          ? `${userFormData.city}, ${userFormData.state}`
                          : userFormData.state || userFormData.city}
                      </p>
                    )}
                </div>
              </div>

              {/* Address - Editable, auto-filled from Pin Code but can be modified */}
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-2"
                  lang={language}
                >
                  {t("login.address") || "Full Address"}{" "}
                  <span className="text-gray-500 text-xs">
                    (
                    {t("login.addressHelp") ||
                      "Auto-filled from Pin Code, but you can edit"}
                    )
                  </span>
                </label>
                <textarea
                  value={userFormData.address}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      address: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all resize-none"
                  placeholder={
                    t("login.addressPlaceholder") ||
                    "Enter your full address (auto-filled from Pin Code, but you can edit)"
                  }
                  lang={language}
                />
              </div>

              {/* ➕ ADDRESS SELECTION MODAL */}
              {showAddressModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white w-full max-w-lg rounded-xl shadow-xl p-6">
                    <h3 className="text-lg font-semibold mb-4">
                      Select Your Address
                    </h3>

                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {pinAddresses.map((po, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setUserFormData((prev: any) => ({
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

              {userFormData.role === "worker" && (
                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200 mt-4">
                  <label
                    className="block text-sm font-medium text-gray-700 mb-3"
                    lang={language}
                  >
                    {t("admin.workerType")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  {isLoadingWorkerTypes ? (
                    <p className="text-sm text-gray-500" lang={language}>
                      {t("admin.loadingWorkerTypes")}
                    </p>
                  ) : workerTypes.filter((type: any) => type.isActive)
                      .length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-red-500" lang={language}>
                        {t("admin.noActiveWorkerTypes")}
                      </p>
                      <p className="text-xs text-gray-500" lang={language}>
                        {t("admin.noActiveWorkerTypesHelp")}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-2">
                      {workerTypes
                        .filter((type: any) => type.isActive)
                        .sort(
                          (a: any, b: any) =>
                            (a.displayOrder || 0) - (b.displayOrder || 0)
                        )
                        .map((type: any) => (
                          <label
                            key={type.name}
                            className="flex items-center cursor-pointer px-3 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-all border border-gray-200 hover:border-green-300"
                          >
                            <input
                              type="radio"
                              name="workerType"
                              value={type.name.toLowerCase()}
                              checked={
                                userFormData.workerType ===
                                type.name.toLowerCase()
                              }
                              onChange={(e) =>
                                setUserFormData({
                                  ...userFormData,
                                  workerType: e.target.value,
                                })
                              }
                              className="mr-2 w-4 h-4 text-green-600 focus:ring-green-500"
                              required={userFormData.role === "worker"}
                            />
                            <span className="text-sm">
                              {type.icon || "🔧"}{" "}
                              {type.displayName || type.name}
                            </span>
                          </label>
                        ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-4 pb-4">
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-xl transition-all duration-200 hover:scale-105 transform font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  lang={language}
                >
                  {isCreatingUser ? t("admin.creating") : t("admin.createUser")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateUser(false);
                    setUserFormData({
                      name: "",
                      email: "",
                      phone: "",
                      secondaryPhone: "",
                      password: "",
                      role: "customer",
                      workerType: "",
                      isSuperAdmin: false,
                      pinCode: "",
                      state: "",
                      city: "",
                      address: "",
                    });
                  }}
                  className="flex-1 sm:flex-none px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold"
                  lang={language}
                >
                  {t("admin.cancel")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 overflow-x-auto relative z-0">
          <div className="flex gap-2 min-w-max md:min-w-0">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === "pending"
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              lang={language}
            >
              <span className="hidden sm:inline">📋 </span>
              {t("admin.pendingRequests")}
              {dataLoaded.pendingRequests && ` (${requests.length})`}
            </button>
            <button
              onClick={() => setActiveTab("active")}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === "active"
                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              lang={language}
            >
              <span className="hidden sm:inline">🚀 </span>
              {t("admin.activeRequests")}
              {dataLoaded.activeRequests && ` (${activeRequests.length})`}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === "history"
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              lang={language}
            >
              <span className="hidden sm:inline">📜 </span>
              {t("admin.allRequests")}
              {dataLoaded.allRequests && ` (${allRequests.length})`}
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
              {t("admin.concerns")}
              {dataLoaded.concerns &&
                ` (${
                  concerns.filter((c: any) => c.status === "PENDING").length
                })`}
            </button>
            <button
              onClick={() => setActiveTab("workers")}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === "workers"
                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              lang={language}
            >
              <span className="hidden sm:inline">👷 </span>
              {t("admin.workers")}
              {dataLoaded.workers && ` (${workers.length})`}
            </button>
            <button
              onClick={() => setActiveTab("customers")}
              className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                activeTab === "customers"
                  ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              lang={language}
            >
              <span className="hidden sm:inline">👥 </span>
              {t("admin.customers")}
              {dataLoaded.customers && ` (${customers.length})`}
            </button>
            {(user?.superAdmin === true || user?.superAdmin === "true") && (
              <>
                <button
                  onClick={() => setActiveTab("systemUsers")}
                  className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                    activeTab === "systemUsers"
                      ? "bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span className="hidden sm:inline">👨‍💼 </span>
                  <span lang={language}>{t("admin.systemUsers")}</span>
                  {dataLoaded.systemUsers && ` (${systemUsers.length})`}
                </button>
                <button
                  onClick={() => setActiveTab("successStories")}
                  className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                    activeTab === "successStories"
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span className="hidden sm:inline">⭐ </span>
                  <span lang={language}>{t("admin.successStories")}</span>
                  {dataLoaded.successStories && ` (${successStories.length})`}
                </button>
                <button
                  onClick={() => setActiveTab("advertisements")}
                  className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                    activeTab === "advertisements"
                      ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span className="hidden sm:inline">📢 </span>
                  <span lang={language}>{t("admin.advertisements")}</span>
                  {dataLoaded.advertisements && ` (${advertisements.length})`}
                </button>
                <button
                  onClick={() => setActiveTab("workerTypes")}
                  className={`px-3 py-2 md:px-4 md:py-3 lg:px-6 whitespace-nowrap rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                    activeTab === "workerTypes"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span className="hidden sm:inline">🔧 </span>
                  <span lang={language}>{t("admin.workerTypes")}</span>
                  {dataLoaded.workerTypes && ` (${workerTypes.length})`}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search and Filter Bar (for History tab) */}
        {activeTab === "history" && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label
                  className="block text-sm font-medium text-gray-700 mb-2"
                  lang={language}
                >
                  🔍 {t("admin.search")}
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("admin.searchPlaceholder")}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  lang={language}
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-2"
                  lang={language}
                >
                  {t("admin.sortBy")}
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  lang={language}
                >
                  <option value="date">{t("admin.sortByDate")}</option>
                  <option value="status">{t("admin.sortByStatus")}</option>
                  <option value="worktype">{t("admin.sortByWorkType")}</option>
                  <option value="customername">
                    {t("admin.sortByCustomerName")}
                  </option>
                </select>
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-2"
                  lang={language}
                >
                  {t("admin.order")}
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  lang={language}
                >
                  <option value="desc">{t("admin.newestFirst")}</option>
                  <option value="asc">{t("admin.oldestFirst")}</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label
                className="block text-sm font-medium text-gray-700 mb-2"
                lang={language}
              >
                {t("admin.filterByStatus")}
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    statusFilter === "all"
                      ? "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  lang={language}
                >
                  {t("admin.all")}
                </button>
                {[
                  "PENDING_ADMIN_APPROVAL",
                  "NOTIFIED",
                  "CONFIRMED",
                  "DEPLOYED",
                  "COMPLETED",
                  "REJECTED",
                ].map((status) => {
                  const statusKey = `status${status
                    .toLowerCase()
                    .replace(/_/g, "")}`;
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        statusFilter === status
                          ? "bg-red-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      lang={language}
                    >
                      {t(`admin.${statusKey}`) || status.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Requests List or Concerns List */}
        {activeTab === "concerns" ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
              <h2
                className="text-xl sm:text-2xl font-bold text-gray-900"
                lang={language}
              >
                {t("admin.allConcerns")}
              </h2>
              <button
                onClick={fetchConcerns}
                disabled={isLoadingConcerns}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                lang={language}
              >
                {isLoadingConcerns ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{t("admin.refreshing")}</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>{t("admin.refresh")}</span>
                  </>
                )}
              </button>
            </div>

            {/* Search, Sort, and Filter Bar for Concerns */}
            <div className="bg-gray-50 rounded-xl shadow-md p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔍 Search
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      t("admin.searchConcernsPlaceholder") ||
                      "Search concerns..."
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.sortBy")}
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    lang={language}
                  >
                    <option value="date" lang={language}>
                      {t("admin.sortByDate")}
                    </option>
                    <option value="status" lang={language}>
                      {t("admin.sortByStatus")}
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.order")}
                  </label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    lang={language}
                  >
                    <option value="desc" lang={language}>
                      {t("admin.newestFirst")}
                    </option>
                    <option value="asc" lang={language}>
                      {t("admin.oldestFirst")}
                    </option>
                  </select>
                </div>
              </div>
              {(user?.superAdmin === true || user?.superAdmin === "true") && (
                <div className="mt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={concernsLocationFilter}
                      onChange={(e) =>
                        setConcernsLocationFilter(e.target.checked)
                      }
                      className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      📍{" "}
                      {t("admin.filterByMyLocation") ||
                        "Filter by my location (within 20 km radius)"}
                    </span>
                  </label>
                </div>
              )}
            </div>

            {isCurrentlyLoading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
              </div>
            ) : concerns.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📢</div>
                <p className="text-xl text-gray-500 mb-2" lang={language}>
                  {t("admin.noConcernsYet")}
                </p>
                <p className="text-gray-400" lang={language}>
                  {t("admin.allClear")}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4 md:space-y-6 overflow-x-hidden">
                  {concernsPagination.paginatedItems.map((concern: any) => (
                    <div
                      key={concern.id}
                      className="bg-white rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 transform border-l-4 border-red-500 min-w-0"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                            <h3
                              className="text-lg sm:text-xl font-bold text-gray-900 break-words"
                              lang={language}
                            >
                              {t("admin.concern")} #{concern.id}
                            </h3>
                            <span
                              className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
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
                              {(() => {
                                const typeMap: { [key: string]: string } = {
                                  WORK_QUALITY:
                                    t("customer.workQuality") || "Work Quality",
                                  PAYMENT_ISSUE:
                                    t("customer.paymentIssue") ||
                                    "Payment Issue",
                                  BEHAVIOR:
                                    t("customer.behavior") || "Behavior",
                                  SAFETY: t("customer.safety") || "Safety",
                                  OTHER: t("customer.other") || "Other",
                                };
                                return (
                                  typeMap[concern.type] ||
                                  concern.type.replace(/_/g, " ")
                                );
                              })()}
                            </span>
                            <span
                              className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                                concern.status === "PENDING"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : concern.status === "IN_REVIEW"
                                  ? "bg-blue-100 text-blue-800"
                                  : concern.status === "RESOLVED"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                              lang={language}
                            >
                              {t(
                                `admin.concernStatus${concern.status
                                  .toLowerCase()
                                  .replace(/_/g, "")}`
                              ) || concern.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="space-y-2 text-sm text-gray-600 mb-4">
                            <p lang={language} className="break-words min-w-0">
                              <span className="font-semibold">
                                {t("admin.raisedBy")}:
                              </span>{" "}
                              {concern.raisedBy?.name || t("admin.unknown")} (
                              {concern.raisedBy?.email || t("admin.na")})
                              <span
                                className={`ml-2 px-2 py-1 rounded-full text-xs font-medium inline-block ${
                                  concern.raisedBy?.role === "CUSTOMER"
                                    ? "bg-blue-100 text-blue-800"
                                    : concern.raisedBy?.role === "WORKER"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                                lang={language}
                              >
                                {concern.raisedBy?.role === "CUSTOMER"
                                  ? t("admin.roleCustomer")
                                  : concern.raisedBy?.role === "WORKER"
                                  ? t("admin.roleWorker")
                                  : t("admin.unknown")}
                              </span>
                            </p>
                            {concern.request && (
                              <p
                                lang={language}
                                className="break-words min-w-0"
                              >
                                <span className="font-semibold">
                                  {t("admin.relatedRequest")}:
                                </span>{" "}
                                {concern.request.workType} ({t("admin.id")}:{" "}
                                {concern.request.id})
                              </p>
                            )}
                            {concern.relatedTo && (
                              <p
                                lang={language}
                                className="break-words min-w-0"
                              >
                                <span className="font-semibold">
                                  {t("admin.relatedTo")}:
                                </span>{" "}
                                {concern.relatedTo.name} (
                                {concern.relatedTo.email})
                              </p>
                            )}
                            <p lang={language} className="break-words min-w-0">
                              <span className="font-semibold">
                                {t("admin.created")}:
                              </span>{" "}
                              {new Date(concern.createdAt).toLocaleString()}
                            </p>
                            {concern.resolvedAt && (
                              <p
                                lang={language}
                                className="break-words min-w-0"
                              >
                                <span className="font-semibold">
                                  {t("admin.resolved")}:
                                </span>{" "}
                                {new Date(concern.resolvedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4">
                            <p
                              className="font-semibold text-gray-900 mb-2"
                              lang={language}
                            >
                              {t("admin.description")}:
                            </p>
                            <p
                              className="text-gray-700 break-words min-w-0"
                              lang={language}
                            >
                              {concern.description}
                            </p>
                          </div>

                          {/* Conversation Thread */}
                          <div className="mb-4">
                            <p
                              className="font-semibold text-gray-900 mb-3"
                              lang={language}
                            >
                              {t("admin.conversation")}:
                            </p>
                            {isLoadingMessages[concern.id] ? (
                              <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                              </div>
                            ) : concernMessages[concern.id] &&
                              concernMessages[concern.id].length > 0 ? (
                              <div className="space-y-3 max-h-96 overflow-y-auto">
                                {concernMessages[concern.id].map((msg: any) => {
                                  const isAdmin = msg.sentBy?.role === "ADMIN";
                                  const isRaisedBy =
                                    msg.sentBy?.id === concern.raisedBy?.id;
                                  return (
                                    <div
                                      key={msg.id}
                                      className={`p-3 rounded-lg min-w-0 ${
                                        isAdmin
                                          ? "bg-blue-50 border-l-4 border-blue-500"
                                          : isRaisedBy
                                          ? "bg-green-50 border-l-4 border-green-500"
                                          : "bg-gray-50 border-l-4 border-gray-400"
                                      }`}
                                    >
                                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-2 mb-1">
                                        <p
                                          className={`font-semibold text-sm break-words min-w-0 ${
                                            isAdmin
                                              ? "text-blue-900"
                                              : isRaisedBy
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
                                          {!isAdmin && isRaisedBy && (
                                            <span
                                              className={`ml-2 text-xs px-2 py-0.5 rounded inline-block ${
                                                concern.raisedBy?.role ===
                                                "CUSTOMER"
                                                  ? "bg-blue-100 text-blue-800"
                                                  : concern.raisedBy?.role ===
                                                    "WORKER"
                                                  ? "bg-green-100 text-green-800"
                                                  : "bg-gray-100 text-gray-800"
                                              }`}
                                            >
                                              {concern.raisedBy?.role ===
                                              "CUSTOMER"
                                                ? "Customer"
                                                : concern.raisedBy?.role ===
                                                  "WORKER"
                                                ? "Worker"
                                                : ""}
                                            </span>
                                          )}
                                        </p>
                                        <p className="text-xs text-gray-500 flex-shrink-0">
                                          {new Date(
                                            msg.createdAt
                                          ).toLocaleString()}
                                        </p>
                                      </div>
                                      <p
                                        className={`text-sm break-words min-w-0 ${
                                          isAdmin
                                            ? "text-blue-700"
                                            : isRaisedBy
                                            ? "text-green-700"
                                            : "text-gray-700"
                                        }`}
                                      >
                                        {msg.message}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p
                                className="text-gray-500 text-sm italic"
                                lang={language}
                              >
                                {t("admin.noMessagesYet")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
                        <button
                          onClick={async () => {
                            // Refresh concerns to get latest user messages before opening modal
                            try {
                              const token = SessionStorage.getToken();
                              const response = await axios.get(
                                `${API_URL}/admin/concerns`,
                                {
                                  headers: { Authorization: `Bearer ${token}` },
                                }
                              );
                              // Find the updated concern from the fresh response
                              const updatedConcern =
                                response.data.find(
                                  (c: any) => c.id === concern.id
                                ) || concern;
                              setSelectedConcern(updatedConcern);
                              // Also update the concerns list
                              const activeConcerns = response.data.filter(
                                (c: any) => c.status !== "RESOLVED"
                              );
                              setConcerns(activeConcerns);
                            } catch (error: any) {
                              logger.error("Error refreshing concern:", error);
                              // Fallback to current concern if refresh fails
                              setSelectedConcern(concern);
                            }
                          }}
                          className="flex-1 px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors text-sm sm:text-base"
                        >
                          {concern.status === "PENDING"
                            ? t("admin.reviewAndRespond")
                            : t("admin.updateStatus")}
                        </button>
                        {concern.status === "PENDING" && (
                          <button
                            onClick={() =>
                              handleUpdateConcernStatus(concern.id, "DISMISSED")
                            }
                            className="flex-1 px-3 sm:px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm sm:text-base"
                            lang={language}
                          >
                            {t("admin.dismiss")}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <PaginationControls
                  currentPage={concernsPage}
                  totalPages={concernsPagination.totalPages}
                  onPageChange={setConcernsPage}
                  totalItems={concernsPagination.totalItems}
                />
              </>
            )}
          </div>
        ) : activeTab === "workers" ? (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
              <h2
                className="text-xl sm:text-2xl font-bold text-gray-900"
                lang={language}
              >
                {t("admin.allWorkers")}
              </h2>
              <button
                onClick={fetchWorkers}
                disabled={isLoadingWorkers}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                lang={language}
              >
                {isLoadingWorkers ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{t("admin.loading")}</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>{t("admin.refresh")}</span>
                  </>
                )}
              </button>
            </div>

            {/* Search and Filter Bar for Workers */}
            <div className="bg-gray-50 rounded-xl shadow-md p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    🔍 {t("admin.search")}
                  </label>
                  <input
                    type="text"
                    value={workersSearch}
                    onChange={(e) => setWorkersSearch(e.target.value)}
                    placeholder={t("admin.searchWorkersPlaceholder")}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    lang={language}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.sortBy")}
                  </label>
                  <select
                    value={workersSortBy}
                    onChange={(e) => setWorkersSortBy(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    lang={language}
                  >
                    <option value="date">{t("admin.sortByDate")}</option>
                    <option value="name">{t("admin.sortByName")}</option>
                    <option value="rating">{t("admin.sortByRating")}</option>
                    <option value="totaljobs">
                      {t("admin.sortByTotalJobs")}
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.order")}
                  </label>
                  <select
                    value={workersSortOrder}
                    onChange={(e) => setWorkersSortOrder(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    lang={language}
                  >
                    <option value="desc">{t("admin.newestFirst")}</option>
                    <option value="asc">{t("admin.oldestFirst")}</option>
                  </select>
                </div>
              </div>
              {!(user?.superAdmin === true || user?.superAdmin === "true") && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700" lang={language}>
                    📍{" "}
                    {t("admin.viewingWorkersWithin20km") ||
                      "You are viewing workers within 20 km radius of your location"}
                  </p>
                </div>
              )}
              {(user?.superAdmin === true || user?.superAdmin === "true") && (
                <div className="mt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={workersLocationFilter}
                      onChange={(e) =>
                        setWorkersLocationFilter(e.target.checked)
                      }
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span
                      className="text-sm font-medium text-gray-700"
                      lang={language}
                    >
                      📍{" "}
                      {t("admin.filterByMyLocation") ||
                        "Filter by my location (within 20 km radius)"}
                    </span>
                  </label>
                </div>
              )}
            </div>

            {isLoadingWorkers ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : workers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👷</div>
                <p className="text-xl text-gray-500 mb-2" lang={language}>
                  {t("admin.noWorkersFound")}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-start overflow-x-hidden">
                  {workersPagination.paginatedItems.map((worker: any) => (
                    <div
                      key={worker.id}
                      className={`bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-4 md:p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-t-4 h-full flex flex-col min-w-0 ${
                        worker.blocked
                          ? "border-red-500"
                          : worker.verified
                          ? "border-green-500"
                          : "border-yellow-500"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 break-words">
                            {worker.name}
                          </h3>
                          <p className="text-sm text-gray-600 mb-1 break-words min-w-0">
                            📧 {worker.email}
                          </p>
                          <p className="text-sm text-gray-600 mb-1 break-words min-w-0">
                            📞 {worker.phone}
                          </p>
                          {worker.secondaryPhone && (
                            <p className="text-sm text-gray-600 mb-1 break-words min-w-0">
                              📱 {worker.secondaryPhone}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span
                            className="text-sm font-medium text-gray-700 flex-shrink-0"
                            lang={language}
                          >
                            {t("admin.laborTypes")}
                          </span>
                          <div className="flex flex-wrap gap-1 min-w-0">
                            {worker.workerTypes?.map((type: string) => (
                              <span
                                key={type}
                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full break-words min-w-0"
                              >
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm font-medium text-gray-700 flex-shrink-0"
                            lang={language}
                          >
                            {t("admin.rating")}
                          </span>
                          <span className="text-sm text-gray-600">
                            ⭐ {worker.rating || 0.0}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm font-medium text-gray-700 flex-shrink-0"
                            lang={language}
                          >
                            {t("admin.totalJobs")}
                          </span>
                          <span className="text-sm text-gray-600">
                            {worker.totalJobs || 0}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm font-medium text-gray-700 flex-shrink-0"
                            lang={language}
                          >
                            {t("admin.available")}
                          </span>
                          <span
                            className={`text-sm ${
                              worker.available
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                            lang={language}
                          >
                            {worker.available ? t("admin.yes") : t("admin.no")}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <button
                          onClick={() => handleToggleVerification(worker.id)}
                          className={`flex-1 px-3 sm:px-4 py-2 rounded-lg font-semibold transition-colors text-sm sm:text-base ${
                            worker.verified
                              ? "bg-green-500 text-white hover:bg-green-600"
                              : "bg-yellow-500 text-white hover:bg-yellow-600"
                          }`}
                        >
                          {worker.verified
                            ? t("admin.verified")
                            : t("admin.notVerified")}
                        </button>
                        <button
                          onClick={() => handleToggleBlock(worker.userId)}
                          className={`flex-1 px-3 sm:px-4 py-2 rounded-lg font-semibold transition-colors text-sm sm:text-base ${
                            worker.blocked
                              ? "bg-green-500 text-white hover:bg-green-600"
                              : "bg-red-500 text-white hover:bg-red-600"
                          }`}
                          lang={language}
                        >
                          {worker.blocked
                            ? t("admin.unblock")
                            : t("admin.block")}
                        </button>
                        {(user?.superAdmin === true ||
                          user?.superAdmin === "true") && (
                          <button
                            onClick={() =>
                              setEditingUserPassword({
                                id: worker.userId,
                                email: worker.email,
                                name: worker.name,
                                role: "WORKER",
                              })
                            }
                            className="flex-1 px-3 sm:px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-semibold text-sm sm:text-base"
                            lang={language}
                          >
                            🔑 Update Password
                          </button>
                        )}
                      </div>

                      {worker.currentLocation && (
                        <p className="text-xs text-gray-500 mt-2 break-words min-w-0">
                          📍{" "}
                          {worker.currentLocation.address || "Location not set"}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <PaginationControls
                  currentPage={workersPage}
                  totalPages={workersPagination.totalPages}
                  onPageChange={setWorkersPage}
                  totalItems={workersPagination.totalItems}
                />
              </>
            )}
          </div>
        ) : activeTab === "customers" ? (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
              <h2
                className="text-xl sm:text-2xl font-bold text-gray-900"
                lang={language}
              >
                {t("admin.allCustomers")}
              </h2>
              <button
                onClick={fetchCustomers}
                disabled={isLoadingCustomers}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                lang={language}
              >
                {isLoadingCustomers ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{t("admin.loading")}</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>{t("admin.refresh")}</span>
                  </>
                )}
              </button>
            </div>

            {/* Search and Filter Bar for Customers */}
            <div className="bg-gray-50 rounded-xl shadow-md p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    🔍 {t("admin.search")}
                  </label>
                  <input
                    type="text"
                    value={customersSearch}
                    onChange={(e) => setCustomersSearch(e.target.value)}
                    placeholder={t("admin.searchCustomersPlaceholder")}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                    lang={language}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.sortBy")}
                  </label>
                  <select
                    value={customersSortBy}
                    onChange={(e) => setCustomersSortBy(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    lang={language}
                  >
                    <option value="date">{t("admin.sortByDate")}</option>
                    <option value="name">{t("admin.sortByName")}</option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.order")}
                  </label>
                  <select
                    value={customersSortOrder}
                    onChange={(e) => setCustomersSortOrder(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    lang={language}
                  >
                    <option value="desc">{t("admin.newestFirst")}</option>
                    <option value="asc">{t("admin.oldestFirst")}</option>
                  </select>
                </div>
              </div>
              {!(user?.superAdmin === true || user?.superAdmin === "true") && (
                <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-700" lang={language}>
                    📍{" "}
                    {t("admin.viewingCustomersWithin20km") ||
                      "You are viewing customers within 20 km radius of your location"}
                  </p>
                </div>
              )}
              {(user?.superAdmin === true || user?.superAdmin === "true") && (
                <div className="mt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customersLocationFilter}
                      onChange={(e) =>
                        setCustomersLocationFilter(e.target.checked)
                      }
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span
                      className="text-sm font-medium text-gray-700"
                      lang={language}
                    >
                      📍{" "}
                      {t("admin.filterByMyLocation") ||
                        "Filter by my location (within 20 km radius)"}
                    </span>
                  </label>
                </div>
              )}
            </div>

            {isLoadingCustomers ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-xl text-gray-500 mb-2" lang={language}>
                  {t("admin.noCustomersFound")}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-start overflow-x-hidden">
                  {customersPagination.paginatedItems.map((customer: any) => (
                    <div
                      key={customer.id}
                      className={`bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-4 md:p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-t-4 h-full flex flex-col min-w-0 ${
                        customer.blocked
                          ? "border-red-500"
                          : "border-purple-500"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 break-words">
                            {customer.name}
                          </h3>
                          <p className="text-sm text-gray-600 mb-1 break-words min-w-0">
                            📧 {customer.email}
                          </p>
                          <p className="text-sm text-gray-600 mb-1 break-words min-w-0">
                            📞 {customer.phone}
                          </p>
                          {customer.secondaryPhone && (
                            <p className="text-sm text-gray-600 mb-1 break-words min-w-0">
                              📱 {customer.secondaryPhone}
                            </p>
                          )}
                        </div>
                      </div>

                      {customer.location && (
                        <p className="text-xs text-gray-500 mb-4 break-words min-w-0">
                          📍 {customer.location.address || "Location not set"}
                        </p>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => handleToggleBlock(customer.id)}
                          className={`flex-1 px-3 sm:px-4 py-2 rounded-lg font-semibold transition-colors text-sm sm:text-base ${
                            customer.blocked
                              ? "bg-green-500 text-white hover:bg-green-600"
                              : "bg-red-500 text-white hover:bg-red-600"
                          }`}
                        >
                          {customer.blocked
                            ? t("admin.unblock")
                            : t("admin.block")}
                        </button>
                        {(user?.superAdmin === true ||
                          user?.superAdmin === "true") && (
                          <button
                            onClick={() =>
                              setEditingUserPassword({
                                id: customer.id,
                                email: customer.email,
                                name: customer.name,
                                role: "CUSTOMER",
                              })
                            }
                            className="flex-1 px-3 sm:px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-semibold text-sm sm:text-base"
                            lang={language}
                          >
                            🔑 Update Password
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <PaginationControls
                  currentPage={customersPage}
                  totalPages={customersPagination.totalPages}
                  onPageChange={setCustomersPage}
                  totalItems={customersPagination.totalItems}
                />
              </>
            )}
          </div>
        ) : activeTab === "systemUsers" ? (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
              <h2
                className="text-xl sm:text-2xl font-bold text-gray-900"
                lang={language}
              >
                {t("admin.systemUsersAdmins")}
              </h2>
              <button
                onClick={fetchSystemUsers}
                disabled={isLoadingSystemUsers}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                lang={language}
              >
                {isLoadingSystemUsers ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{t("admin.loading")}</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>{t("admin.refresh")}</span>
                  </>
                )}
              </button>
            </div>

            {/* Search and Filter Bar for System Users */}
            <div className="bg-gray-50 rounded-xl shadow-md p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔍 Search
                  </label>
                  <input
                    type="text"
                    value={systemUsersSearch}
                    onChange={(e) => setSystemUsersSearch(e.target.value)}
                    placeholder={
                      t("admin.searchSystemUsersPlaceholder") ||
                      "Search by name, email, phone, address..."
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.sortBy")}
                  </label>
                  <select
                    value={systemUsersSortBy}
                    onChange={(e) => setSystemUsersSortBy(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    lang={language}
                  >
                    <option value="date" lang={language}>
                      {t("admin.sortByDate")}
                    </option>
                    <option value="name" lang={language}>
                      {t("admin.sortByName")}
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.order")}
                  </label>
                  <select
                    value={systemUsersSortOrder}
                    onChange={(e) => setSystemUsersSortOrder(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    lang={language}
                  >
                    <option value="desc" lang={language}>
                      {t("admin.newestFirst")}
                    </option>
                    <option value="asc" lang={language}>
                      {t("admin.oldestFirst")}
                    </option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={systemUsersLocationFilter}
                    onChange={(e) =>
                      setSystemUsersLocationFilter(e.target.checked)
                    }
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    📍 Filter by my location (within 50km radius)
                  </span>
                </label>
              </div>
            </div>

            {isLoadingSystemUsers ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : systemUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👨‍💼</div>
                <p className="text-xl text-gray-500 mb-2" lang={language}>
                  {t("admin.noSystemUsersFound")}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-start overflow-x-hidden">
                  {systemUsersPagination.paginatedItems.map(
                    (systemUser: any) => (
                      <div
                        key={systemUser.id}
                        className={`bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-4 md:p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-t-4 h-full flex flex-col min-w-0 ${
                          systemUser.blocked
                            ? "border-red-500"
                            : systemUser.superAdmin
                            ? "border-purple-500"
                            : "border-blue-500"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-3 mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 break-words">
                              {systemUser.name}
                            </h3>
                            <p className="text-sm text-gray-600 mb-1 break-words min-w-0">
                              📧 {systemUser.email}
                            </p>
                            <p className="text-sm text-gray-600 mb-1 break-words min-w-0">
                              📞 {systemUser.phone}
                            </p>
                            {systemUser.secondaryPhone && (
                              <p className="text-sm text-gray-600 mb-1 break-words min-w-0">
                                📱 {systemUser.secondaryPhone}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-700 flex-shrink-0">
                              Type:
                            </span>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                                systemUser.superAdmin
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {systemUser.superAdmin
                                ? "⭐ Super Admin"
                                : "👨‍💼 Admin"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-700 flex-shrink-0">
                              Status:
                            </span>
                            <span
                              className={`text-sm ${
                                systemUser.blocked
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {systemUser.blocked ? "🚫 Blocked" : "✓ Active"}
                            </span>
                          </div>
                        </div>

                        {systemUser.location && (
                          <p className="text-xs text-gray-500 mb-4 break-words min-w-0">
                            📍{" "}
                            {systemUser.location.address || "Location not set"}
                          </p>
                        )}

                        <p className="text-xs text-gray-400 mt-2 break-words min-w-0">
                          Created:{" "}
                          {new Date(systemUser.createdAt).toLocaleDateString()}
                        </p>

                        {(user?.superAdmin === true ||
                          user?.superAdmin === "true") && (
                          <div className="flex flex-col gap-2 mt-4">
                            <button
                              onClick={() =>
                                handleUpdateSystemUser(!systemUser.superAdmin)
                              }
                              disabled={isUpdatingSystemUser}
                              className={`px-3 sm:px-4 py-2 rounded-lg font-semibold transition-colors text-sm sm:text-base ${
                                systemUser.superAdmin
                                  ? "bg-blue-500 text-white hover:bg-blue-600"
                                  : "bg-purple-500 text-white hover:bg-purple-600"
                              } disabled:opacity-50`}
                              lang={language}
                            >
                              {systemUser.superAdmin
                                ? "👨‍💼 Remove Super Admin"
                                : "⭐ Make Super Admin"}
                            </button>
                            <button
                              onClick={() => setEditingSystemUser(systemUser)}
                              className="px-3 sm:px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-semibold text-sm sm:text-base"
                              lang={language}
                            >
                              🔑 Update Password
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
                <PaginationControls
                  currentPage={systemUsersPage}
                  totalPages={systemUsersPagination.totalPages}
                  onPageChange={setSystemUsersPage}
                  totalItems={systemUsersPagination.totalItems}
                />
              </>
            )}
          </div>
        ) : activeTab === "pending" ||
          activeTab === "active" ||
          activeTab === "history" ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2
              className="text-2xl font-bold text-gray-900 mb-6"
              lang={language}
            >
              {activeTab === "pending"
                ? t("admin.pendingApprovalRequests")
                : activeTab === "active"
                ? t("admin.activeRequestsNeedDeployment")
                : t("admin.allRequests")}
            </h2>

            {/* Search, Sort, and Filter Bar for Requests */}
            <div className="bg-gray-50 rounded-xl shadow-md p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔍 Search
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      t("admin.searchRequestsPlaceholder") ||
                      "Search requests..."
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.sortBy")}
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    lang={language}
                  >
                    <option value="date" lang={language}>
                      {t("admin.sortByDate")}
                    </option>
                    <option value="workType" lang={language}>
                      {t("admin.sortByWorkType") || "Work Type"}
                    </option>
                    <option value="status" lang={language}>
                      {t("admin.sortByStatus")}
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.order")}
                  </label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    lang={language}
                  >
                    <option value="desc" lang={language}>
                      {t("admin.newestFirst")}
                    </option>
                    <option value="asc" lang={language}>
                      {t("admin.oldestFirst")}
                    </option>
                  </select>
                </div>
              </div>
              {(user?.superAdmin === true || user?.superAdmin === "true") && (
                <div className="mt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        activeTab === "pending"
                          ? pendingLocationFilter
                          : activeLocationFilter
                      }
                      onChange={(e) => {
                        if (activeTab === "pending") {
                          setPendingLocationFilter(e.target.checked);
                        } else {
                          setActiveLocationFilter(e.target.checked);
                        }
                      }}
                      className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      📍{" "}
                      {t("admin.filterByMyLocation") ||
                        "Filter by my location (within 20 km radius)"}
                    </span>
                  </label>
                </div>
              )}
            </div>

            {isCurrentlyLoading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
              </div>
            ) : displayedRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-xl text-gray-500 mb-2">
                  {activeTab === "pending"
                    ? "No pending requests"
                    : "No requests found"}
                </p>
                <p className="text-gray-400">
                  {activeTab === "pending"
                    ? "All clear!"
                    : "Try adjusting your search or filters"}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-start overflow-x-hidden">
                  {(activeTab === "pending"
                    ? pendingPagination.paginatedItems
                    : activeTab === "active"
                    ? activePagination.paginatedItems
                    : historyPagination.paginatedItems
                  ).map((request) => (
                    <div
                      key={request.id}
                      className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-4 md:p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 transform border-t-4 border-red-500 h-full flex flex-col min-w-0"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 break-words">
                            {request.workType}
                          </h3>
                        </div>
                        <div className="flex-shrink-0 self-start sm:self-start">
                          {getStatusBadge(request.status)}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex items-start gap-2 text-gray-600 flex-wrap">
                          <span className="flex-shrink-0">⚡</span>
                          <div className="flex flex-wrap gap-1 min-w-0">
                            {request.workerTypes &&
                            request.workerTypes.length > 0 ? (
                              request.workerTypes.map(
                                (type: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs capitalize break-words min-w-0"
                                  >
                                    {type.toLowerCase()}
                                  </span>
                                )
                              )
                            ) : (
                              <span className="capitalize text-gray-500">
                                N/A
                              </span>
                            )}
                          </div>
                        </div>
                        {request.startDate && request.endDate && (
                          <div className="flex items-center gap-2 text-gray-600 flex-wrap">
                            <span className="flex-shrink-0">📅</span>
                            <span className="break-words min-w-0">
                              {new Date(request.startDate).toLocaleDateString()}{" "}
                              - {new Date(request.endDate).toLocaleDateString()}
                            </span>
                            <span className="text-xs break-words min-w-0">
                              (
                              {Math.ceil(
                                (new Date(request.endDate).getTime() -
                                  new Date(request.startDate).getTime()) /
                                  (1000 * 60 * 60 * 24)
                              ) + 1}{" "}
                              days)
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-gray-600 flex-wrap">
                          <span className="flex-shrink-0">👥</span>
                          <span className="break-words min-w-0">
                            {request.numberOfWorkers} worker
                            {request.numberOfWorkers > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 text-gray-600">
                          <span className="flex-shrink-0">📍</span>
                          <span className="break-words min-w-0">
                            {request.location?.address || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 flex-wrap">
                          <span className="flex-shrink-0">👤</span>
                          <span className="break-words min-w-0">
                            {request.customer?.name || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 flex-wrap">
                          <span className="flex-shrink-0">📧</span>
                          <span className="break-words min-w-0">
                            {request.customer?.email || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="flex-shrink-0">📞</span>
                          <span className="break-words min-w-0">
                            {request.customer?.phone || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 flex-wrap">
                          <span className="flex-shrink-0">🕒</span>
                          <span className="break-words min-w-0">
                            {formatDate(request.createdAt)}
                          </span>
                        </div>
                        {request.completedAt && (
                          <div className="flex items-center gap-2 text-purple-600">
                            <span>✅</span>
                            <span>
                              Completed: {formatDate(request.completedAt)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Confirmation Status for NOTIFIED/CONFIRMED requests */}
                      {(request.status === "NOTIFIED" ||
                        request.status === "CONFIRMED") && (
                        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-sm font-semibold text-blue-700">
                              📊 Confirmation Status
                            </p>
                            <button
                              onClick={() =>
                                fetchConfirmationStatus(request.id)
                              }
                              disabled={isLoadingConfirmation[request.id]}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                            >
                              {isLoadingConfirmation[request.id]
                                ? t("admin.loading")
                                : `🔄 ${t("admin.refresh")}`}
                            </button>
                          </div>
                          {isLoadingConfirmation[request.id] ? (
                            <div className="flex justify-center py-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            </div>
                          ) : confirmationStatus[request.id] ? (
                            <div className="space-y-3">
                              {/* Overall Summary */}
                              <div className="bg-white rounded-lg p-3 border-2 border-blue-300">
                                <div className="flex justify-between items-center mb-2">
                                  <span
                                    className="text-sm font-bold text-gray-800"
                                    lang={language}
                                  >
                                    {t("admin.overallStatus")}
                                  </span>
                                  <span
                                    className={`text-sm font-bold ${
                                      confirmationStatus[request.id]
                                        .allRequirementsMet
                                        ? "text-green-600"
                                        : "text-orange-600"
                                    }`}
                                  >
                                    {
                                      confirmationStatus[request.id]
                                        .totalConfirmed
                                    }{" "}
                                    /{" "}
                                    {
                                      confirmationStatus[request.id]
                                        .totalRequired
                                    }
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="bg-green-50 rounded p-2 border border-green-200">
                                    <div className="text-green-700 font-semibold">
                                      ✓ Confirmed
                                    </div>
                                    <div className="text-green-600 text-lg font-bold">
                                      {
                                        confirmationStatus[request.id]
                                          .totalConfirmed
                                      }
                                    </div>
                                  </div>
                                  <div className="bg-orange-50 rounded p-2 border border-orange-200">
                                    <div className="text-orange-700 font-semibold">
                                      ⏳ Pending
                                    </div>
                                    <div className="text-orange-600 text-lg font-bold">
                                      {confirmationStatus[request.id]
                                        .totalPending || 0}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Per Labor Type Status */}
                              {confirmationStatus[request.id]
                                .workerTypeStatus && (
                                <div className="space-y-2">
                                  <div
                                    className="text-xs font-semibold text-gray-700 mb-1"
                                    lang={language}
                                  >
                                    {t("admin.perLaborType")}
                                  </div>
                                  {confirmationStatus[
                                    request.id
                                  ].workerTypeStatus.map(
                                    (ltStatus: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="bg-white rounded p-2 border border-blue-200"
                                      >
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-semibold text-gray-700 capitalize">
                                            {ltStatus.workerType
                                              .toLowerCase()
                                              .replace("_", " ")}
                                          </span>
                                          <div className="flex gap-2">
                                            <span
                                              className={`text-xs font-semibold ${
                                                ltStatus.canDeploy
                                                  ? "text-green-600"
                                                  : "text-orange-600"
                                              }`}
                                            >
                                              ✓ {ltStatus.confirmed} /{" "}
                                              {ltStatus.required}
                                            </span>
                                            {ltStatus.pending > 0 && (
                                              <span className="text-xs font-semibold text-orange-600">
                                                ⏳ {ltStatus.pending} pending
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        {ltStatus.confirmedWorkers &&
                                          ltStatus.confirmedWorkers.length >
                                            0 && (
                                            <div className="mt-1 space-y-1">
                                              {ltStatus.confirmedWorkers
                                                .slice(0, 3)
                                                .map(
                                                  (
                                                    worker: any,
                                                    wIdx: number
                                                  ) => (
                                                    <p
                                                      key={wIdx}
                                                      className="text-xs text-gray-600"
                                                    >
                                                      • {worker.name} (
                                                      {worker.phone})
                                                    </p>
                                                  )
                                                )}
                                              {ltStatus.confirmedWorkers
                                                .length > 3 && (
                                                <p className="text-xs text-gray-500">
                                                  +
                                                  {ltStatus.confirmedWorkers
                                                    .length - 3}{" "}
                                                  more
                                                </p>
                                              )}
                                            </div>
                                          )}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                              {confirmationStatus[request.id].canDeploy && (
                                <div className="mt-3 space-y-2">
                                  <div
                                    className={`border-2 rounded-lg p-3 text-center ${
                                      confirmationStatus[request.id]
                                        .allRequirementsMet
                                        ? "bg-green-50 border-green-400"
                                        : "bg-yellow-50 border-yellow-400"
                                    }`}
                                  >
                                    <p
                                      className={`text-sm font-bold mb-2 ${
                                        confirmationStatus[request.id]
                                          .allRequirementsMet
                                          ? "text-green-700"
                                          : "text-yellow-700"
                                      }`}
                                    >
                                      {confirmationStatus[request.id]
                                        .allRequirementsMet
                                        ? "✅ All Required Workers Confirmed!"
                                        : "⚠️ Few workers are available to deploy. Check with customer to deploy"}
                                    </p>
                                    <button
                                      onClick={() =>
                                        setShowDeployModal({
                                          show: true,
                                          requestId: request.id,
                                        })
                                      }
                                      disabled={isDeploying[request.id]}
                                      className="w-full mt-3 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
                                    >
                                      {isDeploying[request.id]
                                        ? "Deploying..."
                                        : "🚀 Deploy Workers to Customer"}
                                    </button>
                                    {!confirmationStatus[request.id]
                                      .allRequirementsMet && (
                                      <p className="text-xs text-yellow-600 mt-2">
                                        ⏳{" "}
                                        {
                                          confirmationStatus[request.id]
                                            .totalConfirmed
                                        }{" "}
                                        confirmed,{" "}
                                        {confirmationStatus[request.id]
                                          .totalPending || 0}{" "}
                                        more worker(s) still pending
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                              {!confirmationStatus[request.id].canDeploy && (
                                <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-2 text-center">
                                  <p className="text-xs text-orange-700">
                                    ⏳ Waiting for workers to confirm
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                fetchConfirmationStatus(request.id)
                              }
                              className="w-full text-xs px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              Click to view confirmation status
                            </button>
                          )}
                        </div>
                      )}

                      {request.deployedWorkers &&
                        request.deployedWorkers.length > 0 && (
                          <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-sm font-semibold text-green-700 mb-2">
                              🚀 Deployed Workers (
                              {request.deployedWorkers.length})
                            </p>
                            <div className="space-y-1">
                              {request.deployedWorkers.map(
                                (dw: any, idx: number) => (
                                  <p
                                    key={idx}
                                    className="text-xs text-green-600"
                                  >
                                    • {dw.worker?.name || "Worker"}
                                  </p>
                                )
                              )}
                            </div>
                          </div>
                        )}

                      {activeTab === "pending" &&
                        request.status === "PENDING_ADMIN_APPROVAL" && (
                          <div className="flex gap-3 mt-4">
                            <button
                              onClick={() =>
                                setShowApproveModal({
                                  show: true,
                                  requestId: request.id,
                                })
                              }
                              className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => handleReject(request.id)}
                              className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                            >
                              ✗ Reject
                            </button>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
                <PaginationControls
                  currentPage={
                    activeTab === "pending"
                      ? pendingPage
                      : activeTab === "active"
                      ? activePage
                      : historyPage
                  }
                  totalPages={
                    activeTab === "pending"
                      ? pendingPagination.totalPages
                      : activeTab === "active"
                      ? activePagination.totalPages
                      : historyPagination.totalPages
                  }
                  onPageChange={
                    activeTab === "pending"
                      ? setPendingPage
                      : activeTab === "active"
                      ? setActivePage
                      : setHistoryPage
                  }
                  totalItems={
                    activeTab === "pending"
                      ? pendingPagination.totalItems
                      : activeTab === "active"
                      ? activePagination.totalItems
                      : historyPagination.totalItems
                  }
                />
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Concern Review Modal */}
      {selectedConcern && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 w-full max-w-lg relative my-auto max-h-[95vh] overflow-y-auto">
            <h3
              className="text-2xl font-bold text-gray-900 mb-6"
              lang={language}
            >
              {t("admin.reviewConcern")} #{selectedConcern.id}
            </h3>
            <button
              onClick={() => {
                setSelectedConcern(null);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
            >
              &times;
            </button>
            <div className="space-y-4 mb-6">
              <div>
                <p className="font-semibold text-gray-900 mb-1">Type:</p>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedConcern.type === "WORK_QUALITY"
                      ? "bg-blue-100 text-blue-800"
                      : selectedConcern.type === "PAYMENT_ISSUE"
                      ? "bg-yellow-100 text-yellow-800"
                      : selectedConcern.type === "BEHAVIOR"
                      ? "bg-red-100 text-red-800"
                      : selectedConcern.type === "SAFETY"
                      ? "bg-orange-100 text-orange-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {(() => {
                    const typeMap: { [key: string]: string } = {
                      WORK_QUALITY: t("customer.workQuality") || "Work Quality",
                      PAYMENT_ISSUE:
                        t("customer.paymentIssue") || "Payment Issue",
                      BEHAVIOR: t("customer.behavior") || "Behavior",
                      SAFETY: t("customer.safety") || "Safety",
                      OTHER: t("customer.other") || "Other",
                    };
                    return (
                      typeMap[selectedConcern.type] ||
                      selectedConcern.type.replace(/_/g, " ")
                    );
                  })()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">Raised by:</p>
                <div className="flex items-center gap-2">
                  <p className="text-gray-700">
                    {selectedConcern.raisedBy?.name} (
                    {selectedConcern.raisedBy?.email})
                  </p>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      selectedConcern.raisedBy?.role === "CUSTOMER"
                        ? "bg-blue-100 text-blue-800"
                        : selectedConcern.raisedBy?.role === "WORKER"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {selectedConcern.raisedBy?.role === "CUSTOMER"
                      ? "Customer"
                      : selectedConcern.raisedBy?.role === "WORKER"
                      ? "Worker"
                      : "Unknown"}
                  </span>
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">Description:</p>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {selectedConcern.description}
                </p>
              </div>

              {/* Conversation Thread */}
              <div className="mb-4">
                <p className="font-semibold text-gray-900 mb-3">
                  Conversation:
                </p>
                {isLoadingMessages[selectedConcern.id] ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                  </div>
                ) : concernMessages[selectedConcern.id] &&
                  concernMessages[selectedConcern.id].length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                    {concernMessages[selectedConcern.id].map((msg: any) => {
                      const isAdmin = msg.sentBy?.role === "ADMIN";
                      const isRaisedBy =
                        msg.sentBy?.id === selectedConcern.raisedBy?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg ${
                            isAdmin
                              ? "bg-blue-50 border-l-4 border-blue-500"
                              : isRaisedBy
                              ? "bg-green-50 border-l-4 border-green-500"
                              : "bg-gray-50 border-l-4 border-gray-400"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p
                              className={`font-semibold text-sm ${
                                isAdmin
                                  ? "text-blue-900"
                                  : isRaisedBy
                                  ? "text-green-900"
                                  : "text-gray-900"
                              }`}
                            >
                              {msg.sentBy?.name || "Unknown"}
                              {isAdmin && (
                                <span className="ml-2 text-xs">(Admin)</span>
                              )}
                              {!isAdmin && isRaisedBy && (
                                <span
                                  className={`ml-2 text-xs px-2 py-0.5 rounded ${
                                    selectedConcern.raisedBy?.role ===
                                    "CUSTOMER"
                                      ? "bg-blue-100 text-blue-800"
                                      : selectedConcern.raisedBy?.role ===
                                        "WORKER"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {selectedConcern.raisedBy?.role === "CUSTOMER"
                                    ? "Customer"
                                    : selectedConcern.raisedBy?.role ===
                                      "WORKER"
                                    ? "Worker"
                                    : ""}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(msg.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <p
                            className={`text-sm ${
                              isAdmin
                                ? "text-blue-700"
                                : isRaisedBy
                                ? "text-green-700"
                                : "text-gray-700"
                            }`}
                          >
                            {msg.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p
                    className="text-gray-500 text-sm italic mb-4"
                    lang={language}
                  >
                    {t("admin.noMessagesYet")}
                  </p>
                )}

                {/* Add Message Section - Available for all admins (system and regular) */}
                <div className="border-t border-gray-200 pt-4">
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.addMessage")}:
                  </label>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onBlur={(e) => {
                      if (!e.target.value.trim()) {
                        toast.error(
                          t("admin.pleaseEnterMessage") ||
                            "Please enter a message",
                          { id: "please-enter-message" }
                        );
                      }
                    }}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-2"
                    rows={3}
                    placeholder={
                      t("admin.messagePlaceholder") ||
                      "Type your message here..."
                    }
                    minLength={1}
                    required
                    lang={language}
                  />
                  <button
                    onClick={() => handleAddMessage(selectedConcern.id)}
                    disabled={isUpdatingConcern || !newMessage.trim()}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-2 rounded-lg font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105 transform disabled:opacity-50"
                    lang={language}
                  >
                    {isUpdatingConcern
                      ? t("admin.adding")
                      : t("admin.addMessage")}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-2"
                  lang={language}
                >
                  {t("admin.updateStatus")}:
                </label>
                <select
                  value={selectedConcern.status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    handleUpdateConcernStatus(selectedConcern.id, newStatus);
                  }}
                  disabled={isUpdatingConcern}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50"
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_REVIEW">
                    {t("admin.inReview") || "In Review"}
                  </option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="DISMISSED">Dismissed</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    handleUpdateConcernStatus(selectedConcern.id, "RESOLVED")
                  }
                  disabled={
                    isUpdatingConcern || selectedConcern.status === "RESOLVED"
                  }
                  className="flex-1 bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✓ Mark as Resolved
                </button>
                <button
                  onClick={() =>
                    handleUpdateConcernStatus(selectedConcern.id, "IN_REVIEW")
                  }
                  disabled={
                    isUpdatingConcern || selectedConcern.status === "IN_REVIEW"
                  }
                  className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔍 {t("admin.markAsInReview")}
                </button>
                <button
                  onClick={() =>
                    handleUpdateConcernStatus(selectedConcern.id, "DISMISSED")
                  }
                  disabled={
                    isUpdatingConcern || selectedConcern.status === "DISMISSED"
                  }
                  className="flex-1 bg-gray-500 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✗ Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Stories Tab */}
      {activeTab === "successStories" &&
        (user?.superAdmin === true || user?.superAdmin === "true") && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800" lang={language}>
                ⭐ {t("admin.successStoriesManagement")}
              </h2>
              <button
                onClick={() => {
                  setEditingStory(null);
                  setStoryFormData({
                    title: "",
                    description: "",
                    storyType: "customer",
                    name: "",
                    workerType: "",
                    rating: 5,
                    imageUrl: "",
                    isActive: true,
                    displayOrder: 0,
                  });
                  setShowStoryForm(true);
                }}
                className="bg-green-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors"
              >
                + {t("admin.createSuccessStory")}
              </button>
            </div>

            {showStoryForm && (
              <div className="mb-6 bg-gray-50 rounded-xl p-6 border-2 border-gray-200">
                <h3 className="text-xl font-bold mb-4">
                  {editingStory
                    ? t("admin.editSuccessStory")
                    : t("admin.createSuccessStory")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      lang={language}
                    >
                      {t("admin.title")} *
                    </label>
                    <input
                      type="text"
                      value={storyFormData.title}
                      onChange={(e) =>
                        setStoryFormData({
                          ...storyFormData,
                          title: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder={
                        t("admin.enterStoryTitle") || "Enter story title"
                      }
                      lang={language}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={storyFormData.displayOrder}
                      onChange={(e) =>
                        setStoryFormData({
                          ...storyFormData,
                          displayOrder: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      lang={language}
                    >
                      {t("admin.description")} *
                    </label>
                    <textarea
                      value={storyFormData.description}
                      onChange={(e) =>
                        setStoryFormData({
                          ...storyFormData,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      rows={4}
                      placeholder={
                        t("admin.enterStoryDescription") ||
                        "Enter story description"
                      }
                      lang={language}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      lang={language}
                    >
                      {t("admin.storyType")} *
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="storyType"
                          value="customer"
                          checked={storyFormData.storyType === "customer"}
                          onChange={(e) => {
                            setStoryFormData({
                              ...storyFormData,
                              storyType: "customer",
                              name: "",
                            });
                          }}
                          className="w-4 h-4"
                        />
                        <span
                          className="text-sm font-medium text-gray-700"
                          lang={language}
                        >
                          {t("admin.customerStory")}
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="storyType"
                          value="worker"
                          checked={storyFormData.storyType === "worker"}
                          onChange={(e) => {
                            setStoryFormData({
                              ...storyFormData,
                              storyType: "worker",
                              name: "",
                            });
                          }}
                          className="w-4 h-4"
                        />
                        <span
                          className="text-sm font-medium text-gray-700"
                          lang={language}
                        >
                          {t("admin.workerStory")}
                        </span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      lang={language}
                    >
                      {storyFormData.storyType === "customer"
                        ? t("admin.customerName")
                        : t("admin.workerName")}{" "}
                      *
                    </label>
                    <input
                      type="text"
                      value={storyFormData.name}
                      onChange={(e) =>
                        setStoryFormData({
                          ...storyFormData,
                          name: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder={
                        storyFormData.storyType === "customer"
                          ? t("admin.enterCustomerName")
                          : t("admin.enterWorkerName")
                      }
                      lang={language}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      lang={language}
                    >
                      {t("admin.laborType")}
                    </label>
                    <input
                      type="text"
                      value={storyFormData.workerType}
                      onChange={(e) =>
                        setStoryFormData({
                          ...storyFormData,
                          workerType: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rating (1-5)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={storyFormData.rating}
                      onChange={(e) =>
                        setStoryFormData({
                          ...storyFormData,
                          rating: parseInt(e.target.value) || 5,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("admin.imageUrl") || "Image URL"}
                    </label>
                    <input
                      type="url"
                      value={storyFormData.imageUrl}
                      onChange={(e) =>
                        setStoryFormData({
                          ...storyFormData,
                          imageUrl: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={storyFormData.isActive}
                        onChange={(e) =>
                          setStoryFormData({
                            ...storyFormData,
                            isActive: e.target.checked,
                          })
                        }
                        className="w-5 h-5"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Active (Show on homepage)
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={async () => {
                      try {
                        const token = SessionStorage.getToken();
                        // Prepare data: set customerName or workerName based on storyType
                        const payload = {
                          ...storyFormData,
                          customerName:
                            storyFormData.storyType === "customer"
                              ? storyFormData.name
                              : "",
                          workerName:
                            storyFormData.storyType === "worker"
                              ? storyFormData.name
                              : "",
                          // Remove storyType and name from payload as backend doesn't need them
                        };
                        const { storyType, name, ...dataToSend } = payload;

                        if (editingStory) {
                          await axios.put(
                            `${API_URL}/admin/success-stories/${editingStory.id}`,
                            dataToSend,
                            {
                              headers: { Authorization: `Bearer ${token}` },
                            }
                          );
                          toast.success(
                            t("admin.successStoryUpdated") ||
                              "Success story updated!",
                            { id: "success-story-updated" }
                          );
                        } else {
                          await axios.post(
                            `${API_URL}/admin/success-stories`,
                            dataToSend,
                            {
                              headers: { Authorization: `Bearer ${token}` },
                            }
                          );
                          toast.success(
                            t("admin.successStoryCreated") ||
                              "Success story created!",
                            { id: "success-story-created" }
                          );
                        }
                        setShowStoryForm(false);
                        fetchSuccessStories();
                      } catch (error: any) {
                        toast.error(
                          error.response?.data?.message ||
                            "Failed to save success story"
                        );
                      }
                    }}
                    className="bg-green-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors"
                  >
                    {editingStory ? "Update" : "Create"}
                  </button>
                  <button
                    onClick={() => {
                      setShowStoryForm(false);
                      setEditingStory(null);
                    }}
                    className="bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {isLoadingStories ? (
              <div className="text-center py-8" lang={language}>
                {t("admin.loading")}
              </div>
            ) : successStories.length === 0 ? (
              <div className="text-center py-8 text-gray-500" lang={language}>
                {t("admin.noSuccessStoriesYet")}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {successStoriesPagination.paginatedItems.map((story) => (
                    <div
                      key={story.id}
                      className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold text-gray-800">
                          {story.title}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            story.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {story.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-4 line-clamp-3">
                        {story.description}
                      </p>
                      {story.rating && (
                        <div className="flex items-center gap-1 mb-2">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={
                                i < story.rating
                                  ? "text-yellow-400"
                                  : "text-gray-300"
                              }
                            >
                              ⭐
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => {
                            setEditingStory(story);
                            // Determine story type based on which name exists
                            const storyType = story.customerName
                              ? "customer"
                              : "worker";
                            const name =
                              story.customerName || story.workerName || "";
                            setStoryFormData({
                              title: story.title || "",
                              description: story.description || "",
                              storyType: storyType,
                              name: name,
                              workerType: story.workerType || "",
                              rating: story.rating || 5,
                              imageUrl: story.imageUrl || "",
                              isActive: story.isActive !== false,
                              displayOrder: story.displayOrder || 0,
                            });
                            setShowStoryForm(true);
                          }}
                          className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (
                              !confirm(
                                "Are you sure you want to delete this success story?"
                              )
                            )
                              return;
                            try {
                              const token = SessionStorage.getToken();
                              await axios.delete(
                                `${API_URL}/admin/success-stories/${story.id}`,
                                {
                                  headers: { Authorization: `Bearer ${token}` },
                                }
                              );
                              toast.success(
                                t("admin.successStoryDeleted") ||
                                  "Success story deleted!",
                                { id: "success-story-deleted" }
                              );
                              fetchSuccessStories();
                            } catch (error: any) {
                              toast.error(
                                error.response?.data?.message ||
                                  "Failed to delete success story"
                              );
                            }
                          }}
                          className="flex-1 bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <PaginationControls
                  currentPage={successStoriesPage}
                  totalPages={successStoriesPagination.totalPages}
                  onPageChange={setSuccessStoriesPage}
                  totalItems={successStoriesPagination.totalItems}
                />
              </>
            )}
          </div>
        )}

      {/* Advertisements Tab */}
      {activeTab === "advertisements" &&
        (user?.superAdmin === true || user?.superAdmin === "true") && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800" lang={language}>
                📢 {t("admin.advertisementManagement")}
              </h2>
              <button
                onClick={() => {
                  setEditingAd(null);
                  setAdFormData({
                    title: "",
                    text: "",
                    imageUrl: "",
                    linkUrl: "",
                    linkText: "",
                    isActive: true,
                    displayOrder: 0,
                    startDate: "",
                    endDate: "",
                  });
                  setShowAdForm(true);
                }}
                className="bg-yellow-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-yellow-600 transition-colors"
              >
                + {t("admin.createAdvertisement")}
              </button>
            </div>

            {/* Search and Sort Bar for Advertisements */}
            <div className="bg-gray-50 rounded-xl shadow-md p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔍 Search
                  </label>
                  <input
                    type="text"
                    value={advertisementsSearch}
                    onChange={(e) => setAdvertisementsSearch(e.target.value)}
                    placeholder={
                      t("admin.searchAdvertisementsPlaceholder") ||
                      "Search advertisements..."
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.sortBy")}
                  </label>
                  <select
                    value={advertisementsSortBy}
                    onChange={(e) => setAdvertisementsSortBy(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    lang={language}
                  >
                    <option value="date" lang={language}>
                      {t("admin.sortByDate")}
                    </option>
                    <option value="title" lang={language}>
                      {t("admin.sortByTitle") || "Title"}
                    </option>
                    <option value="displayOrder" lang={language}>
                      {t("admin.sortByDisplayOrder") || "Display Order"}
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.order")}
                  </label>
                  <select
                    value={advertisementsSortOrder}
                    onChange={(e) => setAdvertisementsSortOrder(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    lang={language}
                  >
                    <option value="desc" lang={language}>
                      {t("admin.newestFirst")}
                    </option>
                    <option value="asc" lang={language}>
                      {t("admin.oldestFirst")}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {showAdForm && (
              <div className="mb-6 bg-gray-50 rounded-xl p-6 border-2 border-gray-200">
                <h3 className="text-xl font-bold mb-4">
                  {editingAd
                    ? t("admin.editAdvertisement")
                    : t("admin.createAdvertisement")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("admin.title") || "Title"}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={adFormData.title}
                      onChange={(e) =>
                        setAdFormData({ ...adFormData, title: e.target.value })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      placeholder="Enter ad title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={adFormData.displayOrder}
                      onChange={(e) =>
                        setAdFormData({
                          ...adFormData,
                          displayOrder: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Advertisement Text *
                    </label>
                    <textarea
                      value={adFormData.text}
                      onChange={(e) =>
                        setAdFormData({ ...adFormData, text: e.target.value })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      rows={3}
                      placeholder="Enter advertisement text/content"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Link URL
                    </label>
                    <input
                      type="url"
                      value={adFormData.linkUrl}
                      onChange={(e) =>
                        setAdFormData({
                          ...adFormData,
                          linkUrl: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Link Text
                    </label>
                    <input
                      type="text"
                      value={adFormData.linkText}
                      onChange={(e) =>
                        setAdFormData({
                          ...adFormData,
                          linkText: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      placeholder="Learn More"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("admin.imageUrl") || "Image URL"}
                    </label>
                    <input
                      type="url"
                      value={adFormData.imageUrl}
                      onChange={(e) =>
                        setAdFormData({
                          ...adFormData,
                          imageUrl: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={adFormData.startDate}
                      onChange={(e) =>
                        setAdFormData({
                          ...adFormData,
                          startDate: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={adFormData.endDate}
                      onChange={(e) =>
                        setAdFormData({
                          ...adFormData,
                          endDate: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={adFormData.isActive}
                        onChange={(e) =>
                          setAdFormData({
                            ...adFormData,
                            isActive: e.target.checked,
                          })
                        }
                        className="w-5 h-5"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Active (Show on homepage)
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={async () => {
                      try {
                        const token = SessionStorage.getToken();
                        const payload = {
                          ...adFormData,
                          startDate: adFormData.startDate
                            ? new Date(adFormData.startDate).toISOString()
                            : null,
                          endDate: adFormData.endDate
                            ? new Date(adFormData.endDate).toISOString()
                            : null,
                        };
                        if (editingAd) {
                          await axios.put(
                            `${API_URL}/admin/advertisements/${editingAd.id}`,
                            payload,
                            {
                              headers: { Authorization: `Bearer ${token}` },
                            }
                          );
                          toast.success("Advertisement updated!");
                        } else {
                          await axios.post(
                            `${API_URL}/admin/advertisements`,
                            payload,
                            {
                              headers: { Authorization: `Bearer ${token}` },
                            }
                          );
                          toast.success("Advertisement created!");
                        }
                        setShowAdForm(false);
                        fetchAdvertisements();
                      } catch (error: any) {
                        toast.error(
                          error.response?.data?.message ||
                            "Failed to save advertisement"
                        );
                      }
                    }}
                    className="bg-yellow-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-yellow-600 transition-colors"
                  >
                    {editingAd ? "Update" : "Create"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAdForm(false);
                      setEditingAd(null);
                    }}
                    className="bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {isLoadingAds ? (
              <div className="text-center py-8" lang={language}>
                {t("admin.loading")}
              </div>
            ) : advertisements.length === 0 ? (
              <div className="text-center py-8 text-gray-500" lang={language}>
                {t("admin.noAdvertisementsYet")}
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {advertisementsPagination.paginatedItems.map((ad) => (
                    <div
                      key={ad.id}
                      className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">
                            {ad.title}
                          </h3>
                          <p className="text-gray-600 mt-2">{ad.text}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            ad.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {ad.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {ad.linkUrl && (
                        <div className="mb-2">
                          <a
                            href={ad.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {ad.linkText || ad.linkUrl}
                          </a>
                        </div>
                      )}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => {
                            setEditingAd(ad);
                            setAdFormData({
                              title: ad.title || "",
                              text: ad.text || "",
                              imageUrl: ad.imageUrl || "",
                              linkUrl: ad.linkUrl || "",
                              linkText: ad.linkText || "",
                              isActive: ad.isActive !== false,
                              displayOrder: ad.displayOrder || 0,
                              startDate: ad.startDate
                                ? new Date(ad.startDate)
                                    .toISOString()
                                    .slice(0, 16)
                                : "",
                              endDate: ad.endDate
                                ? new Date(ad.endDate)
                                    .toISOString()
                                    .slice(0, 16)
                                : "",
                            });
                            setShowAdForm(true);
                          }}
                          className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (
                              !confirm(
                                "Are you sure you want to delete this advertisement?"
                              )
                            )
                              return;
                            try {
                              const token = SessionStorage.getToken();
                              await axios.delete(
                                `${API_URL}/admin/advertisements/${ad.id}`,
                                {
                                  headers: { Authorization: `Bearer ${token}` },
                                }
                              );
                              toast.success("Advertisement deleted!");
                              fetchAdvertisements();
                            } catch (error: any) {
                              toast.error(
                                error.response?.data?.message ||
                                  "Failed to delete advertisement"
                              );
                            }
                          }}
                          className="flex-1 bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <PaginationControls
                  currentPage={advertisementsPage}
                  totalPages={advertisementsPagination.totalPages}
                  onPageChange={setAdvertisementsPage}
                  totalItems={advertisementsPagination.totalItems}
                />
              </>
            )}
          </div>
        )}

      {/* Labor Types Tab */}
      {activeTab === "workerTypes" &&
        (user?.superAdmin === true || user?.superAdmin === "true") && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800" lang={language}>
                🔧 {t("admin.workerTypeManagement")}
              </h2>
              <button
                onClick={() => {
                  setEditingWorkerType(null);
                  setWorkerTypeFormData({
                    name: "",
                    displayName: "",
                    icon: "",
                    description: "",
                    isActive: true,
                    displayOrder: 0,
                  });
                  setShowWorkerTypeForm(true);
                }}
                className="bg-purple-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-600 transition-colors"
              >
                + {t("admin.addWorkerType")}
              </button>
            </div>

            {/* Search and Sort Bar for Worker Types */}
            <div className="bg-gray-50 rounded-xl shadow-md p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔍 Search
                  </label>
                  <input
                    type="text"
                    value={workerTypesSearch}
                    onChange={(e) => setWorkerTypesSearch(e.target.value)}
                    placeholder={
                      t("admin.searchWorkerTypesPlaceholder") ||
                      "Search worker types..."
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.sortBy")}
                  </label>
                  <select
                    value={workerTypesSortBy}
                    onChange={(e) => setWorkerTypesSortBy(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    lang={language}
                  >
                    <option value="displayOrder" lang={language}>
                      {t("admin.sortByDisplayOrder") || "Display Order"}
                    </option>
                    <option value="name" lang={language}>
                      {t("admin.sortByName")}
                    </option>
                    <option value="displayName" lang={language}>
                      {t("admin.sortByDisplayName") || "Display Name"}
                    </option>
                    <option value="isActive" lang={language}>
                      {t("admin.sortByStatus")}
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    lang={language}
                  >
                    {t("admin.order")}
                  </label>
                  <select
                    value={workerTypesSortOrder}
                    onChange={(e) => setWorkerTypesSortOrder(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    lang={language}
                  >
                    <option value="asc" lang={language}>
                      {t("admin.ascending") || "Ascending"}
                    </option>
                    <option value="desc" lang={language}>
                      {t("admin.descending") || "Descending"}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {showWorkerTypeForm && (
              <div className="mb-6 bg-gray-50 rounded-xl p-6 border-2 border-gray-200">
                <h3 className="text-xl font-bold mb-4" lang={language}>
                  {editingWorkerType
                    ? t("admin.editWorkerType")
                    : t("admin.addWorkerType")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      lang={language}
                    >
                      {t("admin.workerTypeNameCode")}
                    </label>
                    <input
                      type="text"
                      value={workerTypeFormData.name}
                      onChange={(e) =>
                        setWorkerTypeFormData({
                          ...workerTypeFormData,
                          name: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., ELECTRICIAN"
                      disabled={!!editingWorkerType}
                      lang={language}
                    />
                    <p className="text-xs text-gray-500 mt-1" lang={language}>
                      {t("admin.workerTypeNameCodeHelp")}
                    </p>
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      lang={language}
                    >
                      {t("admin.workerTypeDisplayName")}
                    </label>
                    <input
                      type="text"
                      value={workerTypeFormData.displayName}
                      onChange={(e) =>
                        setWorkerTypeFormData({
                          ...workerTypeFormData,
                          displayName: e.target.value,
                        })
                      }
                      className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., Electrician"
                      lang={language}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      lang={language}
                    >
                      {t("admin.workerTypeIcon")}
                    </label>
                    <input
                      type="text"
                      value={workerTypeFormData.icon}
                      onChange={(e) =>
                        setWorkerTypeFormData({
                          ...workerTypeFormData,
                          icon: e.target.value,
                        })
                      }
                      className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., ⚡"
                      maxLength={10}
                      lang={language}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      lang={language}
                    >
                      {t("admin.workerTypeDisplayOrder")}
                    </label>
                    <input
                      type="number"
                      value={workerTypeFormData.displayOrder}
                      onChange={(e) =>
                        setWorkerTypeFormData({
                          ...workerTypeFormData,
                          displayOrder: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      lang={language}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      lang={language}
                    >
                      {t("admin.workerTypeDescription")}
                    </label>
                    <textarea
                      value={workerTypeFormData.description}
                      onChange={(e) =>
                        setWorkerTypeFormData({
                          ...workerTypeFormData,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      rows={3}
                      placeholder="e.g., Electrical repairs, installations & maintenance"
                      lang={language}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={workerTypeFormData.isActive}
                        onChange={(e) =>
                          setWorkerTypeFormData({
                            ...workerTypeFormData,
                            isActive: e.target.checked,
                          })
                        }
                        className="w-5 h-5"
                      />
                      <span
                        className="text-sm font-medium text-gray-700"
                        lang={language}
                      >
                        {t("admin.workerTypeActive")}
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={
                      editingWorkerType
                        ? handleUpdateWorkerType
                        : handleCreateWorkerType
                    }
                    className="flex-1 bg-purple-500 text-white py-2 rounded-lg font-semibold hover:bg-purple-600 transition-colors"
                    lang={language}
                  >
                    {editingWorkerType
                      ? t("admin.updateWorkerType")
                      : t("admin.createWorkerType")}
                  </button>
                  <button
                    onClick={() => {
                      setShowWorkerTypeForm(false);
                      setEditingWorkerType(null);
                      setWorkerTypeFormData({
                        name: "",
                        displayName: "",
                        icon: "",
                        description: "",
                        isActive: true,
                        displayOrder: 0,
                      });
                    }}
                    className="flex-1 bg-gray-500 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                    lang={language}
                  >
                    {t("admin.cancel")}
                  </button>
                </div>
              </div>
            )}

            {isLoadingWorkerTypes ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading worker types...</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {workerTypes.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p lang={language}>{t("admin.noWorkerTypesFound")}</p>
                    </div>
                  ) : (
                    workerTypesPagination.paginatedItems.map((lt) => (
                      <div
                        key={lt.id}
                        className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{lt.icon || "🔧"}</span>
                            <div>
                              <h3
                                className="text-lg font-bold text-gray-800"
                                lang={language}
                              >
                                {lt.displayName || lt.name}
                              </h3>
                              <p
                                className="text-sm text-gray-500"
                                lang={language}
                              >
                                {t("admin.workerTypeCode")}: {lt.name}
                              </p>
                              {lt.description && (
                                <p
                                  className="text-gray-600 mt-1"
                                  lang={language}
                                >
                                  {lt.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                lt.isActive
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                              lang={language}
                            >
                              {lt.isActive
                                ? t("admin.active")
                                : t("admin.inactive")}
                            </span>
                            <span
                              className="text-xs text-gray-500"
                              lang={language}
                            >
                              {t("admin.order")}: {lt.displayOrder}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => {
                              setEditingWorkerType(lt);
                              setWorkerTypeFormData({
                                name: lt.name,
                                displayName: lt.displayName || "",
                                icon: lt.icon || "",
                                description: lt.description || "",
                                isActive: lt.isActive !== false,
                                displayOrder: lt.displayOrder || 0,
                              });
                              setShowWorkerTypeForm(true);
                            }}
                            className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                            lang={language}
                          >
                            {t("admin.editWorkerType")}
                          </button>
                          <button
                            onClick={() => handleToggleWorkerTypeActive(lt.id)}
                            className="flex-1 bg-yellow-500 text-white py-2 rounded-lg font-semibold hover:bg-yellow-600 transition-colors"
                            lang={language}
                          >
                            {lt.isActive
                              ? t("admin.deactivate")
                              : t("admin.activate")}
                          </button>
                          <button
                            onClick={() => handleDeleteWorkerType(lt.id)}
                            className="flex-1 bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors"
                            lang={language}
                          >
                            {t("admin.deleteWorkerType")}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <PaginationControls
                  currentPage={workerTypesPage}
                  totalPages={workerTypesPagination.totalPages}
                  onPageChange={setWorkerTypesPage}
                  totalItems={workerTypesPagination.totalItems}
                />
              </>
            )}
          </div>
        )}

      {/* Chatbot - Always visible */}
      {user && (
        <Chatbot
          user={user}
          adminStats={{
            pendingRequests: requests.length,
            activeRequests: activeRequests.length,
            totalWorkers: workers.length,
            totalCustomers: customers.length,
            pendingConcerns: concerns.filter(
              (c: any) => c.status === "PENDING" || c.status === "OPEN"
            ).length,
          }}
        />
      )}

      {/* Deploy Confirmation Modal */}
      {showDeployModal.show && showDeployModal.requestId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-md relative">
            <button
              onClick={() =>
                setShowDeployModal({ show: false, requestId: null })
              }
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
            >
              &times;
            </button>
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <span className="text-4xl">🚀</span>
              </div>
              <h3
                className="text-2xl font-bold text-gray-900 mb-2"
                lang={language}
              >
                {t("admin.deployWorkers") || "Deploy Workers"}
              </h3>
              <p className="text-gray-600" lang={language}>
                {t("admin.deployConfirmation") ||
                  "Are you sure you want to deploy workers to this customer? This action will notify the customer and mark the request as deployed."}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeploy(showDeployModal.requestId!)}
                disabled={isDeploying[showDeployModal.requestId!]}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
                lang={language}
              >
                {isDeploying[showDeployModal.requestId!]
                  ? t("admin.deploying") || "Deploying..."
                  : t("admin.confirmDeploy") || "Yes, Deploy"}
              </button>
              <button
                onClick={() =>
                  setShowDeployModal({ show: false, requestId: null })
                }
                disabled={isDeploying[showDeployModal.requestId!]}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold disabled:opacity-50"
                lang={language}
              >
                {t("admin.cancel") || "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {showApproveModal.show && showApproveModal.requestId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-md relative">
            <button
              onClick={() =>
                setShowApproveModal({ show: false, requestId: null })
              }
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
            >
              &times;
            </button>
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <span className="text-4xl">✓</span>
              </div>
              <h3
                className="text-2xl font-bold text-gray-900 mb-2"
                lang={language}
              >
                {t("admin.approveRequest") || "Approve Request"}
              </h3>
              <p className="text-gray-600" lang={language}>
                {t("admin.approveConfirmation") ||
                  "Are you sure you want to approve this request? This will notify available workers about the job opportunity."}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleApprove(showApproveModal.requestId!)}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                lang={language}
              >
                {t("admin.confirmApprove") || "Yes, Approve"}
              </button>
              <button
                onClick={() =>
                  setShowApproveModal({ show: false, requestId: null })
                }
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
                lang={language}
              >
                {t("admin.cancel") || "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit System User Modal */}
      {editingSystemUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2
              className="text-2xl font-bold text-gray-900 mb-4"
              lang={language}
            >
              Edit System User: {editingSystemUser.name}
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-2"
                  lang={language}
                >
                  New Password (leave empty to keep current)
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="Enter new password (min 6 characters)"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="superAdminToggle"
                  checked={editingSystemUser.superAdmin}
                  onChange={(e) =>
                    setEditingSystemUser({
                      ...editingSystemUser,
                      superAdmin: e.target.checked,
                    })
                  }
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label
                  htmlFor="superAdminToggle"
                  className="text-sm font-medium text-gray-700"
                  lang={language}
                >
                  Super Admin
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() =>
                  handleUpdateSystemUser(
                    editingSystemUser.superAdmin,
                    newPassword
                  )
                }
                disabled={
                  isUpdatingSystemUser ||
                  (newPassword !== "" && newPassword.length < 6)
                }
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                lang={language}
              >
                {isUpdatingSystemUser ? "Updating..." : "Update"}
              </button>
              <button
                onClick={() => {
                  setEditingSystemUser(null);
                  setNewPassword("");
                  setShowNewPassword(false);
                }}
                className="flex-1 px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                lang={language}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update User Password Modal */}
      {editingUserPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2
              className="text-2xl font-bold text-gray-900 mb-4"
              lang={language}
            >
              Update Password: {editingUserPassword.name}
            </h2>
            <p className="text-sm text-gray-600 mb-4" lang={language}>
              {editingUserPassword.email} ({editingUserPassword.role})
            </p>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-2"
                  lang={language}
                >
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                    placeholder="Enter new password (min 6 characters)"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
                {newPassword && newPassword.length < 6 && (
                  <p className="text-xs text-red-500 mt-1" lang={language}>
                    Password must be at least 6 characters long
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateUserPassword}
                disabled={
                  isUpdatingPassword || !newPassword || newPassword.length < 6
                }
                className="flex-1 px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                lang={language}
              >
                {isUpdatingPassword ? "Updating..." : "Update Password"}
              </button>
              <button
                onClick={() => {
                  setEditingUserPassword(null);
                  setNewPassword("");
                  setShowNewPassword(false);
                }}
                className="flex-1 px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                lang={language}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chatbot */}
      {/* <Chatbot user={user} adminStats={adminStats} /> */}
    </div>
  );
}
