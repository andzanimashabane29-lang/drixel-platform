import {
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  service,
} from "railway/iac";

export default defineRailway((ctx) => {
  const production = ctx.environment === "production";

  const database = postgres("Drixel Postgres");

  const api = service("Drixel API", {
    source: github("andzanimashabane29-lang/drixel-platform", { branch: "main" }),
    start: "npm run start:api",
    preDeploy: "npm run db:provision",
    healthcheck: "/api/health",
    healthcheckTimeout: 60,
    replicas: 1,
    env: {
      NODE_ENV: production ? "production" : "production",
      ADMIN_DATABASE_URL: database.env.DATABASE_URL,
      PGHOST: database.env.PGHOST,
      PGPORT: database.env.PGPORT,
      PGDATABASE: database.env.PGDATABASE,
      PGUSER: "drixel_directory_reader",
      PGMANAGEMENTUSER: "drixel_management_api",
      POSTGRES_DIRECTORY_PASSWORD: preserve(),
      POSTGRES_MANAGEMENT_PASSWORD: preserve(),
      PGPASSWORD: preserve(),
      PGMANAGEMENTPASSWORD: preserve(),
      OIDC_ISSUER: preserve(),
      OIDC_AUDIENCE: preserve(),
      OIDC_CLIENT_ID: preserve(),
      OIDC_JWKS_URI: preserve(),
      OIDC_BOOTSTRAP_ADMIN_EMAIL: preserve(),
      OIDC_BOOTSTRAP_ADMIN_NAME: preserve(),
      OIDC_BOOTSTRAP_ADMIN_SUBJECT: preserve(),
      PGPOOL_MAX: "8",
      PGCONNECT_TIMEOUT_MS: "5000",
      PGIDLE_TIMEOUT_MS: "30000",
      KEEP_ALIVE_TIMEOUT_MS: "65000",
      HEADERS_TIMEOUT_MS: "66000",
      REQUEST_TIMEOUT_MS: "30000",
    },
  });

  return project("Drixel Platform", {
    resources: [database, api],
  });
});
