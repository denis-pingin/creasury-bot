import { config } from './config';
import * as util from 'util';

export async function sendInviteMessage(client, message) {
  console.log(`#invites: ${message}`);

  if (!client) return;

  const channel = client.channels.cache.get(config.inviteChannelId);
  if (!channel) {
    console.log('Warning: invite channel not found');
  } else {
    await channel.send(message);
  }
}

export async function sendLogMessage(client, message) {
  console.log(`#log: ${message}`);

  if (!client) return;

  const channel = client.channels.cache.get(config.logChannelId);
  if (!channel) {
    console.log('Warning: log channel not found');
  } else {
    await channel.send(message);
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
