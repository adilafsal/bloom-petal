import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  id?: string;
  as?: "div" | "section";
};

export function Reveal({ children, className, delay = 0, y = 28, id, as = "div" }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const props = {
    id,
    className,
    initial: reduceMotion ? false : { opacity: 0, y },
    whileInView: reduceMotion ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.16 },
    transition: { duration: 0.62, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  };

  return as === "section" ? <motion.section {...props}>{children}</motion.section> : <motion.div {...props}>{children}</motion.div>;
}

type AnimatedNumberProps = {
  value: number;
  format?: (value: number) => string;
  duration?: number;
  className?: string;
};

export function AnimatedNumber({ value, format, duration = 0.85, className }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const formatRef = useRef(format ?? ((next: number) => String(Math.round(next))));
  formatRef.current = format ?? ((next: number) => String(Math.round(next)));
  const [display, setDisplay] = useState(() => formatRef.current(reduceMotion ? value : 0));

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(formatRef.current(value));
      return;
    }

    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: latest => setDisplay(formatRef.current(latest)),
    });

    return () => controls.stop();
  }, [value, duration, reduceMotion]);

  return <span className={className}>{display}</span>;
}