/**
 * Build su Vercel (impostata in vercel.json).
 *
 * Sul ramo develop esegue prima i test: se falliscono, la build si ferma e il
 * deploy di develop resta quello precedente. Su main (produzione) e sugli altri
 * rami fa solo la build, così le ripubblicazioni per i cambi di Storyblok
 * restano veloci.
 */
import { spawnSync } from 'node:child_process'

const TEST_BRANCHES = ['develop']

const run = (script) => {
  const { status } = spawnSync('npm', ['run', script], { stdio: 'inherit' })
  if (status !== 0) process.exit(status ?? 1)
}

const branch = process.env.VERCEL_GIT_COMMIT_REF || ''
if (TEST_BRANCHES.includes(branch)) {
  console.log(`[build] Ramo ${branch}: eseguo i test prima della build`)
  run('test')
}
run('build')
