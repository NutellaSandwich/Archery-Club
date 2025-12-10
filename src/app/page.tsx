"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/card";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  LogIn,
  UserPlus,
  Users,
  Building,
  ArrowLeft,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";

export default function Home() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [modalType, setModalType] = useState<
    null | "individual" | "joinClub" | "createClub"
  >(null);

  const [loading, setLoading] = useState(true);

  /* ----------------------------------------------
      CHECK SESSION
  ----------------------------------------------- */
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.club_id) {
        router.replace("/dashboard");
      } else {
        setLoading(false);
      }
    }
    checkSession();
  }, [router, supabase]);

  if (loading)
    return (
      <p className="text-center mt-20 text-muted-foreground">Loading...</p>
    );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* TITLE */}
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent drop-shadow-sm"
      >
        Arcus
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="text-muted-foreground text-sm mt-2"
      >
        Manage your club, track your progress, and connect with other archers.
      </motion.p>

      {/* UNDERLINE */}
      <div className="w-40 h-1 mt-3 rounded-full bg-gradient-to-r from-emerald-500/40 via-sky-500/40 to-emerald-500/40"></div>

      {/* SIGNUP OPTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mt-10 w-full">
        <SignupOption
          icon={<UserPlus size={18} className="text-emerald-500" />}
          title="Join as Individual"
          description="£5/year for independent archers."
          action={() => setModalType("individual")}
        />

        <SignupOption
          icon={<Users size={18} className="text-sky-500" />}
          title="Join a Club"
          description="Join your club using a code."
          action={() => setModalType("joinClub")}
        />

        <SignupOption
          icon={<Building size={18} className="text-yellow-500" />}
          title="Create a Club"
          description="£5/month, £10/3 months, £40/year."
          action={() => setModalType("createClub")}
        />
      </div>

      {/* LOGIN + THEME */}
      <div className="flex flex-col items-center gap-3 mt-8">
        <Link href="/login">
          <Button
            variant="outline"
            className="flex items-center gap-2 rounded-xl"
          >
            <LogIn size={16} /> Login
          </Button>
        </Link>

        <ThemeToggle />
      </div>

      {/* MODAL */}
      <AnimatePresence>
        {modalType && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalType(null)}
          >
            <motion.div
              className="
                bg-background/90 backdrop-blur-md p-6 rounded-2xl 
                border border-border/50 shadow-xl w-full max-w-md
              "
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
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
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="
        group relative rounded-2xl border border-border/60 
        bg-muted/40 p-6 shadow-sm hover:bg-muted/60 
        transition cursor-pointer overflow-hidden
      "
      onClick={action}
    >
      {/* Glow */}
      <div
        className="
          absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-40
          bg-gradient-to-br from-emerald-500/20 via-sky-500/20 to-emerald-500/20
          blur-xl transition-opacity duration-300 pointer-events-none
        "
      ></div>

      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-lg font-semibold">
          {icon} {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground mb-4">{description}</p>

        <Button
          className="
            w-full rounded-xl 
            bg-gradient-to-r from-emerald-600 to-sky-500 text-white 
            hover:opacity-90
          "
        >
          Continue
        </Button>
      </CardContent>
    </motion.div>
  );
}

/* -------------------- SIGNUP FLOW -------------------- */

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

  const [account, setAccount] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [form, setForm] = useState({
    username: "",
    dob: "",
    agb_number: "",
    category: "Open",
    experience: "Novice",
    club_code: "",
    club_name: "",
    join_code: "",
    subscription_tier: "month",
  });

  /* ----------------------------------------------
      CHECK EXISTING LOGIN → Skip Step 1
  ----------------------------------------------- */
  useEffect(() => {
    async function checkLoggedIn() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) setStep(2);
    }
    checkLoggedIn();
  }, [supabase]);

  /* ----------------------------------------------
      STEP 1 — Create/Login Account
  ----------------------------------------------- */
  async function handleAccountAction() {
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
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

    // SIGNUP FLOW
    if (!account.email.includes("@")) {
      toast.error("Enter a valid email.");
      setLoading(false);
      return;
    }
    if (account.password !== account.confirmPassword) {
      toast.error("Passwords do not match.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: account.email.trim(),
      password: account.password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        toast.info("Account already exists — logging you in...");
        const attempt = await supabase.auth.signInWithPassword({
          email: account.email.trim(),
          password: account.password,
        });

        if (attempt.error) {
          toast.error("Wrong password.");
          setLoading(false);
          return;
        }

        toast.success("Logged in!");
        setStep(2);
        setLoading(false);
        return;
      }

      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Account created!");
    setStep(2);
    setLoading(false);
  }

  /* ----------------------------------------------
      STEP 2 — Profile & Club Handling
  ----------------------------------------------- */
  async function handleFinish() {
    setLoading(true);

    let { data: sessionData } = await supabase.auth.getSession();
    let session = sessionData.session;

    if (!session) {
      const refreshed = await supabase.auth.getSession();
      session = refreshed.data.session;
    }

    if (!session?.user) {
      toast.error("Please verify your email first.");
      setLoading(false);
      return;
    }

    const user = session.user;

    // Ensure profile row exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      await supabase.from("profiles").insert([{ id: user.id }]);
    }

    // INDIVIDUAL SIGNUP
    if (type === "individual") {
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);

      await supabase
        .from("profiles")
        .update({
          username: form.username.trim(),
          dob: form.dob || null,
          agb_number: form.agb_number || null,
          category: form.category,
          experience: form.experience,
          payment_status: "paid",
          membership_expires_at: expiry.toISOString(),
        })
        .eq("id", user.id);

      toast.success("Welcome to Arcus!");
    }

    // JOIN CLUB
    if (type === "joinClub") {
      const { data: club } = await supabase
        .from("clubs")
        .select("id, name")
        .ilike("join_code", form.club_code.trim())
        .maybeSingle();

      if (!club) {
        toast.error("Invalid join code.");
        setLoading(false);
        return;
      }

      await supabase.from("join_requests").insert({
        user_id: user.id,
        club_id: club.id,
        username: form.username.trim(),
        dob: form.dob || null,
        agb_number: form.agb_number || null,
        category: form.category,
        experience: form.experience,
      });

      await supabase
        .from("profiles")
        .update({
          username: form.username.trim(),
          dob: form.dob || null,
          agb_number: form.agb_number || null,
          category: form.category,
          experience: form.experience,
        })
        .eq("id", user.id);

      toast.success("Join request sent!");
    }

    // CREATE CLUB
    if (type === "createClub") {
      const { data: inserted } = await supabase
        .from("clubs")
        .insert([
          {
            name: form.club_name,
            join_code: form.join_code,
            subscription_tier: form.subscription_tier,
            created_by: user.id,
          },
        ])
        .select("*");

      if (!inserted?.length) {
        toast.error("Club creation failed.");
        setLoading(false);
        return;
      }

      await supabase
        .from("profiles")
        .update({
          club_id: inserted[0].id,
          username: form.username.trim(),
          dob: form.dob,
          agb_number: form.agb_number,
          category: form.category,
          experience: form.experience,
        })
        .eq("id", user.id);

      toast.success("Club created successfully!");
    }

    setLoading(false);
    onClose();
    router.replace("/dashboard");
  }

  /* ---------------------------------------------------
      UI — FULLY RESTYLED ARCUS DESIGN
  ---------------------------------------------------- */

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={step === 1 ? onClose : () => setStep(1)}
          className="rounded-full"
        >
          <ArrowLeft size={16} />
        </Button>

        <h2 className="text-xl font-semibold bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">
          {step === 1
            ? isLogin
              ? "Log In"
              : "Create Account"
            : type === "individual"
              ? "Individual Signup"
              : type === "joinClub"
                ? "Join a Club"
                : "Create a Club"}
        </h2>
      </div>

      {/* ------------------------------------------
           STEP 1 — ACCOUNT CREDENTIALS
      ------------------------------------------- */}
      {step === 1 && (
        <>
          <div className="space-y-4">

            <Input
              placeholder="Email"
              type="email"
              value={account.email}
              onChange={(e) =>
                setAccount({ ...account, email: e.target.value })
              }
            />

            <Input
              placeholder="Password"
              type="password"
              value={account.password}
              onChange={(e) =>
                setAccount({ ...account, password: e.target.value })
              }
            />

            {!isLogin && (
              <>
                <Input
                  placeholder="Confirm Password"
                  type="password"
                  value={account.confirmPassword}
                  onChange={(e) =>
                    setAccount({
                      ...account,
                      confirmPassword: e.target.value,
                    })
                  }
                />
              </>
            )}

            <Button
              onClick={handleAccountAction}
              disabled={loading}
              className="
                w-full rounded-xl 
                bg-gradient-to-r from-emerald-600 to-sky-500 
                text-white hover:opacity-90
              "
            >
              {loading
                ? isLogin
                  ? "Logging in..."
                  : "Creating..."
                : isLogin
                  ? "Login"
                  : "Next"}
            </Button>

            <p className="text-sm text-muted-foreground">
              {isLogin ? (
                <>
                  No account?{" "}
                  <button
                    className="text-primary underline"
                    onClick={() => setIsLogin(false)}
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already registered?{" "}
                  <button
                    className="text-primary underline"
                    onClick={() => setIsLogin(true)}
                  >
                    Log in
                  </button>
                </>
              )}
            </p>
          </div>
        </>
      )}

      {/* ------------------------------------------
           STEP 2 — PROFILE + CLUB DETAILS
      ------------------------------------------- */}
      {step === 2 && (
        <div className="space-y-4">

          {/* USERNAME */}
          <Input
            placeholder="Username"
            value={form.username}
            onChange={(e) =>
              setForm({ ...form, username: e.target.value })
            }
          />

          {/* DOB */}
          <Input
            type="date"
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
          />

          {/* AGB NUMBER */}
          <Input
            placeholder="AGB Number (optional)"
            value={form.agb_number}
            onChange={(e) =>
              setForm({ ...form, agb_number: e.target.value })
            }
          />

          {/* CATEGORY */}
          <select
            className="w-full rounded-md border p-2 bg-background"
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
          >
            <option>Open</option>
            <option>Women</option>
          </select>

          {/* EXPERIENCE */}
          <select
            className="w-full rounded-md border p-2 bg-background"
            value={form.experience}
            onChange={(e) =>
              setForm({ ...form, experience: e.target.value })
            }
          >
            <option>Novice</option>
            <option>Experienced</option>
          </select>

          {/* JOIN CLUB */}
          {type === "joinClub" && (
            <Input
              placeholder="Club Join Code"
              value={form.club_code}
              onChange={(e) =>
                setForm({ ...form, club_code: e.target.value })
              }
            />
          )}

          {/* CREATE CLUB */}
          {type === "createClub" && (
            <>
              <Input
                placeholder="Club Name"
                value={form.club_name}
                onChange={(e) =>
                  setForm({ ...form, club_name: e.target.value })
                }
              />

              <Input
                placeholder="Club Join Code"
                value={form.join_code}
                onChange={(e) =>
                  setForm({ ...form, join_code: e.target.value })
                }
              />

              <select
                className="w-full rounded-md border p-2 bg-background"
                value={form.subscription_tier}
                onChange={(e) =>
                  setForm({
                    ...form,
                    subscription_tier: e.target.value,
                  })
                }
              >
                <option value="month">£5 / month</option>
                <option value="3months">£10 / 3 months</option>
                <option value="year">£40 / year</option>
              </select>
            </>
          )}

          <Button
            onClick={handleFinish}
            disabled={loading}
            className="
              w-full rounded-xl 
              bg-gradient-to-r from-emerald-600 to-sky-500 
              text-white hover:opacity-90
            "
          >
            {loading ? "Submitting..." : "Finish Signup"}
          </Button>

          <Button
            variant="ghost"
            className="w-full mt-2"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}