import { atom, read, update } from 'claude-code'
import type { Register, SessionRateLimit, SessionContextUsage } from 'claude-code'

import type { MeterReading } from '../types'

const PANE = 'usage-meter'
const TITLE = '使用率メーター'
const BAR_WIDTH = 20
// 棒の縦の幅（1行ぶんに対する割合）
const BAR_HEIGHT = '50%'

const reading = atom({ plugin: 'usage-meter', key: 'reading' } as const, {
  limits: [],
  updatedAt: 0,
} as MeterReading)

const toReading = (
  limits: SessionRateLimit[],
  context: SessionContextUsage,
  now: number,
): MeterReading => ({
  limits: limits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
  contextPercent: context.percent,
  updatedAt: now,
})

// 70%以上は黄色、80%以上は赤
const colorFor = (p: number) => (p >= 80 ? 'error' : p >= 70 ? 'warning' : 'success')

// 未使用部分の色
const UNUSED_COLOR = '#ffffff'

const filledCells = (p: number) => Math.round((Math.min(100, Math.max(0, p)) / 100) * BAR_WIDTH)

const untilReset = (resetsAt: string | undefined, now: number) => {
  if (!resetsAt) return undefined
  const ms = Date.parse(resetsAt) - now
  if (!Number.isFinite(ms)) return undefined
  if (ms <= 0) return 'まもなくリセット'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h >= 24) return `リセットまであと${Math.floor(h / 24)}日${h % 24}時間`
  return `リセットまであと${h}時間${m}分`
}

// 画面下のステータス表示に出す短い文字
const pct = (p: number | undefined) => (p === undefined ? '－' : `${p.toFixed(p % 1 === 0 ? 0 : 1)}%`)

const shortReset = (resetsAt: string | undefined, now: number) => {
  const s = untilReset(resetsAt, now)
  return s ? `（${s.replace('リセットまで', '')}）` : ''
}

// パネル用の短い「あと〇時間」
const shortAfter = (resetsAt: string | undefined, now: number) => {
  const s = untilReset(resetsAt, now)
  return s ? s.replace('リセットまで', '') : undefined
}

const statusText = (r: MeterReading, now: number) => {
  const five = r.limits.find(l => l.kind === 'five_hour')
  const week = r.limits.find(l => l.kind === 'seven_day')
  return [
    `5時間枠 ${pct(five?.percentUsed)}${shortReset(five?.resetsAt, now)}`,
    `週枠 ${pct(week?.percentUsed)}`,
    `この会話 ${pct(r.contextPercent)}`,
  ].join('｜')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'meter', description: '使用率メーターを開く' })
    try {
      const u = await $.session.usage()
      const r = toReading(u.rateLimits, u.context, Date.now())
      await update($, reading, () => r)
      void $.ui.status(statusText(r, Date.now()))
    } catch {
      // 数字がまだ無いときは、最初の返事で入る
    }
    // 横のパネルは自動では開かない。メーターはチャットの下（入力欄のすぐ上）の帯に出す。パネルは /meter で開く
    return next(e)
  })

  on('command.run', { command: 'meter' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: '使用率メーターを開きました。' }
  })

  // 返事のたび（と、枠の数字が動いたとき）に更新
  on('session.measure', async ($, e, next) => {
    const r = toReading(e.rateLimits, e.context, Date.now())
    await update($, reading, () => r)
    void $.ui.status(statusText(r, Date.now()))
    return next(e)
  })

  // チャットの下（入力欄のすぐ上）の帯：1行で 5時間・週・会話
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const r = await read($, reading)
    const now = Date.now()
    const five = r.limits.find(l => l.kind === 'five_hour')
    const week = r.limits.find(l => l.kind === 'seven_day')
    const item = (label: string, p: number | undefined, sub?: string) => (
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Text weight="semibold">{label}</Text>
        {p === undefined ? (
          <Text dimColor>－</Text>
        ) : (
          <>
            {e.surface === 'terminal' ? (
              <Text>
                <Text color={colorFor(p)}>{'█'.repeat(Math.round(filledCells(p) / 2))}</Text>
                <Text color={UNUSED_COLOR}>{'█'.repeat(BAR_WIDTH / 2 - Math.round(filledCells(p) / 2))}</Text>
              </Text>
            ) : (
              <Box width={8} height={1} flexDirection="column" justifyContent="center">
                <Box height={BAR_HEIGHT} backgroundColor={UNUSED_COLOR} overflow="hidden">
                  <Box width={`${Math.round(Math.min(100, Math.max(0, p)))}%`} height="100%" backgroundColor={colorFor(p)} />
                </Box>
              </Box>
            )}
            <Text color={colorFor(p)} weight="semibold" tabular>{pct(p)}</Text>
          </>
        )}
        {sub !== undefined && <Text dimColor>{sub}</Text>}
      </Box>
    )
    return (
      <Box flexDirection="row" flexWrap="wrap" gap={2}>
        {item('5時間', five?.percentUsed, shortAfter(five?.resetsAt, now))}
        {item('週', week?.percentUsed)}
        {item('会話', r.contextPercent)}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const r = await read($, reading)
    const now = Date.now()

    // 1つの数字を1行で：名前・棒・％・リセットまで
    const row = (label: string, p: number | undefined, sub?: string) => (
      <Box flexDirection="row" alignItems="center" gap={1} marginBottom="xs">
        <Box minWidth={6} flexShrink={0}>
          <Text weight="semibold" size="heading">{label}</Text>
        </Box>
        {p === undefined ? (
          <Text dimColor>－（次の返事で表示）</Text>
        ) : (
          <>
            {e.surface === 'terminal' ? (
              <Text>
                <Text color={colorFor(p)}>{'█'.repeat(filledCells(p))}</Text>
                <Text color={UNUSED_COLOR}>{'█'.repeat(BAR_WIDTH - filledCells(p))}</Text>
              </Text>
            ) : (
              // 1行ぶんの枠の真ん中に、高さ半分の棒を置く
              <Box flexGrow={1} height={1} flexDirection="column" justifyContent="center">
                <Box height={BAR_HEIGHT} backgroundColor={UNUSED_COLOR} overflow="hidden">
                  <Box
                    width={`${Math.round(Math.min(100, Math.max(0, p)))}%`}
                    height="100%"
                    backgroundColor={colorFor(p)}
                  />
                </Box>
              </Box>
            )}
            <Text color={colorFor(p)} weight="semibold" size="heading" tabular>
              {pct(p)}
            </Text>
          </>
        )}
        {sub !== undefined && <Text dimColor>{sub}</Text>}
      </Box>
    )

    const five = r.limits.find(l => l.kind === 'five_hour')
    const week = r.limits.find(l => l.kind === 'seven_day')
    const updated =
      r.updatedAt > 0
        ? `更新 ${new Date(r.updatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
        : 'まだ更新されていません'

    // ペインの下のほうに寄せて表示する
    const rows = e.props.scroll.bodyRows
    return (
      <Box flexDirection="column" justifyContent="flex-end" minHeight={rows}>
        {row('5時間', five?.percentUsed, shortAfter(five?.resetsAt, now))}
        {row('週', week?.percentUsed, shortAfter(week?.resetsAt, now))}
        {row('会話', r.contextPercent)}
        <Text dimColor>{updated}</Text>
      </Box>
    )
  })
}
