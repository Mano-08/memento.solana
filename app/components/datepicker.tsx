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

export function DatePicker({ birthday, setBirthday }: DatePickerProps) {
  // Ensure that today is always the minimum selectable date
  const today = startOfDay(new Date());

  // If birthday is null, show calendar this month by default
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
