import 'dotenv/config';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const NEW_COMMAND = {
  name: 'new',
  description: 'Basic command for further testing',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options


const QUEUE_COMMAND = {
  name: 'queue',
  description: 'create a queue for game role',
  options: [
    {
      type: 8,
      name: 'gamerole',
      description: 'choose a game role',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const ALL_COMMANDS = [TEST_COMMAND, NEW_COMMAND, QUEUE_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
