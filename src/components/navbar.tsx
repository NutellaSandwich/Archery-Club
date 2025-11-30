"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect, useMemo, useRef } from "react";

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
} from "lucide-react";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import NotificationsDropdown from "@/components/notifications-dropdown";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

type UserProfile = {
    id: string;
    username: string | null;
    avatar_url: string | null;
    role?: string | null;
    bow_type?: string | null;
    club_id?: string | null;
};

type NavItem = {
    href: string;
    label: string;
    icon: any;
};

export default function Navbar() {
    const router = useRouter();
    const pathname = usePathname();
    const { theme, systemTheme, setTheme } = useTheme();
    const supabase = useMemo(() => supabaseBrowser(), []);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);

    /* -----------------------------------------
       NAV LAYOUT STATE
    ------------------------------------------ */
    const [visibleCount, setVisibleCount] = useState(999);
    const navbarRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLDivElement>(null);
    const rightRef = useRef<HTMLDivElement>(null);

    /* -----------------------------------------
       SEARCH BAR STATE
    ------------------------------------------ */
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [layoutReady, setLayoutReady] = useState(false);

    /* -----------------------------------------
       MOUNT
    ------------------------------------------ */
    useEffect(() => setMounted(true), []);

    /* -----------------------------------------
       LOAD PROFILE ONCE
    ------------------------------------------ */
    useEffect(() => {
        async function load() {
            const { data: sessionData } = await supabase.auth.getSession();
            const user = sessionData.session?.user;

            if (!user) {
                setProfile(null);
                setLoading(false);
                return;
            }

            const { data: profileData } = await supabase
                .from("profiles")
                .select("id, username, avatar_url, role, bow_type, club_id")
                .eq("id", user.id)
                .maybeSingle();

            setProfile({
                id: user.id,
                username:
                    profileData?.username ??
                    user.user_metadata?.username ??
                    user.email?.split("@")[0] ??
                    "Archer",
                avatar_url:
                    profileData?.avatar_url ??
                    user.user_metadata?.avatar_url ??
                    null,
                role: profileData?.role ?? null,
                bow_type: profileData?.bow_type ?? null,
                club_id: profileData?.club_id ?? null,
            });

            setLoading(false);
        }

        load();

        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event: AuthChangeEvent, _session: Session | null) => load()
        );

        return () => listener?.subscription?.unsubscribe();
    }, [supabase]);

    /* -----------------------------------------
       NAV ITEMS
    ------------------------------------------ */
    const navItems = useMemo(() => {
        if (!profile) return [];
        return [
            { href: "/dashboard", label: "Feed", icon: LayoutDashboard },
            { href: "/dashboard/signups", label: "Signups", icon: ClipboardList },
            { href: "/dashboard/club-records", label: "Club Records", icon: Award },
            { href: "/dashboard/coaching", label: "Coaching", icon: Target },
            { href: "/dashboard/scoring", label: "Scoring", icon: BowArrow },
            ...(profile.role === "admin"
                ? [
                    { href: "/dashboard/trophies", label: "Trophies", icon: Trophy },
                    { href: "/dashboard/join-requests", label: "Join Requests", icon: User },
                ]
                : []),
            { href: "/profile", label: "Profile", icon: UserCircle2 },
        ];
    }, [profile]);

    /* -----------------------------------------
       LAYOUT CALCULATION
    ------------------------------------------ */
    function updateLayout() {
        if (!navbarRef.current || !measureRef.current || !rightRef.current) return;

        const totalWidth = navbarRef.current.clientWidth;
        const rightWidth = rightRef.current.clientWidth + 24;
        const available = totalWidth - rightWidth;

        const children = Array.from(
            measureRef.current.children
        ) as HTMLElement[];

        let used = 0;
        let count = 0;

        for (const el of children) {
            used += el.clientWidth + 12;
            if (used <= available) count++;
            else break;
        }

        setVisibleCount(count);
    }

    useEffect(() => {
        const obs = new ResizeObserver(updateLayout);
        if (navbarRef.current) obs.observe(navbarRef.current);
        updateLayout();
        return () => obs.disconnect();
    }, [profile]);

    /* -----------------------------------------
       SEARCH LOGIC (debounced)
    ------------------------------------------ */
    useEffect(() => {
        if (!profile?.club_id || query.length < 2) {
            setResults([]);
            setShowResults(false);
            return;
        }

        const timeout = setTimeout(async () => {
            const { data } = await supabase
                .from("profiles")
                .select("id, username, avatar_url, bow_type")
                .eq("club_id", profile.club_id)
                .ilike("username", `%${query}%`)
                .limit(5);

            setResults(data || []);
            setShowResults(true);
        }, 250);

        return () => clearTimeout(timeout);
    }, [query, profile?.club_id]);

    useEffect(() => {
        const obs = new ResizeObserver(() => {
            updateLayout();
            setLayoutReady(true); // allow animation once measured
        });

        if (navbarRef.current) obs.observe(navbarRef.current);
        updateLayout();
        setLayoutReady(true); // first measurement

        return () => obs.disconnect();
    }, [profile]);

    /* -----------------------------------------
       NAV LINK
    ------------------------------------------ */
    function NavLink({ href, label, icon: Icon }: NavItem) {
        const isActive =
            pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

        return (
            <Link
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm transition ${isActive
                        ? "text-primary underline underline-offset-4"
                        : "text-foreground hover:text-primary"
                    }`}
            >
                {Icon && <Icon size={16} />}
                {label}
            </Link>
        );
    }

    /* -----------------------------------------
       SHARED OVERFLOW DROPDOWN
    ------------------------------------------ */
    const OverflowDropdown = ({ items }: { items: NavItem[] }) => (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button className="flex items-center px-2 py-2 hover:bg-muted/30 rounded-md">
                    <Menu size={18} />
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content
                className="min-w-[180px] p-2 rounded-xl border shadow-md bg-background"
            >
                {items.map((item) => (
                    <DropdownMenu.Item key={item.href} asChild>
                        <Link
                            href={item.href}
                            className="px-3 py-2 flex items-center gap-2 rounded-md hover:bg-muted/30"
                        >
                            <item.icon size={16} />
                            {item.label}
                        </Link>
                    </DropdownMenu.Item>
                ))}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );

    /* -----------------------------------------
       THEME TOGGLE
    ------------------------------------------ */
    function ThemeToggle() {
        if (!mounted) return null;
        const current = theme === "system" ? systemTheme : theme;
        const isDark = current === "dark";

        return (
            <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="p-2 rounded-lg hover:bg-muted/40"
            >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
        );
    }

    /* -----------------------------------------
       LOGOUT
    ------------------------------------------ */
    async function logout() {
        await supabase.auth.signOut({ scope: "local" });
        localStorage.clear();
        sessionStorage.clear();
        router.push("/");
    }

    function MobileFullScreenMenu({ items }: { items: NavItem[] }) {
        const [open, setOpen] = useState(false);
        const [mounted, setMounted] = useState(false);

        useEffect(() => setMounted(true), []);

        async function handleLogout() {
            await supabase.auth.signOut({ scope: "local" });
            localStorage.clear();
            sessionStorage.clear();
            router.push("/");
        }

        const containerVariants = {
            hidden: { opacity: 0 },
            show: {
                opacity: 1,
                transition: { staggerChildren: 0.05, delayChildren: 0.1 }
            }
        };

        const itemVariants = {
            hidden: { opacity: 0, y: 6 },
            show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.18 }
            }
        };

        return (
            <>
                {/* Trigger */}
                <button
                    onClick={() => setOpen(true)}
                    className="md:hidden flex items-center px-2 py-2 hover:bg-muted/30 rounded-md"
                >
                    <Menu size={20} />
                </button>

                {mounted &&
                    createPortal(
                        <AnimatePresence>
                            {open && (
                                <>
                                    {/* BACKDROP */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="
                                        fixed inset-0 z-[998]
                                        bg-white/0
                                        backdrop-blur-[6px]
                                        md:hidden
                                    "
                                        onClick={() => setOpen(false)}
                                    />

                                    {/* CONTENT */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.97 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.97 }}
                                        transition={{ duration: 0.18 }}
                                        className="
                                        fixed inset-0 z-[999]
                                        flex flex-col items-center justify-center
                                        px-15
                                    "
                                        onClick={() => setOpen(false)}
                                    >
                                        {/* CLOSE BUTTON (NO BOX, JUST ✕) */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpen(false);
                                            }}
                                            className="
                                            absolute top-6 right-6 
                                            text-white text-2xl 
                                            transition-transform
                                            hover:scale-[1.22]
                                            active:scale-[0.90]
                                            drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]
                                        "
                                        >
                                            ✕
                                        </button>

                                        {/* MENU */}
                                        <motion.div
                                            onClick={(e) => e.stopPropagation()}
                                            variants={containerVariants}
                                            initial="hidden"
                                            animate="show"
                                            className="flex flex-col gap-5 text-base font-medium text-white"
                                        >
                                            {items.map((item) => (
                                                <motion.div
                                                    key={item.href}
                                                    variants={itemVariants}
                                                    whileHover={{ scale: 1.15 }}
                                                    whileTap={{ scale: 0.90 }}
                                                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                                                >
                                                    <Link
                                                        href={item.href}
                                                        onClick={() => setOpen(false)}
                                                        className="
                                                            flex items-center gap-3
                                                            text-white
                                                            drop-shadow-[0_0_4px_rgba(255,255,255,0.28)]
                                                            hover:opacity-80
                                                        "
                                                    >
                                                        <item.icon size={30} />
                                                        {item.label}
                                                    </Link>
                                                </motion.div>
                                            ))}

                                            <motion.button
                                                variants={itemVariants}
                                                whileHover={{ scale: 1.15 }}
                                                whileTap={{ scale: 0.90 }}
                                                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                                                onClick={handleLogout}
                                                className="
        flex items-center gap-3
        text-red-300
        drop-shadow-[0_0_6px_rgba(255,60,60,0.5)]
        hover:opacity-80
    "
                                            >
                                                <LogOut size={30} />
                                                Logout
                                            </motion.button>
                                        </motion.div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>,
                        document.body
                    )}
            </>
        );
    }

    /* -----------------------------------------
       RENDER
    ------------------------------------------ */
    return (
        <nav
            ref={navbarRef}
            className="sticky top-0 z-50 mt-2 mb-4 flex items-center justify-between 
            rounded-2xl border bg-background/70 backdrop-blur-md shadow-md px-3 sm:px-6 py-2.5"
        >
            {/* LEFT */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <Link href="/" className="text-lg font-semibold hover:text-primary">
                    Arcus
                </Link>

                {!loading && profile && layoutReady && (
                    <div className="hidden md:flex items-center gap-3 relative">

                        {/* Static inline items (all except the last visible) */}
                        <div className="flex items-center gap-3">
                            {navItems.slice(0, Math.max(0, visibleCount - 1)).map((item) => (
                                <NavLink key={item.href} {...item} />
                            ))}

                            {/* Animated transition item (only one that disappears) */}
                            <AnimatePresence mode="popLayout" initial={false}>
                                {visibleCount > 0 && visibleCount <= navItems.length && (
                                    <motion.div
                                        key={navItems[visibleCount - 1].href}
                                        initial={{ opacity: 1, x: 0 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 12 }}   // ← move toward dropdown
                                        transition={{ duration: 0.18, ease: "easeOut" }}
                                    >
                                        <NavLink {...navItems[visibleCount - 1]} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Dropdown for overflow items */}
                        {visibleCount < navItems.length && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <OverflowDropdown items={navItems.slice(visibleCount)} />
                            </motion.div>
                        )}
                    </div>
                )}

                {!loading && profile && (
                    <MobileFullScreenMenu items={navItems} />
                )}
            </div>

            {/* MEASUREMENT */}
            <div
                ref={measureRef}
                className="absolute opacity-0 pointer-events-none h-0 overflow-hidden"
            >
                {navItems.map((item) => (
                    <div key={item.href} className="flex items-center px-3 py-2 text-sm">
                        {item.label}
                    </div>
                ))}
            </div>

            {/* RIGHT */}
            <div
                ref={rightRef}
                className="flex items-center gap-2 sm:gap-3 min-w-0 shrink"
            >

                {/* SEARCH */}
                {!loading && profile && (
                    <div className="relative w-40 sm:w-48 md:w-56">
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={() => results.length && setShowResults(true)}
                            onBlur={() => setTimeout(() => setShowResults(false), 200)}
                            className="w-full rounded-full border bg-muted/30 
px-2 py-1 text-xs
sm:px-3 sm:py-1.5 sm:text-sm
focus:ring-2 focus:ring-primary"                        />

                        {showResults && results.length > 0 && (
                            <div className="absolute mt-2 w-64 bg-popover border rounded-xl shadow-lg p-2 z-50">
                                {results.map((u) => (
                                    <Link
                                        key={u.id}
                                        href={`/profile/${u.id}`}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30"
                                    >
                                        <Image
                                            src={u.avatar_url ?? "/default-avatar.png"}
                                            alt="Avatar"
                                            width={32}
                                            height={32}
                                            className="rounded-full h-8 w-8 object-cover border"
                                        />
                                        <div>
                                            <span className="text-sm font-medium">{u.username}</span>
                                            {u.bow_type && (
                                                <span className="block text-xs text-muted-foreground uppercase">
                                                    {u.bow_type}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* THEME */}
                <ThemeToggle />

                {/* NOTIFICATIONS */}
                {!loading && profile && (
                    <NotificationsDropdown userId={profile.id} />
                )}

                {/* PROFILE DROPDOWN */}
                {!loading && profile && (
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <div className="cursor-pointer flex items-center hover:opacity-80 transition">
                                <Image
                                    src={
                                        profile.avatar_url?.startsWith("http")
                                            ? profile.avatar_url
                                            : "/default-avatar.png"
                                    }
                                    alt="Avatar"
                                    width={34}
                                    height={34}
                                    className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover border"
                                />
                            </div>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Content className="min-w-[180px] p-2 border rounded-xl shadow-md bg-background">                            <DropdownMenu.Label className="px-3 py-2 text-xs text-muted-foreground">
                                {profile.username}
                            </DropdownMenu.Label>

                            <DropdownMenu.Item asChild>
                                <Link
                                    href="/profile/edit"
                                    className="px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted/30 rounded-md"
                                >
                                    <User size={14} /> Edit Profile
                                </Link>
                            </DropdownMenu.Item>

                            <DropdownMenu.Separator className="h-px bg-border my-1" />

                            <DropdownMenu.Item
                                onSelect={logout}
                                className="px-3 py-2 text-sm text-red-500 flex gap-2 items-center rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                            >
                                <LogOut size={14} /> Logout
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                )}
            </div>
        </nav>
    );
}