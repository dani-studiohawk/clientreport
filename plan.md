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

Will be updated soon.

## Security

Security is very important, and I'm concerned about how much data will be visible through the network tab. I'd like to keep this to as little as possible, and adhere to all industry standards.

