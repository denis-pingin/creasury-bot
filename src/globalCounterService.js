import { getUserTag, sendLogMessage } from './util';
import { updateCounter } from './db';

async function updateGlobalCounterAndLog(client, name, user, guildId, increment) {
  const counter = await updateCounter(`global.${name}`, user, guildId, increment);
  sendLogMessage(client, `Global ${name} ${increment > 0 ? 'incremented' : 'decremented'} for user ${getUserTag(user)}, they now have ${counter} ${name}.`);
  return counter;
}

async function updateStageCounterAndLog(client, stageId, name, user, guildId, increment) {
  const counter = await updateCounter(`${stageId}.${name}`, user, guildId, increment);
  sendLogMessage(client, `${stageId} ${name} ${increment > 0 ? 'incremented' : 'decremented'} for user ${getUserTag(user)}, they now have ${counter} ${name}.`);
  return counter;
}

export { updateGlobalCounterAndLog, updateStageCounterAndLog };
