import { useLayoutEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigationType, type Location } from "react-router-dom";

const scrollPositions = new Map<string, number>();

function resetRouteScroll() {
  const root = document.scrollingElement || document.documentElement;
  root.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  document.querySelectorAll<HTMLElement>("[data-route-scroll]").forEach(element => {
    element.scrollTop = 0;
    element.scrollLeft = 0;
  });
}

function restoreScroll(position: number) {
  window.scrollTo({ top: position, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = position;
  document.body.scrollTop = position;
}

type PageShellProps = {
  location: Location;
  navigationType: ReturnType<typeof useNavigationType>;
  children: ReactNode;
};

function PageShell({ location, navigationType, children }: PageShellProps) {
  const reduceMotion = useReducedMotion();
  const frame = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const cached = scrollPositions.get(location.key);

    if (navigationType === "POP" && cached !== undefined) {
      restoreScroll(cached);
    } else {
      resetRouteScroll();
    }

    let animationFrame = 0;
    const save = () => {
      animationFrame = 0;
      scrollPositions.set(location.key, window.scrollY);
    };
    const onScroll = () => {
      if (!animationFrame) animationFrame = requestAnimationFrame(save);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    save();

    const retryTop = window.setTimeout(() => {
          if (location.hash) return;
          if (navigationType === "POP" && cached !== undefined) restoreScroll(cached);
          else resetRouteScroll();
        }, 120);

    const retryHeight = window.setTimeout(() => {
      if (navigationType === "POP" && cached !== undefined) restoreScroll(cached);
    }, 360);

    return () => {
      scrollPositions.set(location.key, window.scrollY);
      window.removeEventListener("scroll", onScroll);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      window.clearTimeout(retryTop);
      window.clearTimeout(retryHeight);
    };
  }, [location.key, navigationType]);

  useLayoutEffect(() => {
      if (!location.hash) return;
          let id = location.hash.slice(1);
          try { id = decodeURIComponent(id); } catch { /* keep the raw fragment */ }
          if (!id) return;
      const timer = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ block: "start" });
      }, 90);
      return () => window.clearTimeout(timer);
    }, [location.hash]);

  return (
    <motion.div
      ref={frame}
      className="route-frame"
      variants={
        reduceMotion
          ? {
              initial: { opacity: 1 },
              animate: { opacity: 1 },
              exit: { opacity: 0, transition: { duration: 0 } },
            }
          : {
              initial: { opacity: 0, y: 18, scale: 0.997 },
              animate: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
              },
              exit: {
                opacity: 0,
                y: -12,
                scale: 0.998,
                transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
              },
            }
      }
      initial="initial"
            animate="animate"
            exit="exit"
            onAnimationComplete={() => {
              if (frame.current) frame.current.style.transform = "none";
            }}
          >
            {children}
          </motion.div>
  );
}

export function AnimatedRoutes({ children }: { children: (location: Location) => ReactNode }) {
  const location = useLocation();
  const navigationType = useNavigationType();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageShell key={location.pathname} location={location} navigationType={navigationType}>
        {children(location)}
      </PageShell>
    </AnimatePresence>
  );
}