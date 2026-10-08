import { useState } from "react";

const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function buildEvents(today: Date): Record<string, { t: string; when: string }[]> {
  const ev: Record<string, { t: string; when: string }[]> = { [key(today)]: [{ t: "Gym", when: "1:00 PM – 2:30 PM" }] };
  const launch = new Date(today.getFullYear(), 10, 3);
  ev[key(launch)] = [{ t: "Public beta launch", when: "All day" }];
  const shoot = new Date(today);
  shoot.setDate(shoot.getDate() + 2);
  ev[key(shoot)] = [...(ev[key(shoot)] ?? []), { t: "Shoot launch video", when: "10:00 AM – 12:00 PM" }];
  return ev;
}

export function Calendar() {
  const [today] = useState(() => new Date());
  const [events] = useState(() => buildEvents(today));
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [sel, setSel] = useState(today);
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const shift = (n: number) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));
  const list = events[key(sel)] ?? [];
  const isToday = key(sel) === key(today);
  return (
    <div className="card cal">
      <div className="cal-head">
        <button onClick={() => shift(-1)} aria-label="Previous month">‹</button>
        <h2>{view.toLocaleString("en-US", { month: "long" }).toUpperCase()} {view.getFullYear()}</h2>
        <button onClick={() => shift(1)} aria-label="Next month">›</button>
      </div>
      <div className="grid7">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="dow">{d}</div>
        ))}
        {Array.from({ length: view.getDay() }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const dt = new Date(view.getFullYear(), view.getMonth(), i + 1);
          const k = key(dt);
          return (
            <button
              key={k}
              className={`d ${events[k] ? "ev" : ""} ${k === key(today) ? "today" : ""} ${k === key(sel) ? "sel" : ""}`}
              onClick={() => setSel(dt)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="agenda">
        <h3>{isToday ? "TODAY" : sel.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}</h3>
        {list.length ? (
          list.map((e) => (
            <div className="item" key={e.t}>
              <i />
              <b>{e.t}</b>
              <small>◷ {e.when}</small>
            </div>
          ))
        ) : (
          <div className="dim">Nothing scheduled</div>
        )}
      </div>
    </div>
  );
}
