import { Link } from "react-router-dom";
import { Button } from "../components/Button.tsx";
import { EmptyState } from "../components/AppShell.tsx";
import { IconEmpty } from "../components/Icons.tsx";

export function NotFound() {
  return (
    <div style={{ padding: "40px 0" }}>
      <EmptyState
        icon={<IconEmpty size={28} />}
        title="页面不存在"
        desc={`你访问的路径未匹配到任何路由。可能是链接拼错，或者该页面已被移除。`}
        hint="404 · page not found"
        action={
          <Link to="/" style={{ textDecoration: "none" }}>
            <Button variant="primary">回到控制台</Button>
          </Link>
        }
      />
    </div>
  );
}
