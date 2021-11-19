'use strict';
import 'regenerator-runtime/runtime';
import * as fs from 'fs';
import { buildInviteMessage } from '../../src/commands/distribute';

const stages = JSON.parse(fs.readFileSync(`${__dirname}/../data/stages.json`));
const unclaimedDistribution = JSON.parse(fs.readFileSync(`${__dirname}/../data/distribution-unclaimed.json`));

describe('distribute command', () => {
  test('build invite message', async () => {
    const message = buildInviteMessage(stages[0], 5, unclaimedDistribution);
    expect(message).toBe('Attention @everyone, starting reward distribution for the stage **Newborn Butterflies: Stage 1** and level **5**.\n\n' +
      '**Pioneer Champion \\*\\* I** rewards left unclaimed, as there were not enough candidates.\n\n' +
      '**Creasury Butterfly** rewards left unclaimed, as there were not enough candidates.\n\n' +
      '**Early Presale Whitelist Spot** rewards left unclaimed, as there were not enough candidates.\n\n');
  });
});