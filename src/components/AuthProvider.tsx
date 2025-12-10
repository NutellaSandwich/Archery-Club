"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

const AuthContext = createContext<{ session: Session | null }>({ session: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const supabase = supabaseBrowser();

    useEffect(() => {
        // 🔥 Typing the result of getSession()
        supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
            setSession(result.data.session);
        });

        // 🔥 Fully typed auth listener
        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event: AuthChangeEvent, newSession: Session | null) => {
                setSession(newSession);
            }
        );

        return () => {
            listener.subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ session }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}