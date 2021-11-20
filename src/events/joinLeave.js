import * as db from '../db';
import handleGuildMemberAdd from './guildMemberAdd';
import handleGuildMemberRemove from './guildMemberRemove';

export function startWatchingEvents(client) {
  db.startWatchingEvents(async (event) => {
    const startTime = Date.now();
    switch (event.type) {
      case 'join':
        await handleGuildMemberAdd(client, event);
        break;
      case 'leave':
        await handleGuildMemberRemove(client, event);
        break;
    }
    const endTime = Date.now();
    await db.addMetric(event.type, endTime - startTime);
  }).then(() => {
    console.log('Started watching events.');
  }).catch((error) => {
    console.log('Failed watching events:', error);
  });
}

export function stopWatchingEvents() {
  db.stopWatchingEvents();
}
