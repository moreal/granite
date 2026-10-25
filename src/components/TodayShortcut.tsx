import { Button } from "../design-system/Button";
import { createSignal, onSettled } from "solid-js";
import { CalendarDays } from "../icons";
import { localDate } from "../domain/links";
export function TodayShortcut(props: {
  disabled: boolean;
  onOpen: (date: string) => void;
}) {
  const [today, setToday] = createSignal(new Date());
  onSettled(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = new Date();
      setToday(now);
      clearTimeout(timer);
      timer = setTimeout(
        refresh,
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
        ).getTime() - now.getTime(),
      );
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  });
  return (
    <Button
      class="quick-nav-action"
      onClick={() => props.onOpen(localDate())}
      disabled={props.disabled}
      aria-label={`오늘의 노트 ${localDate(0, today())}`}
    >
      <CalendarDays size={17} />
      오늘의 노트
      <span>
        {today().getMonth() + 1}월 {today().getDate()}일
      </span>
    </Button>
  );
}
