import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
// @ts-ignore
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
// @ts-ignore
import type { Profile } from '@/types/types';
import { toast } from 'sonner';

// 并发请求去重池，避免组件重渲染或初次挂载时对同一用户重复并发请求造成网络拥塞
const profilePromiseMap = new Map<string, Promise<Profile | null>>();

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!userId) return null;
  if (profilePromiseMap.has(userId)) {
    return profilePromiseMap.get(userId)!;
  }

  const task = (async (): Promise<Profile | null> => {
    // 带温和重试机制，平滑应对沙箱重载或网络短暂抖动
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.warn('获取用户信息返回错误:', error.message);
          return null;
        }
        return data;
      } catch (err) {
        if (attempt === 0) {
          await new Promise((res) => setTimeout(res, 300));
          continue;
        }
        console.warn('获取用户信息异常 (网络连接波动):', err);
        return null;
      }
    }
    return null;
  })().finally(() => {
    // 延迟清理去重缓存，既合并突发重复并发请求，又保持后续可刷新
    setTimeout(() => {
      profilePromiseMap.delete(userId);
    }, 600);
  });

  profilePromiseMap.set(userId, task);
  return task;
}
interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string, nickname: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const profileData = await getProfile(user.id);
    setProfile(profileData);
  };

  useEffect(() => {
    let isMounted = true;

    // In this function, do NOT use any await calls. Use `.then()` instead to avoid deadlocks.
    // onAuthStateChange 会在初次挂载时自动派发当前会话，避免与 getSession 双重并发冲突
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        getProfile(currentUser.id)
          .then((p) => {
            if (isMounted) setProfile(p);
          })
          .catch(() => {
            if (isMounted) setProfile(null);
          })
          .finally(() => {
            if (isMounted) setLoading(false);
          });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUpWithUsername = async (username: string, password: string, nickname: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nickname: nickname.trim() || '同学' } },
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, signInWithUsername, signUpWithUsername, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
