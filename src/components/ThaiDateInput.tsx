import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import { bangkokDateKey } from "../utils/date";
import {
  THAI_MONTHS_FULL,
  THAI_WEEKDAYS_SHORT,
  buildValidIsoDate,
  formatTypingThaiDate,
  isIsoInRange,
  isoToThaiDisplay,
  parseThaiInputToIso,
} from "../utils/thaiDateInput";

export interface ThaiDateInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
}

interface PopoverPos {
  top: number;
  left: number;
  above: boolean;
}

function parseIsoParts(iso?: string): { year: number; month: number; day: number } | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Date input using Thai DD/MM/BBBB format and a Buddhist Era calendar picker popover. */
export function ThaiDateInput({
  value,
  onChange,
  min,
  max,
  disabled = false,
  required = false,
  placeholder = "วว/ดด/ปปปป (พ.ศ.)",
  className,
  id,
  name,
  "aria-label": ariaLabel,
}: ThaiDateInputProps) {
  const todayIso = useMemo(() => bangkokDateKey(), []);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState(() => isoToThaiDisplay(value));
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPos>({ top: 0, left: 0, above: false });

  const initialRefParts = parseIsoParts(value) ?? parseIsoParts(todayIso)!;
  const [viewYear, setViewYear] = useState(initialRefParts.year);
  const [viewMonth, setViewMonth] = useState(initialRefParts.month); // 1-12

  // Sync display text when external value changes while not actively typing
  useEffect(() => {
    if (!focused) {
      setText(isoToThaiDisplay(value));
      setInvalid(false);
    }
  }, [value, focused]);

  const updatePosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const popWidth = 286;
    const popHeight = 310;
    const margin = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < popHeight && rect.top > popHeight;
    const top = above
      ? Math.max(margin, rect.top - popHeight - 6)
      : Math.min(window.innerHeight - popHeight - margin, rect.bottom + 6);
    const left = Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - popWidth - margin),
    );
    setPos({ top, left, above });
  }, []);

  const openCalendar = useCallback(() => {
    if (disabled) return;
    const refParts = parseIsoParts(value) ?? parseIsoParts(todayIso)!;
    setViewYear(refParts.year);
    setViewMonth(refParts.month);
    updatePosition();
    setOpen(true);
  }, [disabled, value, todayIso, updatePosition]);

  const toggleOpen = useCallback(() => {
    if (open) setOpen(false);
    else openCalendar();
  }, [open, openCalendar]);

  // Close popover on outside mousedown, Escape key (captured before parent Modal), and keep aligned on resize/scroll
  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (wrapRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    };

    const handleViewportChange = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updatePosition]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTypingThaiDate(e.target.value);
    setText(formatted);

    if (!formatted) {
      setInvalid(false);
      if (value !== "") onChange("");
      return;
    }

    const parsed = parseThaiInputToIso(formatted);
    if (parsed && isIsoInRange(parsed, min, max)) {
      setInvalid(false);
      onChange(parsed);
      const parts = parseIsoParts(parsed);
      if (parts && open) {
        setViewYear(parts.year);
        setViewMonth(parts.month);
      }
    }
  };

  const handleBlur = () => {
    setFocused(false);
    const trimmed = text.trim();
    if (!trimmed) {
      setText("");
      setInvalid(false);
      if (value !== "") onChange("");
      return;
    }

    const parsed = parseThaiInputToIso(trimmed);
    if (parsed && isIsoInRange(parsed, min, max)) {
      setInvalid(false);
      setText(isoToThaiDisplay(parsed));
      if (parsed !== value) onChange(parsed);
    } else {
      setInvalid(true);
    }
  };

  const currentGregorianYear = Number(todayIso.slice(0, 4)) || 2026;
  const minYear = Math.min(viewYear, parseIsoParts(min)?.year ?? 1920);
  const maxYear = Math.max(viewYear, parseIsoParts(max)?.year ?? currentGregorianYear + 30);

  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = minYear; y <= maxYear; y++) list.push(y);
    return list;
  }, [minYear, maxYear]);

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    const cells: Array<{ day: number; iso: string } | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = buildValidIsoDate(viewYear, viewMonth, d);
      if (iso) cells.push({ day: d, iso });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const stepMonth = (delta: number) => {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  };

  const selectIso = (iso: string) => {
    if (!isIsoInRange(iso, min, max)) return;
    setInvalid(false);
    setText(isoToThaiDisplay(iso));
    onChange(iso);
    setOpen(false);
  };

  const clearDate = () => {
    setInvalid(false);
    setText("");
    onChange("");
    setOpen(false);
  };

  const todayInRange = isIsoInRange(todayIso, min, max);

  return (
    <div
      ref={wrapRef}
      className={`thai-date-wrap${className ? ` ${className}` : ""}`}
    >
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        title={
          invalid
            ? "กรุณากรอกวันที่รูปแบบ วว/ดด/พ.ศ. เช่น 26/11/2569"
            : "กรอกวันที่รูปแบบ วว/ดด/พ.ศ. หรือกดไอคอนปฏิทิน"
        }
        className={`thai-date-input${invalid ? " is-invalid" : ""}`}
        value={text}
        onFocus={() => setFocused(true)}
        onChange={handleInputChange}
        onBlur={handleBlur}
      />
      <button
        type="button"
        className="thai-date-trigger"
        disabled={disabled}
        aria-label="เปิดปฏิทิน พ.ศ."
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleOpen();
        }}
      >
        <Calendar size={15} />
      </button>

      {open &&
        !disabled &&
        createPortal(
          <div
            ref={popoverRef}
            className={`thai-date-popover${pos.above ? " is-above" : ""}`}
            style={{ top: pos.top, left: pos.left }}
            role="dialog"
            aria-label="เลือกวันที่ (พุทธศักราช)"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="thai-date-pop-header">
              <button
                type="button"
                className="thai-date-nav-btn"
                aria-label="เดือนก่อนหน้า"
                onClick={() => stepMonth(-1)}
              >
                <ChevronLeft size={16} />
              </button>
              <div className="thai-date-selects">
                <select
                  className="thai-date-select"
                  aria-label="เลือกเดือน"
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                >
                  {THAI_MONTHS_FULL.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  className="thai-date-select"
                  aria-label="เลือกปี พ.ศ."
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      พ.ศ. {y + 543}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="thai-date-nav-btn"
                aria-label="เดือนถัดไป"
                onClick={() => stepMonth(1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="thai-date-weekdays">
              {THAI_WEEKDAYS_SHORT.map((wd) => (
                <span key={wd}>{wd}</span>
              ))}
            </div>

            <div className="thai-date-grid">
              {calendarCells.map((cell, idx) => {
                if (!cell) {
                  return <span key={`empty-${idx}`} className="thai-date-day is-empty" />;
                }
                const outOfRange = !isIsoInRange(cell.iso, min, max);
                const isSelected = cell.iso === value;
                const isToday = cell.iso === todayIso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    disabled={outOfRange}
                    className={`thai-date-day${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}`}
                    onClick={() => selectIso(cell.iso)}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <div className="thai-date-pop-footer">
              <button
                type="button"
                className="thai-date-action-btn"
                disabled={!todayInRange}
                onClick={() => selectIso(todayIso)}
              >
                วันนี้
              </button>
              <button
                type="button"
                className="thai-date-action-btn is-clear"
                onClick={clearDate}
              >
                ล้างวันที่
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
