"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Bell } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";

type Notification = {
    id: string;
    type: "like" | "comment" | "reply";
    post_id: string;
    actor: { username: string | null; avatar_url: string | null } | null;
    read: boolean;
    created_at: string;
};

export default function NotificationsDropdown({ userId }: { userId: string }) {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    /* ----------------------------------------------
        LOAD + REALTIME SUBSCRIBE
    ---------------------------------------------- */
    useEffect(() => {
        if (!userId || !supabase) return;
        loadNotifications();

        const channel = supabase
            .channel("notifications_realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "notifications" },
                loadNotifications
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, supabase]);

    async function loadNotifications() {
        const { data, error } = await supabase
            .from("notifications")
            .select(
                `id, type, post_id, read, created_at, 
                 actor:profiles!notifications_actor_id_fkey(username, avatar_url)`
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) return console.error("Error loading notifications:", error);

        const typed = (data ?? []) as unknown as Notification[];

        setNotifications(
            typed.map((n) => ({
                ...n,
                actor: Array.isArray(n.actor) ? n.actor[0] : n.actor,
            }))
        );

        setUnreadCount(typed.filter((n) => !n.read).length);
    }

    async function markAllRead() {
        const ids = notifications.filter((n) => !n.read).map((n) => n.id);
        if (!ids.length) return;

        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);

        await supabase.from("notifications").update({ read: true }).in("id", ids);
    }

    /* ----------------------------------------------
        MESSAGE BUILDER
    ---------------------------------------------- */
    const getMessage = (n: Notification) => {
        const actor = n.actor?.username || "Someone";
        switch (n.type) {
            case "like":
                return `${actor} liked your post`;
            case "comment":
                return `${actor} commented on your post`;
            case "reply":
                return `${actor} replied to your comment`;
            default:
                return `${actor} interacted with you`;
        }
    };

    /* ----------------------------------------------
        UI
    ---------------------------------------------- */
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    aria-label="Notifications"
                    className="
                        relative p-2 rounded-xl border border-border/60 
                        bg-muted/40 hover:bg-muted/60
                        shadow-sm transition
                    "
                >
                    <Bell size={18} className="text-foreground/90" />

                    {unreadCount > 0 && (
                        <span
                            className="
                                absolute -top-1 -right-1 
                                bg-gradient-to-r from-red-500 to-rose-500 
                                text-white text-[10px] font-semibold 
                                rounded-full px-1.5 py-[1px] shadow
                            "
                        >
                            {unreadCount}
                        </span>
                    )}
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    sideOffset={8}
                    className="
                        w-72 rounded-2xl border border-border/70 
                        bg-background/90 backdrop-blur-xl shadow-xl 
                        p-2 animate-in fade-in-0 zoom-in-95
                    "
                >
                    {/* HEADER */}
                    <div className="px-3 py-2 flex items-center justify-between border-b border-border/50">
                        <p className="
                            text-xs font-semibold 
                            bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent
                        ">
                            Notifications
                        </p>

                        {notifications.length > 0 && (
                            <button
                                onClick={markAllRead}
                                className="text-[10px] text-sky-500 hover:underline"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    {/* LIST */}
                    {notifications.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-5">
                            No notifications yet
                        </p>
                    ) : (
                        <div className="max-h-80 overflow-y-auto mt-1 pr-1 space-y-1">
                            {notifications.map((n) => {
                                const unread = !n.read;
                                return (
                                    <DropdownMenu.Item
                                        key={n.id}
                                        asChild
                                        className="
                                            block cursor-pointer rounded-xl transition
                                            focus:outline-none
                                        "
                                    >
                                        <Link
                                            href={`/dashboard?post=${n.post_id}`}
                                            onClick={() =>
                                                supabase
                                                    .from("notifications")
                                                    .update({ read: true })
                                                    .eq("id", n.id)
                                            }
                                            className={`
                                                px-3 py-2 block rounded-xl 
                                                border border-transparent 
                                                text-sm transition
                                                ${unread
                                                    ? "bg-emerald-500/10 border-emerald-500/20 shadow-sm"
                                                    : "hover:bg-muted/40"
                                                }
                                            `}
                                        >
                                            <p className="text-foreground/90">{getMessage(n)}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {new Date(n.created_at).toLocaleString()}
                                            </p>
                                        </Link>
                                    </DropdownMenu.Item>
                                );
                            })}
                        </div>
                    )}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}