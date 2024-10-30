import "reflect-metadata";

import { Command, Option } from "commander";
import { Container } from "typedi";
import { StartOptions, XAPIExporterStarter } from "./command/start";
import { logger } from "@ringdao/xapi-common";
import { HelixChain } from "@helixbridge/helixconf";
import chalk = require("chalk");

const program = new Command();

program.name("xapi-reporter").description("xapi reporter").version("0.0.1");

program
  .command("start")
  .description("start reporter program")
  .addOption(new Option("--reward-address <string>", "reward address (target chain address)").env("XAPI_REWARD_ADDRESS"))
  .addOption(new Option("--near-account <string>", "near account").env("XAPI_NEAR_ACCOUNT"))
  .addOption(new Option("--near-private-key <string>", "near private key").env("XAPI_NEAR_PRIVATE_KEY"))
  .option(
    "-t, --testnet <bool>",
    "enable testnet mode",
    false,
  )
  .option(
    "-m, --minimum-rewards <string>",
    "minimum rewards, e.g. --minimum-rewards=darwinia:100,crab:100",
    (val: string, items: string[]) => {
      if (!val) return items;
      const mrs: string[] = val.split(",");
      items.push(...mrs);
      return items;
    },
    [],
  )
  .action(async (options) => {
    if (!options.nearAccount) {
      logger.error('missing near account, please add --near-account or set env.XAPI_NEAR_ACCOUNT');
      process.exit(1);
    }
    if (!options.nearPrivateKey) {
      logger.error('missing near account, please add --near-private-key or set env.XAPI_NEAR_PRIVATE_KEY');
      process.exit(1);
    }
    logger.info(`=== start reporter client ===`, {
      target: "reporter",
    });
    logger.info(`your reward address is: ${options.rewardAddress}`, {
      target: "reporter",
    });
    if (options.minimumRewards.length) {
      logger.info(
        `your setted minimum rewards: ${options.minimumRewards.join(",")}`,
        { target: "reporter" },
      );
    } else {
      logger.warn(
        `missing minimum rewards config, you will report any jobs, you can add ${chalk.red(
          "-m",
        )} or ${chalk.red("--minimum-rewards")} to your bootstrap arguments`,
        { target: "reporter" },
      );
    }

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
      testnet: options.testnet,
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
if (envEnableRewriteConsole === "1" || envEnableRewriteConsole === "true") {
  console.log = function () {
    const longests = [];
    for (let i = 0; i < arguments.length; i++) {
      longests.push(arguments[i].toString());
    }
    logger.debug(`>>>> ${longests.join(",")}`, {
      target: "reporter",
    });
  };
}
