import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { getBusinesses } from "./businesses";
import { getAllMetrics, getBankAccounts, getEmails, getMetrics } from "./data";
import { createTask, listTasks, updateTask } from "./tasks";
import { isoDay } from "./dates";

const MODEL = "claude-opus-5-5";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const businessIds = () => getBusinesses().map((b) => b.id);

function buildTools(onChange: () => void) {
  return [
    betaZodTool({
      name: "get_business_overview",
      description:
        "Summary of every business: revenue last 30 days vs previous 30, orders, MRR, cash in Mercury, and whether figures are live or sample data. Start here for cross-business questions.",
      inputSchema: z.object({}),
      run: async () => {
        const [metrics, businesses] = [await getAllMetrics(), getBusinesses()];
        return JSON.stringify(
          metrics.map((m) => ({
            business: businesses.find((b) => b.id === m.businessId)?.name,
            id: m.businessId,
            revenue30d: Math.round(m.revenue30d),
            revenuePrev30d: m.revenuePrev30d,
            orders30d: m.orders30d,
            mrr: m.mrr,
            cash: Math.round(m.cash),
            streams: m.streams.map((s) => ({ source: s.source, account: s.account, revenue30d: Math.round(s.revenue30d), live: s.live })),
            dataIsLive: m.live,
          })),
        );
      },
    }),
    betaZodTool({
      name: "get_daily_revenue",
      description: "Daily revenue for one business over the last 30 days.",
      inputSchema: z.object({ business_id: z.string().describe(`One of: ${businessIds().join(", ")}`) }),
      run: async ({ business_id }) => {
        const m = await getMetrics(business_id);
        return m ? JSON.stringify(m.daily) : `Unknown business ${business_id}`;
      },
    }),
    betaZodTool({
      name: "get_bank_accounts",
      description: "Mercury bank accounts with current balances and which business each belongs to.",
      inputSchema: z.object({}),
      run: async () => JSON.stringify(await getBankAccounts()),
    }),
    betaZodTool({
      name: "list_tasks",
      description: "List tasks, optionally filtered by business, status, or planned day (YYYY-MM-DD).",
      inputSchema: z.object({
        business_id: z.string().optional(),
        status: z.enum(["backlog", "todo", "doing", "done"]).optional(),
        planned_for: z.string().optional(),
      }),
      run: async ({ business_id, status, planned_for }) =>
        JSON.stringify(
          listTasks({ businessId: business_id }).filter(
            (t) => (!status || t.status === status) && (!planned_for || t.plannedFor === planned_for),
          ),
        ),
    }),
    betaZodTool({
      name: "create_task",
      description: "Create a task. Use when the user asks you to add, remember, or schedule something.",
      inputSchema: z.object({
        title: z.string(),
        business_id: z.string().describe(`One of: ${businessIds().join(", ")}`),
        planned_for: z.string().optional().describe("Day to work on it, YYYY-MM-DD"),
        due_date: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        launch: z.string().optional().describe("Launch or milestone this belongs to"),
        estimate_min: z.number().optional(),
        notes: z.string().optional(),
      }),
      run: async (i) => {
        if (!businessIds().includes(i.business_id)) return `Unknown business ${i.business_id}`;
        onChange();
        return JSON.stringify(
          createTask({
            title: i.title,
            businessId: i.business_id,
            plannedFor: i.planned_for,
            dueDate: i.due_date,
            priority: i.priority ?? "medium",
            launch: i.launch,
            estimateMin: i.estimate_min,
            notes: i.notes,
          }),
        );
      },
    }),
    betaZodTool({
      name: "update_task",
      description: "Change a task's status, planned day, or priority. Get the id from list_tasks first.",
      inputSchema: z.object({
        id: z.string(),
        status: z.enum(["backlog", "todo", "doing", "done"]).optional(),
        planned_for: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
      }),
      run: async ({ id, status, planned_for, priority }) => {
        const t = updateTask(id, {
          ...(status && { status }),
          ...(planned_for && { plannedFor: planned_for }),
          ...(priority && { priority }),
        });
        if (t) onChange();
        return t ? JSON.stringify(t) : `No task with id ${id}`;
      },
    }),
    betaZodTool({
      name: "list_emails",
      description: "Recent inbox emails, optionally for one business or only unread ones.",
      inputSchema: z.object({ business_id: z.string().optional(), unread_only: z.boolean().optional() }),
      run: async ({ business_id, unread_only }) =>
        JSON.stringify((await getEmails(business_id)).filter((e) => !unread_only || e.unread).slice(0, 30)),
    }),
  ];
}

const SYSTEM = `You are the AI chief of staff inside Command Center, the owner's personal dashboard for running several businesses.
Use the tools to look up real numbers, tasks, and email before answering; never invent figures.
If a tool result says dataIsLive is false, mention briefly that the figures are sample data until that account is connected.
Be concise and direct. Lead with the answer, use short lists for breakdowns, and format money like $12,340.
When you create or change tasks, say exactly what you did.`;

export async function runAgent(history: ChatTurn[]) {
  const client = new Anthropic();
  let changed = false;
  const businesses = getBusinesses()
    .map((b) => `${b.id} = ${b.name} (${b.tagline})`)
    .join("; ");

  const final = await client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    max_iterations: 12,
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      { type: "text", text: `Businesses: ${businesses}. Today is ${isoDay()}.` },
    ],
    tools: buildTools(() => (changed = true)),
    messages: history.map((t) => ({ role: t.role, content: t.content })),
  });

  if (final.stop_reason === "refusal") {
    return { text: "I can't help with that one.", changed };
  }
  const text = final.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();
  return { text: text || "Done.", changed };
}
