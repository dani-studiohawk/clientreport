// Supabase Edge Function: Sync Monday.com clients and sprints
// This function syncs clients and sprints from Monday.com to Supabase
// Scheduled to run weekly via pg_cron

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configuration
const MONDAY_API_URL = "https://api.monday.com/v2";

// Types
interface MondayColumnValue {
  id: string;
  column: { title: string };
  value: string | null;
  text: string | null;
}

interface MondaySubitem {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
}

interface MondayItem {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
  subitems?: MondaySubitem[];
}

interface MondayGroup {
  id: string;
  title: string;
  items_page: {
    items: MondayItem[];
    cursor?: string;
  };
}

interface MondayBoard {
  name: string;
  groups: MondayGroup[];
}

// Helper: Extract person ID from Monday.com person field JSON
function getMondayPersonId(valueJson: string | null): number | null {
  if (!valueJson) return null;
  try {
    const value = JSON.parse(valueJson);
    const persons = value.personsAndTeams || [];
    if (persons.length > 0) {
      return persons[0].id;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// Helper: Extract multiple person IDs from Monday.com people field
function getMondayPersonIds(valueJson: string | null): number[] {
  if (!valueJson) return [];
  try {
    const value = JSON.parse(valueJson);
    const persons = value.personsAndTeams || [];
    return persons
      .filter((p: { kind: string }) => p.kind === "person")
      .map((p: { id: number }) => p.id);
  } catch {
    return [];
  }
}

// Helper: Extract sprint number from label
function extractSprintNumber(sprintLabel: string | null): number | null {
  if (!sprintLabel) return null;

  // Try Q1, Q2, Q3, Q4
  let match = sprintLabel.match(/Q(\d+)/i);
  if (match) return parseInt(match[1], 10);

  // Try Sprint #1, Sprint #2
  match = sprintLabel.match(/Sprint\s*#?(\d+)/i);
  if (match) return parseInt(match[1], 10);

  // Try any number
  match = sprintLabel.match(/(\d+)/);
  if (match) return parseInt(match[1], 10);

  return null;
}

// Helper: Parse date from Monday.com date field
function parseDate(dateJson: string | null): string | null {
  if (!dateJson) return null;
  try {
    const value = JSON.parse(dateJson);
    return value.date || null;
  } catch {
    return null;
  }
}

// Helper: Parse numeric value
function parseNumeric(valueText: string | null): number | null {
  if (!valueText) return null;
  try {
    const cleaned = valueText.replace(/['"]/g, "").trim();
    return cleaned ? parseFloat(cleaned) : null;
  } catch {
    return null;
  }
}

// Map Monday person ID to internal user UUID
async function mapMondayPersonToUser(
  supabase: ReturnType<typeof createClient>,
  mondayPersonId: number | null
): Promise<string | null> {
  if (!mondayPersonId) return null;

  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("monday_person_id", mondayPersonId)
    .single();

  return data?.id || null;
}

// Fetch Monday.com board data with pagination
async function fetchMondayBoardData(
  apiKey: string,
  boardId: string
): Promise<MondayBoard> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // First, get the board structure with groups
  const initialQuery = `{
    boards(ids: [${boardId}]) {
      name
      groups {
        id
        title
      }
    }
  }`;

  const initialResponse = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: initialQuery }),
  });

  if (!initialResponse.ok) {
    throw new Error(`Monday.com API error: ${initialResponse.status}`);
  }

  const initialData = await initialResponse.json();

  if (initialData.errors) {
    throw new Error(`Monday.com GraphQL errors: ${JSON.stringify(initialData.errors)}`);
  }

  const board: MondayBoard = initialData.data.boards[0];

  // Fetch items for each group with pagination
  for (const group of board.groups) {
    group.items_page = { items: [] };
    let cursor: string | null = null;

    while (true) {
      const cursorParam = cursor ? `, cursor: "${cursor}"` : "";

      const itemsQuery = `{
        boards(ids: [${boardId}]) {
          groups(ids: ["${group.id}"]) {
            items_page(limit: 100${cursorParam}) {
              cursor
              items {
                id
                name
                column_values {
                  id
                  column {
                    title
                  }
                  value
                  text
                }
                subitems {
                  id
                  name
                  column_values {
                    id
                    column {
                      title
                    }
                    value
                    text
                  }
                }
              }
            }
          }
        }
      }`;

      const response = await fetch(MONDAY_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: itemsQuery }),
      });

      if (!response.ok) {
        console.warn(`Failed to fetch items for group ${group.title}`);
        break;
      }

      const pageData = await response.json();

      if (pageData.errors) {
        console.warn(`GraphQL errors for group ${group.title}:`, pageData.errors);
        break;
      }

      const itemsPage = pageData.data.boards[0].groups[0].items_page;
      const items = itemsPage.items || [];

      if (items.length === 0) break;

      group.items_page.items.push(...items);

      cursor = itemsPage.cursor;
      if (!cursor) break;
    }
  }

  return board;
}

// Parse client item
async function parseClientItem(
  supabase: ReturnType<typeof createClient>,
  item: MondayItem,
  groupTitle: string,
  region: string
): Promise<Record<string, unknown>> {
  const columns: Record<string, MondayColumnValue> = {};
  for (const col of item.column_values) {
    columns[col.column.title] = col;
  }

  // Extract DPR Lead
  const dprLeadMondayId = getMondayPersonId(columns["DPR Lead"]?.value);
  const dprLeadId = await mapMondayPersonToUser(supabase, dprLeadMondayId);

  // Extract DPR Support
  const dprSupportMondayIds = getMondayPersonIds(columns["DPR Support"]?.value);
  const dprSupportIds: string[] = [];
  for (const mondayId of dprSupportMondayIds) {
    const userId = await mapMondayPersonToUser(supabase, mondayId);
    if (userId) dprSupportIds.push(userId);
  }

  // Calculate monthly hours from monthly rate
  const monthlyRate = parseNumeric(columns["Monthly Rate"]?.text);
  const monthlyHours = monthlyRate ? monthlyRate / 190.0 : null;

  // Determine active status based on group title
  const inactiveKeywords = [
    "finished",
    "refunded",
    "cancelled",
    "canceled",
    "completed",
    "archived",
    "inactive",
    "paused",
  ];
  const groupLower = groupTitle.toLowerCase();
  const isActive = !inactiveKeywords.some((keyword) => groupLower.includes(keyword));

  const clientData: Record<string, unknown> = {
    monday_item_id: parseInt(item.id, 10),
    name: item.name,
    region,
    dpr_lead_id: dprLeadId,
    dpr_support_ids: dprSupportIds.length > 0 ? dprSupportIds : null,
    seo_lead_name: columns["SEO Lead"]?.text || null,
    niche: columns["Niches"]?.text || null,
    agency_value: parseNumeric(columns["Agency Value"]?.text),
    client_priority: columns["Client Priority"]?.text || null,
    campaign_type: columns["Campaign Type"]?.text || null,
    campaign_start_date: parseDate(columns["Campaign Start Date"]?.value),
    monthly_rate: monthlyRate,
    monthly_hours: monthlyHours,
    report_status: columns["Report Status"]?.text || null,
    last_report_date: parseDate(columns["Last Report Date"]?.value),
    last_invoice_date: parseDate(columns["Last Invoice Date"]?.value),
    is_active: isActive,
    group_name: groupTitle,
    updated_at: new Date().toISOString(),
  };

  // Remove null values
  return Object.fromEntries(
    Object.entries(clientData).filter(([, v]) => v !== null)
  );
}

// Parse sprint subitem
function parseSprintSubitem(
  subitem: MondaySubitem,
  clientId: string
): Record<string, unknown> | null {
  const columns: Record<string, MondayColumnValue> = {};
  for (const col of subitem.column_values) {
    columns[col.column.title] = col;
  }

  const startDate = parseDate(columns["Start Date"]?.value);
  const endDate = parseDate(columns["End Date"]?.value);

  if (!startDate || !endDate) {
    console.log(`Skipping sprint ${subitem.name} - missing dates`);
    return null;
  }

  const sprintLabel = columns["Sprint"]?.text || null;
  const sprintNumber = extractSprintNumber(sprintLabel);

  const kpiTarget = parseNumeric(columns["Link KPI Per Quarter"]?.text);
  const kpiAchieved = parseNumeric(columns["Links Achieved Per Quarter"]?.text);
  const monthlyRate = parseNumeric(columns["Monthly Rate (AUD)"]?.text);

  const sprintData: Record<string, unknown> = {
    monday_subitem_id: parseInt(subitem.id, 10),
    client_id: clientId,
    name: subitem.name,
    sprint_number: sprintNumber,
    sprint_label: sprintLabel,
    start_date: startDate,
    end_date: endDate,
    kpi_target: kpiTarget ? Math.floor(kpiTarget) : 0,
    kpi_achieved: kpiAchieved ? Math.floor(kpiAchieved) : 0,
    monthly_rate: monthlyRate,
    updated_at: new Date().toISOString(),
  };

  // Remove null values
  return Object.fromEntries(
    Object.entries(sprintData).filter(([, v]) => v !== null)
  );
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
Deno.serve(async (_req) => {
  try {
    // Get secrets from environment
    const MONDAY_API_KEY = Deno.env.get("MONDAY_API_KEY");
    const MONDAY_AU_BOARD_ID = Deno.env.get("MONDAY_AU_BOARD_ID");
    const MONDAY_US_BOARD_ID = Deno.env.get("MONDAY_US_BOARD_ID");
    const MONDAY_UK_BOARD_ID = Deno.env.get("MONDAY_UK_BOARD_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!MONDAY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const boards: { region: string; boardId: string | undefined }[] = [
      { region: "AU", boardId: MONDAY_AU_BOARD_ID },
      { region: "US", boardId: MONDAY_US_BOARD_ID },
      { region: "UK", boardId: MONDAY_UK_BOARD_ID },
    ];

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Starting Monday.com sync...");

    let totalClientsSynced = 0;
    let totalSprintsSynced = 0;

    for (const { region, boardId } of boards) {
      if (!boardId) {
        console.log(`Skipping ${region} board - no board ID configured`);
        continue;
      }

      console.log(`Syncing ${region} board (ID: ${boardId})...`);

      try {
        const boardData = await fetchMondayBoardData(MONDAY_API_KEY, boardId);

        let clientsSynced = 0;
        let sprintsSynced = 0;

        for (const group of boardData.groups) {
          console.log(`Processing group: ${group.title} (${group.items_page.items.length} items)`);

          for (const item of group.items_page.items) {
            try {
              const clientData = await parseClientItem(
                supabase,
                item,
                group.title,
                region
              );

              // Upsert client
              const { data: clientResult } = await supabase
                .from("clients")
                .upsert(clientData, { onConflict: "monday_item_id" })
                .select("id")
                .single();

              if (!clientResult) continue;

              clientsSynced++;

              // Process subitems (sprints)
              if (item.subitems && item.subitems.length > 0) {
                for (const subitem of item.subitems) {
                  try {
                    const sprintData = parseSprintSubitem(subitem, clientResult.id);

                    if (sprintData) {
                      await supabase
                        .from("sprints")
                        .upsert(sprintData, { onConflict: "monday_subitem_id" });

                      sprintsSynced++;
                    }
                  } catch (e) {
                    console.error(`Error syncing sprint ${subitem.name}:`, e);
                  }
                }
              }
            } catch (e) {
              console.error(`Error syncing client ${item.name}:`, e);
            }
          }
        }

        console.log(`${region} board complete: ${clientsSynced} clients, ${sprintsSynced} sprints`);
        totalClientsSynced += clientsSynced;
        totalSprintsSynced += sprintsSynced;
      } catch (e) {
        console.error(`Error syncing ${region} board:`, e);
      }
    }

    // Log success
    await logSync(supabase, "monday", "success", totalClientsSynced + totalSprintsSynced);

    const result = {
      success: true,
      clients_synced: totalClientsSynced,
      sprints_synced: totalSprintsSynced,
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
