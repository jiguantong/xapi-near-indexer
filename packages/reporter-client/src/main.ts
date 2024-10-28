import "reflect-metadata";

import { Command } from "commander";
import { Container } from "typedi";
import { StartOptions, XAPIExporterStarter } from "./command/start";
import { logger } from "@ringdao/xapi-common";
import { HelixChain } from "@helixbridge/helixconf";

const program = new Command();

program.name("xapi-reporter").description("xapi reporter").version("0.0.1");

program
  .command("start")
  .description("start reporter program")
  .requiredOption(
    "--reward-address <char>",
    "reward address (target chain address)",
    process.env["XAPI_REWARD_ADDRESS"],
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
  .option(
    "-m, --minimum-rewards <char>",
    "minimum rewards",
    (val: string, items: string[]) => {
      if (!val) return items;
      const mrs: string[] = val.split(",");
      items.push(...mrs);
      return items;
    },
    [],
  )
  .action(async (options) => {
    const c = Container.get(XAPIExporterStarter);

    const minimumRewards: Record<string, bigint> = {};
    for (const mr of options.minimumRewards) {
      const [chain, rewards] = mr.split(":");
      const hc = HelixChain.get(chain);
      if (!hc) continue;
      try {
        minimumRewards[hc.code] = BigInt(rewards);
      } catch (e: any) {
        logger.warn(`wrong minimum config, can not parse ${e.message || e}`, {
          target: "reporter",
        });
      }
    }
    const startOptions: StartOptions = {
      rewardAddress: options.rewardAddress,
      nearAccount: options.nearAccount,
      nearPrivateKey: options.nearPrivateKey,
      minimumRewards,
    };
    await c.start(startOptions);
  });

program.parse(process.argv);

process.on("uncaughtException", (error) => {
  logger.error(`detected uncaught exception: ${error.message}`, {
    target: "reporter",
  });
});

const envEnableRewriteConsole = process.env.XAPI_REWRITE_CONSOLE;
if (envEnableRewriteConsole === '1' || envEnableRewriteConsole === 'true') {
  console.log = function () { return; };
}
