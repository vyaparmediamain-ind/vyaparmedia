"use client";

import { useState, useEffect, type RefObject } from "react";

export function useChartWidth(containerRef: RefObject<HTMLElement | null>, defaultWidth: number = 300) {
  const [chartsReady, setChartsReady] = useState(false);
  const [chartWidth, setChartWidth] = useState(defaultWidth);

  useEffect(() => {
    const id = window.setTimeout(() => setChartsReady(true), 50);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!chartsReady || !containerRef.current) return;

    const handleResize = () => {
      if (containerRef.current) {
        setChartWidth(containerRef.current.getBoundingClientRect().width || defaultWidth);
      }
    };

    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [chartsReady, containerRef, defaultWidth]);

  return { chartsReady, chartWidth };
}
