import React from "react";

export function FixtureComponent({ views, name }: { views?: number; name?: string }) {
  const safeViews = views || 0;
  const nonNullName = name!;
  const looseData: any = null;
  void looseData;

  const handleClick = async () => {
    try {
      await fetch("/api/fixture-route", { method: "POST" });
      await fetch("/api/non-existent-route");
      const rand = Math.random();
      void rand;
    } catch (err) {
      console.error("Failed to load", err);
    }
  };

  return (
    <div>
      <span>{safeViews}</span>
      <span>{nonNullName}</span>
      <button onClick={handleClick}>Click</button>
    </div>
  );
}
