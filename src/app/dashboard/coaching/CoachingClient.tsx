"use client";

import { useEffect, useState, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BowArrow } from "lucide-react";
import {
    Target,
    MessageSquare,
    Edit,
    Trash2,
    ArrowUp,
    ArrowDown,
    ChevronDown,
    ChevronUp,   // 👈 add these icons for expand/collapse
} from "lucide-react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
} from "recharts";

type Goal = {
    id: string;
    user_id: string;           // 👈 Add this if missing too
    coach_id?: string | null;  // 👈 Add this line
    title: string;
    target_date?: string | null;
    achieved?: boolean;
    created_at?: string;
};

type CoachingLog = {
    id: string;
    user_id: string;
    coach_id?: string | null;
    arrows_shot: number;
    session_rating?: number | null;
    notes?: string | null;
    date: string;
};

export default function CoachingClient() {
    const [supabase, setSupabase] = useState<any>(null);
    const [isReady, setIsReady] = useState(false);

    
    const [profile, setProfile] = useState<any>(null);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [userQuery, setUserQuery] = useState("");
    const [userResults, setUserResults] = useState<any[]>([]);

    const [myGoals, setMyGoals] = useState<Goal[]>([]);
    const [myLogs, setMyLogs] = useState<CoachingLog[]>([]);
    const [athleteGoals, setAthleteGoals] = useState<Goal[]>([]);
    const [athleteLogs, setAthleteLogs] = useState<CoachingLog[]>([]);

    const [newGoal, setNewGoal] = useState("");
    const [targetDate, setTargetDate] = useState("");
    const [newLog, setNewLog] = useState({
        arrows_shot: "",
        notes: "",
        session_rating: "",
        date: "",
    });

    const [editGoal, setEditGoal] = useState<Goal | null>(null);
    const [editLog, setEditLog] = useState<CoachingLog | null>(null);

    const [isLoadingUser, setIsLoadingUser] = useState(false);
    const [viewedAthlete, setViewedAthlete] = useState<any>(null);
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

    const isCoach = ["coach", "admin"].includes(profile?.role || "");
    const [goalComments, setGoalComments] = useState<Record<string, any[]>>({});
    const [logComments, setLogComments] = useState<Record<string, any[]>>({});
    const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
    const [loadingThreads, setLoadingThreads] = useState<Record<string, boolean>>({});
    const [hasClub, setHasClub] = useState(true);

    const toggleThread = async (id: string, type?: "goal" | "log") => {
        const isCurrentlyExpanded = expandedThreads[id];

        if (!isCurrentlyExpanded) {
            setLoadingThreads((prev) => ({ ...prev, [id]: true }));

            if (type === "goal") await fetchGoalComments(id);
            if (type === "log") await fetchLogComments(id);

            setLoadingThreads((prev) => ({ ...prev, [id]: false }));
        }

        setExpandedThreads((prev) => ({ ...prev, [id]: !isCurrentlyExpanded }));
    };

    useEffect(() => {
        // ✅ This only runs in the browser
        const client = supabaseBrowser();
        setSupabase(client);
        setIsReady(true);
    }, []);
    

    // Load logged-in user profile
    useEffect(() => {
        if (!supabase) return;
        async function loadProfile() {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;
            const { data } = await supabase
                .from("profiles")
                .select("*, club_id")
                .eq("id", user.id)
                .single();
            setProfile(data);
            setSelectedUser(data);
            setHasClub(!!data?.club_id);
        }
        loadProfile();
    }, [supabase]);

    // Load my own data
    useEffect(() => {
        if (!selectedUser) return;
        async function loadMyData() {
            const { data: goalData } = await supabase
                .from("goals")
                .select("*")
                .eq("user_id", selectedUser.id)
                .order("created_at", { ascending: false });
            const { data: logData } = await supabase
                .from("coaching_logs")
                .select("*")
                .eq("user_id", selectedUser.id)
                .order("date", { ascending: true });
            setMyGoals(goalData || []);
            setMyLogs(logData || []);
            
        }
        
        loadMyData();
    }, [selectedUser, supabase]);

    // Load viewed athlete data
    useEffect(() => {
        if (!viewedAthlete) return;
        async function loadViewedAthleteData() {
            const { data: goalData } = await supabase
                .from("goals")
                .select("*")
                .eq("user_id", viewedAthlete.id)
                .order("created_at", { ascending: false });
            const { data: logData } = await supabase
                .from("coaching_logs")
                .select("*")
                .eq("user_id", viewedAthlete.id)
                .order("date", { ascending: true });
            setAthleteGoals(goalData || []);
            setAthleteLogs(logData || []);
        }
        loadViewedAthleteData();
    }, [viewedAthlete, supabase]);

    // Search users (for coach view)
    useEffect(() => {
        if (!userQuery.trim() || !isCoach) {
            setUserResults([]);
            return;
        }
        const fetchUsers = async () => {
            if (!profile?.club_id) return;
            const { data } = await supabase
                .from("profiles")
                .select("id, username, club_id")
                .eq("club_id", profile.club_id) // 👈 Restrict to same club
                .ilike("username", `%${userQuery}%`)
                .limit(8);
            setUserResults(data || []);
        };
        const timeout = setTimeout(fetchUsers, 250);
        return () => clearTimeout(timeout);
    }, [userQuery, isCoach, supabase]);

    // ---- GOALS ----
    async function addGoal() {
        if (!newGoal.trim()) return toast.error("Enter a goal title");
        const { data, error } = await supabase
            .from("goals")
            .insert({
                user_id: selectedUser.id,
                title: newGoal,
                target_date: targetDate || null,
            })
            .select()
            .single();
        if (error) return toast.error("Error adding goal");
        setMyGoals((prev) => [data, ...prev]);
        setNewGoal("");
        setTargetDate("");
        toast.success("Goal added");
    }

    async function toggleAchieved(goal: Goal) {
        const newVal = !goal.achieved;
        const { error } = await supabase
            .from("goals")
            .update({ achieved: newVal })
            .eq("id", goal.id);
        if (error) return toast.error("Error updating goal");
        setMyGoals((prev) =>
            prev.map((g) => (g.id === goal.id ? { ...g, achieved: newVal } : g))
        );
    }

    async function deleteGoal(id: string) {
        const { error } = await supabase.from("goals").delete().eq("id", id);
        if (error) return toast.error("Error deleting goal");
        setMyGoals((prev) => prev.filter((g) => g.id !== id));
        toast.success("Goal deleted");
    }

    async function saveGoalEdit() {
        if (!editGoal?.title) return toast.error("Title required");
        const { error } = await supabase
            .from("goals")
            .update({ title: editGoal.title, target_date: editGoal.target_date })
            .eq("id", editGoal.id);
        if (error) return toast.error("Error saving goal");
        setMyGoals((prev) =>
            prev.map((g) => (g.id === editGoal.id ? editGoal : g))
        );
        setEditGoal(null);
        toast.success("Goal updated");
    }

    // ---- LOGS ----
    async function addLog() {
        const arrows = parseInt(newLog.arrows_shot || "0", 10);
        const rating = parseInt(newLog.session_rating || "0", 10) || null;
        if (!newLog.date) return toast.error("Please select a session date");

        const payload = {
            user_id: selectedUser.id,
            coach_id: isCoach && selectedUser.id !== profile.id ? profile.id : null,
            arrows_shot: isNaN(arrows) ? 0 : arrows,
            session_rating: rating,
            notes: newLog.notes?.trim() || null,
            date: newLog.date,
        };

        const { data, error } = await supabase
            .from("coaching_logs")
            .insert(payload)
            .select()
            .single();
        if (error) return toast.error("Error adding log");
        setMyLogs((prev) => [...prev, data]);
        setNewLog({ arrows_shot: "", notes: "", session_rating: "", date: "" });
        toast.success("Log added");
    }

    async function deleteLog(id: string) {
        const { error } = await supabase.from("coaching_logs").delete().eq("id", id);
        if (error) return toast.error("Error deleting log");
        setMyLogs((prev) => prev.filter((l) => l.id !== id));
        toast.success("Log deleted");
    }

    async function saveLogEdit() {
        if (!editLog) return;
        const { error } = await supabase
            .from("coaching_logs")
            .update({
                arrows_shot: editLog.arrows_shot,
                session_rating: editLog.session_rating,
                notes: editLog.notes,
                date: editLog.date,
            })
            .eq("id", editLog.id);
        if (error) return toast.error("Error updating log");
        setMyLogs((prev) =>
            prev.map((l) => (l.id === editLog.id ? editLog : l))
        );
        setEditLog(null);
        toast.success("Log updated");
    }

    async function fetchGoalComments(goalId: string) {
        const { data, error } = await supabase
            .from("goal_comments")
            .select("*, author:profiles(username)")
            .eq("goal_id", goalId)
            .order("created_at", { ascending: true });
        if (!error) setGoalComments((prev) => ({ ...prev, [goalId]: data || [] }));
    }

    async function fetchLogComments(logId: string) {
        const { data, error } = await supabase
            .from("log_comments")
            .select("*, author:profiles(username)")
            .eq("log_id", logId)
            .order("created_at", { ascending: true });
        if (!error) setLogComments((prev) => ({ ...prev, [logId]: data || [] }));
    }

    // ---- NOTIFICATIONS ----
    async function createNotification(targetUserId: string, message: string) {
        await supabase.from("notifications").insert({
            user_id: targetUserId,
            message,
            read: false,
        });
    }

    // ---- COMMENT POST ----
    async function addComment(goalId: string, content: string, targetUserId?: string) {
        if (!content.trim()) return toast.error("Enter a comment");
        const { error } = await supabase.from("goal_comments").insert({
            goal_id: goalId,
            coach_id: profile.id,
            content,
        });
        if (error) return toast.error("Error adding comment");
        await fetchGoalComments(goalId);
        if (targetUserId && targetUserId !== profile.id)
            await createNotification(targetUserId, "You have a new comment on your goal.");
        toast.success("Comment added");
    }

    async function addLogReply(logId: string, content: string, targetUserId?: string) {
        if (!content.trim()) return toast.error("Enter a reply");
        const { error } = await supabase.from("log_comments").insert({
            log_id: logId,
            coach_id: profile.id,
            content,
        });
        if (error) return toast.error("Error adding reply");
        await fetchLogComments(logId);
        if (targetUserId && targetUserId !== profile.id)
            await createNotification(targetUserId, "You have a new reply on your coaching log.");
        toast.success("Reply added");
    }

    // ---- CALCULATIONS ----
    const calculateStats = (logs: CoachingLog[]) => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);

        const arrowsThisWeek = logs
            .filter((l) => new Date(l.date) >= weekAgo)
            .reduce((acc, l) => acc + (l.arrows_shot || 0), 0);
        const arrowsLastWeek = logs
            .filter((l) => new Date(l.date) < weekAgo && new Date(l.date) >= monthAgo)
            .reduce((acc, l) => acc + (l.arrows_shot || 0), 0);
        const arrowsThisMonth = logs
            .filter((l) => new Date(l.date) >= monthAgo)
            .reduce((acc, l) => acc + (l.arrows_shot || 0), 0);

        return {
            arrowsThisWeek,
            arrowsLastWeek,
            arrowsThisMonth,
            moreThisWeek: arrowsThisWeek >= arrowsLastWeek,
        };
    };

    const myStats = calculateStats(myLogs);
    const athleteStats = calculateStats(athleteLogs);

    const myDataForChart = myLogs.map((l) => ({
        date: new Date(l.date).toLocaleDateString(),
        arrows: l.arrows_shot,
    }));
    const athleteDataForChart = athleteLogs.map((l) => ({
        date: new Date(l.date).toLocaleDateString(),
        arrows: l.arrows_shot,
    }));

    if (!isReady) {
        return <p className="text-sm text-muted-foreground">Loading coaching tools...</p>;
    }

    if (!hasClub) {
        return (
            <main className="flex flex-col items-center justify-center h-[70vh] text-center space-y-4">
                <div className="flex items-center gap-2 text-red-600">
                    <BowArrow className="w-8 h-8" />
                    <h1 className="text-2xl font-semibold">Club Membership Required</h1>
                </div>
                <p className="max-w-md text-muted-foreground">
                    You need to be part of a club to access coaching tools. Please join or request to join a
                    club first from the main page.
                </p>
                <Button onClick={() => (window.location.href = "/")}>Join a club</Button>
            </main>
        );
    }
    return (
        <main className="max-w-5xl mx-auto p-6 space-y-8">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <Target className="text-primary" /> Coaching
            </h1>

            <Tabs defaultValue="my-logs">
                <TabsList className="flex justify-center mb-4">
                    <TabsTrigger value="my-logs">My Coaching Logs</TabsTrigger>
                    {isCoach && <TabsTrigger value="coach-view">Coach View</TabsTrigger>}
                </TabsList>

                {/* 🏹 My Logs */}
                <TabsContent value="my-logs" className="space-y-6">
                    {/* GOALS */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Goals</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex flex-col md:flex-row gap-2">
                                <Input
                                    placeholder="New goal title..."
                                    value={newGoal}
                                    onChange={(e) => setNewGoal(e.target.value)}
                                />
                                <Input
                                    type="date"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                />
                                <Button onClick={addGoal}>Add</Button>
                            </div>

                            {myGoals.length === 0 && (
                                <p className="text-sm text-muted-foreground">No goals yet.</p>
                            )}

                            {myGoals.map((g) => (
                                <div key={g.id} className="border rounded-md p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-medium">{g.title}</p>
                                            {g.target_date && (
                                                <p className="text-xs text-muted-foreground">
                                                    Target: {new Date(g.target_date).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <Button variant="ghost" size="sm" onClick={() => toggleThread(g.id, "goal")}>
                                                {expandedThreads[g.id] ? (
                                                    <>
                                                        <ChevronUp size={14} /> Hide Replies
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown size={14} /> Show Replies
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => toggleAchieved(g)}
                                            >
                                                {g.achieved ? "Unachieve" : "Mark Achieved"}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditGoal(g)}
                                            >
                                                <Edit size={14} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteGoal(g.id)}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Replies */}
                                    {expandedThreads[g.id] && (
                                        <div className="ml-4 mt-2 space-y-2 border-l pl-3">
                                            {goalComments[g.id]?.length ? (
                                                goalComments[g.id].map((c) => (
                                                    <p key={c.id} className="text-sm text-muted-foreground">
                                                        <strong>{c.author?.username || "User"}:</strong> {c.content}
                                                    </p>
                                                ))
                                            ) : (
                                                <p className="text-xs text-muted-foreground">No replies yet.</p>
                                            )}
                                            <Textarea
                                                placeholder="Write a reply..."
                                                value={commentInputs[g.id] || ""}
                                                onChange={(e) =>
                                                    setCommentInputs((p) => ({ ...p, [g.id]: e.target.value }))
                                                }
                                            />
                                            <Button
                                                size="sm"
                                                onClick={() =>
                                                    addComment(g.id, commentInputs[g.id], g.coach_id || g.user_id)
                                                }
                                            >
                                                <MessageSquare size={14} /> Reply
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* LOGS */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Coaching Logs</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                                <Input
                                    type="date"
                                    value={newLog.date}
                                    onChange={(e) =>
                                        setNewLog((prev) => ({ ...prev, date: e.target.value }))
                                    }
                                />
                                <Input
                                    placeholder="Arrows per session"
                                    value={newLog.arrows_shot}
                                    onChange={(e) =>
                                        setNewLog((prev) => ({ ...prev, arrows_shot: e.target.value }))
                                    }
                                />
                                <Input
                                    placeholder="Rating (1–10)"
                                    value={newLog.session_rating}
                                    onChange={(e) =>
                                        setNewLog((prev) => ({
                                            ...prev,
                                            session_rating: e.target.value,
                                        }))
                                    }
                                />
                                <Textarea
                                    placeholder="Notes..."
                                    value={newLog.notes}
                                    onChange={(e) =>
                                        setNewLog((prev) => ({ ...prev, notes: e.target.value }))
                                    }
                                />
                                <Button onClick={addLog}>Add Log</Button>
                            </div>

                            {myLogs.length === 0 && (
                                <p className="text-sm text-muted-foreground">No logs yet.</p>
                            )}

                            <div className="space-y-2">
                                {myLogs.map((l) =>
                                    editLog?.id === l.id ? (
                                        <div
                                            key={l.id}
                                            className="border rounded-md p-3 space-y-2 bg-muted/30"
                                        >
                                            <Input
                                                type="date"
                                                value={editLog.date || ""}
                                                onChange={(e) =>
                                                    setEditLog((prev) =>
                                                        prev ? { ...prev, date: e.target.value } : prev
                                                    )
                                                }
                                            />
                                            <Input
                                                placeholder="Arrows shot"
                                                value={editLog.arrows_shot || ""}
                                                onChange={(e) =>
                                                    setEditLog((prev) =>
                                                        prev
                                                            ? { ...prev, arrows_shot: Number(e.target.value) }
                                                            : prev
                                                    )
                                                }
                                            />
                                            <Textarea
                                                placeholder="Notes..."
                                                value={editLog.notes || ""}
                                                onChange={(e) =>
                                                    setEditLog((prev) =>
                                                        prev ? { ...prev, notes: e.target.value } : prev
                                                    )
                                                }
                                            />
                                            <Button size="sm" onClick={saveLogEdit}>
                                                Save
                                            </Button>
                                        </div>
                                    ) : (
                                        <div
                                            key={l.id}
                                            className="border rounded-md p-3 flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {new Date(l.date).toLocaleDateString()} •{" "}
                                                    {l.arrows_shot || 0} arrows
                                                </p>
                                                {l.notes && (
                                                    <p className="text-sm text-muted-foreground">{l.notes}</p>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setEditLog(l)}
                                                >
                                                    <Edit size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deleteLog(l.id)}
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>

                                            <div className="w-full mt-3">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                        onClick={() => toggleThread(l.id, "log")}
                                                    >
                                                
                                                    {expandedThreads[l.id] ? (
                                                        <>
                                                            <ChevronUp size={14} /> Hide Replies
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown size={14} /> Show Replies
                                                        </>
                                                    )}
                                                </Button>

                                                {expandedThreads[l.id] && (
                                                    <div className="ml-4 mt-2 space-y-2 border-l pl-3">
                                                            {loadingThreads[l.id] ? (
                                                                <p className="text-xs text-muted-foreground">Loading replies...</p>
                                                            ) : logComments[l.id]?.length ? (
                                                            logComments[l.id].map((c) => (
                                                                <p key={c.id} className="text-sm text-muted-foreground">
                                                                    <strong>{c.author?.username || "User"}:</strong> {c.content}
                                                                </p>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground">No replies yet.</p>
                                                        )}
                                                        <Textarea
                                                            placeholder="Write a reply..."
                                                            value={commentInputs[l.id] || ""}
                                                            onChange={(e) =>
                                                                setCommentInputs((p) => ({ ...p, [l.id]: e.target.value }))
                                                            }
                                                        />
                                                        <Button
                                                            size="sm"
                                                            onClick={() =>
                                                                addLogReply(l.id, commentInputs[l.id], l.coach_id || l.user_id)
                                                            }
                                                        >
                                                            <MessageSquare size={14} /> Reply
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>

                            {/* GRAPH */}
                            {myLogs.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="font-semibold mb-2">Arrows Shot Over Time</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={myLogs.map((l) => ({
                                            date: new Date(l.date).toLocaleDateString(),
                                            arrows: l.arrows_shot,
                                        }))}>
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="arrows" stroke="#2563eb" />
                                        </LineChart>
                                    </ResponsiveContainer>

                                    <div className="flex justify-between text-sm mt-3">
                                        <p>
                                            This week:{" "}
                                            <strong>{myStats.arrowsThisWeek}</strong> arrows{" "}
                                            {myStats.moreThisWeek ? (
                                                <ArrowUp className="inline text-green-600" size={14} />
                                            ) : (
                                                <ArrowDown className="inline text-red-600" size={14} />
                                            )}
                                        </p>
                                        <p>
                                            This month: <strong>{myStats.arrowsThisMonth}</strong> arrows
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 👩‍🏫 Coach View */}
                {isCoach && (
                    <TabsContent value="coach-view" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Coach View</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* 🔍 Search */}
                                <div className="relative">
                                    <Input
                                        placeholder="Search for an athlete..."
                                        value={userQuery}
                                        onChange={(e) => setUserQuery(e.target.value)}
                                    />
                                    {userResults.length > 0 && (
                                        <div className="absolute bg-background border rounded-md mt-1 w-full z-10 shadow-md">
                                            {userResults.map((u) => (
                                                <button
                                                    key={u.id}
                                                    onClick={async () => {
                                                        setIsLoadingUser(true);
                                                        setUserResults([]);
                                                        setUserQuery("");
                                                        const { data: fullUser, error } = await supabase
                                                            .from("profiles")
                                                            .select("*")
                                                            .eq("id", u.id)
                                                            .eq("club_id", profile.club_id) // 👈 Must belong to same club
                                                            .single();

                                                        if (!fullUser) {
                                                            toast.error("You can only view athletes from your club.");
                                                            return;
                                                        }
                                                        setViewedAthlete(fullUser);
                                                    }}
                                                    className="w-full text-left px-3 py-2 hover:bg-muted transition"
                                                >
                                                    {u.username}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {isLoadingUser && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Loading athlete data...
                                    </p>
                                )}

                                {!isLoadingUser && !viewedAthlete && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Search and select an athlete to view their progress.
                                    </p>
                                )}

                                {/* 👤 Selected athlete’s data */}
                                {viewedAthlete && (
                                    <div className="space-y-6">
                                        <h2 className="text-lg font-semibold">
                                            Viewing {viewedAthlete.username}’s Progress
                                        </h2>

                                        {/* 🥅 Goals */}
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Goals</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {athleteGoals.length === 0 && (
                                                    <p className="text-muted-foreground text-sm">
                                                        No goals yet.
                                                    </p>
                                                )}
                                                {athleteGoals.map((goal) => (
                                                    <div key={goal.id} className="border rounded-md p-3 space-y-2">
                                                        <div className="flex justify-between">
                                                            <div>
                                                                <p className="font-medium">{goal.title}</p>
                                                                {goal.target_date && (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Target: {new Date(goal.target_date).toLocaleDateString()}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {goal.achieved && (
                                                                <span className="text-green-600 text-xs font-semibold">Achieved</span>
                                                            )}
                                                        </div>

                                                        {/* Show / Hide replies */}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => toggleThread(goal.id, "goal")}
                                                        >
                                                            {expandedThreads[goal.id] ? (
                                                                <>
                                                                    <ChevronUp size={14} /> Hide Replies
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ChevronDown size={14} /> Show Replies
                                                                </>
                                                            )}
                                                        </Button>

                                                        {/* Replies thread */}
                                                        {expandedThreads[goal.id] && (
                                                            <div className="ml-4 mt-2 space-y-2 border-l pl-3">
                                                                {goalComments[goal.id]?.length ? (
                                                                    goalComments[goal.id].map((c) => (
                                                                        <p key={c.id} className="text-sm text-muted-foreground">
                                                                            <strong>{c.author?.username || "User"}:</strong> {c.content}
                                                                        </p>
                                                                    ))
                                                                ) : (
                                                                    <p className="text-xs text-muted-foreground">No replies yet.</p>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Single comment input for coach */}
                                                        <Textarea
                                                            placeholder="Leave feedback..."
                                                            value={commentInputs[goal.id] || ""}
                                                            onChange={(e) =>
                                                                setCommentInputs((prev) => ({
                                                                    ...prev,
                                                                    [goal.id]: e.target.value,
                                                                }))
                                                            }
                                                        />
                                                        <Button
                                                            size="sm"
                                                            onClick={() => {
                                                                addComment(goal.id, commentInputs[goal.id], viewedAthlete.id);
                                                                setCommentInputs((prev) => ({
                                                                    ...prev,
                                                                    [goal.id]: "",
                                                                }));
                                                            }}
                                                            className="flex items-center gap-1"
                                                        >
                                                            <MessageSquare size={14} /> Comment
                                                        </Button>
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>

                                        {/* 🏹 Logs */}
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Coaching Logs</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {athleteLogs.length === 0 && (
                                                    <p className="text-muted-foreground text-sm">
                                                        No logs yet.
                                                    </p>
                                                )}
                                                {athleteLogs.map((log) => (
                                                    <div key={log.id} className="border rounded-md p-3 space-y-2">
                                                        <div className="flex justify-between">
                                                            <p className="font-medium">
                                                                {new Date(log.date).toLocaleDateString()} • {log.arrows_shot} arrows
                                                            </p>
                                                            {log.session_rating && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    Rating: {log.session_rating}/10
                                                                </span>
                                                            )}
                                                        </div>

                                                        {log.notes && (
                                                            <p className="text-sm text-muted-foreground italic">
                                                                “{log.notes}”
                                                            </p>
                                                        )}

                                                        {/* Show / Hide replies */}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => toggleThread(log.id, "log")}
                                                        >
                                                            {expandedThreads[log.id] ? (
                                                                <>
                                                                    <ChevronUp size={14} /> Hide Replies
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ChevronDown size={14} /> Show Replies
                                                                </>
                                                            )}
                                                        </Button>

                                                        {/* Replies thread */}
                                                        {expandedThreads[log.id] && (
                                                            <div className="ml-4 mt-2 space-y-2 border-l pl-3">
                                                                {logComments[log.id]?.length ? (
                                                                    logComments[log.id].map((c) => (
                                                                        <p key={c.id} className="text-sm text-muted-foreground">
                                                                            <strong>{c.author?.username || "User"}:</strong> {c.content}
                                                                        </p>
                                                                    ))
                                                                ) : (
                                                                    <p className="text-xs text-muted-foreground">No replies yet.</p>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Single feedback box */}
                                                        <Textarea
                                                            placeholder="Add coaching feedback..."
                                                            value={commentInputs[log.id] || ""}
                                                            onChange={(e) =>
                                                                setCommentInputs((prev) => ({
                                                                    ...prev,
                                                                    [log.id]: e.target.value,
                                                                }))
                                                            }
                                                        />
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                addLogReply(log.id, commentInputs[log.id], viewedAthlete.id);
                                                                setCommentInputs((prev) => ({
                                                                    ...prev,
                                                                    [log.id]: "",
                                                                }));
                                                            }}
                                                            className="flex items-center gap-1"
                                                        >
                                                            <MessageSquare size={14} /> Reply
                                                        </Button>
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>

                                        {/* 📈 Overview */}
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Performance Overview</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <LineChart data={athleteDataForChart}>
                                                        <XAxis dataKey="date" />
                                                        <YAxis />
                                                        <Tooltip />
                                                        <Line type="monotone" dataKey="arrows" stroke="#2563eb" />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                                <div className="flex justify-between text-sm mt-3">
                                                    <p>
                                                        This week:{" "}
                                                        <strong>{athleteStats.arrowsThisWeek}</strong> arrows{" "}
                                                        {athleteStats.moreThisWeek ? (
                                                            <ArrowUp className="inline text-green-600" size={14} />
                                                        ) : (
                                                            <ArrowDown className="inline text-red-600" size={14} />
                                                        )}
                                                    </p>
                                                    <p>
                                                        This month:{" "}
                                                        <strong>{athleteStats.arrowsThisMonth}</strong> arrows
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </main>
    );
}