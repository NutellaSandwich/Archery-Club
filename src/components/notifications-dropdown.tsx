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

        if (error) {
            console.error("Error loading notifications:", error);
            return;
        }

        const typedData = (data ?? []) as unknown as Notification[];

        setNotifications(
            typedData.map((n) => ({
                ...n,
                actor: Array.isArray(n.actor) ? n.actor[0] : n.actor,
            }))
        );
        setUnreadCount(typedData.filter((n) => !n.read).length);
    }

    async function markAllRead() {
        const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
        if (unreadIds.length === 0) return;

        setNotifications((prev) =>
            prev.map((n) => ({ ...n, read: true }))
        );
        setUnreadCount(0);

        await supabase
            .from("notifications")
            .update({ read: true })
            .in("id", unreadIds);
    }

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
                return `${actor} did something`;
        }
    };

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    className="relative p-2 rounded-lg hover:bg-[hsl(var(--muted))]/40 transition"
                    aria-label="Notifications"
                >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className="w-72 rounded-xl border border-[hsl(var(--border))]/40 bg-[hsl(var(--popover))] shadow-md p-2"
                    sideOffset={8}
                >
                    <div className="flex items-center justify-between px-3 py-1.5">
                        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                            Notifications
                        </p>
                        <button
                            onClick={markAllRead}
                            className="text-[10px] text-blue-500 hover:underline"
                        >
                            Mark all as read
                        </button>
                    </div>

                    {notifications.length === 0 ? (
                        <p className="text-center text-sm text-[hsl(var(--muted-foreground))] py-4">
                            No notifications yet
                        </p>
                    ) : (
                        <div className="max-h-80 overflow-y-auto">
                            {notifications.map((n) => (
                                <DropdownMenu.Item
                                    key={n.id}
                                    asChild
                                    className={`block px-3 py-2 rounded-md text-sm cursor-pointer hover:bg-[hsl(var(--muted))]/30 transition ${!n.read
                                            ? "bg-[hsl(var(--muted))]/20"
                                            : ""
                                        }`}
                                >
                                    <Link
                                        href={`/dashboard?post=${n.post_id}`}
                                        onClick={async () => {
                                            await supabase
                                                .from("notifications")
                                                .update({ read: true })
                                                .eq("id", n.id);
                                        }}
                                    >
                                        <p className="text-[hsl(var(--foreground))]">
                                            {getMessage(n)}
                                        </p>
                                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                                            {new Date(
                                                n.created_at
                                            ).toLocaleString()}
                                        </p>
                                    </Link>
                                </DropdownMenu.Item>
                            ))}
                        </div>
                    )}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}