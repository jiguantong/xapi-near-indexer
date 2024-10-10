import "reflect-metadata";

import { Command } from "commander";
import { Container } from "typedi";
import { StartOptions, XAPIExporterStarter } from "./command/start";
import { HelixChain, HelixChainConf } from "@helixbridge/helixconf";

const program = new Command();

program.name("xapi-reporter").description("xapi reporter").version("0.0.1");

program
  .command("start")
  .description("start reporter program")
  .option(
    "-c, --chain <char>",
    "target chain list",
    (val: string, items: HelixChainConf[]) => {
      if (!val) return items;
      const chains: HelixChainConf[] = val
        .split(",")
        .map((item) => HelixChain.get(item))
        .filter((item) => item != undefined);
      items.push(...chains);
      return items;
    },
    [],
  )
  .action(async (options) => {
    console.log(options);
    const c = Container.get(XAPIExporterStarter);
    const startOptions: StartOptions = {
      targetChains: options.chain,
    };
    await c.start(startOptions);
  });

program.parse(process.argv);
