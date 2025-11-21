"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
    Moon,
    Sun,
    LogOut,
    User,
    Target,
    Trophy,
    LayoutDashboard,
    ClipboardList,
    Award,
    UserCircle2,
    BowArrow,
    Menu,
    X,
} from "lucide-react";
import { useTheme } from "next-themes";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { supabaseBrowser } from "@/lib/supabase-browser";
import NotificationsDropdown from "@/components/notifications-dropdown";
import { Button } from "@/components/ui/button";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

type UserProfile = {
    id: string;
    username: string | null;
    full_name: string | null; // ✅ added
    avatar_url: string | null;
    role?: string | null;
};

export default function Navbar() {
    const router = useRouter();
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const supabase = useMemo(() => supabaseBrowser(), []);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const { data: listener } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, session: Session | null) => {
                if (event === "SIGNED_OUT") {
                    console.warn("🔴 Signed out detected, clearing session");
                    localStorage.removeItem("sb-pivysrujmfjxaauahclj-auth-token");
                    sessionStorage.clear();
                    router.push("/");
                }

                if (event === "TOKEN_REFRESHED" && !session) {
                    console.warn("🔴 Invalid refresh token — forcing logout");
                    await supabase.auth.signOut({ scope: "local" });
                    localStorage.removeItem("sb-pivysrujmfjxaauahclj-auth-token");
                    sessionStorage.clear();
                    router.push("/");
                }

                if (event === "SIGNED_IN") {
                    console.log("✅ Signed in event received");
                }
            }
        );

        return () => listener?.subscription?.unsubscribe?.();
    }, [supabase, router]);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        let isMounted = true;

        async function loadProfile() {
            try {
                setLoading(true);
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                const user = session?.user;
                if (!user) {
                    if (isMounted) {
                        setProfile(null);
                        setLoading(false);
                    }
                    return;
                }

                const { data: profileData, error } = await supabase
                    .from("profiles")
                    .select("id, username, full_name, avatar_url, role") // ✅ added full_name
                    .eq("id", user.id)
                    .maybeSingle();

                if (!error && profileData && isMounted) {
                    setProfile(profileData);
                } else if (isMounted) {
                    setProfile({
                        id: user.id,
                        username: user.email ?? "User",
                        full_name: null,
                        avatar_url: null,
                    });
                }
            } catch (err) {
                console.error("Navbar profile load error:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadProfile();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event: AuthChangeEvent, session: Session | null) => {
                if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                    loadProfile();
                }
                if (event === "SIGNED_OUT") {
                    setProfile(null);
                }
            }
        );

        return () => {
            isMounted = false;
            authListener?.subscription?.unsubscribe?.();
        };
    }, [supabase]);

    async function handleLogout() {
        try {
            // Sign out locally and clear any stored auth data
            await supabase.auth.signOut({ scope: "local" });
            localStorage.removeItem("sb-pivysrujmfjxaauahclj-auth-token");
            sessionStorage.clear();
            setProfile(null);

            // Call your API logout endpoint to clear cookies and sign out server-side
            await fetch("/logout", { method: "POST" });

            // Redirect to main page
            router.push("/");
            router.refresh();
        } catch (error) {
            console.error("Logout failed:", error);
        }
    }

    function NavLink({
        href,
        label,
        icon: Icon,
    }: {
        href: string;
        label: string;
        icon?: any;
    }) {
        const isDashboardRoot = href === "/dashboard";
        const active = isDashboardRoot
            ? pathname === href
            : pathname === href || pathname.startsWith(href + "/");

        return (
            <Link
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${active
                        ? "text-[hsl(var(--primary))] underline underline-offset-4"
                        : "text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))]"
                    }`}
            >
                {Icon && <Icon size={16} strokeWidth={2} />} {label}
            </Link>
        );
    }

    function ThemeToggle() {
        if (!mounted) return null;
        const isDark = theme === "dark";
        return (
            <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="p-2 rounded-lg hover:bg-[hsl(var(--muted))]/40 transition-all duration-300"
            >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
        );
    }

    return (
        <nav
            className="sticky top-0 z-50 mx-auto mt-2 mb-4 flex items-center justify-between
        rounded-2xl border border-[hsl(var(--border))]/50
        bg-[hsl(var(--background))]/70 backdrop-blur-md
        px-4 sm:px-6 py-3 shadow-md transition-all duration-300"
        >
            {/* Left section */}
            <div className="flex items-center gap-4">
                <Link
                    href="/"
                    className="text-lg font-semibold hover:text-[hsl(var(--primary))]"
                >
                    Archery Club
                </Link>

                {/* Desktop navigation */}
                {!loading && profile && (
                    <div className="hidden md:flex items-center gap-3">
                        <NavLink href="/dashboard" label="Feed" icon={LayoutDashboard} />
                        <NavLink href="/dashboard/signups" label="Signups" icon={ClipboardList} />
                        <NavLink href="/dashboard/club-records" label="Club Records" icon={Award} />
                        <NavLink href="/dashboard/coaching" label="Coaching" icon={Target} />
                        <NavLink href="/dashboard/scoring" label="Scoring" icon={BowArrow} />
                        {profile.role === "admin" && (
                            <>
                                <NavLink href="/dashboard/trophies" label="Trophies" icon={Trophy} />
                                <NavLink
                                    href="/dashboard/join-requests"
                                    label="Join Requests"
                                    icon={User}
                                />
                            </>
                        )}
                        <NavLink href="/profile" label="Profile" icon={UserCircle2} />
                    </div>
                )}
            </div>

            {/* Right section */}
            <div className="flex items-center gap-3">
                <ThemeToggle />
                {!loading && profile && <NotificationsDropdown userId={profile.id} />}

                {/* Mobile menu toggle */}
                {!loading && profile && (
                    <button
                        onClick={() => setMenuOpen((p) => !p)}
                        className="md:hidden p-2 rounded-lg hover:bg-[hsl(var(--muted))]/40"
                    >
                        {menuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                )}

                {/* Profile dropdown (desktop only) */}
                {!loading && profile && (
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button className="hidden md:flex items-center gap-2 rounded-full focus:outline-none hover:opacity-80 transition-opacity">
                                {profile.avatar_url ? (
                                    <Image
                                        src={profile.avatar_url}
                                        alt="Avatar"
                                        width={34}
                                        height={34}
                                        className="h-8 w-8 rounded-full object-cover border border-[hsl(var(--border))] bg-gray-100"
                                        style={{ aspectRatio: "1 / 1" }}
                                    />
                                ) : (
                                    <div className="h-8 w-8 rounded-full border border-[hsl(var(--border))] flex items-center justify-center text-xs bg-gray-200 text-gray-600">
                                        ?
                                    </div>
                                )}
                            </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                className="min-w-[180px] rounded-xl border border-[hsl(var(--border))]/40 bg-[hsl(var(--popover))] p-2 shadow-md"
                                sideOffset={6}
                            >
                                <DropdownMenu.Label className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                                    {profile.full_name || profile.username || "Archer"}
                                </DropdownMenu.Label>

                                <DropdownMenu.Item asChild>
                                    <Link
                                        href="/profile/edit"
                                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]/40"
                                    >
                                        <User size={14} /> Edit Profile
                                    </Link>
                                </DropdownMenu.Item>

                                <DropdownMenu.Separator className="h-px bg-[hsl(var(--border))]/40 my-1" />

                                <DropdownMenu.Item
                                    onSelect={handleLogout}
                                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                >
                                    <LogOut size={14} /> Logout
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                )}

                {!loading && !profile && (
                    <Link
                        href="/login"
                        className="rounded-md bg-[hsl(var(--primary))] px-4 py-1.5 text-[hsl(var(--primary-foreground))] text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        Login
                    </Link>
                )}
            </div>

            {/* Mobile dropdown menu */}
            {menuOpen && !loading && profile && (
                <div className="absolute top-[100%] left-0 w-full border-t border-[hsl(var(--border))]/40 bg-[hsl(var(--background))] shadow-lg md:hidden animate-in fade-in slide-in-from-top-2 p-4">
                    <div className="flex flex-col space-y-2">
                        <NavLink href="/dashboard" label="Feed" icon={LayoutDashboard} />
                        <NavLink href="/dashboard/signups" label="Signups" icon={ClipboardList} />
                        <NavLink href="/dashboard/club-records" label="Club Records" icon={Award} />
                        <NavLink href="/dashboard/coaching" label="Coaching" icon={Target} />
                        <NavLink href="/dashboard/scoring" label="Scoring" icon={BowArrow} />
                        {profile.role === "admin" && (
                            <>
                                <NavLink href="/dashboard/trophies" label="Trophies" icon={Trophy} />
                                <NavLink
                                    href="/dashboard/join-requests"
                                    label="Join Requests"
                                    icon={User}
                                />
                            </>
                        )}
                        <NavLink href="/profile" label="Profile" icon={UserCircle2} />
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-sm text-red-500 font-medium hover:underline mt-2"
                        >
                            <LogOut size={14} /> Logout
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}