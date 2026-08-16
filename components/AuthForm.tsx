"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLogin = mode === "login";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setError(result.error ?? "暂时无法完成，请稍后重试。");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("网络连接失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary-soft">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-normal text-white">{isLogin ? "登录 RationalTrade" : "创建账号"}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {isLogin ? "继续记录计划、操作与独立复盘。" : "使用邮箱和密码建立你的独立交易记录空间。"}
          </p>
        </div>

        <form onSubmit={submit} className="rt-card space-y-5 p-5">
          <label className="block">
            <span className="rt-label">邮箱</span>
            <span className="relative mt-2 block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="rt-input pl-10"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="rt-label">密码</span>
            <span className="relative mt-2 block">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="rt-input px-10"
                type={showPassword ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isLogin ? "输入密码" : "至少 8 位"}
                minLength={8}
                required
              />
              <button
                type="button"
                title={showPassword ? "隐藏密码" : "显示密码"}
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition active:bg-surface-raised"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          {error ? <p className="rounded-lg border border-sell/60 bg-red-950/60 px-3 py-2 text-sm text-red-100">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "处理中" : isLogin ? "登录" : "注册并登录"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {isLogin ? "还没有账号？" : "已经有账号？"}
          <a className="ml-2 font-semibold text-primary-soft" href={isLogin ? "/register" : "/login"}>
            {isLogin ? "注册" : "登录"}
          </a>
        </p>
      </div>
    </main>
  );
}
