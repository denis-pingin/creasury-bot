import * as db from './db';
import { getUserTag, logObject, markdownEscape } from './util';

export async function distributeLevelRewards(stage, rankings, level, guildId) {
  console.log(`Initiating reward distribution for the stage "${stage.id}" and level ${level} in guild ${guildId}`);

  logObject('Rankings:', rankings);

  // Get rewards
  const rewards = stage.rewards?.pending[level];
  if (!rewards) {
    console.log('No pending rewards for this level.');
    return;
  }
  logObject('Rewards:', rewards);

  level = parseInt(level);
  const candidates = getCandidates(rankings, level, stage);
  logObject('Candidates:', candidates);

  // Result object
  const result = {
    distributed: [],
    unclaimed: [],
  };

  // For all rewards
  for (let i = 0; i < rewards.length; i++) {
    const reward = rewards[i];
    reward.stage = stage.id;
    logObject('Reward:', reward);

    // There are candidates
    if (candidates.length > 0) {
      // Assign reward based on distribution
      let distributionResult;
      switch (reward.distribution) {
        case 'guaranteed':
          distributionResult = await distributeGuaranteedReward(candidates, reward, guildId);
          break;
        case 'weighted-lottery':
          distributionResult = await distributeLotteryReward(candidates, reward, guildId, true);
          break;
        case 'simple-lottery':
          distributionResult = await distributeLotteryReward(candidates, reward, guildId, false);
          break;
        default:
          console.warn(`Unexpected reward distribution: ${reward.distribution}`);
      }

      // Move reward from pending to distributed
      const distributedReward = await markRewardAsDistributed(reward, distributionResult, stage, guildId, level);
      result.distributed.push(distributedReward);
      logObject('Distributed reward:', distributedReward);

      // Save unclaimed reward
      if (reward.supply) {
        const unclaimedReward = await markRewardAsUnclaimed(reward, stage, guildId, level);
        result.unclaimed.push(unclaimedReward);
        logObject('Unclaimed reward (not enough candidates):', unclaimedReward);
      }
    } else {
      // Move reward from pending to unclaimed
      const unclaimedReward = await markRewardAsUnclaimed(reward, stage, guildId, level);
      result.unclaimed.push(unclaimedReward);
      logObject('Unclaimed reward (no candidates):', unclaimedReward);
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
      logObject('L2 candidates:', l2Candidates);

      // Get level 2 distributed rewards
      let l2DistributedRewards = stage.rewards.distributed[2];
      logObject('L2 distributed rewards:', l2DistributedRewards);

      // Filter out guaranteed rewards
      l2DistributedRewards = l2DistributedRewards.filter(reward => reward.distribution !== 'guaranteed');
      logObject('L2 limited supply rewards:', l2DistributedRewards);

      // Determine level 2 winners
      const l2Winners = [];
      for (let i = 0; i < l2DistributedRewards.length; i++) {
        l2Winners.push(...l2DistributedRewards[i].winners);
      }
      logObject('L2 winners:', l2Winners);

      // Remove level 2 winners from candidates
      l2Candidates = l2Candidates.filter(candidate => l2Winners.some(winner => winner.id === candidate.id));
      logObject('Eligible L2 candidates:', l2Candidates);

      // Merge candidates
      candidates = [...candidates, ...l2Candidates];
    } else if (!stage.rewards.unclaimed || !stage.rewards.unclaimed[2]) {
      throw new Error('Trying to distribute rewards for level 1, but rewards for level 2 have not yet been distributed.');
    }
  }
  return candidates;
}

export async function distributeGuaranteedReward(candidates, reward, guildId) {
  const winners = await Promise.all(candidates.map(async candidate => {
    await db.assignReward(candidate.id, guildId, reward);
    console.log(`Reward ${markdownEscape(reward.id)} was assigned to user ${getUserTag(candidate)}`);
    return candidate.id;
  }));
  return winners.map(winner => {
    return { type: 'guaranteed', winner };
  });
}

export async function distributeLotteryReward(candidates, reward, guildId, weighted) {
  if (!reward.supply || reward.supply < 0) {
    console.error('Distributing a lottery reward needs non-zero limited supply');
    return [];
  }
  let results = [];
  if (reward.supply < candidates.length) {
    // Supply is less than the amount of candidates
    while (reward.supply > 0) {
      // Conduct the lottery
      let lotteryResult;
      if (weighted) {
        lotteryResult = conductWeightedLottery(candidates, reward, guildId);
      } else {
        lotteryResult = conductSimpleLottery(candidates, reward, guildId);
      }
      logObject('Lottery result:', lotteryResult);

      // Accumulate winners
      results.push(lotteryResult);

      // Assign reward to user
      await db.assignReward(lotteryResult.winner, guildId, reward);
      console.log(`Reward ${markdownEscape(reward.id)} was assigned to user ${getUserTag({ id: lotteryResult.winner })}`);

      // Reduce supply
      reward.supply--;

      // Remove winner from candidates
      candidates.splice(candidates.findIndex(candidate => candidate.id === lotteryResult.winner), 1);
      logObject('Updated candidates:', candidates);
    }
  } else {
    // Supply is either unlimited or there is enough for everyone
    results = await distributeGuaranteedReward(candidates, reward, guildId);
    results = results.map(result => {
      return {
        ...result,
        type: 'assigned',
      };
    });

    // Update reward supply
    reward.supply -= candidates.length;

    // No candidates left if all rewards distributed
    candidates.length = 0;

  }
  return results;
}

export function conductWeightedLottery(candidates, reward) {
  console.log(`Conducting a weighted lottery for the reward "${markdownEscape(reward.id)}" among ${candidates.length} candidates`);

  const tickets = getTickets(candidates);
  const ticketCount = Object.keys(tickets).length;
  console.log(`Total number of tickets is ${ticketCount}`);

  const winningTicket = Math.floor(Math.random() * ticketCount);
  const winner = tickets[winningTicket];
  console.log(`The winning ticket is #${winningTicket} and the winner is ${getUserTag({ id: winner })}`);

  return {
    type: 'weighted-lottery',
    winner: winner,
    participantCount: candidates.length,
    ticketCount: ticketCount,
    winningTicket: winningTicket,
  };
}

export function conductSimpleLottery(candidates, reward) {
  console.log(`Conducting a simple lottery for the reward "${markdownEscape(reward.id)}" among ${candidates.length} candidates`);

  const winningTicket = Math.floor(Math.random() * candidates.length);
  const winner = candidates[winningTicket].id;
  console.log(`The winning ticket is #${winningTicket} and the winner is ${getUserTag({ id: winner })}`);

  return {
    type: 'simple-lottery',
    winner: winner,
    participantCount: candidates.length,
    ticketCount: candidates.length,
    winningTicket: winningTicket,
  };
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

async function markRewardAsDistributed(reward, distributionResult, stage, guildId, level) {
  const distributedReward = { ...reward };
  distributedReward.winners = distributionResult.map(r => r.winner);
  distributedReward.distributionDetails = distributionResult;
  delete distributedReward.supply;
  delete distributedReward.stage;
  await db.updateStageRewardState(stage.id, guildId, level, distributedReward, 'distributed');
  return distributedReward;
}

async function markRewardAsUnclaimed(reward, stage, guildId, level) {
  const unclaimedReward = { ...reward };
  delete unclaimedReward.stage;
  await db.updateStageRewardState(stage.id, guildId, level, unclaimedReward, 'unclaimed');
  return unclaimedReward;
}
