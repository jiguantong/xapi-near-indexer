import 'reflect-metadata';

import { Command } from 'commander';
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
        const c = Container.get(PublisherStarter);
        await c.start({
            nearAccount: options.nearAccount,
            // @ts-ignore
            nearPrivateKey: options.nearPrivateKey!
        });
    });

program.parse(process.argv);

process.on('uncaughtException', (error) => {
    logger.error(`detected uncaught exception: ${error.message}`, { target: 'main' });
})