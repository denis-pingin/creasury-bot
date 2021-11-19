import * as db from './db';
import { getUserTag, markdownEscape } from './util';

export async function distributeLevelRewards(stage, rankings, level, guildId) {
  console.log(`Initiating reward distribution for the stage "${stage.id}" and level ${level} in guild ${guildId}`);

  console.log('Rankings:', rankings);

  // Get rewards
  const rewards = stage.rewards?.pending[level];
  if (!rewards) {
    console.log('No pending rewards for this level.');
    return;
  }
  console.log('Rewards:', rewards);

  level = parseInt(level);
  const candidates = getCandidates(rankings, level, stage);
  console.log('Candidates:', candidates);

  // Result object
  const result = {
    distributed: [],
    unclaimed: [],
  };

  // For all rewards
  for (let i = 0; i < rewards.length; i++) {
    const reward = rewards[i];
    console.log('Reward:', reward);

    // There are candidates
    if (candidates.length > 0) {
      // Assign reward based on distribution
      switch (reward.distribution) {
        case 'guaranteed':
          reward.winners = await distributeGuaranteedReward(candidates, reward, guildId);
          break;
        case 'weighted-lottery':
          reward.winners = await distributeLotteryReward(candidates, reward, guildId, true);
          break;
        case 'simple-lottery':
          reward.winners = await distributeLotteryReward(candidates, reward, guildId, false);
          break;
        default:
          console.warn(`Unexpected reward distribution: ${reward.distribution}`);
      }

      // Move reward from pending to distributed
      const distributedReward = { ...reward };
      delete distributedReward.supply;
      await db.updateStageRewardState(stage.id, guildId, level, distributedReward, 'distributed');
      result.distributed.push(distributedReward);

      // Save unclaimed reward
      if (reward.supply) {
        const unclaimedReward = { ...reward };
        delete unclaimedReward.winners;
        await db.updateStageRewardState(stage.id, guildId, level, unclaimedReward, 'unclaimed');
        result.unclaimed.push(unclaimedReward);
        console.log(`${unclaimedReward.supply} rewards of type "${unclaimedReward.id}" left as there were not enough candidates, marked as unclaimed.`);
      }
    } else {
      // Move reward from pending to unclaimed
      await db.updateStageRewardState(stage.id, guildId, level, reward, 'unclaimed');
      result.unclaimed.push(reward);
      console.log(`No candidates for the reward "${markdownEscape(reward.id)}", marked as unclaimed.`);
    }
  }

  return result;
}

function getCandidates(rankings, level, stage) {
  let candidates = rankings.rankings.filter(rank => rank.level === level);
  // If distributing for level 1, include candidates from level 2 who didn't get a reward
  if (level === 1) {
    // Rewards distributed in level 2
    if (stage.rewards.distributed && stage.rewards.distributed[2]) {
      // Get level 2 candidates
      let l2Candidates = rankings.rankings.filter(rank => rank.level === 2);
      console.log('L2 candidates:', l2Candidates);

      // Get level 2 distributed rewards
      let l2DistributedRewards = stage.rewards.distributed[2];
      console.log('L2 distributed rewards:', l2DistributedRewards);

      // Filter out guaranteed rewards
      l2DistributedRewards = l2DistributedRewards.filter(reward => reward.distribution !== 'guaranteed');
      console.log('L2 limited supply rewards:', l2DistributedRewards);

      // Determine level 2 winners
      const l2Winners = [];
      for (let i = 0; i < l2DistributedRewards.length; i++) {
        l2Winners.push(...l2DistributedRewards[i].winners);
      }
      console.log('L2 winners:', l2Winners);

      // Remove level 2 winners from candidates
      l2Candidates = l2Candidates.filter(candidate => l2Winners.some(winner => winner.id === candidate.id));
      console.log('Eligible L2 candidates:', l2Candidates);

      // Merge candidates
      candidates = [...candidates, ...l2Candidates];
    } else if (!stage.rewards.unclaimed || !stage.rewards.unclaimed[2]) {
      throw new Error('Trying to distribute rewards for level 1, but rewards for level 2 have not yet been distributed.');
    }
  }
  return candidates;
}

export async function distributeGuaranteedReward(candidates, reward, guildId) {
  return Promise.all(candidates.map(async candidate => {
    await db.assignReward(candidate.id, guildId, reward);
    console.log(`Reward ${markdownEscape(reward.id)} was assigned to user ${getUserTag(candidate)}`);
    return candidate.id;
  }));
}

export async function distributeLotteryReward(candidates, reward, guildId, weighted) {
  if (!reward.supply || reward.supply < 0) {
    console.error('Distributing a lottery reward needs non-zero limited supply');
    return [];
  }
  if (reward.supply < candidates.length) {
    // Supply is less than the amount of candidates
    const winners = [];
    while (reward.supply > 0) {
      // Conduct lottery
      let winner;
      if (weighted) {
        winner = conductWeightedLottery(candidates, reward, guildId);
      } else {
        winner = conductSimpleLottery(candidates, reward, guildId);
      }
      winners.push(winner);

      // Assign reward to user
      await db.assignReward(winner, guildId, reward);
      console.log(`Reward ${markdownEscape(reward.id)} was assigned to user ${getUserTag({ id: winner })}`);

      // Reduce supply
      reward.supply--;

      // Remove winner from candidates
      candidates.splice(candidates.findIndex(candidate => candidate.id === winner), 1);
      console.log('Updated candidates:', candidates);
    }
    return winners;
  } else {
    // Supply is either unlimited or there is enough for everyone
    const winners = await distributeGuaranteedReward(candidates, reward, guildId);

    // Update reward supply
    reward.supply -= candidates.length;

    // No candidates left if all rewards distributed
    candidates.length = 0;

    return winners;
  }
}

export function conductWeightedLottery(candidates, reward) {
  console.log(`Conducting a weighted lottery for the reward "${markdownEscape(reward.id)}" among ${candidates.length} candidates`);

  const tickets = getTickets(candidates);
  const ticketCount = Object.keys(tickets).length;
  console.log(`Total number of tickets is ${ticketCount}`);

  const winningTicket = Math.floor(Math.random() * ticketCount);
  const winner = tickets[winningTicket];
  console.log(`The winning ticket is #${winningTicket} and the winner is ${getUserTag({ id: winner })}`);

  return winner;
}

export function conductSimpleLottery(candidates, reward) {
  console.log(`Conducting a simple lottery for the reward "${markdownEscape(reward.id)}" among ${candidates.length} candidates`);

  const winningTicket = Math.floor(Math.random() * candidates.length);
  const winner = candidates[winningTicket].id;
  console.log(`The winning ticket is #${winningTicket} and the winner is ${getUserTag({ id: winner })}`);

  return winner;
}

function getTickets(candidates) {
  let currentTicket = 0;
  const tickets = {};
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    for (let j = 0; j < candidate.points; j++) {
      tickets[currentTicket + j] = candidate.id;
    }
    currentTicket += candidate.points;
  }
  return tickets;
}