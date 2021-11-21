import * as util from 'util';
import * as guild from './guild';

export async function sendInviteMessage(client, guildId, message) {
  console.log(`#invites: ${message}`);

  if (!client) return;

  const guildConfig = await guild.getGuildConfig(guildId);

  if (guildConfig.inviteChannelId) {
    const channel = client.channels.cache.get(guildConfig.inviteChannelId);
    if (channel) {
      await channel.send(message);
    } else {
      console.warn(`Invite channel with ID ${guildConfig.inviteChannelId} not found!`);
    }
  } else {
    console.warn('Invite channel ID not configured');
  }
}

export async function sendLogMessage(client, guildId, message) {
  console.log(`#log: ${message}`);

  if (!client) return;

  const guildConfig = await guild.getGuildConfig(guildId);

  if (guildConfig.logChannelId) {
    const channel = client.channels.cache.get(guildConfig.logChannelId);
    if (channel) {
      await channel.send(message);
    } else {
      console.warn(`Log channel with ID ${guildConfig.logChannelId} not found!`);
    }
  } else {
    console.warn('Log channel ID not configured');
  }
}

export function getInviterTag(user) {
  if (!user) return 'some mysterious force';
  return getUserTag(user);
}

export function getUserTag(user) {
  if (!user) return 'unknown member';
  return `<@${user.id}>`;
}

export function getRewardTag(stage, level) {
  const addition = `${ stage.number === 1 ? 'I' : stage.number === 2 ? 'II' : '' }`;
  switch (level) {
    case 1: return `${stage.rewardName} Rookie ${addition}`;
    case 2: return `${stage.rewardName} Master ${addition}`;
    case 3: return markdownEscape(`${stage.rewardName} Champion * ${addition}`);
    case 4: return markdownEscape(`${stage.rewardName} Champion ** ${addition}`);
    case 5: return markdownEscape(`${stage.rewardName} Champion *** ${addition}`);
  }
}

export function markdownEscape(text) {
  return text.replace(/(_|\*|~|`|\|)/g, '\\$1');
}

export function logObject(message, object) {
  console.log(message, util.inspect(object, { showHidden: false, depth: null, colors: true }));
}

export function pause(ms) {
  return new Promise(res => setTimeout(res, ms));
}