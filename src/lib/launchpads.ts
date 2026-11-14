import type { Task } from "./types";

type Step = { key: string; title: string; stage: string; needs?: string[]; costs?: boolean; notes?: string };

/** Sitcom's App Store launch plan, as Scott laid it out on Nov 14 2026. Loaded once into the task list. */
const SITCOM: Step[] = [
  { key: "duns", title: "Get D-U-N-S number approved", stage: "Start now", notes: "Apple needs the D-U-N-S approval before the $99 developer account can be paid." },
  { key: "apple", title: "Pay Apple $99", stage: "Start now", needs: ["duns"], costs: true },
  { key: "music", title: "Pick music source + license", stage: "Start now" },
  { key: "names", title: "Name the themes", stage: "Start now" },
  { key: "apis", title: "Research mailer + keepsake APIs", stage: "Start now" },
  { key: "reel", title: "Shoot launch reel with real family", stage: "Start now" },

  { key: "themes", title: "Finish remaining themes", stage: "Build", needs: ["names", "music"] },
  { key: "hd", title: "Upgrade Creatomate for HD", stage: "Build", needs: ["themes"], costs: true },
  { key: "iap", title: "Set up in-app purchases", stage: "Build", needs: ["apple"] },
  { key: "opening", title: "Replace opening reel", stage: "Build", needs: ["reel"] },

  { key: "testflight", title: "TestFlight build on your phone", stage: "Test", needs: ["apple", "iap"] },
  { key: "fullrun", title: "Full run: film → preview → generate → share", stage: "Test", needs: ["themes", "hd", "testflight"] },
  { key: "beta", title: "Friends & family beta", stage: "Test", needs: ["fullrun"] },

  { key: "legal", title: "Privacy policy, terms, store listing", stage: "Submit", needs: ["themes", "iap", "opening"], notes: "Needs the final features." },
  { key: "review", title: "App Store review", stage: "Submit", needs: ["beta", "legal"], notes: "Needs beta fixes + the store listing." },
  { key: "creators", title: "Line up creators + launch posts", stage: "Submit", needs: ["beta"], notes: "Needs beta videos to show." },
];

const id = (key: string) => `sitcom-lp-${key}`;

export const SITCOM_LAUNCH_PAD = {
  key: "import:sitcom-launchpad-v1",
  tasks(): Task[] {
    const base = Date.parse("2026-11-14T18:00:00Z");
    return SITCOM.map((s, i) => ({
      id: id(s.key),
      title: s.title,
      businessId: "sitcom",
      launch: "Launch pad",
      stage: s.stage,
      status: s.stage === "Start now" ? "todo" : "backlog",
      priority: s.stage === "Start now" ? "high" : "medium",
      dependsOn: s.needs?.map(id),
      costs: s.costs || undefined,
      notes: s.notes,
      createdAt: new Date(base + i * 1000).toISOString(),
    }));
  },
};
