import 'reflect-metadata';

import { Command, Option } from 'commander';
import { Container } from 'typedi';
import { PublisherStarter } from './command/start';
import { logger } from "@ringdao/xapi-common";

const program = new Command();

program
    .name("xapi-publisher")
    .description("XAPI Publisher")
    .version("0.0.1");

program
    .command("start")
    .description("start XAPI Publisher")
    .addOption(new Option("--near-account <string>", "near account").env("XAPI_NEAR_ACCOUNT"))
    .addOption(new Option("--near-private-key <string>", "near private key").env("XAPI_NEAR_PRIVATE_KEY"))
    .option(
      "-t, --testnet <bool>",
      "enable testnet mode",
      false,
    )
    .action(async (options) => {
        if (!options.nearAccount) {
          logger.error('missing near account, please add --near-account or set env.XAPI_NEAR_ACCOUNT');
          process.exit(1);
        }
        if (!options.nearPrivateKey) {
          logger.error('missing near private key, please add --near-private-key or set env.XAPI_NEAR_PRIVATE_KEY');
          process.exit(1);
        }
        const c = Container.get(PublisherStarter);
        await c.start({
            nearAccount: options.nearAccount,
            nearPrivateKey: options.nearPrivateKey,
            testnet: options.testnet,
        });
    });

program.parse(process.argv);

process.on('uncaughtException', (error) => {
    logger.error(`detected uncaught exception: ${error.message}`, { target: 'main' });
})
