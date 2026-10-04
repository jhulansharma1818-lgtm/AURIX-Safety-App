import app from "./app";
import { logger } from "./lib/logger";
import { seedDemoDataset } from "./lib/demo-seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

if (process.env.NODE_ENV === "development") {
  void seedDemoDataset()
    .then((result) => {
      logger.info(
        { users: result.users, journeys: result.journeys, incidents: result.incidents },
        "Synthetic demo dataset is ready",
      );
    })
    .catch((error) => {
      logger.warn(
        { err: error },
        "Synthetic demo data was not seeded; check the database schema and connection",
      );
    });
}
