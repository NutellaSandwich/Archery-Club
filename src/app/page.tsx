"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogIn, UserPlus, Users, Building, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";

export default function Home() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [modalType, setModalType] = useState<null | "individual" | "joinClub" | "createClub">(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        setLoading(false);
        return;
      }

      // 🔍 Check if the logged-in user belongs to a club
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        setLoading(false);
        return;
      }

      if (profile?.club_id) {
        // ✅ User is in a club → go to dashboard
        router.replace("/dashboard");
      } else {
        // 🚫 Logged in but no club → stay here to let them join/create one
        setLoading(false);
      }
    }

    checkSession();
  }, [router, supabase]);

  if (loading) return <p className="text-center mt-20 text-muted-foreground">Loading...</p>;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 space-y-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Archery Club</h1>
      <p className="text-muted-foreground text-sm">
        Manage your club, track your progress, and connect with other archers.
      </p>

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mt-6">
        <SignupOption
          icon={<UserPlus className="text-blue-500" size={18} />}
          title="Join as Individual"
          description="£5/year for independent archers."
          action={() => setModalType("individual")}
        />
        <SignupOption
          icon={<Users className="text-green-500" size={18} />}
          title="Join a Club"
          description="Join your club with a unique code."
          action={() => setModalType("joinClub")}
        />
        <SignupOption
          icon={<Building className="text-yellow-500" size={18} />}
          title="Create a Club"
          description="£5/month, £10/3 months, or £40/year."
          action={() => setModalType("createClub")}
        />
      </div>

      <div className="flex flex-col items-center gap-3 mt-6">
        <Link href="/login">
          <Button variant="outline" className="flex items-center gap-2">
            <LogIn size={16} /> Login
          </Button>
        </Link>
        <ThemeToggle />
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalType && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalType(null)}
          >
            <motion.div
              className="bg-[hsl(var(--card))] rounded-xl p-6 max-w-md w-full border border-[hsl(var(--border))]/40"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <SignupFlow type={modalType} onClose={() => setModalType(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function SignupOption({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: () => void;
}) {
  return (
    <Card className="p-6 border border-[hsl(var(--border))]/40">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-lg font-semibold">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Button onClick={action} className="w-full">
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

/* -------------------- SIGNUP FLOW -------------------- */

function SignupFlow({
  type,
  onClose,
}: {
  type: "individual" | "joinClub" | "createClub";
  onClose: () => void;
}) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState({ email: "", password: "" });
  const [form, setForm] = useState({
    full_name: "",
    dob: "",
    agb_number: "",
    category: "Open",
    experience: "Novice",
    club_code: "",
    club_name: "",
    join_code: "",
    subscription_tier: "month",
  });

  // ✅ Skip account creation if already logged in
  useEffect(() => {
    async function checkLoggedIn() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setStep(2);
      }
    }
    checkLoggedIn();
  }, [supabase]);

  // 🔹 Step 1: Signup or Login
  // 🔹 Step 1: Signup or Login
  async function handleAccountAction() {
    setLoading(true);

    if (isLogin) {
      // ✅ Login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: account.email.trim(),
        password: account.password,
      });

      if (error) {
        toast.error(error.message || "Login failed");
        setLoading(false);
        return;
      }

      toast.success("Logged in successfully!");
      setStep(2);
      setLoading(false);
      return;
    }

    if (!account.email || !account.email.includes("@")) {
      toast.error("Please enter a valid email address.");
      setLoading(false);
      return;
    }
    if (!account.password || account.password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    console.log("🧠 Attempting signup", {
      email: account.email.trim(),
      passwordLength: account.password?.length,
      redirect: `${window.location.origin}/dashboard`,
    });

    // ✅ Signup — safely handle existing user case
    const { data, error } = await supabase.auth.signUp({
      email: account.email.trim(),
      password: account.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      // 🧩 Check for “already registered” case
      if (error.message?.toLowerCase().includes("already registered")) {
        toast.info("Account already exists. Logging you in...");
        // Attempt login instead
        const { data: loginData, error: loginError } =
          await supabase.auth.signInWithPassword({
            email: account.email.trim(),
            password: account.password,
          });

        if (loginError) {
          toast.error("Login failed — please check your password.");
          setLoading(false);
          return;
        }

        toast.success("Logged in successfully!");
        setStep(2);
        setLoading(false);
        return;
      }

      toast.error(error.message || "Signup failed.");
      setLoading(false);
      return;
    }

    // ✅ Successful signup
    toast.success("Account created!");
    setStep(2);
    setLoading(false);
  }

  // 🔹 Step 2: Complete profile details
  async function handleFinish() {
    setLoading(true);

    // 🧠 Ensure we actually have a session
    let {
      data: { session },
    } = await supabase.auth.getSession();

    // Wait briefly if session isn't yet available
    if (!session) {
      // Try to refresh
      const { data: refreshed } = await supabase.auth.getSession();
      session = refreshed?.session;
    }

    // 🚨 Still no session → likely email confirmation required
    if (!session?.user) {
      toast.error(
        "Please verify your email before continuing, or log in again."
      );
      setLoading(false);
      return;
    }

    const user = session.user;

    // Ensure profile exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      const { error: insertError } = await supabase
        .from("profiles")
        .insert([{ id: user.id }]);

      if (insertError) {
        toast.error("Failed to create profile record.");
        setLoading(false);
        return;
      }
    }

    // 🧍 INDIVIDUAL SIGNUP
    if (type === "individual") {
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);

      const cleanDob = form.dob ? form.dob : null;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          dob: cleanDob,
          agb_number: form.agb_number?.trim() || null,
          category: form.category,
          experience: form.experience,
          payment_status: "paid",
          membership_expires_at: expiry.toISOString(),
        })
        .eq("id", user.id);

      if (error) toast.error(`Failed to complete signup: ${error.message}`);
      else toast.success("Welcome! You’re now an individual member.");
    }

    // 🏹 JOIN CLUB
    if (type === "joinClub") {
      const { data: club, error: clubError } = await supabase
        .from("clubs")
        .select("id, name")
        .ilike("join_code", form.club_code.trim())
        .maybeSingle();

      if (clubError) {
        toast.error("Error checking club code.");
        setLoading(false);
        return;
      }

      if (!club) {
        toast.error("Invalid club code.");
        setLoading(false);
        return;
      }

      const cleanDob = form.dob ? form.dob : null;

      const { error: joinError } = await supabase.from("join_requests").insert([
        {
          user_id: user.id,
          club_id: club.id,
          message: `${form.full_name} (${form.category}, ${form.experience})`,
          full_name: form.full_name.trim(),
          dob: cleanDob,
          agb_number: form.agb_number?.trim() || null,
          category: form.category,
          experience: form.experience,
        },
      ]);

      if (joinError) {
        console.error("Join request insert failed:", joinError);
        toast.error("Failed to send join request.");
        setLoading(false);
        return;
      }

      console.log("🧠 Updating profile when joining club", {
        id: user.id,
        full_name: form.full_name.trim(),
        dob: cleanDob,
        agb_number: form.agb_number?.trim() || null,
        category: form.category,
        experience: form.experience,
      });
      
      await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          username: form.full_name.trim(), // ✅ display name
          dob: cleanDob,
          agb_number: form.agb_number?.trim() || null,
          category: form.category,
          experience: form.experience,
        })
        .eq("id", user.id);

      toast.success("Join request sent to club admins!");
    }

    // 🏛️ CREATE CLUB
    if (type === "createClub") {
      // 1️⃣ Create the club
      const { data: insertedClubs, error: clubError } = await supabase
        .from("clubs")
        .insert([
          {
            name: form.club_name,
            join_code: form.join_code,
            subscription_tier: form.subscription_tier,
            created_by: user.id,
          },
        ])
        .select("*"); // ✅ Ensure we actually get the inserted club row

      if (clubError || !insertedClubs?.length) {
        toast.error("Failed to create club.");
        console.error(clubError);
        setLoading(false);
        return;
      }

      const clubData = insertedClubs[0];

      console.log("🧠 Updating profiles with payload:", {
        id: user.id,
        club_id: clubData.id,
        full_name: form.full_name,
        dob: form.dob,
        agb_number: form.agb_number,
        category: form.category,
        experience: form.experience,
      });

      // 2️⃣ Update profile to link to new club
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          club_id: clubData.id,
          full_name: form.full_name.trim(),
          username: form.full_name.trim(), // ✅ display name
          dob: form.dob,
          agb_number: form.agb_number || null,
          category: form.category,
          experience: form.experience,
        })
        .eq("id", user.id);

      if (profileError) {
        console.error(profileError);
        toast.error("Club created but failed to update your profile.");
        setLoading(false);
        return;
      }

      toast.success(`Club "${clubData.name}" created successfully!`);
    }

    setLoading(false);
    onClose();
    router.replace("/dashboard");
  }
  // ✨ RENDER
  return (
    <div>
      {step === 1 ? (
        <>
          <h2 className="text-xl font-semibold mb-4">
            {isLogin ? "Login to Continue" : "Create Account"}
          </h2>

          <div className="space-y-3">
            <Input
              placeholder="Email"
              type="email"
              value={account.email}
              onChange={(e) => setAccount({ ...account, email: e.target.value })}
            />
            <Input
              placeholder="Password"
              type="password"
              value={account.password}
              onChange={(e) => setAccount({ ...account, password: e.target.value })}
            />

            <Button onClick={handleAccountAction} className="w-full" disabled={loading}>
              {loading
                ? isLogin
                  ? "Logging in..."
                  : "Creating..."
                : isLogin
                  ? "Login"
                  : "Next"}
            </Button>

            <p className="text-sm text-muted-foreground mt-2">
              {isLogin ? (
                <>
                  Don’t have an account?{" "}
                  <button
                    className="text-primary underline"
                    onClick={() => setIsLogin(false)}
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    className="text-primary underline"
                    onClick={() => setIsLogin(true)}
                  >
                    Log in instead
                  </button>
                </>
              )}
            </p>
          </div>

          <Button variant="ghost" className="mt-3 w-full" onClick={onClose}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          {/* Step 2 */}
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              <ArrowLeft size={16} />
            </Button>
            <h2 className="text-xl font-semibold">
              {type === "individual"
                ? "Individual Signup"
                : type === "joinClub"
                  ? "Join a Club"
                  : "Create a Club"}
            </h2>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
            <Input
              type="date"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
            <Input
              placeholder="AGB Number (optional)"
              value={form.agb_number}
              onChange={(e) => setForm({ ...form, agb_number: e.target.value })}
            />
            <select
              className="w-full rounded-md border p-2 bg-background"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option>Open</option>
              <option>Women</option>
            </select>
            <select
              className="w-full rounded-md border p-2 bg-background"
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
            >
              <option>Novice</option>
              <option>Experienced</option>
            </select>

            {type === "joinClub" && (
              <Input
                placeholder="Club Code"
                value={form.club_code}
                onChange={(e) => setForm({ ...form, club_code: e.target.value })}
              />
            )}

            {type === "createClub" && (
              <>
                <Input
                  placeholder="Club Name"
                  value={form.club_name}
                  onChange={(e) => setForm({ ...form, club_name: e.target.value })}
                />
                <Input
                  placeholder="Club Join Code"
                  value={form.join_code}
                  onChange={(e) => setForm({ ...form, join_code: e.target.value })}
                />
                <select
                  className="w-full rounded-md border p-2 bg-background"
                  value={form.subscription_tier}
                  onChange={(e) =>
                    setForm({ ...form, subscription_tier: e.target.value })
                  }
                >
                  <option value="month">£5 / month</option>
                  <option value="3months">£10 / 3 months</option>
                  <option value="year">£40 / year</option>
                </select>
              </>
            )}

            <Button onClick={handleFinish} disabled={loading} className="w-full">
              {loading ? "Submitting..." : "Finish Signup"}
            </Button>
          </div>

          <Button variant="ghost" className="mt-3 w-full" onClick={onClose}>
            Cancel
          </Button>
        </>
      )}
    </div>
  );
}