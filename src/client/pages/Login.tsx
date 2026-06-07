import { useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";
import { Button } from "../components/Button.tsx";
import { Field, Input } from "../components/Input.tsx";
import { IconBook, IconBolt } from "../components/Icons.tsx";
import "../styles/login.css";

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const u = username.trim();
      const p = password;
      if (!u) {
        setError("请输入账号");
        return;
      }
      if (!p) {
        setError("请输入密码");
        return;
      }
      setLoading(true);
      try {
        await login(u, p);
        nav(loc.state?.from ?? "/", { replace: true });
      } catch (e) {
        const msg = (e as Error).message;
        setError(/401/.test(msg) ? "用户名或密码错误" : msg);
      } finally {
        setLoading(false);
      }
    },
    [username, password, login, nav, loc],
  );

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-brand">
          <div className="logo">
            <IconBook size={20} />
          </div>
          <div>
            <h1>小说爬虫</h1>
            <p>开发者控制台</p>
          </div>
        </div>
        <div className="login-hero-decor" />
      </div>
      <form className="login-form" onSubmit={submit} noValidate>
        <h2>登录</h2>
        <p className="login-sub">使用账号密码进入控制台</p>
        <Field label="账号">
          <Input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (error) setError(null);
            }}
            autoFocus
            autoComplete="username"
            placeholder="admin"
            aria-invalid={error === "请输入账号"}
          />
        </Field>
        <Field label="密码">
          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            autoComplete="current-password"
            placeholder="admin123"
            aria-invalid={error === "请输入密码"}
          />
        </Field>
        {error && (
          <div className="login-error" role="alert" aria-live="polite">
            {error}
          </div>
        )}
        <Button type="submit" variant="primary" loading={loading} className="login-submit">
          登录
        </Button>
        <div className="login-hint">
          <div className="login-hint-title">
            <IconBolt size={11} /> 测试账号
          </div>
          <div className="login-hint-grid">
            <code>admin / admin123</code>
            <code>user / user123</code>
            <code>demo / demo123</code>
          </div>
        </div>
      </form>
    </div>
  );
}
