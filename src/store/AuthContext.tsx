import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { Role } from "../types";
import { beginTiming, reportTiming } from "../utils/performance";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
}
interface AuthStore {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const Context = createContext<AuthStore | null>(null);
const DEMO_KEY = "cm-office-demo-auth";
const demoUser: AuthUser = {
  id: "demo-admin",
  name: "ณัฐพล",
  email: "admin@example.co.th",
  role: "admin",
  department: "IT",
};
const demoProfiles: Record<string, AuthUser> = {
  admin: demoUser,
  staff: {
    id: "demo-staff",
    name: "กมลชนก วิเศษ",
    email: "staff@example.co.th",
    role: "staff",
    department: "ST",
  },
  issuer: {
    id: "demo-issuer",
    name: "สุภาวดี มีสุข",
    email: "issuer@example.co.th",
    role: "issuer",
    department: "AC",
  },
  fulfiller: {
    id: "demo-fulfiller",
    name: "เจ้าหน้าที่เบิกของ",
    email: "fulfiller@example.co.th",
    role: "fulfiller",
    department: "ST",
  },
  viewer: {
    id: "demo-viewer",
    name: "สุภาวดี มีสุข",
    email: "viewer@example.co.th",
    role: "viewer",
    department: "AC",
  },
};
const readDemoUser = (): AuthUser | null => {
  const saved = sessionStorage.getItem(DEMO_KEY);
  if (saved === "signed-out") return null;
  if (!saved || saved === "signed-in") return demoUser;
  try {
    const parsed = JSON.parse(saved) as AuthUser;
    return parsed?.role
      ? {
          ...demoProfiles[parsed.role],
          ...parsed,
          department: parsed.department ?? demoProfiles[parsed.role].department,
        }
      : demoUser;
  } catch {
    return demoUser;
  }
};

let profileCache: { token: string; promise: Promise<AuthUser | null> } | null =
  null;

function profileFromSession(session: Session | null): Promise<AuthUser | null> {
  if (!session || !supabase) return Promise.resolve(null);
  if (profileCache?.token === session.access_token) return profileCache.promise;
  const startedAt = beginTiming();
  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,role,is_active,department")
        .eq("id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.is_active === false) return null;
      return {
        id: session.user.id,
        name: data.full_name ?? session.user.email ?? "ผู้ใช้งาน",
        email: session.user.email ?? "",
        role: (data.role ?? "viewer") as Role,
        department: data.department ?? "",
      };
    } finally {
      reportTiming("auth profile", startedAt);
    }
  })();
  profileCache = { token: session.access_token, promise };
  void promise.catch(() => {
    if (profileCache?.promise === promise) profileCache = null;
  });
  return promise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() =>
    !isSupabaseConfigured ? readDemoUser() : null,
  );
  const [loading, setLoading] = useState(isSupabaseConfigured);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    let lastSessionKey: string | undefined;
    const applySession = async (session: Session | null) => {
      const sessionKey = session?.access_token ?? "signed-out";
      if (sessionKey === lastSessionKey) return;
      lastSessionKey = sessionKey;
      try {
        const profile = await profileFromSession(session);
        if (active) setUser(profile);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .catch(() => {
        if (active) {
          setUser(null);
          setLoading(false);
        }
      });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const value = useMemo<AuthStore>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => {
        if (!supabase) {
          const normalized = email.trim().toLowerCase();
          const role: Role = normalized.startsWith("issuer")
            ? "issuer"
            : normalized.startsWith("fulfiller")
              ? "fulfiller"
              : normalized.startsWith("viewer")
                ? "viewer"
                : normalized.startsWith("staff")
                  ? "staff"
                  : "admin";
          const demo = {
            ...demoProfiles[role],
            email: normalized || demoProfiles[role].email,
          };
          sessionStorage.setItem(DEMO_KEY, JSON.stringify(demo));
          setUser(demo);
          return;
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        const profile = await profileFromSession(data.session);
        if (!profile) {
          await supabase.auth.signOut();
          throw new Error("บัญชีนี้ถูกระงับหรือยังไม่มีข้อมูลผู้ใช้งาน");
        }
        setUser(profile);
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        sessionStorage.setItem(DEMO_KEY, "signed-out");
        setUser(null);
      },
    }),
    [user, loading],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAuth = () => {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider missing");
  return value;
};
