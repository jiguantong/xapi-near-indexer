import "reflect-metadata";

import { Command } from "commander";
import { Container } from "typedi";
import { StartOptions, XAPIExporterStarter } from "./command/start";
import { logger } from "@ringdao/xapi-common";

const program = new Command();

program.name("xapi-reporter").description("xapi reporter").version("0.0.1");

program
  .command("start")
  .description("start reporter program")
  .requiredOption(
    "--reward-address <char>",
    "reward address (target chain address)",
  )
  .requiredOption(
    "--near-account <char>",
    "near account",
    process.env["XAPI_NEAR_ACCOUNT"],
  )
  .requiredOption(
    "--near-private-key <char>",
    "near private key",
    process.env["XAPI_NEAR_PRIVATE_KEY"],
  )
  .action(async (options) => {
    const c = Container.get(XAPIExporterStarter);
    const startOptions: StartOptions = {
      rewardAddress: options.rewardAddress,
      nearAccount: options.nearAccount,
      nearPrivateKey: options.nearPrivateKey,
    };
    await c.start(startOptions);
  });

program.parse(process.argv);

process.on("uncaughtException", (error) => {
  logger.error(`detected uncaught exception: ${error.message}`, {
    target: "reporter",
  });
});
