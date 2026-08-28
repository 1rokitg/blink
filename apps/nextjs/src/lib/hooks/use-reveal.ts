"use client";

import { useEffect, useRef } from "react";

/**
 * Adds the `is-visible` class to elements with the `reveal` class when they
 * enter the viewport. Returns a ref to attach to a container; any `.reveal`
 * descendants (or the element itself) animate in once.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current ?? document;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    if (ref.current && ref.current.classList.contains("reveal")) {
      nodes.push(ref.current);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return ref;
}