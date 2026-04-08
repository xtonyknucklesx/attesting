#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('crosswalk')
  .description('OSCAL-native compliance control platform')
  .version('0.1.0');

// Commands will be registered here as they're built
// See docs/CROSSWALK_SPEC.md for the full command reference

program.parse();
