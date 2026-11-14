"use client";
import { Fragment } from "react";
import type { Business, Task } from "@/lib/types";
import { depsOf, openBlockers, stagesOf } from "@/lib/deps";
import { TaskCard } from "./TaskCard";
import { Icon } from "./Icon";
import { AddTask } from "./AddTask";

/**
 * A launch laid out left to right by stage. Each card lists what it needs; a task unlocks once
 * everything it needs is done. Tasks that are ready to work on now are marked "Ready".
 */
export function LaunchPad({
  tasks,
  all,
  byId,
  selectedId,
  onOpen,
  onToggle,
  businesses,
  onCreate,
}: {
  tasks: Task[];
  all: Task[];
  byId: Record<string, Business>;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onToggle: (t: Task) => void;
  businesses: Business[];
  onCreate: (t: Partial<Task> & Pick<Task, "title" | "businessId">) => void;
}) {
  const launch = tasks[0]?.launch;
  const businessId = tasks[0]?.businessId;
  const stages = stagesOf(tasks);
  const loose = tasks.filter((t) => !t.stage?.trim());
  const columns = [...(loose.length ? [{ name: "No stage", list: loose }] : []), ...stages.map((s) => ({ name: s, list: tasks.filter((t) => t.stage?.trim() === s) }))];

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto scroll-thin pb-3">
        {columns.map((c, i) => {
          const done = c.list.filter((t) => t.status === "done").length;
          // Ready first, then waiting, then done.
          const rank = (t: Task) => (t.status === "done" ? 2 : openBlockers(t, all).length ? 1 : 0);
          const list = [...c.list].sort((a, b) => rank(a) - rank(b));
          return (
            <Fragment key={c.name}>
              {i > 0 && (
                <div className="flex shrink-0 items-start pt-24 text-faint" aria-hidden>
                  <Icon name="arrowRight" size={18} />
                </div>
              )}
              <section className="w-[270px] shrink-0 rounded-2xl bg-sidebar/60 p-3">
                <div className="mb-3 flex items-baseline justify-between px-1">
                  <h2 className="text-[15px] font-semibold text-accent">
                    {c.name === "No stage" ? c.name : `${stages.indexOf(c.name) + 1} · ${c.name}`}
                  </h2>
                  <span className="text-[12px] tabular-nums text-faint">
                    {done}/{c.list.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {list.map((t) => {
                    const ready = t.status !== "done" && !openBlockers(t, all).length;
                    return (
                      <div key={t.id} className="relative">
                        {ready && (
                          <span className="absolute -top-1.5 right-2 z-10 rounded-full bg-good px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-white">
                            Ready
                          </span>
                        )}
                        <TaskCard
                          task={t}
                          deps={depsOf(t, all)}
                          business={byId[t.businessId]}
                          onToggle={() => onToggle(t)}
                          onOpen={() => onOpen(t.id)}
                          selected={t.id === selectedId}
                        />
                      </div>
                    );
                  })}
                  <AddTask
                    businesses={businesses}
                    defaults={{ status: "backlog", launch, businessId, stage: c.name === "No stage" ? undefined : c.name }}
                    onCreate={onCreate}
                  />
                </div>
              </section>
            </Fragment>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-faint">
        Read left to right: a task stays locked until everything it needs is done. Red = costs money. Open a task to change what it waits on.
      </p>
    </div>
  );
}
