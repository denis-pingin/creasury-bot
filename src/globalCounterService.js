import { getUserTag, sendLogMessage } from './util';
import { updateGlobalCounter } from './db';

async function updateGlobalCounterAndLog(client, name, user, guildId, increment) {
  const counter = await updateGlobalCounter(name, user, guildId, increment);
  sendLogMessage(client, `Global ${name} counter ${increment > 0 ? 'incremented' : 'decremented'} for user ${getUserTag(user)}, they now have ${counter} ${name}.`);
  return counter;
}

export { updateGlobalCounterAndLog };
