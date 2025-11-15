"use client";

import { useState, useEffect, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
} from "@/components/ui/card";

export default function ManageSessions() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const [sessions, setSessions] = useState<any[]>([]);
    const [newSession, setNewSession] = useState({
        title: "",
        session_date: "",
        start_time: "",
        end_time: "",
        capacity: 10,
        repeatWeekly: false,
        endAfterDate: "",
    });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedSession, setSelectedSession] = useState<any | null>(null);
    const [signups, setSignups] = useState<any[]>([]);

    // 🧠 Load sessions
    async function loadSessions() {
        const { data, error } = await supabase
            .from("club_sessions")
            .select("*, session_signups(user_id, attended, profiles(username))")
            .order("session_date");
        if (error) toast.error("Error loading sessions");
        else setSessions(data || []);
    }

    useEffect(() => {
        loadSessions();
    }, []);

    // ✅ Create session (with recurrence)
    async function handleCreate() {
        if (!newSession.session_date) {
            toast.error("Please enter a session date");
            return;
        }

        const baseDate = new Date(newSession.session_date);
        const sessionsToInsert = [];

        if (newSession.repeatWeekly && newSession.endAfterDate) {
            const endDate = new Date(newSession.endAfterDate);
            let currentDate = new Date(baseDate);

            while (currentDate <= endDate) {
                sessionsToInsert.push({
                    title: newSession.title || null,
                    session_date: currentDate.toISOString().split("T")[0],
                    start_time: newSession.start_time,
                    end_time: newSession.end_time,
                    capacity: newSession.capacity,
                });
                currentDate.setDate(currentDate.getDate() + 7); // Weekly increment
            }
        } else {
            sessionsToInsert.push({
                title: newSession.title || null,
                session_date: baseDate.toISOString().split("T")[0],
                start_time: newSession.start_time,
                end_time: newSession.end_time,
                capacity: newSession.capacity,
            });
        }

        const { error } = await supabase.from("club_sessions").insert(sessionsToInsert);
        if (error) {
            console.error("Insert error:", error);
            toast.error("Error creating session(s)");
        } else {
            toast.success(
                sessionsToInsert.length > 1
                    ? `${sessionsToInsert.length} sessions created successfully`
                    : "Session created"
            );
            setNewSession({
                title: "",
                session_date: "",
                start_time: "",
                end_time: "",
                capacity: 10,
                repeatWeekly: false,
                endAfterDate: "",
            });
            loadSessions();
        }
    }

    // ✅ Update session
    async function handleUpdate(session: any) {
        const { error } = await supabase
            .from("club_sessions")
            .update(session)
            .eq("id", session.id);
        if (error) toast.error("Error updating session");
        else {
            toast.success("Session updated");
            setEditingId(null);
            loadSessions();
        }
    }

    // ✅ Delete session
    async function handleDelete(id: string) {
        const { error } = await supabase.from("club_sessions").delete().eq("id", id);
        if (error) toast.error("Error deleting session");
        else {
            toast.success("Session deleted");
            loadSessions();
        }
    }

    // ✅ Cancel session
    async function handleCancel(session: any) {
        const reason = prompt("Enter cancellation reason (optional):", "");
        const { error } = await supabase
            .from("club_sessions")
            .update({ cancelled: true, cancellation_reason: reason })
            .eq("id", session.id);
        if (error) toast.error("Error cancelling session");
        else {
            toast.success("Session cancelled");
            loadSessions();
        }
    }

    // ✅ Open session details
    async function openSessionDetails(session: any) {
        setSelectedSession(session);
        setSignups(session.session_signups || []);
    }

    // ✅ Toggle attendance
    async function toggleAttendance(user_id: string, attended: boolean | null) {
        if (!selectedSession) return;

        setSignups((prev) =>
            prev.map((su) =>
                su.user_id === user_id ? { ...su, attended } : su
            )
        );

        setSessions((prev) =>
            prev.map((s) =>
                s.id === selectedSession.id
                    ? {
                        ...s,
                        session_signups: s.session_signups.map((su: any) =>
                            su.user_id === user_id ? { ...su, attended } : su
                        ),
                    }
                    : s
            )
        );

        const { error } = await supabase
            .from("session_signups")
            .update({ attended })
            .eq("user_id", user_id)
            .eq("session_id", selectedSession.id);

        if (error) {
            console.error("Error updating attendance:", error);
            toast.error("Couldn't update attendance");
        } else {
            toast.success("Attendance updated");
        }
    }

    return (
        <section className="space-y-6">
            {/* 🧱 CREATE NEW SESSION */}
            <Card>
                <CardHeader>
                    <CardTitle>Create New Session</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div>
                        <label className="block text-sm font-medium">Session Title (optional)</label>
                        <p className="text-xs text-muted-foreground mb-1">
                            Give your session a title, or leave blank.
                        </p>
                        <input
                            placeholder="Session title (optional)"
                            value={newSession.title}
                            onChange={(e) =>
                                setNewSession({ ...newSession, title: e.target.value })
                            }
                            className="border rounded-md px-2 py-1 w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Session Date</label>
                        <p className="text-xs text-muted-foreground mb-1">
                            The date when this session will take place.
                        </p>
                        <input
                            type="date"
                            value={newSession.session_date}
                            onChange={(e) =>
                                setNewSession({
                                    ...newSession,
                                    session_date: e.target.value,
                                })
                            }
                            className="border rounded-md px-2 py-1 w-full"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium">Start Time</label>
                            <input
                                type="time"
                                value={newSession.start_time}
                                onChange={(e) =>
                                    setNewSession({
                                        ...newSession,
                                        start_time: e.target.value,
                                    })
                                }
                                className="border rounded-md px-2 py-1 w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">End Time</label>
                            <input
                                type="time"
                                value={newSession.end_time}
                                onChange={(e) =>
                                    setNewSession({
                                        ...newSession,
                                        end_time: e.target.value,
                                    })
                                }
                                className="border rounded-md px-2 py-1 w-full"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Capacity</label>
                        <p className="text-xs text-muted-foreground mb-1">
                            Maximum number of participants.
                        </p>
                        <input
                            type="number"
                            value={newSession.capacity}
                            onChange={(e) =>
                                setNewSession({
                                    ...newSession,
                                    capacity: parseInt(e.target.value) || 0,
                                })
                            }
                            className="border rounded-md px-2 py-1 w-full"
                            placeholder="Capacity"
                        />
                    </div>

                    {/* 🗓️ Repeat Weekly Toggle */}
                    <div className="flex items-center gap-3 mt-2">
                        <input
                            id="repeatWeekly"
                            type="checkbox"
                            checked={newSession.repeatWeekly}
                            onChange={(e) =>
                                setNewSession({
                                    ...newSession,
                                    repeatWeekly: e.target.checked,
                                })
                            }
                        />
                        <label htmlFor="repeatWeekly" className="text-sm font-medium">
                            Repeat Weekly
                        </label>
                    </div>

                    {newSession.repeatWeekly && (
                        <div>
                            <label className="block text-sm font-medium">End After Date</label>
                            <p className="text-xs text-muted-foreground mb-1">
                                Sessions will repeat weekly until this date.
                            </p>
                            <input
                                type="date"
                                value={newSession.endAfterDate}
                                onChange={(e) =>
                                    setNewSession({
                                        ...newSession,
                                        endAfterDate: e.target.value,
                                    })
                                }
                                className="border rounded-md px-2 py-1 w-full"
                            />
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <button
                        onClick={handleCreate}
                        className="rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-1 text-sm hover:opacity-90"
                    >
                        {newSession.repeatWeekly
                            ? "Add Recurring Sessions"
                            : "Add Session"}
                    </button>
                </CardFooter>
            </Card>

            {/* 🧾 SESSION LIST */}
            <div className="space-y-3">
                {sessions.map((s) => (
                    <Card
                        key={s.id}
                        onClick={() => openSessionDetails(s)}
                        className="cursor-pointer hover:bg-[hsl(var(--muted))]/20 transition"
                    >
                        <CardHeader>
                            <CardTitle>{s.title || "(Untitled Session)"}</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                {s.session_date} | {s.start_time} – {s.end_time} | cap: {s.capacity}
                            </p>
                            {s.cancelled && (
                                <p className="text-xs text-red-600 mt-1">
                                    Cancelled: {s.cancellation_reason || "No reason provided"}
                                </p>
                            )}
                        </CardHeader>

                        <CardFooter className="flex gap-2 justify-end">
                            {!s.cancelled && (
                                <>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCancel(s);
                                        }}
                                        className="text-orange-600 text-sm underline"
                                    >
                                        Cancel Session
                                    </button>
                                </>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(s.id);
                                }}
                                className="text-red-600 text-sm underline"
                            >
                                Delete
                            </button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {/* 🪟 POPUP MODAL */}
            {selectedSession && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setSelectedSession(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-xl w-[90%] max-w-md"
                    >
                        <h3 className="text-lg font-semibold mb-2">
                            {selectedSession.title || "(Untitled Session)"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                            {selectedSession.session_date} — {selectedSession.start_time} to{" "}
                            {selectedSession.end_time}
                        </p>
                        <p className="text-sm mb-4">
                            Capacity: {selectedSession.session_signups?.length}/
                            {selectedSession.capacity}
                        </p>

                        <h4 className="font-medium mb-2">Attendance Register:</h4>
                        <ul className="max-h-60 overflow-y-auto border rounded-md p-2 text-sm space-y-1">
                            {signups.length > 0 ? (
                                [...signups].map((su, index) => (
                                    <li
                                        key={su.user_id}
                                        className={`flex justify-between items-center border-b py-1 px-2 rounded-md transition-colors
                    ${su.attended === true
                                                ? "bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100"
                                                : su.attended === false
                                                    ? "bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-100"
                                                    : "bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-gray-200"
                                            }`}
                                    >
                                        <span>
                                            <span className="font-semibold mr-1">#{index + 1}</span>
                                            {su.profiles?.username || su.user_id}
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => toggleAttendance(su.user_id, true)}
                                                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                                            >
                                                <Check size={16} />
                                            </button>
                                            <button
                                                onClick={() => toggleAttendance(su.user_id, false)}
                                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </li>
                                ))
                            ) : (
                                <li className="text-muted-foreground text-sm">
                                    No one signed up yet
                                </li>
                            )}
                        </ul>

                        <button
                            className="mt-4 bg-red-600 text-white w-full py-2 rounded-md"
                            onClick={() => setSelectedSession(null)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}