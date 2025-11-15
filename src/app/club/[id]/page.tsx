"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import Image from "next/image";
import { toast } from "sonner";
import {
    Heart,
    MessageCircle,
    Send,
    Trash2,
    ImagePlus,
    RotateCcw,
    X,
} from "lucide-react";

type Club = {
    id: string;
    name: string;
    description: string | null;
};

type Post = {
    id: string;
    user_id: string;
    round_name: string;
    bow_type: string;
    score: number;
    golds: number;
    score_type: string;
    image_url: string | null;
    created_at: string;
    profiles?: { username: string | null; avatar_url: string | null };
    likes_count?: number;
    comments_count?: number;
    liked_by_user?: boolean;
};

type Comment = {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles?: { username: string | null };
};

export default function ClubPage() {
    const { id } = useParams();
    const supabase = supabaseBrowser();

    const [club, setClub] = useState<Club | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [userClubId, setUserClubId] = useState<string | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [comments, setComments] = useState<Record<string, Comment[]>>({});
    const [newComments, setNewComments] = useState<Record<string, string>>({});
    const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // 🧾 New post form
    const [newPost, setNewPost] = useState({
        round_name: "",
        bow_type: "Recurve",
        score: "",
        golds: "",
        image: null as File | null,
    });

    const isMember = userClubId === id;

    // 🔁 Fetch all club posts
    async function fetchPosts(showToast: boolean = false) {
        try {
            setRefreshing(true);
            const { data: postsData } = await supabase
                .from("club_posts")
                .select("*, profiles(username, avatar_url)")
                .eq("club_id", id)
                .order("created_at", { ascending: false });

            if (!postsData) return;

            const enriched = await Promise.all(
                postsData.map(async (post) => {
                    const { count: likes } = await supabase
                        .from("post_likes")
                        .select("*", { count: "exact", head: true })
                        .eq("post_id", post.id);

                    const { count: comments } = await supabase
                        .from("post_comments")
                        .select("*", { count: "exact", head: true })
                        .eq("post_id", post.id);

                    const { data: liked } = await supabase
                        .from("post_likes")
                        .select("id")
                        .eq("post_id", post.id)
                        .eq("user_id", userId)
                        .maybeSingle();

                    return {
                        ...post,
                        likes_count: likes || 0,
                        comments_count: comments || 0,
                        liked_by_user: !!liked,
                    };
                })
            );

            setPosts(enriched);
            if (showToast) toast.success("Feed refreshed!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to refresh posts.");
        } finally {
            setRefreshing(false);
        }
    }

    // 🚀 Initial load
    useEffect(() => {
        async function init() {
            if (!id) return;

            const { data: clubData } = await supabase
                .from("clubs")
                .select("*")
                .eq("id", id)
                .single();
            setClub(clubData);

            const {
                data: { session },
            } = await supabase.auth.getSession();
            const user = session?.user;
            setUserId(user?.id ?? null);

            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("club_id")
                    .eq("id", user.id)
                    .maybeSingle();
                setUserClubId(profile?.club_id ?? null);
            }

            await fetchPosts();
            setLoading(false);
        }

        init();
    }, [id, supabase, userId]);

    // 💬 Load comments for a specific post
    async function loadComments(postId: string) {
        const { data } = await supabase
            .from("post_comments")
            .select("*, profiles(username)")
            .eq("post_id", postId)
            .order("created_at", { ascending: true });
        setComments((prev) => ({ ...prev, [postId]: data || [] }));
    }

    // ❤️ Like/unlike
    async function handleLike(postId: string, liked: boolean) {
        if (!userId) return toast.error("Please log in first.");
        if (liked) {
            await supabase
                .from("post_likes")
                .delete()
                .eq("post_id", postId)
                .eq("user_id", userId);
        } else {
            await supabase
                .from("post_likes")
                .insert({ post_id: postId, user_id: userId });
        }
        await fetchPosts();
    }

    // 🗨️ Toggle comments
    async function toggleComments(postId: string) {
        const isOpen = openComments[postId];
        setOpenComments((prev) => ({ ...prev, [postId]: !isOpen }));
        if (!isOpen && !comments[postId]) {
            await loadComments(postId);
        }
    }

    // ✉️ Submit comment
    async function handleCommentSubmit(postId: string) {
        if (!userId) return toast.error("Please log in first.");
        const content = newComments[postId]?.trim();
        if (!content) return;
        await supabase.from("post_comments").insert({
            post_id: postId,
            user_id: userId,
            content,
        });
        setNewComments((prev) => ({ ...prev, [postId]: "" }));
        await loadComments(postId);
        await fetchPosts();
    }

    // 🗑️ Delete Post
    async function handleDeletePost(postId: string, image_url?: string | null) {
        if (!confirm("Are you sure you want to delete this post?")) return;
        const { error } = await supabase.from("club_posts").delete().eq("id", postId);
        if (!error && image_url) {
            const path = image_url.split("/score-images/")[1];
            if (path) await supabase.storage.from("score-images").remove([path]);
        }
        toast.success("Post deleted.");
        await fetchPosts();
    }

    // 🆕 Create Post
    async function handleCreatePost(e: React.FormEvent) {
        e.preventDefault();
        if (!userId || !isMember) return toast.error("You must be a club member to post.");
        setCreating(true);

        try {
            let imageUrl = null;
            if (newPost.image) {
                const ext = newPost.image.name.split(".").pop();
                const path = `club-posts/${userId}/${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from("score-images")
                    .upload(path, newPost.image);
                if (uploadError) throw uploadError;
                imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/score-images/${path}`;
            }

            const { error } = await supabase.from("club_posts").insert([
                {
                    user_id: userId,
                    club_id: id,
                    round_name: newPost.round_name,
                    bow_type: newPost.bow_type,
                    score: parseInt(newPost.score),
                    golds: parseInt(newPost.golds || "0"),
                    score_type: "Practice",
                    image_url: imageUrl,
                },
            ]);

            if (error) throw error;
            toast.success("Post shared!");
            setNewPost({ round_name: "", bow_type: "Recurve", score: "", golds: "", image: null });
            await fetchPosts();
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to create post.");
        } finally {
            setCreating(false);
        }
    }

    if (loading)
        return (
            <main className="flex min-h-screen items-center justify-center text-muted-foreground">
                Loading club feed...
            </main>
        );

    return (
        <main className="max-w-2xl mx-auto mt-10 px-4 space-y-8 transition-colors duration-300">
            {/* Club Header */}
            {club && (
                <header className="text-center mb-4">
                    <h1 className="text-3xl font-bold mb-2">{club.name}</h1>
                    <p className="text-sm text-muted-foreground mb-3">
                        {club.description || "No club description yet."}
                    </p>
                    <button
                        onClick={() => fetchPosts(true)}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 text-sm rounded-full px-4 py-1.5 bg-[hsl(var(--primary))]/10 hover:bg-[hsl(var(--primary))]/20 border border-[hsl(var(--border))]/30 transition-colors"
                    >
                        <RotateCcw
                            size={16}
                            className={`transition-transform ${refreshing ? "animate-spin text-[hsl(var(--primary))]" : ""
                                }`}
                        />
                        {refreshing ? "Refreshing..." : "Refresh Feed"}
                    </button>
                </header>
            )}

            {/* New Post */}
            {isMember && (
                <form
                    onSubmit={handleCreatePost}
                    className="rounded-2xl border border-[hsl(var(--border))]/40 bg-[hsl(var(--card))] shadow-sm p-5 space-y-4"
                >
                    <h2 className="font-semibold text-lg">Share a new round 🎯</h2>
                    <input
                        type="text"
                        placeholder="Round name"
                        value={newPost.round_name}
                        onChange={(e) => setNewPost({ ...newPost, round_name: e.target.value })}
                        className="w-full rounded-md border border-[hsl(var(--border))]/40 bg-[hsl(var(--muted))]/20 px-3 py-2"
                        required
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="number"
                            placeholder="Score"
                            value={newPost.score}
                            onChange={(e) => setNewPost({ ...newPost, score: e.target.value })}
                            className="rounded-md border border-[hsl(var(--border))]/40 bg-[hsl(var(--muted))]/20 px-3 py-2"
                            required
                        />
                        <input
                            type="number"
                            placeholder="Golds"
                            value={newPost.golds}
                            onChange={(e) => setNewPost({ ...newPost, golds: e.target.value })}
                            className="rounded-md border border-[hsl(var(--border))]/40 bg-[hsl(var(--muted))]/20 px-3 py-2"
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-sm text-blue-500 hover:text-blue-600">
                        <ImagePlus size={16} /> Upload Image
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                                setNewPost({ ...newPost, image: e.target.files?.[0] ?? null })
                            }
                            className="hidden"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={creating}
                        className="w-full rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] py-2 font-medium hover:opacity-90 transition-all disabled:opacity-60"
                    >
                        {creating ? "Posting..." : "Share Post"}
                    </button>
                </form>
            )}

            {/* Posts Feed */}
            {posts.length === 0 ? (
                <div className="text-center text-muted-foreground">
                    No posts yet — be the first to share your scores!
                </div>
            ) : (
                posts.map((post) => (
                    <article
                        key={post.id}
                        className="rounded-2xl border border-[hsl(var(--border))]/40 bg-[hsl(var(--card))] shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]/30">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shadow-inner">
                                    {post.profiles?.username?.[0]?.toUpperCase() ?? "?"}
                                </div>
                                <div>
                                    <p className="font-medium">{post.profiles?.username || "Archer"}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(post.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {userId === post.user_id && (
                                <button
                                    onClick={() => handleDeletePost(post.id, post.image_url)}
                                    className="text-red-500 hover:text-red-600"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>

                        <div className="px-5 py-4 space-y-3">
                            <p className="text-base leading-snug">
                                <strong className="text-[hsl(var(--primary))]">
                                    {post.round_name}
                                </strong>{" "}
                                – {post.score} pts, {post.golds} golds
                            </p>
                            {post.image_url && (
                                <div className="relative group mt-3">
                                    <Image
                                        src={post.image_url}
                                        alt="score"
                                        width={500}
                                        height={300}
                                        className="rounded-lg border border-[hsl(var(--border))]/40 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Reactions */}
                        <div className="flex items-center gap-5 px-5 py-3 border-t border-[hsl(var(--border))]/30 text-sm">
                            <button
                                onClick={() => handleLike(post.id, post.liked_by_user!)}
                                className={`flex items-center gap-1 transition-colors ${post.liked_by_user
                                        ? "text-red-500"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <Heart size={16} /> {post.likes_count ?? 0}
                            </button>

                            <button
                                onClick={() => toggleComments(post.id)}
                                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <MessageCircle size={16} /> {post.comments_count ?? 0}
                            </button>
                        </div>

                        {/* 💬 Comments Section */}
                        {openComments[post.id] && (
                            <div className="px-5 pb-4 border-t border-[hsl(var(--border))]/30 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-medium text-sm">Comments</h4>
                                    <button
                                        onClick={() =>
                                            setOpenComments((p) => ({ ...p, [post.id]: false }))
                                        }
                                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                    >
                                        <X size={12} /> Close
                                    </button>
                                </div>

                                {comments[post.id]?.length ? (
                                    comments[post.id].map((c) => (
                                        <div
                                            key={c.id}
                                            className="border border-[hsl(var(--border))]/20 rounded-md px-3 py-2 text-sm"
                                        >
                                            <p className="font-medium text-[hsl(var(--primary))]">
                                                {c.profiles?.username || "User"}
                                            </p>
                                            <p>{c.content}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {new Date(c.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground">No comments yet.</p>
                                )}

                                {/* Add comment */}
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleCommentSubmit(post.id);
                                    }}
                                    className="flex gap-2 mt-2"
                                >
                                    <input
                                        type="text"
                                        placeholder="Write a comment..."
                                        value={newComments[post.id] || ""}
                                        onChange={(e) =>
                                            setNewComments((prev) => ({
                                                ...prev,
                                                [post.id]: e.target.value,
                                            }))
                                        }
                                        className="flex-1 rounded-md border border-[hsl(var(--border))]/40 px-3 py-1 text-sm"
                                    />
                                    <button
                                        type="submit"
                                        className="p-2 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-all"
                                    >
                                        <Send size={14} />
                                    </button>
                                </form>
                            </div>
                        )}
                    </article>
                ))
            )}
        </main>
    );
}