## Plan

We are building a reporting tool that allows the team to view the progress of their clients, sprints and contract KPIs.

The stack is:
- Supabase for backend database
- Netlify for front end

Login is to be limited to Studiohawk.com.au users. 
Some users will have admin privaleges, namely:
- dani@studiohawk.com.au
- georgia.anderson@studiohawk.com.au
- daisy@studiohawk.com.au

Admin privaleges enable:
- Seeing all client sprints
- Seeing all team hours
- Seeing all clients

Non-admin users will be restricted to clients that have the tag "DPR Lead: [name]" that matches their name in the user database.

## Data 
Client information and KPIs will be pulled from Monday.com to Supabase.
DPR team hours will be pulled from Clockify.com to Supabase.

We will need to join the Clockify and Monday data to perform calculations that determine how well the sprint or team member is performing.

The data needs to be refreshed once per day from both platforms.

The structure of Monday data can be found monday_board_structure.json
The structure of Clockify data can be found clockify_data_structure.json

### Calculations

Per sprint:
- KPI progress. Eg: 4/8 (50%)
- Hours used. Eg: 36.28/49.23 hrs (73.7%)
- Sprint time remaining. Eg: 42 of 91 days
- Billable rate. Eg: Monthly Rate * 3 / Hours used on this sprint
- Hours utilization. Eg: Monthly Hours * 3 compared to actual hours used on this sprint.
- Sprint health. Eg: On Track, Behind, KPI complete, etc. This will be calculated using the sprint start and end date, and where we are in that timeline. For example, 'behind' would be if 80% of the way through the sprint timeline with less than 60% KPI met. 
- Breakdown of time taken on tasks for that sprint. Eg: 10 hours to comms, 3 hours to data, etc.
- Breakdown of time taken by team member. Eg: Janine 20 hours, Georgia 3 hours, Kiran 10 hours.

Per client contract:
- Average billable rate. Eg: 145/hr across all tracked sprints.
- Current sprint. Eg: Sprint 4
- Contract KPI target. Eg: 4 sprints completed with kpi of 8 each, so 32 KPI target.
- Contract KPI progress. Eg: 28 out of 32.
- Contract hours used. Eg: Monthly hours x 3 * number of sprints compared to total hours used across all sprints.


## Security

Security is very important, and I'm concerned about how much data will be visible through the network tab. I'd like to keep this to as little as possible, and adhere to all industry standards.

## Frontend

Sidebar menu with:
- Sprints
- Clients
- Settings

### Sprints
Sprints will show that users' sprints only (unless Admin). It will default to Active clients only with a toggle to show past clients. 
At the top of the page will be filters to filter by Sprint Health, ie 'On Track', 'Behind', 'At Risk' etc.
There will be a sort option that will sort by either Ending Soon, A-Z, Agency Value or Priority.

Each sprint will be shown as a report card displaying:
Client Name
Sprint number
Start and end date of sprint
Status (at risk, on track, etc)
These stats will be shown as progress bars:
- KPI Progress
- Hours used
- Days remaining
Then there will be a section for overall kpis ie: Total sprints KPI, Total hours used across all sprints, which will also be shown as progress bars.

When the user clicks on a sprint card, it opens a page dedicated to that sprint. At the top is
- Client name
- DPR Lead
- And a button that can take them to the client page
Underneath is a card with financial overview:
- Agency value
- Monthly rate
- Billable rate ($190AUD hr) versus actual billable rate
Then there is a sprint breakdown:
- Sprint start date
- Sprint end date
- Where we are through the sprint
- KPI target
- KPI achieved
Underneath that is a graph that shows a breakdown of hours across the sprint by date
Then underneath that is a table that breaks down time spent on tasks for that sprint.

### Clients
Need help figuring out the best way to show and organise this.