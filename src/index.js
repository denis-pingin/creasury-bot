import 'regenerator-runtime/runtime.js';
import { config } from './config';
import { sendLogMessage } from './util';
import * as db from './db';
import { deployCommands } from './deploy-commands';
import * as discord from './discord';

console.log(`Creasury Bot is starting for guild: ${config.guildId}`);

deployCommands();

db.init();

const client = discord.createClient();

discord.addEventHandlers(client);

discord.login(client, config.token);

async function exitHandler(options, exitCode) {
  await sendLogMessage(client, 'Creasury Bot is going to rest now.');
  if (exitCode || exitCode === 0) {
    console.log(`Exit code: ${exitCode}`);
  }
  if (options.exit) {
    process.exit();
  }
}

// do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup:true }));

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit:true }));

// // catches "kill pid" (for example: nodemon restart)
// process.on('SIGUSR1', exitHandler.bind(null, { exit:true }));
// process.on('SIGUSR2', exitHandler.bind(null, { exit:true }));
//
// // catches uncaught exceptions
// process.on('uncaughtException', exitHandler.bind(null, { exit:true }));
