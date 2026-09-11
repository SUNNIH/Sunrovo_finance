"use client";

import * as React from "react";

interface LocalGreetingProps {
  firstName: string;
}

/**
 * Device-local time-based greeting that updates automatically.
 * Uses the user's browser/device time (not server time) to display:
 * - "Good morning" (00:00–11:59)
 * - "Good afternoon" (12:00–17:59)
 * - "Good evening" (18:00–23:59)
 */
export function LocalGreeting({ firstName }: LocalGreetingProps) {
  // Use "Hello" as safe initial to avoid hydration mismatch
  const [greeting, setGreeting] = React.useState("Hello");

  React.useEffect(() => {
    function updateGreeting() {
      const hour = new Date().getHours();
      
      if (hour >= 0 && hour < 12) {
        setGreeting("Good morning");
      } else if (hour >= 12 && hour < 18) {
        setGreeting("Good afternoon");
      } else {
        setGreeting("Good evening");
      }
    }

    // Set greeting immediately on mount
    updateGreeting();

    // Update every minute to catch time boundary changes
    const interval = setInterval(updateGreeting, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {greeting}, {firstName}
    </>
  );
}
