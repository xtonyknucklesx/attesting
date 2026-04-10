import readline from 'readline';

const rl = () => readline.createInterface({ input: process.stdin, output: process.stdout });

/** Prompt for a single text input. */
export function input(message: string, defaultValue?: string): Promise<string> {
  const prompt = defaultValue ? `${message} [${defaultValue}]: ` : `${message}: `;
  return new Promise(resolve => {
    const r = rl();
    r.question(prompt, answer => {
      r.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/** Prompt for a selection from a list. */
export function select(message: string, options: string[], defaultIndex = 0): Promise<string> {
  return new Promise(resolve => {
    console.log(`\n  ${message}`);
    options.forEach((opt, i) => {
      const marker = i === defaultIndex ? '>' : ' ';
      console.log(`    ${marker} (${i + 1}) ${opt}`);
    });
    const r = rl();
    r.question(`\n  Choice [${defaultIndex + 1}]: `, answer => {
      r.close();
      const idx = parseInt(answer, 10) - 1;
      resolve(options[idx >= 0 && idx < options.length ? idx : defaultIndex]);
    });
  });
}

/** Prompt for yes/no. */
export function confirm(message: string, defaultYes = false): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  return new Promise(resolve => {
    const r = rl();
    r.question(`  ${message} ${hint} `, answer => {
      r.close();
      const a = answer.toLowerCase().trim();
      if (!a) resolve(defaultYes);
      else resolve(a === 'y' || a === 'yes');
    });
  });
}

/** Prompt for a multi-select (toggle with numbers, enter to confirm). */
export function multiSelect(
  message: string,
  options: Array<{ label: string; value: string; selected: boolean }>,
): Promise<string[]> {
  return new Promise(resolve => {
    console.log(`\n  ${message}`);
    console.log('  Toggle items by number, press Enter when done.\n');

    const state = options.map(o => ({ ...o }));

    function render() {
      state.forEach((opt, i) => {
        const check = opt.selected ? '✓' : ' ';
        console.log(`    [${check}] (${i + 1}) ${opt.label}`);
      });
    }

    render();

    const r = rl();
    const ask = () => {
      r.question('\n  Toggle #: ', answer => {
        const trimmed = answer.trim();
        if (!trimmed) {
          r.close();
          resolve(state.filter(o => o.selected).map(o => o.value));
          return;
        }
        const idx = parseInt(trimmed, 10) - 1;
        if (idx >= 0 && idx < state.length) {
          state[idx].selected = !state[idx].selected;
          const check = state[idx].selected ? '✓' : ' ';
          console.log(`    [${check}] (${idx + 1}) ${state[idx].label}`);
        }
        ask();
      });
    };
    ask();
  });
}
