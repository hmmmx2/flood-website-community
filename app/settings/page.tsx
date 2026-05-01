"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useSession, signOut } from "next-auth/react";
import { sessionToAuthUser, getInitials } from "@/lib/auth";
import { authFetch } from "@/lib/authFetch";
import {
  isPushSupported,
  getSubscriptionState,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pushNotifications";

const CRM_URL = process.env.NEXT_PUBLIC_CRM_URL || "http://localhost:3000";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const user = session?.user ? sessionToAuthUser(session.user) : null;

  const [activeTab, setActiveTab] = useState<"profile" | "password" | "notifications" | "danger">("profile");

  // Notification state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMsg, setPushMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!session) return;
    if (!user) { router.replace("/login"); return; }

    const parts = user.displayName?.split(" ") ?? [];
    setFirstName(parts[0] ?? "");
    setLastName(parts.slice(1).join(" "));
    setAvatarUrl(user.avatarUrl ?? "");

    // Init push notification state
    setPushSupported(isPushSupported());
    getSubscriptionState().then(({ permission, subscribed }) => {
      setPushPermission(permission);
      setPushSubscribed(subscribed);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function handlePushToggle() {
    setPushLoading(true);
    setPushMsg(null);
    try {
      if (pushSubscribed) {
        await unsubscribeFromPush();
        setPushSubscribed(false);
        setPushMsg({ type: "success", text: "Push notifications disabled." });
      } else {
        const result = await subscribeToPush();
        if (result === "subscribed") {
          setPushSubscribed(true);
          setPushPermission("granted");
          setPushMsg({ type: "success", text: "Push notifications enabled! You will now receive flood alerts." });
        } else if (result === "denied") {
          setPushPermission("denied");
          setPushMsg({ type: "error", text: "Notification permission denied. Please allow notifications in your browser settings." });
        } else {
          setPushMsg({ type: "error", text: "Push notifications are not supported in this browser." });
        }
      }
    } catch {
      setPushMsg({ type: "error", text: "Failed to update notification settings. Please try again." });
    } finally {
      setPushLoading(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) { setProfileMsg({ type: "error", text: "First name is required." }); return; }
    setProfileSaving(true); setProfileMsg(null);
    try {
      const res = await authFetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          avatarUrl: avatarUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setProfileMsg({ type: "error", text: d.error || "Failed to save profile." });
        return;
      }
      const updated = await res.json();
      const newName = updated.displayName || `${firstName.trim()} ${lastName.trim()}`.trim();
      const newImage = (updated.avatarUrl ?? avatarUrl.trim()) || null;

      // Update the NextAuth session so Navbar and other components reflect the new name/avatar
      await update({ user: { name: newName, image: newImage } });
      setProfileMsg({ type: "success", text: "Profile updated successfully." });
    } catch {
      setProfileMsg({ type: "error", text: "Connection error. Please try again." });
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 8) { setPwMsg({ type: "error", text: "New password must be at least 8 characters." }); return; }
    if (newPw !== confirmPw) { setPwMsg({ type: "error", text: "Passwords do not match." }); return; }
    setPwSaving(true); setPwMsg(null);
    try {
      const res = await authFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setPwMsg({ type: "error", text: d.error || d.message || "Failed to change password." });
        return;
      }
      setPwMsg({ type: "success", text: "Password changed successfully. Please sign in again." });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => signOut({ callbackUrl: "/login" }), 2000);
    } catch {
      setPwMsg({ type: "error", text: "Connection error. Please try again." });
    } finally {
      setPwSaving(false);
    }
  }

  function handleSignOut() {
    signOut({ callbackUrl: `${CRM_URL}/login` });
  }

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-brand)]" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Navbar user={user} />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-brand)] transition-colors mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Back to Feed
          </Link>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Account Settings</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">Manage your profile, security, and account preferences.</p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar tabs */}
          <nav className="w-44 flex-shrink-0">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
              {/* Avatar */}
              <div className="p-4 border-b border-[var(--color-border)] flex flex-col items-center gap-2">
                <div className="h-14 w-14 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-xl font-bold text-white">
                  {getInitials(user.displayName)}
                </div>
                <p className="text-xs font-semibold text-[var(--color-text)] text-center truncate w-full">{user.displayName}</p>
                <p className="text-[10px] text-[var(--color-muted)] text-center truncate w-full">{user.email}</p>
              </div>
              <div className="p-1.5 space-y-0.5">
                {([
                  { key: "profile", label: "Profile", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /> },
                  { key: "password", label: "Password", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /> },
                  { key: "notifications", label: "Alerts", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /> },
                  { key: "danger", label: "Account", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /> },
                ] as const).map(tab => (
                  <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? "bg-[var(--color-brand)] text-white"
                        : "text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                    }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-4 w-4 flex-shrink-0">
                      {tab.icon}
                    </svg>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="p-1.5 border-t border-[var(--color-border)] mt-1">
                <button type="button" onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Profile tab */}
            {activeTab === "profile" && (
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6">
                <h2 className="font-bold text-[var(--color-text)] text-lg mb-1">Profile Information</h2>
                <p className="text-sm text-[var(--color-muted)] mb-6">Update your display name and avatar.</p>
                {profileMsg && (
                  <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                    profileMsg.type === "success"
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-red-50 border-red-200 text-red-600"
                  }`}>{profileMsg.text}</div>
                )}
                <form onSubmit={saveProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-muted)] mb-1.5 uppercase tracking-wide">First Name</label>
                      <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-muted)] mb-1.5 uppercase tracking-wide">Last Name</label>
                      <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-muted)] mb-1.5 uppercase tracking-wide">Email</label>
                    <input type="email" value={user.email} disabled
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-pill-bg)] px-4 py-2.5 text-sm text-[var(--color-muted)] cursor-not-allowed" />
                    <p className="text-xs text-[var(--color-muted)] mt-1">Email address cannot be changed.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-muted)] mb-1.5 uppercase tracking-wide">Avatar URL <span className="normal-case font-normal">(optional)</span></label>
                    <input type="url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10" />
                  </div>
                  <button type="submit" disabled={profileSaving}
                    className="rounded-full bg-[var(--color-brand)] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-dark)] disabled:opacity-50">
                    {profileSaving ? "Saving…" : "Save Changes"}
                  </button>
                </form>
              </div>
            )}

            {/* Password tab */}
            {activeTab === "password" && (
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6">
                <h2 className="font-bold text-[var(--color-text)] text-lg mb-1">Change Password</h2>
                <p className="text-sm text-[var(--color-muted)] mb-6">You&apos;ll be signed out after changing your password.</p>
                {pwMsg && (
                  <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                    pwMsg.type === "success"
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-red-50 border-red-200 text-red-600"
                  }`}>{pwMsg.text}</div>
                )}
                <form onSubmit={changePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-muted)] mb-1.5 uppercase tracking-wide">Current Password</label>
                    <div className="relative">
                      <input type={showPw ? "text" : "password"} value={currentPw} onChange={e => setCurrentPw(e.target.value)} required placeholder="Your current password"
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 pr-12 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10" />
                      <button type="button" onClick={() => setShowPw(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]">
                        {showPw ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-muted)] mb-1.5 uppercase tracking-wide">New Password</label>
                    <input type={showPw ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} required placeholder="At least 8 characters"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/10" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-muted)] mb-1.5 uppercase tracking-wide">Confirm New Password</label>
                    <input type={showPw ? "text" : "password"} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required placeholder="Repeat new password"
                      className={`w-full rounded-xl border bg-[var(--color-input-bg)] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]/10 ${
                        confirmPw && confirmPw !== newPw ? "border-red-400 focus:border-red-400" : "border-[var(--color-border)] focus:border-[var(--color-brand)]"
                      }`} />
                    {confirmPw && confirmPw !== newPw && <p className="mt-1 text-xs text-red-500">Passwords do not match</p>}
                  </div>
                  <button type="submit" disabled={pwSaving}
                    className="rounded-full bg-[var(--color-brand)] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-dark)] disabled:opacity-50">
                    {pwSaving ? "Changing…" : "Change Password"}
                  </button>
                </form>
              </div>
            )}

            {/* Notifications tab */}
            {activeTab === "notifications" && (
              <div className="space-y-4">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6">
                  <h2 className="font-bold text-[var(--color-text)] text-lg mb-1">Flood Alert Notifications</h2>
                  <p className="text-sm text-[var(--color-muted)] mb-6">
                    Receive real-time push notifications in your browser when sensor nodes report warning or critical flood levels.
                  </p>

                  {pushMsg && (
                    <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                      pushMsg.type === "success"
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-red-50 border-red-200 text-red-600"
                    }`}>{pushMsg.text}</div>
                  )}

                  {!pushSupported ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                      Push notifications are not supported in this browser. Please use Chrome, Edge, or Firefox on desktop.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Status pill */}
                      <div className="flex items-center gap-3">
                        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                          pushSubscribed
                            ? "bg-green-100 text-green-700"
                            : "bg-[var(--color-pill-bg)] text-[var(--color-muted)]"
                        }`}>
                          <span className={`h-2 w-2 rounded-full ${pushSubscribed ? "bg-green-500" : "bg-gray-400"}`} />
                          {pushSubscribed ? "Enabled" : "Disabled"}
                        </div>
                        {pushPermission === "denied" && (
                          <span className="text-xs text-red-500">
                            Blocked in browser — allow notifications in site settings to enable.
                          </span>
                        )}
                      </div>

                      {/* Toggle button */}
                      <button
                        type="button"
                        onClick={handlePushToggle}
                        disabled={pushLoading || pushPermission === "denied"}
                        className={`rounded-full px-6 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                          pushSubscribed
                            ? "bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-muted)] hover:border-red-300 hover:text-red-500"
                            : "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)]"
                        }`}
                      >
                        {pushLoading
                          ? "Updating…"
                          : pushSubscribed
                          ? "Disable Notifications"
                          : "Enable Notifications"}
                      </button>

                      {/* What you'll receive */}
                      <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                        {[
                          { level: "warning", color: "text-amber-600", bg: "bg-amber-50", label: "Warning Level", desc: "Water level reaching 2.5 m — heightened monitoring required." },
                          { level: "critical", color: "text-red-600", bg: "bg-red-50", label: "Critical Level", desc: "Water level exceeding 4.0 m — immediate danger, evacuate if necessary." },
                        ].map((item) => (
                          <div key={item.level} className="flex items-start gap-3 px-4 py-3">
                            <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${item.bg} ${item.color}`}>
                              {item.label}
                            </span>
                            <p className="text-xs text-[var(--color-muted)] leading-relaxed">{item.desc}</p>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-[var(--color-muted)]">
                        Notifications are delivered via your browser&apos;s built-in Web Push service. No app download required.
                        Your subscription is stored securely and can be revoked at any time.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Danger tab */}
            {activeTab === "danger" && (
              <div className="space-y-4">
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6">
                  <h2 className="font-bold text-[var(--color-text)] text-lg mb-1">Account Information</h2>
                  <p className="text-sm text-[var(--color-muted)] mb-4">Your account details and membership.</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                      <span className="text-[var(--color-muted)]">Account Type</span>
                      <span className="font-semibold text-[var(--color-text)] capitalize">{user.role}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                      <span className="text-[var(--color-muted)]">Email</span>
                      <span className="font-semibold text-[var(--color-text)]">{user.email}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[var(--color-muted)]">Platform</span>
                      <span className="font-semibold text-[var(--color-text)]">FloodWatch Community</span>
                    </div>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                  <h2 className="font-bold text-red-700 text-base mb-1">Sign Out</h2>
                  <p className="text-sm text-red-600/80 mb-4">Sign out of your account on this device.</p>
                  <button type="button" onClick={handleSignOut}
                    className="rounded-full border border-red-400 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
