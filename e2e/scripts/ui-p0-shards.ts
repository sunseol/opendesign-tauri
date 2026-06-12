import { spawn } from 'node:child_process';

type Shard = {
  grep: string;
  files: string[];
};

const shards: Record<string, Shard> = {
  smoke: {
    grep: String.raw`\[P0\]`,
    files: ['ui/critical-smoke.test.ts'],
  },
  'settings-smoke': {
    grep: String.raw`\[P0\].*settings dialog`,
    files: ['ui/critical-smoke.test.ts'],
  },
};

const commandName = process.argv[2] ?? 'help';

if (commandName === 'help') {
  printUsage();
} else if (commandName === 'list') {
  console.log(Object.keys(shards).join('\n'));
} else {
  const shard = shards[commandName];
  if (shard == null) {
    console.error(`Unknown UI P0 shard: ${commandName}`);
    printUsage();
    process.exitCode = 1;
  } else {
    await runPlaywright(shard);
  }
}

async function runPlaywright(shard: Shard): Promise<void> {
  const args = ['test', '-c', 'playwright.config.ts', ...shard.files, '--grep', shard.grep];
  const child = spawn('playwright', args, {
    stdio: 'inherit',
    shell: false,
  });

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code));
  });
  process.exitCode = exitCode ?? 1;
}

function printUsage(): void {
  console.log(`Usage: tsx scripts/ui-p0-shards.ts <shard>

Shards:
${Object.keys(shards)
  .map((name) => `  ${name}`)
  .join('\n')}

Commands:
  list    Print shard names
  help    Show this help
`);
}
