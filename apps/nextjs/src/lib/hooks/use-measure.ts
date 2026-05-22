import { useRef, useEffect, useState } from "react";

export function useMeasure() {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateDimensions = () => {
      setWidth(element.offsetWidth);
      setHeight(element.offsetHeight);
    };

    // Initial measurement
    updateDimensions();

    // Watch for size changes
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, []);

  return [ref, { width, height }] as const;
}
