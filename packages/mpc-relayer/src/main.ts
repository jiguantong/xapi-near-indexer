import 'reflect-metadata';

import { Command } from 'commander';
import { Container } from 'typedi';
import { StartOptions, MPCRelayerStarter } from './command/start';

const program = new Command();

program
    .name("xapi-mpc-relayer")
    .description("XAPI MPC relayer")
    .version("0.0.1");

program
    .command("start")
    .description("start XAPI MPC relayer")
    .action(async (options) => {
        const c = Container.get(MPCRelayerStarter);
        await c.start({} as StartOptions);
    });

program.parse(process.argv);