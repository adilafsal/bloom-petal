import type { ReactNode } from "react";

export default function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-page"><div className="auth-layout"><section className="auth-visual"><img src="https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=85" alt="Seasonal flowers gathered at the Bloom & Petal flower shop"/><div><span className="eyebrow">BLOOM & PETAL · DUBAI</span><p>For life's little moments,<br/><em>made beautiful.</em></p></div></section>{children}</div></main>;
}
