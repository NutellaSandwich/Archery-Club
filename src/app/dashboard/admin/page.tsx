"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
    Shield,
    Users,
    Trophy,
    ClipboardList,
    FileText,
    Target,
    Activity,
    Award,
    UserCog,
    BarChart3,
    ArrowLeft,
} from "lucide-react";

import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";

import { motion } from "framer-motion";

type AdminStats = {
    totalMembers: number;
    newThisMonth: number;
    totalScores: number;
    formalScores: number;
    competitions: number;
};

type WeeklyScorePoint = { week: string; scores: number };
type MemberGrowthPoint = { label: string; total: number };
type SimpleKV = { name: string; value: number };
type RoundAveragePoint = { roundName: string; avgScore: number; avgGolds: number };
type ActiveMemberPoint = { name: string; value: number };
type DayActivityPoint = { day: string; value: number };

type AnalyticsTab = "members" | "scores" | "engagement";

export default function AdminDashboardPage() {
    const router = useRouter();
    const supabase = useMemo(() => supabaseBrowser(), []);

    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const [stats, setStats] = useState<AdminStats>({
        totalMembers: 0,
        newThisMonth: 0,
        totalScores: 0,
        formalScores: 0,
        competitions: 0,
    });

    // Analytics state
    const [weeklyScores, setWeeklyScores] = useState<WeeklyScorePoint[]>([]);
    const [memberGrowth, setMemberGrowth] = useState<MemberGrowthPoint[]>([]);
    const [bowstyleDist, setBowstyleDist] = useState<SimpleKV[]>([]);
    const [experienceDist, setExperienceDist] = useState<SimpleKV[]>([]);
    const [scoreTypeDist, setScoreTypeDist] = useState<SimpleKV[]>([]);
    const [roundAverages, setRoundAverages] = useState<RoundAveragePoint[]>([]);
    const [topMembers, setTopMembers] = useState<ActiveMemberPoint[]>([]);
    const [dayActivity, setDayActivity] = useState<DayActivityPoint[]>([]);

    const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("members");

    /* ----------------------------------------------
        LOAD ADMIN + STATS + ANALYTICS
    ----------------------------------------------- */
    useEffect(() => {
        async function init() {
            setLoading(true);

            const {
                data: { session },
            } = await supabase.auth.getSession();

            const user = session?.user;
            if (!user) {
                router.push("/login");
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("role, club_id")
                .eq("id", user.id)
                .single();

            if (!profile || profile.role !== "admin") {
                router.push("/dashboard");
                return;
            }

            setIsAdmin(true);
            const club_id = profile.club_id ?? "";

            // Load members + scores
            const [membersRes, scoresRes, competitionsRes] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("id, created_at, username, bow_type, experience", {
                        count: "exact",
                        head: false,
                    })
                    .eq("club_id", club_id),
                supabase
                    .from("club_posts")
                    .select("created_at, score_type, score, golds, round_name, user_id", {
                        count: "exact",
                        head: false,
                    })
                    .eq("club_id", club_id),
                supabase
                    .from("club_posts")
                    .select("id", { count: "exact", head: false })
                    .eq("club_id", club_id)
                    .eq("score_type", "Competition"),
            ]);

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const totalMembers = membersRes.count ?? membersRes.data?.length ?? 0;
            const newThisMonth =
                membersRes.data?.filter((m: any) => {
                    if (!m.created_at) return false;
                    return new Date(m.created_at) >= startOfMonth;
                }).length ?? 0;

            const totalScores = scoresRes.count ?? scoresRes.data?.length ?? 0;
            const formalScores =
                scoresRes.data?.filter(
                    (s: any) => s.score_type === "Formal Practice"
                ).length ?? 0;

            const competitions = competitionsRes.count ?? competitionsRes.data?.length ?? 0;

            setStats({
                totalMembers,
                newThisMonth,
                totalScores,
                formalScores,
                competitions,
            });

            const scoreRows = scoresRes.data ?? [];
            const memberRows = membersRes.data ?? [];

            /* ----------------------------------------------
                1. WEEKLY SCORE TREND (last 8 weeks)
            ----------------------------------------------- */
            const weeklyCounts: Record<string, number> = {};
            const eightWeeksAgo = new Date();
            eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

            scoreRows
                .filter((row: any) => new Date(row.created_at) >= eightWeeksAgo)
                .forEach((score: any) => {
                    const d = new Date(score.created_at);
                    // Monday-based week
                    const weekStart = new Date(
                        d.getFullYear(),
                        d.getMonth(),
                        d.getDate() - ((d.getDay() + 6) % 7)
                    );
                    const label = weekStart.toISOString().split("T")[0];
                    weeklyCounts[label] = (weeklyCounts[label] ?? 0) + 1;
                });

            const weeklyFormatted: WeeklyScorePoint[] = Object.entries(weeklyCounts)
                .sort(([a], [b]) => (a < b ? -1 : 1))
                .map(([week, count]) => ({
                    week,
                    scores: count,
                }));

            setWeeklyScores(weeklyFormatted);

            /* ----------------------------------------------
                2. MEMBER GROWTH (last 6 months)
            ----------------------------------------------- */
            const growthBuckets: Record<string, number> = {};
            const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

            memberRows
                .filter((m: any) => m.created_at && new Date(m.created_at) >= sixMonthsAgo)
                .forEach((m: any) => {
                    const d = new Date(m.created_at);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
                        2,
                        "0"
                    )}`;
                    growthBuckets[key] = (growthBuckets[key] ?? 0) + 1;
                });

            // Month labels oldest → newest
            const monthLabels: string[] = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                monthLabels.push(
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
                );
            }

            let cumulative = 0;
            const growthData: MemberGrowthPoint[] = [];
            monthLabels.forEach((monthKey) => {
                const added = growthBuckets[monthKey] ?? 0;
                cumulative += added;
                growthData.push({
                    label: monthKey.slice(5),
                    total: cumulative,
                });
            });

            setMemberGrowth(growthData);

            /* ----------------------------------------------
                3. BOWSTYLE DISTRIBUTION
            ----------------------------------------------- */
            const bowCounts: Record<string, number> = {};
            memberRows.forEach((m: any) => {
                const raw = (m.bow_type ?? "Unspecified") as string;
                const key = raw.trim() || "Unspecified";
                bowCounts[key] = (bowCounts[key] ?? 0) + 1;
            });

            const bowData: SimpleKV[] = Object.entries(bowCounts).map(
                ([name, value]) => ({ name, value })
            );
            setBowstyleDist(bowData);

            /* ----------------------------------------------
                4. EXPERIENCE DISTRIBUTION
            ----------------------------------------------- */
            const expCounts: Record<string, number> = {};
            memberRows.forEach((m: any) => {
                const raw = (m.experience ?? "Unknown") as string;
                const norm = raw.trim().toLowerCase();
                const key =
                    norm === "novice" || norm === "beginner"
                        ? "Novice"
                        : norm
                            ? "Experienced"
                            : "Unknown";
                expCounts[key] = (expCounts[key] ?? 0) + 1;
            });

            const expData: SimpleKV[] = Object.entries(expCounts).map(
                ([name, value]) => ({ name, value })
            );
            setExperienceDist(expData);

            /* ----------------------------------------------
                5. SCORE TYPE DISTRIBUTION
            ----------------------------------------------- */
            const scoreTypeCounts: Record<string, number> = {};
            scoreRows.forEach((s: any) => {
                const key = (s.score_type ?? "Unknown") as string;
                scoreTypeCounts[key] = (scoreTypeCounts[key] ?? 0) + 1;
            });

            const scoreTypeData: SimpleKV[] = Object.entries(scoreTypeCounts).map(
                ([name, value]) => ({ name, value })
            );
            setScoreTypeDist(scoreTypeData);

            /* ----------------------------------------------
                6. ROUND AVERAGES (top 6 rounds)
            ----------------------------------------------- */
            const roundAgg: Record<
                string,
                { totalScore: number; totalGolds: number; count: number }
            > = {};

            scoreRows.forEach((s: any) => {
                const roundName = s.round_name ?? "Unknown";
                if (!roundAgg[roundName]) {
                    roundAgg[roundName] = {
                        totalScore: 0,
                        totalGolds: 0,
                        count: 0,
                    };
                }
                roundAgg[roundName].totalScore += s.score ?? 0;
                roundAgg[roundName].totalGolds += s.golds ?? 0;
                roundAgg[roundName].count += 1;
            });

            const roundData: RoundAveragePoint[] = Object.entries(roundAgg)
                .sort(([, a], [, b]) => b.count - a.count)
                .slice(0, 6)
                .map(([roundName, agg]) => ({
                    roundName,
                    avgScore: agg.count ? agg.totalScore / agg.count : 0,
                    avgGolds: agg.count ? agg.totalGolds / agg.count : 0,
                }));

            setRoundAverages(roundData);

            /* ----------------------------------------------
                7. MOST ACTIVE MEMBERS (by scores submitted)
            ----------------------------------------------- */
            const memberScoreCounts: Record<string, number> = {};
            scoreRows.forEach((s: any) => {
                if (!s.user_id) return;
                memberScoreCounts[s.user_id] =
                    (memberScoreCounts[s.user_id] ?? 0) + 1;
            });

            const idToName: Record<string, string> = {};
            memberRows.forEach((m: any) => {
                idToName[m.id] =
                    m.username ??
                    (typeof m.id === "string"
                        ? `Member ${m.id.slice(0, 6)}`
                        : "Member");
            });

            const topMemberData: ActiveMemberPoint[] = Object.entries(
                memberScoreCounts
            )
                .sort(([, a], [, b]) => b - a)
                .slice(0, 7)
                .map(([id, value]) => ({
                    name: idToName[id] ?? "Member",
                    value,
                }));

            setTopMembers(topMemberData);

            /* ----------------------------------------------
                8. ACTIVITY BY DAY OF WEEK
            ----------------------------------------------- */
            const dayCounts: number[] = Array(7).fill(0); // 0 = Sunday
            scoreRows.forEach((s: any) => {
                const d = new Date(s.created_at);
                const idx = d.getDay();
                dayCounts[idx] += 1;
            });

            const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const dayData: DayActivityPoint[] = dayLabels.map((day, i) => ({
                day,
                value: dayCounts[i],
            }));
            setDayActivity(dayData);

            setLoading(false);
        }

        init();
    }, [supabase, router]);

    if (!isAdmin && !loading) {
        return (
            <main className="max-w-4xl mx-auto px-4 py-16 text-center">
                <p className="text-muted-foreground">
                    You do not have permission to view this page.
                </p>
            </main>
        );
    }

    /* ----------------------------------------------
        PAGE
    ----------------------------------------------- */
    return (
        <main className="max-w-[90rem] mx-auto p-6 space-y-8">
            {/* PAGE TITLE – styled like Coaching / Club Records */}
            <div className="text-center space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-r from-emerald-600 to-sky-500 bg-clip-text text-transparent flex items-center justify-center gap-2">
                    <Shield className="text-primary" />
                    Admin Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                    Manage members, scores, trophies and analytics for your club.
                </p>
                <div className="w-40 h-1 mx-auto mt-2 rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-emerald-500 opacity-40"></div>

                <div className="mt-3 flex items-center justify-center">
                    <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl flex items-center gap-1"
                        onClick={() => router.push("/dashboard")}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Feed
                    </Button>
                </div>
            </div>

            {/* TOP STATS – compact, Coaching-style grid */}
            <section className="max-w-4xl mx-auto">
                <Card className="border border-border/60 bg-muted/30 shadow-sm rounded-2xl">
                    <CardHeader className="relative pb-3">
                        <div className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-gradient-to-r from-emerald-500/40 via-sky-500/40 to-emerald-500/40 rounded-full"></div>
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Activity className="w-5 h-5 text-emerald-600" />
                            Club Overview
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            A quick snapshot of your club’s activity.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                Members
                            </p>
                            <p className="text-xl font-semibold">{stats.totalMembers}</p>
                            <p className="text-[11px] text-emerald-600">
                                +{stats.newThisMonth} this month
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Target className="w-3 h-3" />
                                Scores
                            </p>
                            <p className="text-xl font-semibold">{stats.totalScores}</p>
                            <p className="text-[11px] text-muted-foreground">
                                {stats.formalScores} formal
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Trophy className="w-3 h-3" />
                                Competitions
                            </p>
                            <p className="text-xl font-semibold">{stats.competitions}</p>
                            <p className="text-[11px] text-muted-foreground">
                                Logged competition scores
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <BarChart3 className="w-3 h-3" />
                                Formal %
                            </p>
                            <p className="text-xl font-semibold">
                                {stats.totalScores > 0
                                    ? Math.round(
                                        (stats.formalScores / stats.totalScores) * 100
                                    )
                                    : 0}
                                %
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                                Of all scores
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* MAIN STACKED CONTENT */}
            <section className="space-y-6">
                {/* ADMIN TOOLS */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                >
                    <Card className="border border-border/60 bg-muted/30 shadow-sm rounded-2xl">
                        <CardHeader className="relative pb-3">
                            <div className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-gradient-to-r from-emerald-500/40 via-sky-500/40 to-emerald-500/40 rounded-full"></div>
                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                <UserCog className="w-5 h-5 text-emerald-600" />
                                Admin Tools
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                Core management areas for your club.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="grid sm:grid-cols-2 gap-3">
                            <AdminButton
                                icon={Users}
                                title="Join Requests"
                                desc="Approve or deny new member requests."
                                onClick={() => router.push("/dashboard/join-requests")}
                            />

                            <AdminButton
                                icon={FileText}
                                title="Scoresheets"
                                desc="Generate printable A4 scoresheets."
                                onClick={() => router.push("/dashboard/scoresheets")}
                            />

                            <AdminButton
                                icon={Trophy}
                                title="Trophies & Awards"
                                desc="Assign trophies and track winners."
                                onClick={() => router.push("/dashboard/trophies")}
                            />

                            <AdminButton
                                icon={Award}
                                title="Club Records"
                                desc="Manage and update club performance records."
                                onClick={() => router.push("/dashboard/club-records")}
                            />
                        </CardContent>
                    </Card>
                </motion.div>

                {/* SECTION DIVIDER */}
                <div className="h-px bg-border/60" />

                {/* QUICK ACTIONS */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                >
                    <Card className="border border-border/60 bg-muted/30 shadow-sm rounded-2xl">
                        <CardHeader className="relative pb-3">
                            <div className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-gradient-to-r from-emerald-500/40 via-sky-500/40 to-emerald-500/40 rounded-full"></div>
                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                <Activity className="w-5 h-5 text-emerald-600" />
                                Quick Actions
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                Fast access to frequently used workflows.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid sm:grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className="justify-start gap-2 rounded-xl"
                                onClick={() => router.push("/dashboard/signups")}
                            >
                                <ClipboardList className="w-4 h-4" />
                                Manage signups
                            </Button>

                            <Button
                                variant="outline"
                                className="justify-start gap-2 rounded-xl"
                                onClick={() => router.push("/dashboard/coaching")}
                            >
                                <Target className="w-4 h-4" />
                                Coaching tools
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* SECTION DIVIDER */}
                <div className="h-px bg-border/60" />

                {/* ANALYTICS – styled closer to Coaching graphs */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.15 }}
                >
                    <Card className="border border-border/60 bg-muted/30 shadow-sm rounded-2xl">
                        <CardHeader className="relative pb-3">
                            <div className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-gradient-to-r from-emerald-500/40 via-sky-500/40 to-emerald-500/40 rounded-full"></div>
                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                <BarChart3 className="w-5 h-5 text-emerald-600" />
                                Analytics
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                Explore club trends by members, scores, and engagement.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {/* Analytics Tabs */}
                            <div className="sticky top-[60px] z-20">
                                <div className="inline-flex items-center rounded-full bg-muted/70 p-1 border border-border/60 text-xs sm:text-sm shadow-sm">
                                    <AnalyticsTabButton
                                        active={analyticsTab === "members"}
                                        onClick={() => setAnalyticsTab("members")}
                                    >
                                        Members
                                    </AnalyticsTabButton>
                                    <AnalyticsTabButton
                                        active={analyticsTab === "scores"}
                                        onClick={() => setAnalyticsTab("scores")}
                                    >
                                        Scores
                                    </AnalyticsTabButton>
                                    <AnalyticsTabButton
                                        active={analyticsTab === "engagement"}
                                        onClick={() => setAnalyticsTab("engagement")}
                                    >
                                        Engagement
                                    </AnalyticsTabButton>
                                </div>
                            </div>

                            {/* -------------------------
                                MEMBERS TAB
                            ------------------------- */}
                            {analyticsTab === "members" && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4"
                                >
                                    {/* MEMBER GROWTH */}
                                    <div className="group relative rounded-xl border border-border/60 bg-background/60 p-3 overflow-hidden">
                                        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-40 bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-emerald-500/10 blur-xl transition-opacity duration-300 pointer-events-none" />
                                        <p className="text-xs font-medium mb-1">
                                            Member growth (last 6 months)
                                        </p>

                                        <div className="h-52">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={memberGrowth}>
                                                    <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                                                    <XAxis dataKey="label" />
                                                    <YAxis allowDecimals={false} />

                                                    <Tooltip
                                                        contentStyle={{
                                                            background: "rgba(0,0,0,0.7)",
                                                            border: "none",
                                                            borderRadius: "6px",
                                                            color: "white",
                                                        }}
                                                        wrapperStyle={{
                                                            background: "transparent",
                                                            boxShadow: "none",
                                                        }}
                                                    />

                                                    <Line
                                                        dataKey="total"
                                                        stroke="#10b981"
                                                        strokeWidth={2}
                                                        dot={{ r: 3 }}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* PIE CHARTS */}
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <SmallPieCard title="Bowstyle distribution" data={bowstyleDist} />
                                        <SmallPieCard title="Experience levels" data={experienceDist} />
                                    </div>
                                </motion.div>
                            )}

                            {/* -------------------------
                                SCORES TAB
                            ------------------------- */}
                            {analyticsTab === "scores" && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4"
                                >
                                    {/* WEEKLY SCORES */}
                                    <div className="group relative rounded-xl border border-border/60 bg-background/60 p-3 overflow-hidden">
                                        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-40 bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-emerald-500/10 blur-xl transition-opacity duration-300 pointer-events-none" />
                                        <p className="text-xs font-medium mb-1">
                                            Scores logged (last 8 weeks)
                                        </p>

                                        <div className="h-52">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={weeklyScores}>
                                                    <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                                                    <XAxis dataKey="week" />
                                                    <YAxis allowDecimals={false} />

                                                    <Tooltip
                                                        contentStyle={{
                                                            background: "rgba(0,0,0,0.7)",
                                                            border: "none",
                                                            borderRadius: "6px",
                                                            color: "white",
                                                        }}
                                                        wrapperStyle={{
                                                            background: "transparent",
                                                            boxShadow: "none",
                                                        }}
                                                    />

                                                    <Line
                                                        dataKey="scores"
                                                        stroke="#10b981"
                                                        strokeWidth={2}
                                                        dot={false}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* SCORE TYPE + ROUND AVERAGES */}
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <SmallPieCard title="Score type mix" data={scoreTypeDist} />

                                        {/* ROUND AVERAGES */}
                                        <div className="group relative rounded-xl border border-border/60 bg-background/60 p-3 overflow-hidden">
                                            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-40 bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-emerald-500/10 blur-xl transition-opacity duration-300 pointer-events-none" />
                                            <p className="text-xs font-medium mb-2">
                                                Top rounds (average score)
                                            </p>

                                            <div className="h-52">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={roundAverages}>
                                                        <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                                                        <XAxis dataKey="roundName" tick={{ fontSize: 10 }} />
                                                        <YAxis />

                                                        <Tooltip
                                                            contentStyle={{
                                                                background: "rgba(0,0,0,0.7)",
                                                                border: "none",
                                                                borderRadius: "6px",
                                                                color: "white",
                                                            }}
                                                            wrapperStyle={{
                                                                background: "transparent",
                                                                boxShadow: "none",
                                                            }}
                                                        />

                                                        <Legend />

                                                        <Bar
                                                            dataKey="avgScore"
                                                            fill="#10b981"
                                                            radius={[4, 4, 0, 0]}
                                                            activeBar={{ fill: "#10b981" }}
                                                        />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* -------------------------
                                ENGAGEMENT TAB
                            ------------------------- */}
                            {analyticsTab === "engagement" && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4"
                                >
                                    {/* ACTIVE MEMBERS */}
                                    <div className="group relative rounded-xl border border-border/60 bg-background/60 p-3 overflow-hidden">
                                        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-40 bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-emerald-500/10 blur-xl transition-opacity duration-300 pointer-events-none" />
                                        <p className="text-xs font-medium mb-2">
                                            Most active members (by scores logged)
                                        </p>

                                        <div className="h-52">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={topMembers}>
                                                    <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                                    <YAxis allowDecimals={false} />

                                                    <Tooltip
                                                        contentStyle={{
                                                            background: "rgba(0,0,0,0.7)",
                                                            border: "none",
                                                            borderRadius: "6px",
                                                            color: "white",
                                                        }}
                                                        wrapperStyle={{
                                                            background: "transparent",
                                                            boxShadow: "none",
                                                        }}
                                                    />

                                                    <Bar
                                                        dataKey="value"
                                                        fill="#10b981"
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* ACTIVITY BY DAY */}
                                    <div className="group relative rounded-xl border border-border/60 bg-background/60 p-3 overflow-hidden">
                                        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-40 bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-emerald-500/10 blur-xl transition-opacity duration-300 pointer-events-none" />
                                        <p className="text-xs font-medium mb-2">
                                            Activity by day of week
                                        </p>

                                        <div className="h-40">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={dayActivity}>
                                                    <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                                                    <XAxis dataKey="day" />
                                                    <YAxis allowDecimals={false} />

                                                    <Tooltip
                                                        contentStyle={{
                                                            background: "rgba(0,0,0,0.7)",
                                                            border: "none",
                                                            borderRadius: "6px",
                                                            color: "white",
                                                        }}
                                                        wrapperStyle={{
                                                            background: "transparent",
                                                            boxShadow: "none",
                                                        }}
                                                    />

                                                    <Bar
                                                        dataKey="value"
                                                        fill="#0ea5e9"
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </section>
        </main>
    );
}

/* ----------------------------------------------
    REUSABLE ADMIN BUTTON
----------------------------------------------- */
function AdminButton({
    icon: Icon,
    title,
    desc,
    onClick,
}: {
    icon: any;
    title: string;
    desc: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="
                group relative w-full rounded-xl border border-border/60 bg-muted/30 
                hover:bg-muted/50 px-3 py-3 flex items-start gap-3 text-left transition 
                shadow-sm hover:shadow-md overflow-hidden
            "
        >
            {/* Glow overlay like Coaching cards */}
            <div
                className="
                    absolute inset-0 rounded-xl opacity-0 group-hover:opacity-40
                    bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-emerald-500/10
                    blur-xl transition-opacity duration-300 pointer-events-none
                "
            ></div>

            <div className="relative mt-0.5 rounded-full bg-emerald-500/10 p-1.5">
                <Icon className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="relative space-y-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
        </button>
    );
}

/* ----------------------------------------------
    TABS BUTTON COMPONENT
----------------------------------------------- */
function AnalyticsTabButton({
    children,
    active,
    onClick,
}: {
    children: React.ReactNode;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition ${active
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
        >
            {children}
        </button>
    );
}

/* ----------------------------------------------
    SMALL PIE CARD
----------------------------------------------- */
const PIE_COLORS = ["#10b981", "#0ea5e9", "#f97316", "#a855f7", "#e11d48"];

function SmallPieCard({ title, data }: { title: string; data: SimpleKV[] }) {
    return (
        <div className="group relative rounded-xl border border-border/60 bg-background/60 p-3 overflow-hidden">
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-40 bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-emerald-500/10 blur-xl transition-opacity duration-300 pointer-events-none" />
            <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
            {data.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-6">
                    No data yet.
                </p>
            ) : (
                <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                outerRadius={60}
                                paddingAngle={2}
                            >
                                {data.map((_, idx) => (
                                    <Cell
                                        key={idx}
                                        fill={PIE_COLORS[idx % PIE_COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend
                                verticalAlign="bottom"
                                height={24}
                                wrapperStyle={{ fontSize: 10 }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}