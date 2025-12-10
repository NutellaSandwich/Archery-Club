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
    LayoutDashboard,
    ClipboardList,
    Award,
    UserCircle2,
    BowArrow,
    Menu,
    Shield,
} from "lucide-react";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import NotificationsDropdown from "@/components/notifications-dropdown";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/AuthProvider";
import type { Session } from "@supabase/supabase-js";
import type { Variants } from "framer-motion";

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
    const { session } = useAuth();

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
       LOAD PROFILE WHEN SESSION CHANGES
    ------------------------------------------ */
    useEffect(() => {
        if (!session) {
            setProfile(null);
            setLoading(false);
            return;
        }

        async function loadProfile(currentSession: Session) {
            setLoading(true);

            const user = currentSession.user;

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

        loadProfile(session);
    }, [session, supabase]);

    /* -----------------------------------------
       NAV ITEMS
    ------------------------------------------ */
    const navItems: NavItem[] = useMemo(() => {
        if (!profile) return [];

        return [
            { href: "/dashboard", label: "Feed", icon: LayoutDashboard },
            { href: "/dashboard/signups", label: "Signups", icon: ClipboardList },
            { href: "/dashboard/club-records", label: "Club Records", icon: Award },
            { href: "/dashboard/coaching", label: "Coaching", icon: Target },
            { href: "/dashboard/scoring", label: "Scoring", icon: BowArrow },
            ...(profile.role === "admin"
                ? [{ href: "/dashboard/admin", label: "Admin", icon: Shield }]
                : []),
            { href: "/profile", label: "Profile", icon: UserCircle2 },
        ];
    }, [profile]);

    /* -----------------------------------------
       LAYOUT CALCULATION
       (avoids overlap with search / right section)
    ------------------------------------------ */
    function updateLayout() {
        if (!navbarRef.current || !measureRef.current || !rightRef.current) return;

        const totalWidth = navbarRef.current.clientWidth;

        // Reserve space for right side + dropdown button + a small safety gap
        const rightWidth = rightRef.current.clientWidth + 36 + 32;
        const available = totalWidth - rightWidth;

        const children = Array.from(measureRef.current.children) as HTMLElement[];

        let used = 0;
        let count = 0;

        for (const el of children) {
            used += el.clientWidth + 12; // nav pill + gap
            if (used <= available) count++;
            else break;
        }

        setVisibleCount(count);
    }

    useEffect(() => {
        const obs = new ResizeObserver(() => {
            updateLayout();
            setLayoutReady(true);
        });

        if (navbarRef.current) obs.observe(navbarRef.current);
        updateLayout();
        setLayoutReady(true);

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
    }, [query, profile?.club_id, supabase]);

    /* -----------------------------------------
       NAV LINK
    ------------------------------------------ */
    function NavLink({ href, label, icon: Icon }: NavItem) {
        const isActive =
            pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

        return (
            <Link
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-full transition
                    ${isActive
                        ? "bg-gradient-to-r from-emerald-500/20 via-sky-500/20 to-emerald-500/20 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
            >
                {Icon && <Icon size={16} className="shrink-0" />}
                <span className="truncate">{label}</span>
            </Link>
        );
    }

    /* -----------------------------------------
       SHARED OVERFLOW DROPDOWN
    ------------------------------------------ */
    const OverflowDropdown = ({ items }: { items: NavItem[] }) => (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    aria-label="More navigation items"
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-border/60 
                               bg-muted/40 hover:bg-muted/70 shadow-sm text-muted-foreground hover:text-foreground"
                >
                    <Menu size={18} />
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content
                className="min-w-[190px] p-2 rounded-2xl border border-border/70 shadow-xl bg-background/95 backdrop-blur-md"
                sideOffset={8}
            >
                {items.map((item) => (
                    <DropdownMenu.Item key={item.href} asChild>
                        <Link
                            href={item.href}
                            className="px-3 py-2 flex items-center gap-2 rounded-lg hover:bg-muted/40 text-sm"
                        >
                            <item.icon size={16} />
                            <span className="truncate">{item.label}</span>
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
                aria-label="Toggle theme"
                className="inline-flex items-center justify-center rounded-xl border border-border/60 
                           bg-muted/40 px-2 py-1.5 hover:bg-muted/70 shadow-sm transition"
            >
                {isDark ? (
                    <Sun size={18} className="text-amber-400" />
                ) : (
                    <Moon size={18} className="text-sky-500" />
                )}
            </button>
        );
    }

    /* -----------------------------------------
       LOGOUT
    ------------------------------------------ */
    async function logout() {
        await supabase.auth.signOut({ scope: "local" });
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch {
            // ignore if not available
        }
        router.push("/");
    }

    /* -----------------------------------------
       MOBILE FULLSCREEN MENU
    ------------------------------------------ */
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

        const containerVariants: Variants = {
            hidden: { opacity: 0 },
            show: {
                opacity: 1,
                transition: {
                    staggerChildren: 0.05,
                    delayChildren: 0.15
                }
            }
        };

        const itemVariants: Variants = {
            hidden: {
                opacity: 0,
                y: 10
            },
            show: {
                opacity: 1,
                y: 0,
                transition: {
                    duration: 0.25,
                    ease: "easeOut"
                }
            }
        };

        return (
            <>
                {/* Trigger */}
                <button
                    onClick={() => setOpen(true)}
                    className="md:hidden flex items-center px-2 py-2 rounded-full border border-border/50 bg-muted/40 hover:bg-muted/70 transition"
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
                                        animate={{ opacity: 0.9 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="
                                        fixed inset-0 z-[998]
                                        bg-gradient-to-br from-[#020617]/90 via-emerald-900/60 to-sky-900/70
                                        backdrop-blur-[6px]
                                    "
                                        onClick={() => setOpen(false)}
                                    />

                                    {/* PARALLAX PARTICLES */}
                                    <motion.div
                                        className="fixed inset-0 z-[999] pointer-events-none overflow-hidden"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 0.4 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        {[...Array(22)].map((_, i) => (
                                            <motion.div
                                                key={i}
                                                className="absolute w-1 h-1 bg-emerald-300 rounded-full"
                                                initial={{
                                                    x: Math.random() * window.innerWidth,
                                                    y: Math.random() * window.innerHeight,
                                                    opacity: 0.3
                                                }}
                                                animate={{
                                                    x: "+=30",
                                                    y: "-=60",
                                                    opacity: [0.2, 0.55, 0.2]
                                                }}
                                                transition={{
                                                    duration: 6 + Math.random() * 4,
                                                    repeat: Infinity,
                                                    ease: "easeInOut"
                                                }}
                                            />
                                        ))}
                                    </motion.div>

                                    {/* FLOATING MENU CONTENT */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.96 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.25 }}
                                        className="
                                        fixed inset-0 z-[1000]
                                        flex flex-col items-center justify-center
                                        text-white gap-8
                                        px-6
                                    "
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* CLOSE BUTTON */}
                                        <button
                                            onClick={() => setOpen(false)}
                                            className="
                                            absolute top-7 right-7 text-white text-3xl 
                                            hover:scale-110 active:scale-90 transition
                                            drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]
                                        "
                                        >
                                            ✕
                                        </button>

                                        {/* ARCUS TITLE WITH FADE ARC */}
                                        <div className="relative mb-4">
                                            <span className="
                                            text-3xl font-semibold 
                                            bg-gradient-to-r from-emerald-400 to-sky-400 
                                            bg-clip-text text-transparent
                                        ">
                                                Arcus
                                            </span>

                                            {/* Glowing arc */}
                                            <motion.div
                                                className="
                                                absolute inset-x-0 -bottom-2 h-[2px]
                                                bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent
                                                blur-[2px]
                                            "
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.3, duration: 1.2 }}
                                            />
                                        </div>

                                        {/* MENU ITEMS */}
                                        <motion.div
                                            variants={containerVariants}
                                            initial="hidden"
                                            animate="show"
                                            className="flex flex-col items-center gap-6"
                                        >
                                            {items.map((item) => (
                                                <motion.div
                                                    key={item.href}
                                                    variants={itemVariants}
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.92 }}
                                                    className="flex items-center gap-3 cursor-pointer"
                                                >
                                                    <Link
                                                        href={item.href}
                                                        onClick={() => setOpen(false)}
                                                        className="
                                                        flex items-center gap-3
                                                        text-white text-xl
                                                        drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]
                                                    "
                                                    >
                                                        <item.icon size={30} />
                                                        {item.label}
                                                    </Link>
                                                </motion.div>
                                            ))}
                                        </motion.div>

                                        {/* LOGOUT */}
                                        <motion.button
                                            variants={itemVariants}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.92 }}
                                            onClick={handleLogout}
                                            className="
                                            flex items-center gap-3 text-xl
                                            text-red-300 mt-6
                                            drop-shadow-[0_0_10px_rgba(248,113,113,0.6)]
                                        "
                                        >
                                            <LogOut size={30} />
                                            Logout
                                        </motion.button>
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
            className="sticky top-0 z-50 mt-2 mb-4 mx-2 sm:mx-4 flex items-center justify-between flex-nowrap 
                       rounded-2xl border border-border/70 bg-background/80 backdrop-blur-lg 
                       shadow-[0_18px_45px_rgba(15,23,42,0.35)] px-3 sm:px-6 py-2.5"
        >
            {/* LEFT */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <Link
                    href="/"
                    className="text-lg sm:text-xl font-semibold tracking-tight bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent hover:opacity-90 transition"
                >
                    Arcus
                </Link>

                {!loading && profile && layoutReady && (
                    <div className="hidden md:flex items-center gap-3 relative min-w-0">
                        {/* Inline nav items */}
                        <div className="flex items-center gap-2 min-w-0">
                            {navItems
                                .slice(0, Math.max(0, visibleCount - 1))
                                .map((item) => (
                                    <NavLink key={item.href} {...item} />
                                ))}

                            {/* Animated "last visible" item */}
                            <AnimatePresence mode="popLayout" initial={false}>
                                {visibleCount > 0 && visibleCount <= navItems.length && (
                                    <motion.div
                                        key={navItems[visibleCount - 1].href}
                                        initial={{ opacity: 0, x: 8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 8 }}
                                        transition={{ duration: 0.18, ease: "easeOut" }}
                                    >
                                        <NavLink {...navItems[visibleCount - 1]} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Always reserve dropdown space */}
                        <div className="w-9 flex justify-center flex-shrink-0">
                            {visibleCount < navItems.length ? (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <OverflowDropdown items={navItems.slice(visibleCount)} />
                                </motion.div>
                            ) : (
                                <div className="w-9 h-9 opacity-0 pointer-events-none" />
                            )}
                        </div>
                    </div>
                )}

                {!loading && profile && <MobileFullScreenMenu items={navItems} />}
            </div>

            {/* MEASUREMENT GHOST (for layout calc) */}
            <div
                ref={measureRef}
                className="absolute opacity-0 pointer-events-none h-0 overflow-hidden"
            >
                {navItems.map((item) => (
                    <div
                        key={item.href}
                        className="flex items-center px-3 py-1.5 text-sm whitespace-nowrap"
                    >
                        {item.label}
                    </div>
                ))}
            </div>

            {/* RIGHT */}
            <div
                ref={rightRef}
                className="flex items-center gap-2 sm:gap-3 min-w-fit shrink-0"
            >
                {/* SEARCH */}
                {!loading && profile && (
                    <div className="relative w-28 xs:w-36 sm:w-44 md:w-56 lg:w-64 max-w-[12rem] min-w-[6rem]">
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={() => results.length && setShowResults(true)}
                            onBlur={() => setTimeout(() => setShowResults(false), 200)}
                            className="w-full rounded-full border border-border/60 bg-muted/40 
                                px-3 py-1.5 text-xs sm:text-sm
                                focus:outline-none focus:ring-[1.5px] focus:ring-emerald-500/80
                                placeholder:text-muted-foreground/70"
                        />

                        {showResults && results.length > 0 && (
                            <div className="absolute mt-2 w-[min(18rem,100%+4rem)] right-0 bg-popover/95 border border-border/70 rounded-2xl shadow-xl p-2 z-50 backdrop-blur-md">
                                {results.map((u) => (
                                    <Link
                                        key={u.id}
                                        href={`/profile/${u.id}`}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition"
                                    >
                                        <Image
                                            src={u.avatar_url ?? "/default-avatar.png"}
                                            alt="Avatar"
                                            width={32}
                                            height={32}
                                            className="rounded-full h-8 w-8 object-cover border border-border/60"
                                        />
                                        <div className="min-w-0">
                                            <span className="text-sm font-medium truncate">
                                                {u.username}
                                            </span>
                                            {u.bow_type && (
                                                <span className="block text-xs text-muted-foreground uppercase truncate">
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
                            <button
                                className="cursor-pointer flex items-center hover:opacity-85 transition"
                                aria-label="Open profile menu"
                            >
                                <Image
                                    src={
                                        profile.avatar_url?.startsWith("http")
                                            ? profile.avatar_url
                                            : "/default-avatar.png"
                                    }
                                    alt="Avatar"
                                    width={34}
                                    height={34}
                                    className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover border border-border/70"
                                />
                            </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Content
                            className="w-44 p-2 rounded-2xl border border-border/70 shadow-xl bg-background/95 backdrop-blur-md"
                            sideOffset={8}
                            align="end"
                        >
                            <DropdownMenu.Label className="px-3 py-2 text-xs text-muted-foreground border-b border-border/60 mb-1">
                                {profile.username}
                            </DropdownMenu.Label>

                            <DropdownMenu.Item asChild>
                                <Link
                                    href="/profile/edit"
                                    className="px-3 py-2 text-sm flex items-center gap-2 rounded-md hover:bg-muted/40"
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