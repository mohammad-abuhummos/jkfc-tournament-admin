import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("home", "routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("dashboard", "routes/dashboard.tsx", [
    index("routes/dashboard/index.tsx"),
    route("tournaments/:tournamentId", "routes/dashboard/tournaments.$tournamentId.tsx", [
      index("routes/dashboard/tournaments.$tournamentId.index.tsx"),
      route("teams", "routes/dashboard/tournaments.$tournamentId.teams.tsx"),
      route("groups", "routes/dashboard/tournaments.$tournamentId.groups.tsx"),
      route("matches", "routes/dashboard/tournaments.$tournamentId.matches.tsx"),
      route("bracket", "routes/dashboard/tournaments.$tournamentId.bracket.tsx"),
      route("event", "routes/dashboard/tournaments.$tournamentId.event.tsx"),
      route("settings", "routes/dashboard/tournaments.$tournamentId.settings.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
