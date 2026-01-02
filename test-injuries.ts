import { sleeper } from './lib/providers/sleeper';

async function main() {
  console.log('Fetching PIT defensive injuries from Sleeper...\n');
  
  const injuries = await sleeper.getTeamDefensiveInjuries('PIT');
  
  if (injuries.length === 0) {
    console.log('No injuries found');
  } else {
    console.log(`Found ${injuries.length} injured defenders:\n`);
    injuries.forEach(i => {
      console.log(`  ${i.name} (${i.position}) - ${i.injuryStatus}`);
    });
  }
}

main().catch(console.error);
