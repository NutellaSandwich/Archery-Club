"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import Image from "next/image";
import {
    Heart,
    MessageCircle,
    ChevronDown,
    CornerDownRight,
    Trash2,
    Trophy,
    Award,
    Camera,
    Pencil,
    BowArrow
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import RoundNameSelect from "@/components/RoundNameSelect";
import { getRoundMaxScore } from "@/lib/rounds";
import { Button } from "@/components/ui/button";

interface ClubFeedClientProps {
    userId: string;
    clubId: string | null;
}

type Profile = {
    id: string;
    username: string;
    avatar_url: string | null;
    role?: string | null;
};

type Reply = {
    id: string;
    content: string;
    created_at: string;
    profiles: Profile;
};

type Comment = {
    id: string;
    content: string;
    created_at: string;
    profiles: Profile;
    replies?: Reply[];
};

type Post = {
    id: string;
    round_name: string;
    bow_type: string;
    score: number;
    golds: number;
    profiles: Profile;
    created_at: string;
    likes_count?: number;
    comments_count?: number;
    liked_by_user?: boolean;
    comments?: Comment[];
    _deleting?: boolean;
    is_club_record?: boolean;
    is_personal_best?: boolean;
    score_date?: string | null;
    score_type?: "Informal Practice" | "Formal Practice" | "Competition" | null;
    competition_name?: string | null;
    scoresheet_url?: string | null;
    spot_type?: string | null;
};

type RawComment = {
    id: string;
    post_id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles: Profile;
};

export default function ClubFeedClient({ userId, clubId }: ClubFeedClientProps) {
    const router = useRouter();
    const supabase = useMemo(
        () => (typeof window !== "undefined" ? supabaseBrowser() : null),
        []
    );

    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComments, setNewComments] = useState<Record<string, string>>({});
    const [newReplies, setNewReplies] = useState<Record<string, string>>({});
    const [expandedPost, setExpandedPost] = useState<string | null>(null);
    const [expandedComment, setExpandedComment] = useState<string | null>(null);
    const [animatingComment, setAnimatingComment] = useState<string | null>(null);
    const [animatingLike, setAnimatingLike] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [confirmDeleteComment, setConfirmDeleteComment] = useState<string | null>(null);
    const [confirmDeleteReply, setConfirmDeleteReply] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const [editingPost, setEditingPost] = useState<{
        id: string;
        round_name: string;
        bow_type: string;
        spot_type: string;
        score: string;
        golds: string;
        score_date: string;
        score_type: Post["score_type"];
        competition_name: string;
        existingScoresheetUrl: string | null;
        newScoresheetFile: File | null;
    } | null>(null);

    const [editAvailableSpotTypes, setEditAvailableSpotTypes] = useState<string[]>([]);
    const [editRoundMax, setEditRoundMax] = useState<number | null>(null);
    const isEditFormalOrComp =
        editingPost?.score_type === "Formal Practice" ||
        editingPost?.score_type === "Competition";

    const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

    function openEdit(post: Post) {
        setEditingPost({
            id: post.id,
            round_name: post.round_name,
            bow_type: post.bow_type,
            spot_type: (post.spot_type as string) || "",
            score: String(post.score ?? ""),
            golds: String(post.golds ?? "0"),
            score_date: (post.score_date ?? post.created_at).slice(0, 10),
            score_type: post.score_type ?? "Informal Practice",
            competition_name: post.competition_name ?? "",
            existingScoresheetUrl: post.scoresheet_url ?? null,
            newScoresheetFile: null,
        });
    }

    function closeEdit() {
        setEditingPost(null);
        setEditAvailableSpotTypes([]);
        setEditRoundMax(null);
    }

    useEffect(() => {
        if (!editingPost) return;

        const ep = editingPost;

        setEditRoundMax(getRoundMaxScore(ep.round_name) ?? null);

        const normalizeRound = (s: string) =>
            s.toLowerCase()
                .replace(/[\s,()]+/g, " ")
                .replace(/\b(triple|full|size|spot)\b/g, "")
                .trim();

        async function ensureSpotTypes(current: NonNullable<typeof editingPost>) {
            const cached = localStorage.getItem("handicaps_cache_static");
            if (cached) {
                const list: { round_name: string; spot_types: string[] }[] = JSON.parse(cached);
                const hit = list.find(
                    (r) => normalizeRound(r.round_name) === normalizeRound(current.round_name)
                );
                const spots = (hit?.spot_types || ["full size"]).map((s) =>
                    s.toLowerCase().includes("triple") || s.toLowerCase().includes("3spot")
                        ? "triple"
                        : "full size"
                );
                const uniqueSpots = Array.from(new Set(spots));
                setEditAvailableSpotTypes(uniqueSpots);

                if (uniqueSpots.length === 1 && current.spot_type !== uniqueSpots[0]) {
                    setEditingPost((prev) =>
                        prev && prev.id === current.id ? { ...prev, spot_type: uniqueSpots[0] } : prev
                    );
                }
                return;
            }

            const { data, error } = await supabase!
                .from("handicaps")
                .select("round_name, spot_type");
            if (error) {
                setEditAvailableSpotTypes(["full size"]);
                return;
            }
            const grouped = (data || []).reduce((acc: Record<string, Set<string>>, row: any) => {
                const name = row.round_name?.trim();
                if (!name) return acc;
                acc[name] = acc[name] || new Set<string>();
                const s = String(row.spot_type || "").toLowerCase();
                if (s.includes("triple") || s.includes("3spot")) acc[name].add("triple");
                else acc[name].add("full size");
                return acc;
            }, {});
            const key = Object.keys(grouped).find(
                (k) => normalizeRound(k) === normalizeRound(current.round_name)
            );
            const spots: string[] = key ? Array.from(grouped[key] as Set<string>) : ["full size"];
            setEditAvailableSpotTypes(spots);

            if (spots.length === 1 && current.spot_type !== spots[0]) {
                setEditingPost((prev): typeof editingPost => {
                    if (!prev) return prev;
                    return prev.id === current.id ? { ...prev, spot_type: spots[0] } : prev;
                });
            }
        }

        ensureSpotTypes(ep);
    }, [editingPost, supabase]);

    useEffect(() => {
        if (!clubId || !supabase) return;
        loadPosts();

        const channel = supabase
            .channel("club_feed_realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "club_posts" }, loadPosts)
            .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, loadPosts)
            .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, loadPosts)
            .on("postgres_changes", { event: "*", schema: "public", table: "comment_replies" }, loadPosts)
            .on("postgres_changes", { event: "*", schema: "public", table: "club_records" }, loadPosts)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [clubId, supabase]);

    async function loadPosts() {
        if (!supabase) return;
        setLoading(true);

        try {
            const { data: posts, error: postError } = await supabase
                .from("club_posts")
                .select(`
    id,
    round_name,
    bow_type,
    score,
    golds,
    created_at,
    user_id,
    is_club_record,
    is_personal_best,
    score_date,
    score_type,
    competition_name,
    scoresheet_url,
    spot_type,
    profiles(id, username, avatar_url)
  `)
                .eq("club_id", clubId)
                .order("created_at", { ascending: false });

            if (postError) throw postError;
            if (!posts) {
                setPosts([]);
                setLoading(false);
                return;
            }

            const [{ data: likesData, error: likesError }, { data: userLikes, error: userLikesError }] =
                await Promise.all([
                    supabase.from("post_likes").select("post_id"),
                    supabase.from("post_likes").select("post_id").eq("user_id", userId),
                ]);

            if (likesError) console.error("Likes load error:", likesError);
            if (userLikesError) console.error("User likes load error:", userLikesError);

            const likeCounts =
                likesData?.reduce((acc: Record<string, number>, { post_id }: { post_id: string }) => {
                    acc[post_id] = (acc[post_id] || 0) + 1;
                    return acc;
                }, {}) || {};

            const { data: commentsData, error: commentError } = await supabase
                .from("post_comments")
                .select(`
          id,
          post_id,
          user_id,
          content,
          created_at,
          profiles(id, username, avatar_url)
        `)
                .order("created_at", { ascending: true });

            if (commentError) console.error("Comment load error:", commentError);

            const { data: repliesData, error: replyError } = await supabase
                .from("comment_replies")
                .select(`
          id,
          comment_id,
          user_id,
          content,
          created_at,
          profiles(id, username, avatar_url)
        `)
                .order("created_at", { ascending: true });

            if (replyError) console.error("Reply load error:", replyError);

            const repliesByComment =
                repliesData?.reduce((acc: Record<string, Reply[]>, r: Reply & { comment_id: string }) => {
                    acc[r.comment_id] = acc[r.comment_id] || [];
                    acc[r.comment_id].push(r);
                    return acc;
                }, {}) || {};

            const commentsByPost =
                ((commentsData as unknown as RawComment[]) ?? []).reduce<Record<string, Comment[]>>(
                    (acc, c: RawComment) => {
                        if (!c.post_id) return acc;
                        acc[c.post_id] = acc[c.post_id] || [];
                        acc[c.post_id].push({ ...c, replies: repliesByComment[c.id] || [] });
                        return acc;
                    },
                    {}
                );

            const enriched = posts.map((p: Post) => ({
                ...p,
                profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
                likes_count: likeCounts[p.id] || 0,
                liked_by_user: userLikes?.some((l: { post_id: string }) => l.post_id === p.id) ?? false,
                comments: commentsByPost[p.id] || [],
                comments_count: commentsByPost[p.id]?.length || 0,
            }));

            setPosts(enriched);
        } catch (err) {
            console.error("Feed load failed:", err);
            toast.error("Failed to load feed data");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        async function fetchProfile() {
            if (!supabase || !userId) return;
            const { data, error } = await supabase
                .from("profiles")
                .select("id, username, avatar_url, role")
                .eq("id", userId)
                .single();
            if (!error && data) setCurrentProfile(data);
        }
        fetchProfile();
    }, [supabase, userId]);

    async function toggleLike(postId: string, liked: boolean) {
        if (!supabase) return;

        if (!liked) {
            setAnimatingLike(postId);
            setTimeout(() => setAnimatingLike(null), 1200);
        }

        setPosts((prev) =>
            prev.map((p) =>
                p.id === postId
                    ? {
                        ...p,
                        liked_by_user: !liked,
                        likes_count: (p.likes_count ?? 0) + (liked ? -1 : 1),
                    }
                    : p
            )
        );

        try {
            if (liked) {
                const { error } = await supabase
                    .from("post_likes")
                    .delete()
                    .eq("post_id", postId)
                    .eq("user_id", userId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("post_likes").insert([
                    {
                        post_id: postId,
                        user_id: userId,
                    },
                ]);
                if (error) throw error;
            }
        } catch (err) {
            console.error("Like error:", err);
            toast.error("Failed to update like");
        }
    }

    async function submitComment(postId: string) {
        if (!supabase || !newComments[postId]?.trim()) return;

        const tempComment: Comment = {
            id: "temp-" + Date.now(),
            content: newComments[postId],
            created_at: new Date().toISOString(),
            profiles: currentProfile || { id: userId, username: "You", avatar_url: null },
        };

        setAnimatingComment(postId);
        setTimeout(() => setAnimatingComment(null), 400);

        setPosts((prev) =>
            prev.map((p) =>
                p.id === postId
                    ? {
                        ...p,
                        comments: [...(p.comments ?? []), tempComment],
                        comments_count: (p.comments_count ?? 0) + 1,
                    }
                    : p
            )
        );

        setNewComments((prev) => ({ ...prev, [postId]: "" }));

        await supabase.from("post_comments").insert([
            { post_id: postId, user_id: userId, content: tempComment.content.trim() },
        ]);
    }

    async function submitReply(commentId: string) {
        if (!supabase || !newReplies[commentId]?.trim()) return;

        const tempReply: Reply = {
            id: "temp-" + Date.now(),
            content: newReplies[commentId],
            created_at: new Date().toISOString(),
            profiles: currentProfile || { id: userId, username: "You", avatar_url: null },
        };

        setPosts((prev) =>
            prev.map((p) => ({
                ...p,
                comments: p.comments?.map((c) =>
                    c.id === commentId
                        ? { ...c, replies: [...(c.replies ?? []), tempReply] }
                        : c
                ),
            }))
        );

        setNewReplies((prev) => ({ ...prev, [commentId]: "" }));

        await supabase
            .from("comment_replies")
            .insert([{ comment_id: commentId, user_id: userId, content: tempReply.content.trim() }]);
    }

    async function handleDeletePost(postId: string) {
        if (!supabase) return;

        try {
            setConfirmDelete(null);

            setPosts((prev) =>
                prev.map((p) => (p.id === postId ? { ...p, _deleting: true } : p))
            );

            setTimeout(() => {
                setPosts((prev) => prev.filter((p) => p.id !== postId));
            }, 400);

            const { error } = await supabase
                .from("club_posts")
                .delete()
                .eq("id", postId)
                .eq("user_id", userId);

            if (error) {
                console.error("Delete error:", error);
                toast.error("Failed to delete post");
            } else {
                toast.success("Post deleted");
            }
        } catch (err) {
            console.error(err);
            toast.error("Something went wrong deleting this post");
        }
    }

    async function handleDeleteComment(commentId: string) {
        if (!supabase) return;
        setConfirmDeleteComment(null);

        try {
            await supabase.from("comment_replies").delete().eq("comment_id", commentId);

            const { error } = await supabase
                .from("post_comments")
                .delete()
                .eq("id", commentId);

            if (error) throw error;

            setPosts((prev) =>
                prev.map((p) => ({
                    ...p,
                    comments: p.comments?.filter((c) => c.id !== commentId),
                }))
            );
            toast.success("Comment deleted");
        } catch (err) {
            console.error("Failed to delete comment:", err);
            toast.error("Error deleting comment");
        }
    }

    async function handleDeleteReply(replyId: string, commentId: string) {
        if (!supabase) return;
        setConfirmDeleteReply(null);

        try {
            const { error } = await supabase
                .from("comment_replies")
                .delete()
                .eq("id", replyId);

            if (error) throw error;

            setPosts((prev) =>
                prev.map((p) => ({
                    ...p,
                    comments: p.comments?.map((c) =>
                        c.id === commentId
                            ? {
                                ...c,
                                replies: c.replies?.filter((r) => r.id !== replyId),
                            }
                            : c
                    ),
                }))
            );
            toast.success("Reply deleted");
        } catch (err) {
            console.error("Failed to delete reply:", err);
            toast.error("Error deleting reply");
        }
    }

    async function handleUpdatePost() {
        if (!supabase || !editingPost) return;

        const scoreNum = parseInt(editingPost.score || "0", 10);
        if (Number.isNaN(scoreNum)) return toast.error("Please enter a valid score.");
        if (editRoundMax && scoreNum > editRoundMax) {
            return toast.error(
                `${editingPost.round_name} has a maximum score of ${editRoundMax}.`
            );
        }

        if (editAvailableSpotTypes.length > 1 && !editingPost.spot_type) {
            return toast.error("Please select a spot type for this round.");
        }

        const needsSheet =
            isEditFormalOrComp &&
            !editingPost.existingScoresheetUrl &&
            !editingPost.newScoresheetFile;
        if (needsSheet) {
            return toast.error("A scoresheet is required for this type of score.");
        }

        let scoresheet_url = editingPost.existingScoresheetUrl ?? null;
        try {
            if (editingPost.newScoresheetFile) {
                const { data: auth } = await supabase.auth.getSession();
                const uid = auth?.session?.user?.id;
                if (!uid) return toast.error("Not authenticated.");
                const path = `${uid}/${Date.now()}_${editingPost.newScoresheetFile.name}`;
                const { data: up, error: upErr } = await supabase.storage
                    .from("scoresheets")
                    .upload(path, editingPost.newScoresheetFile);
                if (upErr) throw upErr;
                const { data: pub } = supabase.storage
                    .from("scoresheets")
                    .getPublicUrl(up.path);
                scoresheet_url = pub.publicUrl;
            }
        } catch (e) {
            console.error(e);
            return toast.error("Failed to upload scoresheet.");
        }

        const payload = {
            round_name: editingPost.round_name.trim(),
            bow_type: editingPost.bow_type,
            spot_type: editingPost.spot_type || "full size",
            score: scoreNum,
            golds: parseInt(editingPost.golds || "0", 10) || 0,
            score_date: editingPost.score_date,
            score_type: editingPost.score_type,
            competition_name:
                editingPost.score_type === "Competition"
                    ? editingPost.competition_name?.trim() || null
                    : null,
            scoresheet_url,
        };

        const { data, error } = await supabase
            .from("club_posts")
            .update(payload)
            .eq("id", editingPost.id)
            .eq("user_id", userId)
            .select(
                "id, round_name, bow_type, spot_type, score, golds, score_date, score_type, competition_name, scoresheet_url, is_club_record, is_personal_best"
            )
            .single();

        if (error) {
            console.error(error);
            return toast.error("Failed to update post.");
        }

        setPosts((prev) => prev.map((p) => (p.id === editingPost.id ? { ...p, ...data } : p)));
        closeEdit();
        toast.success("Post updated!");
    }

    if (!clubId) {
        return (
            <main className="flex flex-col items-center justify-center h-[70vh] text-center space-y-4 px-4">
                <div className="flex items-center gap-2 text-red-600">
                    <BowArrow className="w-8 h-8" />
                    <h1 className="text-2xl font-semibold">Club Membership Required</h1>
                </div>
                <p className="max-w-md text-muted-foreground">
                    You need to be part of a club to access tournament signups. Please join or request to join a
                    club first from the main page.
                </p>
                <Button onClick={() => (window.location.href = "/")}>Join a club</Button>
            </main>
        );
    }

    return (
        <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 space-y-6 pb-6 pt-3">
            {/* Top card */}
            <section className="bg-[hsl(var(--card))] border border-[hsl(var(--border))]/40 rounded-2xl p-5 sm:p-6 shadow-sm text-center">
                <motion.h1
                    className="text-xl sm:text-2xl font-semibold mb-4 flex items-center justify-center gap-2"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    <motion.div
                        initial={{ rotate: -10 }}
                        animate={{ rotate: [0, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    >
                        <BowArrow className="w-6 h-6 text-[hsl(var(--primary))]" />
                    </motion.div>
                    Club Feed
                </motion.h1>

                <p className="text-xs text-muted-foreground mb-4 sm:mb-5">
                    Share scores with your club, track PBs and celebrate records.
                </p>

                {/* Button container */}
                <div className="flex flex-col sm:flex-row sm:justify-center gap-3 w-full max-w-md mx-auto">
                    <button
                        onClick={() => router.push("/dashboard/new-score")}
                        className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-xl px-6 py-3 text-sm sm:text-base font-medium hover:opacity-90 transition w-full sm:w-auto"
                    >
                        Submit New Score
                    </button>

                    <button
                        onClick={() => router.push("/dashboard/club-records")}
                        className="inline-flex items-center justify-center gap-2 bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] rounded-xl px-6 py-3 text-sm sm:text-base font-medium hover:opacity-90 transition w-full sm:w-auto"
                    >
                        <Trophy size={18} />
                        View Club Records
                    </button>
                </div>
            </section>

            {loading ? (
                <p className="text-muted-foreground text-center py-10 text-sm">Loading feed...</p>
            ) : (
                posts.map((p) => (
                    <motion.article
                        key={p.id}
                        layout
                        animate={{
                            opacity: p._deleting ? 0 : 1,
                            y: p._deleting ? -10 : 0,
                        }}
                        transition={{ duration: 0.4 }}
                        className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))]/40 shadow-sm p-4 sm:p-6 mb-4 sm:mb-5 w-full"
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3 w-full gap-3">
                            <div className="flex flex-1 min-w-0 items-center gap-3">
                                <Link
                                    href={`/profile/${p.profiles?.id}`}
                                    className="flex items-center gap-3 group min-w-0"
                                >
                                    {p.profiles?.avatar_url ? (
                                        <div className="relative h-9 w-9 rounded-full overflow-hidden border border-[hsl(var(--border))]/40 flex-shrink-0">
                                            <Image
                                                src={p.profiles.avatar_url}
                                                alt={p.profiles.username}
                                                fill
                                                sizes="36px"
                                                className="object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-9 w-9 bg-gray-300 rounded-full flex items-center justify-center text-xs text-gray-600 flex-shrink-0">
                                            ?
                                        </div>
                                    )}
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-semibold text-blue-500 group-hover:underline truncate">
                                            {p.profiles?.username}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            submitted a score
                                        </span>
                                    </div>
                                </Link>
                            </div>

                            {/* Owner actions */}
                            {p.profiles?.id === userId && (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => openEdit(p)}
                                        className="text-muted-foreground hover:text-blue-500 transition"
                                        title="Edit this post"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(p.id)}
                                        className="text-muted-foreground hover:text-red-500 transition"
                                        title="Delete this post"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Score + tags */}
                        <div className="flex flex-col items-center text-center border-y border-[hsl(var(--border))]/40 py-4 mb-3 space-y-4">
                            <div className="flex flex-col items-center">
                                <p className="font-bold text-3xl text-foreground leading-none">
                                    {p.score}
                                </p>
                                <p className="uppercase text-[9px] text-muted-foreground/60 tracking-[0.18em] mt-1">
                                    score
                                </p>

                                {p.is_club_record && (
                                    <motion.div
                                        initial={{ scale: 0, rotate: -45, opacity: 0 }}
                                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 10,
                                            duration: 0.6,
                                        }}
                                        className="relative flex items-center gap-1 text-yellow-500 text-sm font-semibold mt-2"
                                    >
                                        <motion.div
                                            initial={{ scale: 0.8, rotate: -20 }}
                                            animate={{
                                                scale: [1.3, 1],
                                                rotate: [10, 0],
                                            }}
                                            transition={{ duration: 0.6, ease: "easeOut" }}
                                            className="relative flex items-center justify-center"
                                        >
                                            <Trophy size={22} className="text-yellow-400 drop-shadow-[0_0_6px_rgba(255,215,0,0.7)]" />
                                            <motion.div
                                                initial={{ opacity: 0.9, scale: 0.8, filter: "blur(8px) brightness(1.6)" }}
                                                animate={{
                                                    opacity: [0.9, 0.3, 0],
                                                    scale: [1, 1.3, 1.1],
                                                    filter: [
                                                        "blur(8px) brightness(1.6)",
                                                        "blur(10px) brightness(1.2)",
                                                        "blur(6px) brightness(1)",
                                                    ],
                                                }}
                                                transition={{ duration: 0.8, ease: "easeOut" }}
                                                className="absolute inset-0 rounded-full bg-yellow-300/60 blur-lg"
                                            />
                                            <motion.div
                                                initial={{ opacity: 0.4, scale: 1 }}
                                                animate={{
                                                    opacity: [0.3, 0.6, 0.3],
                                                    scale: [1, 1.07, 1],
                                                }}
                                                transition={{
                                                    duration: 2.5,
                                                    repeat: Infinity,
                                                    ease: "easeInOut",
                                                }}
                                                className="absolute inset-0 rounded-full blur-md bg-yellow-400/40"
                                                style={{
                                                    boxShadow:
                                                        "0 0 15px 4px rgba(255,215,0,0.35), 0 0 25px 6px rgba(255,230,120,0.25)",
                                                }}
                                            />
                                            <motion.div
                                                initial={{ opacity: 0.2, scale: 0.95 }}
                                                animate={{
                                                    opacity: [0.15, 0.4, 0.15],
                                                    scale: [0.95, 1.1, 0.95],
                                                }}
                                                transition={{
                                                    duration: 3.5,
                                                    repeat: Infinity,
                                                    ease: "easeInOut",
                                                }}
                                                className="absolute inset-0 rounded-full blur-xl bg-yellow-200/20"
                                            />
                                        </motion.div>

                                        <motion.span
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                        >
                                            New Club Record!
                                        </motion.span>
                                    </motion.div>
                                )}

                                {p.is_personal_best && (
                                    <motion.div
                                        initial={{ scale: 0, rotate: -45, opacity: 0 }}
                                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 10,
                                            duration: 0.6,
                                        }}
                                        className="relative flex items-center gap-1 text-green-500 text-sm font-semibold mt-2"
                                    >
                                        <motion.div
                                            initial={{ scale: 0.8, rotate: -10 }}
                                            animate={{ scale: [1.3, 1], rotate: [5, 0] }}
                                            transition={{ duration: 0.5, ease: "easeOut" }}
                                            className="relative flex items-center justify-center"
                                        >
                                            <Award size={20} className="text-green-400 drop-shadow-[0_0_6px_rgba(0,255,100,0.6)]" />
                                            <motion.div
                                                initial={{ opacity: 0.4 }}
                                                animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.05, 1] }}
                                                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                                className="absolute inset-0 rounded-full blur-md bg-green-400/30"
                                            />
                                        </motion.div>

                                        <motion.span
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                        >
                                            Personal Best!
                                        </motion.span>
                                    </motion.div>
                                )}
                            </div>

                            {/* Round + bowstyle */}
                            <motion.div
                                initial={false}
                                animate={false}
                                className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-8 w-full max-w-sm mx-auto justify-items-center"
                            >
                                <motion.div initial={false} animate={false} className="flex flex-col items-center w-full">
                                    <Link
                                        href={`/dashboard/club-records?round=${encodeURIComponent(p.round_name)}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center px-3 py-1.5 rounded-full w-full justify-center text-xs sm:text-sm
                border border-[hsl(var(--border))]/60
                bg-transparent text-[hsl(var(--primary))] font-medium
                hover:bg-[hsl(var(--muted))]/30 hover:border-[hsl(var(--primary))]/60 hover:underline
                transition cursor-pointer truncate"
                                    >
                                        {p.round_name}
                                    </Link>
                                    <p className="uppercase text-[9px] text-muted-foreground/50 tracking-[0.12em] mt-1">
                                        round
                                    </p>
                                </motion.div>

                                <motion.div initial={false} animate={false} className="flex flex-col items-center w-full">
                                    <span
                                        className={`px-4 py-1 rounded-full text-white text-xs sm:text-sm w-full max-w-[180px] text-center ${p.bow_type.toLowerCase() === "recurve"
                                                ? "bg-red-500"
                                                : p.bow_type.toLowerCase() === "compound"
                                                    ? "bg-blue-500"
                                                    : "bg-green-600"
                                            }`}
                                    >
                                        {p.bow_type}
                                    </span>
                                    <p className="uppercase text-[9px] text-muted-foreground/50 tracking-[0.12em] mt-1">
                                        bowstyle
                                    </p>
                                </motion.div>
                            </motion.div>
                        </div>

                        {/* Meta info */}
                        <div className="mt-3 text-center space-y-1 px-1">
                            {p.score_type === "Competition" && p.competition_name && (
                                <p className="text-sm font-medium text-[hsl(var(--primary))] flex items-center justify-center gap-1">
                                    <Trophy size={14} className="text-yellow-500" />
                                    {p.competition_name}
                                </p>
                            )}
                            {p.score_type && (
                                <p
                                    className={`text-xs font-medium ${p.score_type === "Competition"
                                            ? "text-yellow-500"
                                            : p.score_type === "Formal Practice"
                                                ? "text-blue-500"
                                                : "text-gray-400"
                                        }`}
                                >
                                    {p.score_type}
                                </p>
                            )}
                            {p.score_date && (
                                <p className="text-xs text-muted-foreground">
                                    {new Date(p.score_date).toLocaleDateString()}
                                </p>
                            )}
                            {p.scoresheet_url && (
                                <button
                                    onClick={() => setPreviewImage(p.scoresheet_url!)}
                                    className="text-xs text-blue-500 hover:underline flex items-center justify-center gap-1 mx-auto"
                                >
                                    <Camera size={14} />
                                    View Scoresheet
                                </button>
                            )}
                        </div>

                        {/* Likes / comments summary */}
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm w-full">
                            <div className="flex gap-4 items-center relative overflow-hidden">
                                <AnimatePresence>
                                    {animatingLike === p.id && (
                                        <motion.div
                                            key={`glow-${p.id}`}
                                            initial={{ scale: 0.4, opacity: 0.8 }}
                                            animate={{ scale: 5, opacity: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.8, ease: "easeOut" }}
                                            className="absolute left-[-15px] top-[-15px] w-12 h-12 rounded-full bg-red-500/70 blur-2xl z-0"
                                        />
                                    )}
                                </AnimatePresence>

                                <AnimatePresence>
                                    {animatingLike === p.id &&
                                        Array.from({ length: 7 }).map((_, i) => {
                                            const angle = Math.random() * Math.PI * 2;
                                            const distance = 60 + Math.random() * 30;
                                            const x = Math.cos(angle) * distance;
                                            const y = Math.sin(angle) * distance * -1;
                                            return (
                                                <motion.div
                                                    key={`burst-${p.id}-${i}`}
                                                    initial={{ opacity: 1, scale: 0.8, x: 0, y: 0, rotate: 0 }}
                                                    animate={{
                                                        opacity: 0,
                                                        scale: [0.8, 1.4, 1],
                                                        x,
                                                        y,
                                                        rotate: Math.random() * 180,
                                                    }}
                                                    transition={{
                                                        duration: 0.9 + Math.random() * 0.3,
                                                        ease: "easeOut",
                                                        delay: i * 0.05,
                                                    }}
                                                    className="absolute left-0 top-0 text-red-500"
                                                >
                                                    <Heart size={12 + Math.random() * 8} fill="currentColor" />
                                                </motion.div>
                                            );
                                        })}
                                </AnimatePresence>

                                <motion.button
                                    onClick={() => toggleLike(p.id, p.liked_by_user!)}
                                    animate={{
                                        scale: animatingLike === p.id ? [1, 1.6, 1.1, 1] : 1,
                                    }}
                                    transition={{
                                        duration: 0.5,
                                        ease: "easeInOut",
                                    }}
                                    className={`relative flex items-center gap-1 transition z-10 ${p.liked_by_user ? "text-red-500" : "text-blue-500 hover:text-blue-600"
                                        }`}
                                >
                                    <Heart size={20} fill={p.liked_by_user ? "currentColor" : "none"} />
                                    {p.likes_count} Like{p.likes_count === 1 ? "" : "s"}
                                </motion.button>

                                <div className="flex items-center gap-1 text-blue-500">
                                    <MessageCircle size={16} /> {p.comments_count} Comment
                                    {p.comments_count === 1 ? "" : "s"}
                                </div>
                            </div>

                            <span className="text-muted-foreground text-xs text-right">
                                {new Date(p.created_at).toLocaleDateString()}
                            </span>
                        </div>

                        {/* Comments */}
                        <AnimatePresence initial={false}>
                            {p.comments?.length! > 0 && (
                                <motion.div
                                    key={p.id + "-comments"}
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="mt-3 space-y-2 overflow-hidden"
                                >
                                    {(p.comments ?? [])
                                        .slice(0, expandedPost === p.id ? (p.comments?.length ?? 0) : 2)
                                        .map((c) => (
                                            <div key={c.id} className="group relative">
                                                <div className="flex items-start gap-2 text-sm text-muted-foreground flex-wrap bg-[hsl(var(--muted))]/10 rounded-xl px-3 py-2">
                                                    <div className="relative h-6 w-6 rounded-full overflow-hidden border border-[hsl(var(--border))]/40 flex-shrink-0 bg-gray-200">
                                                        {c.profiles?.avatar_url ? (
                                                            <Image
                                                                src={c.profiles.avatar_url}
                                                                alt={c.profiles.username || "User"}
                                                                fill
                                                                sizes="24px"
                                                                className="object-cover"
                                                            />
                                                        ) : (
                                                            <Image
                                                                src="/default-avatar.png"
                                                                alt="Default Avatar"
                                                                fill
                                                                sizes="24px"
                                                                className="object-cover"
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="break-words">
                                                            <span className="font-medium text-foreground">
                                                                {c.profiles?.username || "User"}
                                                            </span>
                                                            : {c.content}
                                                        </p>

                                                        {c.replies && c.replies.length > 0 && (
                                                            <div className="pl-6 mt-2 space-y-1">
                                                                {c.replies
                                                                    .slice(
                                                                        0,
                                                                        expandedComment === c.id ? c.replies.length : 2
                                                                    )
                                                                    .map((r) => (
                                                                        <div
                                                                            key={r.id}
                                                                            className="flex items-start gap-2 text-sm text-muted-foreground flex-wrap"
                                                                        >
                                                                            <CornerDownRight
                                                                                size={12}
                                                                                className="mt-1 text-gray-400 flex-shrink-0"
                                                                            />
                                                                            <div className="flex items-start gap-2 text-sm text-muted-foreground flex-wrap flex-1 min-w-0">
                                                                                {r.profiles?.avatar_url ? (
                                                                                    <div className="relative h-6 w-6 rounded-full overflow-hidden border border-[hsl(var(--border))]/40 flex-shrink-0">
                                                                                        <Image
                                                                                            src={r.profiles.avatar_url}
                                                                                            alt={r.profiles?.username || "Unknown User"}
                                                                                            fill
                                                                                            sizes="24px"
                                                                                            className="object-cover"
                                                                                        />
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="h-6 w-6 bg-gray-300 rounded-full flex items-center justify-center text-[10px] text-gray-600">
                                                                                        ?
                                                                                    </div>
                                                                                )}

                                                                                <div className="flex-1 min-w-0">
                                                                                    <span className="font-medium text-foreground">
                                                                                        {r.profiles?.username || "Unknown User"}
                                                                                    </span>
                                                                                    : {r.content}
                                                                                </div>
                                                                                {(r.profiles?.id === userId ||
                                                                                    currentProfile?.role === "admin") && (
                                                                                        <button
                                                                                            onClick={() => setConfirmDeleteReply(r.id)}
                                                                                            className="text-gray-400 hover:text-red-500 transition ml-1"
                                                                                            title="Delete reply"
                                                                                        >
                                                                                            <Trash2 size={12} />
                                                                                        </button>
                                                                                    )}
                                                                            </div>
                                                                        </div>
                                                                    ))}

                                                                {c.replies.length > 2 && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setExpandedComment((prev) =>
                                                                                prev === c.id ? null : c.id
                                                                            );
                                                                        }}
                                                                        className="text-xs text-blue-500 hover:underline"
                                                                    >
                                                                        {expandedComment === c.id
                                                                            ? "Hide replies"
                                                                            : "View all replies"}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-1 ml-auto">
                                                        <button
                                                            onClick={() => {
                                                                setExpandedComment(
                                                                    expandedComment === `reply-${c.id}` ? null : `reply-${c.id}`
                                                                );
                                                            }}
                                                            className="opacity-60 group-hover:opacity-100 transition text-blue-500 hover:text-blue-600"
                                                            title="Reply"
                                                        >
                                                            <CornerDownRight size={16} />
                                                        </button>

                                                        {(c.profiles?.id === userId ||
                                                            currentProfile?.role === "admin") && (
                                                                <button
                                                                    onClick={() => setConfirmDeleteComment(c.id)}
                                                                    className="opacity-60 group-hover:opacity-100 transition text-gray-400 hover:text-red-500"
                                                                    title="Delete comment"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                    </div>
                                                </div>

                                                <AnimatePresence>
                                                    {expandedComment === `reply-${c.id}` && (
                                                        <motion.div
                                                            key={`reply-input-${c.id}`}
                                                            initial={{ opacity: 0, y: -5 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -5 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="
        flex flex-wrap gap-2 pl-8 mt-2 items-center
        w-full
    "
                                                        >
                                                            <input
                                                                type="text"
                                                                placeholder="Write a reply..."
                                                                value={newReplies[c.id] || ""}
                                                                onChange={(e) =>
                                                                    setNewReplies((prev) => ({
                                                                        ...prev,
                                                                        [c.id]: e.target.value,
                                                                    }))
                                                                }
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter" && newReplies[c.id]?.trim()) {
                                                                        e.preventDefault();
                                                                        submitReply(c.id);
                                                                        setExpandedComment(null);
                                                                    }
                                                                }}
                                                                className="flex-1 rounded-lg border border-[hsl(var(--border))]/40 px-3 py-1 text-sm bg-[hsl(var(--muted))]/10"
                                                            />

                                                            <button
                                                                onClick={() => {
                                                                    submitReply(c.id);
                                                                    setExpandedComment(null);
                                                                }}
                                                                disabled={!newReplies[c.id]?.trim()}
                                                                className="rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-1 text-sm hover:opacity-90 disabled:opacity-50"
                                                            >
                                                                Send
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setNewReplies((prev) => ({
                                                                        ...prev,
                                                                        [c.id]: "",
                                                                    }));
                                                                    setExpandedComment(null);
                                                                }}
                                                                className="text-gray-400 hover:text-red-500 transition text-sm"
                                                                title="Cancel reply"
                                                            >
                                                                ✕
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}

                                    {(p.comments?.length ?? 0) > 2 && (
                                        <button
                                            onClick={() =>
                                                setExpandedPost((prev) => (prev === p.id ? null : p.id))
                                            }
                                            className="flex items-center text-xs text-blue-500 hover:underline mt-1"
                                        >
                                            {expandedPost === p.id ? "Hide comments" : "View all comments"}
                                            <ChevronDown
                                                size={14}
                                                className={`ml-1 transition-transform duration-200 ${expandedPost === p.id ? "rotate-180" : ""
                                                    }`}
                                            />
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Main Comment Input */}
                        <motion.div
                            key={`comment-input-${p.id}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                scale: animatingComment === p.id ? [1, 1.05, 1] : 1,
                            }}
                            transition={{
                                opacity: { duration: 0.25 },
                                y: { duration: 0.25 },
                                scale: { duration: 0.4 },
                            }}
                            className="mt-3 space-y-2 w-full"
                        >
                            <div className="flex items-center gap-2 w-full rounded-xl border border-[hsl(var(--border))]/40 bg-[hsl(var(--muted))]/15 px-3 py-1.5">
                                <input
                                    type="text"
                                    placeholder="Add a comment..."
                                    value={newComments[p.id] || ""}
                                    onChange={(e) =>
                                        setNewComments((prev) => ({
                                            ...prev,
                                            [p.id]: e.target.value,
                                        }))
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && newComments[p.id]?.trim()) {
                                            e.preventDefault();
                                            submitComment(p.id);
                                        }
                                    }}
                                    className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm"
                                />

                                {newComments[p.id] && (
                                    <button
                                        onClick={() =>
                                            setNewComments((prev) => ({
                                                ...prev,
                                                [p.id]: "",
                                            }))
                                        }
                                        className="text-gray-400 hover:text-red-500 text-sm"
                                        title="Clear"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => {
                                        submitComment(p.id);
                                        setAnimatingComment(p.id);
                                        setTimeout(() => setAnimatingComment(null), 400);
                                    }}
                                    disabled={!newComments[p.id]?.trim()}
                                    className="rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium disabled:opacity-50"
                                >
                                    Post
                                </button>
                            </div>
                        </motion.div>
                    </motion.article>
                ))
            )}

            {/* Delete confirmation modal */}
            <AnimatePresence>
                {confirmDelete && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="bg-[hsl(var(--card))] rounded-xl shadow-lg border border-[hsl(var(--border))]/50 p-6 max-w-sm text-center w-[90%]"
                        >
                            <h2 className="text-lg font-semibold mb-2 text-[hsl(var(--foreground))]">
                                Delete this post?
                            </h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                                This will permanently remove the post and all its comments.
                            </p>

                            <div className="flex justify-center gap-3">
                                <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="px-4 py-2 rounded-md bg-[hsl(var(--muted))]/30 text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeletePost(confirmDelete)}
                                    className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Comment Modal */}
            <AnimatePresence>
                {confirmDeleteComment && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="bg-[hsl(var(--card))] rounded-xl shadow-lg border border-[hsl(var(--border))]/50 p-6 max-w-sm text-center w-[90%]"
                        >
                            <h2 className="text-lg font-semibold mb-2">Delete this comment?</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                                This will permanently remove the comment and its replies.
                            </p>
                            <div className="flex justify-center gap-3">
                                <button
                                    onClick={() => setConfirmDeleteComment(null)}
                                    className="px-4 py-2 rounded-md bg-[hsl(var(--muted))]/30 hover:bg-[hsl(var(--muted))]/50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteComment(confirmDeleteComment)}
                                    className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Reply Modal */}
            <AnimatePresence>
                {confirmDeleteReply && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="bg-[hsl(var(--card))] rounded-xl shadow-lg border border-[hsl(var(--border))]/50 p-6 max-w-sm text-center w-[90%]"
                        >
                            <h2 className="text-lg font-semibold mb-2">Delete this reply?</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                                This action cannot be undone.
                            </p>
                            <div className="flex justify-center gap-3">
                                <button
                                    onClick={() => setConfirmDeleteReply(null)}
                                    className="px-4 py-2 rounded-md bg-[hsl(var(--muted))]/30 hover:bg-[hsl(var(--muted))]/50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteReply(confirmDeleteReply, expandedComment!)}
                                    className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Post Modal */}
            <AnimatePresence>
                {editingPost && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeEdit}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-[hsl(var(--card))] rounded-xl shadow-lg border border-[hsl(var(--border))]/50 p-5 w-full max-w-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-lg font-semibold mb-3">Edit Post</h2>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm mb-1">Round</label>
                                    <RoundNameSelect
                                        value={editingPost.round_name}
                                        onChange={(val) =>
                                            setEditingPost((prev) => (prev ? { ...prev, round_name: val } : prev))
                                        }
                                    />
                                    {editRoundMax && (
                                        <p className="text-xs text-muted-foreground mt-1">Max: {editRoundMax}</p>
                                    )}
                                </div>

                                {editAvailableSpotTypes.length > 1 && (
                                    <div>
                                        <label className="block text-sm mb-1">Spot Type</label>
                                        <select
                                            value={editingPost.spot_type}
                                            onChange={(e) =>
                                                setEditingPost((prev) =>
                                                    prev ? { ...prev, spot_type: e.target.value } : prev
                                                )
                                            }
                                            className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                                        >
                                            <option value="">Select Spot Type</option>
                                            {editAvailableSpotTypes.map((s) => (
                                                <option key={s} value={s}>
                                                    {s === "triple" ? "Triple Spot" : "Full Size"}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm mb-1">Bow Type</label>
                                    <select
                                        value={editingPost.bow_type}
                                        onChange={(e) =>
                                            setEditingPost((prev) =>
                                                prev ? { ...prev, bow_type: e.target.value } : prev
                                            )
                                        }
                                        className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                                    >
                                        <option>Recurve</option>
                                        <option>Compound</option>
                                        <option>Barebow</option>
                                        <option>Longbow</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm mb-1">Score</label>
                                        <input
                                            type="number"
                                            value={editingPost.score}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (editRoundMax && parseInt(val) > editRoundMax) {
                                                    toast.error(
                                                        `${editingPost.round_name} has a maximum score of ${editRoundMax}.`
                                                    );
                                                    return;
                                                }
                                                setEditingPost((prev) => (prev ? { ...prev, score: val } : prev));
                                            }}
                                            className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                                            min={0}
                                            max={editRoundMax ?? undefined}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">Golds</label>
                                        <input
                                            type="number"
                                            value={editingPost.golds}
                                            onChange={(e) =>
                                                setEditingPost((prev) =>
                                                    prev ? { ...prev, golds: e.target.value } : prev
                                                )
                                            }
                                            className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm mb-1">Date</label>
                                        <input
                                            type="date"
                                            value={editingPost.score_date}
                                            onChange={(e) =>
                                                setEditingPost((prev) =>
                                                    prev ? { ...prev, score_date: e.target.value } : prev
                                                )
                                            }
                                            className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">Score Type</label>
                                        <select
                                            value={editingPost.score_type ?? "Informal Practice"}
                                            onChange={(e) =>
                                                setEditingPost((prev) =>
                                                    prev
                                                        ? {
                                                            ...prev,
                                                            score_type: e.target.value as Post["score_type"],
                                                        }
                                                        : prev
                                                )
                                            }
                                            className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                                        >
                                            <option>Informal Practice</option>
                                            <option>Formal Practice</option>
                                            <option>Competition</option>
                                        </select>
                                    </div>
                                </div>

                                {editingPost.score_type === "Competition" && (
                                    <div>
                                        <label className="block text-sm mb-1">
                                            Competition Name (optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={editingPost.competition_name}
                                            onChange={(e) =>
                                                setEditingPost((prev) =>
                                                    prev ? { ...prev, competition_name: e.target.value } : prev
                                                )
                                            }
                                            className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                                        />
                                    </div>
                                )}

                                {isEditFormalOrComp && (
                                    <div>
                                        <label className="block text-sm mb-1">
                                            Scoresheet{" "}
                                            {editingPost.existingScoresheetUrl ? "(attached)" : "(required)"}
                                        </label>
                                        {editingPost.existingScoresheetUrl && (
                                            <p className="text-xs text-muted-foreground mb-1">
                                                A scoresheet is already attached. Upload to replace.
                                            </p>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) =>
                                                setEditingPost((prev) =>
                                                    prev
                                                        ? {
                                                            ...prev,
                                                            newScoresheetFile: e.target.files?.[0] || null,
                                                        }
                                                        : prev
                                                )
                                            }
                                            className="w-full text-sm"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    onClick={closeEdit}
                                    className="px-4 py-2 rounded-md bg-[hsl(var(--muted))]/30 hover:bg-[hsl(var(--muted))]/50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdatePost}
                                    className="px-4 py-2 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Scoresheet Preview Modal */}
            <AnimatePresence>
                {previewImage && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setPreviewImage(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="relative bg-[hsl(var(--card))] rounded-xl shadow-lg border border-[hsl(var(--border))]/50 p-3 max-w-2xl w-[90%] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="absolute top-2 right-2 text-white bg-black/40 rounded-full p-1 hover:bg-black/60 transition"
                            >
                                ✕
                            </button>

                            <Image
                                src={previewImage}
                                alt="Scoresheet"
                                width={800}
                                height={800}
                                className="w-full h-auto rounded-lg object-contain max-h-[80vh] mx-auto"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}