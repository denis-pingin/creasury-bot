import * as db from '../db';
import { checkStageGoal, startStageTimer } from '../stage';
import { getMembers } from '../guild';
import { sendInviteMessage } from '../util';

export async function handleInit(client, guildId) {
  const guild = client.guilds.cache.get(guildId);

  // Get guild config
  const guildConfig = await db.getConfig(guildId);

  // Init members
  const members = await getMembers(guild, guildConfig);
  await db.initMembers(members);

  // Check stage timer
  const stage = await db.getActiveStage(guildId);
  if (stage) {
    if (stage.endTime) {
      await startStageTimer(client, stage, guildId, 10000);
    }
    const message = await checkStageGoal(client, stage, members);
    if (message) {
      await sendInviteMessage(client, message);
    }
  }
}