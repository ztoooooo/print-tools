// DBX dev 宿主热重载包装器：
// 跑 `vite build --mode dbx --watch`，透传其输出；
// 每次完整构建成功后额外打印独立一行 DBX_UI_BUILD_SUCCESS，
// dbx-plugin dev 只有看到该标记才会重载 UI（不能在失败路径输出）。
import { spawn } from 'node:child_process'

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', 'build', '--mode', 'dbx', '--watch'],
  { stdio: ['ignore', 'pipe', 'pipe'] }
)

let sawFirstBuild = false

function handleChunk(buf, stream) {
  const text = buf.toString()
  stream.write(text)
  // Vite watch 构建成功标志："✓ built in ..." / "built in Xms"
  if (/built in\s+/i.test(text) || /✓\s*built/i.test(text)) {
    sawFirstBuild = true
    process.stdout.write('DBX_UI_BUILD_SUCCESS\n')
  }
}

child.stdout.on('data', (b) => handleChunk(b, process.stdout))
child.stderr.on('data', (b) => process.stderr.write(b))

child.on('exit', (code) => {
  process.exit(code ?? 0)
})

process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))

// 防止未使用告警
void sawFirstBuild
