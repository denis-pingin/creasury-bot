import { getUserTag, sendLogMessage } from './util';
import { updateCounter } from './db';

async function updateGlobalCounterAndLog(client, name, user, guildId, increment) {
  const counter = await updateCounter(`global.${name}`, user, guildId, increment);
  await sendLogMessage(client, guildId, `Global counter **"${name}"** ${increment > 0 ? 'incremented' : 'decremented'} for member ${getUserTag(user)}, they now have ${counter}.`);
  return counter;
}

async function updateStageCounterAndLog(client, stageId, name, user, guildId, increment) {
  const counter = await updateCounter(`${stageId}.${name}`, user, guildId, increment);
  await sendLogMessage(client, guildId, `${stageId} counter **"${name}"** ${increment > 0 ? 'incremented' : 'decremented'} for member ${getUserTag(user)}, they now have ${counter}.`);
  return counter;
}

export { updateGlobalCounterAndLog, updateStageCounterAndLog };
