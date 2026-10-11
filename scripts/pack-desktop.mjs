import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

for (const image of ['electron.exe', '双槽.exe']) {
  spawnSync('taskkill', ['/F', '/IM', image], { stdio: 'ignore', windowsHide: true })
}

rmSync('release', { recursive: true, force: true })

const outDir = path.join(os.homedir(), 'DualSlotBuild')
rmSync(outDir, { recursive: true, force: true })

const result = spawnSync(
  'npx',
  ['electron-builder', '--win', 'portable', `-c.directories.output=${outDir}`],
  {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    },
  },
)

if (result.status === 0) {
  console.log(`\nPortable exe: ${outDir}`)
}

process.exit(result.status ?? 1)
