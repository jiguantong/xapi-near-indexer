import {Command} from 'commander';
import {StartOptions, XAPIExporterStarter} from "./command/start";

const program = new Command();

program
  .name('xapi-reporter')
  .description('xapi reporter')
  .version('0.0.1');

program
  .command('start')
  .description('start reporter program')
  .action(async (options) => {
    const starter = new XAPIExporterStarter();
    await starter.start({} as StartOptions);
  });

program.parse(process.argv);
