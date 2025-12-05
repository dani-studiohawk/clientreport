// Supabase Edge Function: Sync Clockify time entries
// This function syncs time entries from Clockify to Supabase
// Scheduled to run daily via pg_cron

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configuration
const CLOCKIFY_API_URL = "https://api.clockify.me/api/v1";
const PRE_SPRINT_LOOKBACK_DAYS = 14;
const DEFAULT_DAYS_BACK = 7;

// Types
interface ClockifyUser {
  id: string;
  email: string;
  name: string;
}

interface ClockifyProject {
  id: string;
  name: string;
}

interface ClockifyTimeEntry {
  id: string;
  projectId?: string;
  description?: string;
  task?: { name: string };
  timeInterval: {
    start: string;
    end?: string;
    duration?: string;
  };
}

interface SprintData {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  sprint_number?: number;
}

interface ClientSprintCache {
  first_sprint: SprintData | null;
  last_sprint: SprintData | null;
  campaign_start_date: string | null;
  all_sprints: SprintData[];
}

// Manual project name mappings
const MANUAL_PROJECT_MAPPINGS: Record<string, string> = {
  "Fat Burners Only": "Fat Burners Only",
  "Grace Love Lace": "Grace Loves Lace",
  "IconByDesign": "Icon By Design",
  "LuxoLiving": "Luxo Living",
  "NutritionWarehouse": "Nutrition Warehouse",
  "Moon Pig": "Moonpig",
  "Italian Street Kitchen": "Italian Street Kitchen",
  "Lifespan Fitness": "Lifespan Fitness",
  "OSHC Australia Pty Ltd": "OSHC Australia Pty Ltd",
  "Pack & Send": "Pack & Send",
  "LVLY": "",
};

// Cache for client sprint data
const clientSprintCache: Record<string, ClientSprintCache> = {};

// Helper: Normalize name for fuzzy matching
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Helper: Parse ISO 8601 duration to hours
function parseDurationToHours(duration: string): number {
  if (!duration) return 0;

  let hours = 0;
  let minutes = 0;

  const hoursMatch = duration.match(/(\d+)H/);
  const minutesMatch = duration.match(/(\d+)M/);

  if (hoursMatch) hours = parseInt(hoursMatch[1], 10);
  if (minutesMatch) minutes = parseInt(minutesMatch[1], 10);

  return Math.round((hours + minutes / 60) * 100) / 100;
}

// Helper: Get date string from ISO datetime
function getDateString(isoString: string): string {
  return isoString.split("T")[0];
}

// Fetch Clockify users
async function fetchClockifyUsers(
  apiKey: string,
  workspaceId: string
): Promise<ClockifyUser[]> {
  const response = await fetch(
    `${CLOCKIFY_API_URL}/workspaces/${workspaceId}/users`,
    {
      headers: { "X-Api-Key": apiKey },
    }
  );

  if (!response.ok) {
    throw new Error(`Clockify API error: ${response.status}`);
  }

  return response.json();
}

// Fetch Clockify projects with pagination
async function fetchClockifyProjects(
  apiKey: string,
  workspaceId: string
): Promise<ClockifyProject[]> {
  const allProjects: ClockifyProject[] = [];
  let page = 1;
  const pageSize = 500; // Max page size for projects

  while (true) {
    const url = new URL(
      `${CLOCKIFY_API_URL}/workspaces/${workspaceId}/projects`
    );
    url.searchParams.set("page", page.toString());
    url.searchParams.set("page-size", pageSize.toString());
    url.searchParams.set("archived", "false"); // Only active projects

    const response = await fetch(url.toString(), {
      headers: { "X-Api-Key": apiKey },
    });

    if (!response.ok) {
      throw new Error(`Clockify API error: ${response.status}`);
    }

    const projects: ClockifyProject[] = await response.json();
    if (projects.length === 0) break;

    allProjects.push(...projects);

    if (projects.length < pageSize) break;

    page++;

    // Safety limit
    if (page > 20) {
      console.warn("Warning: Reached page limit for projects");
      break;
    }
  }

  return allProjects;
}

// Fetch time entries for a user
async function fetchClockifyTimeEntries(
  apiKey: string,
  workspaceId: string,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ClockifyTimeEntry[]> {
  const allEntries: ClockifyTimeEntry[] = [];
  let page = 1;
  const pageSize = 1000;

  const startStr = startDate.toISOString().replace(/\.\d{3}Z$/, "Z");
  const endStr = endDate.toISOString().replace(/\.\d{3}Z$/, "Z");

  while (true) {
    const url = new URL(
      `${CLOCKIFY_API_URL}/workspaces/${workspaceId}/user/${userId}/time-entries`
    );
    url.searchParams.set("start", startStr);
    url.searchParams.set("end", endStr);
    url.searchParams.set("page", page.toString());
    url.searchParams.set("page-size", pageSize.toString());
    url.searchParams.set("hydrated", "true"); // Include full task/project details

    const response = await fetch(url.toString(), {
      headers: { "X-Api-Key": apiKey },
    });

    if (!response.ok) {
      console.warn(`Error fetching entries for user ${userId}: ${response.status}`);
      break;
    }

    const entries: ClockifyTimeEntry[] = await response.json();
    if (entries.length === 0) break;

    allEntries.push(...entries);
    page++;

    if (page > 100) break; // Safety limit
  }

  return allEntries;
}

// Map Clockify user email to internal user ID
async function mapClockifyUserToInternal(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<string | null> {
  if (!email) return null;

  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase())
    .single();

  return data?.id || null;
}

// Map project name to client ID
async function mapProjectToClient(
  supabase: ReturnType<typeof createClient>,
  projectName: string
): Promise<string | null> {
  if (!projectName) return null;

  // Check manual mappings first
  const manualClientName = MANUAL_PROJECT_MAPPINGS[projectName];
  if (manualClientName !== undefined) {
    if (manualClientName === "") return null; // Explicitly unmapped

    const { data } = await supabase
      .from("clients")
      .select("id")
      .ilike("name", manualClientName)
      .single();

    if (data) return data.id;
  }

  // Try exact match
  const { data: exactMatch } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", projectName)
    .single();

  if (exactMatch) return exactMatch.id;

  // Try fuzzy match
  const { data: allClients } = await supabase
    .from("clients")
    .select("id, name");

  if (allClients) {
    const projectNormalized = normalizeName(projectName);
    const projectLower = projectName.toLowerCase();

    for (const client of allClients) {
      const clientNormalized = normalizeName(client.name);
      const clientLower = client.name.toLowerCase();

      if (
        projectLower.includes(clientLower) ||
        clientLower.includes(projectLower) ||
        projectNormalized.includes(clientNormalized) ||
        clientNormalized.includes(projectNormalized)
      ) {
        return client.id;
      }
    }
  }

  return null;
}

// Get cached sprint data for a client
async function getClientSprintData(
  supabase: ReturnType<typeof createClient>,
  clientId: string
): Promise<ClientSprintCache> {
  if (clientSprintCache[clientId]) {
    return clientSprintCache[clientId];
  }

  // Fetch client's campaign_start_date
  const { data: clientData } = await supabase
    .from("clients")
    .select("campaign_start_date")
    .eq("id", clientId)
    .single();

  // Fetch all sprints for this client
  const { data: sprints } = await supabase
    .from("sprints")
    .select("id, name, start_date, end_date, sprint_number")
    .eq("client_id", clientId)
    .order("start_date");

  const allSprints = (sprints || []) as SprintData[];

  const cacheData: ClientSprintCache = {
    first_sprint: allSprints[0] || null,
    last_sprint: allSprints[allSprints.length - 1] || null,
    campaign_start_date: clientData?.campaign_start_date || null,
    all_sprints: allSprints,
  };

  clientSprintCache[clientId] = cacheData;
  return cacheData;
}

// Find sprint for a date with pre-sprint lookback
async function findSprintForDate(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  entryDate: string
): Promise<{ sprintId: string | null; tag: string | null }> {
  // Query for exact match
  const { data: exactMatch } = await supabase
    .from("sprints")
    .select("id, name")
    .eq("client_id", clientId)
    .lte("start_date", entryDate)
    .gte("end_date", entryDate)
    .single();

  if (exactMatch) {
    return { sprintId: exactMatch.id, tag: null };
  }

  // No exact match - check for pre-sprint or post-sprint work
  const clientData = await getClientSprintData(supabase, clientId);

  if (!clientData.first_sprint) {
    return { sprintId: null, tag: "no_sprints" };
  }

  const entryDateObj = new Date(entryDate);
  const firstSprintStart = new Date(clientData.first_sprint.start_date);
  const lastSprintEnd = new Date(clientData.last_sprint!.end_date);

  // Check if entry is BEFORE first sprint
  if (entryDateObj < firstSprintStart) {
    // Calculate lookback window
    const lookbackStart = new Date(firstSprintStart);
    lookbackStart.setDate(lookbackStart.getDate() - PRE_SPRINT_LOOKBACK_DAYS);

    // If campaign_start_date exists, use whichever is later
    if (clientData.campaign_start_date) {
      const campaignStart = new Date(clientData.campaign_start_date);
      if (campaignStart > lookbackStart) {
        lookbackStart.setTime(campaignStart.getTime());
      }
    }

    // Entry falls within pre-sprint lookback window
    if (entryDateObj >= lookbackStart) {
      return { sprintId: clientData.first_sprint.id, tag: "pre_sprint_prep" };
    }

    return { sprintId: null, tag: "before_campaign" };
  }

  // Check if entry is AFTER last sprint
  if (entryDateObj > lastSprintEnd) {
    return { sprintId: null, tag: "post_sprint_work" };
  }

  // Entry falls in a gap between sprints
  return { sprintId: null, tag: "gap_between_sprints" };
}

// Log sync status
async function logSync(
  supabase: ReturnType<typeof createClient>,
  source: string,
  status: string,
  recordsSynced: number,
  errorMessage?: string
) {
  await supabase.from("sync_logs").insert({
    source,
    sync_start: new Date().toISOString(),
    sync_end: new Date().toISOString(),
    status,
    records_synced: recordsSynced,
    error_message: errorMessage,
  });
}

// Main handler
Deno.serve(async (req) => {
  try {
    // Get secrets from environment
    const CLOCKIFY_API_KEY = Deno.env.get("CLOCKIFY_API_KEY");
    const CLOCKIFY_WORKSPACE_ID = Deno.env.get("CLOCKIFY_WORKSPACE_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!CLOCKIFY_API_KEY || !CLOCKIFY_WORKSPACE_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    // Parse request body for optional parameters
    let daysBack = DEFAULT_DAYS_BACK;
    try {
      const body = await req.json();
      if (body.days_back) daysBack = body.days_back;
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Starting Clockify sync (last ${daysBack} days)...`);

    // Fetch Clockify data
    const clockifyUsers = await fetchClockifyUsers(CLOCKIFY_API_KEY, CLOCKIFY_WORKSPACE_ID);
    const clockifyProjects = await fetchClockifyProjects(CLOCKIFY_API_KEY, CLOCKIFY_WORKSPACE_ID);

    console.log(`Found ${clockifyUsers.length} users, ${clockifyProjects.length} projects`);

    // Build project -> client mapping
    const projectClientMap: Record<string, string> = {};
    for (const project of clockifyProjects) {
      const clientId = await mapProjectToClient(supabase, project.name);
      if (clientId) {
        projectClientMap[project.id] = clientId;
      }
    }

    // Set date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    let entriesSynced = 0;
    let entriesSkipped = 0;
    const stats = {
      no_hours: 0,
      pre_sprint_prep: 0,
      no_sprint: 0,
      non_client_work: 0,
    };

    // Process each user
    for (const clockifyUser of clockifyUsers) {
      if (!clockifyUser.email) continue;

      const internalUserId = await mapClockifyUserToInternal(supabase, clockifyUser.email);
      if (!internalUserId) {
        console.log(`Skipping user ${clockifyUser.name} - not in system`);
        continue;
      }

      console.log(`Processing user: ${clockifyUser.name}`);

      const timeEntries = await fetchClockifyTimeEntries(
        CLOCKIFY_API_KEY,
        CLOCKIFY_WORKSPACE_ID,
        clockifyUser.id,
        startDate,
        endDate
      );

      for (const entry of timeEntries) {
        const hours = parseDurationToHours(entry.timeInterval.duration || "");
        if (hours === 0) {
          entriesSkipped++;
          stats.no_hours++;
          continue;
        }

        const entryDate = getDateString(entry.timeInterval.start);
        const projectName = clockifyProjects.find((p) => p.id === entry.projectId)?.name || null;
        const clientId = entry.projectId ? projectClientMap[entry.projectId] : null;

        let sprintId: string | null = null;
        const tags: string[] = [];

        if (clientId) {
          const { sprintId: foundSprintId, tag } = await findSprintForDate(
            supabase,
            clientId,
            entryDate
          );
          sprintId = foundSprintId;

          if (tag) {
            tags.push(tag);
            if (sprintId) {
              stats.pre_sprint_prep++;
            } else {
              stats.no_sprint++;
            }
          }
        } else {
          stats.non_client_work++;
        }

        // Upsert time entry
        await supabase.from("time_entries").upsert(
          {
            clockify_id: entry.id,
            sprint_id: sprintId,
            client_id: clientId,
            user_id: internalUserId,
            entry_date: entryDate,
            hours,
            description: entry.description || "",
            task_category: entry.task?.name || null,
            project_name: projectName,
            tags,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "clockify_id" }
        );

        entriesSynced++;
      }
    }

    // Log success
    await logSync(supabase, "clockify", "success", entriesSynced);

    const result = {
      success: true,
      entries_synced: entriesSynced,
      entries_skipped: entriesSkipped,
      stats,
    };

    console.log("Sync complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
