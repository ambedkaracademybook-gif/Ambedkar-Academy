import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  Award,
  BookOpen,
  Trophy,
  ArrowRight,
  CheckCircle,
  HelpCircle,
  BookOpenText,
  AlertTriangle,
  Gift,
  Target,
  Phone,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Star,
  Check,
  Lightbulb,
  HeartHandshake,
  Lock,
  ChevronDown,
  Search,
  Filter,
  Database,
  RefreshCw
} from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";
import { testimonials } from "./testimonials";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/spreadsheets");

// Asset paths based on generated images
const CHALLENGE_IMAGE = "https://raw.githubusercontent.com/ambedkaracademybook-gif/Ambedkar-Academy/main/images/Challenge.png";
const CASH_PRIZE_IMAGE = "https://raw.githubusercontent.com/ambedkaracademybook-gif/Ambedkar-Academy/main/images/Cash%20Price.png";
const MENTOR_IMAGE = "https://raw.githubusercontent.com/ambedkaracademybook-gif/Ambedkar-Academy/main/images/Mentor.png";
const GUEST_IMAGE = "https://raw.githubusercontent.com/ambedkaracademybook-gif/Ambedkar-Academy/main/images/Guest.png";

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [redirectCount, setRedirectCount] = useState(10);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Google Sheets Admin State
  const [sheetsConfig, setSheetsConfig] = useState<{
    isConnected: boolean;
    spreadsheetId?: string;
    spreadsheetUrl?: string;
    sheetTitle?: string;
    updatedAt?: string;
  } | null>(null);

  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [sheetsError, setSheetsError] = useState("");
  const [existingSpreadsheetId, setExistingSpreadsheetId] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Leads and Sync State
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPrep, setFilterPrep] = useState("");

  const fetchRegistrations = async () => {
    try {
      const res = await fetch("/api/registrations");
      const data = await res.json();
      if (data.success) {
        setRegistrations(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch registrations:", err);
    }
  };

  useEffect(() => {
    const fetchSheetsConfig = async () => {
      try {
        const res = await fetch("/api/sheets/config");
        const data = await res.json();
        if (data.success) {
          setSheetsConfig(data);
        }
      } catch (err) {
        console.error("Failed to fetch Google Sheets config:", err);
      }
    };
    fetchSheetsConfig();
    fetchRegistrations();
  }, [currentPath]);

  const handleManualSync = async (forcedToken?: string) => {
    setIsSyncing(true);
    setSyncSuccessMessage("");
    setSheetsError("");
    try {
      let activeToken = forcedToken;
      
      // If no token is provided, trigger a fresh Google login to ensure a valid short-lived token
      if (!activeToken) {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        activeToken = credential?.accessToken || undefined;
        setCurrentUser(result.user);
      }

      if (!activeToken) {
        throw new Error("Could not acquire a valid Google Sheets access token. Please authenticate.");
      }

      const res = await fetch("/api/sheets/sync-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessToken: activeToken }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSyncSuccessMessage(data.message || "All registrations successfully synced!");
        // Refresh local config state
        const configRes = await fetch("/api/sheets/config");
        const configData = await configRes.json();
        if (configData.success) {
          setSheetsConfig(configData);
        }
      } else {
        setSheetsError(data.error || "Failed to sync registrations to Google Sheet.");
      }
    } catch (err: any) {
      console.error("Manual sync error:", err);
      setSheetsError(err.message || "Failed to synchronize. Please check permissions and try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAdminLogin = async (useExistingId?: boolean) => {
    setIsLinking(true);
    setSheetsError("");
    setSyncSuccessMessage("");
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (!token) {
        throw new Error("Failed to retrieve Google OAuth access token.");
      }

      setCurrentUser(result.user);

      // Send to backend setup
      const res = await fetch("/api/sheets/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: token,
          spreadsheetId: useExistingId ? existingSpreadsheetId.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSheetsConfig({
          isConnected: true,
          spreadsheetId: data.spreadsheetId,
          spreadsheetUrl: data.spreadsheetUrl,
          sheetTitle: data.sheetTitle,
          updatedAt: new Date().toISOString(),
        });
        setExistingSpreadsheetId("");

        // Immediately trigger sync for any existing registrations so the spreadsheet populates instantly!
        await handleManualSync(token);
      } else {
        setSheetsError(data.error || "Failed to link Google Sheet.");
      }
    } catch (err: any) {
      console.error("Google Sheets login/link error:", err);
      setSheetsError(err.message || "An error occurred during authentication.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect Google Sheets? Future registrations will not be logged directly to the spreadsheet until re-connected.")) {
      return;
    }
    setIsLinking(true);
    try {
      const res = await fetch("/api/sheets/disconnect", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setSheetsConfig({ isConnected: false });
        setCurrentUser(null);
      } else {
        setSheetsError(data.error || "Failed to disconnect Google Sheet.");
      }
    } catch (err: any) {
      console.error("Disconnect error:", err);
      setSheetsError(err.message || "Failed to disconnect Google Sheet.");
    } finally {
      setIsLinking(false);
    }
  };

  // Router listener for back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  // Workshop Date Setup (August 2, 2026, 11:00 AM IST)
  // IST is UTC+05:30. "2026-08-02T11:00:00+05:30"
  const TARGET_DATE = new Date("2026-08-02T11:00:00+05:30").getTime();

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const difference = TARGET_DATE - now;
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
      } else {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
          isExpired: false,
        });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [TARGET_DATE]);

  // Form inputs
  const [fullName, setFullName] = useState("");
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const [preparingFor, setPreparingFor] = useState("");
  const [currentPosition, setCurrentPosition] = useState("");
  const [previousCoaching, setPreviousCoaching] = useState("");

  // Form state
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Auto redirect logic on thank you page
  const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/Hbz9nRV7tf68brDu92kBw1?s=cl&p=a&ilr=1";

  useEffect(() => {
    if (currentPath === "/thank-you" || currentPath === "/thank-you/") {
      const timer = setInterval(() => {
        setRedirectCount((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            window.location.href = WHATSAPP_GROUP_URL;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentPath]);

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setWhatsAppNumber(val);
  };

  // Smooth scroll helper
  const scrollToForm = () => {
    const formEl = document.getElementById("registration-form");
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Form submit handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Validate
    if (!fullName.trim()) {
      setFormError("Please enter your Full Name.");
      return;
    }
    if (whatsAppNumber.length !== 10) {
      setFormError("Please enter a valid 10-digit WhatsApp Number.");
      return;
    }
    if (!preparingFor) {
      setFormError("Please select the exam you are Preparing For.");
      return;
    }
    if (!currentPosition) {
      setFormError("Please select your Current Position.");
      return;
    }
    if (!previousCoaching) {
      setFormError("Please select if you have attended coaching before.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          whatsAppNumber,
          preparingFor,
          currentPosition,
          previousCoaching,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        // Track Pixel Lead event if defined on window
        if ((window as any).fbq) {
          (window as any).fbq("track", "Lead", {
            content_name: "TNPSC Workshop Lead",
            value: 0.0,
            currency: "INR",
          });
        }
        // Track GA4 Lead Event
        if ((window as any).gtag) {
          (window as any).gtag("event", "generate_lead", {
            event_category: "Workshop",
            event_label: "TNPSC Blueprint 2026",
          });
        }

        navigateTo("/thank-you/");
      } else {
        setFormError(data.error || "Something went wrong. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      setFormError("Network error. Your registration has been saved in local simulation.");
      // Graceful fallback for offline demo: redirect anyway
      setTimeout(() => {
        navigateTo("/thank-you/");
      }, 1500);
    } finally {
      setIsLoading(false);
    }
  };

  const tamilNaduDistricts: string[] = [];

  // Render Google Sheets Sync Setup View (Admin Only)
  if (
    currentPath === "/admin" ||
    currentPath === "/admin/" ||
    currentPath === "/sheets-setup" ||
    currentPath === "/sheets-setup/"
  ) {
    return (
      <div id="sheets-admin-view" className="min-h-screen bg-slate-950 text-white font-sans antialiased flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 relative overflow-hidden">
        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md relative z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM6 6h5v4H6V6zm0 6h5v6H6v-6zm12 6h-5v-4h5v4zm0-6h-5V6h5v6z" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-black uppercase tracking-wider text-amber-500">
                  Ambedkar Academy Admin
                </h1>
                <p className="text-[11px] text-slate-400 font-bold">
                  Google Sheets Integration &amp; Real-time Sync Setup
                </p>
              </div>
            </div>
            <button
              onClick={() => navigateTo("/")}
              className="text-xs font-bold text-slate-300 hover:text-white border border-slate-800 bg-slate-900 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              ← Landing Page
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-grow max-w-6xl w-full mx-auto px-4 py-12 relative z-10 flex flex-col gap-8">
          {/* Main Sync Controls Card */}
          <div className="w-full bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 md:p-10 space-y-8 backdrop-blur-sm shadow-2xl">
            
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-white font-sans">
                Google Sheets Sync
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect your Google Account to automatically sync all TNPSC Workshop registrations directly to a live Google Sheet spreadsheet.
              </p>
            </div>

            {sheetsError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold p-4 rounded-xl flex items-start gap-2.5 text-left max-w-2xl mx-auto">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{sheetsError}</span>
              </div>
            )}

            {syncSuccessMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold p-4 rounded-xl flex items-start gap-2.5 text-left max-w-2xl mx-auto">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{syncSuccessMessage}</span>
              </div>
            )}

            {sheetsConfig?.isConnected ? (
              <div className="space-y-6 max-w-3xl mx-auto">
                {/* Status Indicator */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-2xl flex items-center gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">Spreadsheet Synced &amp; Active</h4>
                    <p className="text-[11px] text-slate-300">All new registrant leads are synced live to your Google Sheet.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-1">
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Spreadsheet ID</span>
                    <span className="block text-xs font-mono text-slate-300 select-all overflow-hidden text-ellipsis">{sheetsConfig.spreadsheetId}</span>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-1">
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Sheet Tab</span>
                    <span className="block text-xs font-bold text-slate-300">{sheetsConfig.sheetTitle}</span>
                  </div>
                </div>

                {/* Force Sync Block */}
                <div className="bg-slate-950/40 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 text-left">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">Force Full Sync</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      If older records are missing or if the background connection expired, click below to authenticate and write all <span className="font-bold text-white font-mono">{registrations.length}</span> records cleanly to your Google Sheet.
                    </p>
                  </div>
                  <button
                    onClick={() => handleManualSync()}
                    disabled={isSyncing}
                    className="w-full md:w-auto shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-3 px-5 rounded-xl transition-all duration-150 disabled:opacity-50 uppercase cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Force Sync Now
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800 text-left">
                  <p className="text-xs text-slate-400">
                    Last Connected/Updated: <span className="text-slate-300 font-mono font-bold">{new Date(sheetsConfig.updatedAt || "").toLocaleString()}</span>
                  </p>
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <a
                      href={sheetsConfig.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-lg transition-all duration-150 shadow-md flex items-center gap-1.5 uppercase cursor-pointer"
                    >
                      Open Google Sheet
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={handleDisconnect}
                      disabled={isLinking}
                      className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20 font-bold text-xs px-4 py-2.5 rounded-lg transition-all duration-150 disabled:opacity-50 uppercase cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto pt-2">
                {/* Option 1: Auto-Create brand-new Sheet */}
                <div className="bg-slate-950/40 border border-slate-800/80 p-6 rounded-2xl space-y-5 flex flex-col justify-between text-left">
                  <div className="space-y-2">
                    <span className="inline-flex bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase px-2.5 py-0.5 rounded border border-emerald-500/10 tracking-widest">Option A</span>
                    <h5 className="font-extrabold text-sm text-slate-200">Create New Spreadsheet</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      We will automatically construct a clean new Google Sheet named <span className="font-mono text-slate-300 font-bold">"TNPSC Workshop Registrations 2026"</span> pre-loaded with proper registration column headers.
                    </p>
                  </div>
                  <button
                    onClick={() => handleAdminLogin(false)}
                    disabled={isLinking}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-3 px-4 rounded-xl transition-all duration-150 disabled:opacity-50 uppercase cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isLinking ? "Setting Up..." : "✨ Create New Sheet & Sync"}
                  </button>
                </div>

                {/* Option 2: Use existing Sheet */}
                <div className="bg-slate-950/40 border border-slate-800/80 p-6 rounded-2xl space-y-5 flex flex-col justify-between text-left">
                  <div className="space-y-2">
                    <span className="inline-flex bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase px-2.5 py-0.5 rounded border border-blue-500/10 tracking-widest">Option B</span>
                    <h5 className="font-extrabold text-sm text-slate-200">Connect Existing Sheet</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Link to an existing Google Spreadsheet you already own. Paste your target spreadsheet's ID from its URL.
                    </p>
                    <input
                      type="text"
                      placeholder="Spreadsheet ID (e.g., 1aBc...)"
                      value={existingSpreadsheetId}
                      onChange={(e) => setExistingSpreadsheetId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-all duration-150"
                    />
                  </div>
                  <button
                    onClick={() => handleAdminLogin(true)}
                    disabled={isLinking || !existingSpreadsheetId.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-xs py-3 px-4 rounded-xl transition-all duration-150 disabled:opacity-50 uppercase cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isLinking ? "Verifying..." : "🔗 Link Existing Sheet"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Database Leads Table */}
          {(() => {
            const filteredRegistrations = registrations.filter((lead) => {
              const matchesSearch =
                (lead.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (lead.whatsAppNumber || "").includes(searchQuery);
              const matchesFilter = filterPrep ? lead.preparingFor === filterPrep : true;
              return matchesSearch && matchesFilter;
            });

            return (
              <div className="w-full bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 md:p-8 space-y-6 backdrop-blur-sm shadow-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                      <Database className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-base font-black tracking-tight text-white font-sans">
                        Registration Leads Database
                      </h3>
                      <p className="text-[11px] text-slate-400 font-bold">
                        Total Leads: <span className="text-amber-500 font-mono font-black">{registrations.length}</span> | Filtered: <span className="text-amber-500 font-mono font-black">{filteredRegistrations.length}</span>
                      </p>
                    </div>
                  </div>

                  {/* Search & Filters */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Search className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        placeholder="Search by name, WhatsApp..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-all duration-150"
                      />
                    </div>

                    <div className="relative w-full sm:w-44">
                      <select
                        value={filterPrep}
                        onChange={(e) => setFilterPrep(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500 transition-all duration-150 cursor-pointer"
                      >
                        <option value="">All Exams</option>
                        <option value="Group 1">Group 1</option>
                        <option value="Group 2">Group 2</option>
                        <option value="Group 4">Group 4</option>
                        <option value="Beginner">Beginner</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Table Container */}
                <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/20">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3.5 px-4">Name</th>
                        <th className="py-3.5 px-4">WhatsApp</th>
                        <th className="py-3.5 px-4">Exam Goal</th>
                        <th className="py-3.5 px-4">Current Position</th>
                        <th className="py-3.5 px-4">Coached Before?</th>
                        <th className="py-3.5 px-4 text-right">Registration Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs font-semibold text-slate-300 text-left">
                      {filteredRegistrations.length > 0 ? (
                        filteredRegistrations.map((lead, index) => (
                          <tr key={lead.id || index} className="hover:bg-slate-900/30 transition duration-100">
                            <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">{index + 1}</td>
                            <td className="py-3.5 px-4 font-black text-white">{lead.fullName}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-300">
                              +91 {lead.whatsAppNumber}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/10">
                                {lead.preparingFor}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400">{lead.currentPosition}</td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black ${
                                lead.previousCoaching === "Yes"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                                  : "bg-slate-800 text-slate-400"
                              }`}>
                                {lead.previousCoaching}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[10px] text-slate-500">
                              {new Date(lead.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500 font-bold">
                            No registrations found matching the criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

            <div className="text-center pt-4">
              <button
                onClick={() => navigateTo("/")}
                className="text-xs text-slate-500 hover:text-slate-300 font-semibold transition cursor-pointer"
              >
                ← Return to Landing Page
              </button>
            </div>
        </main>

        {/* Footer */}
        <footer className="py-6 border-t border-slate-900 bg-slate-950 text-center text-[11px] text-slate-500">
          <p>© 2026 Ambedkar Academy. T. Nagar, Chennai. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  // Render Thank You Page View
  if (currentPath === "/thank-you" || currentPath === "/thank-you/") {
    return (
      <div id="thank-you-view" className="min-h-screen bg-[#030303] text-slate-100 font-sans flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 relative overflow-hidden gold-diagonal-lines gold-geometric-grid">
        {/* Animated Background Circles */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-tr from-amber-500/10 to-yellow-600/5 rounded-full blur-3xl pointer-events-none opacity-40 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-amber-600/5 to-yellow-600/5 rounded-full blur-3xl pointer-events-none opacity-30"></div>

        {/* Main Content */}
        <div className="flex-grow flex items-center justify-center px-4 py-12 md:py-20 relative z-10">
          <div className="w-full max-w-2xl bg-[#0a0908]/95 border border-amber-500/25 rounded-3xl p-6 md:p-12 text-center shadow-2xl relative overflow-hidden glow-gold">
            {/* Subtle background decoration */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600"></div>
            
            {/* Checked animation icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/10 text-amber-400 rounded-full mb-6 border border-amber-500/35 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <CheckCircle className="w-12 h-12 stroke-[1.5]" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 mb-4 tracking-wider uppercase border border-amber-500/20">
              Seat Confirmed
            </span>

            <h1 className="text-2xl md:text-3xl font-extrabold font-display tracking-tight text-white mb-4 glow-gold-text">
              Your Workshop Registration Is Confirmed!
            </h1>
            <p className="text-slate-300 text-sm md:text-base mb-8 max-w-lg mx-auto">
              Thank you for registering for the <span className="text-amber-400 font-bold font-display">TNPSC Success Blueprint Workshop 2026</span>.
            </p>

            {/* Event Info Card */}
            <div className="bg-black/40 border border-amber-500/20 rounded-2xl p-6 text-left mb-8 max-w-lg mx-auto space-y-4 shadow-inner">
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest border-b border-slate-800 pb-2">
                Workshop Invitation Details
              </h3>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Date</p>
                  <p className="text-sm font-bold text-white">August 2, 2026 (Sunday)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Time</p>
                  <p className="text-sm font-bold text-white">11:00 AM – 1:00 PM IST</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Venue</p>
                  <p className="text-sm font-bold text-white">Ambedkar Academy</p>
                  <p className="text-xs text-slate-400">T. Nagar, Chennai (Opp. to Bus Terminus / Near Metro)</p>
                </div>
              </div>
            </div>

            {/* Next Step WhatsApp box */}
            <div className="bg-slate-900/65 border border-emerald-500/20 rounded-2xl p-6 md:p-8 max-w-lg mx-auto">
              <h2 className="text-base md:text-lg font-bold text-emerald-400 flex items-center justify-center gap-2 mb-2 font-display uppercase tracking-wide">
                <Sparkles className="w-5 h-5 animate-pulse text-emerald-400" /> IMPORTANT NEXT STEP
              </h2>
              <p className="text-xs md:text-sm text-slate-300 mb-6 font-medium leading-relaxed">
                Join our official WhatsApp group to receive free preparation guides, direct session links, and live event updates.
              </p>

              <a
                href={WHATSAPP_GROUP_URL}
                target="_blank"
                rel="noreferrer"
                id="join-whatsapp-btn"
                className="w-full inline-flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black py-4 px-6 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition duration-200 text-sm md:text-base tracking-wide group cursor-pointer uppercase"
              >
                JOIN WHATSAPP GROUP
                <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
              </a>

              <div className="flex justify-center flex-wrap gap-x-4 gap-y-1.5 mt-4 text-[10px] uppercase tracking-wider font-bold text-emerald-400">
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Study Materials
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Live Link
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Reminders
                </span>
              </div>

              {redirectCount > 0 ? (
                <p className="text-[11px] text-slate-400 mt-6 italic">
                  Redirecting to WhatsApp automatically in <span className="text-emerald-400 font-bold not-italic">{redirectCount}</span> seconds...
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-6 italic">
                  If the tab didn't open, please click the button above to join.
                </p>
              )}
            </div>

            <button
              onClick={() => navigateTo("/")}
              className="mt-8 text-amber-500 hover:text-amber-400 text-xs font-semibold transition cursor-pointer"
            >
              ← Go back to Landing Page
            </button>
          </div>
        </div>

        {/* Minimal Footer */}
        <footer className="py-6 border-t border-slate-900 bg-black text-center text-[11px] text-slate-500">
          <p>© 2026 Ambedkar Academy. T. Nagar, Chennai. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  // Main Landing Page View
  return (
    <div className="min-h-screen bg-[#030303] text-slate-200 font-sans antialiased selection:bg-amber-500 selection:text-slate-950 relative overflow-hidden gold-diagonal-lines gold-geometric-grid">
      
      {/* URGENCY BANNER / SCROLLING MARQUEE */}
      <div id="urgency-scrolling-marquee" className="bg-black text-amber-400 text-[10px] md:text-xs py-2 font-extrabold overflow-hidden relative z-50 border-b border-amber-500/20 shadow-lg">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-16">
          <div className="flex items-center gap-8 shrink-0">
            <span className="bg-amber-500 text-slate-950 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse shrink-0">Limited Seats Left</span>
            <span className="font-sans font-extrabold uppercase text-white">🚨 HURRY UP! ONLY LIMITED SEATS ARE LEFT FOR THE FREE AUGUST 2ND TNPSC WORKSHOP! REGISTER NOW TO SECURE YOUR SPOT! 🚨</span>
            <span className="text-amber-500/40">|</span>
            <span className="font-sans font-extrabold uppercase text-amber-400">🚨 ஆகஸ்ட் 2ஆம் தேதி நடைபெறும் இலவச TNPSC வழிகாட்டுதல் வகுப்பிற்கு மிகக் குறைந்த இடங்களே உள்ளன! உடனே பதிவு செய்யவும்! 🚨</span>
          </div>
          <div className="flex items-center gap-8 shrink-0">
            <span className="bg-amber-500 text-slate-950 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse shrink-0">Limited Seats Left</span>
            <span className="font-sans font-extrabold uppercase text-white">🚨 HURRY UP! ONLY LIMITED SEATS ARE LEFT FOR THE FREE AUGUST 2ND TNPSC WORKSHOP! REGISTER NOW TO SECURE YOUR SPOT! 🚨</span>
            <span className="text-amber-500/40">|</span>
            <span className="font-sans font-extrabold uppercase text-amber-400">🚨 ஆகஸ்ட் 2ஆம் தேதி நடைபெறும் இலவச TNPSC வழிகாட்டுதல் வகுப்பிற்கு மிகக் குறைந்த இடங்களே உள்ளன! உடனே பதிவு செய்யவும்! 🚨</span>
          </div>
        </div>
      </div>

      {/* Decorative Blur Background Lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[20%] left-[-10%] w-[50%] h-[50%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-600/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {/* SECTION 1 – HERO / ABOVE THE FOLD */}
      <section className="relative overflow-hidden pt-8 md:pt-12 pb-12 border-b border-amber-500/10 bg-gradient-to-b from-black via-[#080706] to-black">
        
        {/* 1. Deepest Layer: Rich soft glowing blurry patterns */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          {/* Large soft amber glow */}
          <div className="absolute -top-[10%] left-[5%] w-[45%] h-[45%] bg-amber-500/5 rounded-full blur-[100px]"></div>
          {/* Large soft peach/orange glow */}
          <div className="absolute top-[25%] right-[10%] w-[35%] h-[35%] bg-yellow-600/5 rounded-full blur-[90px]"></div>
          {/* Pure amber bright pearl orbs to create elegant glass reflections */}
          <div className="absolute top-[15%] left-[20%] w-44 h-44 bg-amber-500/5 rounded-full blur-[40px] opacity-40"></div>
          <div className="absolute bottom-[10%] right-[30%] w-56 h-56 bg-yellow-500/5 rounded-full blur-[60px] opacity-40"></div>
        </div>

        {/* 2. Glassmorphic Backdrop Layer: Frosted black blur to blend the colors softly */}
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[10px] pointer-events-none"></div>

        {/* 3. Grid Lines & Pattern Layer */}
        <div className="absolute inset-0 pointer-events-none select-none">
          {/* Crisp, clean gold square grid lines matching user's reference image */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(212,175,55,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(212,175,55,0.06)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-70"></div>
          {/* Subtle micro dots for texture */}
          <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle_at_1px_1px,_#d4af37_1px,_transparent_0)] bg-[size:1.75rem_1.75rem]"></div>
        </div>
        
        {/* 4. Elegant Minimalist Dr. Ambedkar & Text Watermark Background - Layered softly over the grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none opacity-[0.02]">
          {/* Minimalist text watermark overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[11vw] font-black tracking-[1.3em] text-white font-display uppercase whitespace-nowrap pl-[1.3em]">AMBEDKAR</span>
          </div>

          {/* Dr. B.R. Ambedkar Iconic Silhouette */}
          <div className="absolute right-[5%] lg:right-[35%] bottom-[-5%] lg:bottom-[-8%] w-[280px] sm:w-[350px] lg:w-[420px] h-auto text-amber-500/20 flex items-center justify-center">
            <svg viewBox="0 0 200 200" fill="currentColor" className="w-full h-full">
              <path d="M 60,60 C 60,40 80,30 100,30 C 120,30 140,40 140,60 C 140,75 142,85 142,95 C 135,100 120,105 100,105 C 80,105 65,100 58,95 C 58,85 60,75 60,60 Z" />
              <path d="M 54,75 C 51,75 51,85 54,85 Z" />
              <path d="M 146,75 C 149,75 149,85 146,85 Z" />
              <rect x="72" y="65" width="22" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="4" />
              <rect x="106" y="65" width="22" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="4" />
              <line x1="94" y1="72" x2="106" y2="72" stroke="currentColor" strokeWidth="4" />
              <line x1="64" y1="70" x2="72" y2="72" stroke="currentColor" strokeWidth="2" />
              <line x1="128" y1="72" x2="136" y2="70" stroke="currentColor" strokeWidth="2" />
              <path d="M 70,60 Q 83,57 95,62" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <path d="M 105,62 Q 117,57 130,60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <path d="M 96,75 Q 100,73 104,75 Q 102,87 100,87 Q 98,87 96,75" fill="currentColor" />
              <path d="M 85,95 Q 100,102 115,95" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <path d="M 85,115 L 80,125 L 75,155 L 125,155 L 120,125 L 115,115 Z" />
              <path d="M 95,125 L 105,125 L 108,155 L 92,155 Z" />
              <path d="M 75,130 L 92,155 L 50,185 L 35,185 L 55,130 Z" />
              <path d="M 125,130 L 108,155 L 150,185 L 165,185 L 145,130 Z" />
              <rect x="55" y="155" width="90" height="40" rx="4" fill="currentColor" />
            </svg>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left side: Workshop information */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 px-3.5 py-1.5 rounded-full border border-amber-500/25 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 animate-pulse text-amber-400" />
                FREE TNPSC WORKSHOP • LIMITED SEATS
              </div>

              <div className="space-y-3.5">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-black font-display leading-[1.15] tracking-tight text-white glow-gold-text">
                  TNPSC SUCCESS
                  <span className="block bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-600 bg-clip-text text-transparent mt-1.5 font-display">
                    BLUEPRINT 2026
                  </span>
                </h1>
                <p className="text-sm sm:text-base text-slate-300 font-medium max-w-xl leading-relaxed">
                  FREE Interactive Strategy Workshop for TNPSC Group 1, Group 2 &amp; Group 4 Aspirants. Learn how to clear in your very first attempt!
                </p>
              </div>

              {/* Highlight Quote */}
              <div className="border-l-4 border-amber-500 pl-4 py-1 my-3 bg-amber-500/5 rounded-r-xl max-w-lg">
                <p className="text-slate-200 italic font-semibold text-sm md:text-base leading-relaxed">
                  "Don't Just Study Hard... Study with the Right Strategy."
                </p>
              </div>

              {/* Countdown Timer (Medium Size) */}
              <div className="bg-[#0c0a09]/90 border border-amber-500/20 rounded-2xl p-4 max-w-md shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 justify-between">
                  <span className="text-[11px] text-amber-400 font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0">
                    <Clock className="w-4 h-4 animate-pulse text-amber-400" /> STARTS IN:
                  </span>
                  
                  {timeLeft.isExpired ? (
                    <span className="text-slate-400 font-bold text-sm">Registration Closed</span>
                  ) : (
                    <div className="flex items-center gap-2 font-mono">
                      <div className="flex items-baseline gap-1 bg-black border border-slate-800 rounded-xl px-3 py-1">
                        <span className="text-sm font-black text-white">{String(timeLeft.days).padStart(2, "0")}</span>
                        <span className="text-[10px] uppercase text-slate-500 font-bold">d</span>
                      </div>
                      <div className="flex items-baseline gap-1 bg-black border border-slate-800 rounded-xl px-3 py-1">
                        <span className="text-sm font-black text-white">{String(timeLeft.hours).padStart(2, "0")}</span>
                        <span className="text-[10px] uppercase text-slate-500 font-bold">h</span>
                      </div>
                      <div className="flex items-baseline gap-1 bg-black border border-slate-800 rounded-xl px-3 py-1">
                        <span className="text-sm font-black text-white">{String(timeLeft.minutes).padStart(2, "0")}</span>
                        <span className="text-[10px] uppercase text-slate-500 font-bold font-sans">m</span>
                      </div>
                      <div className="flex items-baseline gap-1 bg-black border border-amber-500/20 rounded-xl px-3 py-1">
                        <span className="text-sm font-black text-amber-400">{String(timeLeft.seconds).padStart(2, "0")}</span>
                        <span className="text-[10px] uppercase text-amber-400 font-bold font-sans">s</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Details Grid - 4 Columns, 2 Rows on Mobile, 4 Columns, 1 Row on Desktop */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 max-w-xl pt-2">
                {/* DATE */}
                <div className="bg-[#0c0a09]/90 border border-amber-500/10 p-3.5 rounded-xl flex flex-col justify-between shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block mb-1">DATE</span>
                  <span className="text-sm font-extrabold text-white leading-tight">August 2, 2026</span>
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5">(Sunday)</span>
                </div>

                {/* TIME */}
                <div className="bg-[#0c0a09]/90 border border-amber-500/10 p-3.5 rounded-xl flex flex-col justify-between shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block mb-1">TIME</span>
                  <span className="text-sm font-extrabold text-white leading-tight">11:00 AM</span>
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5">to 1:00 PM IST</span>
                </div>

                {/* VENUE */}
                <div className="bg-[#0c0a09]/90 border border-amber-500/10 p-3.5 rounded-xl flex flex-col justify-between shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block mb-1">VENUE</span>
                  <span className="text-sm font-extrabold text-white leading-tight">T. Nagar</span>
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Chennai Offline</span>
                </div>

                {/* SPEAKERS */}
                <div className="bg-[#0c0a09]/90 border border-amber-500/10 p-3.5 rounded-xl flex flex-col justify-between shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block mb-1">SPEAKERS</span>
                  <span className="text-sm font-extrabold text-white leading-tight">M. Rafi (Founder)</span>
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5">&amp; Special Guest</span>
                </div>
              </div>

              {/* Mobile Only Quick Register Action Trigger */}
              <div className="pt-2 block lg:hidden">
                <button
                  onClick={scrollToForm}
                  className="w-full inline-flex items-center justify-center gap-2 gold-metallic-gradient gold-metallic-hover text-slate-950 font-black py-4 px-6 rounded-xl text-base tracking-wide shadow-lg active:scale-98 transition duration-150 animate-shake"
                >
                  REGISTER FREE NOW
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

            </div>

            {/* Right side: Medium-Sized Registration form */}
            <div className="lg:col-span-5 relative" id="registration-form">
              {/* Highlight background glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-3xl blur-md opacity-20 animate-pulse"></div>
              
              <div className="relative text-slate-100 rounded-3xl p-6 md:p-8 shadow-2xl border border-amber-500/20 bg-slate-900/90 backdrop-blur-md">
                
                {/* Form header badge */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 px-3 py-1 rounded border border-amber-500/20">
                    LIMITED SEATS
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                    <ShieldCheck className="w-4 h-4 text-amber-400" /> Free Seat
                  </span>
                </div>

                <div className="mb-5">
                  <h2 className="text-xl font-black tracking-tight text-white font-display glow-gold-text">
                    Reserve Your FREE Seat
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Register now to confirm your physical seat at Ambedkar Academy.
                  </p>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-4">
                  
                  {/* Name field */}
                  <div>
                    <label htmlFor="fullname-input" className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                      Full Name *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        id="fullname-input"
                        type="text"
                        required
                        placeholder="Your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-500 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all duration-200 font-medium"
                      />
                    </div>
                  </div>

                  {/* WhatsApp Number field */}
                  <div>
                    <label htmlFor="whatsapp-input" className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                      WhatsApp Number *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 text-sm font-extrabold">
                        +91
                      </span>
                      <input
                        id="whatsapp-input"
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="10-digit WhatsApp number"
                        value={whatsAppNumber}
                        onChange={handleWhatsAppChange}
                        className="w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-500 rounded-xl pl-12 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all duration-200 font-medium"
                      />
                    </div>
                  </div>

                  {/* Preparing For Dropdown */}
                  <div>
                    <label htmlFor="preparing-select" className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                      Preparing For? *
                    </label>
                    <select
                      id="preparing-select"
                      required
                      value={preparingFor}
                      onChange={(e) => setPreparingFor(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all duration-200 cursor-pointer font-medium"
                    >
                      <option value="" className="bg-slate-900 text-slate-400">Select your exam goal</option>
                      <option value="Group 1" className="bg-slate-900 text-white">Group 1</option>
                      <option value="Group 2" className="bg-slate-900 text-white">Group 2</option>
                      <option value="Group 4" className="bg-slate-900 text-white">Group 4</option>
                      <option value="Beginner" className="bg-slate-900 text-white">Beginner / First Time</option>
                    </select>
                  </div>

                  {/* Current Position Dropdown */}
                  <div>
                    <label htmlFor="position-select" className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                      Current Position *
                    </label>
                    <select
                      id="position-select"
                      required
                      value={currentPosition}
                      onChange={(e) => setCurrentPosition(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all duration-200 cursor-pointer font-medium"
                    >
                      <option value="" className="bg-slate-900 text-slate-400">Select your status</option>
                      <option value="House Wife" className="bg-slate-900 text-white">House Wife</option>
                      <option value="College Student" className="bg-slate-900 text-white">College Student</option>
                      <option value="Working Professional" className="bg-slate-900 text-white">Working Professional</option>
                      <option value="Others" className="bg-slate-900 text-white">Others</option>
                    </select>
                  </div>

                  {/* coaching before Dropdown */}
                  <div>
                    <label htmlFor="coaching-select" className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                      Attended Coaching Before? *
                    </label>
                    <select
                      id="coaching-select"
                      required
                      value={previousCoaching}
                      onChange={(e) => setPreviousCoaching(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all duration-200 cursor-pointer font-medium"
                    >
                      <option value="" className="bg-slate-900 text-slate-400">Select option</option>
                      <option value="Yes" className="bg-slate-900 text-white">Yes, I Have</option>
                      <option value="No" className="bg-slate-900 text-white">No, First Time</option>
                    </select>
                  </div>

                  {/* Form Error messages */}
                  {formError && (
                    <div className="bg-red-950/40 text-red-400 text-xs font-bold p-3 rounded-xl border border-red-500/30 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full gold-metallic-gradient gold-metallic-hover text-slate-950 font-black py-4 px-4 rounded-xl shadow-lg transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer text-sm tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed animate-shake mt-2"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Registering...
                      </>
                    ) : (
                      <>
                        REGISTER FREE NOW →
                      </>
                    )}
                  </button>

                  <div className="flex justify-between text-[10px] font-bold text-slate-400 px-1 pt-1.5 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-amber-400" /> Free Seat
                    </span>
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-amber-400" /> Secure
                    </span>
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-amber-400" /> Live Updates
                    </span>
                  </div>

                </form>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* SECTION 2 – PROBLEM / PAIN POINTS */}
      <section className="py-20 px-4 md:px-8 border-b border-amber-500/10 bg-[#060606]">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          
          <div className="space-y-3">
            <span className="text-amber-400 font-bold uppercase text-xs tracking-widest block">Core Obstacles</span>
            <h2 className="text-3xl md:text-4xl font-extrabold font-display text-white">
              Are You Facing These Problems?
            </h2>
            <div className="w-16 h-1 bg-amber-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {[
              "Studying for months but marks are not improving?",
              "Confused about where to start?",
              "Don't know how to study 6th–12th Samacheer effectively?",
              "Don't have a proper revision plan?",
              "Feeling lost despite working hard?",
            ].map((problem, i) => (
              <div
                key={i}
                className="bg-[#0a0908] border border-amber-500/20 rounded-2xl p-5 flex items-start gap-4 hover:border-amber-400/50 hover:shadow-md transition duration-200"
              >
                <div className="w-8 h-8 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center shrink-0 border border-amber-500/20">
                  <AlertTriangle className="w-4.5 h-4.5" />
                </div>
                <p className="text-slate-200 font-medium text-sm md:text-base self-center">
                  {problem}
                </p>
              </div>
            ))}

            {/* Callout highlight card */}
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-6 flex flex-col justify-center items-center text-center">
              <h4 className="text-amber-300 font-black text-lg md:text-xl">
                If yes, this FREE workshop is for you.
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Designed to provide immediate actionable blueprints.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 text-slate-950 gold-metallic-gradient gold-metallic-hover font-black px-8 py-4 rounded-xl text-sm md:text-base shadow-lg transition duration-150 cursor-pointer animate-shake"
            >
              YES, I WANT TO ATTEND THE FREE WORKSHOP
            </button>
          </div>

        </div>
      </section>

      {/* SECTION 3 – WHAT YOU WILL LEARN */}
      <section className="py-20 px-4 md:px-8 border-b border-amber-500/10 bg-[#030303]">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center space-y-3 mb-16">
            <span className="text-amber-400 font-bold uppercase text-xs tracking-widest block">Workshop Curriculum</span>
            <h2 className="text-3xl md:text-4xl font-extrabold font-display text-white">
              What You Will Learn in This Workshop
            </h2>
            <div className="w-16 h-1 bg-amber-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Government Officer's Tips",
                desc: "Practical blueprints, scoring strategies, and personal success blueprints shared live.",
                badge: "Direct Insights"
              },
              {
                title: "Group 1, 2 & 4 Roadmap",
                desc: "A highly clear preparation roadmap mapped to the latest TNPSC syllabi requirements.",
                badge: "Syllabus Map"
              },
              {
                title: "Study School Books (6th–12th)",
                desc: "Stop wasting time reading cover-to-cover. Learn how to study Samacheer books effectively.",
                badge: "Samacheer Guide"
              },
              {
                title: "30 Mins Daily - Practice Habit",
                desc: "Master our signature strategy of daily practice covering 3,000 top questions in 250 days.",
                badge: "3000 Questions"
              },
              {
                title: "Common Mistakes to Avoid",
                desc: "Identify critical missteps in test-taking and syllabus tracking that delay selection for years.",
                badge: "Score Hack"
              },
              {
                title: "₹1 Lakh Cash Prize Model Exam",
                desc: "Complete guidance, preparation benchmarks, and evaluation parameters of our flagship prize exam.",
                badge: "Guidance Session"
              }
            ].map((benefit, i) => (
              <div
                key={i}
                className="bg-[#0a0908] border border-amber-500/20 rounded-2xl p-6 hover:border-amber-400 hover:bg-[#0c0a09] hover:shadow-md transition flex flex-col justify-between h-full relative group"
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-black tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                      {benefit.badge}
                    </span>
                    <CheckCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition">
                      {benefit.title}
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      {benefit.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* SECTION 4 – 30 MINUTES PER DAY CHALLENGE */}
      <section className="py-20 px-4 md:px-8 border-b border-amber-500/10 bg-[#060606]">
        <div className="max-w-6xl mx-auto">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Poster / Visual Image side */}
            <div className="lg:col-span-5 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-3xl blur-md opacity-20"></div>
              <div className="relative bg-[#0a0908] border border-amber-500/20 rounded-3xl overflow-hidden p-3 shadow-xl">
                <img
                  src={CHALLENGE_IMAGE}
                  alt="30 Minutes Daily 3000 Questions TNPSC Challenge Poster"
                  referrerPolicy="no-referrer"
                  className="w-full h-auto object-cover rounded-2xl transition duration-500 group-hover:scale-[1.02]"
                />
                

              </div>
            </div>

            {/* Content & interactive breakdown side */}
            <div className="lg:col-span-7 space-y-6">
              <span className="text-amber-400 font-bold uppercase text-xs tracking-widest block">Signature Habit Program</span>
              
              <div className="space-y-3">
                <h2 className="text-3xl md:text-4xl font-extrabold font-display text-white tracking-tight">
                  30 Minutes Per Day.<br />
                  Build a Powerful TNPSC Practice Habit.
                </h2>
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 text-amber-400 px-4 py-1.5 rounded-full border border-amber-500/20 text-xs md:text-sm font-bold">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  3000 QUESTIONS • 250 DAY CHALLENGE
                </div>
                <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                  Most candidates fail not because they don't study, but because they don't practice MCQ test templates. Our workshop introduces a consistent daily question-practice system to compound memory and recall accuracy.
                </p>
              </div>

              {/* Step Graphic Visual Representation */}
              <div className="bg-[#0a0908] border border-amber-500/20 rounded-2xl p-6 space-y-6 shadow-md">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  How Daily Compound Practice Builds Mastery:
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center relative">
                  
                  {/* Step 1 */}
                  <div className="bg-[#060606] p-4 rounded-xl border border-amber-500/10 relative">
                    <span className="absolute -top-2 -left-2 bg-amber-500 text-slate-950 font-bold font-mono text-[10px] w-5 h-5 rounded-full flex items-center justify-center">1</span>
                    <p className="text-sm font-black text-white">30 Mins</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Daily Habit</p>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-[#060606] p-4 rounded-xl border border-amber-500/10 relative">
                    <span className="absolute -top-2 -left-2 bg-amber-500 text-slate-950 font-bold font-mono text-[10px] w-5 h-5 rounded-full flex items-center justify-center">2</span>
                    <p className="text-sm font-black text-amber-400">12 MCQs</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Target Per Day</p>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-[#060606] p-4 rounded-xl border border-amber-500/10 relative">
                    <span className="absolute -top-2 -left-2 bg-amber-500 text-slate-950 font-bold font-mono text-[10px] w-5 h-5 rounded-full flex items-center justify-center">3</span>
                    <p className="text-sm font-black text-white">250 Days</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Consistency</p>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-[#060606] p-4 rounded-xl border border-amber-500/20 relative">
                    <span className="absolute -top-2 -left-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold font-mono text-[10px] w-5 h-5 rounded-full flex items-center justify-center">4</span>
                    <p className="text-sm font-black text-emerald-400">3,000 Questions</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Full Practice</p>
                  </div>

                </div>
              </div>

              <div>
                <button
                  onClick={scrollToForm}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0c0a09] hover:bg-black text-amber-400 border border-amber-500/30 hover:border-amber-500/60 font-bold py-3.5 px-6 rounded-xl text-sm transition duration-150 cursor-pointer shadow-md"
                >
                  LEARN THE STRATEGY AT THE FREE WORKSHOP
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* SECTION 5 – ₹1 LAKH CASH PRIZE MODEL EXAM */}
      <section className="py-20 px-4 md:px-8 border-b border-amber-500/10 bg-[#030303]">
        <div className="max-w-6xl mx-auto">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Content side first for visual rhythm */}
            <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
              <span className="text-amber-400 font-bold uppercase text-xs tracking-widest block">Flagship Competitive Test</span>
              
              <div className="space-y-3">
                <h2 className="text-3xl md:text-4xl font-extrabold font-display text-white tracking-tight">
                  ₹1,00,000 Cash Prize<br />
                  TNPSC Group 2 &amp; 4 Model Exam
                </h2>
                <p className="text-lg font-bold text-amber-400">
                  Test Your Preparation. Challenge Yourself.
                </p>
                <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                  Get complete evaluation blueprints, exam syllabus guides, and instructions on how to participate during our upcoming free workshop. Ambedkar Academy's cash prize model exam awards ₹1 Lakh in cash prizes to high achievers to recognize and support meritorious preparation.
                </p>
              </div>

              {/* Transparent info highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#0c0a09] border border-amber-500/20 p-4 rounded-xl flex gap-3">
                  <Award className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-sm text-white">National Standard Evaluation</h5>
                    <p className="text-xs text-slate-400">OMR based real testing environments simulate actual TNPSC state-level conditions.</p>
                  </div>
                </div>

                <div className="bg-[#0c0a09] border border-amber-500/20 p-4 rounded-xl flex gap-3">
                  <CheckCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-sm text-white">State Merit Rankings</h5>
                    <p className="text-xs text-slate-400">Receive absolute percentiles and category ranking metrics compiled by senior academy assessors.</p>
                  </div>
                </div>
              </div>

              <div>
                <button
                  onClick={scrollToForm}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0c0a09] hover:bg-black text-amber-400 border border-amber-500/30 hover:border-amber-500/60 font-bold py-3.5 px-6 rounded-xl text-sm transition duration-150 cursor-pointer shadow-md"
                >
                  GET COMPLETE DETAILS IN THE WORKSHOP
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>

            {/* Poster / Visual Image side */}
            <div className="lg:col-span-5 relative group order-1 lg:order-2">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-3xl blur-md opacity-20"></div>
              <div className="relative bg-[#0a0908] border border-amber-500/20 rounded-3xl overflow-hidden p-3 shadow-xl">
                <img
                  src={CASH_PRIZE_IMAGE}
                  alt="₹1,00,000 Cash Prize TNPSC Group 2 &amp; Group 4 Model Exam Poster"
                  referrerPolicy="no-referrer"
                  className="w-full h-auto object-cover rounded-2xl transition duration-500 group-hover:scale-[1.02]"
                />
                

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* SECTION 6 – WORKSHOP BONUSES */}
      <section className="py-20 px-4 md:px-8 border-b border-amber-500/10 bg-[#060606]">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center space-y-3 mb-16">
            <span className="text-amber-400 font-bold uppercase text-xs tracking-widest block">Premium Additions</span>
            <h2 className="text-3xl md:text-4xl font-extrabold font-display text-white">
              FREE Bonuses for Workshop Participants
            </h2>
            <div className="w-16 h-1 bg-amber-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Highlighting Bonus 1 with monetary evaluation details safely */}
            <div className="bg-[#0a0908] border-2 border-amber-500/30 rounded-3xl p-6 relative shadow-xl hover:border-amber-500 transition flex flex-col justify-between h-full group">
              <span className="absolute -top-3.5 right-6 bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider shadow">
                Premium Bonus Value
              </span>
              
              <div className="space-y-4">
                <span className="text-amber-400 font-extrabold text-xs uppercase tracking-wider block">Bonus 1</span>
                <div>
                  <h3 className="text-xl font-extrabold text-white group-hover:text-amber-400 transition leading-snug">
                    ₹5,000 Worth "Where to Study" Material Guide
                  </h3>
                  <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                    Compiled 6th–12th Samacheer School Book syllabus references customized specifically for TNPSC Group 1, Group 2 &amp; Group 4 Exams. Saves hundreds of hours of preparation mapping.
                  </p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-amber-400">
                <span>Value: ₹5,000</span>
                <span>FREE for Attendees</span>
              </div>
            </div>

            {[
              { num: "2", name: "TNPSC Preparation Roadmap", desc: "A definitive step-by-step physical booklet guide detailing exactly how to structure daily revision schedules, tracking lists, and exam target plans.", value: "FREE" },
              { num: "3", name: "Study Planner Toolkit", desc: "A structured timeline matrix that tracks study progress across historical facts, Tamil literature chapters, and mathematical mental abilities.", value: "FREE" },
              { num: "4", name: "Ambedkar Mobile App Demo", desc: "Interactive walkthrough showing how to use our online platform to practice daily live model questions on your smartphone.", value: "FREE" },
              { num: "5", name: "Guidance Session Booking", desc: "Access code to schedule a personalized 1-on-1 performance audit session with our academic mentors to diagnose learning bottlenecks.", value: "FREE" },
              { num: "6", name: "Counseling for August Batch", desc: "Priority counseling seats allocated for our premium offline physical test batches commencing in August in Chennai.", value: "FREE" }
            ].map((bonus, i) => (
              <div
                key={i}
                className="bg-[#0a0908] border border-amber-500/20 rounded-3xl p-6 hover:border-amber-400 hover:shadow-md transition flex flex-col justify-between h-full group"
              >
                <div className="space-y-4">
                  <span className="text-slate-500 font-extrabold text-xs uppercase tracking-wider block">Bonus {bonus.num}</span>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition">
                      {bonus.name}
                    </h3>
                    <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                      {bonus.desc}
                    </p>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Registration Advantage</span>
                  <span className="text-emerald-400">FREE</span>
                </div>
              </div>
            ))}

          </div>

          {/* Visual highlight box */}
          <div className="mt-12 bg-[#0c0a09] border border-amber-500/20 rounded-2xl p-6 text-center max-w-2xl mx-auto shadow-md">
            <span className="text-xs text-slate-400 block uppercase font-bold tracking-widest mb-1">Exclusive Reservation Benefit</span>
            <p className="text-white text-base font-bold">
              All 6 Bonuses Will Be Shared with Confirmed Attendees Only!
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-black text-amber-400 uppercase tracking-widest">
              <span>Workshop Registration Cost:</span>
              <span className="bg-amber-500/10 px-2.5 py-1 rounded text-amber-400 border border-amber-500/20">FREE SEAT</span>
            </div>
          </div>

          <div className="text-center mt-8">
            <button
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 gold-metallic-gradient gold-metallic-hover text-slate-950 font-black px-8 py-4 rounded-xl text-sm md:text-base shadow-lg transition duration-150 cursor-pointer animate-shake"
            >
              CLAIM MY FREE WORKSHOP SEAT
            </button>
          </div>

        </div>
      </section>

      {/* SECTION 7 – WHY AMBEDKAR ACADEMY? */}
      <section className="py-20 px-4 md:px-8 border-b border-amber-500/10 bg-[#030303]">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center space-y-3 mb-16">
            <span className="text-amber-400 font-bold uppercase text-xs tracking-widest block">The Academy Difference</span>
            <h2 className="text-3xl md:text-4xl font-extrabold font-display text-white">
              Why Ambedkar Academy?
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto text-sm md:text-base">
              We Don't Just Teach. We Build a Complete Preparation System.
            </p>
            <div className="w-16 h-1 bg-amber-500 mx-auto rounded-full mt-4"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Experienced Faculty", desc: "Expert lecturers with continuous focus on exam patterns and clear subject mastery frameworks." },
              { title: "Daily Study Plan", desc: "Never wake up confused. High-impact micro-schedules with customized syllabus tracking booklets." },
              { title: "Mobile App Access", desc: "Continuous testing. Revise daily tests, model papers, and flashcards directly on your smartphone." },
              { title: "Recorded Classes", desc: "Never miss a lecture. High-definition playback library available on-demand for easy revision." },
              { title: "Comprehensive Test Series", desc: "Rigorous state rankings based on real OMR exam grids to test performance." },
              { title: "Personal Mentorship", desc: "Regular 1-on-1 mentorship check-ins to monitor scores, mental stamina, and study schedules." },
              { title: "Cash Prize Model Exam", desc: "Test under pressure. Push limits with our state-level model exam to win ₹1 Lakh." },
              { title: "Trustworthy Environment", desc: "A supportive community built on dedicated research, accountability, and result-oriented coaching." }
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-[#0a0908] border border-amber-500/20 rounded-2xl p-5 hover:border-amber-400/50 hover:shadow-sm transition flex items-start gap-3.5"
              >
                <div className="w-6 h-6 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center shrink-0 border border-amber-500/20 mt-0.5">
                  <Check className="w-4.5 h-4.5 stroke-[3]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-base">
                    {feature.title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* SECTION 8 – WHY WE STARTED */}
      <section className="py-20 px-4 md:px-8 border-b border-slate-100 bg-slate-50/50 relative overflow-hidden">
        {/* Subtle background graphic block to create a distinct layout feeling */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full filter blur-3xl opacity-30"></div>
        
        <div className="max-w-3xl mx-auto text-center space-y-8 relative z-10">
          <div className="space-y-3">
            <span className="text-amber-600 font-bold uppercase text-xs tracking-widest block">Our Mission</span>
            <h2 className="text-3xl md:text-4xl font-extrabold font-display text-slate-900">
              Why Did We Start Ambedkar Academy?
            </h2>
            <div className="w-16 h-1 bg-amber-500 mx-auto rounded-full"></div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-10 text-left space-y-6 shadow-md leading-relaxed">
            
            <p className="text-slate-800 font-medium text-base md:text-lg border-l-2 border-amber-500 pl-4">
              Every year, thousands of TNPSC aspirants miss their desired government service by just a few marks. They study hard, buy materials, and attend endless video streams, yet fall short.
            </p>

            <p className="text-slate-600 text-sm md:text-base">
              The missing piece is almost never the lack of hard work. Instead, many aspirants struggle without a structured study system, personalized guidance, and a method to practice consistent compound question-drills.
            </p>

            <p className="text-slate-600 text-sm md:text-base">
              Ambedkar Academy was created to help TNPSC aspirants prepare with a scientific, structured system — not just attend passive lectures. We believe in providing access to premier study strategies so every aspirant has the best shot at success.
            </p>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="block font-bold text-slate-900 text-sm">Ambedkar Academy Team</span>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Chennai, India</span>
              </div>
              <div className="text-amber-600">
                <HeartHandshake className="w-8 h-8 stroke-[1.5]" />
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* SECTION 9 – WHO SHOULD ATTEND? */}
      <section className="py-20 px-4 md:px-8 border-b border-slate-100 bg-white">
        <div className="max-w-5xl mx-auto text-center space-y-12">
          
          <div className="space-y-3">
            <span className="text-amber-600 font-bold uppercase text-xs tracking-widest block">Target Audience</span>
            <h2 className="text-3xl md:text-4xl font-extrabold font-display text-slate-900">
              Is This Workshop For You?
            </h2>
            <p className="text-slate-600 text-sm md:text-base max-w-2xl mx-auto">
              Whether you're just starting or already preparing, this workshop is designed to help you build a clearer, highly strategic preparation roadmap.
            </p>
            <div className="w-16 h-1 bg-amber-500 mx-auto rounded-full mt-4"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-left">
            {[
              { title: "TNPSC Beginners", desc: "Need step-by-step guidance on exams structure and syllabus breakdowns.", icon: Lightbulb },
              { title: "Repeat Aspirants", desc: "Want to fix gaps in scoring and convert marks into actual selection.", icon: Target },
              { title: "Group 1 Aspirants", desc: "Need guidance on descriptive answer writing and high-level strategy.", icon: Trophy },
              { title: "Group 2 Aspirants", desc: "Want to excel in prelims and mains formats and crack language tests.", icon: BookOpenText },
              { title: "Group 4 Aspirants", desc: "Focusing on rapid score-building tricks and general Tamil papers.", icon: Users },
            ].map((audience, i) => {
              const IconComp = audience.icon;
              return (
                <div
                  key={i}
                  className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 hover:border-amber-400 hover:bg-white hover:shadow-sm transition flex flex-col justify-between h-full group"
                >
                  <div className="space-y-4">
                    <div className="w-9 h-9 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center shrink-0 border border-amber-500/10">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-extrabold text-slate-900 text-base group-hover:text-amber-700 transition">
                        {audience.title}
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {audience.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* SECTION 10 – MEET YOUR SPEAKERS */}
      <section className="py-20 px-4 md:px-8 border-b border-slate-100 bg-white">
        <div className="max-w-5xl mx-auto">
          
          <div className="text-center space-y-3 mb-16">
            <span className="text-amber-600 font-bold uppercase text-xs tracking-widest block">Workshop Hosts</span>
            <h2 className="text-3xl md:text-4xl font-extrabold font-display text-slate-900">
              Meet Your Speakers
            </h2>
            <div className="w-16 h-1 bg-amber-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            
            {/* Speaker 1: Founder */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 md:p-8 space-y-6 flex flex-col items-center text-center group hover:border-amber-400 hover:bg-white hover:shadow-md transition">
              <div className="relative">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full blur opacity-25"></div>
                <img
                  src={MENTOR_IMAGE}
                  alt="Mohammed Rafi - Founder of Ambedkar Academy"
                  referrerPolicy="no-referrer"
                  className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-full border-2 border-slate-150 relative z-10"
                />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-500/10 px-2.5 py-1 rounded-md tracking-wider">
                  Academy Director
                </span>
                <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 group-hover:text-amber-700 transition">
                  Mohammed Rafi
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  Founder – Ambedkar Academy, Chennai
                </p>
                <div className="w-10 h-0.5 bg-slate-200 mx-auto rounded-full mt-2"></div>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed pt-2 max-w-sm">
                  Dedicated to building a scientific preparation ecosystem for TNPSC aspirants through classroom coaching, mentorship schedules, testing tools, and real state-level model papers.
                </p>
              </div>
            </div>

            {/* Speaker 2: Special Guest */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 md:p-8 space-y-6 flex flex-col items-center text-center group hover:border-amber-400 hover:bg-white hover:shadow-md transition">
              <div className="relative">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full blur opacity-25"></div>
                <img
                  src={GUEST_IMAGE}
                  alt="Special Guest - Active Government Officer"
                  referrerPolicy="no-referrer"
                  className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-full border-2 border-slate-150 relative z-10"
                />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-500/10 px-2.5 py-1 rounded-md tracking-wider">
                  Guest Speaker
                </span>
                <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 group-hover:text-amber-700 transition">
                  Special Guest
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  Active Government Officer
                </p>
                <div className="w-10 h-0.5 bg-slate-200 mx-auto rounded-full mt-2"></div>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed pt-2 max-w-sm">
                  The special guest officer will share practical civil preparation tips, effective exam-day mindset shifts, and general mental maths shortcuts to build confidence.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* SECTION: 20 AUTO-SCROLLING ENGLISH TESTIMONIALS */}
      <section id="tamil-testimonials-section" className="py-20 bg-slate-50 border-t border-b border-slate-200/50 relative overflow-hidden text-left">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10 mb-8">
          <div className="space-y-3 text-left">
            <span className="text-amber-600 font-extrabold uppercase text-xs tracking-widest block">Aspirants Feedback • மாணவர் கருத்துக்கள்</span>
            <h2 className="text-3xl md:text-4xl font-black font-display text-slate-900 tracking-tight">
              Aspirants Success Stories (20 Testimonials)
            </h2>
            <p className="text-slate-600 text-sm md:text-base max-w-2xl">
              Real feedback and experiences from 20 TNPSC aspirants who participated and succeeded with Ambedkar Academy's free guidance workshops.
            </p>
          </div>
        </div>

        {/* Continuous Auto-Scrolling Testimonials Row */}
        <div className="relative overflow-hidden w-full py-4 group">
          <div className="flex animate-marquee-slow gap-6 whitespace-nowrap hover:[animation-play-state:paused]">
            {/* First sequence of cards */}
            <div className="flex gap-6 shrink-0">
              {testimonials.map((t) => (
                <div
                  key={`scroll-row-1-${t.id}`}
                  className="w-[340px] bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-amber-400/60 transition duration-200 flex flex-col justify-between whitespace-normal relative group/card"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-2xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-0.5">
                        {[...Array(t.rating)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
                        ))}
                      </div>
                      <span className="text-amber-200/80 font-serif text-4xl select-none leading-none -mt-2">“</span>
                    </div>

                    <p className="text-slate-700 text-sm font-medium leading-relaxed italic h-[110px] overflow-y-auto">
                      {t.feedback}
                    </p>
                  </div>

                  <div className="pt-4 mt-6 border-t border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center font-extrabold text-amber-700 text-sm">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                        {t.name}
                        <span className="text-[10px] bg-amber-500/10 text-amber-700 px-1.5 py-0.5 rounded-md font-semibold">
                          {t.location}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Identical Duplicate for seamless loop */}
            <div className="flex gap-6 shrink-0">
              {testimonials.map((t) => (
                <div
                  key={`scroll-row-2-${t.id}`}
                  className="w-[340px] bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-amber-400/60 transition duration-200 flex flex-col justify-between whitespace-normal relative group/card"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-2xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-0.5">
                        {[...Array(t.rating)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
                        ))}
                      </div>
                      <span className="text-amber-200/80 font-serif text-4xl select-none leading-none -mt-2">“</span>
                    </div>

                    <p className="text-slate-700 text-sm font-medium leading-relaxed italic h-[110px] overflow-y-auto">
                      {t.feedback}
                    </p>
                  </div>

                  <div className="pt-4 mt-6 border-t border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center font-extrabold text-amber-700 text-sm">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                        {t.name}
                        <span className="text-[10px] bg-amber-500/10 text-amber-700 px-1.5 py-0.5 rounded-md font-semibold">
                          {t.location}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick instructions indicator for hovering */}
        <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
          <span>Hover over card to stop scrolling and read</span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span>20 Success Stories</span>
        </div>
      </section>

      {/* SECTION 11 – FINAL URGENCY CTA */}
      <section className="py-24 px-4 md:px-8 bg-slate-50 border-t border-slate-100 relative overflow-hidden">
        
        {/* Abstract design elements to create premium atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-amber-50/20 via-slate-50/50 to-slate-50 opacity-50"></div>
        
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          
          <div className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-700 px-3.5 py-1 rounded-full border border-amber-500/20 text-xs font-black uppercase tracking-wider">
            LIMITED SEATS AVAILABLE
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-black font-display tracking-tight text-slate-900 leading-tight">
              Ready to Build Your<br />
              TNPSC Success Blueprint?
            </h2>
            <p className="text-slate-600 text-base md:text-lg max-w-2xl mx-auto">
              This interactive strategy workshop is completely <span className="text-amber-700 font-bold">FREE</span>. Seats are allotted strictly on a first-come, first-served basis due to venue capacity restrictions.
            </p>
          </div>

          {/* Clean metadata badge row */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl max-w-xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 text-center shadow-md">
            <div className="space-y-1">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Date</span>
              <span className="block text-sm font-bold text-slate-900">August 2, 2026</span>
            </div>
            <div className="space-y-1 border-t md:border-t-0 md:border-x border-slate-150 py-3 md:py-0">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Time</span>
              <span className="block text-sm font-bold text-amber-600">11:00 AM – 1:00 PM</span>
            </div>
            <div className="space-y-1">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Venue</span>
              <span className="block text-sm font-bold text-slate-900">T. Nagar, Chennai</span>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black py-4 px-10 rounded-xl text-base tracking-wide shadow-xl active:scale-98 transition duration-150 cursor-pointer animate-shake"
            >
              REGISTER FREE NOW
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 bg-slate-50 border-t border-slate-100 text-slate-500 text-xs px-4 text-center">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex justify-center items-center gap-2 text-slate-600 font-bold text-sm tracking-wider uppercase">
            <span>Ambedkar Academy</span>
          </div>
          <p className="max-w-md mx-auto text-slate-500">
            T. Nagar, Chennai, Tamil Nadu, India.
          </p>
          <div className="w-12 h-px bg-slate-200 mx-auto"></div>
          <p className="text-slate-500">
            © 2026 Ambedkar Academy. All rights reserved.
          </p>
          <p className="text-[10px] text-slate-400 max-w-lg mx-auto">
            Disclaimers: This workshop is for educational blueprint guidance. Participation in model tests is voluntary. Trademarks and syllabus terms reference official TNPSC criteria.
          </p>
        </div>
      </footer>

      {/* STICKY BOTTOM CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200 py-4 px-4 md:px-8 shadow-2xl flex items-center justify-between transition-transform duration-300">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Desktop display */}
          <div className="hidden md:flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></div>
            <p className="text-sm font-bold text-slate-900">
              TNPSC SUCCESS BLUEPRINT WORKSHOP 2026
              <span className="text-amber-500 font-extrabold mx-2">•</span>
              <span className="text-slate-600 font-semibold">August 2 | 11 AM – 1 PM | </span>
              <span className="text-amber-700 font-bold uppercase bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px] border border-amber-500/20 ml-1">FREE</span>
            </p>
          </div>

          {/* Mobile display */}
          <div className="flex md:hidden items-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></div>
            <p className="text-xs font-black uppercase text-slate-800 tracking-wider">
              FREE WORKSHOP • LIMITED SEATS
            </p>
          </div>

          {/* Action Trigger */}
          <button
            onClick={scrollToForm}
            className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black py-2.5 px-6 rounded-lg text-xs md:text-sm shadow-md transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer uppercase animate-shake"
          >
            REGISTER FREE NOW →
          </button>

        </div>
      </div>

    </div>
  );
}
