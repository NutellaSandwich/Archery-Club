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

    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [sessionToCancel, setSessionToCancel] = useState<any | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<any | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editSession, setEditSession] = useState<any | null>(null);
    // 🧠 Load sessions
    async function loadSessions() {
        const { data, error } = await supabase
            .from("club_sessions")
            .select(`
    id,
    title,
    session_date,
    start_time,
    end_time,
    capacity,
    cancelled,
    cancellation_reason,
    session_signups:session_signups (
        id,
        user_id,
        attended,
        is_coach,
        profiles:profiles(username)
    )
`)       .order("session_date");
        if (error) toast.error("Error loading sessions");
        else setSessions(data || []);
    }

    useEffect(() => {
        loadSessions();
    }, []);

    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];

        setNewSession((prev) => ({
            ...prev,
            session_date: today,
            start_time: "18:00",   // choose your default
            end_time: "20:00",     // choose your default
        }));
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

    async function handleUpdate(session: any) {
        const updateData = {
            title: session.title || null,
            session_date: session.session_date,
            start_time: session.start_time,
            end_time: session.end_time,
            capacity: session.capacity,
        };

        const { error } = await supabase
            .from("club_sessions")
            .update(updateData)
            .eq("id", session.id);

        if (error) toast.error("Error updating session");
        else {
            toast.success("Session updated");
            setEditingId(null);
            loadSessions();
        }
    }

    async function handleDelete(id: string) {
        console.log("Attempting delete for session:", id);

        // Confirm record exists
        const { data: check } = await supabase
            .from("club_sessions")
            .select("id")
            .eq("id", id);

        console.log("Record exists:", check);

        if (!check || check.length === 0) {
            toast.error("Session ID not found in database");
            return;
        }

        const { error } = await supabase
            .from("club_sessions")
            .delete()
            .eq("id", id);

        console.log("Delete result:", error);

        if (error) toast.error("Error deleting session");
        else {
            toast.success("Session deleted");
            loadSessions();
        }
    }

    async function confirmCancel() {
        if (!sessionToCancel) return;

        const { error } = await supabase
            .from("club_sessions")
            .update({
                cancelled: true,
                cancellation_reason: cancelReason || null,
            })
            .eq("id", sessionToCancel.id);

        if (error) {
            toast.error("Error cancelling session");
        } else {
            toast.success("Session cancelled");
            loadSessions();
        }

        setCancelModalOpen(false);
        setSessionToCancel(null);
        setCancelReason("");
    }

    async function confirmDelete() {
        if (!sessionToDelete) return;

        console.log("Attempting delete for session:", sessionToDelete.id);

        const { error } = await supabase
            .from("club_sessions")
            .delete()
            .eq("id", sessionToDelete.id);

        console.log("Delete result:", error);

        if (error) toast.error("Error deleting session");
        else {
            toast.success("Session deleted");
            loadSessions();
        }

        setDeleteModalOpen(false);
        setSessionToDelete(null);
    }

    // ✅ Cancel session
    function handleCancel(session: any) {
        setSessionToCancel(session);
        setCancelReason("");
        setCancelModalOpen(true);
    }

    // ✅ Open session details
    async function openSessionDetails(session: any) {
        setSelectedSession(session);
        setSignups(session.session_signups || []);
    }

    async function toggleAttendance(user_id: string, attended: boolean | null) {
        if (!selectedSession) return;

        // Update DB
        const { error } = await supabase
            .from("session_signups")
            .update({ attended })
            .eq("user_id", user_id)
            .eq("session_id", selectedSession.id);

        if (error) {
            console.error("Error updating attendance:", error);
            toast.error("Couldn't update attendance");
            return;
        }

        // Reload signups from DB so UI matches truth
        const { data } = await supabase
            .from("session_signups")
            .select("*, profiles:profiles(username)")
            .eq("session_id", selectedSession.id);

        setSignups(data || []);

        // Update parent list too
        setSessions((prev) =>
            prev.map((s) =>
                s.id === selectedSession.id
                    ? { ...s, session_signups: data || [] }
                    : s
            )
        );
        console.log("Update attendance", {
            session_id: selectedSession.id,
            user_id,
        });
    }

    return (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-10">

            {/* HEADER */}
            <div className="text-center space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-r from-emerald-600 to-sky-500 bg-clip-text text-transparent">
                    Manage Sessions
                </h1>
                <p className="text-sm text-muted-foreground">
                    Create practice sessions and track attendance
                </p>
            </div>

            {/* CREATE NEW SESSION */}
            <Card className="rounded-3xl border border-border/60 bg-muted/40 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">
                        Create New Session
                    </CardTitle>
                </CardHeader>

                <CardContent className="grid gap-5 text-sm">
                    {/* Title */}
                    <div>
                        <label className="block font-medium text-xs uppercase tracking-wide text-muted-foreground">
                            Session Title (optional)
                        </label>
                        <input
                            placeholder="Session title"
                            value={newSession.title}
                            onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block font-medium text-xs uppercase tracking-wide text-muted-foreground">
                            Session Date
                        </label>
                        <input
                            type="date"
                            value={newSession.session_date}
                            onChange={(e) => setNewSession({ ...newSession, session_date: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Times */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-medium text-xs uppercase tracking-wide text-muted-foreground">
                                Start Time
                            </label>
                            <input
                                type="time"
                                value={newSession.start_time}
                                onChange={(e) => setNewSession({ ...newSession, start_time: e.target.value })}
                                className="mt-1 w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block font-medium text-xs uppercase tracking-wide text-muted-foreground">
                                End Time
                            </label>
                            <input
                                type="time"
                                value={newSession.end_time}
                                onChange={(e) => setNewSession({ ...newSession, end_time: e.target.value })}
                                className="mt-1 w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    {/* Capacity */}
                    <div>
                        <label className="block font-medium text-xs uppercase tracking-wide text-muted-foreground">
                            Capacity
                        </label>
                        <input
                            type="number"
                            value={newSession.capacity}
                            onChange={(e) =>
                                setNewSession({ ...newSession, capacity: parseInt(e.target.value) || 0 })
                            }
                            className="mt-1 w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Weekly toggle */}
                    <div className="flex items-center gap-3 mt-1">
                        <input
                            id="repeatWeekly"
                            type="checkbox"
                            checked={newSession.repeatWeekly}
                            onChange={(e) =>
                                setNewSession({ ...newSession, repeatWeekly: e.target.checked })
                            }
                            className="rounded-sm border-border/60"
                        />
                        <label htmlFor="repeatWeekly" className="text-sm font-medium">
                            Repeat Weekly
                        </label>
                    </div>

                    {newSession.repeatWeekly && (
                        <div>
                            <label className="block font-medium text-xs uppercase tracking-wide text-muted-foreground">
                                End After Date
                            </label>
                            <input
                                type="date"
                                value={newSession.endAfterDate}
                                onChange={(e) =>
                                    setNewSession({ ...newSession, endAfterDate: e.target.value })
                                }
                                className="mt-1 w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm"
                            />
                        </div>
                    )}
                </CardContent>

                <CardFooter>
                    <button
                        onClick={handleCreate}
                        className="rounded-xl bg-gradient-to-r from-emerald-600 to-sky-500 text-white px-5 py-2 text-sm font-medium hover:opacity-90 transition"
                    >
                        {newSession.repeatWeekly ? "Add Recurring Sessions" : "Add Session"}
                    </button>
                </CardFooter>
            </Card>

            {/* SESSION LIST */}
            <div className="space-y-4">
                {sessions.map((s) => (
                    <Card
                        key={s.id}
                        onClick={() => openSessionDetails(s)}
                        className="cursor-pointer transition hover:bg-muted/40 rounded-2xl border border-border/50 shadow-sm"
                    >
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">
                                {s.title || "Regular Session"}
                            </CardTitle>

                            <p className="text-xs text-muted-foreground">
                                {s.session_date} | {s.start_time}–{s.end_time} | cap {s.capacity}
                            </p>

                            {s.cancelled && (
                                <p className="text-xs text-red-600 mt-2">
                                    Cancelled — {s.cancellation_reason || "No reason provided"}
                                </p>
                            )}
                        </CardHeader>

                        <CardFooter className="flex gap-4 justify-end">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditSession(s);
                                    setEditModalOpen(true);
                                }}
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Edit
                            </button>

                            {!s.cancelled && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancel(s);
                                    }}
                                    className="text-sm text-orange-600 hover:underline"
                                >
                                    Cancel Session
                                </button>
                            )}

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSessionToDelete(s);
                                    setDeleteModalOpen(true);
                                }}
                                className="text-sm text-red-600 hover:underline"
                            >
                                Delete
                            </button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {/* ALL MODALS BELOW ARE RESTYLED THE SAME WAY */}
            {/* SESSION DETAILS MODAL */}
            {selectedSession && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
                    onClick={() => setSelectedSession(null)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-background border border-border/60 rounded-2xl shadow-xl p-6 w-[95%] max-w-md space-y-4"
                    >
                        <h3 className="text-xl font-semibold">
                            {selectedSession.title || "Session Details"}
                        </h3>

                        <p className="text-sm text-muted-foreground">
                            {selectedSession.session_date} — {selectedSession.start_time}–{selectedSession.end_time}
                        </p>

                        <p className="text-sm">
                            Capacity:{" "}
                            <span className="font-medium">
                                {selectedSession.session_signups?.length}/{selectedSession.capacity}
                            </span>
                        </p>

                        <h4 className="text-sm font-semibold mt-2">Attendance</h4>

                        {/* SIGNUP LIST */}
                        <ul className="border border-border/60 rounded-lg bg-muted/30 max-h-60 overflow-y-auto text-sm divide-y divide-border/40">
                            {signups.length ? (
                                signups.map((su, i) => (
                                    <li
                                        key={su.user_id}
                                        className={`
        flex justify-between items-center px-3 py-2 rounded-md transition
        ${su.attended === true
                                                ? "bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100"
                                                : su.attended === false
                                                    ? "bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-100"
                                                    : "bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-gray-200"
                                            }
    `}
                                    >
                                        <span className="truncate">
                                            <span className="font-medium">#{i + 1}</span>{" "}
                                            {su.profiles?.username}

                                            <span className="text-xs ml-2 italic opacity-70">
                                                {su.attended === true
                                                    ? "Present"
                                                    : su.attended === false
                                                        ? "Absent"
                                                        : "Unmarked"}
                                            </span>
                                        </span>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleAttendance(su.user_id, true);
                                                }}
                                                className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                            >
                                                <Check size={18} />
                                            </button>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleAttendance(su.user_id, false);
                                                }}
                                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    </li>
                                ))
                            ) : (
                                <li className="p-3 text-muted-foreground text-sm">No signups yet</li>
                            )}
                        </ul>

                        <button
                            onClick={() => setSelectedSession(null)}
                            className="w-full mt-4 bg-gradient-to-r from-emerald-600 to-sky-500 text-white rounded-xl py-2 hover:opacity-90"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* CANCEL MODAL */}
            {cancelModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-background border border-border/60 rounded-2xl shadow-xl p-6 w-[95%] max-w-sm space-y=4"
                    >
                        <h3 className="text-lg font-semibold">Cancel Session</h3>

                        <p className="text-sm text-muted-foreground">
                            Enter an optional cancellation reason:
                        </p>

                        <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            rows={3}
                            className="w-full mt-1 rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-sm"
                        />

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setCancelModalOpen(false)}
                                className="px-4 py-2 text-sm rounded-xl border border-border/50 hover:bg-muted/40"
                            >
                                Close
                            </button>

                            <button
                                onClick={confirmCancel}
                                className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white"
                            >
                                Confirm Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            {deleteModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-background border border-border/60 rounded-2xl shadow-xl p-6 w-[95%] max-w-sm space-y-4"
                    >
                        <h3 className="text-lg font-semibold text-red-600">Delete Session?</h3>

                        <p className="text-sm text-muted-foreground">
                            Are you sure you want to delete{" "}
                            <strong>{sessionToDelete?.title || "this session"}</strong>?<br /><br />
                            <span className="text-red-500 font-medium">This action cannot be undone.</span>
                        </p>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setDeleteModalOpen(false)}
                                className="px-4 py-2 text-sm rounded-xl border border-border/50 hover:bg-muted/40"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {editModalOpen && editSession && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-background border border-border/60 rounded-2xl shadow-xl p-6 w-[95%] max-w-sm space-y-4"
                    >
                        <h3 className="text-lg font-semibold">Edit Session</h3>

                        <div className="space-y-3 text-sm">
                            <div>
                                <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Title
                                </label>
                                <input
                                    value={editSession.title || ""}
                                    onChange={(e) => setEditSession({ ...editSession, title: e.target.value })}
                                    className="mt-1 w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Session Date
                                </label>
                                <input
                                    type="date"
                                    value={editSession.session_date}
                                    onChange={(e) =>
                                        setEditSession({ ...editSession, session_date: e.target.value })
                                    }
                                    className="mt-1 w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Start Time
                                    </label>
                                    <input
                                        type="time"
                                        value={editSession.start_time}
                                        onChange={(e) =>
                                            setEditSession({ ...editSession, start_time: e.target.value })
                                        }
                                        className="mt-1 w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        End Time
                                    </label>
                                    <input
                                        type="time"
                                        value={editSession.end_time}
                                        onChange={(e) =>
                                            setEditSession({ ...editSession, end_time: e.target.value })
                                        }
                                        className="mt-1 w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Capacity
                                </label>
                                <input
                                    type="number"
                                    value={editSession.capacity}
                                    onChange={(e) =>
                                        setEditSession({ ...editSession, capacity: Number(e.target.value) })
                                    }
                                    className="mt-1 w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setEditModalOpen(false)}
                                className="px-4 py-2 text-sm rounded-xl border border-border/50 hover:bg-muted/40"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={async () => {
                                    const { error } = await supabase
                                        .from("club_sessions")
                                        .update({
                                            title: editSession.title || null,
                                            session_date: editSession.session_date,
                                            start_time: editSession.start_time,
                                            end_time: editSession.end_time,
                                            capacity: editSession.capacity,
                                        })
                                        .eq("id", editSession.id);

                                    if (error) toast.error("Error updating session");
                                    else toast.success("Session updated");

                                    setEditModalOpen(false);
                                    setEditSession(null);
                                    loadSessions();
                                }}
                                className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-emerald-600 to-sky-500 text-white"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}