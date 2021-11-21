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
  let addition;
  switch (stage.number) {
    case 1:
      addition = 'I ';
      break;
    case 2:
      addition = 'II ';
      break;
    case 3:
      addition = 'III ';
      break;
    case 4:
      addition = 'IV ';
      break;
    case 5:
      addition = 'V ';
      break;
    default:
      addition = '';
  }
  switch (level) {
    case 1: return `${stage.rewardName} ${addition}Rookie`;
    case 2: return `${stage.rewardName} ${addition}Master`;
    case 3: return `${stage.rewardName} ${addition}Champion 3`;
    case 4: return `${stage.rewardName} ${addition}Champion 2`;
    case 5: return `${stage.rewardName} ${addition}Champion 1`;
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