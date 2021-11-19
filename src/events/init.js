import * as db from '../db';
import { checkStageGoal, startStageTimer } from '../stage';
import { getMembers } from '../guild';
import { logObject, sendInviteMessage } from '../util';

export async function handleInit(client, guildId) {
  console.log(`Handle init for guild ${guildId}`);
  const guild = client.guilds.cache.get(guildId);
  // logObject('Guild:', guild);

  // Get guild config
  const guildConfig = await db.getConfig(guildId);
  logObject('Guild config:', guildConfig);

  // Init members
  const members = await getMembers(guild, guildConfig);
  // logObject('Members:', members);
  await db.initMembers(members);

  // Check stage timer
  const stage = await db.getActiveStage(guildId);
  // logObject('Active stage:', stage);
  if (stage) {
    console.log(`Active stage: ${stage.id}`);
    if (stage.endTime) {
      console.log('Stage end time is set, starting timer');
      await startStageTimer(client, stage, guildId, 10000);
    }
    const message = await checkStageGoal(client, stage, members);
    if (message) {
      await sendInviteMessage(client, message);
    }
  } else {
    console.log('No active stage.');
  }
}