"use client";

import * as React from "react";
import { Button } from "@/app/components/ui/button";
import { Calendar } from "@/app/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { format, isBefore, startOfDay } from "date-fns";
import { ChevronDownIcon } from "lucide-react";

interface DatePickerProps {
  birthday: Date | null;
  setBirthday: (date: Date) => void;
}

/**
 * Fixes Next.js hydration mismatch warnings by:
 * - Avoids calling Date or formatting date during SSR/initial render.
 * - Uses a client-only effect to safely set `today`.
 * - Only renders the interactive date UI once the component is mounted on client.
 *
 * This prevents server vs client mismatches from Date/formatting.
 */
export function DatePicker({ birthday, setBirthday }: DatePickerProps) {
  // State to safely store 'today' after mounting on the client
  const [today, setToday] = React.useState<Date | null>(null);

  // Hydration-safe: only set today's date after mounting (on client)
  React.useEffect(() => {
    setToday(startOfDay(new Date()));
  }, []);

  // Don't render anything until mounted and today is available (prevents hydration mismatch)
  if (!today) {
    return (
      <Button
        disabled
        variant="outline"
        className="w-[150px] justify-between rounded-md bg-transparent border-none outline-none shadow-none hover:bg-white/10 hover:text-neutral-300 text-left font-semibold text-neutral-300"
      >
        <span>Pick a date</span>
        <ChevronDownIcon />
      </Button>
    );
  }

  // Calculate default month (now safe!)
  const defaultMonth =
    birthday && isBefore(startOfDay(birthday), today)
      ? today
      : (birthday ?? today);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!birthday}
          className="w-[150px] justify-between rounded-md bg-transparent border-none outline-none shadow-none hover:bg-white/10 hover:text-neutral-300 text-left font-semibold text-neutral-300"
        >
          {/* Formatting date only now that we're on client */}
          {birthday ? format(birthday, "PPP") : <span>Pick a date</span>}
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          required
          selected={birthday ?? undefined}
          disabled={(date) => isBefore(startOfDay(date), today)}
          onSelect={(date) => {
            // don't allow selecting past dates
            if (date && !isBefore(startOfDay(date), today)) {
              setBirthday(date);
            }
          }}
          defaultMonth={defaultMonth}
        />
      </PopoverContent>
    </Popover>
  );
}
